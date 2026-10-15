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
// 6. LA TARIFFA CHE MANCA E' NOSTRA (prova del cambio d'anno, 15/10/2026,
//    difetto 17): il consuntivo di GATIM di gennaio 2027 (6.000 kg, 432,00 €)
//    senza le tariffe 2027 nel gestionale non «si scosta di +432,00 euro»:
//    l'importo non si controlla, la ragione va in non_controllato e il
//    fornitore non risulta difforme. Con la tariffa 2027 lo stesso consuntivo
//    quadra.
// 7. IL CONGELAMENTO CON LE TARIFFE MANCANTI (difetto 16): congelaPassivaMese
//    risponde 409 con l'elenco e congela solo con la conferma; un conto con
//    tutte le tariffe si congela subito. Congelato senza la tariffa e
//    ricalcolato con la tariffa scritta dopo, il confronto dice di rifare il
//    congelamento, non «ordini chiusi dopo»; quella frase resta quando e'
//    vera. La pagina (Consuntivi.jsx) chiede con l'elenco.
// 8. LA REVISIONE DEL 15/10/2026: una tariffa copiata dall'anno prima e non
//    confermata ferma il controllo come una che manca (D4), anche nel
//    congelamento e nel conto congelato confermato dopo allo stesso prezzo; il
//    vettore delle secondarie senza la tariffa della tratta non e' difforme; il
//    file Excel della verifica scrive «—» col perche', non 0,00 €.
//
// node prove/consuntivoSurplus.mjs
import { calcolaPassivaMese } from '../base44/shared/passivaCalcolo.ts';
// Col nome del modulo e non per nome: col codice di prima le due funzioni nuove
// mancano, e la prova deve fallire nelle sue sezioni, non fermarsi all'import.
import * as C from '../base44/shared/consuntivoFornitore.ts';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import { readFileSync } from 'node:fs';

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

// 6 E 7. GENNAIO 2027 SENZA LE TARIFFE DELL'ANNO (prova del cambio d'anno,
// 15/10/2026). GATIM raccoglie in Calabria e scarica a GATIM: due formulari,
// 01/01/2027 2.000 kg e 12/01/2027 4.000 kg; il suo contratto 2027 e' a 72 €/t,
// quindi 432,00 €. Nel gestionale le tariffe 2026 scadono il 31/12/2026.
const TAR26 = [
  { id: 't-ga-r26', direzione: 'PASSIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', fornitore_nome: 'GATIM S.R.L.', regione: 'Calabria', unita_misura: '€/t', valore: 70, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' },
  { id: 't-ga-t26', direzione: 'PASSIVA', prestazione: 'TRATTAMENTO', tipologia: 'RETE', fornitore_nome: 'GATIM S.R.L.', unita_misura: '€/t', valore: 95, stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' },
];
const TAR27 = [...TAR26,
  { id: 't-ga-r27', direzione: 'PASSIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', fornitore_nome: 'GATIM S.R.L.', regione: 'Calabria', unita_misura: '€/t', valore: 72, stato: 'attivo', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' },
  { id: 't-ga-t27', direzione: 'PASSIVA', prestazione: 'TRATTAMENTO', tipologia: 'RETE', fornitore_nome: 'GATIM S.R.L.', unita_misura: '€/t', valore: 95, stato: 'attivo', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' },
];
const gennaio = (n, kg, giorno) => ({
  id: 'g' + n, stato: 'terminato', id_ordine: 'ET2701000' + n, numero_fir: `CAXXX00000${n}AA`, trasportatore: 'GATIM S.R.L.', provincia: 'CS', regione: 'Calabria',
  destinazione: 'GATIM S.R.L.', tipo_destinazione: 'imp', classe: 'P', peso_effettivo: kg, automezzo: 'CZ00' + n,
  ordine_immesso_il: '2026-12-28T08:00:00.000Z', trasporto_iniziato_il: `2027-01-${giorno}T09:00:00.000Z`, trasporto_finito_il: `2027-01-${giorno}T09:00:00.000Z`,
});
const GEN = [gennaio(1, 2000, '01'), gennaio(2, 4000, '12')];
const passivaGen = (primarie, tariffe) => calcolaPassivaMese({ primarieRete: primarie, primarieAci: [], secondarieAll: [], extraRaccoltaAll: [], tariffeAll: tariffe, fornitoriAll: FORNITORI }, 2027, 0, 'gennaio', 'RETE');
const confrontoGen = (righe) => confrontaConsuntivo(righe, movimentiDelFornitore({ primarieRete: GEN, primarieAci: [], secondarie: [], extraRaccolta: [] },
  { fornitore: 'GATIM S.R.L.', ruolo: 'raccoglitore', anno: 2027, mese: 1, canale: 'RETE', fornitori: FORNITORI }), { canale: 'RETE', anno: 2027, mese: 1 });
const fileGatim = (imponibile = 432) => [{ nome: 'Gennaio', celle: [
  ['N. FORMULARIO', 'DATA', 'KG'], ['CAXXX000001AA', '01/01/2027', 2000], ['CAXXX000002AA', '12/01/2027', 4000], [],
  ['ZONA', 'KG TOTALI', 'IMPONIBILE'], ['TOTALI', 6000, imponibile],
] }];
const caricaGatim = (tabelle = fileGatim()) => ({ azione: 'carica', fornitore: 'GATIM S.R.L.', ruolo: 'raccoglitore', anno: 2027, mese: 1, canale: 'RETE', file_nome: 'GATIM gennaio 2027.xlsx', tabelle });
const DB_GEN = (tariffe, altro = {}) => ({ PrimariaRete: GEN, PrimariaAci: [], Secondaria: [], ExtraRaccolta: [], Tariffa: tariffe, Fornitore: FORNITORI, SurplusTariffa: [], ...altro });
const MANCA_GATIM = 'nella passiva di gennaio 2027 manca la tariffa di raccolta di GATIM S.R.L. (6,00 t senza prezzo; i contratti 2026 sono scaduti il 31/12/2026)';

await sezione('6. LA TARIFFA CHE MANCA E\' NOSTRA, NON DEL FORNITORE (difetto 17 della prova del cambio d\'anno)', async () => {
  const costo = costoAttesoDallaPassiva(passivaGen(GEN, TAR26), 'GATIM S.R.L.', 'raccoglitore');
  verifica('il conto di gennaio 2027 senza la tariffa: 6,00 t senza prezzo, di raccolta', costo.trovato && costo.importo === 0 && costo.senza_tariffa_t === 6
    && J(costo.prestazioni_senza_tariffa) === J(['raccolta']) && costo.periodo && costo.periodo.anno === 2027 && costo.periodo.mese === 'gennaio', J(costo));
  const scaduta = C.ultimaTariffaScaduta(TAR26, { fornitore: 'GATIM S.R.L.', ruolo: 'raccoglitore', canale: 'RETE', anno: 2027, mese: 1 });
  verifica('l\'ultima tariffa di raccolta di GATIM e\' finita il 31/12/2026', scaduta === '2026-12-31', scaduta);
  const confronto = confrontoGen(GEN.map(p => ({ numero_fir: p.numero_fir, kg: p.peso_effettivo })));
  const esito = esitoConsuntivo({ confronto, costo, importo_consuntivo: 432, tariffa_scaduta_il: scaduta });
  const testo = testoEsitoConsuntivo(confronto, esito);
  verifica('l\'importo non si controlla: quadra_importo, scarto e previsto null', esito.quadra_importo === null && esito.scarto_importo === null && esito.importo_previsto === null, J(esito));
  verifica('il fornitore non risulta difforme: il verdetto e\' null, ne\' verde ne\' una difformita\'', esito.quadra_tutto === null, J(esito.quadra_tutto));
  verifica('la ragione sta in non_controllato', esito.non_controllato.includes(`l'importo, perché ${MANCA_GATIM}`), J(esito.non_controllato));
  verifica('la frase dice la tariffa che manca, non «si scosta di»', testo.includes(`Non si è potuto controllare l'importo: ${MANCA_GATIM}. Non è una difformità del fornitore`) && !/si scosta/.test(testo), testo);
  // Una tariffa che manca non copre un formulario che manca: quello resta una difformita'.
  const meno = confrontoGen([{ numero_fir: 'CAXXX000001AA', kg: 2000 }]);
  verifica('con un formulario in meno il consuntivo resta difforme anche con l\'importo in sospeso', esitoConsuntivo({ confronto: meno, costo, importo_consuntivo: 144, tariffa_scaduta_il: scaduta }).quadra_tutto === false);
  // La controprova: con la tariffa 2027 di GATIM, 72 €/t, lo stesso consuntivo quadra.
  const con27 = costoAttesoDallaPassiva(passivaGen(GEN, TAR27), 'GATIM S.R.L.', 'raccoglitore');
  const quadra = esitoConsuntivo({ confronto, costo: con27, importo_consuntivo: 432 });
  verifica('controprova: con la tariffa GATIM 72 €/t del 2027 il previsto e\' 432,00 e il consuntivo quadra', con27.importo === 432 && con27.senza_tariffa_t === 0
    && quadra.quadra_importo === true && quadra.quadra_tutto === true && quadra.importo_sospeso === null && !/Non si è potuto/.test(testoEsitoConsuntivo(confronto, quadra)), J([con27.importo, quadra]));

  // La funzione intera, sul banco: il caricamento del consuntivo il 10/02/2027.
  const modulo = await caricaFunzione('elaboraConsuntivo');
  const r = await chiama(modulo, { db: DB_GEN(TAR26), corpo: caricaGatim() });
  const salvato = (r.db.ConsuntivoFornitore || [])[0] || {};
  verifica('elaboraConsuntivo: importo in sospeso, la ragione col contratto scaduto, salvato con quadra null', r.stato === 200 && r.j.esito && r.j.esito.quadra_importo === null
    && r.j.esito.quadra_tutto === null && (r.j.testo || '').includes(MANCA_GATIM) && !/si scosta/.test(r.j.testo || '') && salvato.quadra === null, `${r.stato} ${J(r.j.esito)} ${r.j.testo} ${J(salvato.quadra)}`);
  const r27 = await chiama(modulo, { db: DB_GEN(TAR27), corpo: caricaGatim() });
  verifica('controprova sulla funzione: con la tariffa 2027 quadra e si salva verde', r27.j.esito && r27.j.esito.quadra_tutto === true && ((r27.db.ConsuntivoFornitore || [])[0] || {}).quadra === true, `${J(r27.j.esito)} ${r27.j.testo}`);
});

// La pagina dei consuntivi, impacchettata come la Dashboard in
// prove/dashboardPagina.mjs: servono le sue due frasi, fraseCongelato e
// domandaTariffeMancanti.
async function paginaConsuntivi(nomi = ['fraseCongelato', 'domandaTariffeMancanti']) {
  const { build } = await import('esbuild');
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ['', '.js', '.jsx', '.ts'].map(e => base + e).find(x => existsSync(x) && /\.\w+$/.test(x)) || base; };
  const pacchetto = await build({
    stdin: { contents: `export { ${nomi.join(', ')} } from ${J(qui('../src/components/verifiche-fornitori/Consuntivi.jsx'))};`, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'finti', setup(b) {
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'client-finto' }, () => ({ contents: 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: {} };', loader: 'js' }));
      b.onResolve({ filter: /^@\// }, (a) => ({ path: daAlias(a.path) }));
    } }],
  });
  if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) };
  return import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
}

await sezione('7. IL CONGELAMENTO CON LE TARIFFE MANCANTI (difetto 16 della prova del cambio d\'anno)', async () => {
  const congela = await caricaFunzione('congelaPassivaMese');
  const corpo = { anno: 2027, mese: 1, canale: 'RETE', nota: 'chiusura del mese' };
  const senza = await chiama(congela, { db: DB_GEN(TAR26), corpo });
  const gat = (senza.j.tariffe_mancanti || []).find(g => g.fornitore === 'GATIM S.R.L.' && g.prestazione === 'RACCOLTA');
  verifica('il 05/02/2027, senza le tariffe 2027: 409 con l\'elenco, chi, per che cosa, quante tonnellate', senza.stato === 409 && senza.j.da_confermare === true && gat && gat.tonnellate === 6
    && /GATIM S\.R\.L\., raccolta: 6,00 t/.test(senza.j.error || ''), `${senza.stato} ${J(senza.j)}`);
  verifica('e non scrive niente', !senza.scritte.some(x => x.entita === 'ChiusuraPassivaMese'), J(senza.scritte));
  const conferma = await chiama(congela, { db: DB_GEN(TAR26), corpo: { ...corpo, conferma: true } });
  const scritto = (conferma.db.ChiusuraPassivaMese || [])[0] || {};
  verifica('con la conferma si congela, e la nota e il riepilogo dicono che cosa mancava', conferma.stato === 200 && /Congelato con la conferma, senza le tariffe di .*GATIM S\.R\.L\., raccolta: 6,00 t/.test(scritto.nota || '')
    && (conferma.j.riepilogo.tariffe_mancanti || []).some(g => g.fornitore === 'GATIM S.R.L.') && conferma.j.riepilogo.tonnellate_senza_tariffa > 0, `${conferma.stato} ${scritto.nota} ${J(conferma.j.riepilogo)}`);
  const tutte = await chiama(congela, { db: DB_GEN(TAR27), corpo });
  verifica('controprova: con tutte le tariffe si congela subito, 200 senza domanda', tutte.stato === 200 && (tutte.j.riepilogo.tariffe_mancanti || []).length === 0
    && (tutte.db.ChiusuraPassivaMese || []).length === 1 && !/Congelato con la conferma/.test(tutte.db.ChiusuraPassivaMese[0].nota), `${tutte.stato} ${J(tutte.j.riepilogo)}`);

  // Il 10/02/2027 il consuntivo di GATIM contro gennaio congelato il 05/02 senza
  // la tariffa, scritta l'08/02: il rimedio e' rifare il congelamento.
  const elabora = await caricaFunzione('elaboraConsuntivo');
  const congelato = (p, il = '2027-02-05T09:00:00.000Z') => ({ id: 'cg-gen', anno: 2027, mese: 1, canale: 'RETE', congelato_il: il, congelato_da: 'admin', totale_euro: p.totali.totale_complessivo, passiva_json: J(p) });
  const r = await chiama(elabora, { db: DB_GEN(TAR27, { ChiusuraPassivaMese: [congelato(passivaGen(GEN, TAR26))] }), corpo: caricaGatim() });
  const testo = r.j.testo || '';
  verifica('il congelato senza la tariffa e oggi con: «mancava la tariffa», si dice di rifare il congelamento', r.stato === 200 && r.j.congelato && r.j.congelato.mancava_la_tariffa === true
    && r.j.congelato.senza_tariffa_allora_t === 6 && r.j.congelato.senza_tariffa_oggi_t === 0
    && testo.includes('nel conto congelato il 05/02/2027 mancava la tariffa di raccolta di GATIM S.R.L. (6,00 t senza prezzo), che oggi c\'è: rifai il congelamento di gennaio 2027 e poi il confronto')
    && !/ordini chiusi dopo|si scosta/.test(testo) && r.j.esito.quadra_tutto === null, `${J(r.j.congelato)} ${testo}`);
  const P = await paginaConsuntivi();
  const frase = P.fraseCongelato(r.j.congelato, r.j.esito.importo_sospeso);
  verifica('la pagina: «nel conto congelato il 05/02/2027 mancava la tariffa di GATIM S.R.L. ... rifai il congelamento», non «ordini chiusi dopo»',
    frase === ' Si è mosso perché nel conto congelato il 05/02/2027 mancava la tariffa di GATIM S.R.L. (6,00 t senza prezzo), che oggi c\'è: rifai il congelamento, poi il confronto.', frase);
  // Controprova: un congelato che cambia per un ordine chiuso dopo (tutte le
  // tariffe, allora c'era solo il primo formulario) dice ancora la frase di oggi.
  const tardi = await chiama(elabora, { db: DB_GEN(TAR27, { ChiusuraPassivaMese: [congelato(passivaGen([GEN[0]], TAR27))] }), corpo: caricaGatim() });
  verifica('controprova: un congelato che cambia per ordini chiusi dopo dice ancora «ordini chiusi dopo»', tardi.j.congelato && tardi.j.congelato.cambiato === true && tardi.j.congelato.mancava_la_tariffa === false
    && /ordini chiusi dopo la chiusura del mese/.test(P.fraseCongelato(tardi.j.congelato, tardi.j.esito.importo_sospeso)) && !/rifai il congelamento/.test(tardi.j.testo || ''), `${J(tardi.j.congelato)} ${tardi.j.testo}`);
  verifica('e un congelato fermo dice «Non si è mosso.»', P.fraseCongelato({ cambiato: false }, null) === ' Non si è mosso.');
  // La domanda prima di congelare, con l'elenco che la funzione manda col 409.
  const domanda = P.domandaTariffeMancanti(senza.j, 'Gennaio 2027 (Rete)');
  verifica('la pagina chiede con l\'elenco: «- GATIM S.R.L., raccolta: 6,00 t» e «Lo congelo lo stesso?»', domanda.includes('Nel conto della passiva di Gennaio 2027 (Rete) ci sono tonnellate senza un prezzo valido.')
    && domanda.includes('- GATIM S.R.L., raccolta: 6,00 t') && domanda.endsWith('Lo congelo lo stesso?'), domanda);
  // Il pulsante: prima senza conferma, al 409 delle tariffe la domanda, poi con la conferma; e il riepilogo si mostra.
  const sorgente = readFileSync(new URL('../src/components/verifiche-fornitori/Consuntivi.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('Consuntivi.jsx: congela senza conferma, al 409 chiede con l\'elenco e solo allora congela con conferma: true, poi mostra il riepilogo',
    /r = await chiedi\(false\);/.test(sorgente) && /if \(!window\.confirm\(domandaTariffeMancanti\(dati, periodo\)\)\) return;\s*r = await chiedi\(true\);/.test(sorgente)
    && /setCongelamento\(\{ \.\.\.\(d\.riepilogo \|\| \{\}\)/.test(sorgente));
});

// 8. LE TARIFFE COPIATE E NON CONFERMATE, IL VETTORE DELLE SECONDARIE, IL FILE
// DELLA VERIFICA (revisione del 15/10/2026 sui difetti 16 e 17).
// - Il caso normale di gennaio: «Prepara le tariffe» ha copiato nel 2027 le
//   tariffe 2026 di GATIM (70 €/t, nota «copiato dal 2026, da confermare») e il
//   contratto 2027 dice 72. Il consuntivo di GATIM (432,00 €) «si scostava di
//   +12,00 euro»: la colpa al fornitore per un prezzo nostro non confermato. D4,
//   decisione dell'utente del 15/10/2026: una riga prezzata con una tariffa
//   copiata e non confermata ferma il documento come una riga senza prezzo.
// - Il vettore delle secondarie (LOGISTICA SRL, NAPPI SUD → IRIGOM, 15 t) senza
//   la tariffa 2027 della tratta: la passiva salta la tratta e ne fa solo
//   un'anomalia, e il consuntivo risultava «senza una riga in questo ruolo»,
//   difforme. Ora le sue tonnellate senza prezzo si leggono dalle anomalie.
// - Il file Excel della verifica scriveva «Importo previsto dalle tariffe 0,00 €»
//   dove la pagina dice «—» (esitoPerIlFile in Consuntivi.jsx).
// - Congelato con la tariffa copiata e confermata dopo allo stesso prezzo: il
//   conto non si muove, ma va rifatto; la pagina non dice solo «Non si è mosso».
const TAR27_COPIATE = [...TAR26, ...TAR26.map(t => ({ ...t, id: t.id.replace('26', '27c'), data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31', note: 'copiato dal 2026, da confermare' }))];
const TAR27_CONFERMATE = TAR27_COPIATE.map(t => ({ ...t, note: '' }));
const COPIATA_GATIM = 'nella passiva di gennaio 2027 la tariffa di raccolta di GATIM S.R.L. è copiata dal 2026 e non ancora confermata (6,00 t a quel prezzo; si conferma sul contratto 2027 in Target & Status › Nuovo anno)';

await sezione('8. TARIFFE COPIATE E NON CONFERMATE, VETTORE DELLE SECONDARIE, FILE DELLA VERIFICA (revisione del 15/10/2026)', async () => {
  const costo = costoAttesoDallaPassiva(passivaGen(GEN, TAR27_COPIATE), 'GATIM S.R.L.', 'raccoglitore');
  verifica('il conto di gennaio 2027 con la tariffa copiata: 6,00 t da confermare, dal 2026, di raccolta; nessuna senza prezzo', costo.trovato && costo.importo === 420 && costo.senza_tariffa_t === 0
    && costo.da_confermare_t === 6 && costo.anno_copia === 2026 && J(costo.prestazioni_da_confermare) === J(['raccolta']), J(costo));
  const confronto = confrontoGen(GEN.map(p => ({ numero_fir: p.numero_fir, kg: p.peso_effettivo })));
  const esito = esitoConsuntivo({ confronto, costo, importo_consuntivo: 432 });
  const testo = testoEsitoConsuntivo(confronto, esito);
  verifica('l\'importo non si controlla: null, ne\' verde ne\' difforme, e niente «si scosta di +12,00»', esito.quadra_importo === null && esito.scarto_importo === null && esito.importo_previsto === null
    && esito.quadra_tutto === null && esito.importo_sospeso && esito.importo_sospeso.importo_al_prezzo_copiato === 420 && !/si scosta/.test(testo), J(esito));
  verifica('la frase dice la copia, dove si conferma e il previsto al prezzo copiato', testo.includes(`Non si è potuto controllare l'importo: ${COPIATA_GATIM}. Non è una difformità del fornitore: confermata la tariffa, rifai il confronto. Al prezzo copiato il previsto sarebbe 420,00 €.`), testo);
  const conf = costoAttesoDallaPassiva(passivaGen(GEN, TAR27), 'GATIM S.R.L.', 'raccoglitore');
  verifica('controprova: con la tariffa 2027 confermata (72 €/t) niente da confermare, e il consuntivo quadra', conf.da_confermare_t === 0 && conf.anno_copia === null
    && esitoConsuntivo({ confronto, costo: conf, importo_consuntivo: 432 }).quadra_tutto === true, J(conf));

  // Il congelamento con le tariffe copiate: 409 con l'elenco, come quelle che mancano.
  const congela = await caricaFunzione('congelaPassivaMese');
  const corpo = { anno: 2027, mese: 1, canale: 'RETE' };
  const c409 = await chiama(congela, { db: DB_GEN(TAR27_COPIATE), corpo });
  verifica('congelaPassivaMese con le tariffe copiate: 409, «tariffa copiata dall\'anno prima e non ancora confermata», l\'elenco', c409.stato === 409
    && (c409.j.tariffe_da_confermare || []).some(g => g.fornitore === 'GATIM S.R.L.' && g.prestazione === 'RACCOLTA' && g.tonnellate === 6)
    && /hanno una tariffa copiata dall'anno prima e non ancora confermata GATIM S\.R\.L\., raccolta: 6,00 t/.test(c409.j.error || ''), `${c409.stato} ${J(c409.j)}`);

  // Congelato il 05/02 con la copia, confermata dopo allo stesso prezzo (70): il
  // conto non si muove, ma il testo e la pagina dicono di rifare il congelamento.
  const elabora = await caricaFunzione('elaboraConsuntivo');
  const pCopia = passivaGen(GEN, TAR27_COPIATE);
  const congelato = { id: 'cg-gen', anno: 2027, mese: 1, canale: 'RETE', congelato_il: '2027-02-05T09:00:00.000Z', congelato_da: 'admin', totale_euro: pCopia.totali.totale_complessivo, passiva_json: J(pCopia) };
  const r = await chiama(elabora, { db: DB_GEN(TAR27_CONFERMATE, { ChiusuraPassivaMese: [congelato] }), corpo: caricaGatim(fileGatim(420)) });
  verifica('congelato con la copia e confermata dopo: era_da_confermare, «rifai il congelamento», verdetto null', r.stato === 200 && r.j.congelato && r.j.congelato.era_da_confermare === true
    && r.j.congelato.cambiato === false && (r.j.testo || '').includes('nel conto congelato il 05/02/2027 la tariffa di raccolta di GATIM S.R.L. era copiata dal 2026 e non confermata (6,00 t), che oggi è confermata: rifai il congelamento di gennaio 2027 e poi il confronto')
    && r.j.esito.quadra_tutto === null, `${J(r.j.congelato)} ${r.j.testo}`);
  const P = await paginaConsuntivi(['fraseCongelato', 'esitoPerIlFile']);
  const frase = P.fraseCongelato(r.j.congelato, r.j.esito.importo_sospeso);
  verifica('la pagina: «Non si è mosso, ma nel conto congelato ... era copiata dal 2026 e non confermata ... rifai il congelamento»',
    frase === ' Non si è mosso, ma nel conto congelato il 05/02/2027 la tariffa di GATIM S.R.L. era copiata dal 2026 e non confermata (6,00 t), che oggi è confermata: rifai il congelamento, poi il confronto.', frase);

  // Il vettore delle secondarie senza la tariffa 2027 della tratta.
  const FORNITORI_V = [...FORNITORI, { id: 'f-lo', ragione_sociale: 'LOGISTICA SRL', stato: 'attivo' }];
  const SEC = [{ id: 's1', stato: 'terminato', cer: '160103', id_ordine: 'S1', numero_fir: 'CAZZZ000009CC', peso_effettivo: 15000, classe: 'A', automezzo: 'AA001',
    ordine_immesso_il: '2027-01-05T08:00:00.000Z', trasporto_iniziato_il: '2027-01-05T08:00:00.000Z', trasporto_finito_il: '2027-01-05T08:00:00.000Z',
    stoccaggio: 'NAPPI SUD SRL', trasportatore: 'LOGISTICA SRL', destinazione: 'IRIGOM S.R.L.', tipo_destinazione: 'imp' }];
  const tratta = (anno, valore = 25) => ({ id: `t-lo-${anno}`, direzione: 'PASSIVA', prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', fornitore_nome: 'LOGISTICA SRL', produttore: 'NAPPI SUD SRL',
    destinatario: 'IRIGOM S.R.L.', unita_misura: '€/t', valore, stato: 'attivo', data_inizio_validita: `${anno}-01-01`, data_fine_validita: `${anno}-12-31` });
  const fileVettore = [{ nome: 'Gennaio', celle: [['N. FORMULARIO', 'DATA', 'KG'], ['CAZZZ000009CC', '05/01/2027', 15000], [], ['TOTALI', 15000, 375]] }];
  const vettore = (tariffe) => chiama(elabora, { db: DB_GEN(tariffe, { Secondaria: SEC, Fornitore: FORNITORI_V }), corpo: { azione: 'carica', fornitore: 'LOGISTICA SRL', ruolo: 'trasportatore', anno: 2027, mese: 1, canale: 'RETE', file_nome: 'vettore gennaio 2027.xlsx', tabelle: fileVettore } });
  const v = await vettore([...TAR26, tratta(2026)]);
  verifica('il vettore senza la tariffa 2027 della tratta: trovato, 15,00 t senza prezzo di trasporto delle secondarie, i chili tornano, nessuna difformita\'', v.stato === 200 && v.j.costo && v.j.costo.trovato === true
    && v.j.costo.senza_tariffa_t === 15 && J(v.j.costo.prestazioni_senza_tariffa) === J(['trasporto delle secondarie']) && v.j.esito.quadra_con_passiva === true && v.j.esito.quadra_tutto === null
    && (v.j.testo || '').includes('manca la tariffa di trasporto delle secondarie di LOGISTICA SRL (15,00 t senza prezzo; i contratti 2026 sono scaduti il 31/12/2026)') && !/si scosta|in meno/.test(v.j.testo || ''), `${v.stato} ${J(v.j.costo)} ${J(v.j.esito)} ${v.j.testo}`);
  const v27 = await vettore([...TAR26, tratta(2026), tratta(2027)]);
  verifica('controprova: con la tariffa 2027 della tratta (25 €/t) il previsto e\' 375,00 e il consuntivo quadra', v27.j.costo && v27.j.costo.importo === 375 && v27.j.costo.senza_tariffa_t === 0
    && v27.j.esito.quadra_tutto === true, `${J(v27.j.costo)} ${J(v27.j.esito)}`);

  // Il file Excel della verifica: «—» col perche' al posto di «0,00 €».
  const sospeso = await chiama(elabora, { db: DB_GEN(TAR26), corpo: caricaGatim() });
  const perFile = P.esitoPerIlFile(sospeso.j);
  verifica('esitoPerIlFile: con l\'importo in sospeso il costo va al file come non utilizzabile, col perche\'', perFile.costo.trovato === false
    && perFile.costo.motivo === `— ${MANCA_GATIM}` && perFile.esito === sospeso.j.esito, J(perFile.costo && { trovato: perFile.costo.trovato, motivo: perFile.costo.motivo }));
  const { caricaLibPagine } = await import('./dati/libPagine.mjs');
  const FILE = await caricaLibPagine('lib/consuntivoFornitoreFile', [["import { leggiFogliLista } from '@/lib/evasioneAssegnati';", 'const leggiFogliLista = null;']]);
  const celleExcel = async (risposta) => {
    const { resolveObjectURL } = await import('node:buffer');
    const ExcelJS = (await import('exceljs')).default;
    let blob = null;
    const prima = globalThis.document;
    globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { blob = resolveObjectURL(this.href); }, remove() {} }) };
    try { await FILE.scaricaExcelConsuntivo(risposta.consuntivo, risposta, { stato: { letto: true, utente: 'Prova', archivi: [], caricamenti_aperti: [] } }); } finally { globalThis.document = prima; }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await blob.arrayBuffer()));
    let previsto;
    wb.getWorksheet('Riepilogo').eachRow(row => { if (String(row.getCell(1).value || '') === 'Importo previsto dalle tariffe') previsto = row.getCell(2).value; });
    return previsto;
  };
  const cella = await celleExcel(perFile);
  verifica('il file Excel: «Importo previsto dalle tariffe» e\' «—» col perche\', non 0,00 €', typeof cella === 'string' && cella.startsWith('— nella passiva di gennaio 2027 manca la tariffa di raccolta di GATIM S.R.L.'), J(cella));
  const intero = await chiama(elabora, { db: DB_GEN(TAR27), corpo: caricaGatim() });
  verifica('controprova: senza importo in sospeso l\'esito va al file com\'e\' e il previsto e\' 432', P.esitoPerIlFile(intero.j) === intero.j && (await celleExcel(intero.j)) === 432);
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
