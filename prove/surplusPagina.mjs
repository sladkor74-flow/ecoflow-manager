// IL SURPLUS SULLE TARIFFE IN TARIFFE & ANAGRAFICHE (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: «una colonna laddove ci sono le tariffe
// che mensilmente diamo ai nostri fornitori per indicare un eventuale surplus,
// inteso sempre come €/t [...] indicando date di inizio e fine validita'», e
// tutto «in modo ordinato, elegante e professionale nonche' semplice a colpo
// d'occhio». Il primo e' il Fuel Surcharge del consorzio Ecotyre: +5 €/t a tutti
// i raccoglitori dal 01/10 al 31/12/2026, su rete, ACI ed extra raccolta.
//
// La pagina (TariffeUnificate.jsx, SurplusSezione.jsx, SurplusForm.jsx e i
// conti in surplusTariffe.js) e il colore (--eco-surplus in src/index.css):
// 1. la pagina delle tariffe: tre schede, la colonna «Surplus» accanto al
//    Valore fatta con surplusDellaTariffa, il filtro, la fascia; i surplus si
//    leggono tutti, mai con { stato: 'attivo' }, e a parte dalle tariffe;
// 2. le scritture passano solo da gestisciAnagrafiche: la richiesta della
//    pagina, fatta girare sulla funzione vera col banco, scrive quello che il
//    modulo dice (un record per canale, lo stesso gruppo, le date, gli importi);
//    una modifica manda solo quello che cambia, cosi' un canale con le date sue
//    non le perde; i mesi gia' chiusi si chiedono in anteprima;
// 3. i controlli del modulo campo per campo, con le regole del server;
// 4. la frase che dice che cosa succede;
// 5. le schede e la fascia; sui dati veri il Fuel Surcharge tocca 29 tariffe
//    (22 di raccolta, 7 attive);
// 6. la scorciatoia del consorzio prende l'anno di oggi, mai uno scritto;
// 7. il colore: un token, chiaro e scuro, e niente ambra per un surplus;
// 8. il disegno: le sezioni vere disegnate con React lato server dicono i
//    numeri all'italiana, i costi solo all'amministratore, «non letto» e non
//    «—» quando i surplus non si leggono, e niente spiegazioni in title=;
// 9. i canali con date diverse (revisione del 13/10/2026): il Fuel Surcharge
//    sale a 6 €/t sulla sola rete dal 01/11, la funzione vera chiude la rete
//    del +5 al 31/10 e lascia ACI ed extra raccolta al 31/12. La fascia dice
//    ogni canale fino al suo giorno e non nomina quelli conclusi (la rete non
//    sembra prendere 5 + 6 €/t), la frase del modulo da' le date di ogni
//    canale, la chiusura nomina il canale che si chiude.
// node prove/surplusPagina.mjs
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import { notaTraccia } from '../src/lib/campiTracciati.js';
import * as S from '../src/lib/surplus.js';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const sorgente = (p) => (existsSync(qui('../' + p)) ? readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '') : '');
const senzaCommenti = (x) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log('  FALLITA: la sezione si e\' fermata: ' + String(e && e.message ? e.message : e).slice(0, 300)); }
};

const FILE = {
  tariffe: 'src/components/fatturazione/TariffeUnificate.jsx',
  sezione: 'src/components/fatturazione/SurplusSezione.jsx',
  modulo: 'src/components/fatturazione/SurplusForm.jsx',
  vista: 'src/components/fatturazione/surplusTariffe.js',
  css: 'src/index.css',
};
const src = Object.fromEntries(Object.entries(FILE).map(([k, p]) => [k, sorgente(p)]));
let V = null;
try { V = await import('../src/components/fatturazione/surplusTariffe.js'); } catch (e) { verifica('surplusTariffe.js si carica', false, String(e && e.message).slice(0, 200)); }
const manca = (nome) => () => { throw new Error(`${nome} non c'e'`); };
const v = (nome) => (V && V[nome]) || manca(nome);

const OGGI = '2026-10-13';
const FUEL = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map((c, i) => ({
  id: `s${i}`, gruppo: 'g-fuel', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre del 30/09/2026',
  tipologia: c, prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5,
  data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo',
}));
// Le tariffe di esempio: raccolta di rete e ACI di Emmesse, trattamento, l'attiva di rete.
const TARIFFE = [
  { id: 't1', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'f1', fornitore_nome: 'EMMESSE SRLS', valore: 85, unita_misura: '€/t', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', stato: 'attivo' },
  { id: 't2', direzione: 'PASSIVA', tipologia: 'ACI', prestazione: 'RACCOLTA', fornitore_id: 'f1', fornitore_nome: 'EMMESSE SRLS', valore: 90, unita_misura: '€/t', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', stato: 'attivo' },
  { id: 't3', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'TRATTAMENTO', fornitore_id: 'f2', fornitore_nome: 'Irigom S.r.l.', valore: 110, unita_misura: '€/t', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', stato: 'attivo' },
  { id: 't4', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', stato: 'attivo' },
  { id: 't5', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'f3', fornitore_nome: 'GATIM S.R.L.', valore: 72, unita_misura: '€/t', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-09-30', stato: 'attivo' },
];
// La regola della pagina per le archiviate, sul giorno.
const archiviata = (t) => t.stato === 'non_attivo' || (!!t.data_fine_validita && String(t.data_fine_validita).slice(0, 10) < OGGI);

await sezione('1. LA PAGINA DELLE TARIFFE', async () => {
  const t = src.tariffe;
  const codice = senzaCommenti(t);
  verifica('la colonna si fa con surplusDellaTariffa, la regola della passiva e dell\'attiva',
    /import \{ surplusDellaTariffa \} from '@\/lib\/surplus';/.test(t) && /surplusDellaTariffa\(t, surplus, oggi\)/.test(codice));
  verifica('la colonna «Surplus» sta subito dopo il Valore', />Valore<\/th>\s*<th[^>]*>Surplus<\/th>/.test(t));
  verifica('e la cella usa la colonna calcolata, niente sulle archiviate', /\{arch \? null : <PastiglieSurplus col=\{surplus \? \(surplusPerTariffa\.get\(t\.id\) \|\| null\) : null\}/.test(t));
  verifica('la riga vuota copre tutte le colonne (13)', /colSpan=\{13\}/.test(t) && !/colSpan=\{12\}/.test(t));
  const schede = [...t.matchAll(/<TabsTrigger value="([^"]+)"/g)].map(m => m[1]);
  verifica('tre schede: Tariffe, Surplus, Ruoli fornitori', J(schede) === J(['tariffe', 'surplus', 'ruoli']), J(schede));
  verifica('la scheda Surplus mostra SurplusSezione', /<TabsContent value="surplus"[^>]*>\s*<SurplusSezione /.test(t));
  verifica('il filtro «Con surplus» accanto a «Mostra archiviate», con haSurplus', />Con surplus</.test(t) && /filters\.conSurplus && \(isArchiviata\(t\) \|\| !haSurplus\(surplusPerTariffa\.get\(t\.id\)\)\)/.test(codice));
  verifica('la fascia in cima alle tariffe, coi conti della colonna', /<FasciaSurplus schede=\{schede\} conti=\{contiSurplus\}/.test(t) && /tariffeDelleSchede\(tariffe, surplusPerTariffa, isArchiviata\)/.test(codice));
  verifica('i surplus si leggono tutti, con fetchAllClient', /fetchAllClient\(base44\.entities\.SurplusTariffa\)/.test(codice));
  const tutti = [src.tariffe, src.sezione, src.modulo, src.vista].map(senzaCommenti).join('\n');
  verifica('mai con un filtro sullo stato (le tariffe insegnano: lo stato vuoto vale)', !/SurplusTariffa\.(filter|list)\(/.test(tutti)
    && (codice.match(/\{ stato: 'attivo' \}/g) || []).length === 1 && /Fornitore\.filter\(\{ stato: 'attivo' \}\)/.test(codice));
  verifica('tariffe e surplus si leggono indipendenti (Promise.allSettled)', /Promise\.allSettled\(\[/.test(codice) && /caricaSurplus\(\),/.test(codice));
  verifica('dopo una scrittura si rileggono solo i surplus', /onCambiato=\{caricaSurplus\}/.test(t));
  verifica('se i surplus non si leggono, lo si dice con «Riprova»', /I surplus non si sono letti/.test(t) && /onClick=\{caricaSurplus\}/.test(t));
  verifica('la testa della scheda va a capo a 375 px', /<div className="flex flex-wrap justify-between items-center gap-2">/.test(t));
});

await sezione('2. LE SCRITTURE PASSANO SOLO DA gestisciAnagrafiche', async () => {
  const tutti = [src.tariffe, src.sezione, src.modulo, src.vista].map(senzaCommenti).join('\n');
  verifica('nessuna pagina scrive SurplusTariffa da se\'', !/SurplusTariffa\s*\.\s*(create|update|delete|bulk\w*|deleteMany|updateMany)\s*\(/.test(tutti) && !/ConTraccia\(\s*'SurplusTariffa'/.test(tutti));
  const nomi = [...senzaCommenti(src.vista).matchAll(/invoke\('([^']+)'/g)].map(m => m[1]);
  verifica('le chiamate del modulo vanno a gestisciAnagrafiche', nomi.length >= 2 && nomi.every(n => n === 'gestisciAnagrafiche'), J(nomi));
  verifica('le due pagine scrivono con scriviSurplus, e dicono quando lo storico non si scrive (notaTraccia)',
    [src.sezione, src.modulo].every(x => /scriviSurplus\(invoca,/.test(x) && /notaTraccia\(esito\.data\)/.test(x) && /base44\.functions\.invoke\(nome, corpo\)/.test(x)));

  // La richiesta del modulo per il Fuel Surcharge, sulla funzione vera.
  const modulo = await caricaFunzione('gestisciAnagrafiche');
  const fuel = v('bozzaFuelSurcharge')(OGGI);
  const piano = v('pianoDelSalvataggio')(fuel, { motivo: 'comunicazione del consorzio' });
  verifica('la richiesta: SurplusTariffa, create, tre canali, 5 e 5 €/t, dal 01/10 al 31/12',
    piano.richiesta.entita === 'SurplusTariffa' && piano.richiesta.operazione === 'create' && J(piano.richiesta.dati.tipologie) === J(['RETE', 'ACI', 'EXTRA_RACCOLTA'])
      && piano.richiesta.dati.euro_t_passiva === 5 && piano.richiesta.dati.euro_t_attiva === 5
      && piano.richiesta.dati.data_inizio_validita === '2026-10-01' && piano.richiesta.dati.data_fine_validita === '2026-12-31', J(piano.richiesta));
  const r = await chiama(modulo, { db: {}, corpo: piano.richiesta });
  const creati = r.db.SurplusTariffa || [];
  verifica('la funzione vera scrive tre record, uno per canale, lo stesso gruppo, ognuno con la sua traccia',
    r.stato === 200 && creati.length === 3 && new Set(creati.map(x => x.gruppo)).size === 1 && J(creati.map(x => x.tipologia)) === J(['RETE', 'ACI', 'EXTRA_RACCOLTA'])
      && creati.every(x => x.nome === 'Fuel Surcharge' && x.origine === 'CONSORZIO' && x.euro_t_passiva === 5 && x.euro_t_attiva === 5 && x.a_chi === 'tutti')
      && r.j.traccia && r.j.traccia.scritta === true, J(r.j).slice(0, 400));
  verifica('i record scritti hanno i controlli e i conflitti che il modulo aveva gia\' detto (nessuno)', v('esitiDelModulo')(fuel, piano.cambi, []).errori === 0);
  // Il modulo riaperto su quello che c'e': lo stesso Fuel Surcharge e' un conflitto.
  const dopo = v('esitiDelModulo')(fuel, v('pianoDelSalvataggio')(fuel, {}).cambi, creati);
  verifica('scritto di nuovo, il modulo dice gia\' sotto il nome che si pagherebbe due volte', dopo.errori > 0 && (dopo.perCampo.nome || []).some(e => /si pagherebbe due volte/.test(e.messaggio)), J(dopo.perCampo));
  const doppio = await chiama(modulo, { db: { SurplusTariffa: creati }, corpo: v('pianoDelSalvataggio')(fuel, {}).richiesta });
  verifica('e il server lo ferma con 409, come dice il modulo', doppio.stato === 409 && doppio.scritte.length === 0, J(doppio.j).slice(0, 200));

  // Una modifica manda solo quello che cambia: la scheda con l'ACI che finisce prima.
  const db = FUEL.map(x => (x.tipologia === 'ACI' ? { ...x, data_fine_validita: '2026-11-30' } : { ...x }));
  const scheda = v('schedeSurplus')(db, OGGI)[0];
  const iniziale = v('bozzaDaScheda')(scheda);
  const soloRiferimento = v('pianoDelSalvataggio')({ ...iniziale, riferimento: 'comunicazione Ecotyre n. 12' }, { scheda, iniziale });
  verifica('cambiare il riferimento manda solo il riferimento, col gruppo', soloRiferimento.richiesta.operazione === 'update' && soloRiferimento.richiesta.gruppo === 'g-fuel'
    && J(soloRiferimento.richiesta.dati) === J({ riferimento: 'comunicazione Ecotyre n. 12' }), J(soloRiferimento.richiesta));
  const m1 = await chiama(modulo, { db: { SurplusTariffa: db }, corpo: soloRiferimento.richiesta });
  const aci = (m1.db.SurplusTariffa || []).find(x => x.tipologia === 'ACI') || {};
  verifica('sulla funzione vera l\'ACI tiene la sua fine (30/11), e tutti il riferimento nuovo',
    m1.stato === 200 && aci.data_fine_validita === '2026-11-30' && m1.db.SurplusTariffa.every(x => x.riferimento === 'comunicazione Ecotyre n. 12'), J(m1.db.SurplusTariffa));
  const senzaExtra = v('pianoDelSalvataggio')({ ...iniziale, canali: ['RETE', 'ACI'] }, { scheda, iniziale });
  verifica('togliere un canale lo dice al server con le tipologie', J(senzaExtra.richiesta.dati) === J({ tipologie: ['RETE', 'ACI'] }) && senzaExtra.cambi.some(c => c.canale === 'EXTRA_RACCOLTA' && c.dopo === null), J(senzaExtra.richiesta));
  const m2 = await chiama(modulo, { db: { SurplusTariffa: db }, corpo: senzaExtra.richiesta });
  verifica('e la funzione vera elimina solo l\'extra raccolta', m2.stato === 200 && J((m2.db.SurplusTariffa || []).map(x => x.tipologia).sort()) === J(['ACI', 'RETE']), J(m2.j).slice(0, 300));
  const aciDiverso = v('pianoDelSalvataggio')({ ...iniziale, perCanale: true, importi: { ...iniziale.importi, ACI: { passiva: '4,00', attiva: '4,50' } } }, { scheda, iniziale });
  verifica('importi diversi per canale: importi_per_canale per tutti i canali', J(aciDiverso.richiesta.dati.importi_per_canale) === J({ RETE: { euro_t_passiva: 5, euro_t_attiva: 5 }, ACI: { euro_t_passiva: 4, euro_t_attiva: 4.5 }, EXTRA_RACCOLTA: { euro_t_passiva: 5, euro_t_attiva: 5 } }), J(aciDiverso.richiesta));
  const m3 = await chiama(modulo, { db: { SurplusTariffa: db }, corpo: aciDiverso.richiesta });
  const aci3 = (m3.db.SurplusTariffa || []).find(x => x.tipologia === 'ACI') || {};
  verifica('e sulla funzione vera l\'ACI passa a 4 e 4,50, la rete resta a 5', m3.stato === 200 && aci3.euro_t_passiva === 4 && aci3.euro_t_attiva === 4.5 && m3.db.SurplusTariffa.find(x => x.tipologia === 'RETE').euro_t_passiva === 5, J(m3.db.SurplusTariffa));
  const nulla = v('pianoDelSalvataggio')({ ...iniziale }, { scheda, iniziale });
  verifica('salvare senza cambiare niente non scrive niente', nulla.nulla === true, J(nulla.richiesta));

  // Chiudere il periodo: accorcia, non allunga; solo i canali che finiscono dopo.
  const chiusa = v('chiusuraDelPeriodo')(scheda, '2026-11-15');
  verifica('chiudere al 15/11: tutti e tre i canali finiscono dopo, una richiesta sola col gruppo',!chiusa.errore && chiusa.richieste.length === 1 && chiusa.richieste[0].gruppo === 'g-fuel', J(chiusa));
  const alDieci = v('chiusuraDelPeriodo')(scheda, '2026-12-10');
  verifica('chiudere al 10/12: l\'ACI (fino al 30/11) non si riallunga, si scrivono solo rete ed extra raccolta', !alDieci.errore && alDieci.richieste.length === 2 && alDieci.richieste.every(x => x.id && x.dati.data_fine_validita === '2026-12-10') && !alDieci.richieste.some(x => x.id === 's1'), J(alDieci));
  const m4 = await chiama(modulo, { db: { SurplusTariffa: db }, corpo: alDieci.richieste[0] });
  verifica('e la funzione vera lo scrive', m4.stato === 200 && m4.db.SurplusTariffa.find(x => x.id === alDieci.richieste[0].id).data_fine_validita === '2026-12-10', J(m4.j).slice(0, 200));
  verifica('una data dopo la fine non si accetta', /non lo allunga/.test(v('chiusuraDelPeriodo')(v('schedeSurplus')(FUEL, OGGI)[0], '2027-01-15').errore || ''));
  const via = v('eliminazioneDellaScheda')(scheda);
  const m5 = await chiama(modulo, { db: { SurplusTariffa: db }, corpo: via.richiesta });
  verifica('eliminare la scheda elimina tutti i canali col gruppo', via.richiesta.operazione === 'delete' && via.richiesta.gruppo === 'g-fuel' && m5.stato === 200 && !(m5.db.SurplusTariffa || []).length, J(m5.j).slice(0, 200));

  // L'anteprima dei mesi chiusi: si chiede solo se il cambio tocca un mese non futuro.
  verifica('il Fuel Surcharge scritto il 13/10 tocca ottobre: si chiede l\'anteprima', v('toccaMesiPassati')(piano.cambi, OGGI) === true);
  verifica('un surplus da novembre, scritto a ottobre, no: nessuna richiesta in piu\'', v('toccaMesiPassati')(v('pianoDelSalvataggio')({ ...fuel, dal: '2026-11-01' }, {}).cambi, OGGI) === false);
  const chiamate = [];
  const finto = (risposte) => async (nome, corpo) => { chiamate.push({ nome, corpo }); return { data: risposte(corpo) }; };
  const MESE = { anno: 2026, mese: 10, canale: 'RETE', messaggio: 'Ottobre 2026, rete: la fatturazione attiva è chiusa: il surplus vale 1.609,15 € da Ecotyre.' };
  const conMese = await v('scriviSurplus')(finto(c => (c.anteprima ? { anteprima: true, mesi_chiusi: [MESE] } : { result: [] })), piano.richiesta, { anteprima: true });
  verifica('con un mese chiuso l\'anteprima ferma la scrittura e lo rimanda per la conferma', conMese.stato === 'da_confermare' && J(conMese.mesi) === J([MESE]) && chiamate.length === 1 && chiamate[0].corpo.anteprima === true && chiamate[0].nome === 'gestisciAnagrafiche', J(chiamate));
  chiamate.length = 0;
  const senzaMese = await v('scriviSurplus')(finto(c => (c.anteprima ? { anteprima: true } : { result: [{ id: 'x' }], traccia: { scritta: false, motivo: 'registro pieno' } })), piano.richiesta, { anteprima: true });
  verifica('senza mesi chiusi scrive subito dopo l\'anteprima', senzaMese.stato === 'fatto' && chiamate.length === 2 && chiamate[1].corpo.anteprima === undefined, J(chiamate));
  const righe = v('resocontoDelSalvataggio')(senzaMese.data, notaTraccia(senzaMese.data));
  verifica('e se lo storico non si e\' scritto, il resoconto lo dice', righe.some(x => /non è finita nello storico delle modifiche: registro pieno/.test(x)), J(righe));
  const chiuso = v('resocontoDelSalvataggio')({ surplus_chiusi: [{ nome: 'Fuel Surcharge', tipologia: 'RETE', data_fine_validita: '2026-10-31' }] }, '');
  verifica('il surplus di prima chiuso dal nuovo si dice, con la data all\'italiana', J(chiuso) === J(['Fuel Surcharge sul canale Rete ora vale fino al 31/10/2026: dal giorno dopo vale quello nuovo.']), J(chiuso));
  const err = v('erroreDellaRisposta')({ message: 'Request failed with status code 409', response: { status: 409, data: { error: 'Sul canale rete c\'è già Fuel Surcharge' } } });
  verifica('l\'errore si legge dal corpo della risposta, non dal messaggio del client', err.stato === 409 && err.testo === 'Sul canale rete c\'è già Fuel Surcharge', J(err));
});

await sezione('3. I CONTROLLI DEL MODULO, CAMPO PER CAMPO', async () => {
  const esiti = (bozza, esistenti = []) => v('esitiDelModulo')(bozza, v('pianoDelSalvataggio')(bozza, {}).cambi, esistenti);
  const vuoto = esiti(v('bozzaVuota')());
  verifica('il modulo vuoto: errori sotto canali, nome, origine, importo, dal e al', ['canali', 'nome', 'origine', 'passiva', 'dal', 'al'].every(c => (vuoto.perCampo[c] || []).some(e => e.gravita === 'errore')), J(Object.keys(vuoto.perCampo)));
  const fuel = v('bozzaFuelSurcharge')(OGGI);
  verifica('il Fuel Surcharge del consorzio: nessun errore, nessun avviso', esiti(fuel).errori === 0 && !Object.keys(esiti(fuel).perCampo).length, J(esiti(fuel)));
  const lungo = esiti({ ...fuel, al: '2027-01-31' });
  verifica('fine nel 2027 con inizio nel 2026: errore sotto «Al»', (lungo.perCampo.al || []).some(e => e.gravita === 'errore' && /i contratti sono annuali/.test(e.messaggio)), J(lungo.perCampo));
  const sessanta = esiti({ ...fuel, passiva: '60' });
  verifica('60 €/t: un avviso sotto l\'importo, non un errore', sessanta.errori === 0 && (sessanta.perCampo.passiva || []).some(e => e.gravita === 'avviso' && /60,00 €\/t/.test(e.messaggio)), J(sessanta.perCampo));
  const testo = esiti({ ...fuel, passiva: 'cinque' });
  verifica('un importo che non e\' un numero si dice', (testo.perCampo.passiva || []).some(e => /non è un numero/.test(e.messaggio)), J(testo.perCampo));
  verifica('gli importi all\'italiana: «5,00» e «5.5» si leggono, il vuoto e\' null (un valore mancante non e\' zero)',
    v('leggiImporto')('5,00') === 5 && v('leggiImporto')('5.5') === 5.5 && v('leggiImporto')('') === null && v('leggiImporto')(' 2,125 €/t') === 2.125);
  const solo = esiti({ ...fuel, a_chi: 'elenco', fornitori: [] });
  verifica('«solo questi fornitori» senza nessuno: errore sotto «A chi»', (solo.perCampo.a_chi || []).some(e => e.gravita === 'errore' && /elenco è vuoto/.test(e.messaggio)), J(solo.perCampo));
  const secondarie = v('pianoDelSalvataggio')({ ...fuel, prestazione: 'TRASPORTO_SECONDARIA', uguale: false, attiva: '5,00' }, {});
  verifica('il trasporto delle secondarie non ha la parte da Ecotyre, anche se scritta', secondarie.richiesta.dati.euro_t_attiva === null && esiti({ ...fuel, prestazione: 'TRASPORTO_SECONDARIA' }).errori === 0, J(secondarie.richiesta.dati));
  const soloAttivo = v('pianoDelSalvataggio')({ ...fuel, passiva: '', uguale: false, attiva: '5' }, {});
  verifica('solo da Ecotyre: ai fornitori null, non zero', soloAttivo.richiesta.dati.euro_t_passiva === null && soloAttivo.richiesta.dati.euro_t_attiva === 5, J(soloAttivo.richiesta.dati));
  // Il cambio d'importo da una data: quello di prima si chiude il giorno prima.
  const sei = esiti({ ...fuel, passiva: '6', dal: '2026-11-01' }, FUEL);
  verifica('6 €/t dal 01/11: il modulo dice che il Fuel Surcharge di prima si chiude il 31/10, una frase che nomina i tre canali',
    sei.errori === 0 && J(sei.chiusure) === J(['Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026 al 31/12/2026, su Rete, ACI ed Extra raccolta si chiude il 31/10/2026, il giorno prima di questo: fino a quel giorno resta valido com\'è.']), J(sei));
  const soloRete = esiti({ ...fuel, canali: ['RETE'] }, [FUEL[0]]);
  verifica('il conflitto si dice sotto il nome, una volta', (soloRete.perCampo.nome || []).filter(e => /si pagherebbe due volte/.test(e.messaggio)).length === 1, J(soloRete.perCampo));
  const dueCanali = esiti({ ...fuel, canali: ['RETE', 'ACI'] }, [FUEL[0]]);
  verifica('e se riguarda solo uno dei canali scelti, lo nomina', (dueCanali.perCampo.nome || []).some(e => /^Rete: c'è già lo stesso surplus/.test(e.messaggio)), J(dueCanali.perCampo));
  const accordo = esiti({ ...fuel, nome: 'Accordo Gatim', origine: 'ACCORDO_COMMERCIALE', canali: ['RETE'] }, FUEL);
  verifica('un altro surplus sulle stesse tonnellate: avviso, si pagano tutti e due', accordo.errori === 0 && accordo.avvisi.some(a => /si applicano tutti e due/.test(a)), J(accordo));
});

await sezione('4. LA FRASE CHE DICE CHE COSA SUCCEDE', async () => {
  const fuel = v('bozzaFuelSurcharge')(OGGI);
  verifica('il Fuel Surcharge del consorzio, come lo dice il progetto',
    v('fraseDelSurplus')(fuel) === 'Dal 01/10/2026 al 31/12/2026, su Rete, ACI ed Extra raccolta, ogni raccoglitore riceve 5,00 €/t in più sulle tonnellate raccolte nel mese, e SMOCO fattura a Ecotyre 5,00 €/t in più sulle stesse tonnellate. SMOCO, che è interna, non lo riceve: sulle tonnellate che raccoglie lei il surplus da Ecotyre resta a SMOCO. Ogni canale ha la sua riga, e i canali non si sommano.',
    v('fraseDelSurplus')(fuel));
  verifica('solo ai fornitori, su un canale', v('fraseDelSurplus')({ ...fuel, canali: ['ACI'], uguale: false, attiva: '' }).startsWith('Dal 01/10/2026 al 31/12/2026, sull\'ACI, ogni raccoglitore riceve 5,00 €/t in più sulle tonnellate raccolte nel mese, e a Ecotyre non si fattura niente in più.'), v('fraseDelSurplus')({ ...fuel, canali: ['ACI'], uguale: false, attiva: '' }));
  const elenco = v('fraseDelSurplus')({ ...fuel, canali: ['RETE'], a_chi: 'elenco', fornitori: [{ id: 'f3', nome: 'GATIM S.R.L.' }], origine: 'ACCORDO_COMMERCIALE', passiva: '2', uguale: false, attiva: '' });
  verifica('un accordo con un fornitore: lo nomina, e non parla di SMOCO', elenco === 'Dal 01/10/2026 al 31/12/2026, sulla Rete, GATIM S.R.L. riceve 2,00 €/t in più sulle tonnellate raccolte nel mese, e a Ecotyre non si fattura niente in più. Il surplus ha la sua riga, sotto quella della tariffa.', elenco);
  const diversi = v('fraseDelSurplus')({ ...fuel, perCanale: true, importi: { RETE: { passiva: '5', attiva: '5' }, ACI: { passiva: '4', attiva: '4,50' }, EXTRA_RACCOLTA: { passiva: '5', attiva: '5' } } });
  verifica('importi diversi per canale: una parte per importo, i canali mai sommati', /^Dal 01\/10\/2026 al 31\/12\/2026: su Rete ed Extra raccolta ogni raccoglitore riceve 5,00 €\/t .*; sull'ACI ogni raccoglitore riceve 4,00 €\/t .* SMOCO fattura a Ecotyre 4,50 €\/t in più sulle stesse tonnellate\./.test(diversi), diversi);
});

await sezione('5. LE SCHEDE E LA FASCIA', async () => {
  const passato = { ...FUEL[0], id: 'v1', gruppo: 'g-vecchio', nome: 'Contributo estivo', data_inizio_validita: '2026-06-01', data_fine_validita: '2026-08-31' };
  const futuro = { ...FUEL[0], id: 'n1', gruppo: 'g-nuovo', nome: 'Fuel Surcharge', euro_t_passiva: 6, euro_t_attiva: 6, data_inizio_validita: '2027-01-01', data_fine_validita: '2027-03-31' };
  const schede = v('schedeSurplus')([passato, ...FUEL, futuro], OGGI);
  verifica('i tre record del Fuel Surcharge sono una scheda; in ordine in corso, in arrivo, concluso', J(schede.map(s => [s.chiave, s.stato, s.canali.length])) === J([['g-fuel', 'in_corso', 3], ['g-nuovo', 'in_arrivo', 1], ['g-vecchio', 'concluso', 1]]), J(schede.map(s => [s.chiave, s.stato])));
  verifica('la scheda: importi uguali, 5 e 5, dal 01/10 al 31/12', schedeSurplus_ok(schede[0]), J(schede[0]).slice(0, 300));
  function schedeSurplus_ok(s) { return s.importiUguali && s.dateUguali && s.passiva === 5 && s.attiva === 5 && s.dal === '2026-10-01' && s.al === '2026-12-31' && s.origine_testo === 'consorzio Ecotyre'; }
  verifica('la barra del periodo: il 13/10 e\' il 14,1%, ancora 79 giorni', J(v('avanzamento')('2026-10-01', '2026-12-31', OGGI)) === J({ pct: 14.1, giorni: 79 }));
  const col = new Map(TARIFFE.map(t => [t.id, S.surplusDellaTariffa(t, [...FUEL, futuro], OGGI)]));
  const conti = v('tariffeDelleSchede')(TARIFFE, col, archiviata);
  const c = conti.get('g-fuel') || {};
  verifica('le tariffe del Fuel Surcharge: le due raccolte di Emmesse e l\'attiva; non il trattamento, non Gatim archiviata', c.totale === 3 && c.passive === 2 && c.attive === 1 && J(c.prestazioni) === J({ RACCOLTA: 2 }), J({ ...c, ids: [...(c.ids || [])] }));
  verifica('e a parole: «3 tariffe interessate (2 di raccolta, 1 attiva)»', v('testoTariffe')(c) === '3 tariffe interessate (2 di raccolta, 1 attiva)', v('testoTariffe')(c));
  verifica('gli importi della fascia: all\'amministratore tutti e due, agli altri solo da Ecotyre',
    v('importiAParole')(schede[0]) === '+5,00 €/t ai raccoglitori e da Ecotyre' && v('importiAParole')(schede[0], { conCosti: false }) === '+5,00 €/t da Ecotyre');
  verifica('il filtro «Con surplus»: Emmesse si\', il trattamento no', v('haSurplus')(col.get('t1')) && !v('haSurplus')(col.get('t3')));

  // Sui dati veri: il Fuel Surcharge sulle tariffe della copia.
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) {
    console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: questa parte e' saltata.`);
  } else {
    const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8'));
    const tariffe = DATI.archivi.Tariffa || [];
    const colonna = new Map(tariffe.map(t => [t.id, S.surplusDellaTariffa(t, FUEL, OGGI)]));
    const veri = v('tariffeDelleSchede')(tariffe, colonna, archiviata).get('g-fuel') || {};
    console.log(`  copia ${copie[copie.length - 1]}: ${tariffe.length} tariffe, la fascia dice «${v('testoTariffe')(veri)}»`);
    verifica('sui dati veri la fascia dice «29 tariffe interessate (22 di raccolta, 7 attive)»', v('testoTariffe')(veri) === '29 tariffe interessate (22 di raccolta, 7 attive)', v('testoTariffe')(veri));
    verifica('senza surplus nessuna tariffa ha la pastiglia', tariffe.every(t => !v('haSurplus')(S.surplusDellaTariffa(t, [], OGGI))));
  }
});

await sezione('6. LA SCORCIATOIA DEL CONSORZIO PRENDE L\'ANNO DI OGGI', async () => {
  const b27 = v('bozzaFuelSurcharge')('2027-02-10');
  verifica('aperta nel 2027 propone dal 01/10/2027 al 31/12/2027', b27.dal === '2027-10-01' && b27.al === '2027-12-31' && b27.nome === 'Fuel Surcharge' && b27.origine === 'CONSORZIO' && J(b27.canali) === J(['RETE', 'ACI', 'EXTRA_RACCOLTA']) && b27.a_chi === 'tutti', J(b27));
  const anni = [src.sezione, src.modulo, src.vista].map(senzaCommenti).join('\n').match(/\b20\d\d\b/g) || [];
  verifica('nessun anno scritto nel codice delle tre parti nuove', anni.length === 0, J(anni));
  verifica('la scorciatoia c\'e\', accanto a «Nuovo surplus»', /Fuel Surcharge del consorzio<\/Button>/.test(src.sezione) && /bozzaFuelSurcharge\(oggi\)/.test(src.sezione) && /Nuovo surplus<\/Button>/.test(src.sezione));
});

await sezione('7. IL COLORE DEL SURPLUS', async () => {
  const css = src.css;
  const blocco = (inizio) => { const i = css.indexOf(inizio); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  const chiaro = (blocco(':root {').match(/--eco-surplus:\s*([^;]+);/) || [])[1];
  const scuro = (blocco('.dark {').match(/--eco-surplus:\s*([^;]+);/) || [])[1];
  verifica('il token c\'e\' nel tema chiaro e nello scuro, come gli altri (tre numeri HSL)', /^\d+ \d+% \d+%$/.test(chiaro || '') && /^\d+ \d+% \d+%$/.test(scuro || ''), `${chiaro} / ${scuro}`);
  verifica('e nello scuro e\' piu\' chiaro, per leggersi sulle schede scure', !!chiaro && !!scuro && Number(scuro.split(' ')[2].replace('%', '')) > Number(chiaro.split(' ')[2].replace('%', '')));
  const usi = [src.tariffe, src.sezione, src.modulo].join('\n');
  verifica('le pagine usano il token, non un colore loro', (usi.match(/hsl\(var\(--eco-surplus\)/g) || []).length >= 10 && !/(violet|purple|indigo)-\d/.test(usi));
  const fascia = src.sezione.slice(src.sezione.indexOf('export function FasciaSurplus'), src.sezione.indexOf('// === La scheda di un surplus'));
  const pastiglie = src.sezione.slice(src.sezione.indexOf('function PastigliaSurplus'), src.sezione.indexOf('export function FasciaSurplus'));
  verifica('niente ambra ne\' rosso per un surplus, nella fascia e nelle pastiglie (qui vogliono dire «c\'e\' un problema»)', fascia.length > 100 && pastiglie.length > 100 && !/amber|red-|destructive|orange/.test(fascia + pastiglie));
});

// Le sezioni vere impacchettate dalla 8, per disegnarle anche nella 9.
let PAGINA = null;
const testoDi = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

await sezione('8. IL DISEGNO DELLE SEZIONI VERE', async () => {
  const nuove = [src.sezione, src.modulo];
  verifica('niente spiegazioni in title= (sul telefono non si vedono): al tocco si apre un riquadro', nuove.every(x => !/\btitle=/.test(senzaCommenti(x))) && /<Popover>/.test(src.sezione));
  verifica('niente finestre di sistema (alert, confirm, prompt)', nuove.every(x => !/\b(alert|confirm|prompt)\(/.test(senzaCommenti(x))));
  verifica('a 375 px: le schede una per riga, due da lg; i due importi uno sopra l\'altro, affiancati da sm',
    /grid grid-cols-1 gap-3 lg:grid-cols-2/.test(src.sezione) && /grid grid-cols-1 gap-2 \$\{conCosti \? 'sm:grid-cols-2' : ''\}/.test(src.sezione) && /max-w-2xl overflow-y-auto p-4 sm:p-6/.test(src.modulo));
  verifica('nessun componente definito dentro un altro (il cursore uscirebbe dal campo)', !/^[ \t]{2,}(?:function\s+[A-Z]\w*\s*\(|const\s+[A-Z]\w*\s*=\s*(?:\([^)]*\)|\w+)\s*=>)/m.test(senzaCommenti(src.modulo + src.sezione)));

  const CLIENT_FINTO = 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: {}, auth: { me: async () => null } };';
  const AUTH_FINTO = 'export const useAuth = () => ({ user: globalThis.__UTENTE || null, isLoadingAuth: false });';
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import SurplusSezione, { PastiglieSurplus, FasciaSurplus } from ${J(qui('../src/components/fatturazione/SurplusSezione.jsx'))};
import { CorpoSurplusForm } from ${J(qui('../src/components/fatturazione/SurplusForm.jsx'))};
const C = { SurplusSezione, PastiglieSurplus, FasciaSurplus, CorpoSurplusForm };
export const disegna = (nome, props) => renderToStaticMarkup(React.createElement(C[nome], props));
`;
  let L = null;
  try {
    const pacchetto = await build({
      stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      loader: { '.jsx': 'jsx', '.js': 'jsx' },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'finti', setup(b) {
        b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
        b.onResolve({ filter: /^@\/lib\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'client-finto' }));
        b.onLoad({ filter: /.*/, namespace: 'client-finto' }, (a) => ({ contents: a.path === 'auth' ? AUTH_FINTO : CLIENT_FINTO, loader: 'js' }));
        b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
      } }],
    });
    if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) };
    L = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  } catch (e) { verifica('le sezioni del surplus si impacchettano e si caricano', false, String(e && e.message).slice(0, 400)); return; }
  PAGINA = L;
  const testo = testoDi;
  const disegna = (nome, props) => { try { return L.disegna(nome, props); } catch (e) { verifica(`${nome} si disegna`, false, String(e && e.message).slice(0, 300)); return ''; } };
  const tuttiGliHtml = [];
  const d = (nome, props) => { const h = disegna(nome, props); tuttiGliHtml.push(h); return h; };

  const amm = testo(d('SurplusSezione', { surplus: FUEL, fornitori: [], isAdmin: true, oggi: OGGI }));
  verifica('la scheda del Fuel Surcharge, all\'amministratore: nome, stato, origine e riferimento, canali, a chi',
    amm.includes('Fuel Surcharge') && amm.includes('In corso') && amm.includes('consorzio Ecotyre · comunicazione Ecotyre del 30/09/2026') && amm.includes('Rete ACI Extra raccolta') && amm.includes('Raccolta · a tutti i raccoglitori'), amm.slice(0, 600));
  verifica('i due importi, all\'italiana: «Ai raccoglitori +5,00 €/t» e «Da Ecotyre +5,00 €/t»', amm.includes('Ai raccoglitori +5,00 €/t') && amm.includes('Da Ecotyre +5,00 €/t'), amm);
  verifica('il periodo con oggi: 01/10/2026, 31/12/2026, «oggi 13/10/2026 · ancora 79 giorni»', amm.includes('01/10/2026 31/12/2026') && amm.includes('oggi 13/10/2026 · ancora 79 giorni'), amm);
  verifica('i comandi dell\'amministratore', ['Nuovo surplus', 'Fuel Surcharge del consorzio', 'Modifica', 'Chiudi il periodo', 'Storico', 'Elimina'].every(x => amm.includes(x)), amm);
  const altri = testo(d('SurplusSezione', { surplus: FUEL, fornitori: [], isAdmin: false, oggi: OGGI }));
  verifica('a chi non e\' amministratore: niente importo ai fornitori e niente comandi; quello da Ecotyre si\'',
    !altri.includes('Ai raccoglitori') && !altri.includes('Modifica') && !altri.includes('Nuovo surplus') && altri.includes('Da Ecotyre +5,00 €/t'), altri);
  const nonLetti = testo(d('SurplusSezione', { surplus: null, erroreLettura: 'rete assente', isAdmin: true, oggi: OGGI }));
  verifica('se i surplus non si leggono, si dice (e non «nessun surplus»)', nonLetti.includes('I surplus non si sono letti (rete assente)') && !nonLetti.includes('Nessun surplus'), nonLetti);
  const nessuno = testo(d('SurplusSezione', { surplus: [], isAdmin: true, oggi: OGGI }));
  verifica('nessun surplus: lo si dice, con i comandi per scriverlo', nessuno.includes('Nessun surplus.') && nessuno.includes('Nuovo surplus'), nessuno);
  const conclusi = testo(d('SurplusSezione', { surplus: [{ ...FUEL[0], data_inizio_validita: '2026-06-01', data_fine_validita: '2026-08-31' }], isAdmin: true, oggi: OGGI }));
  verifica('i conclusi stanno chiusi in «Mostra i conclusi e i disattivati (1)»', conclusi.includes('Mostra i conclusi e i disattivati (1)') && !conclusi.includes('Chiudi il periodo'), conclusi);

  const p = (t, surplus = FUEL) => testo(d('PastiglieSurplus', { col: S.surplusDellaTariffa(t, surplus, OGGI), tariffa: t }));
  verifica('la colonna: «+5,00 €/t» sulla raccolta di rete e sull\'attiva, «—» sul trattamento', p(TARIFFE[0]) === '+5,00 €/t' && p(TARIFFE[3]) === '+5,00 €/t' && p(TARIFFE[2]) === '—', `${p(TARIFFE[0])} | ${p(TARIFFE[3])} | ${p(TARIFFE[2])}`);
  const futuro = { ...FUEL[0], id: 'n1', gruppo: 'g-nuovo', euro_t_passiva: 6, euro_t_attiva: 6, data_inizio_validita: '2027-01-01', data_fine_validita: '2027-03-31' };
  const t2027 = { ...TARIFFE[0], data_fine_validita: '2027-12-31' };
  verifica('e quello in arrivo: «dal 01/01 +6,00 €/t»', p(t2027, [futuro]) === 'dal 01/01 +6,00 €/t', p(t2027, [futuro]));
  verifica('due surplus, due pastiglie', p(t2027, [...FUEL, futuro]) === '+5,00 €/t dal 01/01 +6,00 €/t', p(t2027, [...FUEL, futuro]));
  verifica('i surplus non letti: «non letto», non «—»', testo(d('PastiglieSurplus', { col: null, tariffa: TARIFFE[0] })) === 'non letto');

  const schede = v('schedeSurplus')(FUEL, OGGI);
  const conti = v('tariffeDelleSchede')(TARIFFE, new Map(TARIFFE.map(t => [t.id, S.surplusDellaTariffa(t, FUEL, OGGI)])), archiviata);
  const fascia = testo(d('FasciaSurplus', { schede, conti, conCosti: true, onVai: () => {} }));
  verifica('la fascia: «In corso Fuel Surcharge +5,00 €/t ai raccoglitori e da Ecotyre consorzio Ecotyre · Rete, ACI ed Extra raccolta · fino al 31/12/2026 · 3 tariffe interessate (2 di raccolta, 1 attiva)»',
    fascia.startsWith('In corso Fuel Surcharge +5,00 €/t ai raccoglitori e da Ecotyre consorzio Ecotyre · Rete, ACI ed Extra raccolta · fino al 31/12/2026 · 3 tariffe interessate (2 di raccolta, 1 attiva)') && fascia.includes('Vedi i surplus'), fascia);
  verifica('senza surplus in corso o in arrivo la fascia non c\'e\'', d('FasciaSurplus', { schede: v('schedeSurplus')([{ ...FUEL[0], data_fine_validita: '2026-10-12' }], OGGI), conti: new Map() }) === '');

  const modulo = testo(d('CorpoSurplusForm', { bozzaIniziale: v('bozzaFuelSurcharge')(OGGI), surplus: [], fornitori: [], oggi: OGGI, onClose() {}, onSalvato() {} }));
  verifica('il modulo: i quattro blocchi col loro titolo', ['1 Che cosa', '2 Su che cosa', '3 Quanto', '4 Quando'].every(x => modulo.includes(x)), modulo.slice(0, 500));
  verifica('e prima di salvare la frase di che cosa succede', modulo.includes('Che cosa succede Dal 01/10/2026 al 31/12/2026, su Rete, ACI ed Extra raccolta, ogni raccoglitore riceve 5,00 €/t in più'), modulo);
  verifica('il modulo propone «uguale a quello dei fornitori» e dice che il vuoto vuol dire «non si paga»', modulo.includes('uguale a quello dei fornitori') && modulo.includes('Vuoto se Ecotyre non lo paga.') && modulo.includes('Vuoto se non paga niente.'), modulo);
  const conflitto = testo(d('CorpoSurplusForm', { bozzaIniziale: v('bozzaFuelSurcharge')(OGGI), surplus: FUEL, fornitori: [], oggi: OGGI, onClose() {}, onSalvato() {} }));
  verifica('se lo stesso surplus c\'e\' gia\', il modulo lo dice subito sotto il nome', conflitto.includes('C\'è già lo stesso surplus negli stessi giorni'), conflitto.slice(0, 900));

  const tutto = tuttiGliHtml.join('\n');
  verifica('nessuna parola della piattaforma a video', !/base44/i.test(tutto));
  verifica('niente numeri all\'inglese negli importi a video', !/\d\.\d{2} €|€\/kg/.test(testo(tutto)), (testo(tutto).match(/.{0,30}(\d\.\d{2} €|€\/kg).{0,30}/) || [])[0]);
});

await sezione('9. I CANALI CON DATE DIVERSE: LA FASCIA E IL MODULO DICONO IL PERIODO DI OGNI CANALE', async () => {
  // La regola 7 del progetto fatta su un canale solo: il Fuel Surcharge dei tre
  // canali, poi «Nuovo surplus» Fuel Surcharge a 6 €/t sulla sola rete dal
  // 01/11. I record li scrive la funzione vera, dalle richieste della pagina.
  const modulo = await caricaFunzione('gestisciAnagrafiche');
  // Le funzioni nuove della revisione: se mancano la verifica fallisce, ma la
  // sezione va avanti fino al disegno (la controprova deve vedere la fascia vera).
  const senza = (f) => (...a) => { try { return f(...a); } catch (e) { return undefined; } };
  const nellaFascia = senza((s) => v('schedaNellaFascia')(s));
  const dateDiverse = senza((s) => v('testoDateDiverse')(s));
  const fuel = v('bozzaFuelSurcharge')(OGGI);
  const r1 = await chiama(modulo, { db: {}, corpo: v('pianoDelSalvataggio')(fuel, {}).richiesta });
  const sei ={ ...fuel, canali: ['RETE'], passiva: '6,00', dal: '2026-11-01', al: '2026-12-31' };
  const piano = v('pianoDelSalvataggio')(sei, {});
  const esiti = v('esitiDelModulo')(sei, piano.cambi, r1.db.SurplusTariffa || []);
  verifica('prima di salvare, la chiusura nomina il canale che si chiude e dice che gli altri restano',
    J(esiti.chiusure) === J(['Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026 al 31/12/2026, sulla Rete si chiude il 31/10/2026, il giorno prima di questo: fino a quel giorno resta valido com\'è. Su ACI ed Extra raccolta resta com\'è.']), J(esiti.chiusure));
  const r2 = await chiama(modulo, { db: r1.db, corpo: piano.richiesta });
  const records = r2.db.SurplusTariffa || [];
  const fine = (c, e) => (records.find(x => x.tipologia === c && x.euro_t_passiva === e) || {}).data_fine_validita;
  verifica('la funzione vera chiude la rete del +5 al 31/10; ACI ed extra raccolta restano al 31/12, nello stesso gruppo',
    r2.stato === 200 && records.length === 4 && fine('RETE', 5) === '2026-10-31' && fine('ACI', 5) === '2026-12-31' && fine('EXTRA_RACCOLTA', 5) === '2026-12-31' && fine('RETE', 6) === '2026-12-31',
    J(records.map(x => [x.tipologia, x.euro_t_passiva, x.data_inizio_validita, x.data_fine_validita])));

  // La fascia: solo i canali vivi, ognuno fino al suo giorno.
  const vecchiaIl = (giorno) => v('schedeSurplus')(records, giorno).find(s => s.canali.some(c => c.passiva === 5));
  const f13 = nellaFascia(vecchiaIl(OGGI)) || {};
  verifica('il 13/10 il +5 e\' «In corso · Rete fino al 31/10/2026, ACI ed Extra raccolta fino al 31/12/2026»',
    f13.etichetta === 'In corso' && J(f13.dove) === J(['Rete fino al 31/10/2026, ACI ed Extra raccolta fino al 31/12/2026']), J([f13.etichetta, f13.dove]));
  const f5 = nellaFascia(vecchiaIl('2026-11-05')) || {};
  verifica('il 05/11 la rete del +5 e\' conclusa e non si nomina: «ACI ed Extra raccolta · fino al 31/12/2026»',
    f5.etichetta === 'In corso' && J(f5.dove) === J(['ACI ed Extra raccolta', 'fino al 31/12/2026']) && J((f5.canali || []).map(c => c.canale)) === J(['ACI', 'EXTRA_RACCOLTA']), J([f5.etichetta, f5.dove]));
  verifica('a gennaio il Fuel Surcharge e\' tutto concluso: nella fascia non c\'e\'', v('schedeSurplus')(records, '2027-01-05').every(s => nellaFascia(s) === null));
  const inArrivo = nellaFascia(v('schedeSurplus')(FUEL.map(x => (x.tipologia === 'ACI' ? { ...x, data_inizio_validita: '2026-11-01' } : x)), '2026-09-20')[0]) || {};
  verifica('in arrivo, con canali che cominciano in giorni diversi: «In arrivo» e il periodo di ognuno',
    inArrivo.etichetta === 'In arrivo' && J(inArrivo.dove) === J(['Rete ed Extra raccolta dal 01/10/2026 al 31/12/2026, ACI dal 01/11/2026 al 31/12/2026']), J([inArrivo.etichetta, inArrivo.dove]));
  const mista = v('schedeSurplus')([{ ...FUEL[0], euro_t_passiva: 4, euro_t_attiva: 4, data_fine_validita: '2026-10-10' }, FUEL[1], FUEL[2]], OGGI)[0];
  verifica('un canale gia\' concluso con un altro importo non fa «importi diversi»: la fascia dice +5',
    v('importiAParole')(nellaFascia(mista)) === '+5,00 €/t ai raccoglitori e da Ecotyre' && v('importiAParole')(mista) === 'importi diversi per canale', v('importiAParole')(nellaFascia(mista)));
  const soloCosti = v('schedeSurplus')([{ ...FUEL[0], euro_t_passiva: 6 }, FUEL[1], FUEL[2]], OGGI)[0];
  verifica('a chi non e\' amministratore, se cambia solo la parte ai fornitori, la fascia dice lo stesso «+5,00 €/t da Ecotyre»',
    v('importiAParole')(soloCosti, { conCosti: false }) === '+5,00 €/t da Ecotyre' && v('importiAParole')(soloCosti) === 'importi diversi per canale', J(v('importiAParole')(soloCosti, { conCosti: false })));

  // Il modulo della scheda di prima: le date di ogni canale.
  const vecchia = vecchiaIl(OGGI);
  const iniziale = v('bozzaDaScheda')(vecchia);
  const fraseDi = (bozza) => v('fraseDelSurplus')(bozza, v('pianoDelSalvataggio')(bozza, { scheda: vecchia, iniziale }).cambi);
  verifica('la frase del modulo da\' le date di ogni canale, finche\' Dal e Al non si toccano',
    fraseDi(iniziale).startsWith('Sulla Rete dal 01/10/2026 al 31/10/2026 e su ACI ed Extra raccolta dal 01/10/2026 al 31/12/2026: ogni raccoglitore riceve 5,00 €/t in più sulle tonnellate raccolte nel mese, e SMOCO fattura a Ecotyre 5,00 €/t in più sulle stesse tonnellate.'), fraseDi(iniziale));
  verifica('toccato solo «Dal», ogni canale tiene la sua fine, come scrive il salvataggio',
    fraseDi({ ...iniziale, dal: '2026-10-05' }).startsWith('Sulla Rete dal 05/10/2026 al 31/10/2026 e su ACI ed Extra raccolta dal 05/10/2026 al 31/12/2026:'), fraseDi({ ...iniziale, dal: '2026-10-05' }));
  verifica('toccato «Al», vale per tutti i canali: «Dal 01/10/2026 al 15/12/2026, su Rete, ACI ed Extra raccolta»',
    fraseDi({ ...iniziale, al: '2026-12-15' }).startsWith('Dal 01/10/2026 al 15/12/2026, su Rete, ACI ed Extra raccolta, ogni raccoglitore'), fraseDi({ ...iniziale, al: '2026-12-15' }));
  const avviso = 'Le date cambiano da canale a canale: Rete dal 01/10/2026 al 31/10/2026, ACI ed Extra raccolta dal 01/10/2026 al 31/12/2026. Nei campi vedi quelle della Rete: se le modifichi, valgono per tutti i canali; se non le tocchi, ogni canale tiene le sue.';
  verifica('l\'avviso del modulo dice le date di ogni canale e di quale canale sono quelle nei campi', dateDiverse(vecchia) === avviso, dateDiverse(vecchia));

  // Disegnati: la fascia vera il 13/10 e il 05/11, accanto alla colonna; il modulo vero.
  if (!PAGINA) { verifica('le sezioni impacchettate dalla 8 ci sono', false); return; }
  const disegna = (nome, props) => testoDi(PAGINA.disegna(nome, props));
  const fasciaIl = (giorno) => {
    const col = new Map(TARIFFE.map(t => [t.id, S.surplusDellaTariffa(t, records, giorno)]));
    return disegna('FasciaSurplus', { schede: v('schedeSurplus')(records, giorno), conti: v('tariffeDelleSchede')(TARIFFE, col, archiviata), conCosti: true, onVai: () => {} });
  };
  const colonnaIl = (giorno) => disegna('PastiglieSurplus', { col: S.surplusDellaTariffa(TARIFFE[0], records, giorno), tariffa: TARIFFE[0] });
  const a13 = fasciaIl(OGGI);
  verifica('la fascia vera il 13/10: il +5 sulla rete fino al 31/10, il +6 dal 01/11',
    a13 === 'In corso Fuel Surcharge +5,00 €/t ai raccoglitori e da Ecotyre consorzio Ecotyre · Rete fino al 31/10/2026, ACI ed Extra raccolta fino al 31/12/2026 · 3 tariffe interessate (2 di raccolta, 1 attiva) Dal 01/11/2026 Fuel Surcharge +6,00 €/t ai raccoglitori e da Ecotyre consorzio Ecotyre · Rete · fino al 31/12/2026 · 2 tariffe interessate (1 di raccolta, 1 attiva) Vedi i surplus', a13);
  const a5 = fasciaIl('2026-11-05');
  verifica('la fascia vera il 05/11: la rete compare solo col +6, come nella colonna della raccolta di rete',
    a5 === 'In corso Fuel Surcharge +5,00 €/t ai raccoglitori e da Ecotyre consorzio Ecotyre · ACI ed Extra raccolta · fino al 31/12/2026 · 1 tariffa interessata In corso Fuel Surcharge +6,00 €/t ai raccoglitori e da Ecotyre consorzio Ecotyre · Rete · fino al 31/12/2026 · 2 tariffe interessate (1 di raccolta, 1 attiva) Vedi i surplus'
      && colonnaIl('2026-11-05') === '+6,00 €/t', `${a5} | colonna: ${colonnaIl('2026-11-05')}`);
  verifica('e il 13/10 la colonna della raccolta di rete dice lo stesso: +5 oggi, +6 dal 01/11', colonnaIl(OGGI) === '+5,00 €/t dal 01/11 +6,00 €/t', colonnaIl(OGGI));
  const form = disegna('CorpoSurplusForm', { scheda: vecchia, surplus: records, fornitori: [], oggi: OGGI, onClose() {}, onSalvato() {} });
  verifica('il modulo vero della scheda di prima: la frase con le date di ogni canale e l\'avviso che dice di chi sono quelle nei campi',
    form.includes('Che cosa succede Sulla Rete dal 01/10/2026 al 31/10/2026 e su ACI ed Extra raccolta dal 01/10/2026 al 31/12/2026: ogni raccoglitore') && form.includes(avviso)
      && !form.includes('Dal 01/10/2026 al 31/10/2026, su Rete, ACI ed Extra raccolta'), form);
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
