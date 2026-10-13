// IL SURPLUS SULLE TARIFFE NEI CONSUNTIVI DEI FORNITORI (13/10/2026).
//
// Da ottobre 2026 i raccoglitori fatturano anche il Fuel Surcharge del consorzio
// Ecotyre, +5 €/t sulle stesse tonnellate del mese, come riga a parte nella
// stessa fattura e nello stesso consuntivo. Il confronto deve tornare:
// 1. il costo previsto (costoAttesoDallaPassiva) e' standard + surplus, con le due
//    parti e le righe del surplus; le tonnellate restano quelle standard;
// 2. un consuntivo che non porta il surplus non e' verde, e il testo dice «non
//    porta il Fuel Surcharge: x €» invece di uno scarto qualunque; uno che lo
//    porta torna verde; uno che lo mette in un mese in cui non vale (o su tutto il
//    mese quando vale da un certo giorno) lo dice al contrario; uno confrontato col
//    conto congelato prima che il surplus fosse scritto dice che il surplus e'
//    arrivato dopo, e quando;
// 3. la riga «Fuel Surcharge» del file non e' un carico e non si conta fra le
//    righe illeggibili;
// 4. la funzione elaboraConsuntivo, sul banco con l'SDK finto, legge
//    SurplusTariffa e risponde cosi';
// 5. «scritto dopo il congelamento» si dice solo di un surplus scritto o
//    cambiato dopo: quello che c'era gia' e cresce per un carico arrivato in
//    ritardo non lo e' (revisione del 13/10/2026).
//
// node prove/consuntivoSurplus.mjs
import { calcolaPassivaMese } from '../base44/shared/passivaCalcolo.ts';
// Col nome del modulo e non per nome: col codice di prima le due funzioni nuove
// mancano, e la prova deve fallire nelle sue sezioni, non fermarsi all'import.
import * as C from '../base44/shared/consuntivoFornitore.ts';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
// Una sezione che si ferma con un errore (il codice di prima non ha le funzioni
// o i campi del surplus) conta come fallita e si va avanti.
const { costoAttesoDallaPassiva, esitoConsuntivo, testoEsitoConsuntivo, leggiRigheConsuntivo, confrontaConsuntivo, movimentiDelFornitore } = C;
const surplusPerIlConfronto = (...a) => C.surplusPerIlConfronto(...a);
const surplusScrittiDopo = (...a) => C.surplusScrittiDopo(...a);
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${e && e.message})`); }
};

const FORNITORI = [
  { id: 'f-gt', ragione_sociale: 'GREEN TYRE PROJECT SRL', stato: 'attivo' },
  { id: 'f-to', ragione_sociale: 'TORRES GIOVANNI', fattura_tramite_nome: 'GREEN TYRE PROJECT SRL', stato: 'attivo' },
  { id: 'f-ga', ragione_sociale: 'GATIM S.R.L.', stato: 'attivo' },
];
const TARIFFE = [
  { id: 't-gt', direzione: 'PASSIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', fornitore_nome: 'GREEN TYRE PROJECT SRL', unita_misura: '€/t', valore: 90, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' },
  { id: 't-ga', direzione: 'PASSIVA', prestazione: 'TRATTAMENTO', tipologia: 'RETE', fornitore_nome: 'GATIM S.R.L.', unita_misura: '€/t', valore: 95, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' },
];
const primaria = (n, trasportatore, kg, giorno, mese = '09') => ({
  id: 'p' + n, stato: 'terminato', id_ordine: 'ET2609000' + n, numero_fir: `RGYTR00000${n}AA`, trasportatore, provincia: 'NA', regione: 'Campania',
  destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp', classe: 'P', peso_effettivo: kg, automezzo: 'AB12' + n,
  ordine_immesso_il: `2026-${mese}-01T08:00:00.000Z`, trasporto_iniziato_il: `2026-${mese}-${giorno}T08:00:00.000Z`, trasporto_finito_il: `2026-${mese}-${giorno}T08:00:00.000Z`,
});
// Settembre: il Fuel Surcharge comincia il 15. Il primo carico e' prima, gli
// altri due dopo (il terzo e' del subraccoglitore, che fattura tramite GREEN TYRE).
const PRIMARIE = [primaria(1, 'GREEN TYRE PROJECT SRL', 10000, '10'), primaria(2, 'GREEN TYRE PROJECT SRL', 5000, '20'), primaria(3, 'TORRES GIOVANNI', 3003, '25')];
const FS = { id: 'fs-rete', gruppo: 'fs', nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia: 'RETE', prestazione: 'RACCOLTA', a_chi: 'tutti', euro_t_passiva: 5, euro_t_attiva: 5,
  data_inizio_validita: '2026-09-15', data_fine_validita: '2026-12-31', stato: 'attivo', created_date: '2026-10-13T08:00:00.000Z' };
const archivi = (x = {}) => ({ primarieRete: PRIMARIE, primarieAci: [], secondarieAll: [], extraRaccoltaAll: [], tariffeAll: TARIFFE, fornitoriAll: FORNITORI, ...x });
const conSurplus = calcolaPassivaMese(archivi({ surplusAll: [FS] }), 2026, 8, 'settembre', 'RETE');
const senzaSurplus = calcolaPassivaMese(archivi(), 2026, 8, 'settembre', 'RETE');
const movimenti = movimentiDelFornitore({ primarieRete: PRIMARIE, primarieAci: [], secondarie: [], extraRaccolta: [] }, { fornitore: 'GREEN TYRE PROJECT SRL', ruolo: 'raccoglitore', anno: 2026, mese: 9, canale: 'RETE', fornitori: FORNITORI });
const confronto = confrontaConsuntivo(PRIMARIE.map(p => ({ numero_fir: p.numero_fir, kg: p.peso_effettivo })), movimenti, { canale: 'RETE', anno: 2026, mese: 9 });

await sezione('1. IL COSTO PREVISTO: STANDARD PIU\' SURPLUS, SULLE STESSE TONNELLATE', async () => {
  const c = costoAttesoDallaPassiva(conSurplus, 'Green Tyre Project S.r.l.', 'raccoglitore');
  verifica('importo 1.660,29 = standard 1.620,27 + surplus 40,02', c.trovato && c.importo === 1660.29 && c.importo_standard === 1620.27 && c.importo_surplus === 40.02, J(c));
  verifica('le tonnellate restano quelle standard (18,003)', Math.round(c.tonnellate * 1000) === 18003, String(c.tonnellate));
  verifica('e porta la riga del surplus', c.surplus.length === 1 && c.surplus[0].nome === 'Fuel Surcharge' && c.surplus[0].tonnellate === 8.003 && c.surplus[0].importo === 40.02, J(c.surplus));
  const vecchio = costoAttesoDallaPassiva({ raccoglitori: [{ fornitore: 'GREEN TYRE PROJECT SRL', totale_tonnellate: 18.003, totale_euro: 1620.27, righe: [] }] }, 'GREEN TYRE PROJECT SRL', 'raccoglitore');
  verifica('un conto congelato prima del surplus: lo standard e\' l\'importo intero, surplus zero', vecchio.importo_standard === 1620.27 && vecchio.importo_surplus === 0 && vecchio.surplus.length === 0, J(vecchio));
  verifica('il confronto delle quantita\' torna', confronto.quadra === true, J(confronto).slice(0, 300));
});

await sezione('2. IL VERDETTO E LA FRASE', async () => {
  const c = costoAttesoDallaPassiva(conSurplus, 'GREEN TYRE PROJECT SRL', 'raccoglitore');
  const manca = esitoConsuntivo({ confronto, costo: c, importo_consuntivo: 1620.27 });
  const testo = testoEsitoConsuntivo(confronto, manca);
  verifica('senza il surplus il consuntivo non e\' verde', manca.quadra_importo === false && manca.quadra_tutto === false, J(manca));
  verifica('e lo scarto e\' riconosciuto come il surplus che manca', manca.scarto_surplus && manca.scarto_surplus.tipo === 'manca' && manca.scarto_surplus.importo === 40.02, J(manca.scarto_surplus));
  verifica('la frase lo dice col suo nome, all\'italiana', testo.includes('Il consuntivo non porta il Fuel Surcharge: 40,02 € (8,003 t a 5,00 €/t, dal 15/09/2026 al 31/12/2026). Il resto torna al centesimo.') && !/si scosta/.test(testo), testo);
  verifica('il previsto si scompone', manca.importo_previsto === 1660.29 && manca.importo_previsto_standard === 1620.27 && manca.importo_previsto_surplus === 40.02, J(manca));

  const porta = esitoConsuntivo({ confronto, costo: c, importo_consuntivo: 1660.29 });
  verifica('con il surplus torna verde', porta.quadra_importo === true && porta.quadra_tutto === true && porta.scarto_surplus === null, J(porta));

  const storto = esitoConsuntivo({ confronto, costo: c, importo_consuntivo: 1700 });
  verifica('uno scarto che non e\' un surplus resta uno scarto, ma all\'italiana', storto.scarto_surplus === null && testoEsitoConsuntivo(confronto, storto).includes('si scosta di +39,71 euro'), testoEsitoConsuntivo(confronto, storto));

  // Il fornitore mette il Fuel Surcharge su tutto settembre, ma vale dal 15.
  const candidati = surplusPerIlConfronto([FS], { fornitore: 'GREEN TYRE PROJECT SRL', ruolo: 'raccoglitore', canale: 'RETE' });
  const tutto = esitoConsuntivo({ confronto, costo: c, importo_consuntivo: 1620.27 + 90.02, surplus_candidati: candidati });
  verifica('su tutto il mese quando vale dal 15: «in parte», 50,00 € in piu\'', tutto.scarto_surplus && tutto.scarto_surplus.tipo === 'non_dovuto' && tutto.scarto_surplus.in_parte === true && tutto.scarto_surplus.importo === 50, J(tutto.scarto_surplus));
  verifica('e la frase dice dove non vale', /più alto di 50,00 €: il fornitore ha messo il Fuel Surcharge \(5,00 €\/t\) su tutte le 18,003 t del mese, ma vale dal 15\/09\/2026 al 31\/12\/2026/.test(testoEsitoConsuntivo(confronto, tutto)), testoEsitoConsuntivo(confronto, tutto));

  // Agosto: il surplus non vale per niente.
  const agosto = PRIMARIE.map(p => ({ ...p, trasporto_finito_il: p.trasporto_finito_il.replace('2026-09-', '2026-08-'), trasporto_iniziato_il: p.trasporto_iniziato_il.replace('2026-09-', '2026-08-') }));
  const pAgo = calcolaPassivaMese(archivi({ primarieRete: agosto, surplusAll: [FS] }), 2026, 7, 'agosto', 'RETE');
  const cAgo = costoAttesoDallaPassiva(pAgo, 'GREEN TYRE PROJECT SRL', 'raccoglitore');
  const fuori = esitoConsuntivo({ confronto, costo: cAgo, importo_consuntivo: 1620.27 + 90.02, surplus_candidati: candidati });
  verifica('ad agosto il surplus messo dal fornitore si riconosce: 90,02 € non dovuti', fuori.scarto_surplus && fuori.scarto_surplus.tipo === 'non_dovuto' && !fuori.scarto_surplus.in_parte && fuori.scarto_surplus.importo === 90.02, J(fuori.scarto_surplus));
  verifica('«che in questo mese non vale»', testoEsitoConsuntivo(confronto, fuori).includes('è il Fuel Surcharge (18,003 t a 5,00 €/t), che in questo mese non vale (vale dal 15/09/2026 al 31/12/2026). Il resto torna al centesimo.'), testoEsitoConsuntivo(confronto, fuori));

  // Il conto congelato prima che il surplus fosse scritto.
  const allora = costoAttesoDallaPassiva(senzaSurplus, 'GREEN TYRE PROJECT SRL', 'raccoglitore');
  const dopo = surplusScrittiDopo(c, allora);
  verifica('le righe del surplus che il congelato non ha', dopo.length === 1 && dopo[0].importo === 40.02 && dopo[0].scritto_il === '2026-10-13T08:00:00.000Z', J(dopo));
  verifica('e se il congelato le ha gia\', niente', surplusScrittiDopo(c, c).length === 0);
  const scritto = esitoConsuntivo({ confronto, costo: allora, importo_consuntivo: 1660.29, surplus_candidati: candidati, surplus_dopo: dopo });
  verifica('il consuntivo col surplus contro il congelato senza: «scritto dopo», non «non dovuto»', scritto.scarto_surplus && scritto.scarto_surplus.tipo === 'scritto_dopo' && scritto.quadra_tutto === false, J(scritto.scarto_surplus));
  verifica('e la frase dice quando', testoEsitoConsuntivo(confronto, scritto).includes('la differenza è il surplus scritto il 13/10/2026 dopo il congelamento: Fuel Surcharge 40,02 € (8,003 t a 5,00 €/t, dal 15/09/2026 al 31/12/2026). Il ricalcolo di oggi lo comprende'), testoEsitoConsuntivo(confronto, scritto));

  verifica('surplusPerIlConfronto: solo canale, prestazione del ruolo e fornitore giusti, non i disattivati',
    candidati.length === 1 && candidati[0].euro_t === 5
    && surplusPerIlConfronto([FS], { fornitore: 'GREEN TYRE PROJECT SRL', ruolo: 'impianto', canale: 'RETE' }).length === 0
    && surplusPerIlConfronto([FS], { fornitore: 'GREEN TYRE PROJECT SRL', ruolo: 'raccoglitore', canale: 'ACI' }).length === 0
    && surplusPerIlConfronto([{ ...FS, stato: 'non_attivo' }], { fornitore: 'GREEN TYRE PROJECT SRL', ruolo: 'raccoglitore', canale: 'RETE' }).length === 0
    && surplusPerIlConfronto([{ ...FS, a_chi: 'elenco', fornitori_json: J([{ nome: 'GATIM' }]) }], { fornitore: 'GREEN TYRE PROJECT SRL', ruolo: 'raccoglitore', canale: 'RETE' }).length === 0, J(candidati));
});

// Il file del fornitore: i formulari, la riga del surplus e il riquadro dei totali.
const foglio = (imponibile, conRigaSurplus = true) => [{
  nome: 'Settembre',
  celle: [
    ['N. FORMULARIO', 'DATA', 'KG'],
    ['RGYTR000001AA', '10/09/2026', 10000],
    ['RGYTR000002AA', '20/09/2026', 5000],
    ['RGYTR000003AA', '25/09/2026', 3003],
    ...(conRigaSurplus ? [['Fuel Surcharge', '', '8,003 t x 5,00 €/t = 40,02']] : []),
    [],
    ['ZONA', 'KG TOTALI', 'IMPONIBILE'],
    ['TOTALI', 18003, imponibile],
  ],
}];

await sezione('3. LA RIGA DEL SURPLUS NEL FILE NON E\' UN CARICO', async () => {
  const conRiga = leggiRigheConsuntivo(foglio(1660.29));
  const senzaRiga = leggiRigheConsuntivo(foglio(1660.29, false));
  verifica('tre carichi, non quattro', conRiga.righe.length === 3, J(conRiga.righe));
  verifica('la riga del surplus non si conta fra le illeggibili', conRiga.scartate === senzaRiga.scartate, `${conRiga.scartate} contro ${senzaRiga.scartate}`);
  verifica('si dice che e\' il surplus', (conRiga.righe_surplus || []).length === 1 && conRiga.note.some(n => /la riga «Fuel Surcharge · 8,003 t x 5,00 €\/t = 40,02» è il surplus sulle tariffe, non un carico/.test(n)), J(conRiga.note));
  verifica('e l\'imponibile del riquadro lo comprende', conRiga.importo_totale && conRiga.importo_totale.importo === 1660.29, J(conRiga.importo_totale));
});

await sezione('4. LA FUNZIONE elaboraConsuntivo LEGGE SurplusTariffa', async () => {
  const modulo = await caricaFunzione('elaboraConsuntivo');
  const DB = { PrimariaRete: PRIMARIE, PrimariaAci: [], Secondaria: [], ExtraRaccolta: [], Tariffa: TARIFFE, Fornitore: FORNITORI, SurplusTariffa: [FS] };
  const carica = (tabelle) => ({ azione: 'carica', fornitore: 'GREEN TYRE PROJECT SRL', ruolo: 'raccoglitore', anno: 2026, mese: 9, canale: 'RETE', file_nome: 'GREEN TYRE settembre 2026.xlsx', tabelle });

  const manca = await chiama(modulo, { db: DB, corpo: carica(foglio(1620.27, false)) });
  verifica('il consuntivo senza il surplus: non verde, e il testo dice che manca il Fuel Surcharge', manca.stato === 200 && manca.j.esito && manca.j.esito.quadra_tutto === false
    && manca.j.esito.scarto_surplus && manca.j.esito.scarto_surplus.tipo === 'manca' && (manca.j.testo || '').includes('non porta il Fuel Surcharge: 40,02 € (8,003 t a 5,00 €/t'), `${manca.stato} ${J(manca.j.esito)} ${manca.j.testo}`);
  verifica('il costo previsto e\' standard + surplus', manca.j.costo && manca.j.costo.importo === 1660.29 && manca.j.costo.importo_surplus === 40.02, J(manca.j.costo));

  const porta = await chiama(modulo, { db: DB, corpo: carica(foglio(1660.29)) });
  verifica('il consuntivo col surplus torna verde', porta.stato === 200 && porta.j.esito && porta.j.esito.quadra_tutto === true, `${porta.stato} ${J(porta.j.esito)} ${porta.j.testo}`);
  verifica('e le note dicono che la riga «Fuel Surcharge» e\' il surplus', (porta.j.note_lettura || []).some(n => /è il surplus sulle tariffe, non un carico/.test(n)), J(porta.j.note_lettura));

  // Settembre congelato prima che il Fuel Surcharge fosse scritto.
  const congelato = { id: 'cg1', anno: 2026, mese: 9, canale: 'RETE', congelato_il: '2026-10-02T08:00:00.000Z', congelato_da: 'admin', totale_euro: senzaSurplus.totali.totale_complessivo, passiva_json: J(senzaSurplus) };
  const dopo = await chiama(modulo, { db: { ...DB, ChiusuraPassivaMese: [congelato] }, corpo: carica(foglio(1660.29)) });
  verifica('contro il congelato senza surplus: lo scarto e\' il surplus scritto dopo', dopo.stato === 200 && dopo.j.esito && dopo.j.esito.scarto_surplus && dopo.j.esito.scarto_surplus.tipo === 'scritto_dopo'
    && /scritto il 13\/10\/2026 dopo il congelamento/.test(dopo.j.testo || ''), `${dopo.stato} ${J(dopo.j.esito && dopo.j.esito.scarto_surplus)} ${dopo.j.testo}`);
  verifica('e il congelato dice di quanto si e\' mosso per il surplus', dopo.j.congelato && dopo.j.congelato.cambiato === true && dopo.j.congelato.surplus_dopo && dopo.j.congelato.surplus_dopo.importo === 40.02, J(dopo.j.congelato));

  // Un consuntivo senza surplus contro il congelato senza surplus torna, ma il
  // conto di oggi si e' mosso per il surplus: si dice.
  const mosso = await chiama(modulo, { db: { ...DB, ChiusuraPassivaMese: [congelato] }, corpo: carica(foglio(1620.27, false)) });
  verifica('contro il congelato il consuntivo senza surplus torna, e il testo dice che oggi c\'e\' il Fuel Surcharge, scritto dopo',
    mosso.j.esito && mosso.j.esito.quadra_importo === true && /Dal congelamento il conto di oggi si è mosso: di cui Fuel Surcharge 40,02 €, scritto il 13\/10\/2026 dopo il congelamento\./.test(mosso.j.testo || ''), mosso.j.testo);

  const salvato = (porta.db.ConsuntivoFornitore || [])[0];
  const utente = await chiama(modulo, { db: porta.db, ruolo: 'user', corpo: { azione: 'confronta', id: salvato && salvato.id } });
  verifica('a chi non e\' amministratore niente costi e niente surplus', utente.j.costo && utente.j.costo.riservato === true && !('importo_surplus' in utente.j.costo) && !(utente.j.esito && utente.j.esito.scarto_surplus), J(utente.j).slice(0, 300));
});

// 5. «SCRITTO DOPO» SOLO QUELLO CHE E' STATO SCRITTO DOPO (revisione del
// 13/10/2026). Il Fuel Surcharge vero e' scritto il 13/10/2026 e vale dal 01/10.
// Ottobre si congela il 05/11 col surplus dentro; il 10/11 arriva un carico di
// ottobre chiuso in ritardo (1 t, fine trasporto il 30/10), che e' il caso per
// cui si congela. Il surplus del ricalcolo cresce di 5,00 €, ma non e' stato
// scritto dopo: prima la pagina diceva «Fuel Surcharge 5,00 €, scritto il
// 13/10/2026 dopo il congelamento».
const ottobre = (n, kg, giorno) => primaria(n, 'GREEN TYRE PROJECT SRL', kg, giorno, '10');
const OTT = [ottobre(4, 10000, '10'), ottobre(5, 5000, '20')];
const TARDI = ottobre(6, 1000, '30');
const FS_OTT = { ...FS, data_inizio_validita: '2026-10-01', created_date: '2026-10-13T08:00:00.000Z', updated_date: '2026-10-13T08:00:00.000Z' };
const CONGELATO_IL = '2026-11-05T08:00:00.000Z';
const passivaOttobre = (primarie, surplus) => calcolaPassivaMese(archivi({ primarieRete: primarie, surplusAll: surplus }), 2026, 9, 'ottobre', 'RETE');
const costoGT = (p) => costoAttesoDallaPassiva(p, 'GREEN TYRE PROJECT SRL', 'raccoglitore');
const fileOttobre = (righe, kgTot, imponibile, rigaSurplus) => [{
  nome: 'Ottobre',
  celle: [
    ['N. FORMULARIO', 'DATA', 'KG'],
    ...righe.map(p => [p.numero_fir, p.trasporto_finito_il.slice(0, 10).split('-').reverse().join('/'), p.peso_effettivo]),
    ...(rigaSurplus ? [['Fuel Surcharge', '', rigaSurplus]] : []),
    [],
    ['ZONA', 'KG TOTALI', 'IMPONIBILE'],
    ['TOTALI', kgTot, imponibile],
  ],
}];

await sezione('5. «SCRITTO DOPO» SOLO QUELLO CHE E\' STATO SCRITTO O CAMBIATO DOPO IL CONGELAMENTO', async () => {
  const allora = costoGT(passivaOttobre(OTT, [FS_OTT]));
  const conTardi = costoGT(passivaOttobre([...OTT, TARDI], [FS_OTT]));
  verifica('il surplus c\'era gia\' e cresce per la tonnellata arrivata dopo: non e\' scritto dopo',
    conTardi.importo_surplus === 80 && allora.importo_surplus === 75 && surplusScrittiDopo(conTardi, allora, CONGELATO_IL).length === 0, J(surplusScrittiDopo(conTardi, allora, CONGELATO_IL)));
  verifica('e nemmeno senza la data del congelamento: stessi €/t e stesso periodo, sono le tonnellate', surplusScrittiDopo(conTardi, allora).length === 0);

  // Un surplus che a questo fornitore non toccava al congelamento: vale dal 25/10,
  // e le sue tonnellate sono solo quelle del carico arrivato dopo.
  const FS_25 = { ...FS_OTT, id: 'fs-25', data_inizio_validita: '2026-10-25' };
  const allora25 = costoGT(passivaOttobre(OTT, [FS_25]));
  const oggi25 = costoGT(passivaOttobre([...OTT, TARDI], [FS_25]));
  verifica('scritto il 13/10, prima del congelamento, ma senza tonnellate allora: non e\' scritto dopo',
    allora25.surplus.length === 0 && oggi25.importo_surplus === 5 && surplusScrittiDopo(oggi25, allora25, CONGELATO_IL).length === 0, J(surplusScrittiDopo(oggi25, allora25, CONGELATO_IL)));
  const nuovo = { ...FS_25, created_date: '2026-11-10T09:00:00.000Z', updated_date: '2026-11-10T09:00:00.000Z' };
  const dopoNuovo = surplusScrittiDopo(costoGT(passivaOttobre([...OTT, TARDI], [nuovo])), allora25, CONGELATO_IL);
  verifica('scritto il 10/11, dopo il congelamento: si conta tutto, con le tonnellate',
    dopoNuovo.length === 1 && dopoNuovo[0].importo === 5 && dopoNuovo[0].tonnellate === 1 && dopoNuovo[0].cambiato === false && dopoNuovo[0].scritto_il === '2026-11-10T09:00:00.000Z', J(dopoNuovo));
  // La piattaforma scrive l'istante in UTC senza la Z: le 08:30 sono dopo le 08:00Z
  // del congelamento (lette come ora italiana sarebbero le 07:30Z, prima).
  const senzaZ = { ...FS_25, created_date: '2026-11-05T08:30:00', updated_date: '2026-11-05T08:30:00' };
  const dopoSenzaZ = surplusScrittiDopo(costoGT(passivaOttobre([...OTT, TARDI], [senzaZ])), allora25, CONGELATO_IL);
  verifica('un istante senza la Z e\' UTC, e torna con la Z', dopoSenzaZ.length === 1 && dopoSenzaZ[0].scritto_il === '2026-11-05T08:30:00.000Z', J(dopoSenzaZ));

  // Il Fuel Surcharge cambiato dopo il congelamento: da 5 a 6 €/t il 10/11.
  const FS6 = { ...FS_OTT, euro_t_passiva: 6, updated_date: '2026-11-10T09:00:00.000Z' };
  const oggi6 = costoGT(passivaOttobre(OTT, [FS6]));
  const dopo6 = surplusScrittiDopo(oggi6, allora, CONGELATO_IL);
  verifica('cambiato dopo, stesse tonnellate: si conta solo la differenza, 15,00 € (15 t x 1 €/t), segnata «cambiato»',
    dopo6.length === 1 && dopo6[0].importo === 15 && dopo6[0].cambiato === true && dopo6[0].anche_tonnellate === false, J(dopo6));
  const dopo6t = surplusScrittiDopo(costoGT(passivaOttobre([...OTT, TARDI], [FS6])), allora, CONGELATO_IL);
  verifica('cambiato dopo, e nel frattempo una tonnellata in piu\': la differenza le comprende e lo dice',
    dopo6t.length === 1 && dopo6t[0].importo === 21 && dopo6t[0].anche_tonnellate === true, J(dopo6t));
  verifica('altri €/t ma una data di scrittura prima del congelamento: non si scrive una cosa falsa',
    surplusScrittiDopo(costoGT(passivaOttobre(OTT, [{ ...FS6, updated_date: '2026-11-01T09:00:00.000Z' }])), allora, CONGELATO_IL).length === 0);

  // La funzione, sul banco: il caso del revisore.
  const modulo = await caricaFunzione('elaboraConsuntivo');
  const congelato = (p) => ({ id: 'cg-ott', anno: 2026, mese: 10, canale: 'RETE', congelato_il: CONGELATO_IL, congelato_da: 'admin', totale_euro: p.totali.totale_complessivo, passiva_json: J(p) });
  const caricaOtt = (tabelle) => ({ azione: 'carica', fornitore: 'GREEN TYRE PROJECT SRL', ruolo: 'raccoglitore', anno: 2026, mese: 10, canale: 'RETE', file_nome: 'GREEN TYRE ottobre 2026.xlsx', tabelle });
  const DB = { PrimariaAci: [], Secondaria: [], ExtraRaccolta: [], Tariffa: TARIFFE, Fornitore: FORNITORI };
  const tardi = await chiama(modulo, {
    db: { ...DB, PrimariaRete: [...OTT, TARDI], SurplusTariffa: [FS_OTT], ChiusuraPassivaMese: [congelato(passivaOttobre(OTT, [FS_OTT]))] },
    corpo: caricaOtt(fileOttobre([...OTT, TARDI], 16000, 16 * 90 + 16 * 5, '16 t x 5,00 €/t = 80,00')),
  });
  verifica('il carico arrivato dopo: il conto si e\' mosso, ma niente «scritto dopo il congelamento»',
    tardi.stato === 200 && tardi.j.congelato && tardi.j.congelato.cambiato === true && tardi.j.congelato.surplus_dopo === null
    && !/dopo il congelamento/.test(tardi.j.testo || '') && /si scosta di \+95,00 euro/.test(tardi.j.testo || ''), `${tardi.stato} ${J(tardi.j.congelato)} ${tardi.j.testo}`);

  // Il Fuel Surcharge portato a 6 €/t dopo il congelamento.
  const db6 = { ...DB, PrimariaRete: OTT, SurplusTariffa: [FS6], ChiusuraPassivaMese: [congelato(passivaOttobre(OTT, [FS_OTT]))] };
  const comeAllora = await chiama(modulo, { db: db6, corpo: caricaOtt(fileOttobre(OTT, 15000, 15 * 90 + 15 * 5, '15 t x 5,00 €/t = 75,00')) });
  verifica('il consuntivo come il congelato torna, e il testo dice che il surplus e\' stato cambiato dopo',
    comeAllora.j.esito && comeAllora.j.esito.quadra_importo === true && comeAllora.j.congelato.surplus_dopo && comeAllora.j.congelato.surplus_dopo.importo === 15
    && comeAllora.j.congelato.surplus_dopo.voci[0].cambiato === true
    && (comeAllora.j.testo || '').endsWith('Dal congelamento il conto di oggi si è mosso: di cui Fuel Surcharge 15,00 €, cambiato il 10/11/2026 dopo il congelamento.'), `${J(comeAllora.j.congelato)} ${comeAllora.j.testo}`);
  const comeOggi = await chiama(modulo, { db: db6, corpo: caricaOtt(fileOttobre(OTT, 15000, 15 * 90 + 15 * 6, '15 t x 6,00 €/t = 90,00')) });
  verifica('il consuntivo a 6 €/t contro il congelato: «la differenza è il surplus cambiato il 10/11/2026 dopo il congelamento»',
    comeOggi.j.esito && comeOggi.j.esito.scarto_surplus && comeOggi.j.esito.scarto_surplus.tipo === 'scritto_dopo' && comeOggi.j.esito.scarto_surplus.importo === 15
    && (comeOggi.j.testo || '').includes('più alto di 15,00 € del conto congelato, e la differenza è il surplus cambiato il 10/11/2026 dopo il congelamento'), `${J(comeOggi.j.esito && comeOggi.j.esito.scarto_surplus)} ${comeOggi.j.testo}`);
  // Cambiato dopo, e intanto e' arrivato il carico in ritardo: la cifra le comprende.
  const misto = await chiama(modulo, {
    db: { ...db6, PrimariaRete: [...OTT, TARDI] },
    corpo: caricaOtt(fileOttobre([...OTT, TARDI], 16000, 16 * 90 + 16 * 6, '16 t x 6,00 €/t = 96,00')),
  });
  verifica('e se intanto sono cambiate anche le tonnellate, il testo lo dice',
    (misto.j.testo || '').includes('di cui Fuel Surcharge 21,00 €, cambiato il 10/11/2026 dopo il congelamento (la cifra comprende anche le tonnellate cambiate da allora).'), misto.j.testo);
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
