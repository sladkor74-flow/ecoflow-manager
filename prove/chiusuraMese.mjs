// LA CHIUSURA DEL MESE, PASSO PASSO (base44/shared/chiusuraMese.ts, migliorie
// dell'11/10/2026).
//
// Il lavoro di fine mese stava in sette moduli e in nessun punto si leggeva che
// un mese e' chiuso. Qui si prova la lista di controllo: quale mese si guarda (a
// gennaio e' il dicembre dell'anno prima, e un dicembre mai chiuso resta anche a
// marzo), che ogni passo legga lo stato che il suo modulo scrive gia', che i
// canali restino separati, che nessun importo esca, e che le dichiarazioni si
// guardino come le aggancia il portale (dal mese piu' vecchio) e non come
// «settembre e' dichiarato».
//
// Le dichiarazioni passano dalla fotografia vera del guardiano
// (fotografiaDelGiorno e leggiFotografia di indicatoriGiorno.ts) coi numeri del
// 10/10/2026: Irigom 652,84 t da dichiarare, T-Cycle 364,80 t con le navi di
// marzo e giugno, Tecnogum che la rete non la dichiara.
//
// La revisione delle migliorie (11/10/2026) ha aggiunto i casi che passavano
// a vuoto: l'esportazione di prova legata al documento (documento_ids pieno,
// come la registra l'interfaccia), l'ACI con una provenienza caricata e l'altra
// no, il mese scritto e non caricato prima dell'ultimo caricato, il mese di soli
// metalli di Irigom, l'extra raccolta elaborata prima dei suoi movimenti, e un
// anno passato giudicato con la fotografia dell'anno in corso.
// L'ultimo giro (12/10/2026): il primo mese chiuso nel gestionale e' fisso,
// settembre 2026 (PRIMO_MESE_DEL_GESTIONALE). Prima, senza nessun fatto scritto,
// era «il mese che si chiude adesso» e scivolava col calendario: dal 01/11/2026
// settembre mai congelato diventava «non serve».
// Giro K8 (12/10/2026): i mesi fatturati prima del gestionale (gennaio-agosto
// 2026) si segnano chiusi, decisione dell'utente dell'11/10/2026. Qui le regole
// pure: il piano mese per mese e canale per canale (pianoMesiChiusiFuori), che
// cosa si scrive (patchChiusoFuori, rigaStoricoChiusoFuori), e che dopo la
// chiusura del mese li legga chiusi; la funzione intera, sui dati veri, in
// prove/mesiChiusiFuori.mjs. npm run prove
import * as C from '../base44/shared/chiusuraMese.ts';
import { fotografiaDelGiorno, leggiFotografia } from '../base44/shared/indicatoriGiorno.ts';
import { freschezzaArchivi } from '../base44/shared/cruscotto.ts';
import { finoAlPerTipo } from '../base44/shared/statoArchivi.ts';
import { normalizzaRagioneSociale } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const SETTEMBRE = C.periodoDelMese(2026, 8);
const passo = (r, chiave) => r.passi.find(p => p.chiave === chiave);

console.log('QUALE MESE SI GUARDA');
{
  const m = (oggi, anno, mese) => C.meseDaChiudere({ oggi, anno, mese });
  verifica('l\'11/10/2026 si chiude settembre', m('2026-10-11').periodo.etichetta === 'Settembre 2026');
  // Il difetto di statoMesiAttiva: il 15 gennaio contava mese - 2 sull'anno in
  // corso e restava senza mesi. Qui e' il dicembre dell'anno prima.
  const gennaio = m('2027-01-15', 2027);
  verifica('il 15/01/2027 si chiude dicembre 2026, anche scegliendo il 2027', gennaio.periodo && gennaio.periodo.etichetta === 'Dicembre 2026', JSON.stringify(gennaio));
  verifica('un anno passato si guarda dal suo dicembre', m('2026-10-11', 2025).periodo.etichetta === 'Dicembre 2025');
  const futuro = m('2026-10-11', 2027);
  verifica('un anno senza mesi finiti non ha niente da chiudere, e lo dice', futuro.periodo === null && /non ha ancora un mese finito/.test(futuro.perche));
  verifica('un mese non ancora finito non si chiude', /non è ancora finito/.test(m('2026-10-11', 2026, 'Ottobre').errore || ''));
  verifica('il mese si chiede col nome o col numero', m('2026-10-11', 2026, 'agosto').periodo.mese === 'Agosto' && m('2026-10-11', 2026, 8).periodo.mese === 'Agosto');
  verifica('un mese sconosciuto si rifiuta', /non riconosciuto/.test(m('2026-10-11', 2026, 'Brumaio').errore || ''));
  verifica('settembre va dall\'1 al 30', SETTEMBRE.inizio === '2026-09-01' && SETTEMBRE.fine === '2026-09-30' && SETTEMBRE.numero === 9);
}

console.log('LE SETTIMANE DELLA QUADRATURA');
{
  const s = (a, i) => C.settimaneDelMese(C.periodoDelMese(a, i)).map(w => w.settimana).join(',');
  verifica('settembre 2026: dalla 36 (31/08-06/09) alla 40 (28/09-04/10)', s(2026, 8) === '36,37,38,39,40', s(2026, 8));
  const w40 = C.settimaneDelMese(SETTEMBRE).find(w => w.settimana === 40);
  verifica('la settimana a cavallo dice i suoi giorni interi', w40.lunedi === '2026-09-28' && w40.domenica === '2026-10-04');
  verifica('dicembre 2026 arriva alla 53, ferma al 31/12', s(2026, 11) === '49,50,51,52,53' && C.settimaneDelMese(C.periodoDelMese(2026, 11)).pop().domenica === '2026-12-31');
  verifica('gennaio 2027 non chiede l\'1-3, che la numerazione ISO da\' al 2026', s(2027, 0) === '1,2,3,4', s(2027, 0));
  verifica('dicembre 2025 non chiede il 29-31, che sono della settimana 1 del 2026', s(2025, 11) === '49,50,51,52', s(2025, 11));
}

console.log('DATI DEL MESE COMPLETI');
{
  // Il registro e il «fino al» passano dalla regola vera della dashboard.
  const fres = (logs, finoAl) => freschezzaArchivi(logs, '2026-10-20', Date.UTC(2026, 9, 20, 10), C.FILE_DEL_MESE, finoAlPerTipo(finoAl));
  const log = (tipo, giorno, esito = 'successo') => ({ tipo_file: tipo, esito, created_date: `${giorno}T08:00:00`, nome_file: `${tipo}.xlsx` });
  const fino = (g) => [{ entita: 'PrimariaRete', tipo_file: 'primarie', dati_fino_al: g, cosa: 'ultima fine trasporto dei terminati' }];
  const verifica30 = C.passoDati({ periodo: SETTEMBRE, oggi: '2026-10-20', freschezza: fres([log('primarie', '2026-10-13'), log('secondarie', '2026-10-13')], fino('2026-10-12')) });
  verifica('il termine dei formulari partiti il 30/09/2026 e\' il 12/10 (domeniche escluse)', verifica30.scadenza === '2026-10-12', verifica30.scadenza);
  verifica('caricati dopo il termine, coi dati oltre la fine del mese: fatto', verifica30.stato === 'fatto', JSON.stringify(verifica30.voci));
  const presto = C.passoDati({ periodo: SETTEMBRE, oggi: '2026-10-11', freschezza: fres([log('primarie', '2026-10-09'), log('secondarie', '2026-10-09')], fino('2026-10-08')) });
  verifica('caricati il 9/10: il mese si da\' per completo dal 12/10', presto.stato === 'da_fare' && presto.dal === '2026-10-12' && /12\/10\/2026/.test(presto.dettaglio), JSON.stringify(presto));
  const corto = C.passoDati({ periodo: SETTEMBRE, oggi: '2026-10-20', freschezza: fres([log('primarie', '2026-10-15'), log('secondarie', '2026-10-15')], fino('2026-09-25')) });
  verifica('primarie che si fermano prima della fine del mese: settembre non c\'e\' tutto', corto.stato === 'da_fare' && corto.voci.some(v => v.stato === 'da_fare' && /25\/09\/2026/.test(v.testo) && /non c'è tutto/.test(v.testo)));
  const rotto = C.passoDati({ periodo: SETTEMBRE, oggi: '2026-10-20', freschezza: fres([
    { tipo_file: 'primarie', esito: 'in_corso', modalita: 'sostituzione', created_date: '2026-10-19T08:00:00' },
    log('primarie', '2026-10-13'), log('secondarie', '2026-10-13')], fino('2026-10-12')) });
  verifica('una riscrittura delle primarie rimasta a meta\' rende il mese non completo', rotto.stato === 'da_fare' && /Primarie/.test(rotto.voci[0].testo), JSON.stringify(rotto.voci));
  const senzaSec = C.passoDati({ periodo: SETTEMBRE, oggi: '2026-10-20', freschezza: fres([log('primarie', '2026-10-13')], fino('2026-10-12')) });
  verifica('le secondarie mai caricate si dicono', senzaSec.stato === 'da_fare' && senzaSec.voci.some(v => /^Secondarie/.test(v.testo)));
}

console.log('TERMINATI DEL MESE A POSTO');
{
  const pulito = C.passoTerminati({ periodo: SETTEMBRE, alert: [{ regola_id: 'scostamento_target', severita: 'critico' }], eseguiti: {} });
  verifica('senza alert delle date ne\' eseguiti: fatto (gli altri alert non c\'entrano)', pulito.stato === 'fatto');
  const conDate = C.passoTerminati({ periodo: SETTEMBRE, alert: [{ regola_id: 'date_obbligatorie_rete', modulo: 'primarie_rete', quanti: 3, senza_fine: 1 }], eseguiti: {} });
  verifica('un alert delle date apre il passo, con quanti ordini e quanti senza fine trasporto', conDate.stato === 'da_fare' && /3 ordini terminati/.test(conDate.voci[0].testo) && /1 senza fine trasporto/.test(conDate.voci[0].testo) && conDate.link === '/primarie-rete');
  verifica('e dice che l\'alert non sa il mese, e che i senza fine possono essere di settembre', /possono essere proprio di settembre/.test(conDate.dettaglio));
  // Il caso vero del 02/10/2026: due ritiri di Torres del 30 settembre, 11.700 kg, rimasti «eseguito».
  const torres = [
    // 22:30Z del 31/08 e' l'1/09 alle 00:30 in Italia: settembre, non agosto.
    { id_ordine: 'ET26100001', stato: 'eseguito', trasporto_finito_il: '2026-08-31T22:30:00Z', peso_effettivo: 5200 },
    { id_ordine: 'ET26100002', stato: 'eseguito', trasporto_finito_il: '2026-09-30T08:00:00Z', peso_effettivo: 6500 },
    { id_ordine: 'ET26080003', stato: 'eseguito', trasporto_finito_il: '2026-08-10T08:00:00Z', peso_effettivo: 3620 },
  ];
  const es = C.passoTerminati({ periodo: SETTEMBRE, alert: [], eseguiti: { primarieRete: torres } });
  const v = es.voci.find(x => /Primarie rete/.test(x.testo));
  verifica('gli eseguiti del mese si contano sul giorno italiano (22:30Z del 31/08 e\' l\'1/09)', es.stato === 'da_fare' && v && /2 ordini rimasti/.test(v.testo) && /11\.700 kg/.test(v.testo), JSON.stringify(es.voci));
  verifica('quello di agosto non e\' di settembre: si dice a parte', es.voci.some(x => x.stato === 'info' && /1 altro ordine/.test(x.testo)));
  const agosto = C.passoTerminati({ periodo: C.periodoDelMese(2026, 7), alert: [], eseguiti: { primarieRete: torres } });
  verifica('e ad agosto e\' uno, 3.620 kg', agosto.voci.some(x => /1 ordine rimasto/.test(x.testo) && /3\.620 kg/.test(x.testo)));
  const sec = C.passoTerminati({ periodo: SETTEMBRE, alert: [], eseguiti: { secondarie: [
    { id_ordine: 'S1', stato: 'eseguito', trasporto_finito_il: '2026-09-10T08:00:00Z', peso_effettivo: 1000, classe: '.class9' },
    { id_ordine: 'S2', stato: 'eseguito', trasporto_finito_il: '2026-09-10T08:00:00Z', peso_effettivo: 2000, classe: '.class1' },
  ] } });
  verifica('secondarie di rete e ACI restano due voci, mai sommate', sec.voci.filter(x => /^Secondarie rete: 1 ordine/.test(x.testo) || /^Secondarie ACI: 1 ordine/.test(x.testo)).length === 2, JSON.stringify(sec.voci));
}

console.log('DICHIARAZIONI: COME LE AGGANCIA IL PORTALE, NON «SETTEMBRE DICHIARATO»');
{
  // I siti come li calcola riepilogoDichiarazioni, passati dalla fotografia vera.
  const sito = (p) => ({ sito: 'X', chiave: 'x', tipo_destinazione: 'imp', dichiara_rete: true, giacenza_portale_t: 0, giacenza_calcolata_t: 0, scarto_t: 0, quadra: true, giacenze_canale: [], flussi: [], ...p });
  const SITI = [
    sito({ sito: 'Irigom S.r.l.', giacenze_canale: [{ canale: 'RETE', giacenza_t: 652.84, entrato_t: 3545.16, dichiarato_caricato_t: 3277.68 }], flussi: [{ canale: 'RETE', resta_t: 652.84, uscito_t: 2892.32 }] }),
    sito({ sito: 'Irigom S.r.l.', tipo_destinazione: 'stoc', giacenza_portale_t: 20 }),
    sito({ sito: 'T-CYCLE INDUSTRIES SRL', giacenze_canale: [{ canale: 'RETE', giacenza_t: 364.8, entrato_t: 707.44, dichiarato_caricato_t: 342.64 }], flussi: [{ canale: 'RETE', resta_t: 364.8, uscito_t: 342.64 }] }),
    sito({ sito: 'GATIM SRL', giacenze_canale: [{ canale: 'RETE', giacenza_t: 122.17, entrato_t: 1400, dichiarato_caricato_t: 1277.83 }, { canale: 'ACI', giacenza_t: 0, entrato_t: 154.22, dichiarato_caricato_t: 154.22 }],
      flussi: [{ canale: 'RETE', resta_t: 122.17, uscito_t: 1277.83 }, { canale: 'ACI', provenienza: 'primaria', resta_t: 0, uscito_t: 154.22 }] }),
    sito({ sito: 'GREEN TYRE PROJECT SRL', giacenze_canale: [{ canale: 'RETE', giacenza_t: 105.74, entrato_t: 900, dichiarato_caricato_t: 794.26 }], flussi: [{ canale: 'RETE', resta_t: 105.74, uscito_t: 794.26 }] }),
    sito({ sito: 'T.R.S.  SRL', giacenze_canale: [{ canale: 'RETE', giacenza_t: 0, entrato_t: 300, dichiarato_caricato_t: 300 }], flussi: [{ canale: 'RETE', resta_t: 0, uscito_t: 300 }] }),
    sito({ sito: 'TECNOGUM SRL', dichiara_rete: false, giacenza_portale_t: null,
      giacenze_canale: [{ canale: 'RETE', giacenza_t: 1833.43, entrato_t: 1833.43, dichiarato_caricato_t: 0, non_dovuta: true }, { canale: 'ACI', giacenza_t: 0, entrato_t: 80, dichiarato_caricato_t: 80 }],
      flussi: [{ canale: 'RETE', resta_t: 1833.43, non_dovuta: true }, { canale: 'ACI', provenienza: 'secondaria', resta_t: 0, uscito_t: 80 }] }),
    sito({ sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', giacenza_portale_t: 34.96 }),
  ];
  const foto = leggiFotografia(fotografiaDelGiorno(SITI, { giorno: '2026-10-11', anno: 2026 }));
  const dich = (sito, canale, mese, q, extra = {}) => ({ sito, canale, provenienza: '', anno: 2026, mese, quantita_kg: q, caricata_inviata: true, ...extra });
  const DICH = [
    // GATIM: dichiara ogni mese, caricata fino ad agosto.
    ...['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto'].map(m => dich('Gatim', 'RETE', m, 150000)),
    // T-CYCLE: le navi di marzo e giugno (09/10/2026).
    dich('T-CYCLE INDUSTRIES SRL', 'RETE', 'Marzo', 200000), dich('T-CYCLE INDUSTRIES SRL', 'RETE', 'Giugno', 142640),
    // GREEN TYRE: settembre arrivata via email, non ancora caricata a portale.
    ...['Luglio', 'Agosto'].map(m => dich('GREEN TYRE PROJECT SRL', 'RETE', m, 200000)),
    dich('GREEN TYRE PROJECT SRL', 'RETE', 'Settembre', 105740, { caricata_inviata: false, ricevuta_email: true }),
    // IRIGOM: la pratica di settembre e' registrata, la dichiarazione non ancora caricata.
    dich('Irigom S.r.l.', 'RETE', 'Settembre', 300000, { caricata_inviata: false, ricevuta_email: true }),
    // TECNOGUM: l'ACI di settembre caricata.
    dich('TECNOGUM SRL', 'ACI', 'Settembre', 6640, { provenienza: 'secondaria' }),
  ];
  const PRATICHE = [{ anno: 2026, mese: 'Settembre', stato: 'registrata', versione: 1 }];
  const d = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto, dichiarazioni: DICH, pratiche: PRATICHE, chiaveDi: normalizzaRagioneSociale });
  const di = (re) => d.voci.find(v => re.test(v.testo));
  verifica('il passo e\' da fare, e si apre sulle dichiarazioni del periodo', d.stato === 'da_fare' && /\/dichiarazioni-impianti\?tab=/.test(d.link));
  const gatim = di(/^GATIM SRL, rete/);
  verifica('GATIM: l\'ultima caricata e\' di agosto, settembre non c\'e\', restano 122,17 t', gatim && gatim.stato === 'da_fare' && gatim.testo === 'GATIM SRL, rete: l\'ultima dichiarazione caricata a portale è di agosto; restano da dichiarare 122,17 t.', gatim && gatim.testo);
  const tc = di(/^T-CYCLE/);
  verifica('T-CYCLE: l\'ultima nave e\' di giugno; restano 364,80 t', tc && tc.stato === 'da_fare' && /caricata a portale è di giugno; restano da dichiarare 364,80 t\./.test(tc.testo), tc && tc.testo);
  verifica('i mesi senza una riga non si dicono «mancanti»: quali abbiano avuto conferimenti qui non si sa', tc && !/aprile|maggio|luglio|agosto|settembre/.test(tc.testo));
  const gt = di(/^GREEN TYRE/);
  verifica('GREEN TYRE: settembre c\'e\' ma e\' solo ricevuta: da caricare', gt && gt.stato === 'da_fare' && /di agosto; settembre ha la dichiarazione scritta, da caricare; restano da dichiarare 105,74 t\./.test(gt.testo), gt && gt.testo);
  const iri = di(/^Irigom S\.r\.l\., rete/);
  verifica('IRIGOM: si guarda la pratica del mese, registrata ma non caricata', iri && iri.stato === 'da_fare' && /pratica di settembre registrata, la dichiarazione è da caricare/.test(iri.testo) && /tab=irigom/.test(iri.link));
  verifica('TECNOGUM: la rete non e\' dovuta e non si chiede; l\'ACI, tutta dichiarata, nemmeno', !di(/^TECNOGUM SRL, rete/) && !di(/^TECNOGUM SRL, ACI/));
  verifica('T.R.S. non ha niente da dichiarare, e gli stoccaggi non dichiarano', !di(/^T\.R\.S/) && !di(/NAPPI/) && d.voci.filter(v => /^Irigom/.test(v.testo)).length === 1);
  verifica('GATIM ACI, a zero, non si chiede', !di(/^GATIM SRL, ACI/));
  verifica('la sintesi conta gli impianti, non un mese', d.manca && /le dichiarazioni di 4 impianti/.test(d.manca.cosa), JSON.stringify(d.manca));
  verifica('e il dettaglio dice di che notte e\' il resto', /controllo notturno del 11\/10\/2026/.test(d.dettaglio));
  // Tutto caricato: il resto di T-Cycle e' giacenza, non un passo da fare.
  const tutto = [...DICH.map(x => ({ ...x, caricata_inviata: true })),
    dich('GATIM SRL', 'RETE', 'Settembre', 122170), ...['Luglio', 'Agosto', 'Settembre'].map(m => dich('T-CYCLE INDUSTRIES SRL', 'RETE', m, 1000))];
  const fatto = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto, dichiarazioni: tutto, pratiche: PRATICHE, chiaveDi: normalizzaRagioneSociale });
  verifica('tutto dichiarato fino a settembre: fatto, anche se resta giacenza', fatto.stato === 'fatto' && fatto.voci.some(v => /T-CYCLE.*dichiarazioni caricate fino a settembre; restano da dichiarare 364,80 t/.test(v.testo)), JSON.stringify(fatto.voci.map(v => v.testo)));
  // Se la fotografia porta i mesi aperti, si dicono quelli.
  const conMesi = { giorno: '2026-10-11', siti: [{ sito: 'GATIM SRL', ruolo: 'imp', dichiara_rete: true, canali: { RETE: { resta_t: 122.17, mesi_aperti: [{ mese: 'Agosto', da_dichiarare_t: 10 }, { mese: 'Settembre', da_dichiarare_t: 112.17 }] } } }] };
  const esatti = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: conMesi, dichiarazioni: DICH, chiaveDi: normalizzaRagioneSociale });
  verifica('con i mesi aperti nella fotografia: manca settembre; agosto, caricato, ha solo un resto', /: settembre non è ancora dichiarato a portale; restano da dichiarare 122,17 t, anche di agosto\./.test(esatti.voci[0].testo) && esatti.voci[0].stato === 'da_fare', esatti.voci[0].testo);
  // IL FOGLIO VERO (Gestione Ecotyre 2026 NEW, DICHIARAZIONI, 09/10/2026): GATIM
  // rete caricata da gennaio a maggio, giugno 112.240 e settembre 122.170 scritti
  // e non caricati, luglio e agosto a zero perche' non e' arrivato niente. Il
  // conto non deve dire che luglio e agosto mancano.
  const vero = [...['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio'].map(m => dich('GATIM SRL', 'RETE', m, 70000)),
    dich('GATIM SRL', 'RETE', 'Giugno', 112240, { caricata_inviata: false }), dich('GATIM SRL', 'RETE', 'Settembre', 122170, { caricata_inviata: false })];
  const fotoGatim = { giorno: '2026-10-11', siti: [{ sito: 'GATIM SRL', ruolo: 'imp', dichiara_rete: true, canali: { RETE: { resta_t: 234.41 } } }] };
  const gv = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: fotoGatim, dichiarazioni: vero, chiaveDi: normalizzaRagioneSociale }).voci[0];
  verifica('il foglio vero di GATIM: maggio l\'ultima caricata, giugno e settembre scritti da caricare, luglio e agosto non nominati', gv && gv.testo === 'GATIM SRL, rete: l\'ultima dichiarazione caricata a portale è di maggio; giugno e settembre hanno la dichiarazione scritta, da caricare; restano da dichiarare 234,41 t.', gv && gv.testo);
  const soloResto = { giorno: '2026-10-11', siti: [{ sito: 'T-CYCLE INDUSTRIES SRL', ruolo: 'imp', dichiara_rete: true, canali: { RETE: { resta_t: 30, mesi_aperti: [{ mese: "dall'anno prima", da_dichiarare_t: 30 }] } } }] };
  const resto = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: soloResto, dichiarazioni: [], chiaveDi: normalizzaRagioneSociale });
  verifica('sulla rete la casella dall\'anno prima e\' giacenza, non un mese da dichiarare a parte', resto.stato === 'fatto' && /restano da dichiarare 30,00 t, anche dall'anno prima, la giacenza/.test(resto.voci[0].testo), resto.voci[0] && resto.voci[0].testo);
  const restoAci = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: { giorno: '2026-10-11', siti: [{ sito: 'Gatim', ruolo: 'imp', dichiara_rete: true, canali: { ACI: { resta_t: 30, mesi_aperti: [{ mese: "dall'anno prima", da_dichiarare_t: 30 }] } } }] }, dichiarazioni: [], chiaveDi: normalizzaRagioneSociale });
  verifica('sull\'ACI la stessa casella e\' da dichiarare: niente si aggancia', restoAci.stato === 'da_fare' && /^Gatim, ACI: restano da dichiarare 30,00 t senza una dichiarazione caricata: quelli dall'anno prima\.$/.test(restoAci.voci[0].testo) && !/aggancer/.test(restoAci.voci[0].testo), restoAci.voci[0] && restoAci.voci[0].testo);
  const senzaFoto = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: null, dichiarazioni: DICH });
  verifica('senza la fotografia del guardiano non si da\' niente per fatto', senzaFoto.stato === 'da_fare' && /controllo notturno/.test(senzaFoto.dettaglio));
  const vecchia = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-15', fotografia: { ...foto, giorno: '2026-10-11' }, dichiarazioni: DICH, pratiche: PRATICHE, chiaveDi: normalizzaRagioneSociale });
  verifica('una fotografia di quattro giorni fa lo dice', /non gira da 4 giorni/.test(vecchia.dettaglio));
}

console.log('DICHIARAZIONI: LA REVISIONE DELL\'11/10/2026');
{
  const dich = (sito, canale, provenienza, mese, q, extra = {}) => ({ sito, canale, provenienza, anno: 2026, mese, quantita_kg: q, caricata_inviata: true, ...extra });
  const foto1 = (sito, canali, extra = {}) => ({ giorno: '2026-10-11', anno: 2026, siti: [{ sito, ruolo: 'imp', dichiara_rete: true, canali }], ...extra });
  // L'ACI DI GATIM, DAI DATI VERI: primaria e secondaria si dichiarano a parte.
  // Prima che arrivasse la secondaria di settembre (12.820 kg) la fotografia
  // dava 12,82 t da dichiarare, e la primaria caricata copriva la secondaria.
  const gatimAci = [
    ...['Aprile', 'Maggio', 'Giugno', 'Settembre'].map(m => dich('Gatim', 'ACI', 'primaria', m, 12350)),
    ...['Gennaio', 'Marzo', 'Aprile', 'Maggio'].map(m => dich('Gatim', 'ACI', 'secondaria', m, 11900)),
  ];
  const aci = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto1('Gatim', { ACI: { resta_t: 12.82 } }), dichiarazioni: gatimAci, chiaveDi: normalizzaRagioneSociale });
  const va = aci.voci[0];
  verifica('ACI: la primaria caricata non copre la secondaria che manca, il passo e\' da fare', aci.stato === 'da_fare' && va && va.stato === 'da_fare', va && va.testo);
  verifica('e dice fin dove e\' caricata ogni provenienza', va && va.testo === 'Gatim, ACI: restano da dichiarare 12,82 t senza una dichiarazione caricata; la primaria è caricata fino a settembre e la secondaria è caricata fino a maggio.', va && va.testo);
  verifica('sull\'ACI non si dice che il portale aggancera\': non aggancia niente', !/aggancer/.test(JSON.stringify(aci)) && /Su ACI ed extra raccolta niente si aggancia/.test(aci.dettaglio), aci.dettaglio);
  const scrittaSec = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto1('Gatim', { ACI: { resta_t: 12.82 } }), dichiarazioni: [...gatimAci, dich('Gatim', 'ACI', 'secondaria', 'Settembre', 12820, { caricata_inviata: false, ricevuta_email: true })], chiaveDi: normalizzaRagioneSociale });
  verifica('la secondaria di settembre in mano e non caricata si nomina con la sua provenienza', /; la secondaria di settembre ha la dichiarazione scritta, da caricare\.$/.test(scrittaSec.voci[0]?.testo), scrittaSec.voci[0]?.testo);
  // Coi mesi nella fotografia: un mese ACI aperto manca sempre di qualcosa.
  const conMesiAci = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto1('Gatim', { ACI: { resta_t: 12.82, mesi_aperti: [{ mese: 'Settembre', da_dichiarare_t: 12.82 }] } }), dichiarazioni: gatimAci, chiaveDi: normalizzaRagioneSociale });
  verifica('coi mesi aperti, settembre ACI con la sola primaria caricata resta da fare', conMesiAci.stato === 'da_fare' && conMesiAci.voci[0]?.testo === 'Gatim, ACI: restano da dichiarare 12,82 t senza una dichiarazione caricata: settembre.', conMesiAci.voci[0]?.testo);
  const conProv = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto1('Gatim', { ACI: { resta_t: 12.82, mesi_aperti: [{ mese: 'Settembre', provenienza: 'secondaria', da_dichiarare_t: 12.82 }] } }), dichiarazioni: gatimAci, chiaveDi: normalizzaRagioneSociale });
  verifica('e se la fotografia dice la provenienza, la si dice', /senza una dichiarazione caricata: la secondaria di settembre\.$/.test(conProv.voci[0]?.testo), conProv.voci[0]?.testo);
  const dopo = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto1('Gatim', { ACI: { resta_t: 5, mesi_aperti: [{ mese: 'Ottobre', da_dichiarare_t: 5 }] } }), dichiarazioni: gatimAci, chiaveDi: normalizzaRagioneSociale });
  verifica('un resto ACI tutto di ottobre non apre settembre', dopo.stato === 'fatto' && /niente da dichiarare fino a settembre; restano 5,00 t dei conferimenti arrivati dopo\./.test(dopo.voci[0]?.testo), dopo.voci[0] && dopo.voci[0]?.testo);
  const extra = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto1('Irigom S.r.l.', { EXTRA_RACCOLTA: { resta_t: 0.3 } }), dichiarazioni: [dich('Irigom S.r.l.', 'EXTRA_RACCOLTA', '', 'Luglio', 460)], chiaveDi: normalizzaRagioneSociale });
  verifica('l\'extra raccolta con un resto e\' da fare, e non si aggancia', extra.stato === 'da_fare' && extra.voci[0]?.testo === 'Irigom S.r.l., extra raccolta: restano da dichiarare 0,30 t senza una dichiarazione caricata; l\'ultima dichiarazione caricata è di luglio.', extra.voci[0]?.testo);
  // Primaria e secondaria caricate fino a settembre, e un resto ACI. Senza i
  // mesi nella fotografia non si sa se e' di ottobre o di un mese rimasto senza
  // dichiarazione: sull'ACI niente si aggancia, quindi resta da fare, e il
  // dettaglio dice che quelli di dopo si dichiarano col loro mese (12/10/2026).
  const tutteDue = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto1('Gatim', { ACI: { resta_t: 13.1 } }), dichiarazioni: [...gatimAci, dich('Gatim', 'ACI', 'secondaria', 'Settembre', 12820)], chiaveDi: normalizzaRagioneSociale });
  verifica('ACI caricata fino a settembre su tutte e due le provenienze, con un resto: da fare, dette insieme', tutteDue.stato === 'da_fare' && tutteDue.voci[0]?.testo === 'Gatim, ACI: restano da dichiarare 13,10 t senza una dichiarazione caricata; la primaria e la secondaria sono caricate fino a settembre.' && /quelli arrivati dopo settembre si dichiarano col loro mese/.test(tutteDue.dettaglio), tutteDue.voci[0] && tutteDue.voci[0]?.testo);
  const aciVuota = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto1('Gatim', { ACI: { resta_t: 0 } }), dichiarazioni: gatimAci, chiaveDi: normalizzaRagioneSociale });
  verifica('e un\'ACI senza resto non si chiede', aciVuota.stato === 'fatto' && !aciVuota.voci.length, JSON.stringify(aciVuota.voci));

  // IL MESE SCRITTO PRIMA DELL'ULTIMO CARICATO: giugno in mano (61.000 kg) e
  // settembre caricato. La pagina segna giugno «scritta, da caricare».
  const gatimRete = [...['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio'].map(m => dich('Gatim', 'RETE', '', m, 70000)),
    dich('Gatim', 'RETE', '', 'Giugno', 61000, { caricata_inviata: false }), dich('Gatim', 'RETE', '', 'Settembre', 100000)];
  const buco = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto1('Gatim', { RETE: { resta_t: 161.62 } }), dichiarazioni: gatimRete, chiaveDi: normalizzaRagioneSociale });
  verifica('giugno scritto e settembre caricato: giugno resta da caricare', buco.stato === 'da_fare' && buco.voci[0]?.testo === 'Gatim, rete: l\'ultima dichiarazione caricata a portale è di settembre; giugno ha la dichiarazione scritta, da caricare; restano da dichiarare 161,62 t.', buco.voci[0]?.testo);
  const ottobreScritto = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto1('Gatim', { RETE: { resta_t: 161.62 } }), dichiarazioni: [...gatimRete.filter(d => d.mese !== 'Giugno'), dich('Gatim', 'RETE', '', 'Giugno', 61000), dich('Gatim', 'RETE', '', 'Ottobre', 5000, { caricata_inviata: false })], chiaveDi: normalizzaRagioneSociale });
  verifica('un mese scritto dopo quello che si chiude non lo riapre', ottobreScritto.stato === 'fatto', ottobreScritto.voci[0] && ottobreScritto.voci[0]?.testo);

  // IRIGOM, SETTEMBRE 2026 DAI DATI VERI: solo metalli (99.300 kg di ferro),
  // pratica registrata. A portale non si carica nulla.
  const irigom = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: foto1('Irigom S.r.l.', { RETE: { resta_t: 652.84 } }),
    dichiarazioni: [dich('Irigom S.r.l.', 'RETE', '', 'Settembre', 0, { caricata_inviata: false, motivo_assenza: 'solo_metalli', metalli_kg: 99300 })],
    pratiche: [{ anno: 2026, mese: 'Settembre', stato: 'registrata', versione: 1 }], chiaveDi: normalizzaRagioneSociale });
  verifica('Irigom, mese di soli metalli: fatto, ma non «caricata»', irigom.stato === 'fatto' && /pratica di settembre registrata, di soli metalli ferrosi \(a portale non si carica nulla\)/.test(irigom.voci[0]?.testo) && !/caricata;/.test(irigom.voci[0]?.testo), irigom.voci[0]?.testo);

  // UN ANNO PASSATO NON SI GIUDICA CON LA FOTOGRAFIA DI OGGI. Dicembre 2025
  // riceveva i 337,96 t di Green Tyre del 2026.
  const foto2026 = foto1('GREEN TYRE PROJECT SRL', { RETE: { resta_t: 337.96 } });
  const dic2025 = C.passoDichiarazioni({ periodo: C.periodoDelMese(2025, 11), oggi: '2026-10-11', fotografia: foto2026, dichiarazioni: [], chiaveDi: normalizzaRagioneSociale });
  verifica('dicembre 2025, guardato a ottobre 2026: non serve, e nessun numero del 2026', dic2025.stato === 'non_serve' && !dic2025.voci.length && !/337,96/.test(JSON.stringify(dic2025)) && /dall'anno prima/.test(dic2025.dettaglio), JSON.stringify(dic2025).slice(0, 300));
  // A gennaio si chiude dicembre con la fotografia dell'anno nuovo.
  const fotoGen = { giorno: '2027-01-15', anno: 2027, siti: [{ sito: 'Gatim', ruolo: 'imp', dichiara_rete: true, canali: { RETE: { resta_t: 80, mesi_aperti: [{ mese: "dall'anno prima", da_dichiarare_t: 50 }, { mese: 'Gennaio', da_dichiarare_t: 30 }] } } }] };
  const dicem = (dichiarazioni) => C.passoDichiarazioni({ periodo: C.periodoDelMese(2026, 11), oggi: '2027-01-15', fotografia: fotoGen, dichiarazioni, chiaveDi: normalizzaRagioneSociale });
  const dicFatto = dicem([dich('Gatim', 'RETE', '', 'Novembre', 70000), dich('Gatim', 'RETE', '', 'Dicembre', 70000)]);
  verifica('il 15/01/2027 dicembre 2026 si giudica: caricato fino a dicembre, fatto', dicFatto.stato === 'fatto' && /dichiarazioni caricate fino a dicembre; restano da dichiarare 80,00 t/.test(dicFatto.voci[0]?.testo), dicFatto.voci[0] && dicFatto.voci[0]?.testo);
  const dicManca = dicem([dich('Gatim', 'RETE', '', 'Novembre', 70000)]);
  verifica('e se dicembre non e\' caricato e\' da fare (gennaio 2027 della fotografia non e\' gennaio 2026)', dicManca.stato === 'da_fare' && /l'ultima dichiarazione caricata a portale è di novembre/.test(dicManca.voci[0]?.testo), dicManca.voci[0] && dicManca.voci[0]?.testo);
  const fotoVecchia = C.passoDichiarazioni({ periodo: SETTEMBRE, oggi: '2026-10-11', fotografia: { ...foto2026, anno: 2025, giorno: '2025-12-31' }, dichiarazioni: [], chiaveDi: normalizzaRagioneSociale });
  verifica('una fotografia di un anno prima del mese non dice niente: da fare, senza numeri', fotoVecchia.stato === 'da_fare' && !fotoVecchia.voci.length && /del 2026 non ce n'è ancora una/.test(fotoVecchia.dettaglio), fotoVecchia.dettaglio);
}

console.log('ATTIVA: UN PASSO PER CANALE');
{
  const doc = (tipologia, stato, extra = {}) => ({ id: `d-${tipologia}`, tipo: 'ATTIVA', tipologia, anno: 2026, mese: 'Settembre', stato, numero_voci: 10, data_elaborazione: '2026-10-05T08:00:00Z', ...extra });
  const docs = [
    doc('RETE', 'chiusa', { data_approvazione: '2026-10-06T08:00:00Z', data_esportazione: '2026-10-06T09:00:00Z', fattura_confermata_il: '2026-10-08', fattura_numero: '41/2026' }),
    doc('ACI', 'approvata', { data_approvazione: '2026-10-06T08:00:00Z' }),
    doc('EXTRA_RACCOLTA', 'elaborata', { numero_voci: 0 }),
    doc('ACI', 'elaborata', { superato: true }),
    doc('ACI', 'bozza', { data_elaborazione: '2026-10-09T08:00:00Z' }),
  ];
  const [rete, aci, extra] = C.passiAttiva({ periodo: SETTEMBRE, documenti: docs, prefatture: [{ anno: 2026, mese: 'Settembre', superata: true, caricata_il: '2026-10-04T08:00:00Z' }], esportazioni: [] });
  verifica('rete chiusa: fatto, con il giorno e il numero della fattura', rete.stato === 'fatto' && /08\/10\/2026/.test(rete.dettaglio) && /41\/2026/.test(rete.dettaglio));
  verifica('ACI approvata, la prefattura c\'e\' solo superata: manca la prefattura', aci.stato === 'da_fare' && aci.manca.cosa === 'la prefattura Ecotyre' && aci.manca.canale === 'ACI');
  verifica('il documento superato e la bozza non contano', aci.voci.some(v => /Approvata/.test(v.testo)));
  verifica('extra raccolta senza righe: non serve', extra.stato === 'non_serve' && /niente da fatturare/.test(extra.dettaglio));
  verifica('il collegamento porta canale e periodo', aci.link === '/fatturazione?tab=attiva&anno=2026&mese=Settembre&canale=ACI', aci.link);
  const conPref = C.passiAttiva({ periodo: SETTEMBRE, documenti: docs, prefatture: [{ anno: 2026, mese: 'Settembre', superata: false, caricata_il: '2026-10-07T08:00:00Z' }], esportazioni: [] })[1];
  verifica('con la prefattura, all\'ACI approvata manca l\'esportazione', conPref.manca.cosa === "l'esportazione dell'attiva");
  // Un'esportazione di prova di un documento non ancora approvato non conta,
  // anche legata al documento: AttivaEsportazioni.jsx manda sempre
  // documento_ids: [doc.id], e registraEsportazione scrive la data anche sul
  // documento «elaborata» (il caso vero del 05/10/2026, rete e ACI di settembre).
  const esp = (ids, quando, tipologia = 'ACI') => ({ anno: 2026, mese: 'Settembre', tipologia, direzione: 'ATTIVA', stato: 'completata', documento_ids: ids, data_esportazione: quando });
  const conProva = (esportazioni, extra = {}) => C.passiAttiva({ periodo: SETTEMBRE, documenti: docs.map(d => (d.id === 'd-ACI' && !d.superato && d.stato === 'approvata' ? { ...d, ...extra } : d)), prefatture: [{ anno: 2026, mese: 'Settembre', superata: false }], esportazioni })[1];
  const prova = conProva([esp(['d-ACI'], '2026-10-05T10:00:00Z')], { data_esportazione: '2026-10-05T10:00:00Z' });
  verifica('l\'esportazione di prima dell\'approvazione non conta, anche legata al documento', prova.manca?.cosa === "l'esportazione dell'attiva" && prova.voci.some(v => v.stato === 'da_fare' && /Da esportare dopo l'approvazione/.test(v.testo)), JSON.stringify(prova.voci));
  verifica('ne\' quella di tutto il mese senza documenti', conProva([esp([], '2026-10-05T10:00:00Z', 'TUTTO')]).manca?.cosa === "l'esportazione dell'attiva");
  verifica('quella dopo l\'approvazione si', conProva([esp(['d-ACI'], '2026-10-05T10:00:00Z'), esp(['d-ACI'], '2026-10-06T08:30:00Z')]).manca?.cosa === 'la conferma della fattura');
  verifica('e quella di un altro documento no', conProva([esp(['d-RETE'], '2026-10-07T10:00:00Z')]).manca?.cosa === "l'esportazione dell'attiva");
  const dopo = C.passiAttiva({ periodo: SETTEMBRE, documenti: docs, prefatture: [{ anno: 2026, mese: 'Settembre', superata: false }],
    esportazioni: [{ anno: 2026, mese: 'Settembre', tipologia: 'ACI', direzione: 'ATTIVA', stato: 'completata', documento_ids: ['d-ACI'], data_esportazione: '2026-10-07T10:00:00Z' }] })[1];
  verifica('quella registrata sul documento approvato conta: manca la conferma della fattura', dopo.manca?.cosa === 'la conferma della fattura');
  const nessuno = C.passiAttiva({ periodo: SETTEMBRE, documenti: [], prefatture: [], esportazioni: [] });
  verifica('un mese mai elaborato: manca l\'elaborazione, canale per canale', nessuno.every(p => p.stato === 'da_fare' && p.manca?.cosa === "l'elaborazione dell'attiva"));
  const vecchio = C.passiAttiva({ periodo: SETTEMBRE, documenti: [{ tipo: 'ATTIVA', anno: 2026, mese: 'Settembre', stato: 'chiusa', fattura_confermata_il: '2026-10-01' }] });
  verifica('un documento chiuso senza canale (di prima) chiude tutti e tre', vecchio.every(p => p.stato === 'fatto'));
  const senzaNumero = C.passiAttiva({ periodo: SETTEMBRE, documenti: [doc('EXTRA_RACCOLTA', 'elaborata', { numero_voci: undefined })] })[2];
  verifica('un numero di righe che manca non e\' zero: il canale non diventa «non serve»', senzaNumero.stato === 'da_fare');

  // L'EXTRA RACCOLTA ELABORATA PRIMA DEI SUOI MOVIMENTI (dati veri): il
  // documento di settembre e' del 05/10/2026 con 0 righe, e i cinque ordini
  // «PULIAMO IL MONDO» di settembre erano ancora «assegnato». Chiusi, hanno il
  // loro peso effettivo, e ognuno fa una riga dell'attiva.
  const mov = (fine, extra = {}) => ({ stato: 'terminato', trasporto_finito_il: fine, tipo_movimento: 'primaria', peso_effettivo: 300, ...extra });
  const cinque = [1, 2, 3, 4, 5].map(i => mov(`2026-09-2${i}T08:00:00Z`));
  const vecchio0 = [doc('EXTRA_RACCOLTA', 'elaborata', { numero_voci: 0, data_elaborazione: '2026-10-05T07:24:05Z' })];
  const ex = C.passiAttiva({ periodo: SETTEMBRE, documenti: vecchio0, movimentiExtra: cinque })[2];
  verifica('extra senza righe ma con 5 movimenti finiti nel mese: da rielaborare, non «non serve»', ex.stato === 'da_fare' && ex.manca?.cosa === "la rielaborazione dell'attiva" && /05\/10\/2026 senza righe, ma ora nel mese ci sono 5 movimenti di extra raccolta finiti/.test(ex.voci[0]?.testo), JSON.stringify(ex));
  const exNulla = (movimenti) => C.passiAttiva({ periodo: SETTEMBRE, documenti: vecchio0, movimentiExtra: movimenti })[2].stato;
  verifica('le secondarie, gli assegnati e un movimento che finisce l\'1/10 in Italia non contano', exNulla([mov('2026-09-20T08:00:00Z', { tipo_movimento: 'secondaria' }), mov(null, { stato: 'assegnato' }), mov('2026-09-30T22:30:00Z')]) === 'non_serve');
  verifica('senza l\'archivio letto vale il documento', exNulla(null) === 'non_serve');
  // Un movimento senza peso effettivo non fa righe (calcolaRigheAttiva):
  // rielaborare non basta, e il canale non e' nemmeno «non serve», perche' un
  // peso che manca non e' zero (revisione, 12/10/2026).
  const exSenzaPeso = C.passiAttiva({ periodo: SETTEMBRE, documenti: vecchio0, movimentiExtra: [mov('2026-09-27T08:00:00Z', { peso_effettivo: 0 }), mov('2026-09-28T08:00:00Z', { peso_effettivo: null })] })[2];
  verifica('extra senza righe con 2 movimenti senza peso: manca il peso, non la rielaborazione', exSenzaPeso.stato === 'da_fare' && exSenzaPeso.manca?.cosa === 'il peso effettivo dei movimenti' && exSenzaPeso.voci[0]?.testo === 'Elaborata il 05/10/2026 senza righe: nel mese ci sono 2 movimenti di extra raccolta finiti senza il peso effettivo, che non si fatturano finché il peso non c\'è.', JSON.stringify(exSenzaPeso));
  const exMisto = C.passiAttiva({ periodo: SETTEMBRE, documenti: vecchio0, movimentiExtra: [mov('2026-09-27T08:00:00Z', { peso_effettivo: 0 }), mov('2026-09-28T08:00:00Z')] })[2];
  verifica('uno pesato e uno no: si rielabora, le righe le fa il pesato', exMisto.manca?.cosa === "la rielaborazione dell'attiva" && /c'è 1 movimento di extra raccolta finito: va rielaborata\.$/.test(exMisto.voci[0]?.testo), exMisto.voci[0]?.testo);
  const rielaborato = C.passiAttiva({ periodo: SETTEMBRE, documenti: [doc('EXTRA_RACCOLTA', 'elaborata', { numero_voci: 5, data_elaborazione: '2026-10-16T08:00:00Z' })], movimentiExtra: cinque })[2];
  verifica('rielaborato con le sue 5 righe, il canale fa i suoi passi come gli altri', rielaborato.manca?.cosa === "l'approvazione dell'attiva" && rielaborato.voci[0]?.testo === 'Elaborata il 16/10/2026: 5 righe.', JSON.stringify(rielaborato.voci));

  // UN MESE DI PRIMA DEL GESTIONALE: dicembre 2025, coi documenti da gennaio 2026.
  const gennaio = [doc('RETE', 'elaborata', { mese: 'Gennaio' })];
  const dic = C.passiAttiva({ periodo: C.periodoDelMese(2025, 11), documenti: gennaio, oggi: '2026-10-11' });
  verifica('dicembre 2025, prima del primo documento dell\'attiva: non serve', dic.every(p => p.stato === 'non_serve' && /Prima di gennaio 2026 l'attiva non si elaborava nel gestionale/.test(p.dettaglio)), JSON.stringify(dic.map(p => p.dettaglio)));
  verifica('la regola del primo documento non ha bisogno di oggi', C.passiAttiva({ periodo: C.periodoDelMese(2025, 11), documenti: gennaio }).every(p => p.stato === 'non_serve'));
  // Il punto di partenza e' fisso (12/10/2026): settembre 2026, anche senza oggi.
  const dic0 = C.passiAttiva({ periodo: C.periodoDelMese(2025, 11), documenti: [] });
  verifica('senza documenti dicembre 2025 non si chiede, e il perche\' e\' quello vero', dic0.every(p => p.stato === 'non_serve' && p.dettaglio === 'Il gestionale chiude i mesi da settembre 2026: dicembre 2025 si è chiuso fuori, e la sua fattura non passa di qui.'), JSON.stringify(dic0.map(p => p.dettaglio)));
  verifica('il primo mese del gestionale e\' settembre 2026, scritto una volta', C.PRIMO_MESE_DEL_GESTIONALE && C.PRIMO_MESE_DEL_GESTIONALE.etichetta === 'Settembre 2026');
  verifica('senza nessun documento, il mese che si chiude adesso si chiede', C.passiAttiva({ periodo: SETTEMBRE, documenti: [], oggi: '2026-10-11' }).every(p => p.manca && p.manca?.cosa === "l'elaborazione dell'attiva"));
  verifica('e agosto no: il primo che il gestionale fara\' e\' settembre', C.passiAttiva({ periodo: C.periodoDelMese(2026, 7), documenti: [], oggi: '2026-10-11' }).every(p => p.stato === 'non_serve'));
  // Il confine non va mai oltre settembre: coi documenti solo da ottobre,
  // settembre senza documento resta da elaborare, anche guardato a novembre.
  const daOttobre = [doc('RETE', 'elaborata', { mese: 'Ottobre' })];
  const setOtt = C.passiAttiva({ periodo: SETTEMBRE, documenti: daOttobre, oggi: '2026-11-15' });
  verifica('il primo documento e\' di ottobre: settembre, senza documento, si chiede lo stesso', setOtt.every(p => p.stato === 'da_fare' && p.manca?.cosa === "l'elaborazione dell'attiva"), JSON.stringify(setOtt.map(p => [p.stato, p.dettaglio])));
}

console.log('PASSIVA: CONGELATA E CONSUNTIVI, UN CANALE PER VOLTA, SENZA IMPORTI');
{
  const docs = [{ tipo: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', anno: 2026, mese: 'Settembre', stato: 'elaborata', numero_voci: 0 }];
  const chiusure = [
    { anno: 2026, mese: 9, canale: 'RETE', congelato_il: '2026-10-10T08:00:00Z', congelato_da: 'Antonio', totale_euro: 372976.5 },
    { anno: 2026, mese: 8, canale: 'RETE', congelato_il: '2026-09-29T08:00:00Z' },
  ];
  const cons = (fornitore, ruolo, mese, canale, quadra, extra = {}) => ({ fornitore, ruolo, anno: 2026, mese, canale, quadra, confrontato_il: quadra === undefined ? undefined : '2026-10-01', importo_consuntivo: 8628.88, ...extra });
  const consuntivi = [
    cons('LOGISTICA & PNEUMATICI SRL', 'raccoglitore', 8, 'RETE', true), cons('NAPPI SUD SRL', 'raccoglitore', 8, 'RETE', true), cons('EMMESSE SRL', 'raccoglitore', 8, 'RETE', true),
    cons('LOGISTICA & PNEUMATICI S.R.L.', 'raccoglitore', 9, 'RETE', true), cons('NAPPI SUD SRL', 'raccoglitore', 9, 'RETE', false),
    cons('GATIM SRL', 'impianto', 9, 'ACI', undefined),
  ];
  const [rete, aci, extra] = C.passiPassiva({ periodo: SETTEMBRE, chiusure, consuntivi, documenti: docs, chiaveDi: normalizzaRagioneSociale });
  verifica('rete congelata, ma un consuntivo non quadra e EMMESSE manca rispetto ad agosto', rete.stato === 'da_fare' && rete.voci[0].stato === 'fatto' && /non quadra: NAPPI SUD SRL/.test(rete.voci[1].testo) && /EMMESSE SRL \(raccoglitore\)/.test(rete.voci[1].testo) && rete.manca?.cosa === 'i consuntivi dei fornitori', JSON.stringify(rete.voci));
  verifica('e lo dice in italiano: «ad agosto», «a settembre»', /ad agosto li avevano mandati anche EMMESSE SRL \(raccoglitore\): se hanno lavorato a settembre, il loro manca/.test(rete.voci[1].testo), rete.voci[1].testo);
  verifica('lo stesso fornitore scritto in due modi e\' uno solo (nome normalizzato)', !/LOGISTICA & PNEUMATICI SRL \(raccoglitore\)/.test(rete.voci[1].testo));
  verifica('ACI non congelata: manca il congelamento, che viene prima dei consuntivi', aci.stato === 'da_fare' && aci.manca?.cosa === 'il congelamento della passiva' && aci.link === '/fatturazione?tab=passiva&anno=2026&mese=Settembre&canale=ACI');
  verifica('il consuntivo ACI non ancora confrontato si dice', /da confrontare: GATIM SRL/.test(aci.voci[1].testo));
  verifica('extra raccolta senza movimenti: non serve', extra.stato === 'non_serve');
  const tutto = JSON.stringify([rete, aci, extra]);
  verifica('nessun importo esce: ne\' il congelato ne\' il consuntivo', !/372|976|8\.?628|€|euro/i.test(tutto), tutto.match(/372|976|8\.?628|€|euro/i));
  const luglio = C.passiPassiva({ periodo: C.periodoDelMese(2026, 6), chiusure, consuntivi, documenti: [] });
  verifica('luglio, prima del primo congelamento e del primo consuntivo: non serve', luglio.every(p => p.stato === 'non_serve'), JSON.stringify(luglio.map(p => p.stato)));
  const conMovimenti = C.passiPassiva({ periodo: SETTEMBRE, chiusure, consuntivi, documenti: docs, chiaveDi: normalizzaRagioneSociale, movimentiExtra: [{ stato: 'terminato', trasporto_finito_il: '2026-09-27T00:00:00.000Z', tipo_movimento: 'primaria', peso_effettivo: 300 }] })[2];
  verifica('extra senza righe nel documento ma con un movimento finito nel mese: la passiva serve', conMovimenti.stato === 'da_fare' && conMovimenti.manca?.cosa === 'il congelamento della passiva', JSON.stringify(conMovimenti));
  // Nessun congelamento e nessun consuntivo mai: il primo e' il mese che si chiude adesso.
  const mai = (periodo) => C.passiPassiva({ periodo, chiusure: [], consuntivi: [], documenti: [], oggi: '2026-10-11' });
  verifica('senza nessun congelamento, dicembre 2025 non chiede la passiva', mai(C.periodoDelMese(2025, 11)).every(p => p.stato === 'non_serve'), JSON.stringify(mai(C.periodoDelMese(2025, 11)).map(p => p.voci.map(v => v.testo))));
  verifica('settembre 2026, il mese che si chiude, si', mai(SETTEMBRE).every(p => p.stato === 'da_fare' && p.manca?.cosa === 'il congelamento della passiva'));
  // IL PUNTO DI PARTENZA NON SCIVOLA (12/10/2026). Il rilievo, sulla copia dei
  // dati veri: nessun congelamento mai; il 15/11/2026 settembre, aperto
  // dall'elenco dei mesi, diceva «Prima di ottobre 2026 la passiva non si
  // congelava». Settembre e' il primo mese chiuso nel gestionale.
  const aNovembre = C.passiPassiva({ periodo: SETTEMBRE, chiusure: [], consuntivi: [], documenti: [], oggi: '2026-11-15' });
  verifica('il 15/11/2026, senza nessun congelamento, settembre resta da congelare', aNovembre.every(p => p.voci[0].stato === 'da_fare' && p.manca?.cosa === 'il congelamento della passiva'), JSON.stringify(aNovembre.map(p => p.voci.map(v => v.testo))));
  verifica('e il consuntivo di rete di settembre resta da caricare (non «non si caricavano»)', aNovembre[0].voci[1].stato === 'da_fare' && !/non si caricavano/.test(aNovembre[0].voci[1].testo), aNovembre[0].voci[1].testo);
  verifica('anche il 01/03/2027', C.passiPassiva({ periodo: SETTEMBRE, chiusure: [], consuntivi: [], documenti: [], oggi: '2027-03-01' }).every(p => p.voci[0].stato === 'da_fare'));
  // Il primo congelamento e' quello di ottobre: settembre si chiede lo stesso.
  const soloOttobre = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => ({ anno: 2026, mese: 10, canale: c, congelato_il: '2026-11-03T08:00:00Z' }));
  const dopoOttobre = C.passiPassiva({ periodo: SETTEMBRE, chiusure: soloOttobre, consuntivi: [], documenti: [], oggi: '2026-11-15' });
  verifica('col primo congelamento di ottobre, settembre non diventa «prima di ottobre»', dopoOttobre.every(p => p.voci[0].stato === 'da_fare' && !/Prima di ottobre/.test(JSON.stringify(p))), JSON.stringify(dopoOttobre.map(p => p.voci[0].testo)));
  // Un mese di prima: il perche' vero, senza date che scivolano.
  const agosto0 = C.passiPassiva({ periodo: C.periodoDelMese(2026, 7), chiusure: [], consuntivi: [], documenti: [] });
  verifica('agosto 2026: non serve, perche\' il gestionale chiude i mesi da settembre 2026', agosto0.every(p => p.stato === 'non_serve' && p.voci[0].testo === 'Il gestionale chiude i mesi da settembre 2026: agosto 2026 si è chiuso fuori, e la passiva non si congelava.' && p.voci[1].testo === 'Il gestionale chiude i mesi da settembre 2026: agosto 2026 si è chiuso fuori, e i consuntivi dei fornitori non si caricavano qui.'), JSON.stringify(agosto0.map(p => p.voci.map(v => v.testo))));
  // Un fatto scritto prima di settembre resta il confine, com'era: luglio
  // congelato fa chiedere agosto.
  const daLuglio = C.passiPassiva({ periodo: C.periodoDelMese(2026, 7), chiusure: [{ anno: 2026, mese: 7, canale: 'RETE' }], consuntivi: [], documenti: [] })[0];
  verifica('col primo congelamento di luglio, agosto si congela', daLuglio.voci[0].stato === 'da_fare', JSON.stringify(daLuglio.voci[0]));
}

console.log('QUADRATURE FIR');
{
  const q = (settimana, stato, per_canale, extra = {}) => ({ anno: 2026, settimana, stato, per_canale, avviata_il: `2026-10-0${settimana - 35}T08:00:00Z`, ...extra });
  const piena = [{ canale: 'RETE', conformita: 'piena' }, { canale: 'ACI', conformita: 'piena' }];
  const tutte = [36, 37, 38, 39, 40].map(s => q(s, 'completata', piena));
  verifica('cinque settimane piene: fatto', C.passoQuadrature({ periodo: SETTEMBRE, quadrature: tutte }).stato === 'fatto');
  const parziale = [...tutte.slice(0, 2), q(38, 'completata', [{ canale: 'RETE', conformita: 'parziale', incongruenti: 3 }, { canale: 'ACI', conformita: 'piena' }]), q(39, 'errore', [], { errore: 'pagina illeggibile' })];
  const p = C.passoQuadrature({ periodo: SETTEMBRE, quadrature: parziale });
  verifica('parziale, in errore e mancante sono da fare, ognuna col suo perche\'', p.stato === 'da_fare' && p.voci.some(v => /Settimana 38.*rete \(3 righe non tornano\)/.test(v.testo)) && p.voci.some(v => /Settimana 39.*non è riuscita/.test(v.testo)) && p.voci.some(v => /Settimana 40.*non ancora fatta/.test(v.testo)) && /3 settimane/.test(p.manca.cosa), JSON.stringify(p.voci));
  const rifatta = C.passoQuadrature({ periodo: SETTEMBRE, quadrature: [...tutte, q(38, 'errore', [], { avviata_il: '2026-09-01T08:00:00Z' })] });
  verifica('di due quadrature della stessa settimana vale la piu\' recente', rifatta.stato === 'fatto');
  const agosto = C.passoQuadrature({ periodo: C.periodoDelMese(2026, 7), quadrature: tutte });
  verifica('le settimane prima della prima quadratura non si chiedono', agosto.stato === 'non_serve' || agosto.voci.filter(v => v.stato === 'da_fare').length === 0, JSON.stringify(agosto.voci));
  const nessuna = (periodo) => C.passoQuadrature({ periodo, quadrature: [], oggi: '2026-10-11' });
  verifica('senza nessuna quadratura, dicembre 2025 non le chiede', nessuna(C.periodoDelMese(2025, 11)).stato === 'non_serve');
  verifica('e non dice che sono «cominciate dopo»: il mese si e\' chiuso fuori', nessuna(C.periodoDelMese(2025, 11)).dettaglio === 'Nessuna settimana del mese da quadrare. Il gestionale chiude i mesi da settembre 2026: dicembre 2025 si è chiuso fuori.', nessuna(C.periodoDelMese(2025, 11)).dettaglio);
  verifica('il mese che si chiude adesso si', nessuna(SETTEMBRE).stato === 'da_fare' && nessuna(SETTEMBRE).voci.length === 5);
  // Il confine non scivola (12/10/2026): senza nessuna quadratura, settembre
  // guardato a novembre chiede le sue cinque settimane, e agosto nessuna.
  const aNovembre = C.passoQuadrature({ periodo: SETTEMBRE, quadrature: [], oggi: '2026-11-15' });
  verifica('il 15/11/2026, senza nessuna quadratura, settembre chiede le sue cinque settimane', aNovembre.stato === 'da_fare' && aNovembre.voci.filter(v => v.stato === 'da_fare').length === 5, JSON.stringify(aNovembre.voci));
  const agostoNessuna = C.passoQuadrature({ periodo: C.periodoDelMese(2026, 7), quadrature: [], oggi: '2026-11-15' });
  verifica('e agosto, anche la settimana 36 che comincia il 31/08, non le chiede', agostoNessuna.stato === 'non_serve' && agostoNessuna.voci.every(v => /le quadrature si chiedono da settembre 2026, il primo mese chiuso nel gestionale\.$/.test(v.testo)), JSON.stringify(agostoNessuna.voci));
  // La prima quadratura e' della settimana 37: la 36 (31/08-06/09) si chiede a
  // settembre, che ne ha sei giorni, e non ad agosto, che ne ha uno.
  const da37 = [37, 38, 39, 40].map(s => q(s, 'completata', piena));
  const set37 = C.passoQuadrature({ periodo: SETTEMBRE, quadrature: da37, oggi: '2026-11-15' });
  verifica('prima quadratura la 37: settembre chiede anche la 36', set37.stato === 'da_fare' && set37.voci.some(v => v.stato === 'da_fare' && /^Settimana 36 \(31\/08–06\/09\): non ancora fatta\.$/.test(v.testo)), JSON.stringify(set37.voci));
  const ago37 = C.passoQuadrature({ periodo: C.periodoDelMese(2026, 7), quadrature: da37 });
  verifica('e agosto no', ago37.stato === 'non_serve', JSON.stringify(ago37.voci));
  // Una quadratura di prima di settembre e' il confine, com'era: dalla 33 in poi.
  const ago33 = C.passoQuadrature({ periodo: C.periodoDelMese(2026, 7), quadrature: [q(33, 'completata', piena)] });
  verifica('con la prima quadratura della settimana 33, agosto chiede dalla 34 in poi', ago33.stato === 'da_fare' && ago33.voci.filter(v => v.stato === 'da_fare').map(v => v.testo.slice(0, 12)).join() === 'Settimana 34,Settimana 35,Settimana 36' && ago33.voci.some(v => v.stato === 'non_serve' && /prima della prima quadratura caricata/.test(v.testo)), JSON.stringify(ago33.voci));
}

console.log('IL MESE INTERO E LA SUA RIGA');
{
  const r = C.chiusuraDelMese({ periodo: SETTEMBRE, oggi: '2026-10-11', documenti: [], chiusure: [], consuntivi: [], quadrature: [] });
  verifica('dieci passi: dati, terminati, dichiarazioni, tre attive, tre passive, quadrature', r.passi.length === 10 && r.passi.map(p => p.chiave).join(',') === 'dati,terminati,dichiarazioni,attiva_RETE,attiva_ACI,attiva_EXTRA_RACCOLTA,passiva_RETE,passiva_ACI,passiva_EXTRA_RACCOLTA,quadrature_fir');
  verifica('ogni passo ha stato, perche\' e collegamento', r.passi.every(p => C.STATI_PASSO.includes(p.stato) && p.perche && p.link));
  verifica('la riga dice quanti fatti e che cosa manca, coi canali raggruppati', /^Settembre 2026: \d+ di \d+ fatti, mancano /.test(r.sintesi) && /l'elaborazione dell'attiva \(rete, ACI ed extra raccolta\)/.test(r.sintesi), r.sintesi);
  verifica('il conteggio non conta i passi che non servono', r.conteggio.totale === r.conteggio.fatti + r.conteggio.da_fare);
  const nonLetti = C.chiusuraDelMese({ periodo: SETTEMBRE, oggi: '2026-10-11', documenti: [], non_letti: ['quadrature'], quadrature: [36, 37, 38, 39, 40].map(s => ({ anno: 2026, settimana: s, stato: 'completata', per_canale: [] })) });
  verifica('una lettura non riuscita non lascia un verde falso', passo(nonLetti, 'quadrature_fir').stato === 'da_fare' && passo(nonLetti, 'quadrature_fir').lettura_non_riuscita === true);
  const una = C.sintesiDelMese(SETTEMBRE, [{ stato: 'fatto' }, { stato: 'da_fare', manca: { cosa: 'la prefattura Ecotyre', canale: 'ACI' } }, { stato: 'da_fare', manca: { cosa: 'la prefattura Ecotyre', canale: 'RETE' } }]);
  verifica('«manca» al singolare, e la stessa cosa per due canali si dice una volta', una === 'Settembre 2026: 1 di 3 fatti, manca la prefattura Ecotyre (rete e ACI).', una);
  verifica('tutto fatto: il mese e\' chiuso', C.sintesiDelMese(SETTEMBRE, [{ stato: 'fatto' }, { stato: 'non_serve' }]) === 'Settembre 2026: 1 di 1 fatti, il mese è chiuso.');
}

console.log('I MESI PRIMA ANCORA APERTI, ANCHE DELL\'ANNO PRIMA');
{
  const doc = (anno, mese, tipologia, stato, extra = {}) => ({ tipo: 'ATTIVA', anno, mese, tipologia, stato, numero_voci: 5, ...extra });
  const tre = (anno, mese, stato) => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => doc(anno, mese, c, stato));
  const docs = [
    ...tre(2026, 'Luglio', 'chiusa'),
    // agosto mai elaborato
    ...tre(2026, 'Settembre', 'chiusa'),
    ...tre(2026, 'Ottobre', 'chiusa').map(d => (d.tipologia === 'ACI' ? { ...d, stato: 'esportata' } : d)),
    ...tre(2026, 'Novembre', 'chiusa'),
    ...tre(2026, 'Dicembre', 'elaborata'),
  ];
  const chiusure = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].flatMap(c => [9, 10, 11].map(m => ({ anno: 2026, mese: m, canale: c }))).filter(x => !(x.mese === 10 && x.canale === 'RETE'));
  const gennaio = C.mesiAncoraAperti({ ultimo: C.meseDaChiudere({ oggi: '2027-01-15' }).ultimo, documenti: docs, chiusure });
  const nomi = gennaio.map(m => m.etichetta).join(', ');
  verifica('il 15/01/2027: agosto mai elaborato e ottobre ancora aperto, dicembre e\' il mese da chiudere', nomi === 'Agosto 2026, Ottobre 2026', nomi);
  const ottobre = gennaio.find(m => m.mese === 'Ottobre');
  verifica('ottobre: la chiusura dell\'attiva ACI e il congelamento della passiva rete', ottobre && ottobre.mancano.join(' | ') === "la chiusura dell'attiva (ACI) | il congelamento della passiva (rete)", ottobre && ottobre.mancano.join(' | '));
  verifica('agosto, prima del primo congelamento: solo l\'elaborazione', gennaio[0].mancano.join(' | ') === "l'elaborazione dell'attiva (rete, ACI ed extra raccolta)", gennaio[0].mancano.join(' | '));
  // Il 1° marzo un dicembre mai chiuso spariva dalla dashboard: qui resta.
  const marzo = C.mesiAncoraAperti({ ultimo: C.meseDaChiudere({ oggi: '2027-03-01' }).ultimo, documenti: docs, chiusure });
  verifica('il 01/03/2027 dicembre 2026, mai chiuso, e\' ancora fra i mesi aperti', marzo.some(m => m.etichetta === 'Dicembre 2026'), marzo.map(m => m.etichetta).join(', '));
  verifica('e gennaio 2027, mai elaborato, anche', marzo.some(m => m.etichetta === 'Gennaio 2027'));
  verifica('senza nessun documento non c\'e\' niente da dire', C.mesiAncoraAperti({ ultimo: SETTEMBRE, documenti: [], chiusure }).length === 0);
  // Senza nessun congelamento (la copia vera dell'11/10/2026), dal 01/11/2026
  // settembre e' fra i mesi prima, e il suo congelamento si dice: prima la
  // passiva non entrava mai in elenco finche' non c'era un primo congelamento.
  const daGennaio = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto'].flatMap(m => tre(2026, m, 'chiusa'));
  const novembre = C.mesiAncoraAperti({ ultimo: C.meseDaChiudere({ oggi: '2026-11-15' }).ultimo, documenti: [...daGennaio, ...tre(2026, 'Settembre', 'chiusa')], chiusure: [] });
  verifica('il 15/11/2026, attiva di settembre chiusa e mai congelata: settembre resta aperto per la passiva', novembre.length === 1 && novembre[0].sintesi === 'Settembre 2026: manca il congelamento della passiva (rete, ACI ed extra raccolta).', JSON.stringify(novembre));
  verifica('e gennaio-agosto, chiusi fuori dal gestionale, non chiedono il congelamento', !novembre.some(m => m.anno === 2026 && m.numero < 9));
  // Congelamenti non letti (null): la passiva non si giudica, e un mese con
  // l'attiva chiusa non risulta aperto per un congelamento che forse c'e'
  // (verifica della rifinitura, 12/10/2026).
  const nonLetti = C.mesiAncoraAperti({ ultimo: C.meseDaChiudere({ oggi: '2026-11-15' }).ultimo, documenti: [...daGennaio, ...tre(2026, 'Settembre', 'chiusa')], chiusure: null });
  verifica('congelamenti non letti: nessun mese dice che manca il congelamento', !nonLetti.some(m => /congelamento/.test(m.sintesi || '')), JSON.stringify(nonLetti));
  const conExtra = [...tre(2026, 'Luglio', 'chiusa').map(d => (d.tipologia === 'EXTRA_RACCOLTA' ? { ...d, numero_voci: 0, stato: 'elaborata' } : d)), ...tre(2026, 'Agosto', 'chiusa')];
  const ap = (movimentiExtra) => C.mesiAncoraAperti({ ultimo: SETTEMBRE, documenti: conExtra, chiusure: [], movimentiExtra });
  verifica('luglio con l\'extra senza righe e nessun movimento: chiuso', ap([]).length === 0, JSON.stringify(ap([])));
  const luglioExtra = ap([{ stato: 'terminato', trasporto_finito_il: '2026-07-21T00:00:00.000Z', tipo_movimento: 'primaria', peso_effettivo: 460 }]);
  verifica('con un movimento di luglio arrivato dopo: aperto, da rielaborare', luglioExtra.length === 1 && luglioExtra[0].sintesi === "Luglio 2026: manca la rielaborazione dell'attiva (extra raccolta).", JSON.stringify(luglioExtra));
  // Lo stato si legge come lo legge l'attiva (filtraPeriodo): «Terminato » e' terminato.
  const luglioSenzaPeso = ap([{ stato: 'Terminato ', trasporto_finito_il: '2026-07-21T00:00:00.000Z', tipo_movimento: 'primaria', peso_effettivo: 0 }]);
  verifica('e senza peso: aperto, manca il peso dei movimenti', luglioSenzaPeso.length === 1 && luglioSenzaPeso[0].sintesi === 'Luglio 2026: manca il peso effettivo dei movimenti (extra raccolta).', JSON.stringify(luglioSenzaPeso));
}

console.log('I MESI FATTURATI PRIMA DEL GESTIONALE SI SEGNANO CHIUSI (giro K8, 12/10/2026)');
{
  // Decisione dell'utente dell'11/10/2026: gennaio-agosto 2026, elaborati a
  // posteriori, «si chiudono nel gestionale come se fossero già stati fatti».
  // I documenti come nella copia dei dati veri: tre per mese, «elaborata»,
  // l'extra raccolta a zero righe tranne aprile e luglio.
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto'];
  let n = 0;
  const doc = (mese, tipologia, campi = {}) => ({ id: `d${++n}`, tipo: 'ATTIVA', anno: 2026, mese, tipologia, stato: 'elaborata', superato: false, note: '',
    numero_voci: tipologia === 'EXTRA_RACCOLTA' ? (['Aprile', 'Luglio'].includes(mese) ? 1 : 0) : 300, voci_errore: 0, totale: 123456.78,
    data_elaborazione: mese === 'Gennaio' ? '2026-09-18T15:06:05.613Z' : '2026-10-06T11:21:06.047Z', ...campi });
  const docs = [...MESI, 'Settembre'].flatMap(m => ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map(c => doc(m, c)));
  const extra = [
    { stato: 'terminato', trasporto_finito_il: '2026-04-14T00:00:00.000Z', tipo_movimento: 'primaria', peso_effettivo: 400 },
    { stato: 'terminato', trasporto_finito_il: '2026-07-21T00:00:00.000Z', tipo_movimento: 'primaria', peso_effettivo: 460 },
  ];
  const OGGI = '2026-10-12';
  const ultimo = C.meseDaChiudere({ oggi: OGGI }).ultimo;
  const aperti = C.mesiAncoraAperti({ ultimo, documenti: docs, chiusure: [], movimentiExtra: extra });
  verifica('oggi gennaio-agosto sono aperti, ognuno con prima_del_gestionale', aperti.map(m => m.mese).join(',') === MESI.join(',') && aperti.every(m => m.prima_del_gestionale === true), JSON.stringify(aperti));
  const novembre = C.mesiAncoraAperti({ ultimo: C.meseDaChiudere({ oggi: '2026-11-15' }).ultimo, documenti: docs, chiusure: [], movimentiExtra: extra });
  verifica('il 15/11/2026 settembre e\' fra i mesi aperti ma non e\' di prima del gestionale', novembre.find(m => m.mese === 'Settembre')?.prima_del_gestionale === false);

  const tutti = [...MESI, 'Settembre', 'Ottobre'].map(m => ({ anno: 2026, mese: m }));
  const p = C.pianoMesiChiusiFuori({ mesi: tutti, oggi: OGGI, documenti: docs, chiusure: [], movimentiExtra: extra });
  verifica('il piano: 24 documenti in 8 mesi, e dopo nessuno resta aperto', p.documenti_da_chiudere.length === 24 && p.sintesi === "Da segnare chiusi: 24 documenti dell'attiva in 8 mesi. Dopo, nessuno di questi mesi resta aperto.", p.sintesi);
  verifica('mese per mese: prima aperto, dopo chiuso', p.mesi.length === 8 && p.mesi.every(m => m.prima.aperto && !m.dopo.aperto && m.frase === `${m.etichetta}: chiuso.` && m.esito === 'Dopo è chiuso.'), JSON.stringify(p.mesi.map(m => m.frase)));
  verifica('canale per canale, coi documenti che si chiudono e com\'erano', p.mesi.every(m => m.canali.map(c => `${c.canale}:${c.azione}:${c.documenti.length}`).join(',') === 'RETE:chiude:1,ACI:chiude:1,EXTRA_RACCOLTA:chiude:1'));
  const gen = p.mesi[0].canali;
  verifica('la riga del canale dice quando e\' stato elaborato e quante righe', gen[0].testo === 'Rete: elaborata il 18/09/2026, 300 righe; da «elaborata» a «chiusa».' && gen[2].testo === 'Extra raccolta: elaborata il 18/09/2026, senza righe; da «elaborata» a «chiusa».', JSON.stringify(gen.map(c => c.testo)));
  verifica('settembre e ottobre non si segnano: si chiudono nel gestionale', p.rifiutati.map(r => r.mese).join(',') === 'Settembre,Ottobre'
    && /primo mese chiuso nel gestionale/.test(p.rifiutati[0].perche) && /come ogni mese da settembre 2026/.test(p.rifiutati[1].perche), JSON.stringify(p.rifiutati));
  verifica('nel piano nessun importo', !/123456|123\.456/.test(JSON.stringify(p.mesi)) && !/123456/.test(p.sintesi));
  const conNumero = C.pianoMesiChiusiFuori({ mesi: [{ anno: 2026, mese: 3 }, { anno: 2026, mese: 'marzo' }, { anno: 2026, mese: 'Brumaio' }, { mese: 'Marzo' }], oggi: OGGI, documenti: docs, chiusure: [] });
  verifica('il mese col numero o col nome, una volta sola; un mese che non si riconosce si dice', conNumero.mesi.map(m => m.etichetta).join(',') === 'Marzo 2026' && conNumero.rifiutati.length === 2 && conNumero.rifiutati.every(r => /Mese non riconosciuto/.test(r.perche)), JSON.stringify(conNumero));
  verifica('un mese non ancora finito non si segna', /non è ancora finito/.test(C.pianoMesiChiusiFuori({ mesi: [{ anno: 2026, mese: 'Agosto' }], oggi: '2026-08-20', documenti: docs }).rifiutati[0]?.perche || ''));

  // Che cosa si scrive: lo stato della chiusura vera, mai il giorno ne' il numero della fattura.
  const quando = '2026-10-12T16:30:00.000Z';
  const patch = C.patchChiusoFuori({ ...docs[0], note: 'Riaperto il 2026-09-20 da Mario: era "approvata".' }, { utente: 'Mario Rossi', quando, giorno: OGGI });
  verifica('la scrittura: chiusa, quando e chi, la nota in coda', patch.stato === 'chiusa' && patch.data_chiusura === quando && patch.fattura_confermata_da === 'Mario Rossi'
    && patch.note === `Riaperto il 2026-09-20 da Mario: era "approvata".\n${C.NOTA_CHIUSO_FUORI}. Segnato chiuso il 12/10/2026 da Mario Rossi: era «elaborata».`, JSON.stringify(patch));
  verifica('niente giorno ne\' numero della fattura: non si sanno', !('fattura_confermata_il' in patch) && !('fattura_numero' in patch) && !('totale' in patch));
  verifica('la nota e\' quella decisa dall\'utente', C.NOTA_CHIUSO_FUORI === "Chiuso fuori dal gestionale: fatturato prima dell'avvio, decisione dell'utente dell'11/10/2026");
  const chiuso = { ...docs[0], ...patch };
  verifica('chiusoFuoriDalGestionale: si riconosce', C.chiusoFuoriDalGestionale(chiuso) && !C.chiusoFuoriDalGestionale(docs[0]));
  verifica('riaperto e chiuso davvero, con la conferma della fattura, non lo e\' piu\'', !C.chiusoFuoriDalGestionale({ ...chiuso, fattura_confermata_il: '2026-10-20' }) && !C.chiusoFuoriDalGestionale({ ...chiuso, stato: 'elaborata' }));
  const riga = C.rigaStoricoChiusoFuori(docs[0], { utente: 'Mario Rossi', il: quando });
  verifica('la riga dello storico: documento, stato prima e dopo, chi, quando e perche\'', riga.entita === 'DocumentoFatturazione' && riga.record_id === 'd1' && riga.campo === 'stato' && riga.prima === 'elaborata' && riga.dopo === 'chiusa'
    && riga.operazione === 'update' && riga.utente === 'Mario Rossi' && riga.il === quando && riga.motivo === C.NOTA_CHIUSO_FUORI && riga.origine === C.ORIGINE_CHIUSO_FUORI
    && riga.riservato === false && riga.anno === 2026 && riga.etichetta === 'Fatturazione attiva · RETE · gennaio 2026', JSON.stringify(riga));

  // Dopo: i documenti chiusi, e tutti i moduli leggono «chiusa».
  const ids = new Set(p.documenti_da_chiudere.map(d => d.id));
  const dopo = docs.map(d => (ids.has(d.id) ? { ...d, ...C.patchChiusoFuori(d, { utente: 'Mario Rossi', quando, giorno: OGGI }) } : d));
  verifica('dopo, i mesi ancora aperti non sono piu\' gennaio-agosto', C.mesiAncoraAperti({ ultimo, documenti: dopo, chiusure: [], movimentiExtra: extra }).length === 0);
  const att = C.passiAttiva({ periodo: C.periodoDelMese(2026, 0), documenti: dopo, movimentiExtra: extra });
  const FUORI = "Fatturata fuori dal gestionale, prima dell'avvio: segnata chiusa il 12/10/2026 (decisione dell'utente dell'11/10/2026).";
  verifica('la chiusura di gennaio: rete e ACI fatte, e si dice come; l\'extra senza righe non serve', att[0].stato === 'fatto' && att[1].stato === 'fatto' && att[0].dettaglio === FUORI && att[1].dettaglio === FUORI && att[2].stato === 'non_serve', JSON.stringify(att.map(x => [x.stato, x.dettaglio])));
  const aprile = C.passiAttiva({ periodo: C.periodoDelMese(2026, 3), documenti: dopo, movimentiExtra: extra });
  verifica('aprile: anche l\'extra, con la sua riga, e\' fatta', aprile.every(x => x.stato === 'fatto' && x.dettaglio === FUORI), JSON.stringify(aprile.map(x => [x.stato, x.dettaglio])));
  verifica('e non dice approvata ne\' «fattura confermata»: qui non c\'e\' mai stata', [...att, ...aprile].filter(x => x.stato === 'fatto').every(x => !x.voci.some(v => /Approvata|fattura confermata|prefattura/i.test(v.testo))), JSON.stringify(att[0].voci));
  const ancora = C.pianoMesiChiusiFuori({ mesi: tutti.slice(0, 8), oggi: OGGI, documenti: dopo, chiusure: [], movimentiExtra: extra });
  verifica('rifarlo non tocca niente: gia\' chiusi', ancora.documenti_da_chiudere.length === 0 && ancora.mesi.every(m => m.canali.every(c => c.azione === 'gia_chiusa')) && /^Niente da segnare chiuso\./.test(ancora.sintesi), ancora.sintesi);

  // Un canale senza documento non si chiude: un documento creato apposta direbbe zero euro.
  const senzaAci = docs.filter(d => !(d.mese === 'Marzo' && d.tipologia === 'ACI'));
  const marzo = C.pianoMesiChiusiFuori({ mesi: [{ anno: 2026, mese: 'Marzo' }], oggi: OGGI, documenti: senzaAci, chiusure: [] });
  const aci = marzo.mesi[0].canali.find(c => c.canale === 'ACI');
  verifica('marzo senza il documento ACI: rete ed extra si chiudono, l\'ACI no, e il mese resta aperto', marzo.documenti_da_chiudere.length === 2 && aci.azione === 'senza_documento' && /nessun documento dell'attiva/.test(aci.testo)
    && marzo.mesi[0].frase === "Marzo 2026: resta aperto, manca l'elaborazione dell'attiva (ACI)." && marzo.mesi[0].esito === "Resta aperto: manca l'elaborazione dell'attiva (ACI).", JSON.stringify(marzo.mesi[0]));
  // L'extra raccolta a zero righe con un movimento arrivato dopo: chiusa, non si rielaborerebbe piu'.
  const vecchia = docs.map(d => (d.mese === 'Luglio' && d.tipologia === 'EXTRA_RACCOLTA' ? { ...d, numero_voci: 0 } : d));
  const luglio = C.pianoMesiChiusiFuori({ mesi: [{ anno: 2026, mese: 'Luglio' }], oggi: OGGI, documenti: vecchia, chiusure: [], movimentiExtra: extra });
  const lx = luglio.mesi[0].canali.find(c => c.canale === 'EXTRA_RACCOLTA');
  verifica('luglio con l\'extra a zero righe e un intervento finito: non si chiude, va rielaborata', lx.azione === 'da_rielaborare' && luglio.documenti_da_chiudere.length === 2
    && lx.testo === "Extra raccolta: elaborata il 06/10/2026, senza righe, ma nel mese c'è 1 movimento di extra raccolta finito. Non si chiude da qui: manca la rielaborazione dell'attiva, poi si segna chiuso."
    && luglio.mesi[0].frase === "Luglio 2026: resta aperto, manca la rielaborazione dell'attiva (extra raccolta).", JSON.stringify(luglio.mesi[0]));
  // Superati e bozze restano come sono; un documento senza canale si chiude una volta.
  const vari = [
    doc('Maggio', 'RETE', { id: 'sup', superato: true }), doc('Maggio', 'RETE', { id: 'boz', stato: 'bozza' }),
    doc('Maggio', 'RETE', { id: 'r5' }), doc('Maggio', 'ACI', { id: 'a5', stato: 'chiusa', fattura_confermata_il: '2026-06-10' }), doc('Maggio', 'EXTRA_RACCOLTA', { id: 'e5' }),
    doc('Giugno', null, { id: 'tutto6' }),
  ];
  const pv = C.pianoMesiChiusiFuori({ mesi: [{ anno: 2026, mese: 'Maggio' }, { anno: 2026, mese: 'Giugno' }], oggi: OGGI, documenti: vari, chiusure: [] });
  verifica('superati e bozze non si toccano, il gia\' chiuso nemmeno', pv.documenti_da_chiudere.map(d => d.id).join(',') === 'r5,e5,tutto6' && pv.mesi[0].canali[1].azione === 'gia_chiusa', JSON.stringify(pv.documenti_da_chiudere.map(d => d.id)));
  verifica('il documento senza canale vale per i tre canali e si chiude una volta', pv.mesi[1].canali.every(c => c.azione === 'chiude' && c.documenti[0].id === 'tutto6') && !pv.mesi[1].dopo.aperto);
}

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
