// TORNA AL TESTO VERIFICATO (segnalazione alta A75 del 20/09/2026, corretta il
// 12/10/2026).
//
// Un aggiornamento normativo approvato per errore prendeva il posto della voce
// verificata in ogni risposta di EcoTyna e nei controlli, e la pagina della base
// di conoscenza non aveva un modo di toglierlo. Si controlla:
//   1. le regole del ritiro (src/lib/ritiroConoscenza.js): solo gli
//      aggiornamenti attivi di quella voce, il motivo obbligatorio e scritto,
//      attiva = false come mettiDaParte;
//   2. che dopo il ritiro la base di conoscenza che entra nel prompt torni al
//      testo verificato del codice (le funzioni vere di baseConoscenza.ts);
//   3. che un aggiornamento ritirato a mano si possa rimettere in uso, e uno
//      superato no;
//   4. che la pagina abbia il comando accanto al badge, solo per l'amministratore.
// npm run prove
import { readFileSync } from 'node:fs';
import { ritiroAggiornamenti, ritiratoAMano, puoTornareInUso, RITIRATO } from '../src/lib/ritiroConoscenza.js';
import { testoConoscenza, voceAttuale, vociApprovate, BASE_CONOSCENZA } from '../base44/shared/baseConoscenza.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');
const J = (v) => String(JSON.stringify(v)).slice(0, 400);

const CODICE = BASE_CONOSCENZA.find(v => v.id === 'tua-fir-microraccolta');
const SBAGLIATO = 'Testo approvato per errore: la microraccolta non richiede di indicare le tappe nel formulario, e il percorso effettivo non si annota mai.';
const VOCI = [
  { id: 'agg1', tipo: 'aggiornamento_normativo', stato: 'approvata', attiva: true, area: 'tua', voce_id: 'tua-fir-microraccolta', titolo: 'FIR e microraccolta', testo: SBAGLIATO, verificato_il: '2026-10-05', storico_json: '[]' },
  { id: 'agg-vecchio', tipo: 'aggiornamento_normativo', stato: 'approvata', attiva: false, area: 'tua', voce_id: 'tua-fir-microraccolta', titolo: 'FIR', testo: 'vecchio', verificato_il: '2026-09-20', motivo_scarto: 'superata dall\'aggiornamento "FIR e microraccolta" approvato il 05/10/2026' },
  { id: 'altra', tipo: 'aggiornamento_normativo', stato: 'approvata', attiva: true, area: 'tua', voce_id: 'tua-registro', titolo: 'Registro', testo: 'x'.repeat(400), verificato_il: '2026-10-05' },
  { id: 'faq1', tipo: 'faq', stato: 'approvata', attiva: true, area: 'rentri', titolo: 'FAQ', testo: 'Una FAQ.', verificato_il: '2026-10-01' },
  { id: 'prop', tipo: 'aggiornamento_normativo', stato: 'proposta', attiva: true, area: 'tua', voce_id: 'tua-fir-microraccolta', titolo: 'Proposta', testo: 'y'.repeat(400) },
];

console.log('1. LE REGOLE DEL RITIRO');
{
  let errore = '';
  try { ritiroAggiornamenti(VOCI, 'tua-fir-microraccolta', { motivo: '   ', utente: 'Mario', adesso: '2026-10-12T10:00:00.000Z' }); } catch (e) { errore = e.message; }
  verifica('senza motivo non si ritira niente', /Scrivi perché ritiri l'aggiornamento/.test(errore), errore);
  const r = ritiroAggiornamenti(VOCI, 'tua-fir-microraccolta', { motivo: ' approvato per errore ', utente: 'Mario', adesso: '2026-10-12T10:00:00.000Z' });
  verifica('si ritira solo l\'aggiornamento attivo di quella voce', r.length === 1 && r[0].voce.id === 'agg1', J(r.map(x => x.voce.id)));
  verifica('attiva = false col motivo e il momento, come mettiDaParte', r[0].campi.attiva === false && r[0].campi.messa_da_parte_il === '2026-10-12T10:00:00.000Z'
    && r[0].campi.motivo_scarto === 'ritirato a mano da Mario, si torna al testo verificato: approvato per errore', J(r[0].campi));
  verifica('la nota dello storico porta lo stesso motivo', r[0].nota === 'messa da parte: ritirato a mano da Mario, si torna al testo verificato: approvato per errore');
  verifica('niente da ritirare su una voce senza aggiornamenti', ritiroAggiornamenti(VOCI, 'pfu-revisione', { motivo: 'x', utente: 'Mario', adesso: '' }).length === 0);
}

console.log('2. DOPO IL RITIRO SI TORNA AL TESTO VERIFICATO');
{
  // L'archivio finto: le righe dopo il ritiro, lette come le legge EcoTyna.
  const r = ritiroAggiornamenti(VOCI, 'tua-fir-microraccolta', { motivo: 'approvato per errore', utente: 'Mario', adesso: '2026-10-12T10:00:00.000Z' });
  const dopo = VOCI.map(v => { const x = r.find(y => y.voce.id === v.id); return x ? { ...v, ...x.campi } : v; });
  const archivio = { asServiceRole: { entities: { ConoscenzaAssistente: { filter: async (f, _o, n = 5000, s = 0) => dopo.filter(v => v.stato === f.stato).slice(s, s + n) } } } };
  const prima = VOCI.filter(v => v.stato === 'approvata' && v.attiva !== false);
  verifica('prima del ritiro la voce era sostituita dal testo sbagliato', voceAttuale('tua-fir-microraccolta', prima).testo === SBAGLIATO);
  const approvate = await vociApprovate(archivio);
  verifica('dopo, l\'aggiornamento ritirato non e\' fra le voci in uso', !approvate.some(v => v.id === 'agg1') && approvate.some(v => v.id === 'altra'), J(approvate.map(v => v.id)));
  const attuale = voceAttuale('tua-fir-microraccolta', approvate);
  verifica('la voce torna al testo e alla data del codice', attuale.testo === CODICE.testo && attuale.verificato_il === CODICE.verificato_il, J(attuale.verificato_il));
  const testo = testoConoscenza(approvate);
  verifica('e nel prompt di EcoTyna non c\'e\' piu\' il testo sbagliato', !testo.includes(SBAGLIATO) && testo.includes(`- ${CODICE.titolo} (verificato il ${CODICE.verificato_il}`));
}

console.log('3. RIMETTERE IN USO');
{
  const ritirato = { ...VOCI[0], attiva: false, motivo_scarto: `${RITIRATO} da Mario, si torna al testo verificato: errore` };
  verifica('un aggiornamento ritirato a mano si puo\' rimettere in uso', ritiratoAMano(ritirato) && puoTornareInUso(ritirato));
  verifica('uno superato da uno piu\' recente no', !ritiratoAMano(VOCI[1]) && !puoTornareInUso(VOCI[1]));
  verifica('una FAQ messa da parte si\', come prima', puoTornareInUso({ ...VOCI[3], attiva: false }));
  verifica('una proposta scartata no', !puoTornareInUso({ ...VOCI[4], stato: 'scartata' }));
}

console.log('4. LA PAGINA');
{
  const p = sorgente('src/components/assistente/BaseConoscenza.jsx');
  verifica('accanto al badge «Aggiornata il», per l\'amministratore, «Torna al testo verificato»',
    /\{s && <Badge[^>]*>Aggiornata il \{giornoIt\(dataVoce\(s\)\)\}<\/Badge>\}/.test(p) && /\{s && admin && <RitiraAggiornamento onRitira=\{\(motivo\) => ritira\(v, motivo\)\} \/>\}/.test(p)
    && /Torna al testo verificato<\/Button>/.test(p));
  verifica('il pulsante che ritira resta spento senza motivo', /disabled=\{!motivo\.trim\(\) \|\| lavoro\}/.test(p));
  verifica('il ritiro scrive i campi delle regole e la nota nello storico', /ritiroAggiornamenti\(voci, codiceVoce\.id, \{ motivo, utente: nomeUtente\(user\), adesso: new Date\(\)\.toISOString\(\) \}\)/.test(p)
    && /\.\.\.campi,\n\s*storico_json: conModifica\(x\.storico_json, \{ utente: nomeUtente\(user\), nota \}\)/.test(p));
  verifica('«Rimetti in uso» segue le regole', /\{admin && puoTornareInUso\(v\) && \(/.test(p) && !/!\(v\.tipo === 'aggiornamento_normativo' && v\.voce_id\) && \(/.test(p));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
