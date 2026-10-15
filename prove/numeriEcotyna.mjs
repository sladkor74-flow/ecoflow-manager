// Prova dei NUMERI DI ECOTYNA, ALL'ITALIANA (utente, 10/10/2026: «sistema i numeri
// di Ecotyna» e poi: «con il punto alle migliaia e la virgola che separa le cifre
// decimali, fino a tre se servono e sono significative»).
//
// I dati arrivano al modello come numeri informatici e a volte li ricopiava cosi':
// «ECO.GEA SRL, rete, giugno 2026: 1600.00 euro per 3.38 t», mentre poco prima
// aveva scritto bene «372.976,50 euro». Ora la regola e' nelle istruzioni
// (3-duodecies) e dopo la risposta passa numeriAllItaliana: tonnellate da due a
// tre decimali, euro due, il resto fino a tre senza zeri inutili. Ore, date,
// numeri d'ordine e articoli non hanno un'unita' e restano come sono; «3.385 t»
// (tre o tremila?) si decide coi numeri che EcoTyna ha ricevuto.
// npm run prove
import { readFileSync } from 'node:fs';
import { numeriAllItaliana as f, numeriDeiDati, dateAllItaliana, testoAllItaliana } from '../base44/shared/formato.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const caso = (dentro, atteso, nome, valori = null) => verifica(`${nome}: «${dentro}» -> «${atteso}»`, f(dentro, valori) === atteso, `uscito «${f(dentro, valori)}»`);

console.log('SI CONVERTE');
caso('ECO.GEA SRL, rete, giugno 2026: 1600.00 euro per 3.38 t di PFU raccolte.', 'ECO.GEA SRL, rete, giugno 2026: 1.600,00 euro per 3,38 t di PFU raccolte.', 'la risposta vera del 10/10');
caso('Totale 8818.55 t', 'Totale 8.818,55 t', 'le migliaia mancanti');
caso('1,617.22 t', '1.617,22 t', 'le migliaia all\'inglese');
caso('12400 kg', '12.400 kg', 'i chili interi');
caso('12.5 t', '12,50 t', 'tonnellate: almeno due decimali');
caso('3.3851 t', '3,385 t', 'tonnellate: al massimo tre decimali');
caso('€ 1600.5', '€ 1.600,50', 'euro col simbolo davanti, sempre due decimali');
caso('€1,234.56', '€1.234,56', 'euro all\'inglese col simbolo');
caso('copertura 76.4%', 'copertura 76,4%', 'percentuali col loro decimale');
caso('copertura 76.40%', 'copertura 76,4%', 'senza zeri inutili in coda');
caso('0.5 tonnellate', '0,50 tonnellate', 'la parola intera, sempre due decimali');
caso('12.5 kg', '12,5 kg', 'i chili coi decimali che hanno');

console.log('TRE DECIMALI: SI DECIDE COI DATI');
{
  // I numeri che EcoTyna ha ricevuto: tonnellate in tonnellate, chili in chili.
  const valori = numeriDeiDati([{ tonnellate: 3.385, righe: [{ kg: 3385 }] }, { t: 0.125, euro: 1600, scarto: 3.38 }]);
  caso('3.385 t', '3,385 t', 'fra i dati c\'e\' 3,385: sono tre tonnellate', valori);
  caso('3.385 kg', '3.385 kg', 'fra i dati c\'e\' 3385 kg: sono tremila chili', valori);
  caso('0.125 t', '0,125 t', 'tre decimali significativi', valori);
  caso('3.380 t', '3,38 t', 'il terzo decimale a zero non serve', valori);
  caso('1.600 euro', '1.600 euro', 'gli euro coi dati: milleseicento', valori);
  caso('3.385 t', '3.385 t', 'senza i dati non si tira a indovinare');
}

console.log('NON SI TOCCA');
caso('372.976,50 euro', '372.976,50 euro', 'gia\' all\'italiana');
caso('1.617,22 t', '1.617,22 t', 'gia\' all\'italiana, le tonnellate');
caso('alle 10.30 del 2026-06-30', 'alle 10.30 del 2026-06-30', 'ore e date');
caso('il FIR RGYTR025688FF e l\'ordine ET26152600', 'il FIR RGYTR025688FF e l\'ordine ET26152600', 'numeri di formulario e d\'ordine');
caso('2.059 righe di Baucina', '2.059 righe di Baucina', 'un conto senza unita\'');
caso('art. 188.1 del D.Lgs. 152/2006', 'art. 188.1 del D.Lgs. 152/2006', 'gli articoli di legge');
caso('', '', 'il vuoto');

console.log('ECOTYNA LA USA');
{
  const src = readFileSync(new URL('../base44/functions/chiediAssistente/entry.ts', import.meta.url), 'utf8');
  verifica('la regola e\' nelle istruzioni, coi tre decimali significativi', /3-duodecies\. I numeri si scrivono all\\'italiana: punto per le migliaia e virgola per i decimali, con fino a tre cifre decimali quando servono e sono significative/.test(src));
  verifica('la regola delle date e\' nelle istruzioni', /3-terdecies\. Le date si scrivono all\\'italiana, giorno\/mese\/anno/.test(src));
  verifica('la risposta salvata passa dalla conversione di numeri e date, coi numeri dei dati', /risposta: testoAllItaliana\(String\(esito\.risposta[^\n]*numeriDeiDati\(risultati\.map\(r => r\.dati\)\)\)/.test(src));
  verifica('e anche quella restituita alla pagina', (src.match(/testoAllItaliana\(String\(esito\.risposta[^\n]*numeriDeiDati\(risultati/g) || []).length === 2);
}

console.log("LE DATE ALL'ITALIANA (utente, 10/10/2026: «sistema anche le date»)");
{
  const d = (dentro, atteso, nome) => verifica(`${nome}: «${dentro}» -> «${atteso}»`, dateAllItaliana(dentro) === atteso, `uscito «${dateAllItaliana(dentro)}»`);
  d('aggiornata al 2026-10-05.', 'aggiornata al 05/10/2026.', 'la risposta vera del 10/10');
  d('dal 2026-01-01 al 2026-12-31', 'dal 01/01/2026 al 31/12/2026', 'un intervallo');
  d('fine trasporto 2026-06-30T23:30:00Z', 'fine trasporto 01/07/2026', "un istante: il giorno italiano, a Roma e' gia' luglio");
  d('fine trasporto 2026-06-30T10:00:00.000Z', 'fine trasporto 30/06/2026', 'un istante di giorno');
  d('il file report_2026-10-05.xlsx', 'il file report_2026-10-05.xlsx', 'nei nomi dei file non si tocca');
  d('ET26-2026-10-05', 'ET26-2026-10-05', 'nei codici non si tocca');
  d('2026-13-45', '2026-13-45', 'una data che non esiste non si inventa');
  d('gia\' 05/10/2026', 'gia\' 05/10/2026', 'gia\' all\'italiana');
  verifica('numeri e date insieme', testoAllItaliana('1600.00 euro al 2026-10-05') === '1.600,00 euro al 05/10/2026', testoAllItaliana('1600.00 euro al 2026-10-05'));
}

console.log("RAGGRUPPARE NON E' FILTRARE");
{
  // Visto in produzione il 10/10/2026: «lo strumento delle giacenze non permette di
  // raggruppare per classe» su una risposta che le classi le dava.
  const R = new URL('../base44/shared/', import.meta.url).href;
  const { strumentiDalPiano } = await import(R + 'pianoAssistente.ts');
  const { catalogoStrumenti } = await import(R + 'strumentiAssistente.ts');
  const [g] = strumentiDalPiano({ strumenti: [{ nome: 'giacenze', parametri: { sito: 'Nappi Sud', raggruppa: 'classe' } }], canali: [], periodo: { anno: 2026 } }, catalogoStrumenti(), '2026-10-10', 'Che giacenza per classe ha il piazzale di Nappi Sud?');
  verifica('il raggruppamento non finisce fra i filtri ignorati', g && (g.ignorati || []).length === 0, JSON.stringify(g && g.ignorati));
}

console.log('LE RICHIESTE ECT DI DICEMBRE ANCORA APERTE A GENNAIO');
{
  // Prova del cambio d'anno del 15/10/2026, difetto 2 (la parte di EcoTyna): lo
  // strumento richieste_ect leggeva solo l'anno di oggi, e il 05/01/2027 una
  // richiesta di dicembre aperta e scaduta spariva («aperte 0, scadute 0»).
  const R = new URL('../base44/shared/', import.meta.url).href;
  const { strumentiDalPiano } = await import(R + 'pianoAssistente.ts');
  const { catalogoStrumenti, eseguiStrumento } = await import(R + 'strumentiAssistente.ts');
  const RICHIESTE = [
    // aperta e oltre il termine
    { id: 'e1', anno: 2026, pdr_nome: 'GOMMISTA ROSSI', provincia: 'BA', mail_inviata_il: '2026-12-10', nota: 'DA FARE ENTRO IL 20/12', scadenza: '2026-12-20', esito: 'aperta' },
    // ritirata, aspetta la risposta al consorzio
    { id: 'e2', anno: 2026, pdr_nome: 'GOMMISTA BIANCHI', provincia: 'LE', mail_inviata_il: '2026-12-15', scadenza: '2026-12-31', esito: 'evasa', evasione_confermata: false, evasione_rilevata_il: '2026-12-22' },
    // chiusa e risposta: resta nel suo anno
    { id: 'e3', anno: 2026, pdr_nome: 'GOMMISTA VERDI', provincia: 'NA', mail_inviata_il: '2026-11-20', scadenza: '2026-11-30', esito: 'evasa', evasione_confermata: true, evaso_il: '2026-11-25' },
    // annullata: resta nel suo anno
    { id: 'e4', anno: 2026, pdr_nome: 'GOMMISTA NERI', provincia: 'SA', mail_inviata_il: '2026-11-02', esito: 'annullata', motivo_annullamento: 'doppione' },
    // dell'anno nuovo
    { id: 'e5', anno: 2027, pdr_nome: 'GOMMISTA GIALLI', provincia: 'BA', mail_inviata_il: '2027-01-04', scadenza: '2027-01-20', esito: 'aperta' },
  ];
  const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => (v === null ? (r[k] == null || r[k] === '') : r[k] === v));
  const letture = [];
  const sdk = { asServiceRole: { entities: new Proxy({}, { get: (_t, n) => ({
    filter: async (f, _o, lim = 5000, skip = 0) => { letture.push([n, JSON.stringify(f)]); return (n === 'RichiestaEct' ? RICHIESTE : []).filter(r => uguale(r, f)).slice(skip, skip + lim).map(r => ({ ...r })); },
    list: async (_o, lim = 5000, skip = 0) => { letture.push([n, 'tutto']); return (n === 'RichiestaEct' ? RICHIESTE : []).slice(skip, skip + lim).map(r => ({ ...r })); },
  }) }) } };
  const OraVera = Date;
  const alle = async (iso, f) => {
    const ms = OraVera.parse(iso);
    globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
    try { return await f(); } finally { globalThis.Date = OraVera; }
  };
  const piano = { strumenti: [{ nome: 'richieste_ect', parametri: {} }], canali: [], periodo: {}, serve_normativa: false };
  const [x] = strumentiDalPiano(piano, catalogoStrumenti(), '2027-01-05', 'quali richieste ECT arrivate via email sono ancora aperte?');
  verifica('il piano senza anno non scrive l\'anno di oggi alle Richieste ECT', x && x.nome === 'richieste_ect' && x.parametri.anno === undefined, JSON.stringify(x && x.parametri));
  const [conAnno] = strumentiDalPiano(piano, catalogoStrumenti(), '2027-01-05', 'quante richieste ECT abbiamo ricevuto via email nel 2026?');
  verifica('un anno scritto nella domanda arriva allo strumento', conAnno && conAnno.parametri.anno === 2026, JSON.stringify(conAnno && conAnno.parametri));
  // Revisione del 15/10/2026: il pianificatore riempie il periodo con l'anno di
  // oggi per abitudine. Col piano {periodo: {anno: 2027}} lo strumento leggeva
  // solo il 2027 e la richiesta di dicembre aperta e scaduta spariva lo stesso.
  const abitudine = { ...piano, periodo: { anno: 2027 } };
  const [xa] = strumentiDalPiano(abitudine, catalogoStrumenti(), '2027-01-05', 'quali richieste ECT arrivate via email sono ancora aperte?');
  verifica('l\'anno di oggi scritto dal piano nel periodo non arriva, se la domanda non dice un anno', xa && xa.parametri.anno === undefined, JSON.stringify(xa && xa.parametri));
  const [xp] = strumentiDalPiano({ ...piano, strumenti: [{ nome: 'richieste_ect', parametri: { anno: 2027 } }] }, catalogoStrumenti(), '2027-01-05', 'quali richieste ECT arrivate via email sono ancora aperte?');
  verifica('nemmeno scritto nei parametri', xp && xp.parametri.anno === undefined, JSON.stringify(xp && xp.parametri));
  const abitudineEsito = await alle('2027-01-05T09:00:00Z', () => eseguiStrumento(sdk, 'richieste_ect', xa.parametri, null));
  verifica('e lo strumento, col piano di abitudine, da\' anche la richiesta di dicembre aperta e scaduta', (abitudineEsito.dati || {}).aperte === 2 && (abitudineEsito.dati || {}).scadute === 1, JSON.stringify({ periodo: abitudineEsito.periodo, aperte: (abitudineEsito.dati || {}).aperte, scadute: (abitudineEsito.dati || {}).scadute }));
  // La controprova: un anno detto nella domanda, anche a parole, arriva.
  const [scorso] = strumentiDalPiano({ ...piano, periodo: { anno: 2026 } }, catalogoStrumenti(), '2027-01-05', 'quante richieste ECT dell\'anno scorso sono ancora aperte?');
  verifica('«dell\'anno scorso» col piano {anno 2026}: arriva il 2026', scorso && scorso.parametri.anno === 2026, JSON.stringify(scorso && scorso.parametri));
  const [questo] = strumentiDalPiano(abitudine, catalogoStrumenti(), '2027-01-05', 'quante richieste ECT abbiamo ricevuto quest’anno?');
  verifica('«quest’anno» col piano {anno 2027}: arriva il 2027', questo && questo.parametri.anno === 2027, JSON.stringify(questo && questo.parametri));

  letture.length = 0;
  const gen = await alle('2027-01-05T09:00:00Z', () => eseguiStrumento(sdk, 'richieste_ect', x.parametri, null));
  const d = gen.dati || {};
  const ids = (dd) => ((dd.richieste || {}).righe || []).map(r => `${r.pdr}|${r.anno}`).sort().join(',');
  verifica('05/01/2027: la richiesta di dicembre aperta e scaduta c\'e\', con quella dell\'anno nuovo', d.aperte === 2 && d.scadute === 1, JSON.stringify({ aperte: d.aperte, scadute: d.scadute }));
  verifica('c\'e\' anche quella evasa e non ancora risposta; ogni riga dice il suo anno', ids(d) === 'GOMMISTA BIANCHI|2026,GOMMISTA GIALLI|2027,GOMMISTA ROSSI|2026', ids(d));
  verifica('la chiusa e risposta e l\'annullata del 2026 non ci sono', !/VERDI|NERI/.test(ids(d)));
  verifica('il periodo lo dice, e i dati contano quelle degli anni prima', gen.periodo === 'anno 2027, con le richieste del 2026 non ancora chiuse' && d.dagli_anni_prima === 2 && /2 richieste sono del 2026/.test(d.nota_anni_prima || ''), JSON.stringify({ periodo: gen.periodo, n: d.dagli_anni_prima }));
  verifica('una lettura sola delle Richieste ECT, senza filtro sull\'anno', letture.filter(([n]) => n === 'RichiestaEct').length === 1 && !letture.some(([n, f]) => n === 'RichiestaEct' && /anno/.test(f)), JSON.stringify(letture));
  // La controprova: con l'anno chiesto ci sono tutte e sole quelle di quell'anno.
  const del2026 = await alle('2027-01-05T09:00:00Z', () => eseguiStrumento(sdk, 'richieste_ect', { anno: 2026 }, null));
  verifica('con l\'anno 2026 chiesto ci sono tutte le richieste del 2026, chiuse comprese', ids(del2026.dati || {}) === 'GOMMISTA BIANCHI|2026,GOMMISTA NERI|2026,GOMMISTA ROSSI|2026,GOMMISTA VERDI|2026' && del2026.periodo === 'anno 2026', ids(del2026.dati || {}));
  // Il 28/12/2026 come prima: le richieste dell'anno, tutte.
  const dic = await alle('2026-12-28T09:00:00Z', () => eseguiStrumento(sdk, 'richieste_ect', {}, null));
  verifica('il 28/12/2026 senza anno: le quattro del 2026, una aperta e scaduta', (dic.dati || {}).aperte === 1 && (dic.dati || {}).scadute === 1 && dic.periodo === 'anno 2026' && !(dic.dati || {}).dagli_anni_prima, JSON.stringify({ periodo: dic.periodo, aperte: (dic.dati || {}).aperte }));

  // SECONDA REVISIONE DEL 15/10/2026: un anno PASSATO scritto dal piano arriva
  // sempre, anche detto a parole che la guardia non conosce. «Due anni fa» col
  // piano {anno 2024} rispondeva sull'anno di oggi.
  const [dueAnniFa] = strumentiDalPiano({ ...piano, periodo: { anno: 2024 } }, catalogoStrumenti(), '2026-10-15', 'quante richieste ECT abbiamo avuto due anni fa?');
  verifica('«due anni fa» col piano {anno 2024}: arriva il 2024', dueAnniFa && dueAnniFa.parametri.anno === 2024, JSON.stringify(dueAnniFa && dueAnniFa.parametri));
  const [del25] = strumentiDalPiano({ ...piano, strumenti: [{ nome: 'richieste_ect', parametri: { anno: 2025 } }] }, catalogoStrumenti(), '2026-10-15', 'quante richieste ECT abbiamo avuto nel \'25?');
  verifica('«nel \'25» col piano {anno 2025}: arriva il 2025', del25 && del25.parametri.anno === 2025, JSON.stringify(del25 && del25.parametri));
  const esito2024 = await alle('2026-10-15T09:00:00Z', () => eseguiStrumento(sdk, 'richieste_ect', dueAnniFa.parametri, null));
  verifica('e la risposta e\' sul 2024', esito2024.periodo === 'anno 2024', esito2024.periodo);
}

// ECOTYNA DICE LE RICHIESTE DELLA TO-DO LIST (seconda revisione del 15/10/2026).
// La pagina tiene anche le richieste degli anni prima chiuse nell'anno
// (richiesteDellaTodo, richiesteEct.ts): una richiesta di dicembre risposta al
// consorzio il 03/01/2027 resta fra le completate del 2027. EcoTyna, a «quante
// richieste ECT evase?» il 05/01/2027, ne dava una sola: quella del 2027.
console.log('LE RICHIESTE ECT DI ECOTYNA SONO QUELLE DELLA TO-DO LIST');
{
  const R = new URL('../base44/shared/', import.meta.url).href;
  const { eseguiStrumento } = await import(R + 'strumentiAssistente.ts');
  const E = await import(R + 'richiesteEct.ts');
  const RICHIESTE = [
    // del 2026, ritirata a dicembre e risposta al consorzio il 03/01/2027
    { id: 't1', anno: 2026, pdr_nome: 'GOMMISTA ROSSI', provincia: 'BA', mail_inviata_il: '2026-12-10', scadenza: '2026-12-20', esito: 'evasa', evaso_il: '2026-12-18', evasione_confermata: true, evasione_confermata_il: '2027-01-03T10:00:00Z' },
    // del 2026, chiusa dal portale: il suo ordine visto cancellato il 02/01/2027
    { id: 't2', anno: 2026, pdr_nome: 'GOMMISTA AZZURRI', provincia: 'NA', mail_inviata_il: '2026-12-12', esito: 'annullata', id_ordine: 'ET26999001', ordini_stato_json: JSON.stringify([{ id_ordine: 'ET26999001', stato: 'cancellato', visto_il: '2027-01-02' }]) },
    // del 2026, risposta al consorzio a dicembre: chiusa nel suo anno
    { id: 't3', anno: 2026, pdr_nome: 'GOMMISTA NERI', provincia: 'SA', mail_inviata_il: '2026-11-10', esito: 'evasa', evaso_il: '2026-11-20', evasione_confermata: true, evasione_confermata_il: '2026-12-01T10:00:00Z' },
    // del 2027, evasa e risposta
    { id: 't4', anno: 2027, pdr_nome: 'GOMMISTA VERDI', provincia: 'BA', mail_inviata_il: '2027-01-04', scadenza: '2027-01-20', esito: 'evasa', evaso_il: '2027-01-04', evasione_confermata: true, evasione_confermata_il: '2027-01-04T10:00:00Z' },
  ];
  const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
  const sdk = { asServiceRole: { entities: new Proxy({}, { get: (_t, n) => ({
    filter: async (f, _o, lim = 5000, skip = 0) => (n === 'RichiestaEct' ? RICHIESTE : []).filter(r => uguale(r, f)).slice(skip, skip + lim).map(r => ({ ...r })),
    list: async (_o, lim = 5000, skip = 0) => (n === 'RichiestaEct' ? RICHIESTE : []).slice(skip, skip + lim).map(r => ({ ...r })),
  }) }) } };
  const OraVera = Date;
  const alle = async (iso, f) => {
    const ms = OraVera.parse(iso);
    globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
    try { return await f(); } finally { globalThis.Date = OraVera; }
  };
  const nomi = (r) => ((r.dati.richieste || {}).righe || []).map(x => x.pdr).sort().join(',');
  const evase = await alle('2027-01-05T09:00:00Z', () => eseguiStrumento(sdk, 'richieste_ect', { stato: 'evasa' }, null));
  verifica('05/01/2027, «quante richieste ECT evase?»: anche quella di dicembre risposta il 03/01/2027', nomi(evase) === 'GOMMISTA ROSSI,GOMMISTA VERDI', nomi(evase));
  const tutte = await alle('2027-01-05T09:00:00Z', () => eseguiStrumento(sdk, 'richieste_ect', {}, null));
  const righe = (tutte.dati.richieste || {}).righe || [];
  verifica('e quella chiusa dal portale nel 2027; non quella chiusa a dicembre', nomi(tutte) === 'GOMMISTA AZZURRI,GOMMISTA ROSSI,GOMMISTA VERDI', nomi(tutte));
  verifica('le due degli anni prima lo dicono sulla riga: chiusa nel 2027', righe.filter(x => x.chiusa_nel === 2027).map(x => x.pdr).sort().join(',') === 'GOMMISTA AZZURRI,GOMMISTA ROSSI' && !righe.find(x => x.pdr === 'GOMMISTA VERDI').chiusa_nel, JSON.stringify(righe.map(x => [x.pdr, x.anno, x.chiusa_nel || null])));
  verifica('il periodo e la nota lo dicono', tutte.periodo === 'anno 2027, con le richieste del 2026 chiuse nel 2027' && tutte.dati.dagli_anni_prima === 2 && tutte.dati.dagli_anni_prima_chiuse_nell_anno === 2 && /2 sono state chiuse nel 2027/.test(tutte.dati.nota_anni_prima || ''), JSON.stringify({ periodo: tutte.periodo, nota: tutte.dati.nota_anni_prima }));
  // La stessa regola della pagina, quando c'e' (il gruppo delle Richieste ECT la
  // scrive in richiesteEct.ts): stessi nomi nella To-Do List e in EcoTyna.
  if (typeof E.richiesteDellaTodo === 'function') {
    const pagina = E.richiesteDellaTodo(RICHIESTE, 2027).map(r => r.pdr_nome).sort().join(',');
    verifica('gli stessi nomi della To-Do List (richiesteDellaTodo)', pagina === nomi(tutte), `pagina ${pagina}, EcoTyna ${nomi(tutte)}`);
  }
  // La controprova: con una aperta del 2026 insieme, il periodo dice le due cose.
  RICHIESTE.push({ id: 't5', anno: 2026, pdr_nome: 'GOMMISTA GIALLI', provincia: 'LE', mail_inviata_il: '2026-12-20', scadenza: '2026-12-30', esito: 'aperta' });
  const conAperta = await alle('2027-01-05T09:00:00Z', () => eseguiStrumento(sdk, 'richieste_ect', {}, null));
  verifica('con anche una aperta del 2026: «non ancora chiuse o chiuse nel 2027»', conAperta.periodo === 'anno 2027, con le richieste del 2026 non ancora chiuse o chiuse nel 2027' && /1 e' ancora da seguire .*2 sono state chiuse nel 2027/.test(conAperta.dati.nota_anni_prima || ''), JSON.stringify({ periodo: conAperta.periodo, nota: conAperta.dati.nota_anni_prima }));
  // E con l'anno chiesto restano tutte e sole quelle di quell'anno.
  const chiesto2027 = await alle('2027-01-05T09:00:00Z', () => eseguiStrumento(sdk, 'richieste_ect', { anno: 2027 }, null));
  verifica('con l\'anno 2027 chiesto: solo quella del 2027', nomi(chiesto2027) === 'GOMMISTA VERDI' && chiesto2027.periodo === 'anno 2027', nomi(chiesto2027));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
