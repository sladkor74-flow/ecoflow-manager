// Prova dei mesi chiesti a EcoTyna (base44/shared/strumentiAssistente.ts:
// mesiChiesti). "nei mesi di luglio e agosto" sono due mesi, "da marzo a maggio"
// sono tre: prima ne veniva letto uno solo e il resto diventava in silenzio tutto
// l'anno. npm run prove
//
// E L'ANNO DI UN MESE DETTO SENZA ANNO (prova del cambio d'anno del 15/10/2026,
// difetto 8; correzione approvata dall'utente il 15/10/2026):
// il 05/01/2027 «quanto abbiamo raccolto a dicembre?» rispondeva su dicembre
// 2027, zero tonnellate. Per gli strumenti dei fatti gia' avvenuti un mese che
// quest'anno deve ancora venire e' dell'anno scorso, se l'anno non e' scritto ne'
// nella domanda ne' nel piano (strumentiDalPiano, pianoAssistente.ts).
import { mesiChiesti, catalogoStrumenti, eseguiStrumento } from '../base44/shared/strumentiAssistente.ts';
import { strumentiDalPiano, istruzioniPiano, testoDati, CHIAVE_SCELTA } from '../base44/shared/pianoAssistente.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const nomi = (mese, mesi) => mesiChiesti(mese, mesi).nomi.join('|');
const ign = (mese, mesi) => mesiChiesti(mese, mesi).ignorati.join('|');

console.log('UN MESE SOLO');
verifica('il nome del mese', nomi('Agosto') === 'Agosto');
verifica('non importa come e scritto', nomi('agosto') === 'Agosto' && nomi('  AGOSTO ') === 'Agosto');
verifica('senza mese e tutto l anno', nomi('') === '' && nomi(null) === '' && mesiChiesti().indici.size === 0);

console.log('PIU MESI');
verifica('un elenco', nomi(null, ['Luglio', 'Agosto']) === 'Luglio|Agosto');
verifica('scritti in un campo solo con la e', nomi('luglio e agosto') === 'Luglio|Agosto');
verifica('con la virgola', nomi('luglio, agosto') === 'Luglio|Agosto');
verifica('con ed', nomi('agosto ed ottobre') === 'Agosto|Ottobre');
verifica('sempre in ordine di calendario', nomi(null, ['Ottobre', 'Marzo', 'Luglio']) === 'Marzo|Luglio|Ottobre');
verifica('lo stesso mese due volte conta una', mesiChiesti('Luglio', ['Luglio']).indici.size === 1);

console.log('UN INTERVALLO SI APRE TUTTO');
verifica('da marzo a maggio sono tre mesi', nomi('da marzo a maggio') === 'Marzo|Aprile|Maggio');
verifica('col trattino', nomi('marzo-maggio') === 'Marzo|Aprile|Maggio');
verifica('dal gennaio al dicembre e tutto l anno', mesiChiesti('dal gennaio al dicembre').indici.size === 12);
verifica('lo stesso mese due volte resta uno', nomi('da luglio a luglio') === 'Luglio');
verifica('un intervallo a cavallo dell anno NON si indovina', mesiChiesti('da dicembre a febbraio').indici.size === 0,
  nomi('da dicembre a febbraio'));
verifica('e si dice che non si e capito', ign('da dicembre a febbraio').includes('dicembre'));

console.log('QUELLO CHE NON E UN MESE SI DICE');
verifica('una parola qualunque non diventa un mese', mesiChiesti('pippo').indici.size === 0);
verifica('e finisce fra gli ignorati', ign('pippo') === 'pippo');
verifica('un mese buono e uno finto: si tiene il buono e si dice l altro',
  nomi('Agosto e pippo') === 'Agosto' && ign('Agosto e pippo') === 'pippo');
verifica('un numero non e un mese', mesiChiesti('8').indici.size === 0 && ign('8') === '8');

console.log('IN ITALIANO DAVANTI A VOCALE SI SCRIVE AD');
verifica('da gennaio ad agosto sono otto mesi', mesiChiesti('da gennaio ad agosto').indici.size === 8, nomi('da gennaio ad agosto'));
verifica('da luglio ad ottobre sono quattro', mesiChiesti('da luglio ad ottobre').indici.size === 4);
verifica('fino ad aprile parte da gennaio', nomi('da gennaio fino ad aprile') === 'Gennaio|Febbraio|Marzo|Aprile');

console.log('DUE MESI ATTACCATI DA UNA PAROLA CHE NON SI CAPISCE');
verifica('non si indovina se e elenco o intervallo', mesiChiesti('marzo oppure maggio').indici.size === 0, nomi('marzo oppure maggio'));
verifica('e si dice che non si e capito', ign('marzo oppure maggio').includes('marzo'));
verifica('ma un elenco vero resta un elenco', nomi('marzo, maggio') === 'Marzo|Maggio');

console.log('UN MESE SENZA ANNO CHE DEVE ANCORA VENIRE E\' DELL\'ANNO SCORSO');
{
  const catalogo = catalogoStrumenti();
  // Il piano come lo scrive il pianificatore: lo strumento, i suoi parametri, il periodo.
  const piano = (nome, parametri = {}, periodo = {}) => ({ strumenti: [{ nome, parametri }], canali: ['RETE'], periodo, serve_normativa: false });
  const scelto = (oggi, domanda, p) => strumentiDalPiano(p, catalogo, oggi, domanda)[0] || { parametri: {} };
  const anno = (oggi, domanda, p) => scelto(oggi, domanda, p).parametri.anno;
  const GEN = '2027-01-05';
  const dic = scelto(GEN, 'quanto abbiamo raccolto a dicembre?', piano('raccolto', { mese: 'Dicembre' }, { mese: 'Dicembre' }));
  verifica('05/01/2027, «quanto abbiamo raccolto a dicembre?»: dicembre 2026', dic.parametri.anno === 2026 && dic.parametri.mese === 'Dicembre', JSON.stringify(dic.parametri));
  verifica('e la scelta lo dice: l\'ultimo dicembre finito', /dicembre senza l'anno e' dicembre 2026, l'ultimo dicembre finito \(dicembre 2027 deve ancora venire\)/.test(dic.parametri[CHIAVE_SCELTA] || ''), dic.parametri[CHIAVE_SCELTA]);
  verifica('la guardia che mette gli ordini chiusi col mese della domanda li mette nel 2026',
    anno(GEN, 'quanti ordini ha fatto Emmesse a dicembre?', piano('richieste_ect')) === 2026);
  verifica('le secondarie chiuse verso Irigom a dicembre: 2026', anno(GEN, 'quante secondarie chiuse verso Irigom a dicembre?', piano('secondarie')) === 2026);
  const guida = scelto(GEN, 'Quanti ordini di rete sono stati chiusi a Cosenza da luglio a settembre?', piano('ordini_chiusi'));
  verifica('l\'esempio della Guida, «da luglio a settembre» chiesto il 05/01/2027: 2026', guida.parametri.anno === 2026 && (guida.parametri.mesi || []).join() === 'Luglio,Agosto,Settembre', JSON.stringify(guida.parametri));
  verifica('con piu\' mesi la scelta li dice tutti', /luglio, agosto e settembre senza l'anno sono quelli del 2026, gli ultimi finiti/.test(guida.parametri[CHIAVE_SCELTA] || ''), guida.parametri[CHIAVE_SCELTA]);
  verifica('10/02/2027, «quanto ci spetta da Ecotyre per dicembre?»: la fatturazione di dicembre 2026',
    anno('2027-02-10', 'quanto ci spetta da Ecotyre per dicembre?', piano('fatturazione', { tipo: 'ATTIVA' }, { mese: 'Dicembre' })) === 2026);
  verifica('le dichiarazioni di novembre chieste a gennaio: 2026', anno(GEN, 'che dichiarazioni ha fatto Gatim a novembre?', piano('dichiarazioni_impianti', { sito: 'Gatim' }, { mese: 'Novembre' })) === 2026);
  verifica('«a gennaio», chiesto a gennaio: il mese e\' cominciato, resta 2027', anno(GEN, 'quanto abbiamo raccolto a gennaio?', piano('raccolto', { mese: 'Gennaio' }, { mese: 'Gennaio' })) === 2027);
  verifica('15/10/2026, «quanto abbiamo raccolto a novembre?»: novembre 2025',
    anno('2026-10-15', 'quanto abbiamo raccolto a novembre?', piano('raccolto', { mese: 'Novembre' }, { mese: 'Novembre' })) === 2025);
  verifica('15/10/2026, ottobre e\' il mese in corso: 2026', anno('2026-10-15', 'quanto abbiamo raccolto a ottobre?', piano('raccolto', { mese: 'Ottobre' }, { mese: 'Ottobre' })) === 2026);
  const target = scelto('2026-10-15', 'che target abbiamo a novembre?', piano('contratto_ecotyre', { mese: 'Novembre' }, { mese: 'Novembre' }));
  verifica('«che target abbiamo a novembre?»: il contratto parla di mesi a venire, resta 2026', target.parametri.anno === 2026 && !target.parametri[CHIAVE_SCELTA], JSON.stringify(target.parametri));
  // La controprova: l'anno scritto vale.
  verifica('«dicembre 2027» scritto nella domanda resta 2027', anno(GEN, 'quanto abbiamo raccolto a dicembre 2027?', piano('raccolto', { mese: 'Dicembre' }, { mese: 'Dicembre' })) === 2027);
  verifica('un anno passato scritto dal piano vale com\'e\'', anno(GEN, 'quanto abbiamo raccolto a dicembre?', piano('raccolto', { mese: 'Dicembre', anno: 2025 }, { mese: 'Dicembre' })) === 2025
    && anno(GEN, 'quanto abbiamo raccolto a dicembre?', piano('raccolto', { mese: 'Dicembre' }, { mese: 'Dicembre', anno: 2025 })) === 2025);
  // Revisione del 15/10/2026: l'anno di OGGI scritto dal piano senza che la
  // domanda lo dica e' quello di abitudine (il pianificatore riempie il periodo):
  // per un mese che deve ancora venire vale la stessa regola.
  const abitP = scelto(GEN, 'quanto abbiamo raccolto a dicembre?', piano('raccolto', { mese: 'Dicembre', anno: 2027 }, { mese: 'Dicembre' }));
  const abitR = scelto(GEN, 'quanto abbiamo raccolto a dicembre?', piano('raccolto', {}, { mese: 'Dicembre', anno: 2027 }));
  verifica('l\'anno di oggi scritto dal piano per abitudine, nei parametri o nel periodo: dicembre 2026, e lo dice',
    abitP.parametri.anno === 2026 && abitR.parametri.anno === 2026 && /l'ultimo dicembre finito/.test(abitR.parametri[CHIAVE_SCELTA] || ''), JSON.stringify([abitP.parametri, abitR.parametri]));
  verifica('anche per gli ordini chiusi di Cosenza da luglio a settembre col periodo {anno 2027}',
    anno(GEN, 'Quanti ordini di rete sono stati chiusi a Cosenza da luglio a settembre?', piano('ordini_chiusi', {}, { mesi: ['Luglio', 'Agosto', 'Settembre'], anno: 2027 })) === 2026);
  verifica('«a gennaio» col periodo {anno 2027}: il mese e\' cominciato, resta 2027', anno(GEN, 'quanto abbiamo raccolto a gennaio?', piano('raccolto', {}, { mese: 'Gennaio', anno: 2027 })) === 2027);
  verifica('il target di novembre col periodo {anno 2026} il 15/10/2026 resta 2026', anno('2026-10-15', 'che target abbiamo a novembre?', piano('contratto_ecotyre', {}, { mese: 'Novembre', anno: 2026 })) === 2026);
  const questAnno = scelto(GEN, 'quanto abbiamo raccolto quest\'anno?', piano('raccolto'));
  verifica('«quest\'anno» il 05/01/2027: 2027, senza mese', questAnno.parametri.anno === 2027 && !questAnno.parametri.mese && !questAnno.parametri.mesi && !questAnno.parametri[CHIAVE_SCELTA], JSON.stringify(questAnno.parametri));
  verifica('«a dicembre di quest\'anno» resta 2027', anno(GEN, 'quanto raccoglieremo a dicembre di quest\'anno?', piano('raccolto', { mese: 'Dicembre' }, { mese: 'Dicembre' })) === 2027);
  // L'apostrofo del telefono vale come quello dritto (revisione del 15/10/2026).
  verifica('«a dicembre di quest’anno», con l\'apostrofo del telefono, resta 2027', anno(GEN, 'quanto raccoglieremo a dicembre di quest’anno?', piano('raccolto', { mese: 'Dicembre' }, { mese: 'Dicembre', anno: 2027 })) === 2027);
  const questAnnoT = scelto(GEN, 'quanto abbiamo raccolto quest’anno?', piano('raccolto', { mese: 'Gennaio' }, { mese: 'Gennaio' }));
  verifica('«quest’anno» con l\'apostrofo del telefono: l\'anno intero, senza il mese messo per abitudine', questAnnoT.parametri.anno === 2027 && !questAnnoT.parametri.mese, JSON.stringify(questAnnoT.parametri));
  // Le istruzioni del pianificatore dicono la stessa regola, con gli anni calcolati.
  const istr = istruzioniPiano(catalogo, 'quanto abbiamo raccolto a dicembre?', GEN);
  verifica('le istruzioni del pianificatore: un mese senza anno che deve ancora venire e\' dell\'anno scorso',
    /Un mese detto senza l'anno e' l'ultimo gia' cominciato: .* un mese che nel 2027 deve ancora venire \(dopo Gennaio\) e' del 2026/.test(istr));
  // Il blocco dei dati lo dice al modello che risponde.
  const blocco = testoDati([{ strumento: 'raccolto', parametri: { anno: 2026 }, fonte: 'f', periodo: 'Dicembre 2026', dati_al: GEN, scelta_dello_strumento: dic.parametri[CHIAVE_SCELTA], dati: {} }]);
  verifica('il blocco dei dati chiede di dire l\'anno nella risposta', /ANNO DEL MESE: .*«dicembre 2026, l'ultimo dicembre finito»/.test(blocco) && /L'anno viene dal mese della domanda/.test(blocco), blocco);

  // Lo strumento vero, col piano di sopra: tre ritiri di rete di dicembre 2026.
  const OraVera = Date;
  const ms = OraVera.parse('2027-01-05T09:00:00Z');
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  try {
    const ritiro = (i, g) => ({ id: 'r' + i, id_ordine: 'ET2699900' + i, numero_fir: 'FIR ' + i, stato: 'terminato', partner_operativo: 'SMOCO', trasportatore: 'EMMESSE SRLS', destinazione: 'GATIM SRL', provincia: 'NA', classe: 'PFU Autovettura',
      ordine_immesso_il: g + 'T07:00:00Z', trasporto_iniziato_il: g + 'T08:00:00Z', trasporto_finito_il: g + 'T10:00:00Z', ordine_chiuso_il: g + 'T12:00:00Z', peso_effettivo: 2000 });
    const archivi = { PrimariaRete: [ritiro(1, '2026-12-11'), ritiro(2, '2026-12-12'), ritiro(3, '2026-12-13')] };
    const uguale = (r, f) => Object.entries(f || {}).every(([k, v]) => (v === null ? r[k] == null || r[k] === '' : v && typeof v === 'object' ? true : r[k] === v));
    const sdk = { asServiceRole: { entities: new Proxy({}, { get: (_t, n) => ({
      filter: async (f, _o, lim = 5000, skip = 0) => (archivi[n] || []).filter(r => uguale(r, f)).slice(skip, skip + lim).map(r => ({ ...r })),
      list: async (_o, lim = 5000, skip = 0) => (archivi[n] || []).slice(skip, skip + lim).map(r => ({ ...r })),
    }) }) } };
    const r = await eseguiStrumento(sdk, dic.nome, dic.parametri, null);
    verifica('lo strumento risponde su dicembre 2026: 6,00 t e 3 formulari', r.dati && r.dati.tonnellate === 6 && r.dati.formulari === 3, JSON.stringify({ periodo: r.periodo, t: r.dati && r.dati.tonnellate, f: r.dati && r.dati.formulari, errore: r.errore }));
    verifica('e il periodo, che la chat mostra in «Dove ho guardato», dice l\'anno e il perche\'', /^Dicembre 2026 — anno 2026: dicembre senza l'anno e' dicembre 2026, l'ultimo dicembre finito/.test(r.periodo || ''), r.periodo);
  } finally {
    globalThis.Date = OraVera;
  }
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
