import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fineProgrammazione, avvisoFineProgrammazione } from "../../shared/fineProgrammazione.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { canaleMovimento } from "../../shared/movimenti.ts";
import { proiettaInsieme, viaggiPerMese, MESI, KG_PER_VIAGGIO } from "../../shared/proiezioneSecondarie.ts";
import { dopoLaRilevazione, ultimeRilevazioni, kgReteDiRilevazione } from "../../shared/giacenzaStoccaggi.ts";
import { giornoRoma, oggiRoma } from "../../shared/giornoItaliano.ts";
import { statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento } from "../../shared/reportSettimanali.ts";

// Quante secondarie restano da portare a ogni impianto per arrivare al target.
//
// E' il ragionamento della tabella del foglio Excel, con i numeri presi dai dati
// invece che scritti a mano: il target dell'impianto, quello che gli e' già
// arrivato in primaria e in secondaria, quanto arriva in media ogni mese, e
// quanto materiale hanno gli stoccaggi che lo alimentano.
//
// Solo rete (regola dell'utente, 22/09/2026): ACI ed extra raccolta non entrano
// nella predittivita', ne' nel target, ne' nel gia' arrivato, ne' nella
// giacenza degli stoccaggi. L'extra raccolta sta in un archivio suo e non si
// legge; primarie e secondarie si tengono solo se il canale e' la rete.
//
// Payload: { anno, mese_da }  mese_da e' l'indice del mese da cui proiettare
// (0 = gennaio); se manca si parte dal mese in corso.

// Il giorno e' quello italiano della fine del trasporto, come ovunque.
const soloData = (v) => giornoRoma(v);
const terminato = (r) => String(r.stato || '').toLowerCase().trim() === 'terminato';
const peso = (r) => Number(r.peso_effettivo) || 0;
const soloRete = (righe, archivio) => righe.filter(r => canaleMovimento(r, archivio) === 'RETE');

// La proiezione non salva niente, ma se primarie o secondarie si stanno
// ricaricando (o il caricamento e' rimasto interrotto) i numeri escono da mezzo
// archivio: si dice a video, e la pagina si ricalcola quando il caricamento si
// chiude. Stessa finestra di dieci minuti di importaBlocco.
// Si usa la regola condivisa di base44/shared/reportSettimanali.ts: un
// caricamento rimasto aperto non conta piu' se dopo un caricamento riuscito ha
// riscritto gli stessi archivi. Un "primarie_rete" storico, che nessuna scheda
// di Caricamento Dati scrive piu' ne' chiude, altrimenti bloccava per sempre il
// piano, il suggerimento del lunedi' e la proiezione.
// Lo stato si legge prima e dopo gli archivi (caricamentiDuranteLettura): letto
// una volta sola, insieme agli archivi, non vedeva un caricamento partito o
// concluso mentre li si leggeva. Se non si legge, non si sa se gli archivi sono
// interi, e si dice lo stesso.
const TIPI_LETTI = ['primarie', 'primarie_rete', 'secondarie'];
const leggiStato = (base44) => statoCaricamenti(base44, TIPI_LETTI).catch(() => null);
function caricamentoDurante(prima, dopo) {
  if (!prima || !dopo) return "Lo stato dei caricamenti non si e' potuto leggere: non si sa se primarie e secondarie sono complete.";
  const durante = caricamentiDuranteLettura(prima, dopo);
  return durante.length ? durante.map(descriviCaricamento).join('; ') : null;
}

function meseDi(v, anno) {
  const d = soloData(v);
  if (!d || Number(d.slice(0, 4)) !== anno) return -1;
  return Number(d.slice(5, 7)) - 1;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    // Anno e mese dal giorno italiano, tutti e due: con l'anno letto in UTC, la
    // notte di Capodanno l'anno restava il vecchio mentre il mese era gennaio.
    const oggi = oggiRoma();
    const anno = Number(body.anno) || Number(oggi.slice(0, 4));
    const meseDa = body.mese_da != null ? Number(body.mese_da) : Number(oggi.slice(5, 7)) - 1;

    const svc = base44.asServiceRole.entities;
    const primaDegliArchivi = await leggiStato(base44);
    const [impianti, fornitori, primarieTutte, secondarieTutte, rilevazioni, ipotesiTutte, giacenzeSito] = await Promise.all([
      svc.ImpiantoTargetSecondaria.filter({ stato: 'attivo' }),
      svc.FornitoreSecondaria.filter({ stato: 'attivo' }),
      fetchAll(svc.PrimariaRete, { stato: 'terminato' }),
      fetchAll(svc.Secondaria, { stato: 'terminato' }),
      fetchAll(svc.GiacenzaStoccaggio),
      svc.IpotesiMensileSecondarie.filter({ anno }, 'mese', 500),
      svc.GiacenzaSito.filter({ anno }, 'sito', 100).catch(() => []),
    ]);
    // la seconda lettura dello stato, a archivi letti (vedi leggiStato)
    const caricamentoInCorso = caricamentoDurante(primaDegliArchivi, await leggiStato(base44));
    // Solo rete, una volta qui per tutti i conti che seguono: una primaria di
    // classe 9 finita fra quelle di rete e le secondarie ACI, che stanno nello
    // stesso archivio, si scartano con la regola condivisa.
    const primarie = soloRete(primarieTutte, 'PrimariaRete');
    const secondarie = soloRete(secondarieTutte, 'Secondaria');

    // Un terminato senza fine trasporto non si colloca in nessun mese e non
    // entra ne' nel gia' arrivato ne' nella giacenza (mai ripiegando sulla
    // chiusura): si conta, di qualunque anno, e si dice. Prima si contavano solo
    // gli immessi nell'anno (annoOrdine, che AGENTS.md riserva agli elenchi): uno
    // senza data di immissione, o immesso a dicembre dell'anno prima, spariva.
    const senzaFine = (righe) => righe.filter(r => terminato(r) && !soloData(r.trasporto_finito_il)).length;
    const senzaFineTrasporto = { primarie: senzaFine(primarie), secondarie: senzaFine(secondarie) };
    const avvisiGenerali = [];
    if (caricamentoInCorso) avvisiGenerali.push(caricamentoInCorso);
    if (senzaFineTrasporto.primarie || senzaFineTrasporto.secondarie) {
      avvisiGenerali.push(`Terminati di rete di qualunque anno senza la data di fine trasporto (primarie: ${senzaFineTrasporto.primarie}, secondarie: ${senzaFineTrasporto.secondarie}). Non sono contati ne' nel gia' arrivato ne' nelle giacenze degli stoccaggi finche' un nuovo caricamento non porta la data.`);
    }

    // --- dove arriva la roba, mese per mese ---
    // chiave sito -> { mese -> kg }, per destinazione: di un soggetto che e'
    // impianto e stoccaggio insieme qui ci sono le due cose, non distinte per
    // tipo_destinazione (la giacenza qui sotto invece le distingue).
    const primariaPerSito = new Map();
    const nomeSito = new Map();
    const aggiungi = (mappa, chiave, mese, kg) => {
      if (!mappa.has(chiave)) mappa.set(chiave, {});
      const m = mappa.get(chiave);
      m[mese] = (m[mese] || 0) + kg;
    };

    for (const r of primarie) {
      if (!terminato(r)) continue;
      const m = meseDi(r.trasporto_finito_il, anno);
      if (m < 0) continue;
      const chiave = normalizzaRagioneSociale(r.destinazione);
      if (!chiave) continue;
      nomeSito.set(chiave, String(r.destinazione).trim());
      aggiungi(primariaPerSito, chiave, m, peso(r));
    }

    const secondariaInSito = new Map();  // chiave impianto -> { mese -> kg }
    const secondariaDaStoccaggio = new Map(); // chiave stoccaggio -> { mese -> kg }
    for (const r of secondarie) {
      if (!terminato(r)) continue;
      const m = meseDi(r.trasporto_finito_il, anno);
      if (m < 0) continue;
      const dest = normalizzaRagioneSociale(r.destinazione);
      const orig = normalizzaRagioneSociale(r.stoccaggio);
      if (dest) { nomeSito.set(dest, String(r.destinazione).trim()); aggiungi(secondariaInSito, dest, m, peso(r)); }
      if (orig) { nomeSito.set(orig, String(r.stoccaggio).trim()); aggiungi(secondariaDaStoccaggio, orig, m, peso(r)); }
    }

    // --- quanto c'e' adesso negli stoccaggi, rete ---
    // Ultima rilevazione del portale piu' quello che si e' mosso dopo: e' la
    // regola del modulo Giacenze, e la rete esclude la classe 9.
    const rilevazionePer = ultimeRilevazioni(rilevazioni, normalizzaRagioneSociale);
    // Stessa regola del modulo Giacenze, in comune (shared/giacenzaStoccaggi.ts):
    // la rilevazione del portale e i movimenti finiti dopo, per fine trasporto.
    // Solo rete: le classi 1-4 della rilevazione, le primarie di rete arrivate
    // allo stoccaggio (non all'impianto, se il soggetto e' anche impianto), le
    // secondarie di rete arrivate allo stoccaggio e quelle partite. La classe 9
    // e le secondarie ACI sono l'ACI; l'extra raccolta, che a portale non c'e',
    // ha una giacenza sua: nessuna delle due entra qui. Le secondarie in arrivo
    // mancavano, mentre Giacenze le conta: lo stesso piazzale aveva due saldi.
    const tipoStoc = (x) => String(x.tipo_destinazione || '').toLowerCase().trim() === 'stoc';
    const giacenzaStoccaggio = (chiave) => {
      const r = rilevazionePer.get(chiave);
      if (!r) return null;
      let kg = kgReteDiRilevazione(r.record);
      for (const p of primarie) {
        if (!terminato(p) || normalizzaRagioneSociale(p.destinazione) !== chiave || !tipoStoc(p)) continue;
        if (dopoLaRilevazione(p, r.quando)) kg += peso(p);
      }
      for (const s of secondarie) {
        if (!terminato(s) || !dopoLaRilevazione(s, r.quando)) continue;
        if (tipoStoc(s) && normalizzaRagioneSociale(s.destinazione) === chiave) kg += peso(s);
        if (normalizzaRagioneSociale(s.stoccaggio) === chiave) kg -= peso(s);
      }
      return Math.max(0, Math.round(kg));
    };

    // --- le ipotesi scritte a mano, per impianto e mese ---
    const ipotesiPer = new Map();
    for (const i of ipotesiTutte) {
      const chiave = normalizzaRagioneSociale(i.impianto);
      if (!ipotesiPer.has(chiave)) ipotesiPer.set(chiave, {});
      ipotesiPer.get(chiave)[i.mese] = {
        primaria_kg: i.primaria_attesa_kg != null && i.primaria_attesa_kg !== '' ? Number(i.primaria_attesa_kg) : null,
        viaggi: i.viaggi_previsti != null && i.viaggi_previsti !== '' ? Number(i.viaggi_previsti) : null,
        note: i.note || '',
        id: i.id,
      };
    }
    const ipotesiPulite = (chiave) => {
      const per = ipotesiPer.get(chiave) || {};
      const out = {};
      for (const [mese, v] of Object.entries(per)) {
        const x = {};
        if (v.primaria_kg != null) x.primaria_kg = v.primaria_kg;
        if (v.viaggi != null) x.viaggi = v.viaggi;
        if (Object.keys(x).length) out[mese] = x;
      }
      return out;
    };

    // --- gli stoccaggi che alimentano ciascun impianto ---
    // Quanto ogni impianto ha gia' ricevuto da ciascuno stoccaggio quest'anno:
    // serve a dividere la giacenza di uno stoccaggio condiviso.
    const ricevutoDa = new Map(); // "stoccaggio|impianto" -> kg
    for (const s2 of secondarie) {
      if (!terminato(s2) || meseDi(s2.trasporto_finito_il, anno) < 0) continue;
      const o = normalizzaRagioneSociale(s2.stoccaggio);
      const d2 = normalizzaRagioneSociale(s2.destinazione);
      if (!o || !d2) continue;
      const k = o + '|' + d2;
      ricevutoDa.set(k, (ricevutoDa.get(k) || 0) + peso(s2));
    }

    const stoccaggiDi = (chiaveImpianto) => {
      const nomi = new Set();
      // da chi e' registrato nella predittivita' come stoccaggio dell'impianto
      for (const f of fornitori) {
        if (normalizzaRagioneSociale(f.impianto_nome) !== chiaveImpianto) continue;
        if (f.ruolo === 'stoccaggio' || f.ruolo === 'doppio_ruolo') nomi.add(normalizzaRagioneSociale(f.nome));
      }
      // e da chi gli ha davvero mandato secondarie QUEST'ANNO: un piazzale che
      // lavorava l'anno scorso e che per quest'anno non e' contrattualizzato non
      // entra nei conti del 2026. Senza il filtro d'anno rientrava dalla porta di
      // servizio - e' successo con RPN, che nel 2026 non ha ne' contratto ne'
      // giacenza, e compariva fra le fonti di Tecnogum con "0 t, non rilevato".
      for (const s of secondarie) {
        if (!terminato(s)) continue;
        if (meseDi(s.trasporto_finito_il, anno) < 0) continue;
        if (normalizzaRagioneSociale(s.destinazione) !== chiaveImpianto) continue;
        const o = normalizzaRagioneSociale(s.stoccaggio);
        if (o) nomi.add(o);
      }
      return [...nomi].map(chiave => ({
        chiave,
        nome: nomeSito.get(chiave) || chiave,
        giacenza_kg: giacenzaStoccaggio(chiave),
        giacenza_nota: giacenzaStoccaggio(chiave) === null ? 'nessuna rilevazione del portale per questo stoccaggio' : '',
        ingressi_per_mese: primariaPerSito.get(chiave) || {},
        ricevuto_kg: ricevutoDa.get(chiave + '|' + chiaveImpianto) || 0,
      }));
    };

    // Un piazzale solo non puo' essere promesso a due impianti. Prima se ne
    // divideva la giacenza con una quota fissa, il che era meglio di niente ma
    // restava una finzione: la quota giusta cambia mese per mese, secondo quanto
    // manca a ciascuno. Adesso i due impianti si proiettano insieme e ogni mese
    // il piazzale distribuisce quello che ha davvero, a chi ne ha piu' bisogno.
    const stoccaggiPerImpianto = new Map();
    for (const imp of impianti) {
      const chiave = normalizzaRagioneSociale(imp.nome_impianto);
      stoccaggiPerImpianto.set(chiave, stoccaggiDi(chiave));
    }

    // Il target scritto nel foglio delle giacenze, per il confronto.
    const giacenzaSitoPer = new Map();
    for (const g2 of giacenzeSito) {
      const k = normalizzaRagioneSociale(g2.sito);
      if (k && !giacenzaSitoPer.has(k)) giacenzaSitoPer.set(k, g2);
    }

    const insieme = proiettaInsieme(impianti.map(imp => {
      const chiave = normalizzaRagioneSociale(imp.nome_impianto);
      return {
        impianto: { nome: nomeSito.get(chiave) || imp.nome_impianto, target_kg: Number(imp.target) || 0, data_fine: imp.data_fine || fineProgrammazione(anno).data },
        dati: {
          conferito_primaria_per_mese: primariaPerSito.get(chiave) || {},
          conferito_secondaria_per_mese: secondariaInSito.get(chiave) || {},
          stoccaggi: stoccaggiPerImpianto.get(chiave) || [],
        },
        opzioni: { ipotesi: ipotesiPulite(chiave) },
      };
    }), { meseCorrente: meseDa });

    const proiezioni = impianti.map((imp, i) => {
      const chiave = normalizzaRagioneSociale(imp.nome_impianto);
      const p = insieme.impianti[i];
      // Il target dell'impianto sta scritto in due posti - qui e nel foglio delle
      // giacenze - e devono dire la stessa cosa: se non la dicono, la proiezione
      // lo segnala invece di scegliere da sola quale sia quello buono. Trovata
      // cosi' una differenza di 5 t su Tecnogum, il 19/09/2026.
      const sito = giacenzaSitoPer.get(chiave);
      const altroTarget = sito && Number(sito.target_totale_t) > 0 ? Math.round(Number(sito.target_totale_t) * 1000) : null;
      const avvisi = [...(p.avvisi || [])];
      if (altroTarget !== null && Math.abs(altroTarget - (Number(imp.target) || 0)) >= 1000) {
        avvisi.push(`Il target di questo impianto non coincide fra i moduli: qui vale ${Math.round((Number(imp.target) || 0) / 1000)} t, nelle Giacenze ${Math.round(altroTarget / 1000)} t. La proiezione usa il primo: correggi quello sbagliato, perche' i due numeri devono coincidere.`);
      }
      if (!imp.data_fine && avvisoFineProgrammazione(anno)) avvisi.push(avvisoFineProgrammazione(anno));
      return { ...p, avvisi, impianto_id: imp.id, impianto_registrato: imp.nome_impianto, data_fine: imp.data_fine || fineProgrammazione(anno).data };
    });

    return Response.json({
      canale: 'RETE',
      anno,
      mese_da: meseDa,
      mese_da_nome: MESI[meseDa] || '',
      kg_per_viaggio: KG_PER_VIAGGIO,
      // Avvisi che valgono per tutta la proiezione, non per un impianto: un
      // caricamento aperto e i terminati senza fine trasporto lasciati fuori.
      avvisi_generali: avvisiGenerali,
      senza_fine_trasporto: senzaFineTrasporto,
      caricamento_in_corso: caricamentoInCorso || '',
      impianti: proiezioni,
      viaggi_per_mese: viaggiPerMese(proiezioni),
      piazzali_condivisi: insieme.piazzali_condivisi,
      registro_piazzali: insieme.registro_piazzali,
      ipotesi: ipotesiTutte.map(i => ({
        id: i.id, impianto: i.impianto, mese: i.mese,
        primaria_attesa_kg: i.primaria_attesa_kg, viaggi_previsti: i.viaggi_previsti, note: i.note,
      })),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
