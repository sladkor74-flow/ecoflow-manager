// IL CONTRATTO NUOVO RAGGIUNGIBILE DALLA SCHEDA DEL FORNITORE (revisione del
// 13/10/2026, rilievo della revisione di R3b e la voce rimasta aperta).
//
// Col contratto dell'anno dopo controfirmato a dicembre, il contratto in corso
// resta attivo fino alla decorrenza e il requisito si regge su di lui finche' il
// nuovo non e' valido (documentoDelRequisito in base44/shared/qualificaFornitori.ts).
// Il nuovo letto male pero' restava solo una nota: la scheda del fornitore
// (src/components/qualifica/SoggettoDettaglio.jsx) metteva Apri, Rianalizza e
// Correggi sul documento del requisito, cioe' sul vecchio, e con «Correggi» la
// scadenza del 2027 finiva scritta sul 2026; la pagina (src/pages/
// QualificaFornitori.jsx) non si aggiornava piu' da sola col nuovo in lettura.
// Si controlla, sullo script del revisore (giro3/revisione/R3b/
// nuovo_contratto_irraggiungibile.mjs) e sul suo caso vicino
// (caricamento_dalla_scheda.mjs):
//   1. il requisito espone gli altri contratti attivi della voce uno per uno
//      (id, file, stato, problemi, lettura; mai il file_uri), e la nota sul
//      contratto caricato dopo dice di quale documento parla;
//   2. la scelta del migliore vale solo per la successione: rete e ACI dello
//      stesso anno si guardano tutti e due, e uno non conforme fa il fornitore
//      critico (e la fatturazione passiva avvisa prima di pagare);
//   3. la scheda da' al contratto nuovo i suoi pulsanti: Apri, Rianalizza e
//      Correggi lavorano su di lui, la correzione si scrive su di lui; quelli del
//      requisito restano sul documento del requisito;
//   4. il caricamento a mano non manda fra i sostituiti il contratto in corso;
//   5. la pagina si aggiorna da sola anche col contratto nuovo in lettura;
//   6. EcoTyna (strumento qualifica_fornitori) conta il documento su cui si regge
//      il requisito, non il vecchio scaduto accanto al nuovo, e dice la nota;
//   7. la funzione vera, sul banco, porta gli altri documenti senza file_uri.
// node prove/contrattoNuovoRaggiungibile.mjs
import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Q from '../base44/shared/qualificaFornitori.ts';
import { STRUMENTI } from '../base44/shared/strumentiAssistente.ts';
import { caricaPagina, clienteFinto, aspetta, trova, testo } from './dati/paginaFinta.mjs';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (v) => String(JSON.stringify(v)).slice(0, 500);
const prova = (f) => { try { return f(); } catch (e) { return e; } };

const contratto = { id: 'tc', nome: 'Contratto con SMOCO', categoria: 'contratto', obbligatorio: true, tipo_scadenza: 'da_documento', preavviso_giorni: 60, si_applica_a: 'raccolta' };
const durc = { id: 'td', nome: 'DURC', categoria: 'regolarita_contributiva', obbligatorio: true, tipo_scadenza: 'da_emissione', validita_giorni: 120, preavviso_giorni: 20, si_applica_a: 'raccolta' };
const alfa = { chiave: 'alfa', nome: 'ALFA SRL', ruoli: ['raccolta'] };
const DIC = '2026-12-15';
const doc = (campi) => ({ soggetto_chiave: 'alfa', soggetto_nome: 'ALFA SRL', tipo_documento_id: 'tc', tipo_documento_nome: contratto.nome, stato: 'attivo', analisi_stato: 'completata', problemi_json: '[]', ...campi });
const c26 = doc({ id: 'c26', file_nome: 'Contratto 2026.pdf', file_uri: 'privato://c26', data_emissione: '2026-01-02', data_scadenza: '2026-12-31' });
const c27 = (campi) => doc({ id: 'c27', file_nome: 'Contratto 2027 firmato.pdf', file_uri: 'privato://c27', data_emissione: '2027-01-02', data_scadenza: '2027-12-31', ...campi });
// I quattro casi del revisore, con lo stato che il contratto nuovo ha da solo.
const CASI = {
  'scadenza non letta': { campi: { data_scadenza: null }, stato: 'da_verificare' },
  'lettura fallita (429)': { campi: { analisi_stato: 'errore', errore_analisi: 'Limite di richieste raggiunto' }, stato: 'da_verificare' },
  'bloccante del modello': { campi: { problemi_json: JSON.stringify([{ gravita: 'bloccante', messaggio: 'Manca la firma del fornitore.' }]) }, stato: 'non_conforme' },
  'lettura in corso': { campi: { analisi_stato: 'in_corso', analisi_avviata_il: new Date().toISOString() }, stato: 'in_analisi' },
};
// Quello che la pagina riceve dalla funzione: JSON.
const comeInPagina = (v) => JSON.parse(JSON.stringify(v));
const requisitoDi = (documenti, oggi = DIC, tipi = [contratto]) => comeInPagina(Q.valutaSoggetto(alfa, tipi, documenti, oggi)).requisiti[0];
const altriDi = (r) => (Array.isArray(r && r.altri_documenti) ? r.altri_documenti : []);

console.log('1. IL REQUISITO ESPONE IL CONTRATTO NUOVO');
for (const [nome, caso] of Object.entries(CASI)) {
  const v = comeInPagina(Q.valutaSoggetto(alfa, [contratto], [c26, c27(caso.campi)], DIC));
  const r = v.requisiti[0];
  verifica(`${nome}: il requisito resta sul 2026 in vigore e il fornitore in scadenza (come R3b)`, r.stato === 'in_scadenza' && r.documento && r.documento.id === 'c26' && v.stato === 'in_scadenza', `${r.stato} ${r.documento && r.documento.id} ${v.stato}`);
  const a = altriDi(r).find(x => x.id === 'c27');
  verifica(`${nome}: il 2027 sta fra gli altri documenti, col suo nome e il suo stato (${caso.stato})`, !!a && a.file_nome === 'Contratto 2027 firmato.pdf' && a.stato === caso.stato && a.relazione === 'successivo', J(altriDi(r)));
  verifica(`${nome}: col file da aprire ma senza file_uri`, !!a && a.ha_file === true && !JSON.stringify(r).includes('privato://'), J(a));
  verifica(`${nome}: la nota sul contratto caricato dopo dice di quale documento parla`, (r.problemi || []).some(p => p.documento_id === 'c27' && /caricato dopo questo, «Contratto 2027 firmato\.pdf»/.test(p.messaggio)), J(r.problemi));
  verifica(`${nome}: il contratto in corso e' il 2026, il 2027 no`, J(r.contratti_in_corso) === '["c26"]', J(r.contratti_in_corso));
  if (nome === 'lettura fallita (429)') verifica('il 2027 porta l\'errore della lettura e il perche\'', !!a && a.errore_analisi === 'Limite di richieste raggiunto' && (a.problemi || []).some(p => /La lettura automatica del file non ha funzionato/.test(p.messaggio)), J(a));
  if (nome === 'bloccante del modello') verifica('il 2027 porta il bloccante del modello', !!a && (a.problemi || []).some(p => p.gravita === 'bloccante' && p.messaggio === 'Manca la firma del fornitore.'), J(a));
  if (nome === 'scadenza non letta') verifica('il 2027 dice le date lette', !!a && a.data_emissione === '2027-01-02' && a.scadenza === null, J(a));
}
{
  // Letto bene, il 2027 regge il requisito e il 2026 sta accanto, «in corso».
  const r = requisitoDi([c26, c27({})]);
  const a = altriDi(r).find(x => x.id === 'c26');
  verifica('letto bene: requisito sul 2027, e il 2026 accanto come contratto in corso', r.documento && r.documento.id === 'c27' && r.stato === 'valido' && !!a && a.relazione === 'in_corso' && a.stato === 'in_scadenza', J({ doc: r.documento && r.documento.id, altri: altriDi(r) }));
  // Il 1 gennaio il 2026 e' finito: non sta fra gli altri, sta fra i superati.
  const capodanno = requisitoDi([c26, c27({})], '2027-01-01');
  verifica('il 1 gennaio il 2026 scaduto non e\' fra gli altri documenti: e\' fra i superati', altriDi(capodanno).length === 0 && J(capodanno.superati) === '["c26"]', J({ altri: altriDi(capodanno), superati: capodanno.superati }));
  // Un tipo che non e' un contratto: niente altri documenti, come sempre.
  const d1 = doc({ id: 'durc1', tipo_documento_id: 'td', data_emissione: '2026-08-01', data_scadenza: '2026-11-29' });
  const d2 = doc({ id: 'durc2', tipo_documento_id: 'td', data_emissione: '2026-10-01', data_scadenza: '2027-01-29' });
  const rd = requisitoDi([d1, d2], '2026-10-13', [durc]);
  verifica('per un DURC vale il piu\' recente e non ci sono altri documenti ne\' contratti in corso', rd.documento && rd.documento.id === 'durc2' && altriDi(rd).length === 0 && Array.isArray(rd.contratti_in_corso) && rd.contratti_in_corso.length === 0, J(rd));
}

console.log('2. IL MIGLIORE SOLO PER LA SUCCESSIONE');
{
  const OTT = '2026-10-13';
  const aciNonConforme = (emissione) => doc({ id: 'a26', file_nome: 'Contratto ACI 2026.pdf', data_emissione: emissione, data_scadenza: '2026-12-31', problemi_json: JSON.stringify([{ gravita: 'bloccante', messaggio: 'Manca la firma del fornitore.' }]) });
  for (const [quando, emissione] of [['piu\' recente', '2026-03-02'], ['piu\' vecchio', '2026-01-01']]) {
    const v = comeInPagina(Q.valutaSoggetto(alfa, [contratto], [c26, aciNonConforme(emissione)], OTT));
    const r = v.requisiti[0];
    verifica(`rete valida e ACI dello stesso anno non conforme (${quando}): requisito non conforme, fornitore critico`, r.stato === 'non_conforme' && r.documento && r.documento.id === 'a26' && v.stato === 'critico', `${r.stato} ${r.documento && r.documento.id} ${v.stato}`);
    verifica(`(${quando}) la rete sta accanto, «insieme»`, altriDi(r).some(a => a.id === 'c26' && a.relazione === 'insieme' && a.stato === 'valido'), J(altriDi(r)));
    verifica(`(${quando}) il promemoria del non conforme parte`, Q.eventiDaSegnalare([v]).some(e => e.chiave === 'nonconforme|a26'), J(Q.eventiDaSegnalare([v])));
  }
  // La fatturazione passiva legge soggetti_critici dal riepilogo salvato.
  const scritte = [];
  const ent = (nome) => ({
    filter: async () => [],
    create: async (d) => { scritte.push({ nome, op: 'create', d }); return { id: 'x', ...d }; },
    update: async (id, d) => { scritte.push({ nome, op: 'update', id, d }); return { id, ...d }; },
    delete: async () => ({}),
  });
  const base44 = { asServiceRole: { entities: new Proxy({}, { get: (_t, n) => ent(String(n)) }) } };
  const v = Q.valutaSoggetto(alfa, [contratto], [c26, aciNonConforme('2026-03-02')], OTT);
  const salvato = await prova(() => Q.salvaRiepilogo(base44, 2026, [v], []));
  const critici = (salvato && salvato.soggetti_critici) || [];
  verifica('nel riepilogo salvato ALFA e\' fra i critici, col contratto non conforme: la passiva avvisa prima di pagare', critici.some(s => s.chiave === 'alfa' && (s.non_conformi || []).includes('Contratto con SMOCO')), J(salvato));
  verifica('e non si chiude nessun contratto', !scritte.some(s => s.nome === 'DocumentoQualifica'), J(scritte));

  // Rete e ACI validi tutti e due: requisito valido, tutti e due in corso.
  const aciValido = doc({ id: 'a26', file_nome: 'Contratto ACI 2026.pdf', data_emissione: '2026-03-02', data_scadenza: '2026-12-31' });
  const r2 = requisitoDi([c26, aciValido], OTT);
  verifica('rete e ACI validi: requisito valido, e tutti e due sono contratti in corso', r2.stato === 'valido' && [...(r2.contratti_in_corso || [])].sort().join() === 'a26,c26' && altriDi(r2).length === 1, J(r2.contratti_in_corso));

  // Un documento piu' vecchio del contratto in corso non e' «caricato dopo»:
  // con le date lette male e scaduto si chiude come gli altri finiti, senza nota.
  const c25 = doc({ id: 'c25', file_nome: 'Contratto 2025.pdf', data_emissione: '2025-03-01', data_scadenza: '2025-01-31' });
  const r3 = requisitoDi([c26, c25], OTT);
  verifica('un contratto piu\' vecchio letto male non e\' «caricato dopo»: niente nota, e va fra i superati', r3.documento && r3.documento.id === 'c26' && !(r3.problemi || []).some(p => /caricato dopo/.test(p.messaggio)) && J(r3.superati) === '["c25"]', J({ problemi: r3.problemi, superati: r3.superati }));
  // Senza data ne' caricamento noti (lo script del revisore sul caricamento a
  // mano) il documento si tiene per nuovo: il requisito resta sul 2026.
  const senzaDate = doc({ id: 'c27', file_nome: 'Contratto 2027 firmato.pdf', analisi_stato: 'errore', errore_analisi: 'Limite di richieste raggiunto' });
  const r4 = requisitoDi([c26, senzaDate]);
  verifica('il contratto nuovo senza date con la lettura fallita: requisito in scadenza sul 2026, il nuovo accanto', r4.stato === 'in_scadenza' && r4.documento.id === 'c26' && altriDi(r4).some(a => a.id === 'c27' && a.relazione === 'successivo'), `${r4.stato} ${r4.documento && r4.documento.id}`);
}

console.log('3. LA SCHEDA DA\' AL CONTRATTO NUOVO I SUOI PULSANTI');
let pagina = null;
try { pagina = await caricaPagina('components/qualifica/SoggettoDettaglio.jsx'); } catch (e) { verifica('la scheda del fornitore si impacchetta', false, String(e && e.message).slice(0, 300)); }
const M = (pagina && pagina.modulo) || {};
const premi = (albero, etichetta) => trova(albero, el => el.props && typeof el.props.onClick === 'function' && testo(el.props.children).trim() === etichetta);
{
  verifica('la scheda espone Requisito, DocumentoAccanto e AzioniDocumento', typeof M.Requisito === 'function' && typeof M.DocumentoAccanto === 'function' && typeof M.AzioniDocumento === 'function');
  if (typeof M.Requisito === 'function' && typeof M.DocumentoAccanto === 'function' && typeof M.AzioniDocumento === 'function') {
    const req = requisitoDi([c26, c27(CASI['scadenza non letta'].campi)]);
    const chiamate = [];
    const spie = {
      onCarica: (...a) => chiamate.push(['carica', ...a]),
      onApri: (d) => chiamate.push(['apri', d && d.id]),
      onAnalizza: (id) => chiamate.push(['analizza', id]),
      onSalvaCorrezione: async (d, valori, r) => { chiamate.push(['correggi', d && d.id, valori, r && r.tipo_id]); return true; },
    };
    const scheda = pagina.monta(M.Requisito, { req, soggetto: alfa, isAdmin: true, occupato: false, ...spie });
    const azioni = trova(scheda.albero, 'AzioniDocumento');
    const accanto = trova(scheda.albero, 'DocumentoAccanto');
    verifica('i pulsanti del requisito sono sul documento del requisito, il 2026', azioni.length === 1 && azioni[0].props.doc && azioni[0].props.doc.id === 'c26', J(azioni.map(a => a.props.doc && a.props.doc.id)));
    verifica('il 2027 ha il suo riquadro', accanto.length === 1 && accanto[0].props.altro && accanto[0].props.altro.id === 'c27', J(accanto.map(a => a.props.altro && a.props.altro.id)));
    const righe = trova(scheda.albero, 'li').map(li => testo(li));
    verifica('la nota sul 2027 non sta sopra i pulsanti del 2026', !righe.some(t => /caricato dopo/.test(t)), J(righe));

    if (accanto.length === 1) {
      const riquadro = pagina.monta(M.DocumentoAccanto, accanto[0].props);
      const scritto = testo(riquadro.albero);
      verifica('il riquadro dice il file, che e\' caricato dopo, e il suo stato', /Contratto 2027 firmato\.pdf/.test(scritto) && /Caricato dopo/.test(scritto) && trova(riquadro.albero, el => el.props && el.props.stato === 'da_verificare').length === 1, scritto.slice(0, 300));
      const azioniNuovo = trova(riquadro.albero, 'AzioniDocumento');
      verifica('e i suoi pulsanti sono sul 2027', azioniNuovo.length === 1 && azioniNuovo[0].props.doc.id === 'c27' && azioniNuovo[0].props.isAdmin === true, J(azioniNuovo.map(a => a.props.doc && a.props.doc.id)));

      if (azioniNuovo.length === 1) {
        const bottoni = pagina.monta(M.AzioniDocumento, azioniNuovo[0].props);
        for (const [etichetta] of [['Apri'], ['Rianalizza']]) { const b = premi(bottoni.albero, etichetta); if (b.length) b[0].props.onClick(); }
        verifica('Apri apre il 2027', chiamate.some(c => c[0] === 'apri' && c[1] === 'c27'), J(chiamate));
        verifica('Rianalizza rilegge il 2027', chiamate.some(c => c[0] === 'analizza' && c[1] === 'c27'), J(chiamate));
        const correggi = premi(bottoni.albero, 'Correggi');
        if (correggi.length) correggi[0].props.onClick();
        await aspetta();
        verifica('la maschera dice che si corregge il 2027', /Correzione di «Contratto 2027 firmato\.pdf»/.test(testo(bottoni.albero)), testo(bottoni.albero).slice(0, 200));
        const data = trova(bottoni.albero, el => el.type === 'input' && el.props.type === 'date');
        if (data.length) data[0].props.onChange({ target: { value: '2027-12-31' } });
        await aspetta();
        const salva = premi(bottoni.albero, 'Salva');
        if (salva.length) await salva[0].props.onClick();
        await aspetta();
        const scrittura = chiamate.find(c => c[0] === 'correggi');
        verifica('«Correggi» del 2027 scrive la scadenza sul 2027, non sul 2026', !!scrittura && scrittura[1] === 'c27' && scrittura[2] && scrittura[2].scadenza === '2027-12-31' && scrittura[3] === 'tc', J(scrittura));
      }
    }
    // I pulsanti del requisito restano sul 2026: la sua correzione va sul 2026.
    if (azioni.length === 1) {
      const suoi = pagina.monta(M.AzioniDocumento, azioni[0].props);
      const correggi = premi(suoi.albero, 'Correggi');
      if (correggi.length) correggi[0].props.onClick();
      await aspetta();
      const salva = premi(suoi.albero, 'Salva');
      if (salva.length) await salva[0].props.onClick();
      await aspetta();
      const scritture = chiamate.filter(c => c[0] === 'correggi');
      verifica('«Correggi» del requisito scrive sul 2026', scritture.length === 2 && scritture[1][1] === 'c26', J(scritture));
      verifica('il caricamento resta sul requisito, coi suoi pulsanti', premi(suoi.albero, 'Apri').length === 1 && !!azioni[0].props.prima, J(Object.keys(azioni[0].props)));
    }
    // Senza amministratore niente pulsanti, ne' sul 2026 ne' sul 2027.
    if (accanto.length === 1) {
      const azioniNuovo = trova(pagina.monta(M.DocumentoAccanto, { ...accanto[0].props, isAdmin: false }).albero, 'AzioniDocumento');
      const vuoto = azioniNuovo.length === 1 ? pagina.monta(M.AzioniDocumento, azioniNuovo[0].props).albero : 'manca';
      verifica('chi consulta non vede i pulsanti del 2027', vuoto === null, J(vuoto));
    }
  }
}

console.log('4. IL CARICAMENTO A MANO NON SOSTITUISCE IL CONTRATTO IN CORSO');
{
  const daSostituire = M.documentiDaSostituire || (() => { throw new Error('non esiste'); });
  const req = requisitoDi([c26, c27(CASI['bloccante del modello'].campi)]);
  const precedenti = [{ ...c26 }, { ...c27(CASI['bloccante del modello'].campi) }, { id: 'nuovo' }];
  const scelti = prova(() => daSostituire(req, precedenti, 'nuovo'));
  verifica('dicembre, contratto: si sostituisce il 2027 letto male, non il 2026 in corso', Array.isArray(scelti) && scelti.map(p => p.id).join() === 'c27', J(scelti));
  const reqDurc = requisitoDi([doc({ id: 'durc1', tipo_documento_id: 'td', data_emissione: '2026-08-01', data_scadenza: '2026-11-29' })], '2026-10-13', [durc]);
  const sceltiDurc = prova(() => daSostituire(reqDurc, [{ id: 'durc1' }, { id: 'nuovo' }], 'nuovo'));
  verifica('un DURC si sostituisce come sempre', Array.isArray(sceltiDurc) && sceltiDurc.map(p => p.id).join() === 'durc1', J(sceltiDurc));
  // Un contratto non conforme, anche se non ancora scaduto, si sostituisce:
  // altrimenti resterebbe critico accanto a quello corretto.
  const reqNc = requisitoDi([doc({ id: 'nc', data_emissione: '2026-01-02', data_scadenza: '2026-12-31', problemi_json: JSON.stringify([{ gravita: 'bloccante', messaggio: 'Manca la firma del fornitore.' }]) })], '2026-10-13');
  const sceltiNc = prova(() => daSostituire(reqNc, [{ id: 'nc' }, { id: 'nuovo' }], 'nuovo'));
  verifica('il contratto non conforme si sostituisce', Array.isArray(sceltiNc) && sceltiNc.map(p => p.id).join() === 'nc', J(sceltiNc));

  // La catena vera: la scheda carica il file e scrive solo il sostituito.
  if (pagina && typeof pagina.Componente === 'function') {
    const c = clienteFinto({ archivi: { DocumentoQualifica: precedenti.filter(p => p.id !== 'nuovo') }, funzioni: { analizzaDocumentoQualifica: async () => ({}) } });
    c.cliente.integrations = { Core: { UploadPrivateFile: async () => ({ file_uri: 'privato://nuovo' }) } };
    globalThis.__CLIENTE_FINTO = c.cliente;
    let aggiornata = 0;
    const scheda = pagina.monta(pagina.Componente, { soggetto: { ...alfa, stato: 'in_scadenza', requisiti: [req], obbligatori_validi: 1, obbligatori_totali: 1 }, anno: 2026, isAdmin: true, open: true, onClose() {}, onAggiorna: async () => { aggiornata++; }, onEscludi() {} });
    const requisiti = trova(scheda.albero, 'Requisito');
    if (requisiti.length) await requisiti[0].props.onCarica(req, { name: 'Contratto 2027 corretto.pdf', size: 1000 });
    await aspetta();
    const aggiornamenti = c.chiamate.filter(x => x.tipo === 'scrittura' && x.nome === 'DocumentoQualifica' && x.metodo === 'update').map(x => x.id);
    verifica('caricato dalla scheda a dicembre: fra i sostituiti va solo il 2027 letto male, il 2026 resta', requisiti.length === 1 && aggiornamenti.join() === 'c27', J(c.chiamate));
    verifica('il nuovo nasce e si fa leggere, la pagina si aggiorna', c.chiamate.some(x => x.metodo === 'create' && x.nome === 'DocumentoQualifica') && c.funzioniChiamate('analizzaDocumentoQualifica').some(x => x.payload.documento_id === 'nuovo') && aggiornata > 0, J(c.chiamate));
    // Lo stesso caricamento, tolti i contratti in corso dal requisito, faceva quello di prima.
    const nuovoReq = Q.valutaSoggetto(alfa, [contratto], [c26, { id: 'nuovo', ...doc({ analisi_stato: 'in_attesa', created_date: new Date().toISOString() }) }], DIC).requisiti[0];
    verifica('e col 2026 rimasto attivo il requisito resta sul 2026, il fornitore non scende', nuovoReq.stato === 'in_scadenza' && nuovoReq.documento.id === 'c26', `${nuovoReq.stato} ${nuovoReq.documento && nuovoReq.documento.id}`);
  }
}

console.log('5. LA PAGINA SI AGGIORNA DA SOLA COL CONTRATTO NUOVO IN LETTURA');
{
  const CLIENT_FINTO = 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: {}, integrations: { Core: {} }, auth: {} };';
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(existsSync) || base; };
  let inLettura = null;
  globalThis.window = globalThis.window || { self: 1, top: 1 };
  try {
    const pacchetto = await build({
      stdin: { contents: `export { documentoInLettura } from ${JSON.stringify(qui('../src/pages/QualificaFornitori.jsx'))};`, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      loader: { '.jsx': 'jsx', '.js': 'jsx' },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'finti', setup(b) {
        b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
        b.onResolve({ filter: /^@\/lib\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'client-finto' }));
        b.onLoad({ filter: /.*/, namespace: 'client-finto' }, (a) => ({ contents: a.path === 'auth' ? 'export const useAuth = () => ({ user: null });' : CLIENT_FINTO, loader: 'js' }));
        b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
      } }],
    });
    ({ documentoInLettura: inLettura } = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64')));
  } catch (e) { verifica('la pagina Qualifica si impacchetta', false, String(e && e.message).slice(0, 300)); }
  verifica('la pagina espone la regola del giro di aggiornamento (documentoInLettura)', typeof inLettura === 'function');
  if (typeof inLettura === 'function') {
    const dati = (req) => ({ soggetti: [{ ...alfa, requisiti: [req] }] });
    const inCorso = requisitoDi([c26, c27(CASI['lettura in corso'].campi)]);
    verifica('il contratto nuovo in lettura accanto al requisito in scadenza fa ripartire il giro', inCorso.stato === 'in_scadenza' && inLettura(dati(inCorso)) === true, inCorso.stato);
    verifica('il nuovo letto (da verificare) no: la pagina non gira a vuoto', inLettura(dati(requisitoDi([c26, c27(CASI['scadenza non letta'].campi)]))) === false);
    verifica('un requisito in analisi lo fa ripartire, come prima', inLettura(dati(requisitoDi([c27(CASI['lettura in corso'].campi)])) ) === true);
    verifica('senza dati niente giro', inLettura(null) === false);
  }
  const src = readFileSync(qui('../src/pages/QualificaFornitori.jsx'), 'utf8').replace(/\r/g, '');
  verifica('il giro dei dieci secondi parte da quella regola', /const inAnalisi = documentoInLettura\(dati\);\s*useEffect\(\(\) => \{\s*if \(!inAnalisi\) return undefined;\s*const t = setTimeout\(\(\) => \{ aggiorna\(\); \}, 10000\);/.test(src));
}

console.log('6. ECOTYNA CONTA IL DOCUMENTO DEL REQUISITO');
{
  const oggi = Q.oggiRoma();
  const anno = Number(oggi.slice(0, 4));
  const tra = (giorni) => Q.aggiungiPeriodo(oggi, 0, giorni);
  const archivio = (db) => {
    const letture = {};
    const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
    const entities = new Proxy({}, { get: (_t, nome) => {
      const e = String(nome);
      return {
        filter: async (f, _o, n = 5000, s = 0) => { letture[e] = (letture[e] || 0) + 1; return (db[e] || []).filter(r => uguale(r, f)).slice(s, s + n); },
        list: async (_o, n = 5000, s = 0) => { letture[e] = (letture[e] || 0) + 1; return (db[e] || []).slice(s, s + n); },
      };
    } });
    return { base44: { asServiceRole: { entities } }, letture };
  };
  const strumento = STRUMENTI.find(s => s.nome === 'qualifica_fornitori');
  const esegui = async (documenti) => { const a = archivio({ TipoDocumentoQualifica: [contratto], DocumentoQualifica: documenti, TargetRaccoglitore: [], TargetMensile: [] }); const r = await strumento.esegui(a.base44, { anno }); return { r, letture: a.letture }; };
  const alfaDi = (r) => ((r.dati.soggetti && r.dati.soggetti.righe) || []).find(s => s.soggetto === 'ALFA SRL') || {};
  const vecchio = (campi) => doc({ id: 'cv', file_nome: 'Contratto in corso.pdf', data_emissione: `${anno}-01-02`, ...campi });
  const nuovo = (campi) => doc({ id: 'cn', file_nome: 'Contratto nuovo.pdf', ...campi });

  // Il vecchio scaduto ieri accanto al nuovo valido, prima del calcolo che lo chiude.
  const a = alfaDi((await esegui([vecchio({ data_emissione: `${anno - 1}-01-02`, data_scadenza: tra(-1) }), nuovo({ data_emissione: `${anno}-01-02`, data_scadenza: `${anno + 1}-12-31` })])).r);
  verifica('il vecchio scaduto accanto al nuovo valido non e\' «scaduto»: un documento, valido', a.documenti === 1 && a.validi === 1 && a.scaduti === 0 && (a.dettaglio || []).length === 0, J(a));
  // A dicembre: il vecchio in scadenza e il nuovo appena caricato, in lettura.
  const b = alfaDi((await esegui([vecchio({ data_scadenza: tra(30) }), nuovo({ analisi_stato: 'in_attesa', created_date: new Date().toISOString(), data_emissione: oggi })])).r);
  const db = (b.dettaglio || [])[0] || {};
  verifica('vecchio in scadenza e nuovo in lettura: il fornitore si conta una volta, in scadenza', b.documenti === 1 && b.in_scadenza === 1 && b.da_verificare === 0, J(b));
  verifica('e la nota dice del contratto nuovo in analisi', db.stato === 'in_scadenza' && (db.motivi || []).some(m => /caricato dopo questo, «Contratto nuovo\.pdf», è in analisi/.test(m)), J(db));
  // Il vecchio ancora valido e il nuovo con la lettura fallita: valido, con la nota.
  const c = alfaDi((await esegui([vecchio({ data_scadenza: tra(90) }), nuovo({ analisi_stato: 'errore', errore_analisi: 'Limite di richieste raggiunto', data_emissione: oggi })])).r);
  const dc = (c.dettaglio || [])[0] || {};
  verifica('vecchio valido e nuovo da rileggere: valido, non «da verificare»', c.documenti === 1 && c.validi === 1 && c.da_verificare === 0, J(c));
  verifica('e il dettaglio dice del nuovo da verificare, col perche\'', dc.stato === 'valido' && dc.file === 'Contratto in corso.pdf' && (dc.motivi || []).some(m => /caricato dopo questo, «Contratto nuovo\.pdf», è da verificare \(La lettura automatica del file non ha funzionato/.test(m)), J(dc));
  // Rete e ACI dello stesso anno, l'ACI non conforme: non conforme, come il modulo.
  const docsNc = [vecchio({ data_scadenza: `${anno}-12-31` }), nuovo({ data_emissione: `${anno}-03-02`, data_scadenza: `${anno}-12-31`, problemi_json: JSON.stringify([{ gravita: 'bloccante', messaggio: 'Manca la firma del fornitore.' }]) })];
  const d = alfaDi((await esegui(docsNc)).r);
  const modulo = Q.valutaSoggetto(alfa, [contratto], docsNc, oggi);
  verifica('rete valida e ACI non conforme: non conforme, come dice il modulo', d.documenti === 1 && d.non_conformi === 1 && d.validi === 0 && modulo.requisiti[0].stato === 'non_conforme', J({ d, modulo: modulo.requisiti[0].stato }));
  // Nessuna lettura in piu': tre documenti costano quanto uno.
  const uno = await esegui([vecchio({ data_scadenza: tra(90) })]);
  const tre = await esegui([vecchio({ data_scadenza: tra(90) }), nuovo({ analisi_stato: 'errore', data_emissione: oggi }), doc({ id: 'cx', data_emissione: `${anno - 1}-01-02`, data_scadenza: tra(-30) })]);
  const totale = (l) => Object.values(l).reduce((s, n) => s + n, 0);
  verifica('nessuna lettura in piu\'', totale(uno.letture) === totale(tre.letture), J({ uno: uno.letture, tre: tre.letture }));
}

console.log('7. LA FUNZIONE VERA (qualificaFornitori sul banco)');
{
  const modulo = await caricaFunzione('qualificaFornitori');
  const oggi = Q.oggiRoma();
  const anno = Number(oggi.slice(0, 4));
  const inCorso = doc({ id: 'k-in-corso', file_nome: 'Contratto in corso.pdf', file_uri: 'privato://k-in-corso', data_emissione: `${anno}-01-02`, data_scadenza: Q.aggiungiPeriodo(oggi, 0, 30) });
  const nuovo = doc({ id: 'k-nuovo', file_nome: 'Contratto nuovo.pdf', file_uri: 'privato://k-nuovo', data_emissione: `${anno + 1}-01-02`, data_scadenza: null });
  const db = { TipoDocumentoQualifica: [contratto], DocumentoQualifica: [inCorso, nuovo], TargetRaccoglitore: [], TargetMensile: [], RiepilogoQualifica: [] };
  const r = await chiama(modulo, { db, ruolo: 'admin', corpo: { anno, soggetti: [alfa], esclusi: [] } });
  const req = (((r.j.soggetti || [])[0] || {}).requisiti || [])[0] || {};
  const altro = altriDi(req).find(x => x.id === 'k-nuovo');
  verifica('la funzione risponde col requisito sul contratto in corso e il nuovo accanto', r.stato === 200 && req.documento && req.documento.id === 'k-in-corso' && !!altro && altro.stato === 'da_verificare' && altro.relazione === 'successivo', J({ stato: r.stato, req: req.stato, altri: altriDi(req) }));
  verifica('nella risposta non c\'e\' nessun file_uri', !JSON.stringify(r.j).includes('privato://') && altro && altro.ha_file === true, J(altro));
  verifica('i contratti in corso arrivano alla pagina', J(req.contratti_in_corso) === '["k-in-corso"]', J(req.contratti_in_corso));
  verifica('e non si chiude niente', !r.scritte.some(s => s.entita === 'DocumentoQualifica'), J(r.scritte));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
