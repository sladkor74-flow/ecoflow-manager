import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import * as XLSX from 'npm:xlsx@0.18.5';
import { fetchAll } from "../../shared/fetchAll.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { giornoRoma } from "../../shared/giornoItaliano.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { calcolaRigheAttiva } from "../../shared/attivaCalcolo.ts";
import { testoDate } from "../../shared/movimenti.ts";
import { leggiTabellePrefattura, leggiLineePdfPrefattura, confrontaPrefattura, comeOrdine, periodoPrefattura } from "../../shared/prefattura.ts";

// La prefattura del portale Ecotyre: si carica (Excel o PDF), si tiene per il
// mese, e si confronta con le righe che il gestionale calcola sui dati di oggi.
//
// azione 'carica'    (solo admin): Excel { anno, mese, file_uri, nome_file }; PDF { anno, mese, linee_pdf, nome_file }
//                     (il testo del PDF lo estrae il browser con pdf.js) -> legge, salva, confronta
// azione 'confronta' (tutti):      { anno, mese } -> confronto con la prefattura valida del mese
//
// Una nuova prefattura dello stesso mese non cancella la precedente: la segna
// superata, col motivo. Il confronto si rifa' a ogni apertura, perche' i dati
// del gestionale cambiano a ogni importazione.
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// I numeri nelle note si scrivono all'italiana: punto per le migliaia, virgola per i decimali.
// L'espressione aveva perso le barre (/B(?=(d{3})+(?!d))/): cercava la lettera B
// e non metteva mai il punto delle migliaia.
const migliaia = (v, decimali = 0) => { const [i, d] = Number(v || 0).toFixed(decimali).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + d : ''); };

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { azione = 'confronta', anno, mese, file_uri, nome_file, linee_pdf } = await req.json().catch(() => ({}));
    const annoNum = Number(anno);
    if (!annoNum || !MESI.includes(mese)) return Response.json({ error: 'Anno e mese obbligatori' }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const core = base44.asServiceRole.integrations.Core;

    if (azione === 'carica') {
      if (user.role !== 'admin') return rispostaSolaLettura();
      const nome = String(nome_file || '');
      const formato = /\.pdf$/i.test(nome) ? 'pdf' : /\.(xlsx|xlsm|xls|csv)$/i.test(nome) ? 'excel' : '';
      if (!formato) return Response.json({ error: 'La prefattura si carica in Excel (.xlsx, .xls, .csv) o in PDF.' }, { status: 400 });

      let righe = [], note = [], totKg = null, totEuro = null, periodoLetto = null;
      if (formato === 'excel') {
        if (!file_uri) return Response.json({ error: 'file_uri obbligatorio' }, { status: 400 });
        const { signed_url } = await core.CreateFileSignedUrl({ file_uri, expires_in: 900 });
        const risposta = await fetch(signed_url);
        if (!risposta.ok) return Response.json({ error: 'Il file non si riesce a leggere: ' + risposta.status }, { status: 400 });
        const wb = XLSX.read(new Uint8Array(await risposta.arrayBuffer()), { type: 'array' });
        const tabelle = wb.SheetNames.map(n => ({ nome: n, celle: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }) }));
        ({ righe, note } = leggiTabellePrefattura(tabelle));
      } else {
        // Il testo del PDF arriva gia' estratto dal browser: qui si legge riga per riga.
        if (!Array.isArray(linee_pdf) || !linee_pdf.length) return Response.json({ error: 'Il testo del PDF non è arrivato: ricarica la pagina e riprova.' }, { status: 400 });
        const letto = leggiLineePdfPrefattura(linee_pdf);
        righe = letto.righe; note = letto.note; periodoLetto = letto.periodo;
        if (letto.totali_stampati) { totKg = letto.totali_stampati.kg; totEuro = letto.totali_stampati.euro; }
        if (letto.completa === false) return Response.json({ error: note.filter(n => /ATTENZIONE/.test(n)).join(' ') + ' Non ho salvato niente: usa l\'Excel del portale.' }, { status: 400 });
        if (letto.completa) note.push(`PDF letto per intero: ${righe.length} righe, pari al riepilogo stampato (${migliaia(letto.totali_stampati.kg)} kg, ${migliaia(letto.totali_stampati.euro, 2)} euro).`);
      }
      if (!righe.length) return Response.json({ error: 'Nel file non ho trovato righe con un ID ordine: non sembra una prefattura. ' + note.join(' ') }, { status: 400 });
      // Il mese e' scritto nel file (le date di fine trasporto): una prefattura di
      // giugno caricata su luglio darebbe quattrocento differenze finte.
      const periodo = periodoLetto || periodoPrefattura(righe);
      if (periodo && (periodo.anno !== annoNum || MESI[periodo.mese_idx] !== mese)) {
        return Response.json({ error: `Questo file è la prefattura di ${MESI[periodo.mese_idx]} ${periodo.anno}, ma stai caricando su ${mese} ${annoNum}. Seleziona il mese giusto e ricaricalo: non ho salvato niente.`, periodo_del_file: { anno: periodo.anno, mese: MESI[periodo.mese_idx] } }, { status: 400 });
      }

      const adesso = new Date().toISOString();
      const precedenti = (await svc.PrefatturaEcotyre.filter({ anno: annoNum, mese })).filter(p => !p.superata);
      await svc.PrefatturaEcotyre.create({
        anno: annoNum, mese, nome_file: nome, formato, righe,
        totale_kg_stampato: totKg ?? undefined, totale_euro_stampato: totEuro ?? undefined,
        note_lettura: note.join('\n'), caricata_il: adesso, caricata_da: user.full_name || user.email || '',
      });
      for (const p of precedenti) {
        // il giorno italiano: tagliare l'istante UTC, dopo la mezzanotte, scriveva il giorno prima
        await svc.PrefatturaEcotyre.update(p.id, { superata: true, motivo_superata: `Sostituita il ${giornoRoma(adesso)} dal file "${nome}" (${righe.length} righe), caricato da ${user.full_name || user.email}.` });
      }
      // Il file serviva solo a essere letto: le righe sono salvate.
      for (const n of (file_uri ? ['DeleteFile', 'DeletePrivateFile', 'RemoveFile'] : [])) {
        if (typeof core[n] !== 'function') continue;
        try { await core[n]({ file_uri }); break; } catch (_e) { /* resta nell'archivio privato */ }
      }
    } else if (azione !== 'confronta') {
      return Response.json({ error: 'Azione non riconosciuta' }, { status: 400 });
    }

    const valide = (await svc.PrefatturaEcotyre.filter({ anno: annoNum, mese })).filter(p => !p.superata)
      .sort((a, b) => String(b.caricata_il || '').localeCompare(String(a.caricata_il || '')));
    const prefattura = valide[0] || null;
    if (!prefattura) return Response.json({ prefattura: null, confronto: null });

    const [reteAll, aciAll, extraAll, fornitori, tariffe, terziarie] = await Promise.all([
      fetchAll(svc.PrimariaRete), fetchAll(svc.PrimariaAci), fetchAll(svc.ExtraRaccolta),
      // le tariffe tutte, come l'anteprima e il documento: con una pagina sola il confronto poteva usare prezzi diversi
      fetchAll(svc.Fornitore), fetchAll(svc.Tariffa, { direzione: 'ATTIVA' }), fetchAll(svc.Terziaria),
    ]);
    const { righe, anomalie } = calcolaRigheAttiva({ reteAll, aciAll, extraAll, fornitori, tariffe, anno: annoNum, mese });
    // Le date obbligatorie dei formulari del mese, canale per canale (regola
    // dell'utente del 22/09/2026): i terminati confrontati con la prefattura a cui
    // manca l'immissione o l'inizio, o con date incoerenti, e i senza fine
    // trasporto che potrebbero essere del mese. Prima le vedeva solo la scheda
    // Attiva: qui si scartavano con le altre anomalie.
    const anomalieDate = (anomalie || []).filter(a => String(a.tipo || '').startsWith('date'));

    // Dove sta, nel gestionale, un ordine che il mese non ha. Di un terminato si
    // porta anche cosa non va nelle sue date (testoDate): immissione, inizio e
    // fine trasporto sono obbligatorie (regola dell'utente del 22/09/2026), e un
    // ordine della prefattura che nel gestionale e' terminato senza fine trasporto
    // si spiega con la data che manca, non con un "altro mese".
    const altrove = new Map();
    const segna = (lista, canaleDi) => {
      for (const o of lista) {
        const id = comeOrdine(o.id_ordine);
        if (!id) continue;
        const stato = String(o.stato || '').toLowerCase().trim();
        const gia = altrove.get(id);
        if (gia && gia.stato === 'terminato' && stato !== 'terminato') continue;
        altrove.set(id, { canale: canaleDi(o), stato, giorno: giornoRoma(o.trasporto_finito_il), date: testoDate(o) });
      }
    };
    segna(reteAll, (o) => (eAci(o) ? 'ACI' : 'RETE'));
    segna(aciAll, () => 'ACI');
    segna(extraAll, () => 'EXTRA_RACCOLTA');
    segna(terziarie, () => 'TERZIARIE');

    const { righe: _righe, ...meta } = prefattura;
    return Response.json({
      prefattura: { ...meta, numero_righe: (prefattura.righe || []).length },
      confronto: confrontaPrefattura(prefattura.righe || [], righe, altrove),
      anomalie_date: anomalieDate,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
