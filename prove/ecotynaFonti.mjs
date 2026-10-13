// ECOTYNA NON DICHIARA CERTEZZE CHE NON HA: le fonti, la loro data, i due
// riquadri sotto la risposta (segnalazioni alte del 20/09/2026 A71, A72 e A76,
// corrette il 12/10/2026, quando l'utente ha chiesto un'EcoTyna "piu' realistica").
//
//   A71  una fonte senza data prendeva d'ufficio «verificata il 14/09/2026», la
//        data della base di conoscenza, anche se nessuna voce la cita;
//   A76  «Verificata sulle fonti» si accendeva con la ricerca online accesa, non
//        con una fonte ufficiale citata; «Dati del gestionale» con le parole
//        della domanda, anche con le letture andate in errore;
//   A72  le FAQ salvate da «Corretta, salva come FAQ» portavano le fonti come
//        oggetti, e la base di conoscenza le scriveva nel prompt come
//        «[object Object]».
//
// chiediAssistente gira intera con il banco prove/dati/bancoEcoTyna.mjs (SDK e
// modello finti). npm run prove
import { readFileSync } from 'node:fs';
import { caricaEcoTyna, chiedi } from './dati/bancoEcoTyna.mjs';
import * as conoscenza from '../base44/shared/baseConoscenza.ts';
import * as fontiServer from '../base44/shared/fontiConoscenza.ts';
import * as fontiPagina from '../src/lib/fontiConoscenza.js';

// Dallo spazio dei nomi: col codice di prima (la controprova) fontiDellaRisposta
// non c'e', e la prova deve dire quali verifiche cadono invece di fermarsi all'import.
const { testoConoscenza, FONTI_UFFICIALI } = conoscenza;
const fontiDellaRisposta = conoscenza.fontiDellaRisposta || (() => []);

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
// I fine-riga si tolgono: nell'albero di lavoro i file sono CRLF.
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r/g, '');
const J = (v) => String(JSON.stringify(v)).slice(0, 400);

console.log('1. LO SPECCHIO DELLE FONTI E I SITI UFFICIALI');
{
  // Lo stesso controllo di prove/specchi.mjs, finche' la coppia non e' nel suo elenco.
  const corpo = (p) => {
    const righe = sorgente(p).split('\n');
    let i = 0;
    while (i < righe.length && (righe[i].startsWith('//') || righe[i].trim() === '')) i++;
    return righe.slice(i).filter(r => !/^import .* from /.test(r)).join('\n').trim();
  };
  verifica('src/lib/fontiConoscenza.js e\' identico all\'originale', corpo('base44/shared/fontiConoscenza.ts') === corpo('src/lib/fontiConoscenza.js'));
  const host = (s) => (String(s).match(/^https?:\/\/(?:www\.)?([^/\s(]+)/) || [])[1];
  const ufficiali = FONTI_UFFICIALI.map(host).sort();
  verifica('i siti ufficiali sono quelli di FONTI_UFFICIALI', JSON.stringify(ufficiali) === JSON.stringify([...fontiServer.DOMINI_UFFICIALI].sort()), J([ufficiali, fontiServer.DOMINI_UFFICIALI]));
  verifica('www. e sottodomini valgono, un sito simile no', fontiServer.urlUfficiale('https://www.normattiva.it/uri-res/x') && fontiServer.urlUfficiale('https://dati.rentri.gov.it/faq')
    && !fontiServer.urlUfficiale('https://normattiva.it.esempio.com/') && !fontiServer.urlUfficiale('https://www.fakenormattiva.it/') && !fontiServer.urlUfficiale('normattiva.it'));
}

console.log('2. A72: LE FONTI DELLE FAQ COME TESTO');
{
  const t = fontiPagina.testoFonte;
  verifica('un oggetto diventa «titolo - riferimento url»', t({ titolo: 'D.Lgs. 152/2006', riferimento: 'art. 193', url: 'https://www.normattiva.it/', verificato_il: '2026-09-14' }) === 'D.Lgs. 152/2006 - art. 193 https://www.normattiva.it/');
  verifica('senza riferimento ne\' url resta il titolo', t({ titolo: 'DM 59/2023' }) === 'DM 59/2023' && t({ riferimento: 'art. 4' }) === 'art. 4');
  verifica('un testo resta com\'e\'', t('Regole della direzione SMOCO') === 'Regole della direzione SMOCO');
  verifica('un JSON illeggibile non ha fonti', fontiPagina.leggiFontiTesto('{rotto').length === 0 && fontiPagina.leggiFontiTesto('').length === 0);

  // La FAQ come la salvava la chat fino al 12/10/2026: gli oggetti della risposta.
  const faq = {
    id: 'f1', tipo: 'faq', stato: 'approvata', attiva: true, area: 'rentri', titolo: 'FIR digitale', testo: 'Dal 16/09/2026 ...', verificato_il: '2026-10-11',
    fonti_json: JSON.stringify([{ titolo: 'D.Lgs. 152/2006', riferimento: 'art. 193', url: 'https://www.normattiva.it/', verificato_il: '2026-09-14' }, { titolo: 'DM 59/2023', riferimento: 'art. 4', url: '' }]),
  };
  const riga = testoConoscenza([faq]).split('\n').find(r => r.includes('FAQ confermata')) || '';
  verifica('nel prompt la FAQ gia\' salvata non porta «[object Object]»', riga && !/object Object/.test(riga), riga);
  verifica('...ma le sue fonti scritte per intero', riga.includes('fonti: D.Lgs. 152/2006 - art. 193 https://www.normattiva.it/; DM 59/2023 - art. 4)'), riga);
  // Una voce aggiornata con le fonti come oggetti: anche li' (voce del codice sostituita).
  const agg = { id: 'a1', tipo: 'aggiornamento_normativo', stato: 'approvata', attiva: true, area: 'tua', voce_id: 'tua-fir-microraccolta', titolo: 'FIR', testo: 'Testo aggiornato del formulario e della microraccolta.', verificato_il: '2026-10-01', fonti_json: JSON.stringify([{ titolo: 'D.Lgs. 152/2006', riferimento: 'art. 193' }]) };
  const rigaAgg = testoConoscenza([agg]).split('\n').find(r => r.includes('aggiornata il 2026-10-01')) || '';
  verifica('anche la voce aggiornata', rigaAgg.includes('fonti: D.Lgs. 152/2006 - art. 193)') && !/object Object/.test(rigaAgg), rigaAgg);

  const chat = sorgente('src/components/assistente/ChatAssistente.jsx');
  verifica('la chat salva la FAQ con le fonti in testo', /fonti_json: modo === 'corretta' \? JSON\.stringify\(leggiFontiTesto\(domanda\.fonti_json\)\)/.test(chat));
  verifica('...e non piu\' gli oggetti della risposta', !/fonti_json: modo === 'corretta' \? domanda\.fonti_json/.test(chat));
  const base = sorgente('src/components/assistente/BaseConoscenza.jsx');
  verifica('la base di conoscenza legge le fonti come testo', /const leggiFonti = leggiFontiTesto;/.test(base) && !/v\.map\(String\)/.test(base));
}

console.log('3. A71: NIENTE «VERIFICATA IL» D\'UFFICIO');
const modulo = await caricaEcoTyna();
// Senza parole dei dati: «microraccolta» contiene «raccolt», e una domanda cosi'
// apre anche il riepilogo della commessa (analizzaDomanda, assistente.ts).
const DOMANDA_NORMA = 'Che cosa deve riportare il formulario secondo l\'art. 193 del D.Lgs. 152/2006?';
{
  const e = await chiedi(modulo, {
    domanda: DOMANDA_NORMA,
    piano: { strumenti: [], serve_normativa: true },
    risposta: {
      risposta: 'Nel formulario vanno indicate tutte le tappe della microraccolta.',
      certezza: 'alta',
      fonti: [
        { titolo: 'D.Lgs. 152/2006', riferimento: 'art. 193', url: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2006-04-03;152' },
        { titolo: 'D.Lgs. 81/2008', riferimento: 'art. 26' },
        { titolo: 'Guida di settore', url: 'https://www.esempio.it/guida-fir', verificato_il: '2026-10-12' },
      ],
    },
  });
  verifica('la funzione risponde', e.stato === 200 && !!e.salvata, J(e.j));
  verifica('la ricerca online era accesa', e.internet);
  const fonti = JSON.parse((e.salvata && e.salvata.fonti_json) || '[]');
  const [fir, sicurezza, guida] = fonti;
  verifica('tre fonti salvate', fonti.length === 3, J(fonti));
  verifica('la norma della voce sul formulario porta la data della voce', fir && fir.voce === 'tua-fir-microraccolta' && fir.verificato_il === '2026-09-14', J(fir));
  verifica('...ed e\' ufficiale: sito di Normattiva con la ricerca accesa', fir && fir.ufficiale === true, J(fir));
  verifica('una norma che nessuna voce cita NON e\' «verificata il 14/09/2026»', sicurezza && sicurezza.verificato_il === '' && !sicurezza.voce, J(sicurezza));
  verifica('una pagina trovata online non prende la data che dice il modello', guida && guida.verificato_il === '' && guida.ufficiale === false && !guida.voce, J(guida));
  verifica('nessuna fonte prende la data della base di conoscenza d\'ufficio', fonti.filter(f => f.verificato_il === '2026-09-14').length === 1, J(fonti));
  const props = (((e.schema.properties || {}).fonti || {}).items || {}).properties || {};
  verifica('al modello non si chiede piu\' la data di verifica', !('verificato_il' in props) && 'voce_id' in props, J(Object.keys(props)));
  verifica('e le istruzioni gli dicono di non scriverne', /Non scrivere date di verifica: la data la aggiunge il gestionale, solo per le voci della base di conoscenza/.test(e.prompt)
    && /una pagina trovata online e' una fonte citata, non una verifica/.test(e.prompt));
  verifica('con queste fonti il riquadro «Verificata sulle fonti» c\'e\'', fontiPagina.verificataSulleFonti(fonti, e.salvata.ricerca_online));
}

console.log('4. A76: «VERIFICATA SULLE FONTI» SOLO CON UNA FONTE UFFICIALE O UNA VOCE');
{
  const e = await chiedi(modulo, {
    domanda: DOMANDA_NORMA,
    piano: { strumenti: [], serve_normativa: true },
    risposta: { risposta: 'Dipende.', certezza: 'media', fonti: [{ titolo: 'D.Lgs. 81/2008', riferimento: 'art. 26' }, { titolo: 'Guida di settore', url: 'https://www.esempio.it/guida-fir' }] },
  });
  const fonti = JSON.parse((e.salvata && e.salvata.fonti_json) || '[]');
  verifica('la ricerca era accesa', e.salvata && e.salvata.ricerca_online === true, J(e.salvata));
  verifica('ma nessuna fonte e\' ufficiale ne\' di una voce: niente riquadro', fonti.length === 2 && !fontiPagina.verificataSulleFonti(fonti, e.salvata.ricerca_online), J(fonti));
  const senza = await chiedi(modulo, { domanda: DOMANDA_NORMA, piano: { strumenti: [], serve_normativa: true }, risposta: { risposta: 'Non lo so.', certezza: 'bassa', fonti: [] } });
  verifica('senza fonti niente riquadro, anche con la ricerca accesa', senza.salvata && senza.salvata.ricerca_online === true && !fontiPagina.verificataSulleFonti(JSON.parse(senza.salvata.fonti_json), true));
  // Una voce della base di conoscenza senza indirizzo: il riquadro c'e'.
  const voce = fontiDellaRisposta([{ titolo: 'Base di conoscenza', riferimento: 'Liste degli assegnati', voce_id: 'gest-liste-assegnati' }], [], { ricercaOnline: false });
  verifica('una voce della base di conoscenza accende il riquadro anche senza ricerca', (voce[0] || {}).voce === 'gest-liste-assegnati' && fontiPagina.verificataSulleFonti(voce, false), J(voce));
  // L'id suggerito dal modello si controlla: una fonte che non e' quella voce non la prende.
  const falsa = fontiDellaRisposta([{ titolo: 'Prassi di settore', voce_id: 'pfu-incarichi' }, { titolo: 'D.Lgs. 81/2008', riferimento: 'art. 26', voce_id: 'tua-registro' }], []);
  verifica('l\'id suggerito su una fonte che non e\' quella voce non vale', falsa.length === 2 && falsa.every(f => !f.voce && !f.verificato_il), J(falsa));
  // Gli articoli contano: la voce sul formulario (art. 193) non ha verificato l'art. 258.
  const art = fontiDellaRisposta([{ titolo: 'D.Lgs. 152/2006', riferimento: 'art. 258' }, { titolo: 'D.Lgs. 152/2006', riferimento: 'artt. 184 e 190' }], []);
  verifica('un articolo che nessuna voce cita non prende la data', art.length === 2 && !art[0].voce && art[1].voce === 'tua-registro', J(art));
  // Un aggiornamento approvato: la data e' la sua.
  const agg = { id: 'a1', tipo: 'aggiornamento_normativo', stato: 'approvata', attiva: true, area: 'tua', voce_id: 'tua-fir-microraccolta', titolo: 'FIR', testo: 'x'.repeat(50), verificato_il: '2026-10-01', fonti_json: '[]' };
  const conAgg = fontiDellaRisposta([{ titolo: 'D.Lgs. 152/2006', riferimento: 'art. 193' }], [agg]);
  verifica('una voce aggiornata porta la data dell\'aggiornamento', (conAgg[0] || {}).voce === 'tua-fir-microraccolta' && (conAgg[0] || {}).verificato_il === '2026-10-01', J(conAgg));
  // Un indirizzo ufficiale scritto senza la ricerca accesa non e' una verifica.
  const memoria = fontiDellaRisposta([{ titolo: 'Normattiva', url: 'https://www.normattiva.it/' }], [], { ricercaOnline: false });
  verifica('un sito ufficiale senza ricerca online non e\' «ufficiale»', (memoria[0] || {}).ufficiale === false && !fontiPagina.verificataSulleFonti(memoria, false), J(memoria));
  // Le risposte salvate prima del 12/10/2026 non hanno ufficiale ne' voce.
  verifica('una risposta vecchia: vale il sito ufficiale con la ricerca accesa', fontiPagina.verificataSulleFonti([{ titolo: 'x', url: 'https://www.rentri.gov.it/faq', verificato_il: '2026-09-14' }], true)
    && !fontiPagina.verificataSulleFonti([{ titolo: 'x', url: 'https://www.esempio.it/', verificato_il: '2026-09-14' }], true)
    && !fontiPagina.verificataSulleFonti([{ titolo: 'x', url: 'https://www.rentri.gov.it/faq' }], false));

  const chat = sorgente('src/components/assistente/ChatAssistente.jsx');
  verifica('la chat decide il riquadro dalle fonti, non dalla ricerca accesa', /\{verificataSulleFonti\(fonti, d\.ricerca_online\) && <Badge[^>]*><Globe[^>]*\/> Verificata sulle fonti<\/Badge>\}/.test(chat)
    && !/\{d\.ricerca_online && <Badge/.test(chat));
  verifica('la data accanto a una fonte solo se viene da una voce, all\'italiana', /\{f\.voce && f\.verificato_il \? ` \(base di conoscenza, verificata il \$\{giornoIt\(f\.verificato_il\)\}\)` : ''\}/.test(chat)
    && !/\(verificata il \$\{f\.verificato_il\}\)/.test(chat));
}

console.log('5. A76: «DATI DEL GESTIONALE» SOLO SE UN DATO E\' ARRIVATO');
{
  const DOMANDA_DATI = 'Quanti ritiri ha fatto Emmesse questo mese?';
  const PIANO = { strumenti: [{ nome: 'punti_di_raccolta', parametri: { cerca: 'Emmesse' } }], serve_normativa: true };
  const RISPOSTA = { risposta: 'Non ho potuto leggere i dati.', certezza: 'bassa' };
  const t0 = Date.now();
  const guasto = await chiedi(modulo, { domanda: DOMANDA_DATI, piano: PIANO, risposta: RISPOSTA, guasti: ['Pdr'], riepilogo: 'errore' });
  verifica('la funzione risponde lo stesso', guasto.stato === 200 && !!guasto.salvata, J(guasto.j));
  const strumenti = JSON.parse((guasto.salvata && guasto.salvata.strumenti_json) || '{}').strumenti || [];
  verifica('lo strumento e\' andato in errore', strumenti.length === 1 && !!strumenti[0].errore, J(strumenti));
  verifica('strumento in errore e riepilogo non letto: niente «Dati del gestionale»', guasto.salvata && guasto.salvata.dati_gestionale === false, J(guasto.salvata && { dati_gestionale: guasto.salvata.dati_gestionale }));
  const riepilogo = await chiedi(modulo, { domanda: DOMANDA_DATI, piano: PIANO, risposta: RISPOSTA, guasti: ['Pdr'], riepilogo: 'DATI DEL GESTIONALE al 2026-10-12: raccolto RETE 1.000,00 t.' });
  verifica('strumento in errore ma riepilogo letto: «Dati del gestionale» c\'e\'', riepilogo.salvata && riepilogo.salvata.dati_gestionale === true && /raccolto RETE 1\.000,00 t/.test(riepilogo.prompt));
  const buono = await chiedi(modulo, { domanda: DOMANDA_DATI, piano: PIANO, risposta: RISPOSTA, db: { Pdr: [{ id: 'p1', ragione_sociale: 'EMMESSE SRL', provincia_pdr: 'NA' }] }, riepilogo: 'errore' });
  verifica('lo strumento ha risposto: «Dati del gestionale» c\'e\'', buono.salvata && buono.salvata.dati_gestionale === true, J(buono.salvata && buono.salvata.strumenti_json));
  const norma = await chiedi(modulo, { domanda: DOMANDA_NORMA, piano: { strumenti: [], serve_normativa: true }, risposta: RISPOSTA });
  verifica('una domanda di norma senza strumenti non ha «Dati del gestionale»', norma.salvata && norma.salvata.dati_gestionale === false);
  // «microraccolta» contiene «raccolt»: le parole aprono il riepilogo, ma il
  // pianificatore ha detto che i dati non servono.
  const parola = await chiedi(modulo, { domanda: 'Che cosa va scritto nel formulario per la microraccolta?', piano: { strumenti: [], serve_normativa: true }, risposta: RISPOSTA, riepilogo: 'DATI DEL GESTIONALE al 2026-10-12: raccolto RETE 1.000,00 t.' });
  verifica('un riepilogo entrato per una parola, su una domanda di norma, non fa «Dati del gestionale»', parola.salvata && parola.salvata.dati_gestionale === false, J(parola.salvata && parola.salvata.dati_gestionale));
  // Pianificatore non riuscito: si legge il riepilogo della commessa come strumento.
  const senzaPiano = await chiedi(modulo, { domanda: DOMANDA_DATI, piano: null, risposta: RISPOSTA });
  const usati = JSON.parse((senzaPiano.salvata && senzaPiano.salvata.strumenti_json) || '{}');
  verifica('pianificatore non riuscito: il riepilogo come strumento fa «Dati del gestionale»', senzaPiano.salvata && senzaPiano.salvata.dati_gestionale === true
    && usati.piano === 'ripiego' && (usati.strumenti || []).some(s => s.strumento === 'panoramica_commessa' && !s.errore), J(usati));
  if (Date.now() - t0 > 20000) console.log('  (nota: lenta, ' + (Date.now() - t0) + ' ms)');
}

// Revisione del 13/10/2026 (rilievo sulla A71): quattro voci citano la pagina
// principale di un sito, e il prompt da' al modello quegli indirizzi. Una FAQ
// RENTRI del 2 ottobre 2026 con l'indirizzo del sito prendeva «verificata il
// 14/09/2026», diciotto giorni prima che esistesse; una voce che cita un atto
// senza articoli faceva passare qualunque articolo; il voce_id del modello
// bastava con una parola del titolo.
console.log('6. A71: L\'INDIRIZZO DI UN SITO, UN ARTICOLO NON CITATO, UNA PAROLA SOLA NON BASTANO');
{
  const e = await chiedi(modulo, {
    domanda: 'Ci sono novita sul FIR digitale dopo settembre?',
    piano: { strumenti: [], serve_normativa: true },
    risposta: {
      risposta: 'Il 2 ottobre 2026 il RENTRI ha pubblicato una nuova FAQ sulla vidimazione.',
      certezza: 'media',
      fonti: [
        { titolo: 'FAQ RENTRI del 2 ottobre 2026', riferimento: 'vidimazione virtuale del FIR', url: 'https://www.rentri.gov.it' },
        { titolo: 'D.Lgs. 81/2008', riferimento: 'art. 26', url: 'https://www.albonazionalegestoriambientali.it' },
      ],
    },
  });
  const fonti = JSON.parse((e.salvata && e.salvata.fonti_json) || '[]');
  verifica('funzione intera: la FAQ nuova con l\'indirizzo del RENTRI non e\' «base di conoscenza, verificata il 14/09/2026»', fonti.length === 2 && fonti.every(f => !f.voce && !f.verificato_il), J(fonti));
  verifica('...ma resta una fonte ufficiale letta con la ricerca accesa', fonti.every(f => f.ufficiale === true) && fontiPagina.verificataSulleFonti(fonti, true), J(fonti));

  const voceDi = (f) => { const [x] = fontiDellaRisposta([f], [], { ricercaOnline: true }); return x ? `${x.voce || '-'}|${x.verificato_il || '-'}` : 'nessuna'; };
  const NO = [
    ['una delibera nuova con l\'indirizzo dell\'Albo', { titolo: 'Delibera Albo n. 3 del 10 ottobre 2026', riferimento: 'nuove verifiche RT', url: 'https://www.albonazionalegestoriambientali.it' }],
    ['una FAQ nuova sul FIR digitale con l\'indirizzo del RENTRI', { titolo: 'FAQ RENTRI del 2 ottobre 2026 sul FIR digitale', riferimento: 'vidimazione virtuale', url: 'https://www.rentri.gov.it/' }],
    ['una circolare con l\'indirizzo del sito dei PFU', { titolo: 'Circolare Ecopneus 2026 sui contributi', riferimento: '', url: 'https://www.pneumaticifuoriuso.it' }],
    ['un altro atto con l\'indirizzo del RENTRI', { titolo: 'D.Lgs. 81/2008', riferimento: 'art. 18 obblighi del datore di lavoro', url: 'https://www.rentri.gov.it' }],
    ['un articolo del DM 59/2023 che la voce non cita', { titolo: 'DM 59/2023', riferimento: 'art. 21 (sanzioni per la mancata vidimazione)' }],
    ['un articolo della L. 199/2025 che la voce non cita', { titolo: 'L. 199/2025', riferimento: 'art. 1 comma 312' }],
    ['un altro documento sul formulario, col voce_id del modello', { titolo: 'Linee guida ISPRA sul formulario', voce_id: 'tua-fir-microraccolta' }],
    ['un allegato del contratto, col voce_id del modello', { titolo: 'Allegato B del contratto Ecotyre', voce_id: 'gest-target' }],
    ['la norma della voce, ma modificata dopo la verifica', { titolo: 'DM 182/2019', riferimento: 'art. 9, come modificato il 3 ottobre 2026' }],
  ];
  for (const [nome, f] of NO) verifica(`${nome}: nessuna voce, nessuna data`, voceDi(f) === '-|-', voceDi(f));
  const SI = [
    ['l\'indirizzo del RENTRI con l\'iscrizione', { titolo: 'RENTRI', riferimento: 'iscrizione al registro', url: 'https://www.rentri.gov.it' }, 'rentri-iscrizione|2026-09-14'],
    ['l\'indirizzo del RENTRI col FIR digitale', { titolo: 'RENTRI', riferimento: 'FIR digitale', url: 'https://www.rentri.gov.it/' }, 'rentri-fir-digitale|2026-09-17'],
    ['l\'indirizzo del RENTRI con l\'articolo della voce', { titolo: 'RENTRI', riferimento: 'art. 13', url: 'https://www.rentri.gov.it' }, 'rentri-fir-digitale|2026-09-17'],
    ['una pagina precisa del RENTRI che la voce cita', { titolo: 'FAQ RENTRI 13 gennaio 2026', url: 'https://www.rentri.gov.it/area-produttori-di-rifiuti-non-iscritti' }, 'rentri-produttori-non-iscritti|2026-09-17'],
    ['l\'atto che la voce cita senza articoli, senza articoli', { titolo: 'DM 59/2023' }, 'rentri-iscrizione|2026-09-14'],
    // Il 16 settembre 2026 lo scrive la voce sull'ACI, non quella sul target: la
    // fonte e' della voce che lo conosce.
    ['una data che la voce stessa scrive non e\' «dopo»', { titolo: 'DM 182/2019', riferimento: 'art. 9, dal 16 settembre 2026' }, 'pfu-autodemolizione|2026-09-14'],
    ['la voce stessa, col plurale', { titolo: 'Base di conoscenza', riferimento: 'Formulari e microraccolta', voce_id: 'tua-fir-microraccolta' }, 'tua-fir-microraccolta|2026-09-14'],
  ];
  for (const [nome, f, attesa] of SI) verifica(`${nome}: ${attesa}`, voceDi(f) === attesa, voceDi(f));
}

// Revisione del 13/10/2026, rilievo sulla A71 nei casi vicini: il prompt mostra
// le voci per titolo, e una fonte col titolo o l'id della voce ne prendeva la
// data anche citando un articolo che la voce non cita. Le date coi punti non si
// leggevano, e una data scritta con le barre faceva un estremo d'atto («09/2026»).
console.log('7. A71: IL TITOLO O L\'ID DELLA VOCE NON BASTANO PER UN ARTICOLO CHE LA VOCE NON CITA');
{
  const voceDi = (f) => { const [x] = fontiDellaRisposta([f], [], { ricercaOnline: true }); return x ? `${x.voce || '-'}|${x.verificato_il || '-'}` : 'nessuna'; };
  const NO = [
    ['il titolo della voce sul RENTRI con l\'art. 21 del DM 59/2023', { titolo: 'Chi si iscrive al RENTRI', riferimento: 'DM 59/2023 art. 21 (sanzioni per la mancata vidimazione)' }],
    ['il titolo della voce sul formulario con l\'art. 258', { titolo: 'Formulario e microraccolta', riferimento: 'D.Lgs. 152/2006 art. 258 (sanzioni sul formulario)' }],
    ['l\'id della voce sul formulario con l\'art. 258', { titolo: 'Base di conoscenza, tua-fir-microraccolta', riferimento: 'D.Lgs. 152/2006 art. 258' }],
    ['il titolo della voce con un articolo senza atto che la voce non cita', { titolo: 'Formulario e microraccolta', riferimento: 'art. 258' }],
    ['l\'id e il voce_id con un articolo che la voce non cita', { titolo: 'tua-fir-microraccolta', riferimento: 'art. 258', voce_id: 'tua-fir-microraccolta' }],
    ['la FAQ RENTRI del 02.10.2026, data coi punti, con l\'indirizzo del sito', { titolo: 'FAQ RENTRI del 02.10.2026 sul FIR digitale', riferimento: 'vidimazione virtuale', url: 'https://www.rentri.gov.it' }],
    ['la stessa FAQ con la pagina precisa che una voce cita', { titolo: 'FAQ RENTRI del 02.10.2026', url: 'https://www.rentri.gov.it/area-produttori-di-rifiuti-non-iscritti' }],
    ['la norma della voce aggiornata al 20.09.2026', { titolo: 'Formulario e microraccolta', riferimento: 'D.Lgs. 152/2006 art. 193, aggiornato al 20.09.2026' }],
    ['una circolare del 10/09/2026: una data non e\' un atto', { titolo: 'Circolare della direzione del 10/09/2026' }],
    ['una nota del 15/09/2026 sul FIR', { titolo: 'Nota del 15/09/2026', riferimento: 'FIR' }],
  ];
  for (const [nome, f] of NO) verifica(`${nome}: nessuna voce, nessuna data`, voceDi(f) === '-|-', voceDi(f));
  const SI = [
    ['il titolo della voce con l\'articolo che la voce cita', { titolo: 'Formulario e microraccolta', riferimento: 'D.Lgs. 152/2006 art. 193' }, 'tua-fir-microraccolta|2026-09-14'],
    ['...anche senza l\'atto', { titolo: 'Formulario e microraccolta', riferimento: 'art. 193' }, 'tua-fir-microraccolta|2026-09-14'],
    ['l\'atto che la voce cita senza articoli', { titolo: 'DM 59/2023', riferimento: '' }, 'rentri-iscrizione|2026-09-14'],
    ['il titolo della voce da solo', { titolo: 'Chi si iscrive al RENTRI' }, 'rentri-iscrizione|2026-09-14'],
    ['il titolo con la data della verifica, che non e\' un atto', { titolo: 'Chi si iscrive al RENTRI', riferimento: 'base di conoscenza, verificata il 14/09/2026' }, 'rentri-iscrizione|2026-09-14'],
    ['l\'id della voce da solo', { titolo: 'Base di conoscenza, tua-fir-microraccolta' }, 'tua-fir-microraccolta|2026-09-14'],
    ['la precisazione della direzione che la voce cita, con la sua data', { titolo: 'Precisazione della direzione SMOCO del 17/09/2026' }, 'rentri-fir-digitale|2026-09-17'],
    ['una data coi punti che la voce stessa scrive non e\' «dopo»', { titolo: 'DM 182/2019', riferimento: 'art. 9, dal 16.09.2026' }, 'pfu-autodemolizione|2026-09-14'],
  ];
  for (const [nome, f, attesa] of SI) verifica(`${nome}: ${attesa}`, voceDi(f) === attesa, voceDi(f));

  // Sulla funzione intera, come nel caso del revisore della sezione 6, con la
  // data coi punti e il titolo della voce con un articolo che non cita.
  const e = await chiedi(modulo, {
    domanda: 'Che sanzioni ci sono per il formulario e per la vidimazione?',
    piano: { strumenti: [], serve_normativa: true },
    risposta: {
      risposta: 'Le sanzioni sul formulario sono nell\'art. 258; il 02.10.2026 il RENTRI ha pubblicato una FAQ.',
      certezza: 'media',
      fonti: [
        { titolo: 'Formulario e microraccolta', riferimento: 'D.Lgs. 152/2006 art. 258', voce_id: 'tua-fir-microraccolta' },
        { titolo: 'FAQ RENTRI del 02.10.2026 sul FIR digitale', riferimento: 'vidimazione virtuale', url: 'https://www.rentri.gov.it', voce_id: 'rentri-fir-digitale' },
        { titolo: 'Formulario e microraccolta', riferimento: 'D.Lgs. 152/2006 art. 193', voce_id: 'tua-fir-microraccolta' },
      ],
    },
  });
  const fonti = JSON.parse((e.salvata && e.salvata.fonti_json) || '[]');
  verifica('funzione intera: art. 258 e FAQ del 02.10.2026 senza voce e senza data', fonti.length === 3 && !fonti[0].voce && !fonti[0].verificato_il && !fonti[1].voce && !fonti[1].verificato_il, J(fonti));
  verifica('...la FAQ resta ufficiale, e l\'art. 193 porta la data della voce', fonti[1] && fonti[1].ufficiale === true && fonti[2] && fonti[2].voce === 'tua-fir-microraccolta' && fonti[2].verificato_il === '2026-09-14', J(fonti));
}

// Ultimo giro della revisione del 13/10/2026 (rilievo sulla A71 nei casi vicini,
// script del revisore a71_date_trattini.mjs): la stessa FAQ RENTRI del 2 ottobre
// 2026 scritta coi trattini, col mese abbreviato o con l'anno a due cifre non era
// «dopo» la verifica e prendeva ancora «verificata il 17/09/2026». Il prompt non
// da' al modello un formato per le date delle fonti. Due numeri soli restano
// articoli e commi, non date; l'anno a due cifre dal 70 in su e' del Novecento
// («5.2.98» non e' il 2098), e l'anno si legge anche davanti («2026/10/02»).
console.log('8. A71: LA DATA DELLA FONTE IN QUALUNQUE NOTAZIONE');
{
  const voceDi = (f) => { const [x] = fontiDellaRisposta([f], [], { ricercaOnline: true }); return x ? `${x.voce || '-'}|${x.verificato_il || '-'}` : 'nessuna'; };
  const faq = (data) => ({ titolo: `FAQ RENTRI del ${data} sul FIR digitale`, riferimento: 'vidimazione virtuale', url: 'https://www.rentri.gov.it' });
  // Il controllo: senza la data, la stessa fonte e' della voce sul FIR digitale.
  verifica('senza la data la FAQ e\' della voce sul FIR digitale (la data e\' l\'unica differenza)', voceDi({ titolo: 'FAQ RENTRI sul FIR digitale', riferimento: 'vidimazione virtuale', url: 'https://www.rentri.gov.it' }) === 'rentri-fir-digitale|2026-09-17', voceDi({ titolo: 'FAQ RENTRI sul FIR digitale', riferimento: 'vidimazione virtuale', url: 'https://www.rentri.gov.it' }));
  for (const data of ['02-10-2026', '2-10-2026', '2 ott. 2026', '2 ott 2026', '2 ottobre 2026', '02/10/26', '02.10.26', '2-10-26', '02.10.2026', '02/10/2026', '2026/10/02', '2026.10.02']) {
    verifica(`la FAQ «del ${data}»: nessuna voce, nessuna data`, voceDi(faq(data)) === '-|-', voceDi(faq(data)));
  }
  verifica('la FAQ «di ott. 2026», il mese abbreviato senza giorno: nessuna voce, nessuna data', voceDi({ titolo: 'FAQ RENTRI di ott. 2026 sul FIR digitale', riferimento: 'vidimazione virtuale', url: 'https://www.rentri.gov.it' }) === '-|-');
  verifica('la norma della voce modificata il 03-10-2026: nessuna voce, nessuna data', voceDi({ titolo: 'DM 182/2019', riferimento: 'art. 9, come modificato il 03-10-2026' }) === '-|-');
  for (const data of ['4 genn. 2027', '4 febb. 2027', '4 magg. 2027']) {
    verifica(`la norma della voce modificata il ${data} (il mese in quattro lettere): nessuna voce, nessuna data`, voceDi({ titolo: 'DM 182/2019', riferimento: `art. 9, come modificato il ${data}` }) === '-|-', voceDi({ titolo: 'DM 182/2019', riferimento: `art. 9, come modificato il ${data}` }));
  }
  // L'anno a due cifre del Novecento non e' «dopo» ogni verifica: «3.6.98» e' il
  // 1998, non il 2098. La stessa fonte senza la data e' della voce.
  const senza = voceDi({ titolo: 'DM 182/2019', riferimento: 'art. 9' });
  for (const data of ['3.6.98', '03/06/98', '3-6-75']) {
    const con = voceDi({ titolo: 'DM 182/2019', riferimento: `art. 9, nel testo del ${data}` });
    verifica(`«${data}» e' del Novecento: la fonte resta della voce come senza la data (${senza})`, senza !== '-|-' && con === senza, con);
  }
  const SI = [
    ['«artt. 184-ter, 208, 214-216» non e\' una data', { titolo: 'D.Lgs. 152/2006', riferimento: 'artt. 184-ter, 208, 214-216' }, 'tua-autorizzazioni|2026-09-14'],
    ['«art. 1 c. 52-53» non e\' una data', { titolo: 'L. 190/2012', riferimento: 'art. 1 c. 52-53' }, 'doc-regole-base|2026-09-14'],
    ['una data coi trattini che la voce stessa scrive non e\' «dopo»', { titolo: 'DM 182/2019', riferimento: 'art. 9, dal 16-09-2026' }, 'pfu-autodemolizione|2026-09-14'],
    ['...col mese abbreviato', { titolo: 'DM 182/2019', riferimento: 'art. 9, dal 16 sett. 2026' }, 'pfu-autodemolizione|2026-09-14'],
    ['...con l\'anno a due cifre', { titolo: 'DM 182/2019', riferimento: 'art. 9, dal 16/09/26' }, 'pfu-autodemolizione|2026-09-14'],
    ['la precisazione della direzione coi trattini, nel giorno della verifica', { titolo: 'Precisazione della direzione SMOCO del 17-09-2026' }, 'rentri-fir-digitale|2026-09-17'],
  ];
  for (const [nome, f, attesa] of SI) verifica(`${nome}: ${attesa}`, voceDi(f) === attesa, voceDi(f));

  // Sulla funzione intera, col voce_id che il modello suggerisce.
  const e = await chiedi(modulo, {
    domanda: 'Ci sono novita sul FIR digitale dopo settembre?',
    piano: { strumenti: [], serve_normativa: true },
    risposta: {
      risposta: 'Il RENTRI ha pubblicato due FAQ sulla vidimazione virtuale.',
      certezza: 'media',
      fonti: [
        { ...faq('02-10-2026'), voce_id: 'rentri-fir-digitale' },
        { ...faq('2 ott. 2026'), voce_id: 'rentri-fir-digitale' },
        { ...faq('02/10/26'), voce_id: 'rentri-fir-digitale' },
      ],
    },
  });
  const fonti = JSON.parse((e.salvata && e.salvata.fonti_json) || '[]');
  verifica('funzione intera: le FAQ del 02-10-2026, del 2 ott. 2026 e del 02/10/26 senza voce e senza data, ma ufficiali', fonti.length === 3 && fonti.every(f => !f.voce && !f.verificato_il && f.ufficiale === true), J(fonti));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
