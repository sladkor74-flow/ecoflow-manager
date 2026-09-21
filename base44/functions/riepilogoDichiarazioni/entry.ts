import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll, perPagina } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { giornoRoma } from "../../shared/giornoItaliano.ts";
import { eTerminato, periodoMovimento } from "../../shared/movimenti.ts";
import { MESI, operazioneDa, quadratura } from "../../shared/dichiarazioniImpianti.ts";

// Dichiarazioni degli impianti, mese per mese, con la quadratura delle giacenze.
//
// Chi dichiara e' l'IMPIANTO, perche' e' l'impianto che tratta. Uno stoccaggio
// non tratta: riceve i PFU e li rimanda in secondaria, e in quel viaggio e' il
// PRODUTTORE. La dichiarazione di quello che e' passato da uno stoccaggio si puo'
// chiedere solo dopo il secondo viaggio, e la fa l'impianto che lo ha ricevuto.
// Vale per la rete, per l'ACI e per l'extra raccolta. Percio' qui:
//   - alle righe da dichiarare di un impianto vanno le primarie arrivate
//     all'impianto e le secondarie che gli sono arrivate dagli stoccaggi, con
//     scritto da quale stoccaggio;
//   - uno stoccaggio non ha righe da dichiarare: ha entrate, partenze in
//     secondaria verso gli impianti e quello che resta in piazzale;
//   - chi e' insieme impianto e stoccaggio (Irigom, T-Cycle) si tiene diviso: i
//     carichi arrivati come stoccaggio non sono suoi da dichiarare finche' non
//     ripartono, e allora li dichiara chi li riceve.
//
// Canali indipendenti: rete, ACI ed extra raccolta non si sommano mai fra loro.
//
// Payload: { anno }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { anno } = await req.json().catch(() => ({}));
    if (!anno) return Response.json({ error: 'Anno obbligatorio' }, { status: 400 });
    const annoNum = Number(anno);

    const norm = normalizzaRagioneSociale;
    const td = (v) => String(v || '').toLowerCase().trim();
    const t3 = (v) => Math.round(v * 1000) / 1000;
    const peso = (r) => (Number(r.peso_effettivo) || 0);
    const somma = (mappa, chiave, valore) => mappa.set(chiave, (mappa.get(chiave) || 0) + valore);
    // Il mese e l'anno di un movimento sono quelli della fine del trasporto, sul
    // giorno italiano: la regola di tutto il gestionale (shared/movimenti.ts).
    const periodo = (r) => {
      if (!eTerminato(r)) return null;
      const p = periodoMovimento(r);
      return p && p.anno === annoNum ? p : null;
    };

    const svc = base44.asServiceRole.entities;
    // Le primarie della rete e le dichiarazioni di trattamento del portale sono
    // decine di migliaia di righe e servono solo per farne dei totali: si leggono
    // una pagina alla volta, senza tenerle in memoria.
    const [giacenzeSito, dichiarazioni, aci, extra, secondarie, terziarie, nonDichiarati, rilevazioni] = await Promise.all([
      fetchAll(svc.GiacenzaSito, { anno: annoNum }),
      fetchAll(svc.DichiarazioneSito, { anno: annoNum }),
      fetchAll(svc.PrimariaAci),
      fetchAll(svc.ExtraRaccolta),
      fetchAll(svc.Secondaria),
      fetchAll(svc.Terziaria),
      fetchAll(svc.OrdineNonDichiarato),
      fetchAll(svc.GiacenzaStoccaggio),
    ]);

    // --- La fotografia del portale ---
    // E' il giorno dell'ultimo file degli ordini non dichiarati. Il portale mette un
    // ordine nella giacenza di un impianto quando lo CHIUDE, non quando il camion
    // arriva: per confrontarsi con il suo numero si conta quello che quel giorno era
    // chiuso. Il periodo di un movimento resta la fine del trasporto; la chiusura
    // serve solo qui, a sapere che cosa il portale conosceva alla fotografia.
    // Un carico arrivato prima e chiuso dopo e' vero ed e' gia' in piazzale, ma il
    // portale non l'aveva ancora contato: si mostra a parte, ordine per ordine, ed
    // e' la ragione di quasi tutti gli scarti che si vedono il lunedi' quando il file
    // degli ordini non dichiarati e' del venerdi' prima.
    const fotoPortale = nonDichiarati.reduce((max, r) => {
      const d = giornoRoma(r.created_date);
      return d > max ? d : max;
    }, '');
    const chiusoIl = (r) => giornoRoma(r.ordine_chiuso_il) || giornoRoma(r.trasporto_finito_il);
    const chiusoDopoFoto = (r) => !!fotoPortale && chiusoIl(r) > fotoPortale;
    const finitoPrimaDellaFoto = (r) => !!fotoPortale && giornoRoma(r.trasporto_finito_il) <= fotoPortale;
    let ultimaChiusura = '';

    // --- Chi riceve, per canale e mese: solo cio' che arriva a un impianto ---
    const conferito = new Map();   // ns|canale|provenienza|mese -> kg
    const daStoccaggi = new Map(); // ns|canale|provenienza|mese -> Map(nome stoccaggio -> kg)
    const aggiungi = (ns, canale, provenienza, mese, kg, stoccaggio = '') => {
      if (!ns || !mese) return;
      const k = `${ns}|${canale}|${provenienza}|${mese}`;
      somma(conferito, k, kg);
      if (stoccaggio) {
        if (!daStoccaggi.has(k)) daStoccaggi.set(k, new Map());
        somma(daStoccaggi.get(k), stoccaggio, kg);
      }
    };
    const perAnno = {
      reteImp: new Map(), reteStoc: new Map(), aciImp: new Map(), aciStoc: new Map(), extraImp: new Map(), extraStoc: new Map(),
      secIn: new Map(), secOut: new Map(), secAciIn: new Map(), secAciOut: new Map(), extraSecIn: new Map(), extraSecOut: new Map(),
      terz: new Map(), reteTutte: 0,
    };

    // --- Gli stoccaggi: entrate, partenze in secondaria e verso chi ---
    const stoc = new Map(); // ns -> Map(canale -> { entrato: kg[12], uscito: kg[12], verso: Map(nsImpianto -> kg) })
    const canaleStoc = (ns, canale) => {
      if (!stoc.has(ns)) stoc.set(ns, new Map());
      const m = stoc.get(ns);
      if (!m.has(canale)) m.set(canale, { entrato: new Array(12).fill(0), uscito: new Array(12).fill(0), verso: new Map() });
      return m.get(canale);
    };

    // Per gli stoccaggi la giacenza del portale e' l'ultima rilevazione piu' i
    // movimenti dopo: e' un conto fisico del piazzale, e li' conta la fine del trasporto.
    const rilevazione = new Map(); // ns -> { totale_t, data }
    for (const r of rilevazioni) {
      const ns = norm(r.sito);
      if (!ns) continue;
      const data = r.data_rilevazione ? String(r.data_rilevazione).slice(0, 10) : '';
      const totale = ['class1_kg', 'class2_kg', 'class3_kg', 'class4_kg', 'class9_kg'].reduce((s, c) => s + (Number(r[c]) || 0), 0) / 1000;
      const prima = rilevazione.get(ns);
      if (!prima || data > prima.data) rilevazione.set(ns, { totale_t: totale, data });
    }
    const dopoRilevazione = new Map(); // ns -> t (ingressi meno uscite dopo la rilevazione)
    const movimentoDopo = (ns, r, valore) => {
      const ril = rilevazione.get(ns);
      const giorno = giornoRoma(r.trasporto_finito_il);
      if (!ril || !ril.data || !giorno || giorno <= ril.data) return;
      somma(dopoRilevazione, ns, valore);
    };

    // Chi sono i siti e con che ruolo si scopre dai formulari, una volta sola.
    const nomi = new Map();    // ns -> nome leggibile
    const ruoliDi = new Map(); // ns -> Set di ruoli ('imp', 'stoc')
    const segnaRuolo = (ns, ruolo) => {
      if (!ruoliDi.has(ns)) ruoliDi.set(ns, new Set());
      ruoliDi.get(ns).add(ruolo);
    };
    const conosci = (ns, nome) => { if (ns && !nomi.has(ns)) nomi.set(ns, nome); };
    for (const g of giacenzeSito) { conosci(norm(g.sito), g.sito); segnaRuolo(norm(g.sito), td(g.tipo_destinazione) || 'imp'); }

    // Il portale scrive nel file degli ordini non dichiarati solo l'ID della
    // primaria: che fosse diretta a uno stoccaggio si sa da qui.
    const ordineTipo = new Map();
    // La fotografia, per gli impianti: quanto era chiuso quel giorno, quanto dopo,
    // e quali carichi erano arrivati ma non ancora chiusi.
    const foto = { rete: new Map(), dopo: new Map(), secIn: new Map(), secDopo: new Map(), inViaggio: new Map() };
    const inViaggio = (ns, r, tipo) => {
      if (!foto.inViaggio.has(ns)) foto.inViaggio.set(ns, []);
      foto.inViaggio.get(ns).push({
        tipo, id_ordine: r.id_ordine || '', numero_fir: r.numero_fir || '',
        fine_trasporto: giornoRoma(r.trasporto_finito_il), chiuso_il: chiusoIl(r), kg: Math.round(peso(r)),
        da: tipo === 'secondaria' ? (r.stoccaggio || '') : (r.trasportatore || ''),
      });
    };

    // Una primaria (rete, ACI o extra raccolta): all'impianto o allo stoccaggio.
    const primaria = (r, canale) => {
      const ruolo = td(r.tipo_destinazione) || 'imp';
      const id = String(r.id_ordine || '').trim();
      if (id && td(r.tipo_destinazione)) ordineTipo.set(id, ruolo);
      if (!eTerminato(r) || !r.destinazione) return null;
      const ns = norm(r.destinazione);
      if (ruolo === 'stoc') movimentoDopo(ns, r, peso(r) / 1000);
      const p = periodo(r);
      if (!p) return null;
      conosci(ns, r.destinazione);
      segnaRuolo(ns, ruolo);
      if (ruolo === 'stoc') {
        const c = canaleStoc(ns, canale);
        c.entrato[p.mese_idx] += peso(r);
      }
      return { ns, ruolo, p };
    };

    await perPagina(svc.PrimariaRete, null, (r) => {
      const chiusa = eTerminato(r) ? giornoRoma(r.ordine_chiuso_il) : '';
      if (chiusa > ultimaChiusura) ultimaChiusura = chiusa;
      const c = primaria(r, 'RETE');
      if (!c) return;
      perAnno.reteTutte += peso(r);
      if (c.ruolo === 'stoc') { somma(perAnno.reteStoc, c.ns, peso(r)); return; }
      aggiungi(c.ns, 'RETE', '', c.p.mese, peso(r));
      somma(perAnno.reteImp, c.ns, peso(r));
      if (chiusoDopoFoto(r)) {
        somma(foto.dopo, c.ns, peso(r));
        if (finitoPrimaDellaFoto(r)) inViaggio(c.ns, r, 'primaria');
      } else {
        somma(foto.rete, c.ns, peso(r));
      }
    });
    for (const r of aci) {
      const c = primaria(r, 'ACI');
      if (!c) continue;
      if (c.ruolo === 'stoc') { somma(perAnno.aciStoc, c.ns, peso(r)); continue; }
      aggiungi(c.ns, 'ACI', 'primaria', c.p.mese, peso(r));
      somma(perAnno.aciImp, c.ns, peso(r));
    }
    for (const r of extra) {
      if (td(r.tipo_movimento) === 'secondaria') continue; // piu' sotto, con le secondarie
      const c = primaria(r, 'EXTRA_RACCOLTA');
      if (!c) continue;
      if (c.ruolo === 'stoc') { somma(perAnno.extraStoc, c.ns, peso(r)); continue; }
      aggiungi(c.ns, 'EXTRA_RACCOLTA', '', c.p.mese, peso(r));
      somma(perAnno.extraImp, c.ns, peso(r));
    }

    // Una secondaria: lo stoccaggio e' il produttore, l'impianto che la riceve la
    // dichiara. Le secondarie di rete e quelle ACI stanno nello stesso archivio e
    // restano su canali separati.
    const secondaria = (r, canale, provenienza) => {
      const dest = norm(r.destinazione);
      const daStoc = norm(r.stoccaggio);
      if (!dest || !eTerminato(r)) return;
      movimentoDopo(daStoc, r, -peso(r) / 1000);
      const p = periodo(r);
      if (!p) return;
      conosci(dest, r.destinazione);
      segnaRuolo(dest, 'imp');
      if (daStoc) {
        conosci(daStoc, r.stoccaggio);
        segnaRuolo(daStoc, 'stoc');
        const c = canaleStoc(daStoc, canale);
        c.uscito[p.mese_idx] += peso(r);
        somma(c.verso, dest, peso(r));
      }
      aggiungi(dest, canale, provenienza, p.mese, peso(r), r.stoccaggio || 'stoccaggio non indicato');
      return { dest, daStoc, p };
    };
    for (const r of secondarie) {
      if (eAci(r)) {
        const s = secondaria(r, 'ACI', 'secondaria');
        if (!s) continue;
        somma(perAnno.secAciIn, s.dest, peso(r));
        somma(perAnno.secAciOut, s.daStoc, peso(r));
        continue;
      }
      const s = secondaria(r, 'RETE', '');
      if (!s) continue;
      somma(perAnno.secIn, s.dest, peso(r));
      somma(perAnno.secOut, s.daStoc, peso(r));
      // Nella fotografia dell'impianto che la riceve la secondaria entra quando il
      // portale la chiude: e' allora che aggancia le primarie dello stoccaggio.
      if (chiusoDopoFoto(r)) {
        somma(foto.secDopo, s.dest, peso(r));
        if (finitoPrimaDellaFoto(r)) inViaggio(s.dest, r, 'secondaria');
      } else {
        somma(foto.secIn, s.dest, peso(r));
      }
    }
    for (const r of extra) {
      if (td(r.tipo_movimento) !== 'secondaria' || !eTerminato(r)) continue;
      const s = secondaria(r, 'EXTRA_RACCOLTA', '');
      if (!s) continue;
      somma(perAnno.extraSecIn, s.dest, peso(r));
      somma(perAnno.extraSecOut, s.daStoc, peso(r));
    }
    for (const r of terziarie) {
      if (!periodo(r)) continue;
      somma(perAnno.terz, norm(r.unita_locale_origine || r.ragione_sociale), peso(r));
    }

    // --- Giacenza del portale: conferito non ancora dichiarato ---
    const portale = new Map();      // ns impianto -> t
    const inAttesa = new Map();     // ns stoccaggio -> t ancora in piazzale secondo il portale
    const attesaCoppia = new Map(); // nsStoccaggio|nsImpianto -> t partite e non ancora dichiarate
    const aPortale = new Set();     // chi compare nella fotografia del portale
    const daDichiarare = new Map(); // ns|mese -> kg ancora in attesa di dichiarazione
    for (const r of nonDichiarati) {
      const sec = String(r.destinazione_secondaria || '').trim();
      const sito = sec || String(r.destinazione || '').trim();
      const ruolo = sec ? 'imp' : (ordineTipo.get(String(r.ordine_primaria || '').trim()) || 'imp');
      const ns = norm(sito);
      if (!ns) continue;
      aPortale.add(ns);
      const t = (Number(r.peso_non_dichiarato_kg) || 0) / 1000;
      if (ruolo === 'stoc') { somma(inAttesa, ns, t); continue; }
      somma(portale, ns, t);
      if (sec && r.destinazione) somma(attesaCoppia, `${norm(r.destinazione)}|${ns}`, t);
      // In che mese sono finiti i trasporti che il portale aspetta ancora: e'
      // l'unico modo onesto di dire "questo mese e' da dichiarare". Un mese senza
      // una nostra dichiarazione ma che il portale non aspetta piu' e' gia' stato
      // dichiarato dentro un altro mese, e non manca niente.
      const g = giornoRoma(r.fine_trasporto || r.data_chiusura);
      if (g) somma(daDichiarare, `${ns}|${MESI[Number(g.slice(5, 7)) - 1]}`, t * 1000);
    }
    // Quello che risulta dichiarato al portale, per confrontarlo con quello che
    // abbiamo segnato come caricato. Conta solo le dichiarazioni collegate a ordini
    // chiusi nell'anno: quelle che il portale ha agganciato a ordini dell'anno prima
    // non compaiono qui, quindi una differenza non e' per forza un mese sfuggito.
    const dichiaratoPortale = new Map();
    await perPagina(svc.DichiarazioneTrattamento, null, (r) => {
      if (!giornoRoma(r.data_chiusura).startsWith(String(annoNum))) return;
      const ns = norm(String(r.destinazione_secondaria || '').trim() || r.destinazione);
      if (!ns) return;
      somma(dichiaratoPortale, ns, Number(r.peso_associato_kg) || 0);
    });

    // --- Dichiarazioni per sito, canale, provenienza e mese ---
    const perDich = new Map();
    for (const d of dichiarazioni) {
      perDich.set(`${norm(d.sito)}|${d.canale || 'RETE'}|${d.provenienza || ''}|${d.mese}`, d);
      const ns = norm(d.sito);
      if (!nomi.has(ns)) { nomi.set(ns, d.sito); segnaRuolo(ns, 'imp'); }
    }
    const dichiarazioneDi = (d) => d && {
      id: d.id, quantita_kg: Number(d.quantita_kg) || 0, caricata_inviata: !!d.caricata_inviata, ricevuta_email: !!d.ricevuta_email,
      ricevuta_il: d.ricevuta_il || '', caricata_il: d.caricata_il || '', note: d.note || '',
      granulo_kg: Number(d.granulo_kg) || 0, fibre_kg: Number(d.fibre_kg) || 0, metalli_kg: Number(d.metalli_kg) || 0,
      ciabattato_kg: Number(d.ciabattato_kg) || 0, cippato_kg: Number(d.cippato_kg) || 0, cssc_kg: Number(d.cssc_kg) || 0, altro_kg: Number(d.altro_kg) || 0,
    };
    const flussiDi = (ns, operazione) => {
      const chiavi = new Set();
      for (const k of conferito.keys()) {
        const [sito, canale, provenienza] = k.split('|');
        if (sito === ns) chiavi.add(`${canale}|${provenienza}`);
      }
      for (const k of perDich.keys()) {
        const [sito, canale, provenienza] = k.split('|');
        if (sito === ns) chiavi.add(`${canale}|${provenienza}`);
      }
      if (!chiavi.size) chiavi.add('RETE|');
      return [...chiavi].sort().map(c => {
        const [canale, provenienza] = c.split('|');
        const mesi = MESI.map(mese => {
          const chiave = `${ns}|${canale}|${provenienza}|${mese}`;
          const da = daStoccaggi.get(chiave);
          const daStoc = da ? [...da.entries()].map(([stoccaggio, kg]) => ({ stoccaggio, kg: Math.round(kg) })).sort((a, b) => b.kg - a.kg) : [];
          const totale = Math.round(conferito.get(chiave) || 0);
          return {
            mese,
            conferito_kg: totale,
            // Quanto e' arrivato direttamente e quanto dagli stoccaggi, in secondaria.
            diretto_kg: totale - daStoc.reduce((s, x) => s + x.kg, 0),
            da_stoccaggi: daStoc,
            non_dichiarato_kg: canale === 'RETE' ? Math.round(daDichiarare.get(`${ns}|${mese}`) || 0) : 0,
            dichiarazione: dichiarazioneDi(perDich.get(chiave) || null),
          };
        });
        return {
          canale, provenienza, operazione,
          mesi,
          conferito_t: t3(mesi.reduce((s, m) => s + m.conferito_kg, 0) / 1000),
          da_stoccaggi_t: t3(mesi.reduce((s, m) => s + m.da_stoccaggi.reduce((x, y) => x + y.kg, 0), 0) / 1000),
          dichiarato_caricato_t: t3(mesi.reduce((s, m) => s + (m.dichiarazione && m.dichiarazione.caricata_inviata ? m.dichiarazione.quantita_kg : 0), 0) / 1000),
          dichiarato_totale_t: t3(mesi.reduce((s, m) => s + (m.dichiarazione ? m.dichiarazione.quantita_kg : 0), 0) / 1000),
        };
      });
    };

    const giacenzaIniziale = (ns, ruolo) => t3(giacenzeSito
      .filter(x => norm(x.sito) === ns && (td(x.tipo_destinazione) || 'imp') === ruolo)
      .reduce((s, x) => s + (Number(x.giacenza_riferimento_t) || 0), 0));
    const kgInT = (mappa, ns) => t3((mappa.get(ns) || 0) / 1000);

    // --- Gli impianti, e gli stoccaggi puri per la sola quadratura ---
    const siti = [...nomi.entries()].map(([ns, nome]) => {
      const ruoli = [...(ruoliDi.get(ns) || new Set(['imp']))].sort();
      const soloStoccaggio = ruoli.length === 1 && ruoli[0] === 'stoc';
      const g = giacenzeSito.find(x => norm(x.sito) === ns && td(x.tipo_destinazione) === 'imp')
        || giacenzeSito.find(x => norm(x.sito) === ns) || null;
      const operazione = soloStoccaggio ? '' : operazioneDa(g && g.tipologia_trattamento);
      const senzaPortale = !aPortale.has(ns) && !rilevazione.has(ns);
      const ril = rilevazione.get(ns);
      const portaleStoccaggio = ruoli.includes('stoc') && ril ? ril.totale_t + (dopoRilevazione.get(ns) || 0) : null;

      if (soloStoccaggio) {
        // Uno stoccaggio non dichiara: sta qui solo per la quadratura, perche' la
        // sua giacenza a portale e' la rilevazione fisica per classi, che tiene
        // dentro i PFU di qualunque canale. Li' il conto si fa su quello che c'e'
        // davvero in piazzale; i canali restano distinti dappertutto altrove.
        const entrato = (perAnno.reteStoc.get(ns) || 0) + (perAnno.aciStoc.get(ns) || 0) + (perAnno.extraStoc.get(ns) || 0);
        const uscito = (perAnno.secOut.get(ns) || 0) + (perAnno.secAciOut.get(ns) || 0) + (perAnno.extraSecOut.get(ns) || 0);
        const sito = {
          sito: nome, chiave: ns, ruoli, tipo_destinazione: 'stoc',
          tipologia_trattamento: '', dichiara_rete: true, operazione: '',
          giacenza_iniziale_t: giacenzaIniziale(ns, 'stoc'),
          conferito_t: kgInT(perAnno.reteStoc, ns),
          conferito_aci_t: kgInT(perAnno.aciStoc, ns),
          conferito_extra_t: kgInT(perAnno.extraStoc, ns),
          secondarie_in_t: 0,
          secondarie_out_t: kgInT(perAnno.secOut, ns),
          secondarie_aci_out_t: kgInT(perAnno.secAciOut, ns),
          terziarie_out_t: 0,
          in_attesa_dichiarazione_t: t3(inAttesa.get(ns) || 0),
          giacenza_portale_t: senzaPortale || portaleStoccaggio === null ? null : t3(portaleStoccaggio),
          rilevazione_stoccaggio_t: 0,
          rilevazione_il: ril ? ril.data : '',
          dichiarato_caricato_t: 0, dichiarato_totale_t: 0, dichiarato_portale_t: 0, dichiarato_caricato_rete_t: 0,
          conferito_alla_foto_t: t3(entrato / 1000),
          conferito_dopo_foto_t: 0,
          secondarie_in_alla_foto_t: 0,
          secondarie_out_alla_foto_t: t3(uscito / 1000),
          in_viaggio_a_portale: [],
          flussi: [],
        };
        return { ...sito, ...quadratura(sito) };
      }

      const flussi = flussiDi(ns, operazione);
      const viaggio = (foto.inViaggio.get(ns) || []).sort((a, b) => a.fine_trasporto.localeCompare(b.fine_trasporto));
      const sito = {
        sito: nome,
        chiave: ns,
        ruoli,
        tipo_destinazione: 'imp',
        // Anche stoccaggio: la parte di stoccaggio sta nell'elenco degli stoccaggi.
        anche_stoccaggio: ruoli.includes('stoc'),
        tipologia_trattamento: (g && g.tipologia_trattamento) || '',
        // Chi non ci manda la dichiarazione di rete - perche' quel trattamento non
        // glielo paghiamo - non deve comparire come inadempiente: e' un accordo.
        dichiara_rete: !(g && g.dichiara_rete === false),
        operazione,
        giacenza_iniziale_t: giacenzaIniziale(ns, 'imp'),
        target_primarie_t: t3(giacenzeSito.filter(x => norm(x.sito) === ns).reduce((s, x) => s + (Number(x.target_primarie_t) || 0), 0)),
        // Arrivato all'impianto: le primarie dirette e le secondarie dagli stoccaggi.
        conferito_t: kgInT(perAnno.reteImp, ns),
        conferito_aci_t: kgInT(perAnno.aciImp, ns),
        conferito_extra_t: kgInT(perAnno.extraImp, ns),
        secondarie_in_t: kgInT(perAnno.secIn, ns),
        secondarie_aci_in_t: kgInT(perAnno.secAciIn, ns),
        secondarie_extra_in_t: kgInT(perAnno.extraSecIn, ns),
        secondarie_out_t: 0,
        terziarie_out_t: kgInT(perAnno.terz, ns),
        in_attesa_dichiarazione_t: 0,
        giacenza_portale_t: senzaPortale ? null : t3(portale.get(ns) || 0),
        // La rilevazione del suo stoccaggio sta a parte: in Irigom sono PFU ACI, e
        // sommarla qui mescolerebbe i canali.
        rilevazione_stoccaggio_t: ruoli.includes('stoc') && portaleStoccaggio ? t3(portaleStoccaggio) : 0,
        rilevazione_il: ril ? ril.data : '',
        dichiarato_caricato_t: t3(flussi.reduce((s, f) => s + f.dichiarato_caricato_t, 0)),
        dichiarato_totale_t: t3(flussi.reduce((s, f) => s + f.dichiarato_totale_t, 0)),
        dichiarato_portale_t: t3((dichiaratoPortale.get(ns) || 0) / 1000),
        // Per la quadratura contano solo la rete e quello che il portale conosceva
        // alla fotografia: gli ordini chiusi entro quel giorno.
        dichiarato_caricato_rete_t: t3(flussi.filter(f => f.canale === 'RETE').reduce((s, f) => s + f.dichiarato_caricato_t, 0)),
        conferito_alla_foto_t: kgInT(foto.rete, ns),
        conferito_dopo_foto_t: t3(((foto.dopo.get(ns) || 0) + (foto.secDopo.get(ns) || 0)) / 1000),
        secondarie_in_alla_foto_t: kgInT(foto.secIn, ns),
        secondarie_out_alla_foto_t: 0,
        // Arrivati prima della fotografia e chiusi a portale dopo: il portale non li
        // conosceva ancora. E' la spiegazione dello scarto, ordine per ordine.
        in_viaggio_a_portale: viaggio,
        in_viaggio_a_portale_t: t3(viaggio.reduce((s, x) => s + x.kg, 0) / 1000),
        flussi,
      };
      return { ...sito, ...quadratura(sito) };
    }).filter(s => s.conferito_t || s.conferito_aci_t || s.conferito_extra_t || s.dichiarato_totale_t || s.giacenza_iniziale_t || s.giacenza_portale_t
      || s.secondarie_in_t || s.secondarie_aci_in_t || s.secondarie_extra_in_t || s.secondarie_out_t || s.secondarie_aci_out_t || s.conferito_alla_foto_t)
      .sort((a, b) => (a.tipo_destinazione === b.tipo_destinazione ? 0 : a.tipo_destinazione === 'imp' ? -1 : 1)
        || (b.conferito_t + b.secondarie_in_t) - (a.conferito_t + a.secondarie_in_t) || a.sito.localeCompare(b.sito));

    // --- Gli stoccaggi: chi riceve, chi riparte, chi dichiara ---
    const impianto = new Map(siti.filter(s => s.tipo_destinazione === 'imp').map(s => [s.chiave, s]));
    const stoccaggi = [...stoc.entries()].map(([ns, canali]) => {
      const ruoli = [...(ruoliDi.get(ns) || new Set(['stoc']))];
      const ril = rilevazione.get(ns);
      const iniziale = giacenzaIniziale(ns, 'stoc');
      const righe = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].filter(c => canali.has(c)).map(canale => {
        const c = canali.get(canale);
        const entrato = c.entrato.reduce((s, x) => s + x, 0);
        const uscito = c.uscito.reduce((s, x) => s + x, 0);
        return {
          canale,
          entrato_t: t3(entrato / 1000),
          uscito_t: t3(uscito / 1000),
          saldo_t: t3((entrato - uscito) / 1000),
          mesi: MESI.map((mese, i) => ({ mese, entrato_kg: Math.round(c.entrato[i]), uscito_kg: Math.round(c.uscito[i]) })),
          verso: [...c.verso.entries()].map(([nsImp, kg]) => {
            const imp = impianto.get(nsImp);
            return {
              impianto: (imp && imp.sito) || nomi.get(nsImp) || nsImp,
              chiave: nsImp,
              t: t3(kg / 1000),
              // Per la rete, quanto di quello partito verso questo impianto il portale
              // aspetta ancora che l'impianto dichiari.
              in_attesa_t: canale === 'RETE' ? t3(attesaCoppia.get(`${ns}|${nsImp}`) || 0) : null,
              dichiara: canale !== 'RETE' || !imp || imp.dichiara_rete !== false,
            };
          }).sort((a, b) => b.t - a.t),
        };
      });
      const saldo = righe.reduce((s, r) => s + r.saldo_t, 0);
      return {
        sito: nomi.get(ns) || ns,
        chiave: ns,
        anche_impianto: ruoli.includes('imp'),
        giacenza_iniziale_t: iniziale,
        canali: righe,
        // In piazzale: dalla rilevazione piu' i movimenti dopo, quando c'e'; se no
        // dalla giacenza di inizio anno piu' entrate meno partenze.
        in_piazzale_t: ril ? t3(ril.totale_t + (dopoRilevazione.get(ns) || 0)) : t3(iniziale + saldo),
        in_piazzale_da: ril ? 'rilevazione' : 'movimenti',
        rilevazione_il: ril ? ril.data : '',
        in_attesa_portale_t: t3(inAttesa.get(ns) || 0),
        // Dichiarazioni registrate sullo stoccaggio: non dovrebbero esserci. Non si
        // cancellano, si mostrano, perche' vanno spostate sull'impianto che ha
        // ricevuto le secondarie.
        dichiarazioni_registrate: ruoli.includes('imp') ? [] : dichiarazioni
          .filter(d => norm(d.sito) === ns && Number(d.quantita_kg) > 0)
          .map(d => ({ canale: d.canale || 'RETE', provenienza: d.provenienza || '', mese: d.mese, quantita_kg: Number(d.quantita_kg) || 0 })),
      };
    }).filter(s => s.canali.some(c => c.entrato_t || c.uscito_t) || s.giacenza_iniziale_t || s.dichiarazioni_registrate.length)
      .sort((a, b) => b.canali.reduce((s, c) => s + c.entrato_t, 0) - a.canali.reduce((s, c) => s + c.entrato_t, 0));

    const confrontabili = siti.filter(x => x.giacenza_portale_t !== null && x.giacenza_portale_t !== undefined);
    const totali = {
      // Tutte le primarie di rete dell'anno, a impianti e stoccaggi: ogni carico una volta sola.
      conferito_t: t3(perAnno.reteTutte / 1000),
      dichiarato_caricato_t: t3(siti.reduce((s, x) => s + x.dichiarato_caricato_t, 0)),
      dichiarato_totale_t: t3(siti.reduce((s, x) => s + x.dichiarato_totale_t, 0)),
      dichiarato_portale_t: t3(siti.reduce((s, x) => s + x.dichiarato_portale_t, 0)),
      giacenza_calcolata_t: t3(siti.reduce((s, x) => s + x.giacenza_calcolata_t, 0)),
      // Solo i siti che a portale una giacenza ce l'hanno: sommare anche gli altri
      // farebbe sembrare che il confronto non torni, quando il confronto non c'e'.
      giacenza_calcolata_confrontabile_t: t3(confrontabili.reduce((s, x) => s + x.giacenza_calcolata_t, 0)),
      giacenza_portale_t: t3(siti.reduce((s, x) => s + (x.giacenza_portale_t || 0), 0)),
      in_viaggio_a_portale_t: t3(siti.reduce((s, x) => s + (x.in_viaggio_a_portale_t || 0), 0)),
      siti_che_quadrano: siti.filter(x => x.quadra === true).length,
      siti_da_quadrare: siti.filter(x => x.quadra === false).length,
    };

    return Response.json({
      anno: annoNum, mesi: MESI, siti, stoccaggi, totali,
      foto_portale_il: fotoPortale,
      // Fin dove arrivano le chiusure che il gestionale conosce: se e' dopo la
      // fotografia, il confronto e' fra due giorni diversi e la pagina lo dice.
      movimenti_chiusi_fino_al: ultimaChiusura,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
