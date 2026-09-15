// Strumenti del modulo Verifiche: settimane, lettura dei file caricati ed
// esportazione in Excel dell'esito.

import { formatTonnellate, formatKg, formatIntero, dataServer } from '@/lib/utils';

export const GIORNI_CONSERVAZIONE = 40;

const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

// === settimane: stessa numerazione ISO del gestionale e del foglio Excel ===

function utc(ymd) {
  return new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)));
}

export function oggiRoma() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

export function aggiungiGiorni(ymd, giorni) {
  const d = utc(ymd);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

export function settimanaIso(ymd) {
  const d = utc(ymd);
  const giorno = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - giorno);
  const anno = d.getUTCFullYear();
  return { anno, settimana: Math.ceil(((d.getTime() - Date.UTC(anno, 0, 1)) / 86400000 + 1) / 7) };
}

export function intervalloSettimana(anno, settimana) {
  const gen4 = new Date(Date.UTC(anno, 0, 4));
  const giorno = gen4.getUTCDay() || 7;
  gen4.setUTCDate(gen4.getUTCDate() - giorno + 1 + (settimana - 1) * 7);
  const lunedi = gen4.toISOString().slice(0, 10);
  const domenica = aggiungiGiorni(lunedi, 6);
  const primo = `${anno}-01-01`, ultimo = `${anno}-12-31`;
  return { inizio: lunedi < primo ? primo : lunedi, fine: domenica > ultimo ? ultimo : domenica };
}

export function settimaneNellAnno(anno) {
  const s = settimanaIso(`${anno}-12-31`);
  return s.anno === anno ? s.settimana : settimanaIso(`${anno}-12-24`).settimana;
}

export function descriviIntervallo({ inizio, fine }) {
  const g = (d) => `${+d.slice(8, 10)} ${MESI_BREVI[+d.slice(5, 7) - 1]}`;
  return `${g(inizio)} – ${g(fine)} ${fine.slice(0, 4)}`;
}

export function dataIt(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}

export function tonnellate(kg) {
  return formatTonnellate((Number(kg) || 0) / 1000);
}

// === file caricati ===

export function tipoDiFile(file) {
  const nome = String(file.name || '').toLowerCase();
  if (/\.(xlsx|xlsm|xls|ods)$/.test(nome)) return 'excel';
  if (/\.csv$/.test(nome)) return 'csv';
  if (/\.pdf$/.test(nome) || file.type === 'application/pdf') return 'pdf';
  if (/\.(png|jpe?g|webp)$/.test(nome) || /^image\//.test(file.type || '')) return 'immagine';
  return null;
}

// === registro di carico e scarico ===
// Alcuni impianti (es. Irigom) non mandano un report ma il loro registro di carico
// e scarico di tutto l'anno: un foglio con una riga per movimento, i pesi divisi in
// colonne per canale (libero mercato, Ecopneus, Ecotyre, ACI...) e classe, e una
// riga di gruppi sopra le intestazioni. Se ne ricava un report della sola settimana
// con i carichi Ecotyre e ACI, gli unici che il gestionale conosce.

const testoIntestazione = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

function dataRegistro(XLSX, v) {
  if (typeof v === 'number' && v > 20000) {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null;
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** Report della settimana ricavato da un registro di carico e scarico, o null se il file non lo e'. */
function reportDaRegistro(XLSX, wb, periodo) {
  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome];
    if (!ws || !ws['!ref']) continue;
    const righe = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: true, defval: '' });
    for (let h = 1; h < Math.min(righe.length, 6); h++) {
      const intest = (righe[h] || []).map(testoIntestazione);
      const trova = (re) => intest.findIndex(x => re.test(x));
      const col = {
        data: trova(/^data$/i), ticket: trova(/bolla|ticket/i), produttore: trova(/^produttore$/i), trasportatore: trova(/^trasportatore$/i),
        destinatario: trova(/^destinatario$/i), intermediario: trova(/^intermediario$/i), fir: trova(/^n(r|um)?\.?\s*fir$/i),
      };
      if (col.fir < 0 || col.produttore < 0 || col.destinatario < 0 || col.data < 0) continue;
      // Gruppi della riga sopra: ogni gruppo va fino al successivo.
      const gruppi = (righe[h - 1] || []).map(testoIntestazione);
      const inizioGruppi = gruppi.map((g, i) => (g && !/^\d+$/.test(g) ? i : -1)).filter(i => i >= 0);
      const campata = (i) => { const prossimo = inizioGruppi.find(x => x > i); return [i, (prossimo ?? intest.length) - 1]; };
      const iEcotyre = gruppi.findIndex(g => /ecotyre/i.test(g));
      if (iEcotyre < 0) continue;
      const classi = [];
      const [e0, e1] = campata(iEcotyre);
      for (let c = e0; c <= e1; c++) if (/^(P|M|G ?1|G ?2|G)$/i.test(intest[c])) classi.push({ c, classe: intest[c].replace(/\s+/g, '').toUpperCase() });
      const iAci = gruppi.findIndex(g => /^aci$/i.test(g));
      if (iAci >= 0) {
        const [a0, a1] = campata(iAci);
        for (let c = a0; c <= a1; c++) if (/ingress/i.test(intest[c])) { classi.push({ c, classe: 'ACI' }); break; }
      }
      if (!classi.length) continue;

      const uscita = [['Data (ingresso in impianto)', 'Nr. ordine o ticket', 'Produttore', 'Trasportatore', 'Destinatario', 'Intermediario', 'Nr. FIR', 'Classe', 'Peso netto (kg)']];
      for (let i = h + 1; i < righe.length; i++) {
        const r = righe[i] || [];
        const data = dataRegistro(XLSX, r[col.data]);
        if (!data || (periodo && (data < periodo.inizio || data > periodo.fine))) continue;
        const pesi = classi.map(k => ({ ...k, kg: Number(r[k.c]) || 0 })).filter(k => k.kg > 0);
        if (!pesi.length) continue;
        const principale = pesi.reduce((a, b) => (b.kg > a.kg ? b : a));
        const valore = (k) => (col[k] >= 0 ? testoIntestazione(r[col[k]]) : '');
        uscita.push([data, valore('ticket'), valore('produttore'), valore('trasportatore'), valore('destinatario'), valore('intermediario'), valore('fir'), principale.classe, pesi.reduce((s, k) => s + k.kg, 0)]);
      }
      return { nome: `${nome} (registro: carichi Ecotyre e ACI${periodo ? ` dal ${periodo.inizio} al ${periodo.fine}` : ''})`, riga_iniziale: 0, righe: uscita, registro: true };
    }
  }
  return null;
}

// Apre un Excel o un CSV nel browser. Il file non viene caricato da nessuna
// parte: al backend arrivano solo le celle. periodo { inizio, fine } serve per i
// registri di carico e scarico, da cui si prende la sola settimana verificata.
export async function leggiTabelleDaFile(file, periodo = null) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const csv = tipoDiFile(file) === 'csv';
  // Solo i valori: senza testo formattato, HTML e formule un file grande si apre molto prima.
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, raw: csv, cellText: false, cellHTML: false, cellFormula: false });
  const registro = csv ? null : reportDaRegistro(XLSX, wb, periodo);
  if (registro) {
    if (registro.righe.length < 2) throw new Error(`Il file è un registro di carico e scarico, ma non contiene carichi Ecotyre o ACI${periodo ? ` tra il ${periodo.inizio} e il ${periodo.fine}` : ''}.`);
    const { registro: _registro, ...tabella } = registro;
    return [tabella];
  }
  const tabelle = [];
  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome];
    if (!ws || !ws['!ref']) continue;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const righe = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: true, defval: '' });
    while (righe.length && !righe[righe.length - 1].some(c => c !== '')) righe.pop();
    if (righe.length === 0) continue;
    const inizi = inizioTabelle(righe);
    inizi.forEach((da, k) => {
      const a = k + 1 < inizi.length ? inizi[k + 1] : righe.length;
      tabelle.push({ nome: k === 0 ? nome : `${nome} (tabella ${k + 1})`, riga_iniziale: range.s.r + da, righe: righe.slice(da, Math.min(a, da + 5000)) });
    });
  }
  return tabelle;
}

// Un foglio puo' contenere piu' tabelle una sotto l'altra, per esempio gli ingressi
// e poi le uscite con altre colonne: dove le intestazioni si ripetono comincia una
// nuova tabella, con l'eventuale titolo della riga sopra.
function inizioTabelle(righe) {
  const testi = (r) => (r || []).map(c => (typeof c === 'string' ? c.replace(/\s+/g, ' ').trim().toLowerCase() : '')).filter(t => t && !/^[\d.,\s]+$/.test(t));
  // L'intestazione e' la riga con piu' testi tra le prime quindici.
  let h = -1;
  for (let i = 0; i < Math.min(righe.length, 15); i++) if (testi(righe[i]).length >= 3 && (h < 0 || testi(righe[i]).length > testi(righe[h]).length)) h = i;
  if (h < 0) return [0];
  const intestazione = new Set(testi(righe[h]));
  const inizi = [0];
  for (let i = h + 1; i < righe.length && inizi.length < 10; i++) {
    const uguali = [...new Set(testi(righe[i]))].filter(t => intestazione.has(t)).length;
    if (uguali < Math.max(3, Math.ceil(intestazione.size / 2))) continue;
    const titolo = i - 1 > inizi[inizi.length - 1] && (righe[i - 1] || []).filter(c => c !== '').length === 1;
    inizi.push(titolo ? i - 1 : i);
  }
  return inizi;
}

export function fileInBase64(file) {
  return new Promise((risolvi, rifiuta) => {
    const lettore = new FileReader();
    lettore.onload = () => risolvi(String(lettore.result).split(',')[1] || '');
    lettore.onerror = () => rifiuta(lettore.error);
    lettore.readAsDataURL(file);
  });
}

// === esiti ===

/** "riga 12" o, se il report ha piu' fogli, "SECONDARIE, riga 12". */
export function rigaReport(e) {
  return e && e.foglio ? `${String(e.foglio).trim()}, riga ${e.n}` : `riga ${e && e.n}`;
}

/** Come e' stato letto un Excel: uno o piu' fogli con le rispettive colonne. */
export function descriviLettura(lettura) {
  const unita = (u) => (u === 't' ? 'tonnellate' : 'chilogrammi');
  const colonne = (c) => (c ? Object.entries(c).map(([k, x]) => `${k} = ${x}`).join(', ') : '');
  const fogli = Array.isArray(lettura.fogli) && lettura.fogli.length
    ? lettura.fogli
    : [{ foglio: lettura.foglio, prima_riga_dati: lettura.prima_riga_dati, unita: lettura.unita, colonne: lettura.colonne }];
  return fogli.map(f => `Foglio "${f.foglio}"${f.contenuto ? ` (${f.contenuto.replace(/_/g, ' ')})` : ''}, dati dalla riga ${f.prima_riga_dati}, pesi in ${unita(f.unita)}${f.colonne ? '. Colonne: ' + colonne(f.colonne) : ''}.`);
}

export function segnalazioni(v) {
  if (!v) return 0;
  if (v.anomalie != null) return v.anomalie;
  return (v.con_discrepanze || 0) + (v.non_trovate || 0) + (v.duplicate || 0) + (v.assenti_nel_report || 0);
}

// === sintesi per l'impianto ===
// Specchio delle regole di base44/shared/reportSettimanali.ts: le verifiche salvate
// prima delle gravita' e della quadratura si ricostruiscono dai messaggi.

const GRAVITA_CAMPO = { produttore: 'osservazione', destinatario: 'osservazione', trasportatore: 'osservazione' };

export function gravita(d) {
  if (d.gravita) return d.gravita;
  if (/errato nel gestionale/i.test(d.messaggio)) return 'rettifica';
  if (/non riguarda|codice produttore/i.test(d.messaggio)) return 'anomalia';
  return GRAVITA_CAMPO[d.campo] || 'anomalia';
}

const ACCENTI = { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' };

/** Messaggio della verifica in forma adatta all'impianto: "registrato" invece di "gestionale", accenti veri. */
export function testoPerImpianto(messaggio) {
  return String(messaggio || '')
    .replace(/Nel gestionale e' /g, 'Registrato: ')
    .replace(/nel gestionale e' /g, 'registrato: ')
    .replace(/Nel gestionale il trasporto/g, 'Il trasporto registrato')
    .replace(/Nel gestionale questo formulario non riguarda/g, 'Il formulario registrato non riguarda')
    .replace(/Formulario errato nel gestionale/g, 'Formulario errato nei dati registrati')
    .replace(/nel gestionale il trasporto/g, 'il trasporto registrato')
    .replace(/nel gestionale/g, 'nei dati registrati')
    .replace(/non presente nel gestionale/g, 'non registrato')
    .replace(/, gestionale /g, ', registrato ')
    .replace(/gestionale/g, 'dati registrati')
    .replace(/\b([a-z]*?)([aeiou])'(?=[\s.,;:)]|$)/g, (_m, radice, v) => radice + ACCENTI[v]);
}

// '11 nel report, 11 registrati; differenze: Ingressi primaria · rete +1, Uscite secondaria · rete -1'
function dettaglioPerTipo(quadratura, report, registrati, formato) {
  const tot = (k) => quadratura.reduce((t, q) => t + (q[k] || 0), 0);
  const diverse = quadratura.filter(q => q[report] !== q[registrati])
    .map(q => `${q.nome} ${q[report] > q[registrati] ? '+' : '-'}${formato(Math.abs(q[report] - q[registrati]))}`);
  return `${formato(tot(report))} nel report, ${formato(tot(registrati))} registrati${diverse.length ? '; differenze: ' + diverse.join(', ') : ''}`;
}

const ETICHETTA_CAMPO = {
  fir: 'Numero di formulario', kg: 'Peso effettivo', fine: 'Data di fine trasporto', inizio: 'Data di inizio trasporto',
  classe: 'Classe PFU', produttore: 'Produttore', destinatario: 'Destinatario', trasportatore: 'Trasportatore',
};

/**
 * Tutto quello che serve per comunicare l'esito all'impianto: quadratura di
 * formulari e pesi, controlli eseguiti, anomalie, osservazioni, rettifiche,
 * formulari mancanti e in piu', conformita' piena o parziale.
 */
export function sintesiVerifica(v, esito) {
  const esiti = esito.esiti || [];
  const assenti = esito.assenti || [];
  const usciteNonRiportate = esito.uscite_non_riportate || [];
  const escluse = esito.escluse || [];
  const tipoRiga = (e) => e.tipo || e.tipo_presunto || 'ingresso';
  const somma = (lista, kg) => lista.reduce((t, x) => t + (Number(kg(x)) || 0), 0);

  const quadratura = (esito.quadratura || [
    { tipo: 'ingresso', nome: 'Ingressi', formulari_gestionale: v.ingressi_gestionale || 0, kg_gestionale: v.peso_ingressi_kg || 0 },
    { tipo: 'uscita', nome: 'Uscite', formulari_gestionale: v.uscite_gestionale || 0, kg_gestionale: v.peso_uscite_kg || 0 },
  ].map(q => {
    const righe = esiti.filter(e => tipoRiga(e) === q.tipo);
    return { ...q, formulari_report: righe.length, kg_report: somma(righe, e => e.report.kg) };
  })).map(q => ({ ...q, quadra: q.formulari_report === q.formulari_gestionale && q.kg_report === q.kg_gestionale }));
  // Tutte le movimentazioni previste (per il PDF) e quelle con almeno un formulario (per la pagina).
  const categorie = quadratura;
  const righeQuadratura = quadratura.filter(q => q.formulari_report || q.formulari_gestionale);
  const totale = righeQuadratura.reduce((t, q) => ({
    tipo: 'totale', nome: 'Totale', formulari_report: t.formulari_report + q.formulari_report, formulari_gestionale: t.formulari_gestionale + q.formulari_gestionale,
    kg_report: t.kg_report + q.kg_report, kg_gestionale: t.kg_gestionale + q.kg_gestionale,
  }), { tipo: 'totale', nome: 'Totale', formulari_report: 0, formulari_gestionale: 0, kg_report: 0, kg_gestionale: 0 });
  totale.quadra = totale.formulari_report === totale.formulari_gestionale && totale.kg_report === totale.kg_gestionale;

  // Voci riga per riga, divise per gravita'.
  const voci = { anomalia: [], osservazione: [], rettifica: [] };
  for (const e of esiti) {
    if (e.esito === 'non_trovata') continue;
    for (const d of (e.discrepanze || [])) {
      const g = e.esito === 'duplicata' && d.campo === 'fir' && /duplicata/i.test(d.messaggio) ? 'anomalia' : gravita(d);
      const etichetta = /duplicata/i.test(d.messaggio) ? 'Riga duplicata'
        : /non riguarda/i.test(d.messaggio) ? 'Formulario di un altro impianto'
          : /settimana \d+ e non in quella verificata/i.test(d.messaggio) ? 'Settimana di competenza'
            : ETICHETTA_CAMPO[d.campo] || d.campo;
      voci[g].push({ esito: e, campo: d.campo, etichetta, testo: testoPerImpianto(d.messaggio) });
    }
  }
  const inPiu = esiti.filter(e => e.esito === 'non_trovata');
  const mancanti = [...assenti, ...usciteNonRiportate];

  const conta = (campi) => voci.anomalia.filter(x => campi.includes(x.campo) && x.etichetta !== 'Riga duplicata' && x.etichetta !== 'Formulario di un altro impianto').length;
  const controlli = [
    { nome: 'Numero dei formulari', ok: righeQuadratura.every(q => q.formulari_report === q.formulari_gestionale),
      dettaglio: dettaglioPerTipo(righeQuadratura, 'formulari_report', 'formulari_gestionale', formatIntero) },
    { nome: 'Peso effettivo totale', ok: righeQuadratura.every(q => q.kg_report === q.kg_gestionale),
      dettaglio: dettaglioPerTipo(righeQuadratura, 'kg_report', 'kg_gestionale', (n) => formatKg(n) + ' kg') },
    { nome: 'Numeri di formulario', n: conta(['fir']) },
    { nome: 'Peso effettivo di ciascun formulario', n: conta(['kg']) },
    { nome: 'Date di trasporto', n: conta(['fine', 'inizio']) },
    { nome: 'Classe dei PFU', n: conta(['classe']) },
    { nome: 'Formulari registrati assenti nel report', n: mancanti.length },
    { nome: 'Formulari del report non registrati', n: inPiu.length },
    { nome: 'Righe duplicate o di altri impianti', n: voci.anomalia.filter(x => x.etichetta === 'Riga duplicata' || x.etichetta === 'Formulario di un altro impianto').length },
  ].map(c => (c.ok === undefined ? { ...c, ok: c.n === 0, dettaglio: c.n ? `${c.n} ${c.n === 1 ? 'anomalia' : 'anomalie'}` : 'nessuna anomalia' } : c));

  const righeConAnomalie = new Set(voci.anomalia.map(x => x.esito)).size;
  const numeroAnomalie = righeConAnomalie + inPiu.length + mancanti.length;
  const conformita = v.conformita || (numeroAnomalie === 0 && totale.quadra && righeQuadratura.every(q => q.quadra) ? 'piena' : 'parziale');

  return {
    conformita, numeroAnomalie, quadratura: righeQuadratura, categorie, totale, controlli, dichiarazione: v.file_tipo === 'dichiarazione',
    anomalie: voci.anomalia, osservazioni: voci.osservazione, rettifiche: voci.rettifica,
    mancanti, inPiu, escluse, esiti,
  };
}

export function analisiInCorso(v) {
  if (!v || (v.stato !== 'in_lettura' && v.stato !== 'in_verifica')) return false;
  const avvio = (dataServer(v.avviata_il || v.created_date) || new Date(0)).getTime();
  return Date.now() - avvio < 10 * 60 * 1000;
}

export function analisiInterrotta(v) {
  return !!v && (v.stato === 'in_lettura' || v.stato === 'in_verifica') && !analisiInCorso(v);
}

export const ETICHETTE_ESITO = {
  conforme: 'Conforme',
  discrepanze: 'Con discrepanze',
  non_trovata: 'Non trovata nel gestionale',
  duplicata: 'Duplicata nel report',
};

// === esportazione Excel ===

const COLORI = {
  intestazione: 'FF1F2937',
  verde: 'FFDCF3E4', verdeTesto: 'FF1E6B3A',
  ambra: 'FFFFF1CC', ambraTesto: 'FF8A5A00',
  rosso: 'FFFBE0E0', rossoTesto: 'FF9B1C1C',
  grigio: 'FFF3F4F6',
};

const riempi = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const bordo = { style: 'thin', color: { argb: 'FFD1D5DB' } };
const bordi = { top: bordo, left: bordo, bottom: bordo, right: bordo };

function intestazione(foglio, titoli) {
  const riga = foglio.addRow(titoli);
  riga.eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = riempi(COLORI.intestazione);
    c.alignment = { vertical: 'middle', wrapText: true };
    c.border = bordi;
  });
  riga.height = 30;
  return riga;
}

function coloreEsito(esito) {
  if (esito === 'conforme') return [COLORI.verde, COLORI.verdeTesto];
  if (esito === 'discrepanze') return [COLORI.ambra, COLORI.ambraTesto];
  return [COLORI.rosso, COLORI.rossoTesto];
}

/**
 * Genera l'Excel della verifica: riepilogo, verifica riga per riga con il tipo
 * ingresso o uscita e i campi discordanti evidenziati e spiegati, movimenti
 * assenti nel report ed elenco pronto da comunicare al fornitore.
 */
export async function scaricaExcelVerifica(v) {
  const modulo = await import('exceljs');
  const ExcelJS = modulo.default || modulo;
  const esito = v.esito_json ? JSON.parse(v.esito_json) : { esiti: [], assenti: [] };
  const lettura = v.lettura_json ? JSON.parse(v.lettura_json) : {};
  const nomeTipo = (t) => (t === 'uscita' ? 'Uscita' : t === 'ingresso' ? 'Ingresso' : 'Non pertinente');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestionale PFU';
  wb.created = new Date();

  // --- Riepilogo ---
  const r = wb.addWorksheet('Riepilogo', { views: [{ showGridLines: false }] });
  r.columns = [{ width: 38 }, { width: 22 }, { width: 22 }, { width: 22 }];
  const titolo = r.addRow(['Verifica del report settimanale']);
  titolo.font = { bold: true, size: 16 };
  r.addRow([]);
  const info = [
    ['Impianto o stoccaggio', v.soggetto_nome],
    ['Esito', sintesiVerifica(v, esito).conformita === 'piena' ? 'Conformità piena' : 'Conformità parziale'],
    ['Settimana', `${v.settimana} del ${v.anno}, dal ${dataIt(v.data_inizio)} al ${dataIt(v.data_fine)}, secondo la data di fine trasporto`],
    ['File verificato', v.file_nome],
    ['Lettura del file', lettura.modo === 'dichiarazione'
      ? `nessun file: l'impianto ha comunicato che non ci sono state movimentazioni${v.nota ? ` (${v.nota})` : ''}`
      : lettura.modo === 'excel'
      ? descriviLettura(lettura).join('\n')
      : `${lettura.modo === 'pdf' ? 'PDF' : 'immagine'} trascritto dall'agente, pesi in ${lettura.unita === 't' ? 'tonnellate' : 'chilogrammi'}`],
    ['Righe non considerate', v.righe_escluse ? `${v.righe_escluse} (${formatKg(v.peso_escluse_kg || 0)} kg): carichi di altre settimane o di altri consorzi, elencati nel foglio "Non considerate"` : 'nessuna'],
    ['Criteri', 'Ingressi confrontati con le primarie, uscite con le secondarie; peso al chilogrammo; data di verifica: fine trasporto'],
    ['Verifica eseguita il', v.verificata_il ? new Date(v.verificata_il).toLocaleString('it-IT') : ''],
    ['Cancellazione dal gestionale', dataIt(v.scade_il)],
  ];
  for (const [k, val] of info) {
    const riga = r.addRow([k, val]);
    riga.getCell(1).font = { bold: true };
    r.mergeCells(riga.number, 2, riga.number, 4);
    riga.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  }
  const avviso = (testo, sfondo, colore) => {
    r.addRow([]);
    const nota = r.addRow([testo]);
    r.mergeCells(nota.number, 1, nota.number, 4);
    nota.getCell(1).fill = riempi(sfondo);
    nota.getCell(1).font = { color: { argb: colore }, bold: true };
    nota.getCell(1).alignment = { wrapText: true };
    nota.height = 34;
  };
  if (lettura.trascritto_da_agente) {
    avviso('Attenzione: il report non era un Excel e i formulari sono stati trascritti dall\'agente. Prima di contestare un formulario errato, confrontalo con il documento originale.', COLORI.ambra, COLORI.ambraTesto);
  }
  if (v.uscite_gestionale && !v.uscite_verificate) {
    avviso(`Il report non contiene uscite: le ${v.uscite_gestionale} secondarie partite nella settimana non sono state verificate.`, COLORI.grigio, 'FF374151');
  }
  r.addRow([]);
  intestazione(r, ['Confronto', 'Report', 'Gestionale', 'Differenza']);
  const usciteContate = v.uscite_verificate ? (v.uscite_gestionale || 0) : 0;
  const pesoUsciteContato = v.uscite_verificate ? (v.peso_uscite_kg || 0) : 0;
  const confronti = [
    ['Carichi', v.righe_report || 0, (v.ingressi_gestionale || 0) + usciteContate],
    ['Peso totale (kg)', v.peso_report_kg || 0, (v.peso_ingressi_kg || 0) + pesoUsciteContato],
  ];
  for (const [k, a, b] of confronti) {
    const riga = r.addRow([k, a, b, a - b]);
    riga.eachCell((c, i) => { c.border = bordi; if (i > 1) c.numFmt = '#,##0'; });
    if (a !== b) riga.getCell(4).fill = riempi(COLORI.rosso);
  }
  const dettaglio = [
    ['di cui ingressi nel gestionale', v.ingressi_gestionale || 0, v.peso_ingressi_kg || 0],
    [`di cui uscite nel gestionale${v.uscite_verificate ? '' : ', non verificate'}`, v.uscite_gestionale || 0, v.peso_uscite_kg || 0],
  ];
  for (const [k, n, kg] of dettaglio) {
    const riga = r.addRow([k, '', `${n} carichi, ${formatKg(kg)} kg`]);
    riga.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
    r.mergeCells(riga.number, 3, riga.number, 4);
  }
  r.addRow([]);
  intestazione(r, ['Esito delle righe', 'Numero']);
  const conteggi = [
    ['Conformi', v.conformi || 0, 'conforme'],
    ['Con discrepanze', v.con_discrepanze || 0, 'discrepanze'],
    ['Non trovate nel gestionale', v.non_trovate || 0, 'non_trovata'],
    ['Duplicate nel report', v.duplicate || 0, 'duplicata'],
    ['Movimenti del gestionale assenti nel report', v.assenti_nel_report || 0, 'assente'],
  ];
  for (const [k, n, e] of conteggi) {
    const riga = r.addRow([k, n]);
    riga.eachCell(c => { c.border = bordi; });
    if (n > 0) {
      const [sfondo, testo] = coloreEsito(e);
      riga.getCell(1).fill = riempi(sfondo);
      riga.getCell(2).fill = riempi(sfondo);
      riga.getCell(2).font = { bold: true, color: { argb: testo } };
    }
  }

  // --- Verifica righe ---
  const f = wb.addWorksheet('Verifica righe', { views: [{ state: 'frozen', xSplit: 4, ySplit: 1 }] });
  const colonne = [
    ['Riga report', 14], ['Tipo', 11], ['Esito', 16], ['Annotazioni', 60],
    ['FIR report', 18], ['FIR gestionale', 18],
    ['Peso report (kg)', 12], ['Peso gestionale (kg)', 12], ['Differenza (kg)', 11],
    ['Fine trasporto report', 12], ['Fine trasporto gestionale', 12],
    ['Inizio trasporto report', 12], ['Inizio trasporto gestionale', 12],
    ['Produttore report', 26], ['Produttore gestionale', 26],
    ['Destinatario report', 24], ['Destinatario gestionale', 24],
    ['Trasportatore report', 24], ['Trasportatore gestionale', 24],
    ['Classe report', 9], ['Classe gestionale', 9],
    ['Fonte', 18], ['Ordine', 14],
  ];
  f.columns = colonne.map(([, w]) => ({ width: w }));
  intestazione(f, colonne.map(([t]) => t));
  // Colonne da evidenziare per ciascun campo discordante.
  const CELLE_CAMPO = { fir: [5, 6], kg: [7, 8, 9], fine: [10, 11], inizio: [12, 13], produttore: [14, 15], destinatario: [16, 17], trasportatore: [18, 19], classe: [20, 21] };

  for (const e of esito.esiti) {
    const rep = e.report || {};
    const ges = e.gestionale || {};
    const differenza = rep.kg != null && ges.kg != null ? rep.kg - ges.kg : null;
    const annotazioni = e.discrepanze && e.discrepanze.length ? e.discrepanze.map(d => '• ' + d.messaggio).join('\n') : 'Nessuna discrepanza';
    const riga = f.addRow([
      e.foglio ? rigaReport(e) : e.n, e.gestionale ? nomeTipo(e.tipo) : '', ETICHETTE_ESITO[e.esito] || e.esito, annotazioni,
      rep.fir || '', ges.fir || '',
      rep.kg ?? '', ges.kg ?? '', differenza ?? '',
      dataIt(rep.fine || rep.data), dataIt(ges.fine),
      dataIt(rep.inizio), dataIt(ges.inizio),
      rep.produttore || rep.codice_pdr || '', ges.produttore || '',
      rep.destinatario || '', ges.destinatario || '',
      rep.trasportatore || '', ges.trasportatore || '',
      rep.classe || '', ges.classe || '',
      ges.fonte || '', ges.ordine || '',
    ]);
    riga.eachCell({ includeEmpty: true }, (c, i) => {
      c.border = bordi;
      c.alignment = { vertical: 'top', wrapText: i === 4 };
      if (i >= 7 && i <= 9) c.numFmt = '#,##0';
    });
    const [sfondo, testo] = coloreEsito(e.esito);
    riga.getCell(3).fill = riempi(sfondo);
    riga.getCell(3).font = { bold: true, color: { argb: testo } };
    if (e.esito !== 'conforme') riga.getCell(4).font = { color: { argb: testo } };
    for (const d of (e.discrepanze || [])) {
      for (const i of (CELLE_CAMPO[d.campo] || [])) riga.getCell(i).fill = riempi(COLORI.rosso);
    }
  }
  f.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colonne.length } };

  // --- Assenti nel report ---
  const a = wb.addWorksheet('Assenti nel report', { views: [{ state: 'frozen', ySplit: 1 }] });
  const colAssenti = [['Tipo', 11], ['FIR', 18], ['Peso (kg)', 12], ['Fine trasporto', 12], ['Inizio trasporto', 12], ['Produttore', 28], ['Destinatario', 26], ['Trasportatore', 26], ['Classe', 9], ['Fonte', 18], ['Ordine', 14], ['Annotazioni', 50]];
  a.columns = colAssenti.map(([, w]) => ({ width: w }));
  intestazione(a, colAssenti.map(([t]) => t));
  const mancanti = [...esito.assenti, ...(esito.uscite_non_riportate || [])];
  if (mancanti.length === 0) {
    a.addRow(['', 'Tutti i movimenti della settimana verificati compaiono nel report.']);
  }
  for (const m of mancanti) {
    const riga = a.addRow([nomeTipo(m.tipo), m.fir, m.kg, dataIt(m.fine), dataIt(m.inizio), m.produttore, m.destinatario, m.trasportatore, m.classe || '', m.fonte, m.ordine,
      m.tipo === 'uscita' ? 'Uscita registrata nel gestionale ma non riportata nel report del fornitore' : 'Ingresso registrato nel gestionale ma non riportato nel report del fornitore']);
    riga.eachCell({ includeEmpty: true }, (c, i) => { c.border = bordi; c.fill = riempi(COLORI.rosso); if (i === 3) c.numFmt = '#,##0'; });
  }

  // --- Righe non considerate ---
  if ((esito.escluse || []).length) {
    const x = wb.addWorksheet('Non considerate', { views: [{ state: 'frozen', ySplit: 1 }] });
    const colEscluse = [['Riga report', 14], ['FIR', 18], ['Peso (kg)', 12], ['Data report', 12], ['Produttore', 28], ['Destinatario', 26], ['Motivo', 70]];
    x.columns = colEscluse.map(([, w]) => ({ width: w }));
    intestazione(x, colEscluse.map(([t]) => t));
    for (const e of esito.escluse) {
      const riga = x.addRow([e.foglio ? rigaReport(e) : e.n, e.fir || '', e.kg ?? '', dataIt(e.data), e.produttore || '', e.destinatario || '', e.motivo]);
      riga.eachCell({ includeEmpty: true }, (c, i) => { c.border = bordi; c.fill = riempi(COLORI.grigio); if (i === 3) c.numFmt = '#,##0'; });
    }
  }

  // --- Da comunicare al fornitore ---
  const c = wb.addWorksheet('Da comunicare');
  c.columns = [{ width: 20 }, { width: 100 }];
  intestazione(c, ['Formulario', 'Problema riscontrato']);
  let righeComunicazione = 0;
  for (const e of esito.esiti) {
    if (e.esito === 'conforme') continue;
    for (const d of (e.discrepanze || [])) {
      const riferimento = rigaReport(e);
      const riga = c.addRow([(e.gestionale && e.gestionale.fir) || (e.report && e.report.fir) || riferimento, `${riferimento.charAt(0).toUpperCase() + riferimento.slice(1)} del report: ${d.messaggio}`]);
      riga.eachCell(x => { x.border = bordi; x.alignment = { wrapText: true, vertical: 'top' }; });
      righeComunicazione++;
    }
  }
  for (const m of mancanti) {
    const cosa = m.tipo === 'uscita' ? `Uscita del ${dataIt(m.fine)} verso ${m.destinatario}` : `Ingresso del ${dataIt(m.fine)}`;
    const riga = c.addRow([m.fir, `${cosa} di ${formatKg(m.kg)} kg, trasportato da ${m.trasportatore}, non riportato nel report`]);
    riga.eachCell(x => { x.border = bordi; x.alignment = { wrapText: true, vertical: 'top' }; });
    righeComunicazione++;
  }
  if (righeComunicazione === 0) c.addRow(['', 'Nessun problema da comunicare: il report corrisponde al gestionale.']);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const nomeSoggetto = String(v.soggetto_nome || 'soggetto').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  link.href = url;
  link.download = `Verifica_${nomeSoggetto}_settimana_${String(v.settimana).padStart(2, '0')}_${v.anno}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
