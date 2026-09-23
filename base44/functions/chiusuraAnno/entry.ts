import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { giornoRoma, oggiRoma } from "../../shared/giornoItaliano.ts";
import { formatoKg } from "../../shared/formato.ts";
import { utenteCorrente, rispostaSolaLettura } from "../../shared/permessi.ts";
import { momentoRilevazione } from "../../shared/giacenzaStoccaggi.ts";
import {
  giornoChiusura, GRUPPO_TERZIARIE, classePfu, movimentoChiusura,
  leggiLetteraGiacenze, preparaChiusura,
} from "../../shared/chiusuraAnno.ts";

// La chiusura dell'anno: prepara la fotografia del 31 dicembre da cui
// ripartiranno le giacenze dell'anno dopo, e la salva.
//
// Il conto sta tutto in shared/chiusuraAnno.ts: qui si leggono gli archivi, si
// mettono i movimenti nella forma che quel modulo si aspetta e si scrive la
// fotografia. Le regole di sempre: il periodo di un movimento e' la FINE DEL
// TRASPORTO (la chiusura a portale serve solo a dire se la fotografia lo
// contiene gia'), rete, ACI ed extra raccolta non si sommano mai, le terziarie
// non sono un canale.
//
// Azioni:
//   'prepara' (per difetto)  legge e restituisce il dossier: chiunque.
//   'salva'                  scrive le rilevazioni al 31/12: solo l'amministratore.
//
// Corpo della richiesta:
//   { anno, azione, fotografia_del, letture, decisioni, letture_impianti,
//     lettera_fogli, siti, sostituisci }
export default async function (req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const { user, puoScrivere, errore } = await utenteCorrente(base44);
    if (errore) return errore;

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno);
    if (!anno) return Response.json({ error: 'Anno obbligatorio' }, { status: 400 });
    const azione = body.azione === 'salva' ? 'salva' : 'prepara';
    // Chiunque puo' guardare e scaricare; la fotografia la salva l'amministratore.
    if (azione === 'salva' && !puoScrivere) return rispostaSolaLettura();

    const norm = normalizzaRagioneSociale;
    const al = giornoChiusura(anno);
    const tdNorm = (v) => String(v || '').toLowerCase().trim();
    const eTerminato = (r) => String(r.stato || '').trim().toLowerCase() === 'terminato';
    const tipoStoc = (r) => tdNorm(r.tipo_destinazione) === 'stoc';
    const eSecondariaExtra = (r) => String(r.tipo_movimento || '').toLowerCase().trim() === 'secondaria';

    const [reteAll, aciAll, extraAll, secAll, terzAll, rilevazioni, giacenzeSito] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
      fetchAll(base44.asServiceRole.entities.Secondaria),
      fetchAll(base44.asServiceRole.entities.Terziaria),
      fetchAll(base44.asServiceRole.entities.GiacenzaStoccaggio),
      fetchAll(base44.asServiceRole.entities.GiacenzaSito, { anno }),
    ]);

    // --- I nomi da mostrare: la forma piu' completa fra quelle degli archivi ---
    const nomi = new Map();
    const registraNome = (raw) => {
      const s = String(raw || '').replace(/\s+/g, ' ').trim();
      const ns = norm(s);
      if (!s || !ns) return;
      const attuale = nomi.get(ns);
      if (!attuale || s.length > attuale.length) nomi.set(ns, s);
    };
    for (const r of [...reteAll, ...aciAll, ...extraAll]) registraNome(r.destinazione);
    for (const r of secAll) { registraNome(r.destinazione); registraNome(r.stoccaggio); }
    for (const r of terzAll) { registraNome(r.unita_locale_origine); registraNome(r.ragione_sociale); }
    for (const r of rilevazioni) registraNome(r.sito);
    for (const g of giacenzeSito) registraNome(g.sito);
    const nomeDi = (ns) => nomi.get(ns) || ns;

    // --- I movimenti, nella forma della chiusura ---
    // Solo i terminati con una fine trasporto entro il 31 dicembre dell'anno che
    // si chiude: quello che finisce dopo appartiene all'anno nuovo.
    // Chi e' insieme impianto e stoccaggio - Irigom, T-Cycle - ha due giacenze
    // che si leggono in due modi diversi: i movimenti si tengono divisi per
    // ruolo, quello che arriva al suo piazzale non e' quello che ha in impianto.
    const perSito = new Map(); // 'chiave|ruolo' -> { chiave, nome, ruolo, movimenti }
    const daChi = (r) => r.trasportatore || r.ragione_sociale || '';
    const raccogli = (r, sito, ruolo, opzioni) => {
      const ns = norm(sito);
      if (!ns || !eTerminato(r)) return;
      const g = giornoRoma(r.trasporto_finito_il);
      if (!g || g > al) return;
      const k = `${ns}|${ruolo}`;
      if (!perSito.has(k)) perSito.set(k, { chiave: ns, nome: nomeDi(ns), ruolo, movimenti: [] });
      const riga = perSito.get(k);
      riga.movimenti.push(movimentoChiusura(r, { sito: ns, nome: riga.nome, ruolo, ...opzioni }));
    };

    for (const r of reteAll) {
      raccogli(r, r.destinazione, tipoStoc(r) ? 'stoc' : 'imp',
        { tipo: 'primaria', canale: 'RETE', verso: 'ingresso', classe: classePfu(r.classe, r.prodotto), controparte: daChi(r) });
    }
    for (const r of aciAll) {
      raccogli(r, r.destinazione, tipoStoc(r) ? 'stoc' : 'imp',
        { tipo: 'primaria', canale: 'ACI', verso: 'ingresso', classe: 'ACI', controparte: daChi(r) });
    }
    for (const r of secAll) {
      const canale = eAci(r) ? 'ACI' : 'RETE';
      const classe = canale === 'ACI' ? 'ACI' : classePfu(r.classe, r.prodotto);
      raccogli(r, r.destinazione, tipoStoc(r) ? 'stoc' : 'imp',
        { tipo: 'secondaria', canale, verso: 'ingresso', classe, controparte: r.stoccaggio });
      // La partenza riguarda il piazzale che spedisce.
      raccogli(r, r.stoccaggio, 'stoc',
        { tipo: 'secondaria', canale, verso: 'uscita', classe, controparte: r.destinazione });
    }
    for (const r of extraAll) {
      const classe = classePfu(r.classe, r.prodotto);
      if (eSecondariaExtra(r)) {
        raccogli(r, r.stoccaggio, 'stoc', { tipo: 'secondaria', canale: 'EXTRA_RACCOLTA', verso: 'uscita', classe, controparte: r.destinazione });
        raccogli(r, r.destinazione, tipoStoc(r) ? 'stoc' : 'imp', { tipo: 'secondaria', canale: 'EXTRA_RACCOLTA', verso: 'ingresso', classe, controparte: r.stoccaggio });
        continue;
      }
      raccogli(r, r.destinazione, tipoStoc(r) ? 'stoc' : 'imp', { tipo: 'primaria', canale: 'EXTRA_RACCOLTA', verso: 'ingresso', classe, controparte: daChi(r) });
    }
    // Le terziarie escono dall'impianto verso le cementerie: non sono un canale,
    // ma se il portale le chiude a febbraio la fotografia del 31/12 non le ha.
    for (const r of terzAll) {
      raccogli(r, r.unita_locale_origine || r.ragione_sociale, 'imp',
        { tipo: 'terziaria', canale: GRUPPO_TERZIARIE, verso: 'uscita', classe: 'ND', controparte: r.destinazione });
    }

    // --- Piazzali e impianti ---
    // Un sito non si esclude mai perche' quest'anno non ha un contratto: se non
    // e' piu' contrattualizzato svuota lo stesso la giacenza dell'anno prima,
    // con secondarie e terziarie (regola dell'utente, 23/09/2026).
    const rilevPer = new Map(); // chiave -> rilevazioni
    for (const r of rilevazioni) {
      const ns = norm(r.sito);
      if (!ns) continue;
      if (!rilevPer.has(ns)) rilevPer.set(ns, []);
      rilevPer.get(ns).push(r);
    }
    const ruoloDaGiacenzaSito = new Map(); // chiave -> insieme dei ruoli dichiarati
    for (const g of giacenzeSito) {
      const ns = norm(g.sito);
      if (!ns) continue;
      if (!ruoloDaGiacenzaSito.has(ns)) ruoloDaGiacenzaSito.set(ns, new Set());
      ruoloDaGiacenzaSito.get(ns).add(tdNorm(g.tipo_destinazione) || 'imp');
    }

    const chiavi = new Set([
      ...[...perSito.keys()].map(k => k.split('|')[0]),
      ...rilevPer.keys(), ...ruoloDaGiacenzaSito.keys(),
    ]);
    const piazzali = [], impianti = [];
    for (const ns of chiavi) {
      const comeStoc = perSito.get(`${ns}|stoc`);
      const comeImp = perSito.get(`${ns}|imp`);
      const ruoli = ruoloDaGiacenzaSito.get(ns) || new Set();
      const nome = nomeDi(ns);
      // E' un piazzale se lo dice l'anagrafica, se ha una rilevazione o se i
      // movimenti gli arrivano come stoccaggio; e' un impianto se lo dice
      // l'anagrafica o se ha movimenti da impianto. Puo' essere tutti e due.
      if (ruoli.has('stoc') || rilevPer.has(ns) || comeStoc) {
        piazzali.push({ chiave: ns, nome, rilevazioni: rilevPer.get(ns) || [], movimenti: comeStoc ? comeStoc.movimenti : [] });
      }
      if (ruoli.has('imp') || comeImp) {
        impianti.push({ chiave: ns, nome, movimenti: comeImp ? comeImp.movimenti : [] });
      }
    }
    const perNome = (a, b) => a.nome.localeCompare(b.nome);
    piazzali.sort(perNome);
    impianti.sort(perNome);

    // La lettera arriva dal browser come righe di celle: la legge il modulo
    // condiviso, cosi' la prova la puo' rifare sul file vero.
    const lettera = body.lettera_fogli ? leggiLetteraGiacenze(body.lettera_fogli) : null;

    const dossier = preparaChiusura({
      anno,
      fotografia_del: String(body.fotografia_del || '').slice(0, 10),
      piazzali, impianti,
      letture: body.letture || {},
      decisioni: body.decisioni || {},
      letture_impianti: body.letture_impianti || {},
      lettera,
    });

    if (azione === 'prepara') return Response.json({ ...dossier, puo_salvare: puoScrivere });

    // --- Il salvataggio della fotografia ---
    // Una rilevazione al 31/12 e' il punto di partenza dei calcoli dell'anno
    // dopo: si scrive solo quando la lettura c'e' e l'elenco di dicembre e'
    // stato deciso voce per voce. Il motivo resta scritto nella nota.
    const soloQuesti = new Set(body.siti || []);
    const salvati = [], saltati = [];
    for (const c of dossier.piazzali) {
      if (soloQuesti.size && !soloQuesti.has(c.sito)) continue;
      if (!c.pronto) { saltati.push({ sito: c.nome, motivo: c.blocchi.map(b => b.testo).join(' ') }); continue; }
      if (c.gia_salvata && !body.sostituisci) {
        saltati.push({ sito: c.nome, motivo: `C'e' gia' una fotografia del ${c.giorno}: per rifarla serve la conferma di sostituzione.` });
        continue;
      }
      const precedente = (rilevPer.get(c.sito) || [])
        .slice()
        .sort((a, b) => momentoRilevazione(a).localeCompare(momentoRilevazione(b))
          || String(a.created_date || '').localeCompare(String(b.created_date || '')))
        .pop();
      const rett = c.rettifica;
      // Gli ordini si scrivono tutti finche' la nota resta leggibile; oltre, si
      // dice quanti sono e il resto sta nel dossier.
      const elenca = (voci, quanti = 20) => (voci.length > quanti
        ? `${voci.slice(0, quanti).join('; ')} e altri ${voci.length - quanti}`
        : voci.join('; '));
      const rettifiche = rett.applicate.map(a => `${a.id_ordine || a.numero_fir} ${a.effetto_kg > 0 ? '+' : ''}${formatoKg(a.effetto_kg)} kg in ${a.classe}${a.classe_del_portale ? ` (il portale lo aveva in ${a.classe_del_portale})` : ''}`);
      const note = [
        `Chiusura ${anno}, fotografia del ${c.giorno} salvata da ${user.email || 'amministratore'} il ${oggiRoma()}.`,
        `Lettura del portale: P ${formatoKg(rett.lettura.P)}, M ${formatoKg(rett.lettura.M)}, G1 ${formatoKg(rett.lettura.G1)}, G2 ${formatoKg(rett.lettura.G2)}, ACI ${formatoKg(rett.lettura.ACI)} kg.`,
        rettifiche.length
          ? `Rettificata con l'elenco di dicembre (${rettifiche.length} ${rettifiche.length === 1 ? 'movimento' : 'movimenti'} che il portale non aveva ancora chiuso): ${elenca(rettifiche)}.`
          : "Elenco di dicembre guardato voce per voce: nessuna rettifica da fare.",
        rett.ignorate.length ? `Gia' nella fotografia, quindi non toccati: ${elenca(rett.ignorate.map(v => v.id_ordine || v.numero_fir))}.` : '',
        rett.fuori_portale.length ? `Fuori dal portale (extra raccolta), elencati e non conteggiati: ${elenca(rett.fuori_portale.map(v => v.id_ordine || v.numero_fir))}.` : '',
        c.aperti_prima.n ? `Restano ${c.aperti_prima.n} movimenti dell'anno finiti prima di dicembre e ancora aperti a portale alla fotografia.` : '',
      ].filter(Boolean).join(' ');

      try {
        const creato = await base44.asServiceRole.entities.GiacenzaStoccaggio.create({
          sito: c.nome,
          id_unita_stoccaggio: precedente && precedente.id_unita_stoccaggio !== undefined ? precedente.id_unita_stoccaggio : undefined,
          descrizione_unita: precedente ? precedente.descrizione_unita : undefined,
          comune: precedente ? precedente.comune : undefined,
          provincia: precedente ? precedente.provincia : undefined,
          data_rilevazione: c.giorno,
          class1_kg: c.da_salvare.P,
          class2_kg: c.da_salvare.M,
          class3_kg: c.da_salvare.G1,
          class4_kg: c.da_salvare.G2,
          class9_kg: c.da_salvare.ACI,
          note,
        });
        salvati.push({ sito: c.nome, id: creato && creato.id, classi: c.da_salvare, sostituisce: c.gia_salvata });
      } catch (e) {
        saltati.push({ sito: c.nome, motivo: `Non si e' riusciti a scrivere la fotografia: ${e.message}` });
      }
    }

    return Response.json({ ...dossier, puo_salvare: puoScrivere, salvati, saltati });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
