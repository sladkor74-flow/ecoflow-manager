// IL SURPLUS SULLE TARIFFE: IL MODELLO E IL MOTORE (13/10/2026).
//
// Richiesta dell'utente del 12/10/2026: accanto alle tariffe un eventuale
// surplus, sempre in €/t, con le sue date di inizio e fine validita', e in
// attiva come in passiva una riga standard e una per il surplus, sulle stesse
// tonnellate del mese. Il primo caso e' il Fuel Surcharge del consorzio
// Ecotyre: +5 €/t a tutti i raccoglitori dal 01/10/2026 al 31/12/2026, su rete,
// ACI ed extra raccolta, ognuno con la sua riga e mai sommati.
//
// Qui si prova il motore condiviso (base44/shared/surplus.ts e il suo specchio
// src/lib/surplus.js) e l'archivio (SurplusTariffa.jsonc):
//   1. quando vale: il giorno italiano della fine del trasporto, estremi compresi;
//   2. a chi: tutti, o l'elenco per id o per nome normalizzato;
//   3. quali surplus valgono per un movimento, in passiva e in attiva, canale per canale;
//   4. il centesimo come lo fa Excel, e il caso vero dei nove raccoglitori di settembre;
//   5. i controlli al salvataggio;
//   6. i conflitti: lo stesso surplus due volte, il cambio d'importo, due surplus diversi;
//   7. la colonna «Surplus» della pagina delle tariffe;
//   8. stato, periodo, etichetta, mesi; i surplus di un mese, anche quando chi
//      calcola ne scrive la fine '-31' nei mesi di 30 giorni;
//   9. lo specchio delle pagine dice le stesse cose;
//  10. l'archivio: un canale per record, le due date obbligatorie, le regole di
//      lettura e scrittura delle tariffe;
//  11. il sorgente usa la regola delle tariffe e il centesimo di Excel, non copie sue;
//  12. sui dati veri dell'11/10/2026: il Fuel Surcharge tocca 29 tariffe (22 di
//      raccolta, 7 attive), e nessuna di trattamento, stoccaggio o trasporto.
//
// node prove/surplus.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as M from '../base44/shared/surplus.ts';
import * as S from '../src/lib/surplus.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (v) => JSON.stringify(v);
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
const sorgente = (p) => readFileSync(qui(p), 'utf8').replace(/\r/g, '');

// Il Fuel Surcharge com'e' da scrivere: tre record, uno per canale, stesso gruppo.
const fuel = (tipologia, x = {}) => ({
  id: `fuel-${tipologia}`, gruppo: 'fuel-2026', nome: 'Fuel Surcharge', origine: 'CONSORZIO', riferimento: 'comunicazione Ecotyre',
  tipologia, prestazione: 'RACCOLTA', a_chi: 'tutti', fornitori_json: '',
  euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...x,
});
const FUEL = [fuel('RETE'), fuel('ACI'), fuel('EXTRA_RACCOLTA')];
const GATIM = { id: 'f-gatim', nome: 'GATIM' };
const EMMESSE = { id: 'f-emmesse', nome: 'EMMESSE SRLS' };
const accordoGatim = {
  id: 'acc-gatim', gruppo: 'acc', nome: 'Accordo Gatim', origine: 'ACCORDO_COMMERCIALE', tipologia: 'RETE', prestazione: 'RACCOLTA',
  a_chi: 'elenco', fornitori_json: J([GATIM]), euro_t_passiva: 2, euro_t_attiva: null,
  data_inizio_validita: '2026-10-15', data_fine_validita: '2026-12-31', stato: 'attivo',
};
const contributoTrattamento = {
  id: 'tratt', gruppo: 'tratt', nome: 'Contributo trattamento', origine: 'CONSORZIO', tipologia: 'RETE', prestazione: 'TRATTAMENTO',
  a_chi: 'tutti', euro_t_passiva: 3, euro_t_attiva: 3, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo',
};
const spento = { ...fuel('RETE'), id: 'spento', nome: 'Vecchio surplus', stato: 'non_attivo' };

console.log('1. QUANDO VALE: IL GIORNO ITALIANO DELLA FINE DEL TRASPORTO');
{
  const s = fuel('RETE');
  verifica('le 00:30 del 1 ottobre in Italia (22:30Z del 30/09) sono di ottobre: vale', M.surplusValeIl(s, '2026-09-30T22:30:00.000Z'));
  verifica('le 23:00 del 30 settembre (21:00Z) sono di settembre: non vale', !M.surplusValeIl(s, '2026-09-30T21:00:00.000Z'));
  verifica('le 23:30 del 31 dicembre (22:30Z) sono ancora del 31: vale', M.surplusValeIl(s, '2026-12-31T22:30:00.000Z'));
  verifica('le 00:30 del 1 gennaio (23:30Z del 31/12) no', !M.surplusValeIl(s, '2026-12-31T23:30:00.000Z'));
  verifica('un surplus disattivato non vale mai, nemmeno nelle sue date', !M.surplusValeIl(spento, '2026-10-15'));
  verifica('senza un giorno leggibile non vale', !M.surplusValeIl(s, null) && !M.surplusValeIl(s, 'non una data'));
  verifica('i non disattivati sono tutti tranne lo spento', J(M.surplusNonDisattivati([...FUEL, spento]).map(x => x.id)) === J(FUEL.map(x => x.id)));
}

console.log('2. A CHI: TUTTI, O L\'ELENCO PER ID O PER NOME');
{
  verifica('«tutti» vale per chiunque, anche senza nome', M.valePerFornitore(fuel('RETE'), { nomi: ['EMMESSE SRLS'] }) && M.valePerFornitore(fuel('RETE'), {}) && M.valePerFornitore(fuel('RETE'), null));
  verifica('l\'elenco senza fornitore da confrontare non vale (e non si rompe)', !M.valePerFornitore(accordoGatim, null) && !M.valePerFornitore(accordoGatim));
  verifica('l\'elenco riconosce il fornitore per id', M.valePerFornitore(accordoGatim, { id: 'f-gatim', nomi: ['nome diverso'] }));
  verifica('e per nome normalizzato: «GATIM S.R.L.» e «GA.TIM. S.R.L.» sono GATIM',
    M.valePerFornitore(accordoGatim, { id: 'altro', nomi: ['GATIM S.R.L.'] }) && M.valePerFornitore(accordoGatim, { nomi: ['GA.TIM. S.R.L.'] }));
  verifica('basta uno dei nomi (fatturante o raccoglitore del movimento)', M.valePerFornitore(accordoGatim, { nomi: ['EMMESSE SRLS', 'GATIM SRL'] }));
  verifica('chi non e\' nell\'elenco non lo riceve', !M.valePerFornitore(accordoGatim, { id: 'f-emmesse', nomi: ['EMMESSE SRLS'] }));
  verifica('un elenco vuoto non vale per nessuno (non e\' «tutti»)', !M.valePerFornitore({ ...accordoGatim, fornitori_json: '[]' }, { nomi: ['GATIM'] }));
  verifica('un elenco illeggibile nemmeno', !M.valePerFornitore({ ...accordoGatim, fornitori_json: '{rotto' }, { nomi: ['GATIM'] }));
  verifica('fornitoriDelSurplus: l\'elenco come { id, nome }; [] con «tutti» anche se il JSON c\'e\'',
    J(M.fornitoriDelSurplus(accordoGatim)) === J([GATIM]) && J(M.fornitoriDelSurplus({ ...fuel('RETE'), fornitori_json: J([GATIM]) })) === '[]');
  verifica('un elenco di soli nomi si legge lo stesso', J(M.fornitoriDelSurplus({ a_chi: 'elenco', fornitori_json: J(['GATIM']) })) === J([{ id: '', nome: 'GATIM' }]));
}

console.log('3. I SURPLUS DI UN MOVIMENTO, CANALE PER CANALE');
{
  const tutti = [...FUEL, accordoGatim, contributoTrattamento, spento];
  const quando = '2026-10-20T10:00:00.000Z';
  const nomi = (r) => r.map(x => `${x.surplus.nome}:${x.surplus.tipologia}:${x.euro_t}`);
  const gatim = M.surplusDelMovimento(tutti, { tipologia: 'RETE', prestazione: 'RACCOLTA', quando, fornitore: { id: 'f-gatim', nomi: ['GATIM S.R.L.'] } }, 'PASSIVA');
  verifica('passiva, raccolta di rete di Gatim: l\'accordo e il Fuel Surcharge, per nome', J(nomi(gatim)) === J(['Accordo Gatim:RETE:2', 'Fuel Surcharge:RETE:5']), J(nomi(gatim)));
  const emmesse = M.surplusDelMovimento(tutti, { tipologia: 'RETE', prestazione: 'RACCOLTA', quando, fornitore: { nomi: ['EMMESSE SRLS'] } }, 'PASSIVA');
  verifica('Emmesse solo il Fuel Surcharge', J(nomi(emmesse)) === J(['Fuel Surcharge:RETE:5']), J(nomi(emmesse)));
  const prima = M.surplusDelMovimento(tutti, { tipologia: 'RETE', prestazione: 'RACCOLTA', quando: '2026-10-10T10:00:00.000Z', fornitore: { nomi: ['GATIM'] } }, 'PASSIVA');
  verifica('l\'accordo comincia il 15: il 10 ottobre solo il Fuel Surcharge', J(nomi(prima)) === J(['Fuel Surcharge:RETE:5']), J(nomi(prima)));
  const aci = M.surplusDelMovimento(tutti, { tipologia: 'ACI', prestazione: 'RACCOLTA', quando, fornitore: { nomi: ['GATIM'] } }, 'PASSIVA');
  verifica('un movimento ACI prende solo il surplus dell\'ACI: i canali non si sommano', J(nomi(aci)) === J(['Fuel Surcharge:ACI:5']), J(nomi(aci)));
  const extra = M.surplusDelMovimento(tutti, { tipologia: 'EXTRA RACCOLTA', prestazione: 'raccolta', quando, fornitore: { nomi: ['EMMESSE SRLS'] } }, 'PASSIVA');
  verifica('l\'extra raccolta scritta con lo spazio e la prestazione in minuscolo si riconoscono', J(nomi(extra)) === J(['Fuel Surcharge:EXTRA_RACCOLTA:5']), J(nomi(extra)));
  const tratt = M.surplusDelMovimento(tutti, { tipologia: 'RETE', prestazione: 'TRATTAMENTO', quando, fornitore: { nomi: ['IRIGOM S.R.L.'] } }, 'PASSIVA');
  verifica('sul trattamento non si paga il surplus della raccolta', J(nomi(tratt)) === J(['Contributo trattamento:RETE:3']), J(nomi(tratt)));
  verifica('nella passiva la prestazione e\' obbligatoria: senza, niente', M.surplusDelMovimento(tutti, { tipologia: 'RETE', quando, fornitore: { nomi: ['GATIM'] } }, 'PASSIVA').length === 0);
  verifica('a settembre niente', M.surplusDelMovimento(tutti, { tipologia: 'RETE', prestazione: 'RACCOLTA', quando: '2026-09-30T21:00:00.000Z', fornitore: { nomi: ['GATIM'] } }, 'PASSIVA').length === 0);
  verifica('senza canale niente', M.surplusDelMovimento(tutti, { prestazione: 'RACCOLTA', quando, fornitore: { nomi: ['GATIM'] } }, 'PASSIVA').length === 0);

  // L'attiva: tutte le tonnellate fatturate del canale, qualunque prestazione,
  // solo i surplus che Ecotyre paga (l'accordo con Gatim e' solo passivo).
  const att = M.surplusDelMovimento(tutti, { tipologia: 'RETE', quando, fornitore: { nomi: ['GATIM'] } }, 'ATTIVA');
  verifica('attiva di rete: il Fuel Surcharge e il contributo, non l\'accordo solo passivo', J(nomi(att)) === J(['Contributo trattamento:RETE:3', 'Fuel Surcharge:RETE:5']), J(nomi(att)));
  const conSecondarie = [...tutti, { ...contributoTrattamento, id: 'sec', nome: 'Trasporto', prestazione: 'TRASPORTO_SECONDARIA', euro_t_attiva: 4 }];
  verifica('il trasporto delle secondarie non entra mai nell\'attiva', !M.surplusDelMovimento(conSecondarie, { tipologia: 'RETE', quando }, 'ATTIVA').some(x => x.surplus.id === 'sec'));
  const soloAttivo = { ...fuel('RETE'), id: 'sa', nome: 'Solo attivo', euro_t_passiva: null, euro_t_attiva: 1 };
  verifica('un surplus solo attivo non si paga ai fornitori', !M.surplusDelMovimento([soloAttivo], { tipologia: 'RETE', prestazione: 'RACCOLTA', quando, fornitore: { nomi: ['GATIM'] } }, 'PASSIVA').length
    && M.surplusDelMovimento([soloAttivo], { tipologia: 'RETE', quando }, 'ATTIVA').length === 1);
  // Un surplus «solo questi» sull'impianto: nell'attiva il fornitore e' la
  // destinazione, non il raccoglitore.
  const irigom = { ...contributoTrattamento, id: 'irigom', nome: 'Accordo Irigom', a_chi: 'elenco', fornitori_json: J([{ id: 'f-irigom', nome: 'IRIGOM S.R.L.' }]), euro_t_attiva: 4 };
  const verso = (dest) => M.surplusDelMovimento([irigom], { tipologia: 'RETE', quando, fornitore: { nomi: ['GATIM'] }, fornitori: { RACCOLTA: { nomi: ['GATIM'] }, TRATTAMENTO: { nomi: [dest] } } }, 'ATTIVA').length;
  verifica('attiva con l\'elenco degli impianti: vale sui conferimenti a Irigom, non su quelli a Tecnogum', verso('IRIGOM SRL') === 1 && verso('TECNOGUM SRL') === 0);
  const zero = { ...fuel('RETE'), id: 'z', euro_t_passiva: 0, euro_t_attiva: -1 };
  verifica('uno zero o un negativo non e\' un surplus', M.surplusDelMovimento([zero], { tipologia: 'RETE', prestazione: 'RACCOLTA', quando }, 'PASSIVA').length === 0
    && M.surplusDelMovimento([zero], { tipologia: 'RETE', quando }, 'ATTIVA').length === 0);
  verifica('euroTDi: il numero, o null se manca', M.euroTDi(fuel('RETE'), 'PASSIVA') === 5 && M.euroTDi(accordoGatim, 'ATTIVA') === null && M.euroTDi({ euro_t_attiva: '2.5' }, 'attiva') === 2.5);
}

console.log('4. IL CENTESIMO COME LO FA EXCEL');
{
  verifica('103 kg a 85 €/t fanno 8,76, non 8,75', M.importoSurplus(103, 85) === 8.76, String(M.importoSurplus(103, 85)));
  verifica('la rete di settembre come esempio: 1.120.240 kg a 5 €/t = 5.601,20', M.importoSurplus(1120240, 5) === 5601.2, String(M.importoSurplus(1120240, 5)));
  verifica('niente chili, niente surplus', M.importoSurplus(0, 5) === 0 && M.importoSurplus(null, 5) === 0);
  // Il caso vero del progetto (settembre 2026 come esempio di ottobre): i nove
  // raccoglitori esterni della rete, una riga ciascuno, 4.332,80 € in tutto.
  const nove = [['GREEN TYRE PROJECT SRL', 255780, 1278.9], ['Nappi Sud Srl A Socio Unico', 187600, 938], ['LOGISTICA & PNEUMATICI SRL', 124800, 624],
    ['Ecorecuperi Srl', 101630, 508.15], ['GATIM S.R.L.', 63020, 315.1], ['EMMESSE SRLS', 59150, 295.75], ['PNEUSERVICE CONVERSANO SRL', 49960, 249.8],
    ['ECOLOGICAL SYSTEMS SRL', 22480, 112.4], ['C.L. SERVICE S.R.L.', 2140, 10.7]];
  const sbagliati = nove.filter(([, kg, euro]) => M.importoSurplus(kg, 5) !== euro);
  verifica('i nove raccoglitori di settembre, uno per uno', !sbagliati.length, J(sbagliati));
  const totale = Math.round(nove.reduce((s, [, kg]) => s + M.importoSurplus(kg, 5), 0) * 100) / 100;
  verifica('e in tutto 4.332,80 €', totale === 4332.8, String(totale));
}

console.log('5. I CONTROLLI AL SALVATAGGIO');
{
  const c = (x) => M.controlliSurplus({ ...fuel('RETE'), ...x });
  const errori = (x) => c(x).filter(e => e.gravita === 'errore');
  const su = (x, campo) => errori(x).some(e => e.campo === campo);
  verifica('il Fuel Surcharge com\'e\' da scrivere passa, senza avvisi', c({}).length === 0, J(c({})));
  const senzaFine = errori({ data_fine_validita: '' });
  verifica('la fine manca: errore sulla fine, che dice fino a quando al piu\'', senzaFine.length === 1 && senzaFine[0].campo === 'data_fine_validita' && senzaFine[0].messaggio.includes('31/12/2026'), J(senzaFine));
  const oltre = errori({ data_fine_validita: '2027-01-15' });
  verifica('comincia nel 2026 e finisce nel 2027: errore, i contratti sono annuali', oltre.length === 1 && oltre[0].campo === 'data_fine_validita' && /31\/12\/2026/.test(oltre[0].messaggio) && /15\/01\/2027/.test(oltre[0].messaggio), J(oltre));
  verifica('la fine prima dell\'inizio: errore', su({ data_fine_validita: '2026-09-30' }, 'data_fine_validita'));
  verifica('l\'inizio manca o non e\' una data: errore', su({ data_inizio_validita: '' }, 'data_inizio_validita') && su({ data_inizio_validita: '2026-02-30' }, 'data_inizio_validita'));
  verifica('0 €/t ai fornitori: errore (vuoto, non zero, se non si paga)', su({ euro_t_passiva: 0 }, 'euro_t_passiva') && /lascia vuoto/.test(errori({ euro_t_passiva: 0 })[0].messaggio));
  verifica('un negativo da Ecotyre: errore', su({ euro_t_attiva: -5 }, 'euro_t_attiva'));
  // La soglia e' il centesimo, non lo zero (revisione, 13/10/2026): 0,004 €/t
  // in fattura fa zero centesimi su quasi ogni riga, e non e' un importo.
  verifica('sotto il centesimo (0,004 e 0,009 €/t): errore, che dice il minimo',
    su({ euro_t_passiva: 0.004 }, 'euro_t_passiva') && su({ euro_t_attiva: 0.009 }, 'euro_t_attiva')
    && /almeno 0,01 €\/t/.test(errori({ euro_t_passiva: 0.004 })[0].messaggio), J(errori({ euro_t_passiva: 0.004 })));
  verifica('un centesimo (0,01 €/t) va bene', errori({ euro_t_passiva: 0.01, euro_t_attiva: 0.01 }).length === 0, J(errori({ euro_t_passiva: 0.01, euro_t_attiva: 0.01 })));
  verifica('un importo che non e\' un numero: errore', su({ euro_t_attiva: 'cinque' }, 'euro_t_attiva'));
  verifica('nessuno dei due importi: errore', su({ euro_t_passiva: null, euro_t_attiva: '' }, 'euro_t_passiva'));
  verifica('uno solo dei due va bene (solo passivo, solo attivo)', errori({ euro_t_attiva: null }).length === 0 && errori({ euro_t_passiva: null }).length === 0);
  const tanto = c({ euro_t_passiva: 60 });
  verifica('60 €/t: un avviso, non un errore, col numero all\'italiana', tanto.length === 1 && tanto[0].gravita === 'avviso' && tanto[0].campo === 'euro_t_passiva' && tanto[0].messaggio.includes('60,00 €/t'), J(tanto));
  verifica('la soglia dell\'avviso: 50 €/t niente, 50,01 €/t si\'', c({ euro_t_attiva: 50 }).length === 0 && c({ euro_t_attiva: 50.01 }).length === 1, J([c({ euro_t_attiva: 50 }), c({ euro_t_attiva: 50.01 })]));
  verifica('il trasporto delle secondarie con la parte attiva: errore sull\'importo da Ecotyre',
    su({ prestazione: 'TRASPORTO_SECONDARIA' }, 'euro_t_attiva') && errori({ prestazione: 'TRASPORTO_SECONDARIA', euro_t_attiva: null }).length === 0);
  verifica('TUTTE non e\' un canale: un surplus per canale', su({ tipologia: 'TUTTE' }, 'tipologia') && /un surplus per canale/.test(errori({ tipologia: 'TUTTE' })[0].messaggio));
  verifica('canale e prestazione sconosciuti: errore', su({ tipologia: '' }, 'tipologia') && su({ prestazione: 'PULIZIA' }, 'prestazione'));
  verifica('«solo questi» senza fornitori: errore', su({ a_chi: 'elenco', fornitori_json: '[]' }, 'fornitori_json'));
  verifica('«solo questi» con un elenco illeggibile: errore', su({ a_chi: 'elenco', fornitori_json: '{rotto' }, 'fornitori_json'));
  verifica('«tutti» con un elenco: errore, chi riceve deve essere chiaro', su({ a_chi: 'tutti', fornitori_json: J([GATIM]) }, 'fornitori_json'));
  verifica('«solo questi» con Gatim va bene', errori({ a_chi: 'elenco', fornitori_json: J([GATIM]) }).length === 0);
  verifica('senza nome e senza origine: errore su tutti e due', su({ nome: ' ' }, 'nome') && su({ origine: '' }, 'origine'));
  verifica('ogni esito ha gravita\', campo e messaggio, a video con gli accenti',
    errori({ nome: '', data_fine_validita: '' }).every(e => e.gravita && e.campo && e.messaggio) && /validità/.test(senzaFine[0].messaggio));
}

console.log('6. I CONFLITTI');
{
  const nuovo = (x = {}) => ({ ...fuel('RETE'), id: 'nuovo', ...x });
  const esito = (n, esistenti, id = null) => M.conflittiSurplus(n, esistenti, id);
  const r1 = esito(nuovo(), FUEL);
  verifica('lo stesso Fuel Surcharge sulla rete due volte: conflitto (si pagherebbe due volte)', r1.conflitti.length === 1 && r1.conflitti[0].id === 'fuel-RETE' && !r1.chiudibili.length, J(r1));
  verifica('anche scritto in un altro modo («fuel  SURCHARGE», «Fuel-Surchargé»)', esito(nuovo({ nome: 'fuel  SURCHARGE' }), FUEL).conflitti.length === 1
    && esito(nuovo({ nome: 'Fuel-Surchargé' }), FUEL).conflitti.length === 1);
  verifica('sull\'ACI e sull\'extra raccolta non si guarda la rete', esito(nuovo(), [fuel('ACI'), fuel('EXTRA_RACCOLTA')]).conflitti.length === 0);
  verifica('modificando se stesso non c\'e\' conflitto', esito({ ...fuel('RETE'), euro_t_passiva: 6 }, FUEL, 'fuel-RETE').conflitti.length === 0);
  verifica('uno disattivato non conta', esito(nuovo(), [{ ...fuel('RETE'), stato: 'non_attivo' }]).conflitti.length === 0);
  verifica('periodi senza giorni in comune: niente', esito(nuovo({ data_inizio_validita: '2026-01-01', data_fine_validita: '2026-09-30' }), FUEL).conflitti.length === 0);

  const cambio = esito(nuovo({ data_inizio_validita: '2026-11-01', euro_t_passiva: 7, euro_t_attiva: 7 }), FUEL);
  verifica('il cambio d\'importo dal 01/11: quello di prima e\' chiudibile, non un conflitto', cambio.chiudibili.length === 1 && cambio.chiudibili[0].id === 'fuel-RETE' && !cambio.conflitti.length, J(cambio));
  verifica('e si chiude il giorno prima: 31/10/2026', M.giornoPrimaDi('2026-11-01') === '2026-10-31' && M.giornoPrimaDi('2027-01-01') === '2026-12-31' && M.giornoPrimaDi('2028-03-01') === '2028-02-29');
  const inMezzo = esito(nuovo({ data_inizio_validita: '2026-11-01', data_fine_validita: '2026-11-30' }), FUEL);
  verifica('uno nuovo solo a novembre: conflitto, chiudere il vecchio perderebbe dicembre', inMezzo.conflitti.length === 1 && !inMezzo.chiudibili.length, J(inMezzo));
  const aperto = esito(nuovo({ data_inizio_validita: '2026-11-01' }), [{ ...fuel('RETE'), data_fine_validita: '' }]);
  verifica('uno aperto (senza fine) che comincia prima: chiudibile', aperto.chiudibili.length === 1 && !aperto.conflitti.length, J(aperto));
  verifica('uno che comincia lo stesso giorno: conflitto', esito(nuovo(), [{ ...fuel('RETE'), data_fine_validita: '' }]).conflitti.length === 1);
  // Chiudere il vecchio non deve togliere il surplus a nessuno: il nuovo deve
  // coprire tutti i suoi fornitori, sulla stessa prestazione.
  const dueFornitori = { ...accordoGatim, fornitori_json: J([GATIM, EMMESSE]), data_inizio_validita: '2026-10-01' };
  const soloGatim = esito({ ...accordoGatim, id: 'n4', data_inizio_validita: '2026-11-01', euro_t_passiva: 3 }, [dueFornitori]);
  verifica('l\'accordo di Gatim ed Emmesse cambiato dal 01/11 solo per Gatim: conflitto, Emmesse perderebbe novembre e dicembre',
    soloGatim.conflitti.length === 1 && !soloGatim.chiudibili.length, J(soloGatim));
  const tuttiEDue = esito({ ...dueFornitori, id: 'n5', data_inizio_validita: '2026-11-01', fornitori_json: J([EMMESSE, { id: 'x', nome: 'GATIM S.R.L.' }]), euro_t_passiva: 3 }, [dueFornitori]);
  verifica('cambiato per tutti e due (anche scritti in un altro modo): chiudibile', tuttiEDue.chiudibili.length === 1 && !tuttiEDue.conflitti.length, J(tuttiEDue));
  verifica('un «tutti» che diventa «solo Gatim» dal 01/11: conflitto',
    esito({ ...accordoGatim, id: 'n6', nome: 'Fuel Surcharge', data_inizio_validita: '2026-11-01', euro_t_attiva: 5 }, FUEL).conflitti.length === 1);
  verifica('stesso nome dal 01/11 su un\'altra prestazione con la parte attiva: conflitto, non chiudibile',
    esito(nuovo({ prestazione: 'TRATTAMENTO', data_inizio_validita: '2026-11-01' }), FUEL).conflitti.length === 1);

  const diverso = esito(nuovo({ nome: 'Accordo Gatim', origine: 'ACCORDO_COMMERCIALE', a_chi: 'elenco', fornitori_json: J([GATIM]), euro_t_attiva: null }), FUEL);
  verifica('un surplus con un altro nome sulle stesse tonnellate: ammesso, con un avviso che dice quale', !diverso.conflitti.length && diverso.avvisi.length === 1
    && diverso.avvisi[0].gravita === 'avviso' && diverso.avvisi[0].surplus.id === 'fuel-RETE'
    && diverso.avvisi[0].messaggio.includes('Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026 al 31/12/2026'), J(diverso));
  verifica('un altro nome sul trattamento, solo passivo: nessun avviso (tonnellate diverse)',
    esito(nuovo({ nome: 'Altro', prestazione: 'TRATTAMENTO', euro_t_attiva: null }), FUEL).avvisi.length === 0);
  const elencoGatim = { ...accordoGatim };
  verifica('lo stesso accordo per Emmesse non si scontra con quello per Gatim',
    esito({ ...accordoGatim, id: 'n2', fornitori_json: J([EMMESSE]) }, [elencoGatim]).conflitti.length === 0);
  verifica('ma per «GATIM S.R.L.» si\' (stesso fornitore per nome)',
    esito({ ...accordoGatim, id: 'n3', fornitori_json: J([{ id: 'altro-id', nome: 'GATIM S.R.L.' }]) }, [elencoGatim]).conflitti.length === 1);
  verifica('stesso nome su un\'altra prestazione con la parte attiva tutti e due: conflitto (Ecotyre pagherebbe due volte)',
    esito(nuovo({ prestazione: 'TRATTAMENTO' }), FUEL).conflitti.length === 1);
  verifica('stesso nome su un\'altra prestazione, solo passivo: nessun conflitto',
    esito(nuovo({ prestazione: 'TRATTAMENTO', euro_t_attiva: null }), FUEL).conflitti.length === 0);
}

console.log('7. LA COLONNA «SURPLUS» DELLE TARIFFE');
{
  const tariffa = (x) => ({ id: 't', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'f-emmesse', fornitore_nome: 'EMMESSE SRLS',
    unita_misura: '€/t', valore: 72, data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', stato: 'attivo', ...x });
  const col = (t, oggi = '2026-10-13', tutti = FUEL) => M.surplusDellaTariffa(t, tutti, oggi);
  const emm = col(tariffa());
  verifica('la raccolta di rete di Emmesse: oggi +5,00 €/t, fino al 31/12, del consorzio',
    emm.oggi.length === 1 && emm.oggi[0].euro_t === 5 && emm.oggi[0].nome === 'Fuel Surcharge' && emm.oggi[0].al === '2026-12-31'
    && emm.oggi[0].origine === 'consorzio Ecotyre' && J(emm.oggi[0].tipologie) === '["RETE"]' && !emm.in_arrivo.length, J(emm));
  verifica('la raccolta ACI prende il surplus dell\'ACI', J(col(tariffa({ tipologia: 'ACI' })).oggi.map(v => v.tipologie)) === '[["ACI"]]');
  verifica('sul trattamento niente', J(col(tariffa({ prestazione: 'TRATTAMENTO', fornitore_nome: 'IRIGOM S.R.L.' }))) === J({ oggi: [], in_arrivo: [] }));
  const trasporto = (tip) => ({ ...fuel(tip), id: `tr-${tip}`, gruppo: 'tr', nome: 'Gasolio trasporti', prestazione: 'TRASPORTO_SECONDARIA', euro_t_attiva: null, euro_t_passiva: 2 });
  const tutte = col(tariffa({ tipologia: 'TUTTE', prestazione: 'TRASPORTO_SECONDARIA', fornitore_nome: 'TRASPORTI X', unita_misura: '€/viaggio', valore: 300 }), '2026-10-13', [...FUEL, trasporto('RETE'), trasporto('ACI')]);
  verifica('una tariffa TUTTE guarda rete e ACI, e lo stesso surplus sui due canali si dice una volta',
    tutte.oggi.length === 1 && tutte.oggi[0].nome === 'Gasolio trasporti' && J(tutte.oggi[0].tipologie) === '["RETE","ACI"]', J(tutte));
  const attivaRete = { id: 'a', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', unita_misura: '€/t', valore: 202, data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' };
  const diversi = [fuel('RETE', { euro_t_passiva: 4, euro_t_attiva: 5 })];
  verifica('la tariffa attiva della rete: +5 dalla parte attiva; la passiva +4 dalla sua',
    col(attivaRete, '2026-10-13', diversi).oggi[0].euro_t === 5 && col(tariffa(), '2026-10-13', diversi).oggi[0].euro_t === 4);
  verifica('l\'attiva dell\'extra raccolta prende il suo', col({ ...attivaRete, tipologia: 'EXTRA_RACCOLTA' }).oggi.length === 1);
  // Un surplus del trasporto delle secondarie con la parte attiva scritta (il
  // salvataggio lo rifiuta, ma l'archivio si puo' scrivere anche altrove): a
  // Ecotyre il trasporto non si fattura, e sulla tariffa attiva non compare.
  const trasportoAttivo = { ...fuel('RETE'), id: 'tr-att', gruppo: 'tr-att', nome: 'Gasolio trasporti', prestazione: 'TRASPORTO_SECONDARIA', euro_t_attiva: 3 };
  verifica('sulla tariffa attiva il trasporto delle secondarie non compare, anche con l\'importo da Ecotyre',
    J(col(attivaRete, '2026-10-13', [trasportoAttivo])) === J({ oggi: [], in_arrivo: [] })
    && J(col(attivaRete, '2026-10-13', [fuel('RETE'), trasportoAttivo]).oggi.map(v => v.nome)) === J(['Fuel Surcharge']),
    J(col(attivaRete, '2026-10-13', [trasportoAttivo])));
  const settembre = col(tariffa(), '2026-09-15');
  verifica('a settembre e\' in arrivo, dal 01/10', !settembre.oggi.length && settembre.in_arrivo.length === 1 && settembre.in_arrivo[0].dal === '2026-10-01', J(settembre));
  verifica('a gennaio 2027 e\' concluso: niente', J(col(tariffa(), '2027-01-10')) === J({ oggi: [], in_arrivo: [] }));
  verifica('una tariffa finita a settembre non mostra il surplus di ottobre', J(col(tariffa({ data_fine_validita: '2026-09-30' }))) === J({ oggi: [], in_arrivo: [] }));
  verifica('una tariffa del 2027 non mostra il surplus del 2026', J(col(tariffa({ data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' }))) === J({ oggi: [], in_arrivo: [] }));
  verifica('una tariffa disattivata: niente', J(col(tariffa({ stato: 'non_attivo' }))) === J({ oggi: [], in_arrivo: [] }));
  const conAccordo = [...FUEL, accordoGatim];
  const g = col(tariffa({ fornitore_id: 'x', fornitore_nome: 'GATIM S.R.L.' }), '2026-10-20', conAccordo);
  verifica('Gatim: due pastiglie, l\'accordo e il Fuel Surcharge, in ordine di nome', J(g.oggi.map(v => `${v.nome} ${v.euro_t} ${v.a_chi}`)) === J(['Accordo Gatim 2 elenco', 'Fuel Surcharge 5 tutti']), J(g));
  verifica('Emmesse solo il Fuel Surcharge', col(tariffa(), '2026-10-20', conAccordo).oggi.length === 1);
}

console.log('8. STATO, PERIODO, ETICHETTA, MESI');
{
  const s = fuel('RETE');
  verifica('in arrivo, in corso, concluso, disattivato',
    M.statoSurplus(s, '2026-09-30') === 'in_arrivo' && M.statoSurplus(s, '2026-10-01') === 'in_corso' && M.statoSurplus(s, '2026-12-31') === 'in_corso'
    && M.statoSurplus(s, '2027-01-01') === 'concluso' && M.statoSurplus(spento, '2026-10-15') === 'disattivato');
  verifica('lo stato si legge sul giorno italiano anche da un istante', M.statoSurplus(s, '2026-09-30T22:30:00.000Z') === 'in_corso');
  verifica('l\'etichetta per note e fogli', M.etichettaSurplus(s) === 'Fuel Surcharge (consorzio Ecotyre), dal 01/10/2026 al 31/12/2026', M.etichettaSurplus(s));
  verifica('di un accordo commerciale', M.etichettaSurplus(accordoGatim) === 'Accordo Gatim (accordo commerciale), dal 15/10/2026 al 31/12/2026', M.etichettaSurplus(accordoGatim));
  verifica('il periodo', M.periodoSurplus(s) === 'dal 01/10/2026 al 31/12/2026' && M.periodoSurplus({ data_fine_validita: '2026-12-31' }) === 'fino al 31/12/2026');
  verifica('gli euro a tonnellata all\'italiana', M.testoEuroT(5) === '5,00 €/t' && M.testoEuroT(1234.5) === '1.234,50 €/t' && M.testoEuroT(2.125) === '2,125 €/t' && M.testoEuroT(null) === '');
  verifica('i mesi del Fuel Surcharge: ottobre, novembre, dicembre 2026', J(M.mesiDelSurplus(s)) === J([{ anno: 2026, mese: 10 }, { anno: 2026, mese: 11 }, { anno: 2026, mese: 12 }]), J(M.mesiDelSurplus(s)));
  verifica('senza date nessun mese', J(M.mesiDelSurplus({ data_inizio_validita: '2026-10-01' })) === '[]');
  const tutti = [...FUEL, accordoGatim, spento];
  verifica('i surplus di settembre: nessuno', M.surplusNelPeriodo(tutti, '2026-09-01', '2026-09-30').length === 0);
  verifica('quelli di ottobre: i tre canali del Fuel Surcharge e l\'accordo, non lo spento',
    J(M.surplusNelPeriodo(tutti, '2026-10-01', '2026-10-31').map(x => x.id)) === J(['acc-gatim', 'fuel-ACI', 'fuel-EXTRA_RACCOLTA', 'fuel-RETE']), J(M.surplusNelPeriodo(tutti, '2026-10-01', '2026-10-31').map(x => x.id)));
  // Chi calcola un mese ne scrive la fine `${anno}-${mm}-31` anche nei mesi di 30
  // giorni (passivaCalcolo e attivaCalcolo, per disattivateNelPeriodo). Come
  // testo e' la fine del mese; letto come data non e' un giorno, e prima del
  // 13/10/2026 diventava un estremo aperto: a settembre risultava in corso il
  // Fuel Surcharge di ottobre, a novembre un surplus del 2027.
  const del2027 = fuel('RETE', { id: 'fuel-2027', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-03-31' });
  const ids = (dal, al, quali = tutti) => J(M.surplusNelPeriodo(quali, dal, al).map(x => x.id));
  verifica('settembre scritto fino al 31: nessun surplus, come col 30', ids('2026-09-01', '2026-09-31') === '[]', ids('2026-09-01', '2026-09-31'));
  verifica('giugno e febbraio scritti fino al 31: il Fuel Surcharge non li tocca',
    !M.surplusTocca(fuel('RETE'), '2026-06-01', '2026-06-31') && ids('2026-02-01', '2026-02-31', FUEL) === '[]', ids('2026-02-01', '2026-02-31', FUEL));
  verifica('novembre 2026 scritto fino al 31: il Fuel Surcharge si, il surplus del 2027 no',
    ids('2026-11-01', '2026-11-31', [...FUEL, del2027]) === J(['fuel-ACI', 'fuel-EXTRA_RACCOLTA', 'fuel-RETE']), ids('2026-11-01', '2026-11-31', [...FUEL, del2027]));
  verifica('il Fuel Surcharge tocca dicembre fino al 31, non gennaio 2027',
    M.surplusTocca(fuel('RETE'), '2026-12-01', '2026-12-31') && !M.surplusTocca(fuel('RETE'), '2027-01-01', '2027-01-31'));
  verifica('un estremo del periodo e\' aperto solo se e\' vuoto',
    M.surplusTocca(fuel('RETE'), '2026-12-15', '') && M.surplusTocca(fuel('RETE'), '', '2026-10-01')
    && !M.surplusTocca(fuel('RETE'), '2027-01-01', '') && !M.surplusTocca(fuel('RETE'), '', '2026-09-30'));
  verifica('i nomi di canali, prestazioni e destinatari per le pagine', M.NOMI_CANALE.EXTRA_RACCOLTA === 'Extra raccolta' && M.DESTINATARI.RACCOLTA === 'raccoglitori' && M.NOMI_ORIGINE.CONSORZIO === 'consorzio Ecotyre');
}

console.log('9. LO SPECCHIO DELLE PAGINE DICE LE STESSE COSE');
{
  const tutti = [...FUEL, accordoGatim, contributoTrattamento, spento];
  const chiamate = (X) => J([
    X.surplusValeIl(fuel('RETE'), '2026-09-30T22:30:00.000Z'), X.surplusValeIl(fuel('RETE'), '2026-12-31T23:30:00.000Z'),
    X.valePerFornitore(accordoGatim, { nomi: ['GA.TIM. S.R.L.'] }),
    X.surplusDelMovimento(tutti, { tipologia: 'RETE', prestazione: 'RACCOLTA', quando: '2026-10-20T10:00:00Z', fornitore: { nomi: ['GATIM'] } }, 'PASSIVA').map(x => [x.surplus.id, x.euro_t]),
    X.surplusDelMovimento(tutti, { tipologia: 'RETE', quando: '2026-10-20T10:00:00Z' }, 'ATTIVA').map(x => [x.surplus.id, x.euro_t]),
    X.importoSurplus(103, 85), X.importoSurplus(1120240, 5),
    X.controlliSurplus({ ...fuel('RETE'), euro_t_passiva: 60, data_fine_validita: '2027-01-15' }),
    (() => { const r = X.conflittiSurplus({ ...fuel('RETE'), id: 'n', data_inizio_validita: '2026-11-01' }, tutti); return [r.conflitti.map(x => x.id), r.chiudibili.map(x => x.id), r.avvisi.map(x => x.messaggio)]; })(),
    X.surplusDellaTariffa({ direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_nome: 'GATIM S.R.L.', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' }, tutti, '2026-10-20'),
    X.statoSurplus(fuel('RETE'), '2026-09-30'), X.etichettaSurplus(accordoGatim), X.mesiDelSurplus(fuel('RETE')), X.giornoPrimaDi('2026-03-01'),
    X.surplusNelPeriodo(tutti, '2026-09-01', '2026-09-31').map(x => x.id), X.surplusNelPeriodo(tutti, '2026-11-01', '2026-11-31').map(x => x.id),
    X.controlliSurplus({ ...fuel('RETE'), euro_t_passiva: 0.004 }).map(e => e.campo),
  ]);
  const a = chiamate(M), b = chiamate(S);
  verifica('le funzioni e le pagine danno le stesse risposte', a === b, `\n    originale: ${a.slice(0, 300)}\n    specchio:  ${b.slice(0, 300)}`);
  verifica('e lo specchio esporta le stesse cose', J(Object.keys(M).sort()) === J(Object.keys(S).sort()), J(Object.keys(S)));
}

console.log('10. L\'ARCHIVIO SurplusTariffa');
{
  const e = JSON.parse(sorgente('../base44/entities/SurplusTariffa.jsonc').split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n'));
  const p = e.properties || {};
  verifica('si chiama SurplusTariffa', e.name === 'SurplusTariffa');
  const CAMPI = ['nome', 'origine', 'riferimento', 'tipologia', 'prestazione', 'a_chi', 'fornitori_json', 'euro_t_passiva', 'euro_t_attiva', 'data_inizio_validita', 'data_fine_validita', 'stato', 'gruppo', 'note'];
  verifica('ha i campi del progetto', CAMPI.every(c => p[c]), CAMPI.filter(c => !p[c]).join(','));
  verifica('un canale per record: RETE, ACI, EXTRA_RACCOLTA, niente TUTTE', J(p.tipologia && p.tipologia.enum) === J(M.CANALI_SURPLUS));
  verifica('le prestazioni sono quelle della tariffa', J(p.prestazione && p.prestazione.enum) === J(M.PRESTAZIONI_SURPLUS));
  verifica('le origini sono quelle che il motore sa dire', J(p.origine && p.origine.enum) === J(Object.keys(M.NOMI_ORIGINE)));
  verifica('gli importi sono numeri, le date giorni', p.euro_t_passiva.type === 'number' && p.euro_t_attiva.type === 'number' && p.data_inizio_validita.format === 'date' && p.data_fine_validita.format === 'date');
  verifica('stato attivo e «tutti» di default', p.stato.default === 'attivo' && J(p.stato.enum) === J(['attivo', 'non_attivo']) && p.a_chi.default === 'tutti' && J(p.a_chi.enum) === J(['tutti', 'elenco']));
  verifica('nome, canale, prestazione e le due date sono obbligatori', ['nome', 'tipologia', 'prestazione', 'data_inizio_validita', 'data_fine_validita'].every(c => (e.required || []).includes(c)), J(e.required));
  const rls = e.rls || {};
  const admin = (k) => rls[k] && rls[k].user_condition && rls[k].user_condition.role === 'admin';
  // Dal 13/10/2026 (decisione dell'utente) lo legge solo l'amministratore: a chi
  // non lo e' la parte attiva la da' la funzione leggiSurplus (prove/chiLeggeCosa.mjs).
  verifica('lo legge e lo scrive solo l\'amministratore', admin('read') && admin('create') && admin('update') && admin('delete'), J(rls));
  const tariffa = JSON.parse(sorgente('../base44/entities/Tariffa.jsonc').split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n'));
  verifica('la scrittura e\' quella della Tariffa, parola per parola', ['create', 'update', 'delete'].every(k => J(rls[k]) === J(tariffa.rls[k])), J(rls));
}

console.log('11. IL SORGENTE USA LE REGOLE CHE CI SONO GIA\'');
{
  const ts = sorgente('../base44/shared/surplus.ts');
  verifica('quando vale e\' la regola delle tariffe (validitaTariffa.ts), non una copia', /import \{[^}]*tariffaValeIl[^}]*\} from "\.\/validitaTariffa\.ts";/.test(ts) && ts.includes('export const surplusValeIl = (s, quando) => tariffaValeIl(s, quando);'));
  verifica('il centesimo e\' quello di Excel (ecotyreTariffe.ts), non un Math.round suo', /import \{ arrotondaAlCentesimo \} from "\.\/ecotyreTariffe\.ts";/.test(ts)
    && /export const importoSurplus = \(kg, euroT\) => arrotondaAlCentesimo\(/.test(ts) && !/Math\.round/.test(ts));
  verifica('i nomi si normalizzano come la passiva e i conflitti delle tariffe', /from "\.\/normalizzaRagioneSociale\.ts"/.test(ts));
  verifica('niente tipi TypeScript: lo specchio e\' lo stesso corpo', !/\)\s*:\s*(string|number|boolean|any)\b/.test(ts) && !/\binterface\s|\btype\s+\w+\s*=/.test(ts));
}

console.log('12. SUI DATI VERI: QUALI TARIFFE TOCCA IL FUEL SURCHARGE');
{
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) {
    console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: questa parte e' saltata.`);
  } else {
    const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8'));
    const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date(DATI.meta.letto_fino_al));
    const tariffe = DATI.archivi.Tariffa || [];
    const toccate = tariffe.filter(t => M.surplusDellaTariffa(t, FUEL, oggi).oggi.length > 0);
    const passive = toccate.filter(t => String(t.direzione || 'PASSIVA') !== 'ATTIVA');
    const attive = toccate.filter(t => t.direzione === 'ATTIVA');
    console.log(`  copia ${copie[copie.length - 1]}, oggi ${oggi}: ${tariffe.length} tariffe, ${toccate.length} col Fuel Surcharge (${passive.length} di raccolta, ${attive.length} attive)`);
    verifica('il Fuel Surcharge tocca 29 tariffe: 22 di raccolta (17 rete, 5 ACI) e 7 attive',
      toccate.length === 29 && passive.length === 22 && attive.length === 7
      && passive.filter(t => t.tipologia === 'RETE').length === 17 && passive.filter(t => t.tipologia === 'ACI').length === 5, `${toccate.length} ${passive.length} ${attive.length}`);
    verifica('tutte di raccolta, nessuna di trattamento, stoccaggio o trasporto', passive.every(t => t.prestazione === 'RACCOLTA'));
    verifica('e su ognuna vale 5,00 €/t, un surplus solo', toccate.every(t => { const c = M.surplusDellaTariffa(t, FUEL, oggi).oggi; return c.length === 1 && c[0].euro_t === 5; }));
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
