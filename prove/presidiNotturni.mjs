// Prova dei PRESIDI NELLA DASHBOARD (chiusura dell'audit, 11/10/2026).
//
// base44/shared/presidi.ts trasforma il battito dei lavori (EsecuzioneLavoro) e
// l'esito delle identita' fra moduli (invarianti_json della fotografia del giorno)
// in voci dell'elenco delle cose da gestire. La regola che conta di piu' e' la
// prima: NESSUNA VOCE SE NON C'E' NIENTE. Un avviso che grida a zero insegna a
// ignorare quelli veri. Poi: un giro mancato non basta, si conta nell'unita'
// dell'orario del lavoro (ore, giorni, giorni lavorativi, il giro del mese), una
// causa fa una voce sola, e un'identita' rotta si dice coi due numeri e i due
// moduli. La revisione delle migliorie (11/10/2026) ha aggiunto che il primo giro
// fallito di un lavoro mai riuscito conta fra i mancati, e che un'identita' rotta
// e non riverificata resta, detta per quello che e' (anche quando a non
// riverificarla e' un controllo rifatto lo stesso giorno: con la sua ora).
// npm run prove
import { vociPresidi, statoLavoro } from '../base44/shared/presidi.ts';
import { lavoroDi } from '../base44/shared/battito.ts';
import { verificaInvarianti } from '../base44/shared/invarianti.ts';
import { leggiFotografia } from '../base44/shared/indicatoriGiorno.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);

// Lunedi' 12/10/2026 alle 10 italiane.
const ADESSO = Date.parse('2026-10-12T08:00:00Z');
const OGGI = '2026-10-12';
const riga = (lavoro, { partenza, riuscita = null, esito = 'riuscito', errore = '', fallimenti = 0, creata = '2026-09-01T00:00:00.000' }) => ({
  id: 'e-' + lavoro, lavoro, ultima_partenza: partenza, ultima_riuscita: riuscita, ultimo_esito: esito, errore, fallimenti_di_fila: fallimenti, created_date: creata,
});
const presidi = (esecuzioni, indicatore = null, adessoMs = ADESSO) => vociPresidi({ esecuzioni, indicatore, oggi: OGGI, adessoMs });
const conChiave = (voci, chiave) => voci.filter(v => v.chiave === chiave);

console.log('NIENTE DA DIRE, NESSUNA VOCE');
verifica('senza niente', J(vociPresidi()) === '[]' && J(presidi([])) === '[]');
verifica('senza righe del battito (il giorno della pubblicazione) e senza identita\'', J(presidi([], { giorno: OGGI })) === '[]');
{
  // Tutti appena riusciti.
  const tutti = ['alleggerisciDocumenti', 'riepilogoDichiarazioni', 'controllaInvarianti', 'presidioQualifica', 'controlloQualifiche', 'checkTargetAlerts',
    'aggiornaCorsoRT', 'elaboraMaterialeCorso', 'analisiSettimanalePredittiva', 'controlloNormativo', 'runAlertEngine']
    .map(l => riga(l, { partenza: '2026-10-12T07:50:00.000Z', riuscita: '2026-10-12T07:50:00.000Z' }));
  verifica('tutti i lavori appena riusciti: nessuna voce', J(presidi(tutti)) === '[]', J(presidi(tutti)));
}

console.log('UN GIRO MANCATO NON BASTA, DUE SI\'');
{
  // L'alleggerimento delle 3:15: riuscito ieri, fallito stanotte.
  const uno = riga('alleggerisciDocumenti', { partenza: '2026-10-12T01:15:02.000Z', riuscita: '2026-10-11T01:15:02.000Z', esito: 'fallito', errore: 'Rate limit exceeded', fallimenti: 1 });
  verifica('fallito una notte: ancora niente', J(presidi([uno])) === '[]', J(presidi([uno])));
  const due = riga('alleggerisciDocumenti', { partenza: '2026-10-12T01:15:02.000Z', riuscita: '2026-10-10T01:15:02.000Z', esito: 'fallito', errore: 'Rate limit exceeded', fallimenti: 2 });
  const v = presidi([due]);
  verifica('fallito due notti: una voce', v.length === 1, J(v));
  const x = v[0] || {};
  verifica('il titolo dice chi e da quanto', x.titolo === "L'alleggerimento dei documenti dei fornitori non riesce da 2 giorni", x.titolo);
  verifica('il dettaglio dice l\'ultimo errore, quando, quante volte, l\'ultima riuscita e che cosa non succede',
    x.dettaglio === "Ultimo tentativo il 12/10/2026 alle 03:15 (2 di fila): Rate limit exceeded. L'ultima volta che è riuscito: il 10/10/2026 alle 03:15. Finché non riparte, i documenti dei fornitori non si alleggeriscono.", x.dettaglio);
  verifica('nel formato delle voci del cruscotto', x.area === 'Manutenzione' && x.gravita === 'attenzione' && x.link === '/verifiche-fornitori' && x.chiave === 'lavoro:alleggerisciDocumenti', J(x));
  // Prima delle 4:45 il giro delle 3:15 di oggi non si giudica ancora (margine).
  const presto = presidi([riga('alleggerisciDocumenti', { partenza: '2026-10-11T01:15:02.000Z', riuscita: '2026-10-11T01:15:02.000Z' })], null, Date.parse('2026-10-12T02:00:00Z'));
  verifica('un lavoro delle 3:15 non si giudica alle 4', J(presto) === '[]', J(presto));
}

console.log('L\'UNITA\' DEL SUO ORARIO');
{
  // Il controllo delle qualifiche, feriali alle 7:30: riuscito giovedi' 8, fallito venerdi' 9 e lunedi' 12.
  const q = riga('controlloQualifiche', { partenza: '2026-10-12T05:30:01.000Z', riuscita: '2026-10-08T05:30:01.000Z', esito: 'fallito', errore: 'Rate limit exceeded', fallimenti: 2 });
  const v = presidi([q]);
  verifica('feriali: due giorni lavorativi, non quattro giorni', v.length === 1 && v[0].titolo === 'Il controllo delle qualifiche non riesce da 2 giorni lavorativi', J(v));
  // Il corso RT, ogni ora: tre ore no, sette si'.
  const tre = presidi([riga('aggiornaCorsoRT', { partenza: '2026-10-12T06:55:00.000Z', riuscita: '2026-10-12T04:55:00.000Z', esito: 'fallito', errore: 'timeout', fallimenti: 2 })]);
  verifica('ogni ora: due giri mancati sono pochi', J(tre) === '[]', J(tre));
  const sette = presidi([riga('aggiornaCorsoRT', { partenza: '2026-10-12T06:55:00.000Z', riuscita: '2026-10-12T00:55:00.000Z', esito: 'fallito', errore: 'timeout', fallimenti: 6 })]);
  verifica('ogni ora: da 7 ore si dice', sette.length === 1 && sette[0].titolo === "L'aggiornamento del corso RT non riesce da 7 ore", J(sette));
  // Il controllo normativo del 1° del mese: basta un giro, e si dice quale.
  const mese = presidi([riga('controlloNormativo', { partenza: '2026-11-01T06:00:03.000Z', riuscita: '2026-10-01T05:00:03.000Z', esito: 'fallito', errore: 'Il modello non ha risposto', fallimenti: 1 })], null, Date.parse('2026-11-01T08:00:00Z'));
  verifica('il mese: un giro solo, e si dice quale', mese.length === 1 && mese[0].titolo === 'Il controllo normativo del mese non riesce dal giro del 01/11/2026'
    && mese[0].dettaglio.startsWith('Ultimo tentativo il 01/11/2026 alle 07:00: Il modello non ha risposto.'), J(mese));
}

console.log('RIUSCITO, MA VECCHIO: LE TRE RAGIONI');
{
  const g = presidi([riga('riepilogoDichiarazioni', { partenza: '2026-10-09T03:00:04.000Z', riuscita: '2026-10-09T03:00:04.000Z' })]);
  verifica('il guardiano fermo da tre notti senza errore', g.length === 1 && g[0].titolo === 'Il guardiano notturno non riesce da 3 giorni', J(g));
  verifica('dice le tre ragioni possibili, non ne sceglie una', g.length === 1 && /non parte, si interrompe prima di finire, oppure è rinviato per un caricamento a metà/.test(g[0].dettaglio)
    && g[0].dettaglio.includes('il 09/10/2026 alle 05:00') && !/Ultimo tentativo/.test(g[0].dettaglio), g[0] && g[0].dettaglio);
  const mai = presidi([riga('presidioQualifica', { partenza: '2026-10-12T04:40:00.000Z', riuscita: null, esito: 'fallito', errore: 'documento illeggibile', fallimenti: 9, creata: '2026-10-01T04:40:00.000' })]);
  verifica('mai riuscito: si conta da quando la riga esiste, e si dice', mai.length === 1 && /Da quando lascia traccia non è mai riuscito/.test(mai[0].dettaglio), J(mai));
}

console.log('IL PRIMO GIRO FALLITO CONTA');
{
  // Revisione delle migliorie (11/10/2026). La riga del battito nasce alla fine
  // del primo giro: se quel giro fallisce, e' gia' un giro mancato. Si contava
  // dalla nascita della riga escludendolo, e il controllo normativo che fallisce
  // al primo giro col battito (il 01/11/2026) taceva un mese, il programma del
  // mercoledi' una settimana, i lavori di ogni notte volevano tre notti fallite.
  // prima_partenza la scrive registraBattito quando crea la riga (battito.ts).
  const primo = (lavoro, { partenza, prima, errore = 'Rate limit exceeded', fallimenti = 1, creata }) => ({
    id: 'e-' + lavoro, lavoro, ultima_partenza: partenza, prima_partenza: prima, ultimo_esito: 'fallito', errore, fallimenti_di_fila: fallimenti, created_date: creata,
  });
  const normativo = primo('controlloNormativo', { partenza: '2026-11-01T06:00:01.000Z', prima: '2026-11-01T06:00:01.000Z', errore: 'Il modello non ha risposto', creata: '2026-11-01T06:02:30.000000' });
  const n1 = presidi([normativo], null, Date.parse('2026-11-01T09:00:00Z'));
  verifica('il controllo normativo fallito al primo giro col battito: la voce la mattina stessa', n1.length === 1 && n1[0].titolo === 'Il controllo normativo del mese non riesce dal giro del 01/11/2026'
    && n1[0].dettaglio === "Ultimo tentativo il 01/11/2026 alle 07:00: Il modello non ha risposto. Da quando lascia traccia non è mai riuscito. Finché non riparte, le novità normative del mese non diventano proposte.", J(n1));
  verifica('e resta per tutto il mese', presidi([normativo], null, Date.parse('2026-11-20T09:00:00Z')).length === 1 && presidi([normativo], null, Date.parse('2026-11-30T20:00:00Z')).length === 1);
  verifica('ma non prima del margine: alle 8 del 01/11 ancora niente', J(presidi([normativo], null, Date.parse('2026-11-01T07:00:00Z'))) === '[]');
  // Il programma del mercoledi': fallito alle 8 e alle 14 del 14/10, primo giro col battito.
  const merc = primo('analisiSettimanalePredittiva', { partenza: '2026-10-14T12:00:01.000Z', prima: '2026-10-14T06:00:01.000Z', fallimenti: 2, creata: '2026-10-14T06:01:10.000000' });
  const m = presidi([merc], null, Date.parse('2026-10-15T09:00:00Z'));
  verifica('il programma del mercoledi\' fallito alle 8 e alle 14: la voce il giovedi\'', m.length === 1 && m[0].titolo === 'Il programma del mercoledì delle secondarie non riesce dal giro del 14/10/2026', J(m));
  const merc8 = primo('analisiSettimanalePredittiva', { partenza: '2026-10-14T06:00:01.000Z', prima: '2026-10-14T06:00:01.000Z', creata: '2026-10-14T06:01:10.000000' });
  verifica('fallito solo alle 8 (e alle 14 non ancora giudicato): niente', J(presidi([merc8], null, Date.parse('2026-10-14T11:00:00Z'))) === '[]');
  // L'alleggerimento delle 3:15, prima riga il 12/10.
  const all1 = primo('alleggerisciDocumenti', { partenza: '2026-10-12T01:15:01.000Z', prima: '2026-10-12T01:15:01.000Z', creata: '2026-10-12T01:15:40.000000' });
  verifica('una notte sola fallita, la prima: ancora niente (un giro mancato non basta)', J(presidi([all1])) === '[]', J(presidi([all1])));
  const all2 = { ...all1, ultima_partenza: '2026-10-13T01:15:01.000Z', fallimenti_di_fila: 2 };
  const a2 = presidi([all2], null, Date.parse('2026-10-13T09:00:00Z'));
  verifica('due notti fallite, la prima compresa: la voce, «da 2 giorni» come per chi era riuscito prima', a2.length === 1 && a2[0].titolo === "L'alleggerimento dei documenti dei fornitori non riesce da 2 giorni", J(a2));
  // Il corso RT ogni ora: sei giri falliti dal primo, la voce; cinque no.
  const corso = (n) => primo('aggiornaCorsoRT', { partenza: new Date(Date.parse('2026-10-12T00:55:02.000Z') + (n - 1) * 3600000).toISOString(), prima: '2026-10-12T00:55:02.000Z', errore: 'timeout', fallimenti: n, creata: '2026-10-12T00:56:00.000000' });
  verifica('ogni ora, mai riuscito: cinque giri falliti sono pochi', J(presidi([corso(5)], null, Date.parse('2026-10-12T05:30:00Z'))) === '[]', J(presidi([corso(5)], null, Date.parse('2026-10-12T05:30:00Z'))));
  const sei = presidi([corso(6)], null, Date.parse('2026-10-12T06:30:00Z'));
  verifica('sei si\', «da 6 ore»', sei.length === 1 && sei[0].titolo === "L'aggiornamento del corso RT non riesce da 6 ore", J(sei));
  // Una riga senza prima_partenza (nata prima di questo campo) si arrangia con la
  // sua nascita, che e' la fine di quel giro: il primo giro conta lo stesso.
  const { prima_partenza: _, ...senza } = normativo;
  verifica('senza prima_partenza: si conta dalla nascita della riga, e il primo giro conta lo stesso', presidi([senza], null, Date.parse('2026-11-01T09:00:00Z')).length === 1);
  // Chi e' riuscito almeno una volta si conta dall'ultima riuscita, come prima: il
  // giro riuscito non e' un mancato.
  const riuscitoIeri = riga('alleggerisciDocumenti', { partenza: '2026-10-12T01:15:02.000Z', riuscita: '2026-10-11T01:15:02.000Z', esito: 'fallito', fallimenti: 1 });
  verifica('riuscito ieri, fallito stanotte: niente, come prima', J(presidi([{ ...riuscitoIeri, prima_partenza: '2026-10-01T01:15:02.000Z' }])) === '[]');
  // Il controllo delle identita' fallito alle due notti dalla prima, col guardiano
  // che riesce: la voce e' sua.
  const guardiano = riga('riepilogoDichiarazioni', { partenza: '2026-10-13T03:00:04.000Z', riuscita: '2026-10-13T03:00:04.000Z' });
  const inv = primo('controllaInvarianti', { partenza: '2026-10-13T03:00:40.000Z', prima: '2026-10-12T03:00:40.000Z', errore: 'le Giacenze non hanno risposto: timeout (la giacenza nei due moduli, il raccolto di rete)', fallimenti: 2, creata: '2026-10-12T03:01:10.000000' });
  const ci = presidi([guardiano, inv], null, Date.parse('2026-10-13T08:00:00Z'));
  verifica('il controllo delle identita\', due notti fallite dalla prima: la voce, del controllo', ci.length === 1 && ci[0].chiave === 'lavoro:controllaInvarianti' && ci[0].titolo === 'Il controllo delle identità fra moduli non riesce da 2 giorni', J(ci));
}

console.log('UNA CAUSA, UNA VOCE');
{
  const guardiano = riga('riepilogoDichiarazioni', { partenza: '2026-10-12T03:00:04.000Z', riuscita: '2026-10-09T03:00:04.000Z', esito: 'fallito', errore: 'Input should be a valid dictionary', fallimenti: 3 });
  const identita = riga('controllaInvarianti', { partenza: '2026-10-09T03:00:40.000Z', riuscita: '2026-10-09T03:00:40.000Z' });
  const v = presidi([guardiano, identita]);
  verifica('il guardiano non riesce: la voce e\' sua, non del passo dopo che non ha avuto occasione', v.length === 1 && v[0].chiave === 'lavoro:riepilogoDichiarazioni', J(v.map(x => x.titolo)));
  const guardianoBene = riga('riepilogoDichiarazioni', { partenza: '2026-10-12T03:00:04.000Z', riuscita: '2026-10-12T03:00:04.000Z' });
  const identitaMale = riga('controllaInvarianti', { partenza: '2026-10-12T03:00:40.000Z', riuscita: '2026-10-09T03:00:40.000Z', esito: 'fallito', errore: 'le Giacenze non hanno risposto: timeout (la giacenza nei due moduli, il raccolto di rete)', fallimenti: 3 });
  const w = presidi([guardianoBene, identitaMale]);
  verifica('il guardiano riesce e il controllo delle identita\' no: la voce e\' del controllo', w.length === 1 && w[0].titolo === 'Il controllo delle identità fra moduli non riesce da 3 giorni' && w[0].dettaglio.includes('le Giacenze non hanno risposto: timeout (la giacenza nei due moduli, il raccolto di rete)'), J(w));
}

console.log('IL MOTORE DEGLI ALERT PARTE A EVENTO');
{
  const male = presidi([riga('runAlertEngine', { partenza: '2026-10-12T07:00:00.000Z', riuscita: '2026-10-10T07:00:00.000Z', esito: 'fallito', errore: 'Rate limit exceeded', fallimenti: 1 })]);
  verifica('l\'ultimo giro fallito si dice', male.length === 1 && male[0].titolo === "Il motore degli alert non è riuscito all'ultimo giro" && /Rate limit exceeded/.test(male[0].dettaglio), J(male));
  const fermo = presidi([riga('runAlertEngine', { partenza: '2026-09-01T07:00:00.000Z', riuscita: '2026-09-01T07:00:00.000Z' })]);
  verifica('un mese senza caricamenti non e\' un guasto: niente', J(fermo) === '[]', J(fermo));
  verifica('lo stato di un lavoro senza riga e\' null: non si giudica', statoLavoro(lavoroDi('alleggerisciDocumenti'), null, ADESSO) === null);
}

console.log('LE IDENTITA\' FRA MODULI');
{
  // Il caso del 10/10/2026: lo stoccaggio GATIM, ACI.
  const G = { righe: [{ sito: 'GATIM SRL', tipo_destinazione: 'stoc', giacenza_rete_t: 10, giacenza_aci_t: 275.08, giacenza_extra_t: null }] };
  const D = { siti: [], stoccaggi: [{ chiave: 'gatim', sito: 'GATIM SRL', canali: [{ canale: 'RETE', in_piazzale_t: 10 }, { canale: 'ACI', in_piazzale_t: 154.22 }] }], doppioni: [] };
  const esito = verificaInvarianti({ giacenze: G, dichiarazioni: D }, { giorno: '2026-10-11', anno: 2026, voci: undefined });
  const indicatore = { giorno: '2026-10-11', invarianti_json: JSON.stringify(esito) };
  const v = presidi([], indicatore);
  const x = conChiave(v, 'invariante:giacenze_uguali')[0];
  verifica('un\'identita\' rotta: una voce coi due numeri e i due moduli', x && x.titolo === "Un'identità fra moduli si è rotta: Giacenze 275,08 t, Dichiarazioni 154,22 t", J(v));
  verifica('rossa, nell\'area del modulo, col caso e il giorno', x && x.gravita === 'critico' && x.area === 'Giacenze' && x.link === '/giacenze'
    && x.dettaglio.includes('GATIM SRL (piazzale), ACI: 275,08 t nelle Giacenze, 154,22 t nelle Dichiarazioni') && x.dettaglio.endsWith('Controllo del 11/10/2026.'), x && x.dettaglio);
  // Le voci che non si sono potute verificare (manca la dashboard) non sono rotte.
  verifica('una voce non verificata non fa una voce rossa', v.length === 1 && !v.some(y => y.chiave === 'invariante:raccolto_rete'), J(v.map(y => y.chiave)));
  // Letta con leggiFotografia, come la passa il cruscotto.
  const letta = leggiFotografia({ giorno: '2026-10-11', invarianti_json: JSON.stringify(esito) });
  verifica('la stessa voce dalla riga letta con leggiFotografia', J(presidi([], letta)) === J(v));
  verifica('una riga senza identita\' non dice niente', J(presidi([], leggiFotografia({ giorno: '2026-10-11' }))) === '[]');

  const pulito = verificaInvarianti({ giacenze: { righe: [], totali: { conferito_t: 8818.55 } }, dichiarazioni: { siti: [], stoccaggi: [], doppioni: [], totali: { conferito_t: 8818.55 } }, dashboard: { kpi: { raccolto_rete_anno: 8818.549999 } } }, { giorno: '2026-10-11' });
  verifica('tutte in linea: nessuna voce', pulito.esito === 'in_linea' && J(presidi([], { giorno: '2026-10-11', invarianti_json: JSON.stringify(pulito) })) === '[]', J(pulito.voci.map(y => [y.id, y.ok])));
  const doppio = verificaInvarianti({ dichiarazioni: { siti: [], stoccaggi: [], doppioni: [{ sito: 'ALFA SRL', canale: 'RETE', mese: 'Marzo', quante: 2, kg_in_piu: 1000 }] } }, { giorno: '2026-10-11', voci: undefined });
  verifica('un doppione: rotto, ma la dashboard lo dice gia\' con la sua voce', doppio.voci.find(y => y.id === 'nessun_doppione').ok === false
    && J(presidi([], { giorno: '2026-10-11', invarianti_json: JSON.stringify(doppio) })) === '[]');
  verifica('un JSON rotto non rompe niente', J(presidi([], { giorno: '2026-10-11', invarianti_json: '{rotto' })) === '[]');

  // Revisione delle migliorie (11/10/2026): una rotta all'ultima verifica e non
  // riverificata stanotte (riportaRotte, invarianti.ts) resta, e lo dice.
  const riportata = { giorno: '2026-10-12', anno: 2026, esito: 'rotte', voci: [{
    id: 'giacenze_uguali', frase: 'Ogni impianto e ogni piazzale ha la stessa giacenza nelle Giacenze e nelle Dichiarazioni, canale per canale',
    moduli: ['Giacenze', 'Dichiarazioni'], area: 'Giacenze', link: '/giacenze', verificata: false, ok: null,
    motivo: 'le Giacenze non hanno risposto: timeout', rotta_il: '2026-10-11', a: 275.08, b: 154.22,
    dettaglio: 'GATIM SRL (piazzale), ACI: 275,08 t nelle Giacenze, 154,22 t nelle Dichiarazioni' }] };
  const r = presidi([], { giorno: '2026-10-12', invarianti_json: JSON.stringify(riportata) });
  verifica('rotta e non riverificata stanotte: resta rossa, coi numeri dell\'ultima verifica', r.length === 1 && r[0].gravita === 'critico'
    && r[0].titolo === "Un'identità fra moduli si è rotta: Giacenze 275,08 t, Dichiarazioni 154,22 t (non riverificata stanotte)", J(r));
  verifica('e dice quando era rotta, perche\' non si e\' riverificata e fino a quando resta', r.length === 1
    && r[0].dettaglio.endsWith('Rotta al controllo del 11/10/2026; stanotte non si è potuta riverificare (le Giacenze non hanno risposto: timeout): resta finché una verifica non la trova a posto.'), r[0] && r[0].dettaglio);
  // Letta il giorno dopo, se la fotografia di oggi non c'e' ancora: il giorno, non «stanotte».
  const dopo = vociPresidi({ indicatore: { giorno: '2026-10-12', invarianti_json: JSON.stringify(riportata) }, oggi: '2026-10-13', adessoMs: Date.parse('2026-10-13T08:00:00Z') });
  verifica('letta il giorno dopo: «non riverificata il 12/10/2026»', dopo.length === 1 && / \(non riverificata il 12\/10\/2026\)$/.test(dopo[0].titolo), J(dopo));
  // Non verificata e mai rotta: nessuna voce rossa (lo dice il battito del controllo).
  const mai = { ...riportata, esito: 'non_verificate', voci: [{ ...riportata.voci[0], rotta_il: undefined, a: undefined, b: undefined, dettaglio: undefined }] };
  verifica('non verificata e senza una rotta da riportare: niente', J(presidi([], { giorno: '2026-10-12', invarianti_json: JSON.stringify(mai) })) === '[]');

  // Revisione delle migliorie (11/10/2026), il controllo rifatto lo stesso
  // giorno: rotta alle 5, rilanciato alle 11 con una fonte muta (riportaRotte la
  // tiene). Non e' «stanotte» che non si e' potuta riverificare: e' l'ora del
  // controllo rifatto, l'istante dell'esito.
  const rifatto = { ...riportata, il: '2026-10-12T09:00:00.000Z', voci: [{ ...riportata.voci[0], rotta_il: '2026-10-12' }] };
  const s = presidi([], { giorno: '2026-10-12', invarianti_json: JSON.stringify(rifatto) });
  verifica('rotta alle 5 e non riverificata dal controllo rifatto alle 11: rossa, «non riverificata oggi alle 11:00»', s.length === 1 && s[0].gravita === 'critico'
    && s[0].titolo === "Un'identità fra moduli si è rotta: Giacenze 275,08 t, Dichiarazioni 154,22 t (non riverificata oggi alle 11:00)", J(s));
  verifica('e il dettaglio lo dice cosi\', non «stanotte»', s.length === 1
    && s[0].dettaglio.endsWith('Rotta al controllo del 12/10/2026; oggi alle 11:00 non si è potuta riverificare (le Giacenze non hanno risposto: timeout): resta finché una verifica non la trova a posto.') && !/stanotte/.test(s[0].titolo + s[0].dettaglio), s[0] && s[0].dettaglio);
  const s13 = vociPresidi({ indicatore: { giorno: '2026-10-12', invarianti_json: JSON.stringify(rifatto) }, oggi: '2026-10-13', adessoMs: Date.parse('2026-10-13T08:00:00Z') });
  verifica('letta il giorno dopo: «non riverificata il 12/10/2026 alle 11:00»', s13.length === 1 && / \(non riverificata il 12\/10\/2026 alle 11:00\)$/.test(s13[0].titolo), J(s13));
  verifica('rotta un giorno prima: resta «stanotte», anche con l\'istante', / \(non riverificata stanotte\)$/.test((presidi([], { giorno: '2026-10-12', invarianti_json: JSON.stringify({ ...riportata, il: '2026-10-12T03:00:40.000Z' }) })[0] || {}).titolo || ''));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
