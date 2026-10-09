import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll, perPagina } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { giornoRoma, annoRoma, oggiRoma } from "../../shared/giornoItaliano.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { formulariDelFile, ruoloDellaRiga } from "../../shared/giacenzaPortale.ts";

// Restituisce l'elenco paginato degli ordini in attesa di dichiarazione (OrdineNonDichiarato).
// Payload: { sito, provincia, anno, ricerca, limite, offset, tutte } - tutti opzionali.
// Con tutte: true le righe non si tagliano a mille: serve agli export, che
// scrivevano il TOTALE di tutto l'elenco sotto le sole prime mille righe.
// Richiede solo utente autenticato.
//
// Tutto per FINE DEL TRASPORTO, sul giorno italiano: l'anno, l'ordinamento e i
// giorni di attesa. La data di chiusura dell'ordine a portale si mostra soltanto
// e non decide nulla (regola dell'utente, 21/09/2026). Il file e' della rete: una
// riga ACI, se mai ci fosse, resta fuori, perche' i canali non si mescolano.
//
// Le date del formulario (regola dell'utente, 22/09/2026): immissione, inizio e
// fine trasporto sono obbligatorie e, dove mancano, si segnalano. Una riga del
// file e' un ordine che il PORTALE conosce; il suo formulario nel gestionale e' la
// primaria (e, se il carico e' passato da uno stoccaggio, la secondaria che l'ha
// portato all'impianto). Se quel formulario e' terminato con una data mancante o
// incoerente la riga lo dice, con quali date. Se manca la fine trasporto del
// movimento che arriva all'impianto, il portale conta il carico nella sua
// giacenza e il gestionale non lo colloca in nessun mese: fuori_dai_mesi; se al
// formulario della primaria manca la fine trasporto e il file la scrive, la riga
// la riporta (fine_a_portale) perche' la si ricopi. La regola che lega una riga
// ai suoi formulari sta in shared/giacenzaPortale.ts (formulariDelFile).
//
// Filtri:
//   sito     -> destinazione_secondaria se valorizzata, altrimenti destinazione (normalizzaRagioneSociale)
//   provincia-> confronto in maiuscolo e con trim
//   anno     -> anno della fine trasporto (accetta ancora anno_chiusura dalle pagine vecchie)
//   ricerca  -> corrispondenza parziale case-insensitive su numero_fir e ordine_primaria
//   solo_date_da_sistemare -> solo le righe il cui formulario ha le date da sistemare
//   ruolo    -> 'imp' (da dichiarare su quell'impianto) o 'stoc' (passati dal piazzale e gia' ripartiti)
//
// Restituisce: righe (paginate), totale_righe, totale_kg, per_mese (di quali mesi
// sono gli ordini di tutto l'elenco filtrato, non della pagina: ordini e kg, con
// mese vuoto per chi non ha la fine trasporto), siti_distinti, province_distinte, anni_distinti,
// date_da_sistemare ({ n, kg, fuori_dai_mesi, fuori_dai_mesi_kg } delle righe filtrate),
// senza_fine_a_portale (righe del file senza fine trasporto), senza_fine_dal_gestionale
// (quante di quelle la prendono dalla primaria nel gestionale).
//
// I formulari si leggono solo per gli ordini del file (22/09/2026). La scheda Da
// dichiarare chiama questa funzione a ogni pagina, filtro o ricerca: leggere
// tutta PrimariaRete (undici pagine da mille) e tutta Secondaria ogni volta la
// rendeva lenta, con il rischio che la funzione scadesse. Si chiedono a blocchi,
// con $in sul numero d'ordine, le primarie e le secondarie delle righe che
// servono: quelle che passano i filtri di sito, provincia e ricerca, per le date
// da sistemare, e quelle senza fine trasporto nel file, per l'anno. Il blocco e'
// piccolo perche' la domanda viaggia nell'indirizzo della richiesta.
const BLOCCO_ORDINI = 150;
const BLOCCHI_INSIEME = 3;

/** Legge i record di `entity` con id_ordine fra `ids`, a blocchi, e li passa a `fn`; quanti ne ha letti. */
async function perOrdini(entity, ids, fn) {
  const blocchi = [];
  for (let i = 0; i < ids.length; i += BLOCCO_ORDINI) blocchi.push(ids.slice(i, i + BLOCCO_ORDINI));
  let letti = 0;
  for (let i = 0; i < blocchi.length; i += BLOCCHI_INSIEME) {
    const esiti = await Promise.all(blocchi.slice(i, i + BLOCCHI_INSIEME)
      .map(blocco => fetchAll(entity, { id_ordine: { $in: blocco } }, 'id')));
    for (const righe of esiti) for (const r of righe) { letti++; fn(r); }
  }
  return letti;
}

/**
 * Come perOrdini, con un ripiego. Se la domanda per numero d'ordine da' errore o
 * non torna nessun record, si rilegge tutto l'archivio pagina per pagina e si
 * tengono gli ordini voluti: meglio lenta che una scheda che non segnala le date
 * da sistemare. `fn` puo' ricevere due volte lo stesso record: formulariDelFile
 * lo tiene una volta sola.
 */
async function leggiOrdini(entity, ids, fn) {
  if (!ids.length) return;
  let letti = 0;
  try { letti = await perOrdini(entity, ids, fn); } catch { letti = 0; }
  if (letti) return;
  const voluti = new Set(ids);
  await perPagina(entity, null, (r) => { if (voluti.has(String(r.id_ordine || '').trim())) fn(r); });
}

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { sito, provincia, ricerca, limite, offset } = body;
    const soloDate = !!body.solo_date_da_sistemare;
    // 'imp' = i carichi che quell'impianto deve dichiarare; 'stoc' = quelli passati
    // dal suo piazzale e gia' ripartiti, che dichiara chi li ha ricevuti.
    const ruoloChiesto = ['imp', 'stoc'].includes(String(body.ruolo || '').trim().toLowerCase()) ? String(body.ruolo).trim().toLowerCase() : null;
    const anno = body.anno ?? body.anno_chiusura;

    const norm = normalizzaRagioneSociale;
    const tutte = !!body.tutte;
    const limiteNum = Math.min(Number(limite) || 100, 1000);
    const offsetNum = Math.max(Number(offset) || 0, 0);

    const svc = base44.asServiceRole.entities;
    const righeFile = await fetchAll(svc.OrdineNonDichiarato);
    const all = righeFile.filter(r => !eAci({ prodotto: r.prodotto }));

    const sitoNorm = sito ? norm(sito) : null;
    const provUpper = provincia ? String(provincia).trim().toUpperCase() : null;
    const annoNum = anno ? Number(anno) : null;
    const ricercaLower = ricerca ? String(ricerca).trim().toLowerCase() : null;

    function sitoDiRiga(r) {
      const sec = String(r.destinazione_secondaria || '').trim();
      if (sec) return sec;
      return String(r.destinazione || '').trim();
    }
    // I filtri che non dipendono dalle date del gestionale.
    const passaFiltri = (r) => {
      if (sitoNorm && norm(sitoDiRiga(r)) !== sitoNorm) return false;
      if (provUpper && String(r.provincia || '').trim().toUpperCase() !== provUpper) return false;
      if (ricercaLower) {
        const fir = String(r.numero_fir || '').toLowerCase();
        const ord = String(r.ordine_primaria || '').toLowerCase();
        if (!fir.includes(ricercaLower) && !ord.includes(ricercaLower)) return false;
      }
      return true;
    };

    // I formulari del gestionale da sistemare: primarie di rete e secondarie
    // terminate con una data obbligatoria mancante o incoerente, lette solo per
    // gli ordini del file che servono (vedi in testa).
    const formulari = formulariDelFile();
    const idPrimarie = new Set();
    const idSecondarie = new Set();
    for (const r of all) {
      const serve = passaFiltri(r) || !giornoRoma(r.fine_trasporto);
      if (!serve) continue;
      const p = String(r.ordine_primaria || '').trim();
      const s = String(r.ordine_secondaria || '').trim();
      if (p) idPrimarie.add(p);
      if (s) idSecondarie.add(s);
    }
    // A CHE TITOLO IL CARICO STA SU QUEL SITO. Un'azienda puo' essere impianto e
    // piazzale insieme: quello che e' passato dal piazzale ed e' ripartito in
    // secondaria sta come giacenza su chi l'ha ricevuto, e lo dichiara lui. Il
    // ruolo lo dice la primaria nel gestionale, e si legge qui senza una lettura
    // in piu' (utente, 08/10/2026).
    const tipoPrimaria = new Map();
    await Promise.all([
      leggiOrdini(svc.PrimariaRete, [...idPrimarie], (r) => {
        formulari.segna(r, 'primaria');
        const id = String(r.id_ordine || '').trim();
        const td = String(r.tipo_destinazione || '').trim().toLowerCase();
        if (id && td) tipoPrimaria.set(id, td.startsWith('stoc') ? 'stoc' : 'imp');
      }),
      // Le secondarie ACI non portano righe di questo file, che e' della rete.
      leggiOrdini(svc.Secondaria, [...idSecondarie], (r) => { if (!eAci(r)) formulari.segna(r, 'secondaria'); }),
    ]);
    // I formulari da sistemare di una riga del file, e se il carico resta fuori dai
    // mesi: conta il movimento che l'ha portato all'impianto.
    const dateDiRiga = (r) => formulari.diRiga(r);

    const filtrate = [];
    const dateFiltrate = new Map(); // riga -> { formulari, fuori, fine_a_portale, fine_dal_gestionale }
    let senzaFineAPortale = 0;
    let senzaFineDalGestionale = 0;
    // La fine trasporto di una riga: quella del file o, se il file non la scrive,
    // quella della primaria nel gestionale. Mai la chiusura (22/09/2026).
    const fineDi = (r, date) => giornoRoma(r.fine_trasporto) || date.fine_dal_gestionale || '';
    const sitiSet = new Set();
    const provinceSet = new Set();
    const anniSet = new Set();
    const oggi = oggiRoma();
    const giorniFra = (da, a) => Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+da.slice(0, 4), +da.slice(5, 7) - 1, +da.slice(8, 10))) / 86400000);

    for (const r of all) {
      // Valori distinti per i filtri, su tutti i record
      const s = sitoDiRiga(r);
      if (s) sitiSet.add(s);
      const prov = String(r.provincia || '').trim().toUpperCase();
      if (prov) provinceSet.add(prov);
      const date = dateDiRiga(r);
      const annoFine = annoRoma(fineDi(r, date));
      if (annoFine !== null) anniSet.add(annoFine);

      if (!passaFiltri(r)) continue;
      if (annoNum !== null && annoFine !== annoNum) continue;
      if (soloDate && !date.formulari.length) continue;
      // Chiesto il ruolo, restano solo le righe di quel titolo: dal pulsante
      // dell'impianto si vede quello che l'impianto deve dichiarare, e basta.
      if (ruoloChiesto && ruoloDellaRiga(r, (id) => tipoPrimaria.get(id) || '') !== ruoloChiesto) continue;
      filtrate.push(r);
      dateFiltrate.set(r, date);
      if (!giornoRoma(r.fine_trasporto)) { senzaFineAPortale++; if (date.fine_dal_gestionale) senzaFineDalGestionale++; }
    }

    // Dal carico arrivato da piu' tempo; quelli senza fine trasporto in fondo.
    filtrate.sort((a, b) => (fineDi(a, dateFiltrate.get(a)) || '9999').localeCompare(fineDi(b, dateFiltrate.get(b)) || '9999'));

    const totale_righe = filtrate.length;
    const totale_kg = filtrate.reduce((s, r) => s + (Number(r.peso_non_dichiarato_kg) || 0), 0);
    // DI QUALI MESI SONO (regola dell'utente, 09/10/2026).
    //
    // Il fatto vero: «laddove c'e' il pulsante con gli ordini da dichiarare non
    // compaiono poi in elenco gli ingressi di ottobre e mi chiedo: come fai a
    // trovarti con la giacenza attuale se non consideri anche quelli?».
    //
    // Gli ordini c'erano - su T-Cycle 114 righe per 352.940 kg, esattamente la
    // giacenza, ottobre compreso con 12 ordini e 29.060 kg - ma l'elenco e'
    // ordinato dal carico piu' vecchio e mostra cento righe per pagina: la prima
    // pagina finiva a settembre, e sotto c'era un totale (352.940 kg) che era di
    // tutte le 114. Chi legge vede un totale che le righe davanti non fanno, e
    // conclude che ottobre non e' contato.
    //
    // Il conto per mese si manda sempre, su tutto l'elenco filtrato e non sulla
    // pagina: sta sopra la tabella, si legge in un colpo d'occhio e fa da
    // riscontro alla giacenza. Un carico senza fine trasporto non ha mese e si
    // conta a parte, perche' fingere un mese sarebbe peggio che dirlo.
    const perMese = new Map();
    for (const r of filtrate) {
      const fine = fineDi(r, dateFiltrate.get(r));
      const chiave = fine ? fine.slice(0, 7) : '';
      if (!perMese.has(chiave)) perMese.set(chiave, { mese: chiave, ordini: 0, kg: 0 });
      const x = perMese.get(chiave);
      x.ordini++;
      x.kg += Number(r.peso_non_dichiarato_kg) || 0;
    }
    const per_mese = [...perMese.values()]
      .sort((a, b) => (a.mese || '9999-99').localeCompare(b.mese || '9999-99'))
      .map(x => ({ ...x, kg: Math.round(x.kg) }));
    // Le righe filtrate col formulario da sistemare, e quelle che il gestionale non
    // colloca in nessun mese: un conteggio della rete, l'unico canale del file.
    const conDate = filtrate.filter(r => dateFiltrate.get(r).formulari.length);
    const fuori = filtrate.filter(r => dateFiltrate.get(r).fuori);
    const kgDi = (l) => Math.round(l.reduce((s, r) => s + (Number(r.peso_non_dichiarato_kg) || 0), 0));
    const pagina = tutte ? filtrate.slice(offsetNum) : filtrate.slice(offsetNum, offsetNum + limiteNum);

    const righe = pagina.map(r => {
      const fine = fineDi(r, dateFiltrate.get(r));
      return {
        ordine_primaria: r.ordine_primaria || '',
        numero_fir: r.numero_fir || '',
        fine_trasporto: fine || null,
        // Solo da mostrare: non decide nulla.
        data_chiusura: r.data_chiusura || null,
        punto_di_raccolta: r.punto_di_raccolta || '',
        comune: r.comune || '',
        provincia: r.provincia || '',
        prodotto: r.prodotto || '',
        cer: r.cer || '',
        peso_non_dichiarato_kg: Number(r.peso_non_dichiarato_kg) || 0,
        destinazione: r.destinazione || '',
        destinazione_secondaria: r.destinazione_secondaria || '',
        trasportatore: r.trasportatore || '',
        // Da quanti giorni il carico e' arrivato e aspetta la dichiarazione.
        giorni_attesa: fine ? giorniFra(fine, oggi) : null,
        // Il formulario nel gestionale: le date che mancano o non tornano.
        date_da_sistemare: dateFiltrate.get(r).formulari,
        fuori_dai_mesi: dateFiltrate.get(r).fuori,
        // La fine trasporto che il portale scrive, quando al formulario della primaria manca.
        fine_a_portale: dateFiltrate.get(r).fine_a_portale || null,
        // Il file non scrive la fine trasporto e questa e' quella del gestionale.
        fine_dal_gestionale: !!dateFiltrate.get(r).fine_dal_gestionale,
      };
    });

    return Response.json({
      righe,
      totale_righe,
      // Chilogrammi interi.
      totale_kg: Math.round(totale_kg),
      // Di quali mesi sono gli ordini dell'elenco filtrato, non della pagina.
      per_mese,
      date_da_sistemare: { n: conDate.length, kg: kgDi(conDate), fuori_dai_mesi: fuori.length, fuori_dai_mesi_kg: kgDi(fuori) },
      // Righe del file senza fine trasporto, e quante la prendono dal gestionale.
      senza_fine_a_portale: senzaFineAPortale,
      senza_fine_dal_gestionale: senzaFineDalGestionale,
      siti_distinti: [...sitiSet].sort(),
      province_distinte: [...provinceSet].sort(),
      anni_distinti: [...anniSet].sort((a, b) => a - b),
      limite: tutte ? totale_righe : limiteNum,
      offset: offsetNum
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
