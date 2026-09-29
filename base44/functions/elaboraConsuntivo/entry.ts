import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { soloAmministratore, utenteCorrente } from "../../shared/permessi.ts";
import { valoreCampo, leggiCampo } from "../../shared/testoLungo.ts";

import { calcolaPassivaMese, MESI_PASSIVA } from "../../shared/passivaCalcolo.ts";
import {
  movimentiDelFornitore, confrontaConsuntivo, costoAttesoDallaPassiva, leggiRigheConsuntivo,
  esitoConsuntivo, testoEsitoConsuntivo,
} from "../../shared/consuntivoFornitore.ts";

// IL CONSUNTIVO DI CHIUSURA MESE DI UN FORNITORE: si legge, si confronta, si salva.
//
// Richiesta dell'utente (29/09/2026). Il file non si conserva: le righe arrivano
// gia' lette dal browser (come le liste degli assegnati) e si salvano quelle, cosi'
// il confronto si puo' rifare dopo ogni caricamento senza richiedere il file.
//
// Tre azioni:
//   'carica'   righe nuove da un file: si salvano e si confronta;
//   'confronta' si rifa' il confronto su righe gia' salvate (dopo un caricamento);
//   'elimina'  via il consuntivo.
//
// IL COSTO PREVISTO NON SI RICALCOLA QUI: si legge da calcolaPassivaMese, che e'
// l'unico numero che il gestionale considera dovuto. E se per quel mese e canale
// esiste un conto CONGELATO (ChiusuraPassivaMese), si confronta anche con quello e
// si dice se il ricalcolo di oggi si e' mosso - che e' proprio il motivo per cui si
// congela (decisione dell'utente).
//
// Scrive solo l'amministratore; il confronto lo puo' chiedere chiunque, ma senza
// salvare, perche' la passiva contiene i costi ed e' riservata.

const nomeMeseDi = (mese) => Object.keys(MESI_PASSIVA).find(k => MESI_PASSIVA[k] === mese - 1 && k.length > 3) || String(mese);

/** I soli archivi dei movimenti: bastano a confrontare le quantita'. */
async function archiviMovimenti(svc) {
  const [primarieRete, primarieAci, secondarie, extraRaccolta] = await Promise.all([
    fetchAll(svc.PrimariaRete),
    fetchAll(svc.PrimariaAci),
    fetchAll(svc.Secondaria),
    fetchAll(svc.ExtraRaccolta),
  ]);
  return { primarieRete, primarieAci, secondarie, extraRaccolta };
}

async function contoPassiva(svc, anno, mese, canale) {
  const [primarieRete, primarieAci, secondarieAll, extraRaccoltaAll, tariffeAll, fornitoriAll] = await Promise.all([
    fetchAll(svc.PrimariaRete),
    fetchAll(svc.PrimariaAci),
    fetchAll(svc.Secondaria),
    fetchAll(svc.ExtraRaccolta),
    fetchAll(svc.Tariffa, { direzione: 'PASSIVA' }),
    fetchAll(svc.Fornitore, { stato: 'attivo' }),
  ]);
  const passiva = calcolaPassivaMese(
    { primarieRete, primarieAci, secondarieAll, extraRaccoltaAll, tariffeAll, fornitoriAll },
    anno, mese - 1, nomeMeseDi(mese), canale,
  );
  return { passiva, archivi: { primarieRete, primarieAci, secondarie: secondarieAll, extraRaccolta: extraRaccoltaAll } };
}

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const { user, errore } = await utenteCorrente(base44);
    if (errore) return errore;
    const svc = base44.asServiceRole.entities;
    const body = await req.json();
    const azione = String(body.azione || 'confronta');

    if (azione === 'elimina') {
      const guardia = await soloAmministratore(base44);
      if (guardia.errore) return guardia.errore;
      if (!body.id) return Response.json({ error: 'id obbligatorio' }, { status: 400 });
      await svc.ConsuntivoFornitore.delete(body.id);
      return Response.json({ ok: true });
    }

    let record = null;
    if (body.id) record = await svc.ConsuntivoFornitore.get(body.id);

    const fornitore = String((record && record.fornitore) || body.fornitore || '').trim();
    const ruolo = String((record && record.ruolo) || body.ruolo || '').trim();
    const anno = Number((record && record.anno) || body.anno);
    const mese = Number((record && record.mese) || body.mese);
    const canale = String((record && record.canale) || body.canale || '').toUpperCase();
    if (!fornitore || !ruolo || !anno || !mese || !canale) {
      return Response.json({ error: 'Fornitore, ruolo, anno, mese e canale sono obbligatori' }, { status: 400 });
    }
    if (!['RETE', 'ACI', 'EXTRA_RACCOLTA'].includes(canale)) return Response.json({ error: 'Canale non valido' }, { status: 400 });
    if (!['raccoglitore', 'impianto', 'trasportatore'].includes(ruolo)) return Response.json({ error: 'Ruolo non valido' }, { status: 400 });

    // Le righe: quelle appena lette dal file, oppure quelle gia' salvate.
    // Il lettore e' quello del CONSUNTIVO, non quello della prefattura: un report di
    // un fornitore porta i formulari e puo' non avere nessun numero d'ordine, e
    // pretenderlo voleva dire non riuscire a caricare il documento tipico.
    let righe = null;
    let noteLettura = [];
    if (azione === 'carica') {
      const guardia = await soloAmministratore(base44);
      if (guardia.errore) return guardia.errore;
      const lette = leggiRigheConsuntivo(body.tabelle || []);
      righe = lette.righe;
      noteLettura = [
        ...(lette.note || []),
        ...(lette.colonne || []).map(c => `Foglio "${c.foglio}": ${Object.entries(c.colonne).map(([k, v]) => `${k} = ${v}`).join(', ')}.`),
      ];
      if (!righe.length) {
        return Response.json({ error: `Nel file non ho trovato righe con un formulario o un numero d'ordine${lette.note && lette.note.length ? ': ' + lette.note.join('; ') : '.'}` }, { status: 400 });
      }
    } else if (record && record.righe_json) {
      righe = JSON.parse((await leggiCampo(base44, 'ConsuntivoFornitore', record, 'righe_json')) || '[]');
    }
    if (!righe) return Response.json({ error: 'Non ci sono righe da confrontare: carica il consuntivo.' }, { status: 400 });

    // I COSTI SONO RISERVATI ALL'AMMINISTRATORE, come tutta la fatturazione passiva
    // (calcolaPassiva risponde 403 a chi non lo e'). A chi non lo e' si mostra il
    // confronto sulle QUANTITA', che e' un controllo sui dati e non un dato
    // riservato, e non si calcola nemmeno la passiva: sarebbero sei archivi interi
    // letti per un numero che poi va nascosto.
    const puoVedereICosti = user.role === 'admin';
    const { passiva, archivi } = puoVedereICosti
      ? await contoPassiva(svc, anno, mese, canale)
      : { passiva: null, archivi: await archiviMovimenti(svc) };
    // I fornitori servono a sapere CHI FATTURA per chi: senza, un subfornitore e il
    // suo principale risultano due soggetti diversi qui e uno solo nella passiva.
    const fornitoriTutti = await fetchAll(svc.Fornitore, { stato: 'attivo' });
    const movimenti = movimentiDelFornitore(archivi, { fornitore, ruolo, anno, mese, canale, fornitori: fornitoriTutti });
    // Un chilo di tolleranza: i pesi si scrivono interi, e un arrotondamento nel
    // foglio del fornitore non e' una difformita'.
    const confronto = confrontaConsuntivo(righe, movimenti, { tolleranza_kg: 1 });
    const costoOggi = puoVedereICosti
      ? costoAttesoDallaPassiva(passiva, fornitore, ruolo)
      : { trovato: false, riservato: true, motivo: "L'importo previsto viene dalla fatturazione passiva, che e' riservata all'amministratore. Il confronto sulle quantita' - formulari e chili - lo vedi per intero." };

    // IL CONTO CONGELATO E' LA BASE DEL CONFRONTO, quando c'e' (decisione
    // dell'utente): un consuntivo che arriva a novembre per settembre va confrontato
    // col settembre di allora, non con settembre ricalcolato oggi. La prima stesura
    // lo leggeva ma poi confrontava comunque col ricalcolo di oggi, cioe' faceva
    // l'opposto di quello che era stato deciso.
    //
    // Congelare non vuol dire nascondere: il ricalcolo di oggi si mostra accanto, e
    // se si e' mosso lo si dice.
    let congelato = null;
    let costo = costoOggi;
    const congelati = puoVedereICosti ? await svc.ChiusuraPassivaMese.filter({ anno, mese, canale }, '-congelato_il', 1) : [];
    if (congelati && congelati.length) {
      const c = congelati[0];
      let contoAllora = null;
      try { contoAllora = JSON.parse((await leggiCampo(base44, 'ChiusuraPassivaMese', c, 'passiva_json')) || 'null'); } catch { /* resta il conto di oggi */ }
      const costoAllora = contoAllora ? costoAttesoDallaPassiva(contoAllora, fornitore, ruolo) : null;
      if (costoAllora) costo = costoAllora;
      congelato = {
        congelato_il: c.congelato_il,
        congelato_da: c.congelato_da || '',
        usato_per_il_confronto: !!costoAllora,
        importo_allora: costoAllora && costoAllora.trovato ? costoAllora.importo : null,
        importo_oggi: costoOggi && costoOggi.trovato ? costoOggi.importo : null,
        cambiato: !!(costoAllora && costoAllora.trovato && costoOggi && costoOggi.trovato
          && Math.round(costoAllora.importo * 100) !== Math.round(costoOggi.importo * 100)),
      };
    }

    const importoConsuntivo = body.importo_consuntivo !== undefined && body.importo_consuntivo !== null
      ? Number(body.importo_consuntivo)
      : (record && record.importo_consuntivo !== undefined && record.importo_consuntivo !== null ? Number(record.importo_consuntivo) : null);
    const esito = esitoConsuntivo({ confronto, costo, importo_consuntivo: importoConsuntivo });

    const esitoCompleto = { confronto, costo, esito, congelato, note_lettura: noteLettura, testo: testoEsitoConsuntivo(confronto, esito) };

    // Si salva solo se c'e' un record e chi chiede e' l'amministratore: a tutti gli
    // altri il confronto si mostra e basta.
    if (user.role === 'admin') {
      const campi = {
        fornitore, ruolo, anno, mese, canale,
        // Verde solo se torna tutto quello che si e' potuto controllare.
        quadra: esito.quadra_tutto,
        confrontato_il: new Date().toISOString(),
        ...(importoConsuntivo !== null ? { importo_consuntivo: importoConsuntivo } : {}),
        ...(azione === 'carica' ? { file_nome: String(body.file_nome || ''), caricato_il: new Date().toISOString() } : {}),
      };
      if (!record) record = await svc.ConsuntivoFornitore.create(campi);
      const id = record.id;
      const daScrivere = { ...campi };
      if (azione === 'carica') daScrivere.righe_json = await valoreCampo(base44, 'ConsuntivoFornitore', id, 'righe_json', JSON.stringify(righe));
      daScrivere.esito_json = await valoreCampo(base44, 'ConsuntivoFornitore', id, 'esito_json', JSON.stringify(esitoCompleto));
      await svc.ConsuntivoFornitore.update(id, daScrivere);
      record = { ...record, ...daScrivere };
    }

    return Response.json({ consuntivo: record, ...esitoCompleto });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}
