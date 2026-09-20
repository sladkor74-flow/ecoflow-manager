// Qualifica fornitori: presenza e validita' dei documenti richiesti ai fornitori
// e al cliente contrattualizzati nell'anno.
//
// Il modulo e' puramente documentale. Non valuta cosa fanno i fornitori: controlla
// soltanto che i documenti richiesti ci siano, siano quelli giusti e siano validi.
//
// I soggetti di un anno si ricavano dalle movimentazioni di PFU di quello stesso
// anno, ordini terminati con trasporto concluso nell'anno. Dalle movimentazioni
// viene anche il ruolo, che serve solo a stabilire quali documenti chiedere:
//   raccolta              trasportatore delle primarie rete, ACI ed extra raccolta
//   trattamento           destinazione "Imp" delle primarie, destinazione delle
//                         secondarie
//   stoccaggio            destinazione "Stoc" delle primarie, stoccaggio di
//                         partenza delle secondarie
//   trasporto_secondaria  trasportatore delle secondarie
//   cliente               key account delle primarie, cioe' Ecotyre
//
// Le terziarie restano fuori: sono spedizioni dell'impianto verso le cementerie,
// e un impianto uscito dal contratto continua per mesi a spedire cio' che aveva
// in piazzale. Contarle faceva comparire INNOREC nel 2026. Restano fuori anche le
// societa' del gruppo, segnate come interne in anagrafica.
//
// Le inclusioni manuali coprono i due casi che le movimentazioni non vedono: un
// contratto firmato prima del primo viaggio e un soggetto da non qualificare pur
// comparendo nei dati.

import { fetchAll } from "./fetchAll.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";

export const RUOLI = ['raccolta', 'trasporto_secondaria', 'trattamento', 'stoccaggio', 'cliente'];

// Soglie dei promemoria di scadenza, in giorni. Ciascuna viene segnalata una volta.
export const SOGLIE_AVVISO = [90, 60, 30, 15, 7, 0];

// Ogni quanti giorni si ripete il promemoria di un problema non risolto.
export const RIPETIZIONE_GIORNI = 7;

// Gravita' dello stato di un requisito, dalla peggiore alla migliore.
const PESO_STATO = {
  scaduto: 6, non_conforme: 6, mancante: 5, in_scadenza: 4,
  da_verificare: 3, in_analisi: 2, facoltativo_mancante: 1, valido: 0,
};

// === date ===

export function oggiRoma() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

function soloData(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) ? s : null;
}

export function giorniTra(daData, aData) {
  const a = Date.UTC(+daData.slice(0, 4), +daData.slice(5, 7) - 1, +daData.slice(8, 10));
  const b = Date.UTC(+aData.slice(0, 4), +aData.slice(5, 7) - 1, +aData.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

export function aggiungiPeriodo(data, mesi, giorni) {
  const d = new Date(Date.UTC(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10)));
  if (mesi) d.setUTCMonth(d.getUTCMonth() + Number(mesi));
  if (giorni) d.setUTCDate(d.getUTCDate() + Number(giorni));
  return d.toISOString().slice(0, 10);
}

export function ruoliDaTesto(s) {
  return String(s || '').split(',').map(x => x.trim()).filter(Boolean);
}

export function leggiProblemi(doc) {
  if (!doc || !doc.problemi_json) return [];
  try {
    const p = JSON.parse(doc.problemi_json);
    return Array.isArray(p) ? p : [];
  } catch (_e) {
    return [];
  }
}

// === soggetti dell'anno ===

function pulisci(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

function nelAnno(r, anno) {
  if (String(r.stato || '').toLowerCase().trim() !== 'terminato') return false;
  if (!r.trasporto_finito_il) return false;
  const d = new Date(r.trasporto_finito_il);
  return !isNaN(d.getTime()) && d.getFullYear() === anno;
}

/**
 * Individua i soggetti da qualificare per l'anno.
 * Restituisce { soggetti, esclusi }: gli esclusi manualmente restano visibili
 * cosi' da poterli reincludere.
 */
export async function individuaSoggetti(base44, anno) {
  const annoNum = Number(anno);
  const svc = base44.asServiceRole.entities;
  const [rete, aci, extra, sec, fornitori, inclusioni] = await Promise.all([
    fetchAll(svc.PrimariaRete),
    fetchAll(svc.PrimariaAci),
    fetchAll(svc.ExtraRaccolta),
    fetchAll(svc.Secondaria),
    fetchAll(svc.Fornitore),
    fetchAll(svc.QualificaInclusione, { anno: annoNum }),
  ]);

  const anagrafica = new Map();
  const interni = new Set(['smoco']);
  for (const f of fornitori) {
    const k = normalizzaRagioneSociale(f.ragione_sociale);
    if (!k) continue;
    anagrafica.set(k, f);
    if (f.interno) interni.add(k);
  }

  const mappa = new Map();
  const aggiungi = (nome, ruolo) => {
    const n = pulisci(nome);
    if (!n) return;
    const k = normalizzaRagioneSociale(n);
    if (!k || interni.has(k)) return;
    if (!mappa.has(k)) mappa.set(k, { chiave: k, nomi: new Map(), ruoli: new Set(), origine: 'movimenti' });
    const s = mappa.get(k);
    s.ruoli.add(ruolo);
    s.nomi.set(n, (s.nomi.get(n) || 0) + 1);
  };

  for (const r of [...rete, ...aci, ...extra]) {
    if (!nelAnno(r, annoNum)) continue;
    const td = String(r.tipo_destinazione || '').toLowerCase().trim();
    aggiungi(r.trasportatore, 'raccolta');
    aggiungi(r.destinazione, td === 'stoc' ? 'stoccaggio' : 'trattamento');
    aggiungi(r.key_account, 'cliente');
  }
  for (const r of sec) {
    if (!nelAnno(r, annoNum)) continue;
    aggiungi(r.stoccaggio, 'stoccaggio');
    aggiungi(r.trasportatore, 'trasporto_secondaria');
    aggiungi(r.destinazione, 'trattamento');
  }

  // Inclusioni ed esclusioni manuali.
  const esclusi = [];
  for (const inc of inclusioni) {
    const k = inc.soggetto_chiave || normalizzaRagioneSociale(inc.soggetto_nome);
    if (!k) continue;
    if (inc.azione === 'escludi') {
      const s = mappa.get(k);
      esclusi.push({
        chiave: k,
        nome: s ? nomePreferito(s, anagrafica.get(k)) : pulisci(inc.soggetto_nome),
        motivo: inc.motivo || '',
        inclusione_id: inc.id,
      });
      mappa.delete(k);
    } else if (inc.azione === 'includi') {
      if (!mappa.has(k)) mappa.set(k, { chiave: k, nomi: new Map(), ruoli: new Set(), origine: 'manuale' });
      const s = mappa.get(k);
      const n = pulisci(inc.soggetto_nome);
      if (n) s.nomi.set(n, (s.nomi.get(n) || 0) + 1);
      for (const ruolo of ruoliDaTesto(inc.ruoli)) s.ruoli.add(ruolo);
      s.inclusione_id = inc.id;
      s.motivo_inclusione = inc.motivo || '';
    }
  }

  const soggetti = [...mappa.values()].map(s => {
    const f = anagrafica.get(s.chiave);
    return {
      chiave: s.chiave,
      nome: nomePreferito(s, f),
      ruoli: RUOLI.filter(r => s.ruoli.has(r)),
      origine: s.origine,
      inclusione_id: s.inclusione_id || null,
      motivo_inclusione: s.motivo_inclusione || '',
      fornitore_id: f ? f.id : null,
      piva: f ? (f.piva || '') : '',
      codice_fiscale: f ? (f.codice_fiscale || '') : '',
      email: f ? (f.email || '') : '',
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

  return { soggetti, esclusi };
}

// In anagrafica il nome e' curato a mano e ha la precedenza; altrimenti si usa
// la forma piu' completa comparsa nelle movimentazioni.
function nomePreferito(s, fornitore) {
  if (fornitore && fornitore.ragione_sociale) return pulisci(fornitore.ragione_sociale);
  let migliore = '';
  for (const n of s.nomi.keys()) if (n.length > migliore.length) migliore = n;
  return migliore || s.chiave;
}

// === stato dei requisiti ===

/**
 * Stato di un requisito: il documento piu' recente di quel tipo per il soggetto,
 * confrontato con la data di oggi e con le regole del catalogo.
 */
export function statoRequisito(tipo, doc, oggi) {
  const base = { scadenza: null, giorni: null, problemi: [] };
  if (!doc) {
    return { ...base, stato: tipo.obbligatorio === false ? 'facoltativo_mancante' : 'mancante' };
  }

  const problemi = leggiProblemi(doc);
  const scadenza = soloData(doc.data_scadenza_manuale) || soloData(doc.data_scadenza);
  const giorni = scadenza ? giorniTra(oggi, scadenza) : null;
  const esito = { scadenza, giorni, problemi };

  // Un'analisi ferma da piu' di dieci minuti, avviata o mai partita, e' stata
  // interrotta: il documento passa da verificare invece di restare in attesa.
  if (doc.analisi_stato === 'in_attesa' || doc.analisi_stato === 'in_corso') {
    const riferimento = doc.analisi_avviata_il || doc.created_date;
    const avvio = riferimento ? new Date(riferimento).getTime() : 0;
    const bloccata = avvio > 0 && Date.now() - avvio > 10 * 60 * 1000;
    if (!bloccata) return { ...esito, stato: 'in_analisi' };
    return { ...esito, stato: 'da_verificare', problemi: [...problemi, { gravita: 'attenzione', messaggio: "L'analisi automatica si e' interrotta: rilanciala o verifica il documento a mano." }] };
  }

  if (giorni !== null && giorni < 0) return { ...esito, stato: 'scaduto' };

  const bloccanti = problemi.filter(p => p.gravita === 'bloccante');
  if (bloccanti.length > 0 && !doc.verificato_manualmente) return { ...esito, stato: 'non_conforme' };

  const preavviso = typeof tipo.preavviso_giorni === 'number' ? tipo.preavviso_giorni : 60;
  if (giorni !== null && giorni <= preavviso) return { ...esito, stato: 'in_scadenza' };

  if (!doc.verificato_manualmente) {
    if (doc.analisi_stato === 'errore') return { ...esito, stato: 'da_verificare' };
    if (giorni === null && tipo.tipo_scadenza !== 'nessuna') return { ...esito, stato: 'da_verificare' };
  }

  return { ...esito, stato: 'valido' };
}

/**
 * Valuta tutti i requisiti di un soggetto e ne ricava lo stato complessivo.
 */
export function valutaSoggetto(soggetto, catalogo, documenti, oggi) {
  const applicabili = catalogo
    .filter(t => t.attivo !== false && ruoliDaTesto(t.si_applica_a).some(r => soggetto.ruoli.includes(r)))
    .sort((a, b) => (a.ordine ?? 100) - (b.ordine ?? 100) || String(a.nome).localeCompare(String(b.nome), 'it'));

  const propri = documenti.filter(d => d.soggetto_chiave === soggetto.chiave && d.stato !== 'sostituito');

  const requisiti = applicabili.map(t => {
    const doc = propri
      .filter(d => d.tipo_documento_id === t.id)
      .sort((a, b) => String(b.data_emissione || b.created_date || '').localeCompare(String(a.data_emissione || a.created_date || '')))[0] || null;
    return {
      tipo_id: t.id,
      tipo_nome: t.nome,
      categoria: t.categoria,
      obbligatorio: t.obbligatorio !== false,
      tipo_scadenza: t.tipo_scadenza,
      preavviso_giorni: t.preavviso_giorni,
      documento: doc ? {
        id: doc.id,
        file_nome: doc.file_nome,
        file_uri: doc.file_uri,
        data_emissione: doc.data_emissione,
        data_scadenza: doc.data_scadenza,
        data_scadenza_manuale: doc.data_scadenza_manuale,
        verificato_manualmente: !!doc.verificato_manualmente,
        analisi_stato: doc.analisi_stato,
        sintesi: doc.sintesi,
        richiesta_al_fornitore: doc.richiesta_al_fornitore,
        confidenza: doc.confidenza,
        errore_analisi: doc.errore_analisi,
        created_date: doc.created_date,
      } : null,
      ...statoRequisito(t, doc, oggi),
    };
  });

  const obbligatori = requisiti.filter(r => r.obbligatorio);
  const validi = obbligatori.filter(r => r.stato === 'valido' || r.stato === 'in_scadenza').length;
  const peggiore = requisiti.reduce((m, r) => Math.max(m, PESO_STATO[r.stato] ?? 0), 0);

  let stato = 'qualificato';
  if (requisiti.some(r => r.stato === 'scaduto' || r.stato === 'non_conforme')) stato = 'critico';
  else if (obbligatori.some(r => r.stato === 'mancante' || r.stato === 'da_verificare' || r.stato === 'in_analisi')) stato = 'da_completare';
  else if (requisiti.some(r => r.stato === 'in_scadenza')) stato = 'in_scadenza';

  const scadenze = requisiti.map(r => r.scadenza).filter(Boolean).sort();

  return {
    ...soggetto,
    requisiti,
    stato,
    gravita: peggiore,
    obbligatori_totali: obbligatori.length,
    obbligatori_validi: validi,
    prossima_scadenza: scadenze[0] || null,
  };
}

// Stati che richiedono un intervento e che quindi contano come alert.
export const STATI_ALERT = ['scaduto', 'non_conforme', 'mancante', 'in_scadenza', 'da_verificare'];

/**
 * Conta gli alert aperti e li salva nel riepilogo dell'anno.
 *
 * Il numero accanto alla voce del menu legge solo questo record: ricalcolarlo a
 * ogni pagina vorrebbe dire rileggere tutte le movimentazioni. Il riepilogo si
 * aggiorna ogni volta che il modulo calcola la situazione e a ogni controllo
 * giornaliero, che coglie anche i documenti scaduti durante la notte.
 */
export async function salvaRiepilogo(base44, anno, valutati) {
  const requisiti = valutati.flatMap(s => s.requisiti);
  const conta = (stato) => requisiti.filter(r => r.stato === stato).length;
  const dati = {
    anno: Number(anno),
    alert_aperti: requisiti.filter(r => STATI_ALERT.includes(r.stato)).length,
    soggetti_con_alert: valutati.filter(s => s.requisiti.some(r => STATI_ALERT.includes(r.stato))).length,
    scaduti: conta('scaduto'),
    non_conformi: conta('non_conforme'),
    mancanti: conta('mancante'),
    in_scadenza: conta('in_scadenza'),
    da_verificare: conta('da_verificare'),
    // Chi ha documenti scaduti o non conformi, per nome: la fatturazione passiva
    // lo legge da qui e avvisa prima di pagare, senza rifare tutta la valutazione.
    soggetti_critici: valutati
      .map(s => ({
        nome: s.nome || '', chiave: s.chiave || '',
        scaduti: s.requisiti.filter(r => r.stato === 'scaduto').map(r => r.tipo_nome),
        non_conformi: s.requisiti.filter(r => r.stato === 'non_conforme').map(r => r.tipo_nome),
      }))
      .filter(s => s.scaduti.length + s.non_conformi.length > 0),
    aggiornato_il: new Date().toISOString(),
  };
  const ent = base44.asServiceRole.entities.RiepilogoQualifica;
  const esistenti = await ent.filter({ anno: Number(anno) }, '-created_date', 5);
  if (esistenti.length > 0) {
    await ent.update(esistenti[0].id, dati);
    // Eventuali doppioni, nati da due calcoli contemporanei, si eliminano.
    for (const extra of esistenti.slice(1)) await ent.delete(extra.id);
  } else {
    await ent.create(dati);
  }
  return dati;
}

/**
 * Trasforma lo stato dei requisiti in eventi da segnalare via email.
 * Ogni evento ha una chiave stabile: serve a non ripetere lo stesso promemoria
 * ogni giorno. Una soglia di scadenza si segnala una sola volta; un problema
 * aperto torna ogni RIPETIZIONE_GIORNI giorni finche' non viene risolto.
 */
export function eventiDaSegnalare(valutati) {
  const eventi = [];
  for (const s of valutati) {
    for (const r of s.requisiti) {
      const doc = r.documento;
      const base = { soggetto: s.nome, soggetto_chiave: s.chiave, tipo: r.tipo_nome, scadenza: r.scadenza, giorni: r.giorni };
      if (r.stato === 'mancante') {
        eventi.push({ ...base, stato: r.stato, chiave: `mancante|${s.chiave}|${r.tipo_id}`, ripetibile: true });
      } else if (r.stato === 'scaduto' && doc) {
        eventi.push({ ...base, stato: r.stato, chiave: `scaduto|${doc.id}`, ripetibile: true });
      } else if (r.stato === 'non_conforme' && doc) {
        eventi.push({ ...base, stato: r.stato, chiave: `nonconforme|${doc.id}`, ripetibile: true, problemi: r.problemi.filter(p => p.gravita === 'bloccante'), richiesta: doc.richiesta_al_fornitore });
      } else if (r.stato === 'da_verificare' && doc) {
        eventi.push({ ...base, stato: r.stato, chiave: `verifica|${doc.id}`, ripetibile: true, problemi: r.problemi });
      } else if (r.stato === 'in_scadenza' && doc && r.giorni !== null) {
        // La soglia e' la piu' stretta gia' raggiunta: i giorni residui possono solo
        // calare, quindi le soglie piu' larghe non torneranno a scattare.
        const soglia = [...SOGLIE_AVVISO].sort((a, b) => a - b).find(v => r.giorni <= v);
        if (soglia !== undefined) {
          eventi.push({ ...base, stato: r.stato, chiave: `scadenza|${doc.id}|${soglia}`, ripetibile: false, soglia });
        }
      }
    }
  }
  return eventi;
}
