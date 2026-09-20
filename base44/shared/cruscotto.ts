// Il cruscotto: che cosa richiede attenzione, in un posto solo.
//
// Ogni modulo ha le sue anomalie nella sua pagina, e per sapere se c'era qualcosa
// da fare bisognava aprirle tutte. Qui si raccolgono, leggendo solo archivi
// piccoli (alert, registro dei caricamenti, ordini aperti, documenti di
// fatturazione, prefatture, riepilogo della qualifica, target, richieste del
// consorzio): niente che costi quanto un ricalcolo. Le anomalie di prezzo della
// fatturazione arrivano a parte, dal margine, che la pagina chiede dopo.
//
// Funzioni pure: ricevono gli elenchi gia' letti. Rete, ACI ed extra raccolta
// restano separati anche qui.
import { giornoRoma } from "./giornoItaliano.ts";
import { divergenzeTargetImpianti, testoDivergenza } from "./targetImpianti.ts";

export const MESI_CRUSCOTTO = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
// Oltre questi giorni senza un caricamento riuscito un archivio si considera non aggiornato.
export const GIORNI_DATI_VECCHI = 10;
const FINESTRA_IN_CORSO_MS = 10 * 60 * 1000;

const giorniFra = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
const istante = (v) => new Date(String(v || '').replace(/(Z|[+-]\d{2}:?\d{2})?$/, 'Z')).getTime();

/** Da quanto aspettano gli ordini aperti: entro 30, 31-60, oltre 60 giorni, e il piu' vecchio. */
export function etaArretrato(ordini, oggi) {
  const eta = { totale: 0, entro_30: 0, da_31_a_60: 0, oltre_60: 0, kg_oltre_60: 0, senza_data: 0, piu_vecchio: null };
  for (const r of ordini || []) {
    eta.totale++;
    const g = giornoRoma(r.ordine_immesso_il);
    if (!g) { eta.senza_data++; continue; }
    const giorni = giorniFra(g, oggi);
    if (giorni <= 30) eta.entro_30++; else if (giorni <= 60) eta.da_31_a_60++; else { eta.oltre_60++; eta.kg_oltre_60 += Number(r.peso_stimato) || 0; }
    if (!eta.piu_vecchio || giorni > eta.piu_vecchio.giorni) eta.piu_vecchio = { giorni, id_ordine: r.id_ordine || '', ragione_sociale: r.ragione_sociale || r.punto_di_raccolta || '', provincia: r.provincia || '', immesso_il: g, partner_operativo: r.partner_operativo || '' };
  }
  return eta;
}

/** L'ultimo caricamento riuscito di ogni tipo di file, e i caricamenti rimasti a meta'. */
export function statoCaricamenti(logs, oggi, adessoMs, tipi) {
  const perTipo = new Map();
  const interrotti = [];
  for (const l of [...(logs || [])].sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)))) {
    if (l.esito === 'in_corso') { if (adessoMs - istante(l.created_date) > FINESTRA_IN_CORSO_MS) interrotti.push({ tipo_file: l.tipo_file, nome_file: l.nome_file || '', utente: l.utente || '', il: giornoRoma(l.created_date), ms: istante(l.created_date) }); continue; }
    if (l.esito !== 'successo' || perTipo.has(l.tipo_file)) continue;
    const il = giornoRoma(l.created_date);
    perTipo.set(l.tipo_file, { tipo_file: l.tipo_file, nome_file: l.nome_file || '', utente: l.utente || '', il, giorni_fa: il ? giorniFra(il, oggi) : null, ms: istante(l.created_date) });
  }
  // Un caricamento interrotto e poi rifatto non e' piu' un problema
  const ancoraAperti = interrotti.filter(i => { const u = perTipo.get(i.tipo_file); return !u || u.ms < i.ms; });
  return {
    archivi: (tipi || [...perTipo.keys()]).map(t => perTipo.get(t) || { tipo_file: t, nome_file: '', utente: '', il: null, giorni_fa: null }),
    interrotti: ancoraAperti,
  };
}

/** Lo stato dei mesi della fatturazione attiva: elaborato, prefattura caricata, chiuso. Solo i mesi gia' finiti. */
export function statoMesiAttiva(documenti, prefatture, anno, oggi) {
  const annoNum = Number(anno);
  const ultimoFinito = Number(oggi.slice(0, 4)) > annoNum ? 11 : Number(oggi.slice(5, 7)) - 2;   // il mese in corso non e' ancora da fatturare
  const mesi = [];
  for (let m = 0; m <= ultimoFinito; m++) {
    const nome = MESI_CRUSCOTTO[m];
    const docs = (documenti || []).filter(d => d.tipo === 'ATTIVA' && Number(d.anno) === annoNum && d.mese === nome && !d.superato && d.stato !== 'bozza');
    const stati = [...new Set(docs.map(d => d.stato))];
    mesi.push({
      mese: nome,
      elaborato: docs.length > 0,
      stato: !docs.length ? 'da elaborare' : stati.length === 1 ? stati[0] : stati.join(' / '),
      chiuso: docs.length > 0 && docs.every(d => d.stato === 'chiusa'),
      prefattura: (prefatture || []).some(p => Number(p.anno) === annoNum && p.mese === nome && !p.superata),
    });
  }
  return mesi;
}

const GRAVITA = { critico: 0, attenzione: 1, info: 2 };

// Le regole degli alert sono salvate col loro codice (REGOLA_SCOSTAMENTO_TARGET):
// a video si leggono come parole, tenendo maiuscole le sigle.
const SIGLE = new Set(['SLA', 'ACI', 'FIR', 'PFU', 'PDR', 'ECT']);
export function nomeRegola(v) {
  const t = String(v || '').trim();
  if (!/^REGOLA_/.test(t)) return t;
  const parole = t.replace(/^REGOLA_/, '').split('_').filter(Boolean).map(p => (SIGLE.has(p) ? p : p.toLowerCase()));
  const frase = parole.join(' ');
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/**
 * L'elenco unico delle cose da gestire. Ogni voce: { area, gravita, titolo,
 * dettaglio, link }. dati: { oggi, adessoMs, anno, alertAperti, uploadLogs,
 * tipiFile, assegnatiRete, assegnatiAci, documenti, prefatture, riepilogoQualifica,
 * giacenzeSito, impiantiTarget, richiesteEct }.
 */
export function cruscotto(dati) {
  const { oggi, anno } = dati;
  const voci = [];
  const voce = (area, gravita, titolo, dettaglio, link) => voci.push({ area, gravita, titolo, dettaglio, link });

  // Alert aperti, per gravita' e per regola
  const alert = { totale: 0, critici: 0, warning: 0, info: 0, per_regola: [] };
  const perRegola = new Map();
  for (const a of dati.alertAperti || []) {
    alert.totale++;
    if (a.severita === 'critico') alert.critici++; else if (a.severita === 'warning') alert.warning++; else alert.info++;
    const k = nomeRegola(a.regola_nome) || a.titolo || 'Senza regola';
    perRegola.set(k, (perRegola.get(k) || 0) + 1);
  }
  alert.per_regola = [...perRegola.entries()].map(([regola, quanti]) => ({ regola, quanti })).sort((a, b) => b.quanti - a.quanti).slice(0, 8);
  if (alert.critici > 0) voce('Alert', 'critico', `${alert.critici} alert critici aperti`, alert.per_regola.slice(0, 3).map(r => `${r.regola} (${r.quanti})`).join(' · '), '/alert-engine');
  else if (alert.totale > 0) voce('Alert', 'attenzione', `${alert.totale} alert aperti`, alert.per_regola.slice(0, 3).map(r => `${r.regola} (${r.quanti})`).join(' · '), '/alert-engine');

  // Caricamenti: interrotti e dati vecchi
  const caricamenti = statoCaricamenti(dati.uploadLogs, oggi, dati.adessoMs, dati.tipiFile);
  for (const i of caricamenti.interrotti) voce('Caricamento dati', 'critico', `Caricamento interrotto: ${i.tipo_file}`, `Avviato${i.utente ? ` da ${i.utente}` : ''} il ${i.il.split('-').reverse().join('/')} e mai concluso: l'archivio può essere vuoto o incompleto. Ricarica il file.`, '/caricamento-dati');
  for (const a of caricamenti.archivi) {
    if (a.il === null) voce('Caricamento dati', 'attenzione', `Mai caricato: ${a.tipo_file}`, 'Nel registro non c\'è nessun caricamento riuscito di questo file.', '/caricamento-dati');
    else if (a.giorni_fa > GIORNI_DATI_VECCHI) voce('Caricamento dati', 'attenzione', `${a.tipo_file}: dati di ${a.giorni_fa} giorni fa`, `Ultimo caricamento riuscito il ${a.il.split('-').reverse().join('/')}${a.nome_file ? ` (${a.nome_file})` : ''}. I numeri di questo archivio sono fermi a quel giorno.`, '/caricamento-dati');
  }

  // Arretrato, per canale
  const arretrato = { RETE: etaArretrato(dati.assegnatiRete, oggi), ACI: etaArretrato(dati.assegnatiAci, oggi) };
  for (const [canale, e] of Object.entries(arretrato)) {
    if (e.oltre_60 > 0) voce('Arretrato', 'attenzione', `${canale === 'RETE' ? 'Rete' : 'ACI'}: ${e.oltre_60} ordini aperti da oltre 60 giorni`, `Su ${e.totale} aperti; il più vecchio da ${e.piu_vecchio.giorni} giorni (${e.piu_vecchio.id_ordine}, ${e.piu_vecchio.ragione_sociale}).`, canale === 'RETE' ? '/assegnati' : '/assegnati-aci');
  }

  // Fatturazione attiva: mesi finiti e non ancora elaborati, o senza prefattura
  const mesiAttiva = statoMesiAttiva(dati.documenti, dati.prefatture, anno, oggi);
  const daElaborare = mesiAttiva.filter(m => !m.elaborato).map(m => m.mese);
  const senzaPrefattura = mesiAttiva.filter(m => m.elaborato && !m.chiuso && !m.prefattura).map(m => m.mese);
  if (daElaborare.length) voce('Fatturazione attiva', 'attenzione', `${daElaborare.length} ${daElaborare.length === 1 ? 'mese finito non ancora elaborato' : 'mesi finiti non ancora elaborati'}`, daElaborare.join(', '), '/fatturazione');
  if (senzaPrefattura.length) voce('Fatturazione attiva', 'info', `Prefattura Ecotyre non caricata: ${senzaPrefattura.join(', ')}`, 'Il confronto con la prefattura si fa prima di esportare.', '/fatturazione');

  // Qualifica dei fornitori
  const q = dati.riepilogoQualifica || null;
  if (q && (Number(q.scaduti) > 0 || Number(q.non_conformi) > 0)) voce('Qualifica fornitori', 'critico', `${Number(q.scaduti) || 0} documenti scaduti, ${Number(q.non_conformi) || 0} non conformi`, (q.soggetti_critici || []).slice(0, 5).map(s => s.nome).join(', '), '/qualifica-fornitori');
  if (q && Number(q.in_scadenza) > 0) voce('Qualifica fornitori', 'info', `${q.in_scadenza} documenti in scadenza`, '', '/qualifica-fornitori');
  // Un documento intestato a un fornitore che non risulta non lo chiede nessuno:
  // e' un errore silenzioso, quindi va detto qui.
  if (q && Number(q.anomalie_catalogo) > 0) voce('Qualifica fornitori', 'critico', Number(q.anomalie_catalogo) === 1 ? 'Un documento del catalogo non verrà mai chiesto a nessuno' : `${q.anomalie_catalogo} documenti del catalogo non verranno mai chiesti a nessuno`, q.anomalie_catalogo_testo || '', '/qualifica-fornitori');

  // Target dell'impianto diverso fra Giacenze e Target & Status
  for (const d of divergenzeTargetImpianti(dati.giacenzeSito, dati.impiantiTarget, anno)) voce('Target', 'critico', `Target divergente: ${d.impianto}`, testoDivergenza(d), '/giacenze');

  // Richieste del consorzio: scadute e ancora aperte, o ritirate e da confermare
  let ectScadute = 0, ectDaConfermare = 0;
  for (const r of dati.richiesteEct || []) {
    if (r.esito === 'da_confermare') ectDaConfermare++;
    else if (r.esito === 'aperta' && r.scadenza && String(r.scadenza).slice(0, 10) < oggi) ectScadute++;
  }
  if (ectScadute) voce('Richieste ECT', 'critico', `${ectScadute} richieste del consorzio oltre il termine`, 'Ritiri chiesti per email da Ecotyre e non ancora evasi alla data indicata.', '/todo');
  if (ectDaConfermare) voce('Richieste ECT', 'info', `${ectDaConfermare} richieste risultano ritirate e aspettano la tua spunta`, '', '/todo');

  voci.sort((a, b) => GRAVITA[a.gravita] - GRAVITA[b.gravita] || a.area.localeCompare(b.area, 'it'));
  return { oggi, anno: Number(anno), da_gestire: voci, alert, caricamenti, arretrato, mesi_attiva: mesiAttiva };
}
