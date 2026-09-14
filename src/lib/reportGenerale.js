// Lettura del foglio "Report Generale" del file di gestione Ecotyre: i target
// assegnati dell'anno, organizzati per impianto di destinazione, regione e
// raccoglitore, con il target annuo e quelli assegnati mese per mese.
//
// La tabella e' una pivot senza indicazione del livello di ogni riga. Una regione
// si riconosce dal nome; le righe che la seguono sono i suoi raccoglitori finche'
// la somma dei loro target annui raggiunge quello della regione. Chiuso il blocco,
// una riga seguita da una regione e' un impianto.

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const REGIONI_ITALIA = ['Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche',
  'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', "Valle d'Aosta", 'Veneto'];

const semplice = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const regioneDi = (nome) => REGIONI_ITALIA.find(r => semplice(r) === semplice(nome)) || null;
const numero = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
};

/**
 * righe: il foglio come matrice di valori (prima riga del file = indice 0).
 * Restituisce { anno, voci: [{ impianto, regione, raccoglitore, annuo, mesi: { Gennaio: t|null, ... } }], totale, avvisi }.
 */
export function leggiReportGenerale(righe) {
  const avvisi = [];
  const iIntestazione = righe.findIndex(r => (r || []).some(c => /target\s+annual[ei]\s+assegnat/i.test(String(c ?? ''))));
  if (iIntestazione < 0) throw new Error('Nel foglio non trovo la colonna "Target annuale assegnato".');
  const intest = righe[iIntestazione].map(c => String(c ?? ''));
  const colAnnuo = intest.findIndex(c => /target\s+annual[ei]\s+assegnat/i.test(c));
  const colMese = {};
  intest.forEach((c, j) => {
    const m = c.match(/target\s+assegnat[oi]\s+([a-zà]+)/i);
    const mese = m && MESI.find(x => semplice(x) === semplice(m[1]));
    if (mese && colMese[mese] === undefined) colMese[mese] = j;
  });
  const annoTitolo = String(intest[0] || '').match(/20\d\d/);

  const nomi = righe.map(r => String((r || [])[0] ?? '').trim());
  const prossimoNome = (i) => { for (let k = i + 1; k < nomi.length; k++) if (nomi[k]) return nomi[k]; return ''; };
  const voci = [];
  let impianto = '', regione = '', totaleRegione = 0, somma = 0, righeRegione = 0, inRegione = false, totale = null;

  for (let i = iIntestazione + 1; i < righe.length; i++) {
    const nome = nomi[i];
    if (!nome) continue;
    if (/^totale/i.test(nome)) { totale = numero(righe[i][colAnnuo]); break; }
    const annuo = numero(righe[i][colAnnuo]);
    const reg = regioneDi(nome);
    if (reg) {
      regione = reg; totaleRegione = annuo || 0; somma = 0; righeRegione = 0; inRegione = true;
      continue;
    }
    const regioneChiusa = !inRegione || (righeRegione > 0 && somma >= totaleRegione - 0.01);
    if (regioneChiusa && regioneDi(prossimoNome(i))) {
      impianto = nome; regione = ''; inRegione = false;
      continue;
    }
    if (!regione) { avvisi.push(`"${nome}" non ha una regione sopra di sé: riga ignorata.`); continue; }
    const mesi = {};
    for (const m of MESI) mesi[m] = colMese[m] !== undefined ? numero(righe[i][colMese[m]]) : null;
    voci.push({ impianto, regione, raccoglitore: nome, annuo, mesi });
    somma += annuo || 0;
    righeRegione++;
  }
  const sommaVoci = voci.reduce((s, v) => s + (v.annuo || 0), 0);
  if (totale !== null && Math.abs(totale - sommaVoci) > 0.5) avvisi.push(`La somma dei target annui letti (${sommaVoci.toLocaleString('it-IT')} t) non coincide con il totale del foglio (${totale.toLocaleString('it-IT')} t).`);
  return { anno: annoTitolo ? Number(annoTitolo[0]) : null, voci, totale, somma: sommaVoci, mesiPresenti: Object.keys(colMese), avvisi };
}

/**
 * Abbina le voci lette ai target gia' presenti, senza creare doppioni.
 * Per ogni valore del file (annuo, e ogni mese scritto) cerca prima il record con
 * lo stesso raccoglitore, regione e impianto; poi un record dello stesso
 * raccoglitore e regione ancora senza impianto; per l'annuo anche uno senza
 * regione. Il record trovato si aggiorna, altrimenti se ne crea uno nuovo.
 * chiaveNome: funzione che normalizza la ragione sociale.
 *
 * Restituisce le voci con le operazioni previste e i record esistenti degli
 * stessi raccoglitori che il file non ha usato.
 */
export function pianificaImportazione(voci, annui, mensili, chiaveNome) {
  const stessoNome = (r, v) => chiaveNome(r.raccoglitore) === chiaveNome(v.raccoglitore);
  const stessaRegione = (r, v) => String(r.regione || '').trim() === v.regione;
  const stessoImpianto = (r, v) => chiaveNome(r.impianto || '') === chiaveNome(v.impianto || '');
  const vicino = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.0005;
  const piano = voci.map(v => ({ voce: v, annuo: null, mesi: {} }));

  const abbina = (records, prendi, passaggi) => {
    const usati = new Set();
    for (const test of passaggi) {
      for (const p of piano) {
        for (const [chiave, filtro] of prendi(p)) {
          if (p.__fatto && p.__fatto[chiave]) continue;
          const r = records.find(x => !usati.has(x.id) && filtro(x) && test(x, p.voce));
          if (r) { usati.add(r.id); p.__fatto = { ...(p.__fatto || {}), [chiave]: r }; }
        }
      }
    }
    return usati;
  };
  const passaggi = [
    (r, v) => stessoNome(r, v) && stessaRegione(r, v) && stessoImpianto(r, v),
    (r, v) => stessoNome(r, v) && stessaRegione(r, v) && !r.impianto,
  ];

  // Target annui
  const usatiAnnui = abbina(annui, p => (p.voce.annuo !== null ? [['annuo', () => true]] : []), [...passaggi, (r, v) => stessoNome(r, v) && !r.regione && !r.impianto]);
  for (const p of piano) {
    if (p.voce.annuo === null) continue;
    const r = (p.__fatto || {}).annuo || null;
    const uguale = r && vicino(r.target_tonnellate, p.voce.annuo) && stessaRegione(r, p.voce) && stessoImpianto(r, p.voce);
    p.annuo = { record: r, valore: p.voce.annuo, stato: !r ? 'crea' : uguale ? 'uguale' : 'aggiorna' };
  }
  for (const p of piano) delete p.__fatto;

  // Target mensili
  const usatiMensili = abbina(mensili, p => Object.entries(p.voce.mesi).filter(([, t]) => t !== null).map(([m]) => [m, x => x.mese === m]), passaggi);
  for (const p of piano) {
    for (const [m, t] of Object.entries(p.voce.mesi)) {
      if (t === null) continue;
      const r = (p.__fatto || {})[m] || null;
      const uguale = r && vicino(r.target, t) && !r.non_raccoglie && stessaRegione(r, p.voce) && stessoImpianto(r, p.voce);
      p.mesi[m] = { record: r, valore: t, stato: !r ? 'crea' : uguale ? 'uguale' : 'aggiorna' };
    }
    delete p.__fatto;
  }

  // Record degli stessi raccoglitori che il file non ha usato: l'annuo di chi e'
  // nel file, e i mensili dei mesi per cui il file scrive un valore.
  const nomiFile = new Set(voci.map(v => chiaveNome(v.raccoglitore)));
  const mesiDelFile = new Map();
  for (const v of voci) {
    const k = chiaveNome(v.raccoglitore);
    if (!mesiDelFile.has(k)) mesiDelFile.set(k, new Set());
    for (const [m, t] of Object.entries(v.mesi)) if (t !== null) mesiDelFile.get(k).add(m);
  }
  const restanti = [
    ...annui.filter(r => nomiFile.has(chiaveNome(r.raccoglitore)) && !usatiAnnui.has(r.id)).map(r => ({ tipo: 'annuo', record: r })),
    ...mensili.filter(r => !usatiMensili.has(r.id) && (mesiDelFile.get(chiaveNome(r.raccoglitore)) || new Set()).has(r.mese)).map(r => ({ tipo: 'mese', record: r })),
  ];
  return { piano: piano.filter(p => p.annuo || Object.keys(p.mesi).length), restanti };
}

export async function leggiFileReportGenerale(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const nome = wb.SheetNames.find(n => /report\s*generale/i.test(n));
  if (!nome) throw new Error('Nel file non c\'è un foglio "Report Generale".');
  const righe = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null, blankrows: true });
  return leggiReportGenerale(righe);
}
