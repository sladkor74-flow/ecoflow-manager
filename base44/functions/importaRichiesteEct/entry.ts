import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';
import { fetchAll } from "../../shared/fetchAll.ts";
import { leggiFoglio, riconosciOrdine, scadenzaDaNota, statoRichiesta, soloData } from "../../shared/richiesteEct.ts";

// Carica il foglio "Richieste ECT" del file di gestione e ne tiene aggiornato
// l'elenco: per ogni richiesta cerca l'ID ordine fra gli assegnati (nome del
// produttore piu' data di immissione) e, se quell'ordine risulta terminato,
// propone l'evasione con la data del ritiro.
//
// Non sovrascrive mai quello che ha messo l'utente: la spunta di evasione, la
// data di conferma, l'ID scelto a mano e le note interne restano.
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
    const anni = righe.map(r => r.mail_inviata_il || r.ordine_immesso_il).filter(Boolean).map(d => Number(d.slice(0, 4)));
    const annoNum = Number(anno) || (anni.length ? Math.max(...anni) : new Date().getUTCFullYear());

    const svc = base44.asServiceRole.entities;
    const [assRete, assAci, rete, aci, esistenti] = await Promise.all([
      fetchAll(svc.Assegnato),
      fetchAll(svc.AssegnatoAci),
      fetchAll(svc.PrimariaRete),
      fetchAll(svc.PrimariaAci),
      fetchAll(svc.RichiestaEct, { anno: annoNum }),
    ]);
    const ordini = [...assRete, ...assAci, ...rete, ...aci];

    // Per sapere se il ritiro e' stato fatto: l'ordine fra i terminati con la
    // data di fine trasporto.
    const terminati = new Map();
    for (const o of [...rete, ...aci]) {
      const id = String(o.id_ordine || '').trim();
      if (!id) continue;
      if (String(o.stato || '').trim().toLowerCase() !== 'terminato') continue;
      const d = soloData(o.trasporto_finito_il);
      if (d && (!terminati.has(id) || d < terminati.get(id))) terminati.set(id, d);
    }

    const perRiga = new Map();
    for (const e of esistenti) if (e.riga_excel) perRiga.set(e.riga_excel, e);

    let creati = 0, aggiornati = 0, invariati = 0;
    const daConfermare = [];
    for (const r of righe) {
      const ric = riconosciOrdine(r, ordini);
      const gia = perRiga.get(r.riga_excel) || null;
      const idBuono = (gia && gia.id_ordine_manuale) || ric.id_ordine;
      const rilevata = idBuono ? (terminati.get(idBuono) || null) : null;

      const campi = {
        anno: annoNum,
        riga_excel: r.riga_excel,
        pdr_nome: r.pdr_nome,
        classe: r.classe,
        provincia: r.provincia,
        ordine_immesso_il: r.ordine_immesso_il || undefined,
        trasportatore: r.trasportatore,
        mail_inviata_il: r.mail_inviata_il || undefined,
        nota: r.nota,
        scadenza: scadenzaDaNota(r.nota, annoNum) || undefined,
        evaso_il: r.evaso_il || undefined,
        motivo_annullamento: r.motivo_annullamento,
        id_ordine: ric.id_ordine,
        id_ordine_stato: ric.id_ordine_stato,
        id_ordine_candidati: ric.id_ordine_candidati,
        evasione_rilevata_il: rilevata || undefined,
      };
      const conStato = { ...campi, evasione_confermata: gia ? !!gia.evasione_confermata : false };
      campi.esito = statoRichiesta(conStato);

      if (!gia) { await svc.RichiestaEct.create(campi); creati++; continue; }
      const cambia = Object.keys(campi).some(k => String(gia[k] ?? '') !== String(campi[k] ?? ''));
      if (cambia) { await svc.RichiestaEct.update(gia.id, campi); aggiornati++; } else invariati++;
      if (campi.esito === 'da_confermare' && !gia.evasione_confermata && rilevata) {
        daConfermare.push({ pdr: r.pdr_nome, id_ordine: idBuono, evasa_il: rilevata });
      }
    }

    // Le righe cancellate dal foglio non si toccano: restano nello storico.
    const orfane = esistenti.filter(e => e.riga_excel && !righe.some(r => r.riga_excel === e.riga_excel)).length;

    return Response.json({
      ok: true, anno: annoNum, righe_lette: righe.length,
      creati, aggiornati, invariati, orfane,
      riconosciuti: righe.filter(r => riconosciOrdine(r, ordini).id_ordine_stato === 'trovato').length,
      da_confermare: daConfermare,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
