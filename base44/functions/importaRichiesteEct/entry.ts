import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';
import { fetchAll } from "../../shared/fetchAll.ts";
import { leggiFoglio, riconosciOrdine, scadenzaDaNota, statoRichiesta, listaOrdini, evasioneOrdini, abbinaRichieste, ritiriTerminati, idOrdineDaSalvare, ordiniConDateDaSistemare } from "../../shared/richiesteEct.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { statoCaricamenti } from "../../shared/reportSettimanali.ts";

// Carica il foglio "Richieste ECT" del file di gestione e ne tiene aggiornato
// l'elenco: per ogni richiesta cerca l'ID ordine fra gli assegnati (nome del
// produttore piu' data di immissione) e, se quell'ordine risulta terminato,
// propone l'evasione con la data del ritiro.
//
// Non sovrascrive mai quello che ha messo l'utente: la spunta di evasione, la
// data di conferma, l'ID scelto a mano e le note interne restano.
//
// Una richiesta si riconosce da produttore, classe e data di immissione
// (abbinaRichieste), non dal numero di riga del foglio: ordinare il foglio o
// inserirci una riga non deve spostare le spunte su altre richieste.
//
// Payload: { file_url, anno? }
const FOGLIO = 'Richieste ECT';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo l amministratore puo caricare le richieste' }, { status: 403 });

    const { file_url, anno } = await req.json().catch(() => ({}));
    if (!file_url) return Response.json({ error: 'file_url obbligatorio' }, { status: 400 });

    const risposta = await fetch(file_url);
    if (!risposta.ok) return Response.json({ error: 'Il file non si riesce a leggere: ' + risposta.status }, { status: 400 });
    const dati = new Uint8Array(await risposta.arrayBuffer());
    const wb = XLSX.read(dati, { type: 'array', cellDates: true, sheets: [FOGLIO] });
    const ws = wb.Sheets[FOGLIO];
    if (!ws) return Response.json({ error: 'Nel file non c e il foglio ' + FOGLIO }, { status: 400 });

    const griglia = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, cellDates: true });
    // Il foglio non comincia dalla riga 1: la prima riga dell'elenco e' quella
    // da cui parte l'area usata.
    const primaRiga = (XLSX.utils.decode_range(ws['!ref'] || 'A1').s.r || 0) + 1;
    const righe = leggiFoglio(griglia, primaRiga);
    if (!righe.length) return Response.json({ error: 'Il foglio ' + FOGLIO + ' non contiene richieste' }, { status: 400 });

    // L'anno e' quello delle mail della richiesta, che e' l'anno di lavoro.
    // (le date del foglio sono gia' giorni di calendario: il taglio va bene)
    const anni = righe.map(r => r.mail_inviata_il || r.ordine_immesso_il).filter(Boolean).map(d => Number(d.slice(0, 4)));
    const annoNum = Number(anno) || (anni.length ? Math.max(...anni) : Number(oggiRoma().slice(0, 4)));

    // Gli ordini si cercano fra primarie e assegnati: se il file delle primarie si
    // sta riscrivendo, o un caricamento l'ha lasciato a meta', ID e ritiri letti
    // adesso sarebbero sbagliati e resterebbero salvati. Si rinvia dicendo perche'.
    const { in_corso } = await statoCaricamenti(base44, ['primarie']);
    if (in_corso.length) {
      const c = in_corso[0];
      const chi = [c.utente, c.nome_file].filter(Boolean).join(', ');
      return Response.json({
        error: c.interrotto
          ? `Richieste non caricate: il caricamento delle primarie del ${c.data}${chi ? ` (${chi})` : ''} e' rimasto interrotto e l'archivio puo' essere incompleto. Ricarica prima il file delle primarie, poi questo.`
          : `Richieste non caricate: e' in corso il caricamento delle primarie${chi ? ` (${chi})` : ''}. Ricarica questo file quando e' finito.`,
        rinviato: true,
      }, { status: 409 });
    }

    const svc = base44.asServiceRole.entities;
    const [assRete, assAci, rete, aci, esistenti] = await Promise.all([
      fetchAll(svc.Assegnato),
      fetchAll(svc.AssegnatoAci),
      fetchAll(svc.PrimariaRete),
      fetchAll(svc.PrimariaAci),
      fetchAll(svc.RichiestaEct, { anno: annoNum }),
    ]);
    const ordini = [...assRete, ...assAci, ...rete, ...aci];
    const presenti = new Set(ordini.map(o => String(o.id_ordine || '').trim()).filter(Boolean));

    // Per sapere se il ritiro e' stato fatto: l'ordine fra i terminati, col giorno
    // italiano della fine trasporto (giornoMovimento). Tagliando la stringa UTC un
    // trasporto finito a mezzanotte italiana cadeva il giorno prima, e la data
    // rilevata cambiava a ogni alternanza fra questo caricamento e quello delle
    // primarie (importaBlocco, ritiri_ect), che legge il giorno italiano. Un
    // terminato senza fine trasporto non conta come ritirato - non si ripiega
    // sulla chiusura a portale - ma la richiesta che lo aspetta si segnala.
    // Un ritiro con un'altra data obbligatoria che manca o non torna conta, ma si
    // dice (daSistemare, regola dell'utente del 22/09/2026).
    const { terminati, senzaFine, daSistemare } = ritiriTerminati([...rete, ...aci]);

    const abbinate = abbinaRichieste(righe, esistenti);

    let creati = 0, aggiornati = 0, invariati = 0, spostate = 0;
    const daConfermare = [];
    const terminatiSenzaFine = [];
    const conDate = [];
    for (let i = 0; i < righe.length; i++) {
      const r = righe[i];
      const gia = abbinate[i];
      // Un ID gia' riconosciuto non si perde per un riconoscimento diventato
      // ambiguo: la stessa regola del ricalcolo dopo le primarie.
      const ric = idOrdineDaSalvare(gia, riconosciOrdine(r, ordini));
      if (gia && gia.riga_excel !== r.riga_excel) spostate++;
      // Gli ID scritti a mano restano e vincono: una richiesta puo' coprire piu'
      // ordini, e l'evasione si propone solo quando sono tutti ritirati.
      const ids = listaOrdini({ id_ordine_manuale: gia && gia.id_ordine_manuale, id_ordine: ric.id_ordine });
      const ev = evasioneOrdini(ids, terminati);
      // Come nel ricalcolo dopo le primarie (importaBlocco, dataRitiro): un
      // ritiro gia' rilevato si toglie solo se l'archivio dice che un ordine
      // della richiesta non e' ritirato, non se l'ordine nell'archivio manca.
      const salvata = gia && gia.evasione_rilevata_il;
      const archivioNonBasta = !!salvata && !ids.filter(id => !terminati.has(id)).every(id => presenti.has(id));
      const rilevata = ev.ultima || (archivioNonBasta ? salvata : null);

      // Le date che vengono dal foglio o dai ritiri si riscrivono anche vuote
      // (null, non undefined, che l'aggiornamento ignora): una data tolta dal
      // foglio, o un secondo ID non ancora ritirato, altrimenti lasciava la
      // richiesta "da confermare" sulla data vecchia, con meno ordini evasi che
      // ordini.
      const campi = {
        anno: annoNum,
        riga_excel: r.riga_excel,
        pdr_nome: r.pdr_nome,
        classe: r.classe,
        provincia: r.provincia,
        ordine_immesso_il: r.ordine_immesso_il || undefined,
        trasportatore: r.trasportatore,
        mail_inviata_il: r.mail_inviata_il || null,
        nota: r.nota,
        scadenza: scadenzaDaNota(r.nota, annoNum) || null,
        evaso_il: r.evaso_il || null,
        motivo_annullamento: r.motivo_annullamento,
        id_ordine: ric.id_ordine,
        id_ordine_stato: ric.id_ordine_stato,
        id_ordine_candidati: ric.id_ordine_candidati,
        evasione_rilevata_il: rilevata || null,
        ordini_totali: ev.totali,
        ordini_evasi: ev.evasi,
      };
      const conStato = { ...campi, evasione_confermata: gia ? !!gia.evasione_confermata : false };
      campi.esito = statoRichiesta(conStato);

      if (!gia) { await svc.RichiestaEct.create(campi); creati++; }
      else {
        const cambia = Object.keys(campi).some(k => String(gia[k] ?? '') !== String(campi[k] ?? ''));
        if (cambia) { await svc.RichiestaEct.update(gia.id, campi); aggiornati++; } else invariati++;
      }
      // Chi risulta ritirato e non ha ancora la spunta va detto subito, sia che la
      // riga sia nuova sia che fosse gia' in elenco: e' quello su cui l utente
      // deve mettere le mani per rispondere al consorzio.
      if (campi.esito === 'da_confermare' && !(gia && gia.evasione_confermata) && rilevata) {
        daConfermare.push({ pdr: r.pdr_nome, id_ordine: ids.join(', '), evasa_il: rilevata });
      }
      // Ancora aperta ma con un ordine terminato senza fine trasporto: si dice,
      // perche' il ritiro c'e' e sollecitarlo sarebbe sbagliato (regola 1).
      const senzaData = ids.filter(id => senzaFine.has(id));
      if (campi.esito === 'aperta' && senzaData.length) terminatiSenzaFine.push({ pdr: r.pdr_nome, id_ordine: senzaData.join(', ') });
      if (campi.esito !== 'annullata') conDate.push(...ordiniConDateDaSistemare(r.pdr_nome, ids, terminati, daSistemare));
    }

    // Le righe cancellate dal foglio non si toccano: restano nello storico.
    const ritrovate = new Set(abbinate.filter(Boolean).map(e => e.id));
    const orfane = esistenti.filter(e => !ritrovate.has(e.id)).length;

    return Response.json({
      ok: true, anno: annoNum, righe_lette: righe.length,
      creati, aggiornati, invariati, orfane, spostate,
      riconosciuti: righe.filter(r => riconosciOrdine(r, ordini).id_ordine_stato === 'trovato').length,
      da_confermare: daConfermare,
      terminati_senza_fine: terminatiSenzaFine,
      ordini_con_date_da_sistemare: conDate,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
