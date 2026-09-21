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
import { problemaTipoSbagliato } from "./tipiDocumento.ts";
import { annoRoma } from "./giornoItaliano.ts";

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

/**
 * I fornitori nominati uno per uno su una voce del catalogo.
 * Si accetta sia la forma { chiave, nome } sia la sola chiave scritta come testo.
 */
export function soggettiDelTipo(tipo) {
  const elenco = Array.isArray(tipo && tipo.solo_per_soggetti) ? tipo.solo_per_soggetti : [];
  return elenco
    .map(v => (typeof v === 'string'
      ? { chiave: normalizzaRagioneSociale(v), nome: v }
      : { chiave: v && (v.chiave || normalizzaRagioneSociale(v.nome)), nome: (v && v.nome) || '' }))
    .filter(v => v.chiave);
}

/**
 * Un documento e' richiesto a un soggetto quando la voce e' attiva e:
 * - ha dei fornitori nominati e il soggetto e' fra quelli (i ruoli non contano:
 *   le patenti degli autisti o la CQC si chiedono a quel trasportatore, non a
 *   tutti i trasportatori);
 * - oppure non ne ha e uno dei suoi ruoli coincide con quelli del soggetto.
 */
export function richiestoA(tipo, soggetto) {
  if (!tipo || tipo.attivo === false) return false;
  const nominati = soggettiDelTipo(tipo);
  if (nominati.length > 0) return nominati.some(n => n.chiave === soggetto.chiave);
  return ruoliDaTesto(tipo.si_applica_a).some(r => soggetto.ruoli.includes(r));
}

/**
 * I dati letti dal file, salvati dall'agente dentro analisi_json.
 */
export function letturaDi(doc) {
  if (!doc || !doc.analisi_json) return null;
  try {
    const j = JSON.parse(doc.analisi_json);
    return j && j.lettura ? j.lettura : null;
  } catch (_e) {
    return null;
  }
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

// L'anno e' quello del giorno italiano della fine trasporto: getFullYear leggeva
// il fuso del server, e un ritiro del 1 gennaio salvato a mezzanotte italiana
// (31/12 23:00Z) faceva entrare il trasportatore fra i soggetti dell'anno prima.
function nelAnno(r, anno) {
  if (String(r.stato || '').toLowerCase().trim() !== 'terminato') return false;
  return annoRoma(r.trasporto_finito_il) === anno;
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

  // Il controllo sul tipo si rifa' qui e non solo quando l'agente legge il file:
  // cosi' vale anche per i documenti analizzati prima che esistesse, senza
  // doverli rileggere tutti da capo.
  const salvati = leggiProblemi(doc);
  const sbagliato = problemaTipoSbagliato(tipo.nome, letturaDi(doc));
  const problemi = sbagliato && !salvati.some(p => p.messaggio === sbagliato.messaggio) ? [sbagliato, ...salvati] : salvati;
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
    // Il motivo del fallimento viaggia insieme allo stato: cosi arriva anche
    // nel promemoria via email, non solo sulla scheda del fornitore.
    if (doc.analisi_stato === 'errore') return { ...esito, stato: 'da_verificare', problemi: [...problemi, { gravita: 'attenzione', messaggio: 'La lettura automatica del file non ha funzionato' + (doc.errore_analisi ? ': ' + doc.errore_analisi : '.') + ' Controlla il file a mano.' }] };
    if (giorni === null && tipo.tipo_scadenza !== 'nessuna') return { ...esito, stato: 'da_verificare' };
  }

  return { ...esito, stato: 'valido' };
}

/**
 * Valuta tutti i requisiti di un soggetto e ne ricava lo stato complessivo.
 */
export function valutaSoggetto(soggetto, catalogo, documenti, oggi) {
  const applicabili = catalogo
    .filter(t => richiestoA(t, soggetto))
    .sort((a, b) => (a.ordine ?? 100) - (b.ordine ?? 100) || String(a.nome).localeCompare(String(b.nome), 'it'));

  const propri = documenti.filter(d => d.soggetto_chiave === soggetto.chiave && d.stato !== 'sostituito');

  const requisiti = applicabili.map(t => {
    const doc = propri
      .filter(d => d.tipo_documento_id === t.id)
      .sort((a, b) => String(b.data_emissione || b.created_date || '').localeCompare(String(a.data_emissione || a.created_date || '')))[0] || null;
    const nominati = soggettiDelTipo(t);
    return {
      tipo_id: t.id,
      tipo_nome: t.nome,
      categoria: t.categoria,
      // vero quando il documento e' stato chiesto a questo fornitore per nome
      nominale: nominati.length > 0,
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

/**
 * Errori di impostazione del catalogo: voci che non chiederanno mai niente a
 * nessuno. Senza questo controllo un documento intestato a un fornitore scritto
 * male, o a uno che quest'anno non ha lavorato, resterebbe muto per sempre e
 * sembrerebbe tutto a posto.
 */
export function anomalieCatalogo(catalogo, soggetti, anno) {
  const presenti = new Map((soggetti || []).map(s => [s.chiave, s.nome]));
  const fuori = [];
  for (const t of catalogo || []) {
    if (t.attivo === false) continue;
    const nominati = soggettiDelTipo(t);
    const ruoli = ruoliDaTesto(t.si_applica_a);

    if (nominati.length === 0) {
      if (ruoli.length === 0) {
        fuori.push({
          tipo_id: t.id, tipo_nome: t.nome, gravita: 'errore',
          messaggio: `"${t.nome}" non e' richiesto a nessuno: non ha ne' ruoli ne' fornitori indicati.`,
        });
      }
      continue;
    }

    const assenti = nominati.filter(n => !presenti.has(n.chiave));
    if (assenti.length > 0) {
      const nomi = assenti.map(n => n.nome || n.chiave).join(', ');
      fuori.push({
        tipo_id: t.id, tipo_nome: t.nome, gravita: 'errore',
        soggetti: assenti.map(n => n.chiave),
        messaggio: `"${t.nome}" e' richiesto a ${nomi}, che nel ${anno} non risulta fra i soggetti da qualificare: il documento non verra' mai chiesto. Controlla la ragione sociale oppure includi il soggetto nell'anno.`,
      });
    }
    if (ruoli.length > 0) {
      fuori.push({
        tipo_id: t.id, tipo_nome: t.nome, gravita: 'attenzione',
        messaggio: `"${t.nome}" e' intestato a fornitori precisi: i ruoli indicati non contano e il documento non viene chiesto agli altri soggetti di quei ruoli.`,
      });
    }
  }
  return fuori;
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
export async function salvaRiepilogo(base44, anno, valutati, anomalie) {
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
    // Errori di impostazione del catalogo: la dashboard li legge da qui senza
    // rifare tutta la valutazione.
    anomalie_catalogo: (anomalie || []).filter(a => a.gravita === 'errore').length,
    anomalie_catalogo_testo: [...new Set((anomalie || []).filter(a => a.gravita === 'errore').map(a => a.tipo_nome))].join(', ').slice(0, 300),
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
