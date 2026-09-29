import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { soloAmministratore, utenteCorrente } from "../../shared/permessi.ts";
import { valoreCampo, leggiCampo } from "../../shared/testoLungo.ts";
import { leggiTabellePrefattura } from "../../shared/prefattura.ts";
import { calcolaPassivaMese, MESI_PASSIVA } from "../../shared/passivaCalcolo.ts";
import {
  movimentiDelFornitore, confrontaConsuntivo, costoAttesoDallaPassiva,
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
    let righe = null;
    if (azione === 'carica') {
      const guardia = await soloAmministratore(base44);
      if (guardia.errore) return guardia.errore;
      const lette = leggiTabellePrefattura(body.tabelle || []);
      righe = (lette.righe || []).map(r => ({
        numero_fir: r.numero_fir || '', id_ordine: r.id_ordine || '',
        kg: Number(r.kg) || 0, importo: r.importo === null || r.importo === undefined ? null : Number(r.importo),
        giorno: r.giorno || '',
      }));
      if (!righe.length) {
        return Response.json({ error: `Nel file non ho trovato righe con un formulario o un numero d'ordine${lette.note && lette.note.length ? ': ' + lette.note.join('; ') : '.'}` }, { status: 400 });
      }
    } else if (record && record.righe_json) {
      righe = JSON.parse((await leggiCampo(base44, 'ConsuntivoFornitore', record, 'righe_json')) || '[]');
    }
    if (!righe) return Response.json({ error: 'Non ci sono righe da confrontare: carica il consuntivo.' }, { status: 400 });

    const { passiva, archivi } = await contoPassiva(svc, anno, mese, canale);
    const movimenti = movimentiDelFornitore(archivi, { fornitore, ruolo, anno, mese, canale });
    // Un chilo di tolleranza: i pesi si scrivono interi, e un arrotondamento nel
    // foglio del fornitore non e' una difformita'.
    const confronto = confrontaConsuntivo(righe, movimenti, { tolleranza_kg: 1 });
    const costo = costoAttesoDallaPassiva(passiva, fornitore, ruolo);
    const importoConsuntivo = body.importo_consuntivo !== undefined && body.importo_consuntivo !== null
      ? Number(body.importo_consuntivo)
      : (record && record.importo_consuntivo !== undefined && record.importo_consuntivo !== null ? Number(record.importo_consuntivo) : null);
    const esito = esitoConsuntivo({ confronto, costo, importo_consuntivo: importoConsuntivo });

    // Il conto congelato di quel mese, se c'e': si dice anche se il ricalcolo di
    // oggi si e' mosso, altrimenti congelare nasconderebbe i movimenti arrivati dopo.
    let congelato = null;
    const congelati = await svc.ChiusuraPassivaMese.filter({ anno, mese, canale }, '-congelato_il', 1);
    if (congelati && congelati.length) {
      const c = congelati[0];
      let contoAllora = null;
      try { contoAllora = JSON.parse((await leggiCampo(base44, 'ChiusuraPassivaMese', c, 'passiva_json')) || 'null'); } catch { /* resta il conto di oggi */ }
      const costoAllora = contoAllora ? costoAttesoDallaPassiva(contoAllora, fornitore, ruolo) : null;
      congelato = {
        congelato_il: c.congelato_il,
        congelato_da: c.congelato_da || '',
        importo_allora: costoAllora && costoAllora.trovato ? costoAllora.importo : null,
        importo_oggi: costo && costo.trovato ? costo.importo : null,
        cambiato: !!(costoAllora && costoAllora.trovato && costo && costo.trovato && Math.round(costoAllora.importo * 100) !== Math.round(costo.importo * 100)),
      };
    }

    const esitoCompleto = { confronto, costo, esito, congelato, testo: testoEsitoConsuntivo(confronto, esito) };

    // Si salva solo se c'e' un record e chi chiede e' l'amministratore: a tutti gli
    // altri il confronto si mostra e basta.
    if (user.role === 'admin') {
      const campi = {
        fornitore, ruolo, anno, mese, canale,
        quadra: confronto.quadra && esito.quadra_con_passiva !== false,
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
