// CHE COSA SERVE A UN ANNO PER COMINCIARE (shared/inizializzazioneAnno.ts).
//
// Il fatto, 10/10/2026. Il contratto con Ecotyre e con tutti i fornitori e'
// annuale senza tacito rinnovo (regola dell'utente, 06/10/2026): le tariffe
// seminate chiudono il 31/12/2026, e dal giorno dopo in attivaCalcolo.ts una
// riga senza tariffa vale ZERO EURO e nasce con stato_validazione 'errore'. Lo
// stesso sulla passiva. Al primo formulario di gennaio la fatturazione e'
// inservibile finche' qualcuno non scrive i prezzi nuovi, e nessuno se ne
// accorge prima perche' niente lo dice.
//
// copiaAnnoTarget sa gia' portare avanti impianti, target, collegamenti,
// contratto ed elenco siti. Le tariffe no: erano il buco.
//
// Qui si prova la regola - che cosa manca, che cosa si puo' copiare e come - e
// soprattutto le due prudenze: non si copia sopra niente, e un prezzo copiato
// resta «da confermare» finche' qualcuno non lo guarda. npm run prove
//
// La prova generale del cambio d'anno (15/10/2026) ha aggiunto due cose:
// - difetto 7: una tariffa di rete o ACI senza data di fine, o con la fine oltre
//   il 31/12 dell'anno in cui comincia, non rende «pronta» la lista dell'anno
//   dopo: si dice «da chiudere». «Per sempre» vale solo per l'extra raccolta;
// - difetto 21: la voce «Contratti ai subfornitori» dice «pronto» solo con tutti
//   i contratti attesi dal modulo Contratti controfirmati; gli annullati non
//   contano, e senza gli attesi (la dashboard) non dice mai «pronto»; ma se
//   quelli fatti sono tutti controfirmati non tiene accesa la dashboard
//   (revisione del 15/10/2026).
import { listaAnno, tariffeDaRinnovare, tariffeDaConfermare, copiaTariffa, copreIlGiorno, chiaveTariffa, giorniAlPrimoGennaio, noteDopoIlPrezzo, noteDellaTariffaNuova } from '../base44/shared/inizializzazioneAnno.ts';
import { daConfermare } from '../base44/shared/annoTarget.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Le sette tariffe attive del 2026 e tre passive, come stanno in archivio.
const t = (p) => ({ unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', ...p });
const TARIFFE_2026 = [
  t({ direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'Ecotyre Scrl', servizio_ecotyre: 'TRASP_TRATT', valore: 202 }),
  // L'extra raccolta col committente come lo scrive il seme, 'ECOTYRE': la voce
  // della sua base la cerca con la regola della fattura, e la fattura una
  // tariffa intestata a un altro nome non la trova (11/10/2026).
  t({ direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 202 }),
  t({ direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'Ecotyre Scrl', regione: 'Campania', valore: 95 }),
  t({ direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'Ecotyre Scrl', regione: 'Puglia', valore: 88 }),
  t({ direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_nome: 'Emmesse', destinazione: 'Gatim', valore: 72 }),
  t({ direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_nome: 'Emmesse', destinazione: 'Irigom', valore: 90 }),
  t({ direzione: 'PASSIVA', tipologia: 'ACI', prestazione: 'TRATTAMENTO', fornitore_nome: 'Tecnogum', valore: 95 }),
];

console.log('QUANDO UNA TARIFFA COPRE UN GIORNO');
verifica('dentro la finestra', copreIlGiorno(TARIFFE_2026[0], '2026-06-30'));
verifica('fuori, il giorno dopo la scadenza', !copreIlGiorno(TARIFFE_2026[0], '2027-01-01'));
// «Per sempre» resta solo dell'extra raccolta, aperta per scelta (campagne
// occasionali). Una tariffa di rete o ACI senza fine la fatturazione la legge
// ancora cosi', ma non si salva piu' e la lista la dice «da chiudere» (15/10/2026,
// difetto 7: qui sotto, UNA TARIFFA DI RETE O ACI APERTA NON E «PRONTA»).
verifica('un\'extra raccolta senza data di fine vale per sempre', copreIlGiorno(t({ tipologia: 'EXTRA_RACCOLTA', data_fine_validita: '' }), '2030-01-01'));
verifica('senza data di inizio vale da sempre', copreIlGiorno(t({ data_inizio_validita: '' }), '2020-01-01'));
verifica('una tariffa non attiva non copre niente', !copreIlGiorno(t({ stato: 'non_attivo' }), '2026-06-30'));

console.log('LA CHIAVE: LA STESSA TARIFFA IN DUE ANNI');
{
  const a = TARIFFE_2026[0];
  const b = { ...a, valore: 215, data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' };
  verifica('il prezzo e le date non entrano nella chiave: e la stessa riga rinnovata', chiaveTariffa(a) === chiaveTariffa(b));
  verifica('la regione invece si: due regioni sono due tariffe',
    chiaveTariffa(TARIFFE_2026[2]) !== chiaveTariffa(TARIFFE_2026[3]));
  verifica('e la destinazione pure: Emmesse a Gatim non e Emmesse a Irigom',
    chiaveTariffa(TARIFFE_2026[4]) !== chiaveTariffa(TARIFFE_2026[5]));
  verifica('attiva e passiva non si confondono mai',
    chiaveTariffa({ direzione: 'ATTIVA', tipologia: 'RETE' }) !== chiaveTariffa({ direzione: 'PASSIVA', tipologia: 'RETE' }));
}

console.log('CHE COSA SCADE E NON HA UN SEGUITO');
{
  verifica('al 2027 mancano tutte e sette', tariffeDaRinnovare(TARIFFE_2026, 2027).length === 7);
  verifica('quattro attive e tre passive, contate a parte',
    tariffeDaRinnovare(TARIFFE_2026, 2027, 'ATTIVA').length === 4 && tariffeDaRinnovare(TARIFFE_2026, 2027, 'PASSIVA').length === 3);
  // Chi ha gia' il suo seguito non si conta piu': e' il controllo che rende
  // l'operazione ripetibile senza fare doppioni.
  const conUna = [...TARIFFE_2026, copiaTariffa(TARIFFE_2026[0], 2027)];
  verifica('appena una e rinnovata, sparisce dall elenco', tariffeDaRinnovare(conUna, 2027, 'ATTIVA').length === 3);
  verifica('e ripetere la copia non ne crea un altra', tariffeDaRinnovare([...conUna, copiaTariffa(TARIFFE_2026[0], 2027)], 2027, 'ATTIVA').length === 3);
  // Una tariffa gia' scaduta prima non e' «in scadenza»: non la si rinnova.
  const vecchia = t({ direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'X', data_fine_validita: '2025-12-31' });
  verifica('una tariffa gia morta nel 2025 non entra nel rinnovo del 2027',
    tariffeDaRinnovare([vecchia], 2027).length === 0);
}

console.log('LA COPIA: STESSA RIGA, ANNO NUOVO, PREZZO DA CONFERMARE');
{
  const c = copiaTariffa(TARIFFE_2026[0], 2027);
  verifica('la validita e tutto il 2027', c.data_inizio_validita === '2027-01-01' && c.data_fine_validita === '2027-12-31');
  verifica('il prezzo dell anno prima resta come punto di partenza', c.valore === 202);
  verifica('e si vede che e copiato, cosi nessuno lo scambia per confermato',
    daConfermare(c) && /copiato dal 2026/.test(c.note));
  verifica('nasce attiva', c.stato === 'attivo');
  // L'identificativo non si copia: sarebbe la stessa riga, non una nuova.
  const conId = copiaTariffa({ ...TARIFFE_2026[0], id: 'abc', created_date: 'x', updated_date: 'y' }, 2027);
  verifica('l identificativo e le date di sistema non si portano dietro',
    !('id' in conId) && !('created_date' in conId) && !('updated_date' in conId));
  verifica('tutto il resto si', conId.tipologia === 'RETE' && conId.cliente === 'Ecotyre Scrl' && conId.servizio_ecotyre === 'TRASP_TRATT');
  // E si riconoscono dopo, per dire che vanno ancora guardate.
  const dopo = [...TARIFFE_2026, ...TARIFFE_2026.map(x => copiaTariffa(x, 2027))];
  verifica('dopo la copia sono sette da confermare', tariffeDaConfermare(dopo, 2027).length === 7);
  verifica('e nessuna manca piu', tariffeDaRinnovare(dopo, 2027).length === 0);
}

console.log('LA LISTA DI CONTROLLO DELL ANNO NUOVO');
{
  // Il 2026 ha contratti e il 2027 no: e' la situazione vera di ottobre.
  // Le righe del 2026 ci sono, quelle del 2027 no: e' la situazione vera di ottobre.
  const SITI_2026 = [{ anno: 2026, sito: 'Irigom S.r.l.', tipo_destinazione: 'imp' }, { anno: 2026, sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc' }];
  const vuoto = listaAnno({ anno: 2027, tariffe: TARIFFE_2026, giacenzeSito: SITI_2026, contrattiFornitore: [{ anno: 2026 }, { anno: 2026 }], piazzali: ['irigom', 'nappi sud'], rilevazioni: [], oggi: '2026-10-10' });
  // Sette dal 10/10/2026: la settima e' l'apertura degli impianti, che non
  // c'era e che nessuno scriveva. Otto dall'11/10/2026: l'ottava e' la base
  // dell'extra raccolta dell'anno nuovo.
  verifica('otto voci', vuoto.voci.length === 8, String(vuoto.voci.length));
  verifica('tutte da fare, e il conto lo dice', vuoto.mancanti === 8 && vuoto.pronte === 0 && vuoto.pronto === false,
    JSON.stringify(vuoto.voci.map(x => [x.chiave, x.stato])));
  const v = (k) => vuoto.voci.find(x => x.chiave === k);
  verifica('le tariffe attive dicono quante scadono e che il 2027 non ce le ha',
    v('tariffe_attive').stato === 'manca' && /4 tariffe scadono il 31\/12\/2026/.test(v('tariffe_attive').dettaglio), v('tariffe_attive').dettaglio);
  verifica('e offrono di copiarle', v('tariffe_attive').azione === 'copia_tariffe');
  verifica('attive e passive restano due voci separate',
    v('tariffe_attive').quante === 4 && v('tariffe_passive').quante === 3);
  verifica('la fotografia dice il giorno all italiana', /31\/12\/2026/.test(v('fotografia').titolo), v('fotografia').titolo);
  verifica('e dice dove si fa', v('fotografia').dove.includes('Chiusura anno') && v('tariffe_attive').dove.includes('Tariffe'));
  // Ottobre non e' dicembre: si dice, non si grida.
  verifica('a ottobre mancano 83 giorni e non e ancora urgente',
    vuoto.giorni_al_primo_gennaio === 83 && vuoto.urgente === false, String(vuoto.giorni_al_primo_gennaio));
  const dicembre = listaAnno({ anno: 2027, tariffe: TARIFFE_2026, piazzali: [], rilevazioni: [], oggi: '2026-12-05' });
  verifica('a dicembre diventa urgente', dicembre.urgente === true && dicembre.giorni_al_primo_gennaio === 27);
  // LA FINESTRA DELLA DASHBOARD: due mesi prima, e finche' resta qualcosa da
  // fare. Un avviso che sta li' tutto l'anno non e' un avviso, e' arredamento.
  const quando = (oggi) => listaAnno({ anno: 2027, tariffe: TARIFFE_2026, piazzali: [], rilevazioni: [], oggi }).avvicinandosi;
  verifica('in estate la dashboard tace', quando('2026-07-01') === false);
  verifica('a ottobre ancora', quando('2026-10-10') === false);
  verifica('dal 1° novembre parla', quando('2026-11-01') === true && quando('2026-10-31') === false);
  verifica('e continua a parlare anche ad anno cominciato, finche manca qualcosa', quando('2027-02-10') === true);
  // Ma se non manca niente tace comunque, anche in piena finestra. La lista
  // chiamata come la chiama la dashboard (cruscottoOperativo): senza gli attesi
  // dei contratti, che la dashboard non ha perche' non rilegge i movimenti.
  // Revisione del 15/10/2026: con i contratti 2027 tutti controfirmati la voce
  // dei contratti restava «parziale» e la dashboard diceva ogni mattina «2027: 1
  // e da confermare · Contratti ai subfornitori» dal 01/11 al 28/02, con
  // l'anno pronto. La prova era stata cambiata passando gli attesi, che la
  // dashboard non passa mai: qui torna senza.
  const PRONTO_2027 = {
    tariffe: TARIFFE_2026.map(x => ({ ...copiaTariffa(x, 2027), note: '' })),
    giacenzeSito: [{ anno: 2027 }], targetRaccoglitori: [{ anno: 2027 }], commesse: [{ anno: 2027 }],
    contrattiFornitore: [{ anno: 2027, stato: 'controfirmato' }, { anno: 2027, stato: 'controfirmato' }, { anno: 2027, stato: 'annullato' }], piazzali: [], rilevazioni: [],
  };
  const aPosto = listaAnno({ anno: 2027, oggi: '2026-12-10', ...PRONTO_2027 });
  verifica('un anno gia pronto non compare in dashboard', aPosto.avvicinandosi === false && aPosto.mancanti === 0, JSON.stringify(aPosto.voci.filter(v => v.stato !== 'pronto')));
  // la voce dei contratti, senza gli attesi, resta gialla nella scheda e manda al modulo Contratti
  const vContratti = aPosto.voci.find(v => v.chiave === 'contratti_fornitori');
  verifica('senza gli attesi la voce dei contratti non dice «pronto» ma non tiene accesa la dashboard', vContratti.stato === 'parziale' && vContratti.tace_in_dashboard === true
    && /2 contratti 2027, 2 controfirmati: quanti ne servono lo dice il modulo Contratti/.test(vContratti.dettaglio), JSON.stringify(vContratti));
  // con gli attesi, come la chiama preparaAnno (Target & Status › Nuovo anno), l'anno e' pronto
  const aPostoScheda = listaAnno({ anno: 2027, oggi: '2026-12-10', ...PRONTO_2027, totaliContratti: { attesi: 2, controfirmati: 2 } });
  verifica('e con gli attesi tutti controfirmati la scheda dice «pronto»', aPostoScheda.pronto === true && aPostoScheda.avvicinandosi === false);
  // la scelta dell'anno della dashboard e la voce scritta dal cruscotto vero, il
  // 10/12/2026 e il 27/02/2027 (lo script del revisore r10_dashboardMaiPronta)
  const { annoNuovoDaMostrare } = await import('../base44/shared/inizializzazioneAnno.ts');
  const { cruscotto } = await import('../base44/shared/cruscotto.ts');
  const vociNuovoAnno = (oggi, args) => {
    const annoNuovo = annoNuovoDaMostrare({ ...args, oggi });
    const dash = cruscotto({ oggi, adessoMs: Date.parse(`${oggi}T09:00:00Z`), anno: Number(oggi.slice(0, 4)), tipiFile: [], alertAperti: [], uploadLogs: [],
      assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], riepilogoQualifica: null, richiesteEct: [], annoNuovo });
    return (dash.da_gestire || []).filter(x => x.area === 'Nuovo anno');
  };
  for (const oggi of ['2026-12-10', '2027-02-27']) {
    const v = vociNuovoAnno(oggi, PRONTO_2027);
    verifica(`dashboard del ${oggi}: anno pronto e contratti fatti tutti controfirmati, nessuna voce «Nuovo anno»`, v.length === 0, JSON.stringify(v));
  }
  // La controprova: se c'e' ancora da fare sui contratti, la dashboard ne parla.
  const unoDaFirmare = { ...PRONTO_2027, contrattiFornitore: [{ anno: 2027, stato: 'controfirmato' }, { anno: 2027, stato: 'generato' }] };
  const vDaFirmare = vociNuovoAnno('2026-12-10', unoDaFirmare);
  verifica('controprova: un contratto 2027 fatto e non controfirmato tiene accesa la dashboard', vDaFirmare.length === 1 && /Contratti ai subfornitori/.test(vDaFirmare[0].dettaglio), JSON.stringify(vDaFirmare));
  const nessuno = { ...PRONTO_2027, contrattiFornitore: [{ anno: 2027, stato: 'annullato' }] };
  const vNessuno = vociNuovoAnno('2026-12-10', nessuno);
  verifica('controprova: nessun contratto 2027 (gli annullati non contano), la dashboard ne parla', vNessuno.length === 1 && /1 cosa manca/.test(vNessuno[0].titolo) && /Contratti ai subfornitori/.test(vNessuno[0].dettaglio), JSON.stringify(vNessuno));
  // e quando c'e' altro da fare (qui i target, gialli) la voce dei contratti resta
  // nell'elenco della dashboard e nel conto delle «da confermare», come nella scheda
  const senzaTarget = { ...PRONTO_2027, targetRaccoglitori: [] };
  const vSenzaTarget = vociNuovoAnno('2026-12-10', senzaTarget);
  verifica('con altro da fare la voce resta nell\'elenco, coi numeri che dice la scheda', vSenzaTarget.length === 1 && /2027: 2 sono da confermare/.test(vSenzaTarget[0].titolo)
    && /Target e siti · Contratti ai subfornitori/.test(vSenzaTarget[0].dettaglio), JSON.stringify(vSenzaTarget));
}

console.log('I CONTRATTI AI SUBFORNITORI: PRONTI SOLO SE CONTROFIRMATI (difetto 21, 15/10/2026)');
{
  // La prova generale del cambio d'anno: la voce contava i record dell'anno di
  // qualunque stato, annullati compresi. Sui dati veri, senza contratti 2026 nel
  // gestionale, diceva «pronto - Nel 2026 non ce n'erano: niente da rinnovare»
  // mentre il modulo Contratti ne aspettava 32 il 28/12 e 13 il 05/01, nessuno
  // controfirmato; un generato, una bozza e un annullato facevano «pronto - 3
  // contratti per il 2027» con 15 attesi e 0 controfirmati.
  const voce = (args) => listaAnno({ anno: 2027, tariffe: [], piazzali: [], rilevazioni: [], oggi: '2026-12-28', ...args }).voci.find(v => v.chiave === 'contratti_fornitori');
  const c27 = (stato) => ({ anno: 2027, stato });
  const a = voce({ contrattiFornitore: [], totaliContratti: { attesi: 32, controfirmati: 0 } });
  verifica('scenario A, dati veri senza contratti, 32 attesi: «manca», non «pronto»', a.stato === 'manca' && /Nessun contratto 2027 controfirmato su 32 attesi/.test(a.dettaglio), JSON.stringify(a));
  verifica('e la frase «Nel 2026 non ce n\'erano: niente da rinnovare» non c\'e\' piu\'', !/non ce n'erano|niente da rinnovare/.test(a.dettaglio), a.dettaglio);
  const b = voce({ contrattiFornitore: [c27('generato'), c27('bozza'), c27('annullato'), { anno: 2026, stato: 'controfirmato' }], totaliContratti: { attesi: 15, controfirmati: 0 } });
  verifica('scenario B, un generato, una bozza e un annullato con 15 attesi: «manca»', b.stato === 'manca' && /su 15 attesi/.test(b.dettaglio), JSON.stringify(b));
  verifica('e l\'annullato non conta: «2 sono fatti ma non ancora controfirmati»', /2 sono fatti ma non ancora controfirmati/.test(b.dettaglio), b.dettaglio);
  const parziale = voce({ contrattiFornitore: [c27('controfirmato'), c27('generato')], totaliContratti: { attesi: 15, controfirmati: 1 } });
  verifica('uno controfirmato su 15: «parziale», coi numeri', parziale.stato === 'parziale' && /1 contratto controfirmato su 15 attesi/.test(parziale.dettaglio) && parziale.attesi === 15 && parziale.controfirmati === 1, JSON.stringify(parziale));
  // la controprova: tutti gli attesi controfirmati
  const pronto = voce({ contrattiFornitore: [c27('controfirmato'), c27('controfirmato')], totaliContratti: { attesi: 2, controfirmati: 2 } });
  verifica('controprova: tutti gli attesi controfirmati, «pronto»', pronto.stato === 'pronto' && /Tutti i 2 contratti attesi per il 2027 sono controfirmati/.test(pronto.dettaglio), JSON.stringify(pronto));
  // Senza gli attesi (la dashboard, che non rilegge i movimenti) non e' mai «pronto».
  const senzaAttesi = voce({ contrattiFornitore: [c27('controfirmato'), c27('controfirmato'), c27('annullato')] });
  verifica('senza gli attesi, anche coi contratti fatti tutti controfirmati: «parziale», e manda al modulo Contratti', senzaAttesi.stato === 'parziale'
    && /2 contratti 2027, 2 controfirmati: quanti ne servono lo dice il modulo Contratti/.test(senzaAttesi.dettaglio), JSON.stringify(senzaAttesi));
  const vuota = voce({ contrattiFornitore: [] });
  verifica('senza gli attesi e senza contratti: «manca», e lo dice senza «0 contratti»', vuota.stato === 'manca' && vuota.dettaglio === 'Nessun contratto 2027: quanti ne servono lo dice il modulo Contratti.' && !vuota.tace_in_dashboard, JSON.stringify(vuota));
  const soloPrima = voce({ contrattiFornitore: [{ anno: 2026, stato: 'controfirmato' }] });
  verifica('i contratti dell\'anno prima non fanno l\'anno nuovo', soloPrima.stato === 'manca', JSON.stringify(soloPrima));
}

console.log('UNA TARIFFA DI RETE O ACI APERTA NON E «PRONTA» (difetto 7, 15/10/2026)');
{
  // Scenario A della prova generale: il 05/01/2027 l'amministratore scrive le
  // tariffe 2027 dalle anagrafiche lasciando la fine vuota (rete attiva 205 €/t,
  // raccolta GATIM 73 €/t) e un'ACI fino al 30/06/2028. Il 01/12/2027 la lista
  // del 2028 diceva «2 tariffe coprono il 2028» e «1 tariffa copre il 2028», e il
  // 10/02/2028 gennaio si fatturava e si pagava al prezzo del 2027.
  const t27 = (p) => ({ unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2027-01-01', ...p });
  const A = [
    t27({ id: 'r27', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 205 }),
    t27({ id: 'a27', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Calabria', valore: 233, data_fine_validita: '2028-06-30' }),
    t27({ id: 'g27', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_nome: 'GATIM S.R.L.', regione: 'Calabria', valore: 73 }),
  ];
  const l28 = listaAnno({ anno: 2028, tariffe: A, piazzali: [], rilevazioni: [], oggi: '2027-12-01' });
  const att = l28.voci.find(v => v.chiave === 'tariffe_attive');
  const pas = l28.voci.find(v => v.chiave === 'tariffe_passive');
  verifica('il 01/12/2027 la lista del 2028 non dice «pronto» alle attive', att.stato !== 'pronto' && att.stato === 'manca', JSON.stringify(att));
  verifica('e dice che le due tariffe del 2027 valgono anche nel 2028 e vanno chiuse', /2 tariffe di rete o ACI cominciate prima del 2028 valgono anche nel 2028/.test(att.dettaglio) && /vanno chiuse al 31\/12/.test(att.dettaglio), att.dettaglio);
  verifica('con chi sono, in chiaro', att.da_chiudere && att.da_chiudere.length === 2 && att.da_chiudere.map(x => x.id).sort().join() === 'a27,r27' && /205,00 €\/t, dal 01\/01\/2027, senza fine/.test(att.dettaglio) && /fino al 30\/06\/2028/.test(att.dettaglio), JSON.stringify(att));
  verifica('la passiva lo stesso: GATIM aperta non e\' «1 tariffa copre il 2028»', pas.stato === 'manca' && /GATIM S\.R\.L\./.test(pas.dettaglio) && !/copre il 2028/.test(pas.dettaglio), JSON.stringify(pas));
  // IL PREZZO DI UN FORNITORE NON ESCE DALLA LISTA (revisione del 15/10/2026):
  // la lista la legge chiunque apra Target & Status › Nuovo anno, e le passive
  // sono i costi. Prima la frase diceva «GATIM S.R.L. raccolta RETE Calabria
  // 73,00 €/t» e da_chiudere portava { valore: 73 }.
  verifica('la passiva da chiudere si nomina senza prezzo: fornitore, prestazione, canale, regione e periodo', /GATIM S\.R\.L\. raccolta RETE Calabria, dal 01\/01\/2027, senza fine/.test(pas.dettaglio) && !/73/.test(pas.dettaglio), pas.dettaglio);
  verifica('e in da_chiudere non c\'e\' il valore', pas.da_chiudere && pas.da_chiudere.length === 1 && !('valore' in pas.da_chiudere[0]) && !('unita_misura' in pas.da_chiudere[0]) && !/73/.test(JSON.stringify(pas.da_chiudere)), JSON.stringify(pas.da_chiudere));
  verifica('le attive invece tengono il prezzo, che leggono tutti', att.da_chiudere.find(x => x.id === 'r27').valore === 205 && /ECOTYRE RETE 205,00 €\/t/.test(att.dettaglio), JSON.stringify(att.da_chiudere));
  // La lista del loro anno: il prezzo c'e', ma la fine manca. Giallo, non verde.
  const l27 = listaAnno({ anno: 2027, tariffe: A, piazzali: [], rilevazioni: [], oggi: '2027-01-05' });
  const att27 = l27.voci.find(v => v.chiave === 'tariffe_attive');
  verifica('nella lista del 2027 le stesse tariffe sono «parziale»: vanno chiuse al 31/12/2027', att27.stato === 'parziale' && /2 tariffe di rete o ACI del 2027/.test(att27.dettaglio) && /vanno chiuse al 31\/12\/2027/.test(att27.dettaglio), JSON.stringify(att27));
  // Scenario B: «Riapri» sulle sette attive del 2026 il 02/01/2027 toglieva la
  // fine, e la lista del 2027 diventava «7 tariffe coprono il 2027».
  const riaperte = TARIFFE_2026.map(x => (x.direzione === 'ATTIVA' ? { ...x, data_fine_validita: null } : x));
  const lB = listaAnno({ anno: 2027, tariffe: riaperte, piazzali: [], rilevazioni: [], oggi: '2027-01-02' });
  const attB = lB.voci.find(v => v.chiave === 'tariffe_attive');
  verifica('le attive del 2026 riaperte senza fine: la lista del 2027 non e\' «pronto»', attB.stato === 'manca' && /3 tariffe di rete o ACI cominciate prima del 2027 valgono anche nel 2027/.test(attB.dettaglio), JSON.stringify(attB));
  verifica('e l\'extra raccolta aperta non e\' fra quelle da chiudere', !(attB.da_chiudere || []).some(x => x.tipologia === 'EXTRA_RACCOLTA'), JSON.stringify(attB.da_chiudere));
  // La controprova: le tariffe 2027 dal 01/01 al 31/12/2027, confermate.
  const chiuse = A.map(x => ({ ...x, data_fine_validita: '2027-12-31' }));
  const lOk = listaAnno({ anno: 2027, tariffe: chiuse, piazzali: [], rilevazioni: [], oggi: '2027-01-05' });
  verifica('controprova: dal 01/01 al 31/12/2027 le attive sono «pronto»', lOk.voci.find(v => v.chiave === 'tariffe_attive').stato === 'pronto', JSON.stringify(lOk.voci.find(v => v.chiave === 'tariffe_attive')));
  verifica('e le passive anche', lOk.voci.find(v => v.chiave === 'tariffe_passive').stato === 'pronto', JSON.stringify(lOk.voci.find(v => v.chiave === 'tariffe_passive')));
  const lOk28 = listaAnno({ anno: 2028, tariffe: chiuse, piazzali: [], rilevazioni: [], oggi: '2027-12-01' });
  verifica('e la lista del 2028 dice che scadono il 31/12/2027 e il 2028 non le ha', lOk28.voci.find(v => v.chiave === 'tariffe_attive').stato === 'manca'
    && /2 tariffe scadono il 31\/12\/2027/.test(lOk28.voci.find(v => v.chiave === 'tariffe_attive').dettaglio), JSON.stringify(lOk28.voci.find(v => v.chiave === 'tariffe_attive')));
  // L'extra raccolta resta libera: aperta non e' da chiudere.
  const extra = listaAnno({ anno: 2027, tariffe: [t27({ direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 210 })], piazzali: [], rilevazioni: [], oggi: '2027-01-05' });
  verifica('un\'extra raccolta aperta resta libera: niente «da chiudere»', !extra.voci.some(v => v.da_chiudere), JSON.stringify(extra.voci.filter(v => v.da_chiudere)));
  // Ma da sola non fa «pronte» le tariffe dell'anno: nella verifica del «Riapri»
  // la lista del 2028 diceva «1 tariffa copre il 2028» con la sola extra raccolta
  // del 2026 rimasta aperta, e il 2028 non aveva un prezzo di rete ne' di ACI.
  const soloExtra = listaAnno({ anno: 2028, tariffe: [...TARIFFE_2026, t({ direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 202, data_fine_validita: null })], piazzali: [], rilevazioni: [], oggi: '2027-12-01' });
  const attSolo = soloExtra.voci.find(v => v.chiave === 'tariffe_attive');
  verifica('con la sola extra raccolta aperta le attive del 2028 non sono «pronto»: manca la rete e l\'ACI', attSolo.stato === 'manca' && /Nessuna tariffa di rete o ACI copre il 2028/.test(attSolo.dettaglio), JSON.stringify(attSolo));
}

console.log('QUANDO L ANNO E PRONTO, LA LISTA TACE');
{
  const pronto = listaAnno({
    anno: 2027,
    // Le tariffe copiate E confermate: nessuna nota di copia.
    tariffe: TARIFFE_2026.map(x => ({ ...copiaTariffa(x, 2027), note: '' })),
    giacenzeSito: [
      { anno: 2026, sito: 'Irigom', tipo_destinazione: 'imp' },
      { anno: 2027, sito: 'Irigom', tipo_destinazione: 'imp', apertura_del: '2026-12-31', giacenza_riferimento_t: 652.84 },
    ],
    targetRaccoglitori: [{ anno: 2027, raccoglitore: 'SMOCO S.r.l.', regione: 'Puglia', target_tonnellate: 1850 }],
    commesse: [{ anno: 2027, target_annuo_t: 11000 }],
    // i due contratti 2027 controfirmati, e il modulo Contratti ne aspetta due (15/10/2026)
    contrattiFornitore: [{ anno: 2027, stato: 'controfirmato' }, { anno: 2027, stato: 'controfirmato' }, { anno: 2026 }],
    totaliContratti: { attesi: 2, controfirmati: 2 },
    piazzali: ['irigom'],
    rilevazioni: [{ sito: 'irigom', data_rilevazione: '2026-12-31' }],
    oggi: '2026-12-31',
  });
  verifica('otto voci pronte e niente da fare', pronto.pronte === 8 && pronto.mancanti === 0 && pronto.pronto === true,
    JSON.stringify(pronto.voci.map(x => [x.chiave, x.stato])));
  verifica('e non e urgente, perche non manca niente', pronto.urgente === false);
}

console.log('UN PREZZO COPIATO E NON CONFERMATO NON E «PRONTO»');
{
  // E' la prudenza che conta: un prezzo vecchio che passa per nuovo e' peggio di
  // un prezzo che manca, perche' nessuno lo guarda piu'.
  const copiate = listaAnno({ anno: 2027, tariffe: [...TARIFFE_2026, ...TARIFFE_2026.map(x => copiaTariffa(x, 2027))], piazzali: [], rilevazioni: [], oggi: '2026-12-01' });
  const att = copiate.voci.find(x => x.chiave === 'tariffe_attive');
  verifica('resta giallo finche nessuno le ha confermate', att.stato === 'parziale', att.stato);
  verifica('e dice che portano il prezzo dell anno prima', /prezzo dell'anno prima/.test(att.dettaglio), att.dettaglio);
  // Dal 10/10/2026 la lista non si limita a dire «vanno confermate»: offre di
  // farlo. Prima non c'era un modo, se non cancellare la nota a mano.
  verifica('non offre piu di copiarle: offre di confermarle', att.azione === 'conferma_tariffe' && att.direzione === 'ATTIVA', JSON.stringify([att.azione, att.direzione]));
}

console.log('UN PREZZO COPIATO E CAMBIATO A MANO NON E\' PIU\' COPIATO (revisione del 15/10/2026)');
{
  // gestisciAnagrafiche lo usa per la «Modifica» di Tariffe & Anagrafiche: il
  // modulo rimanda la nota com'era, e una rete 2027 portata da 202 a 205 €/t
  // restava «copiato dal 2026, da confermare». La prova intera, con le funzioni
  // vere, e' in prove/scadenzaTariffe2026.mjs.
  const copia = { ...copiaTariffa(TARIFFE_2026[0], 2027), note: 'copiato dal 2026, da confermare · accordo di maggio' };
  const note = noteDopoIlPrezzo(copia, { valore: 205, note: copia.note }, { il: '2027-01-20', da: 'amministratore' });
  verifica('col prezzo cambiato la nota della copia se ne va, le altre note restano, e si dice chi e quando', note === 'accordo di maggio · Prezzo scritto a mano sul contratto 2027 il 20/01/2027 da amministratore: non è più quello copiato.', note);
  verifica('e la tariffa non e\' piu\' da confermare', !daConfermare({ ...copia, valore: 205, note }));
  verifica('lo stesso prezzo (cambiano solo le date o le note) non conferma niente', noteDopoIlPrezzo(copia, { valore: copia.valore, note: copia.note }) === null && noteDopoIlPrezzo(copia, { valore: String(copia.valore) }) === null && noteDopoIlPrezzo(copia, { note: 'x' }) === null);
  verifica('una tariffa non copiata non si tocca', noteDopoIlPrezzo({ ...copia, note: '' }, { valore: 205 }) === null);
  const passiva = { ...copiaTariffa(TARIFFE_2026.find(x => x.direzione !== 'ATTIVA') || TARIFFE_2026[0], 2027) };
  verifica('vale anche per le passive', /^Prezzo scritto a mano sul contratto 2027/.test(noteDopoIlPrezzo(passiva, { valore: Number(passiva.valore) + 1 }) || ''), JSON.stringify(passiva));
  // E una tariffa nuova fatta con «Duplica» da una copiata (revisione del 15/10/2026,
  // r11): le note dell'originale arrivano con la create, e la nota della copia se ne va.
  const nuova = noteDellaTariffaNuova({ regione: 'Lazio', valore: 245, data_inizio_validita: '2027-01-01', note: copia.note }, { il: '2027-01-20', da: 'amministratore' });
  verifica('una tariffa nuova con la nota della copia: la nota se ne va, le altre restano, e si dice chi e quando', nuova === "accordo di maggio · Scritta a mano sul contratto 2027 il 20/01/2027 da amministratore: non è una copia dell'anno prima.", nuova);
  verifica('e non e\' da confermare', !daConfermare({ note: nuova }));
  verifica('senza la nota della copia non si tocca niente', noteDellaTariffaNuova({ valore: 245, note: 'contratto 2027' }) === null && noteDellaTariffaNuova({ valore: 245 }) === null && noteDellaTariffaNuova(null) === null);
}

console.log('LA BASE DELL EXTRA RACCOLTA DELL ANNO NUOVO');
{
  // Chiusura dell'audit, 11/10/2026. La tariffa EXTRA_RACCOLTA resta aperta per
  // scelta, quindi la voce delle tariffe attive la vede coperta anche nel 2027 e
  // tace; ma la fattura, dal 1° gennaio, applica a un intervento senza prezzo il
  // prezzo del 2026 con l'avviso «prezzo di un altro anno». La voce si misura con
  // la stessa funzione della fattura.
  const aperta = { direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01' };
  const base = (tariffe, anno = 2027) => listaAnno({ anno, tariffe, piazzali: [], rilevazioni: [], oggi: '2026-12-01' }).voci.find(x => x.chiave === 'base_extra_raccolta') || { stato: 'assente', dettaglio: '' };
  const vecchia = base([aperta]);
  verifica('con la sola tariffa del 2026 rimasta aperta la voce e gialla', vecchia.stato === 'parziale', JSON.stringify(vecchia));
  verifica('e dice che e il prezzo del 2026, con l avviso della fattura',
    vecchia.dettaglio.includes('tariffa del 2026 (202 €/t)') && /prezzo di un altro anno/.test(vecchia.dettaglio), vecchia.dettaglio);
  // Il caso della chiusura: il 2027 con una tariffa diversa da 202. Scritta dalle
  // anagrafiche, la tariffa nuova chiude da sola quella aperta al giorno prima
  // (gestisciAnagrafiche, rinegoziazione): le due non valgono mai insieme.
  const chiusa = { ...aperta, data_fine_validita: '2026-12-31' };
  const nuova = base([chiusa, { ...aperta, valore: 210, data_inizio_validita: '2027-01-01' }]);
  verifica('con la tariffa del 2027 a 210 euro e pronta, e dice 210', nuova.stato === 'pronto' && nuova.dettaglio.includes('210 €/t'), JSON.stringify(nuova));
  const copiata = base([chiusa, { ...aperta, valore: 202, data_inizio_validita: '2027-01-01', id: 'c27', note: 'copiato dal 2026, da confermare' }]);
  verifica('una base del 2027 copiata e non confermata resta gialla', copiata.stato === 'parziale' && /confermata/.test(copiata.dettaglio), JSON.stringify(copiata));
  const niente = base([{ ...aperta, data_fine_validita: '2026-12-31' }]);
  verifica('senza tariffa e senza base scritta nel gestionale manca: si fatturerebbe a zero', niente.stato === 'manca' && /zero euro/.test(niente.dettaglio), JSON.stringify(niente));
  verifica('il 2026 ha la sua base, dalla tabella', base([aperta], 2026).stato === 'pronto');
  verifica('e anche senza tabella, dalla base scritta nel gestionale', base([], 2026).stato === 'pronto' && /scritta nel gestionale/.test(base([], 2026).dettaglio));
  verifica('una tariffa passiva di extra raccolta non e una base attiva',
    base([{ ...aperta, direzione: 'PASSIVA', data_inizio_validita: '2027-01-01' }]).stato === 'manca');
}

console.log('I GIORNI AL PRIMO GENNAIO');
verifica('da ottobre', giorniAlPrimoGennaio(2027, '2026-10-10') === 83);
verifica('il giorno stesso', giorniAlPrimoGennaio(2027, '2027-01-01') === 0);
verifica('e dopo e negativo', giorniAlPrimoGennaio(2027, '2027-01-10') === -9);
verifica('senza oggi non si inventa un numero', giorniAlPrimoGennaio(2027, '') === null);

console.log('LA FUNZIONE FA QUESTO, NON ALTRO');
{
  const { readFileSync } = await import('node:fs');
  const f = readFileSync(new URL('../base44/functions/preparaAnno/entry.ts', import.meta.url), 'utf8');
  verifica('la verifica la puo guardare chiunque; copia e conferma solo l amministratore',
    f.includes("if (azione !== 'verifica' && !puoScrivere) return rispostaSolaLettura();"));
  verifica('e nessuna delle due su un anno chiuso', f.includes("if (azione !== 'verifica' && annoChiuso(anno)) {"));
  verifica('un anno gia chiuso non si prepara', f.includes('annoChiuso(anno)'));
  verifica('si puo simulare prima di scrivere', f.includes('if (simula)'));
  verifica('e dopo la copia la lista si rilegge, non si aggiusta a mano',
    f.includes('const tariffeDopo = await fetchAll(svc.Tariffa);'));
  verifica('la regola non e riscritta nella funzione', !/scade il|non ce l'ha/.test(f));
}

console.log('LA SCHEDA C E, E NON DECIDE NIENTE DA SOLA');
{
  const { readFileSync } = await import('node:fs');
  const sorgente = (q) => readFileSync(new URL('../' + q, import.meta.url), 'utf8');
  const pagina = sorgente('src/pages/TargetStatus.jsx');
  verifica('la scheda Nuovo anno e nel modulo dove vive gia la copia dell anno',
    pagina.includes('<TabsTrigger value="nuovo-anno">Nuovo anno</TabsTrigger>')
    && pagina.includes("'nuovo-anno'") && pagina.includes('<NuovoAnno anno={anno} />'));
  const c = sorgente('src/components/target-status/NuovoAnno.jsx');
  verifica('prima di scrivere si simula e si chiede conferma',
    c.includes("azione: 'copia_tariffe', simula: true") && c.includes('AlertDialog'));
  verifica('il pulsante per preparare le tariffe lo vede solo chi puo scrivere',
    c.includes("v.azione === 'copia_tariffe' && dati.puo_scrivere"));
  verifica('e si dice, a chiare lettere, che il prezzo e quello vecchio',
    /da confermare/.test(c) && /prezzo vero arriva dal contratto nuovo/.test(c));
  verifica('anche questa scheda dice perche non ha risposto e offre Riprova',
    c.includes('non ha risposto') && c.includes('Riprova'));
}
// LE DUE GRAFIE DI GATIM (chiusura dell'audit, 11/10/2026). In anagrafica ci
// sono «GATIM» e «GATIM S.R.L.»: il prezzo 2026 sta sulla seconda, quello del
// 2027 l'amministratore lo scrive scegliendo la prima. Per la passiva sono lo
// stesso fornitore (nome normalizzato); per chiaveTariffa erano due, e «Prepara
// le tariffe» copiava il 105 del 2026 accanto al 110 scritto a mano - e la
// passiva pagava la copia, la piu' recente.
console.log("LE DUE GRAFIE DI GATIM E LA COPIA D'ANNO");
{
  const { pianoCopiaTariffe } = await import('../base44/shared/inizializzazioneAnno.ts');
  const { readFileSync } = await import('node:fs');
  const gatim = (p) => ({ direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'TRATTAMENTO', unita_misura: '€/t', stato: 'attivo', ...p });
  const g26 = gatim({ id: 'g26', fornitore_id: 'idB', fornitore_nome: 'GATIM S.R.L.', valore: 105, data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' });
  const g27 = gatim({ id: 'g27', fornitore_id: 'idA', fornitore_nome: 'GATIM', valore: 110, data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' });
  verifica('chiaveTariffa: le due grafie sono la stessa tariffa, come per la passiva', chiaveTariffa(g26) === chiaveTariffa(g27), `${chiaveTariffa(g26)} / ${chiaveTariffa(g27)}`);
  verifica('anche produttore, destinatario e destinazione si confrontano normalizzati',
    chiaveTariffa(gatim({ prestazione: 'TRASPORTO_SECONDARIA', fornitore_nome: 'Transar srl', produttore: 'Nappi Sud Srl A Socio Unico', destinatario: 'Irigom S.r.l.' }))
      === chiaveTariffa(gatim({ prestazione: 'TRASPORTO_SECONDARIA', fornitore_nome: 'TRANSAR SRL', produttore: 'NAPPI SUD SRL', destinatario: 'IRIGOM SRL' })));
  verifica('col 110 scritto a mano su «GATIM», il 105 di «GATIM S.R.L.» non e\' da rinnovare', tariffeDaRinnovare([g26, g27], 2027, 'PASSIVA').length === 0, JSON.stringify(tariffeDaRinnovare([g26, g27], 2027, 'PASSIVA')));
  const piano = pianoCopiaTariffe([g26, g27], 2027, ['PASSIVA']);
  verifica('e la copia non lo crea', piano.da_creare.length === 0, JSON.stringify(piano));

  // Il prezzo nuovo che parte da marzo: gennaio e febbraio restano scoperti, la
  // tariffa e' da rinnovare, ma la copia (1/1-31/12) si sovrapporrebbe a quella
  // scritta. Passa dagli stessi controlli di chi salva a mano: non si crea, e si
  // dice con chi si scontra.
  const daMarzo = { ...g27, data_inizio_validita: '2027-03-01' };
  const p2 = pianoCopiaTariffe([g26, daMarzo], 2027, ['PASSIVA']);
  verifica('il prezzo nuovo da marzo: il 105 e\' da rinnovare (gennaio e febbraio sono scoperti)', tariffeDaRinnovare([g26, daMarzo], 2027, 'PASSIVA').length === 1);
  verifica('ma la copia si scontra con la tariffa scritta e non si crea', p2.da_creare.length === 0 && p2.scartate.length === 1, JSON.stringify(p2));
  verifica('e il motivo dice con chi, all\'italiana', /GATIM 110/.test(p2.scartate[0] && p2.scartate[0].motivo || '') && /01\/03\/2027/.test(p2.scartate[0] && p2.scartate[0].motivo || ''), JSON.stringify(p2.scartate));

  // Senza niente di scritto la copia si fa, una volta sola anche se le righe del
  // 2026 erano due doppioni
  const doppione = { ...g26, id: 'g26b' };
  const p3 = pianoCopiaTariffe([g26, doppione], 2027, ['PASSIVA']);
  verifica('senza il prezzo nuovo la copia si fa, una volta sola', p3.da_creare.length === 1 && p3.da_creare[0].copia.data_inizio_validita === '2027-01-01' && p3.scartate.length === 0, JSON.stringify(p3));

  const src = readFileSync(new URL('../base44/functions/preparaAnno/entry.ts', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('preparaAnno copia secondo il piano e restituisce le scartate', /pianoCopiaTariffe\(tariffe, anno, direzioni\)/.test(src) && /traccia\(svc, 'Tariffa', null, x\.copia,/.test(src) && /falliti, scartate,/.test(src));
}

// UNA TUTTE COPRE RETE E ACI, COME NEI CONFLITTI; E LE COPIE SCARTATE SI DICONO
// (chiusura dell'audit, 11/10/2026, revisione dei soldi). La tratta TRANSAR
// del 2026 scritta RETE a 400, quella del 2027 gia' scritta a mano come TUTTE a
// 420: la lista diceva «manca», il pulsante preparava 0 tariffe (la copia si
// scontrava ed era scartata) e la scheda non diceva perche'. La voce restava
// «manca» per sempre, e dal 1° gennaio rossa nel cruscotto.
console.log('UNA TUTTE COPRE RETE E ACI, E LE COPIE SCARTATE SI DICONO');
{
  const { pianoCopiaTariffe, tariffaCopertaNelNuovoAnno } = await import('../base44/shared/inizializzazioneAnno.ts');
  const { readFileSync } = await import('node:fs');
  const tratta = (p) => ({ direzione: 'PASSIVA', prestazione: 'TRASPORTO_SECONDARIA', fornitore_nome: 'TRANSAR SRL', fornitore_id: 'f-transar', produttore: 'NAPPI SUD SRL', destinatario: 'Irigom S.r.l.', unita_misura: '€/viaggio', stato: 'attivo', ...p });
  const del26 = (tipologia, valore) => tratta({ id: `t26${tipologia}`, tipologia, valore, data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' });
  const del27 = (tipologia, valore) => tratta({ id: `t27${tipologia}`, tipologia, valore, data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' });
  const voce = (tariffe) => listaAnno({ anno: 2027, tariffe, oggi: '2026-11-15' }).voci.find(v => v.chiave === 'tariffe_passive');

  const caso1 = [del26('RETE', 400), del27('TUTTE', 420)];
  verifica('la RETE del 2026 e\' coperta dalla TUTTE del 2027: niente da rinnovare', tariffeDaRinnovare(caso1, 2027, 'PASSIVA').length === 0, JSON.stringify(tariffeDaRinnovare(caso1, 2027, 'PASSIVA')));
  verifica('e la lista non dice «manca» (prima: manca, con «Prepara le tariffe» che ne preparava 0)', voce(caso1).stato !== 'manca' && voce(caso1).azione !== 'copia_tariffe', JSON.stringify(voce(caso1)));
  const p1 = pianoCopiaTariffe(caso1, 2027, ['PASSIVA']);
  verifica('e la copia non c\'e\' da fare, ne\' da scartare', p1.da_creare.length === 0 && p1.scartate.length === 0, JSON.stringify(p1));
  verifica('anche l\'ACI del 2026 e\' coperta dalla TUTTE', tariffaCopertaNelNuovoAnno(del26('ACI', 380), [del27('TUTTE', 420)]));

  const caso2 = [del26('TUTTE', 400), del27('RETE', 420)];
  verifica('una TUTTE del 2026 con la sola RETE nel 2027 resta da rinnovare: l\'ACI il prezzo non ce l\'ha', tariffeDaRinnovare(caso2, 2027, 'PASSIVA').length === 1 && voce(caso2).stato === 'manca');
  const p2 = pianoCopiaTariffe(caso2, 2027, ['PASSIVA']);
  verifica('la copia si scontra con la RETE del 2027 e si scarta, col motivo', p2.da_creare.length === 0 && p2.scartate.length === 1 && /TRANSAR SRL 420/.test(p2.scartate[0].motivo), JSON.stringify(p2.scartate));
  verifica('e il prezzo nel motivo e\' all\'italiana: «420,00 €/viaggio», «1.234,50»', /TRANSAR SRL 420,00 €\/viaggio/.test(p2.scartate[0].motivo)
    && /1\.234,50/.test(pianoCopiaTariffe([del26('RETE', 400), { ...del27('RETE', 1234.5), data_inizio_validita: '2027-03-01' }], 2027, ['PASSIVA']).scartate[0].motivo), p2.scartate[0].motivo);
  const caso3 = [del26('TUTTE', 400), del27('RETE', 420), del27('ACI', 390)];
  verifica('con la RETE e l\'ACI del 2027 la TUTTE del 2026 e\' coperta', tariffeDaRinnovare(caso3, 2027, 'PASSIVA').length === 0);
  const caso4 = [del26('RETE', 400), del27('ACI', 390)];
  verifica('un\'ACI non copre la RETE: da rinnovare, e la copia si fa', tariffeDaRinnovare(caso4, 2027, 'PASSIVA').length === 1 && pianoCopiaTariffe(caso4, 2027, ['PASSIVA']).da_creare.length === 1);
  const altroFornitore = [del26('RETE', 400), { ...del27('TUTTE', 420), fornitore_nome: 'ALTRO TRASPORTATORE', fornitore_id: 'f-altro' }];
  verifica('la TUTTE di un altro fornitore non copre niente', tariffeDaRinnovare(altroFornitore, 2027, 'PASSIVA').length === 1);
  const disattivata = [del26('RETE', 400), { ...del27('TUTTE', 420), stato: 'non_attivo' }];
  verifica('una TUTTE disattivata non copre niente', tariffeDaRinnovare(disattivata, 2027, 'PASSIVA').length === 1);

  // L'attiva: la stessa chiave dei conflitti delle attive. Il 2027 scritto a
  // mano al chilo (0,21 €/kg) e' la stessa tariffa del 202 €/t del 2026: la copia
  // si scarterebbe, quindi non e' da rinnovare.
  const attiva = (p) => ({ direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', regione: 'Campania', stato: 'attivo', ...p });
  const caso5 = [attiva({ id: 'a26', valore: 202, unita_misura: '€/t', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' }),
    attiva({ id: 'a27', valore: 0.21, unita_misura: '€/kg', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31' })];
  verifica('attiva: la tariffa del 2027 in un\'altra unita\' copre quella del 2026', tariffeDaRinnovare(caso5, 2027, 'ATTIVA').length === 0
    && pianoCopiaTariffe(caso5, 2027, ['ATTIVA']).scartate.length === 0, JSON.stringify(pianoCopiaTariffe(caso5, 2027, ['ATTIVA'])));

  const scheda = readFileSync(new URL('../src/components/target-status/NuovoAnno.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('la scheda mostra le scartate nella conferma', /conferma\?\.scartate\?\.length > 0/.test(scheda) && /conferma\.scartate\.map\(/.test(scheda));
  verifica('e nel messaggio finale, col motivo', /const scartate = res\.data\.scartate \|\| \[\]/.test(scheda) && /scartate\.map\(testoScartata\)/.test(scheda) && /s\.motivo/.test(scheda));
  verifica('e con zero tariffe da copiare non propone «Prepara»', /conferma\?\.quante > 0 && \(\s*<AlertDialogAction/.test(scheda));
}

// LA FUNZIONE, CON UN ARCHIVIO FINTO: le scartate arrivano a chi preme, in
// simulazione e dopo la copia, con quanto serve a riconoscerle.
console.log('PREPARAANNO RESTITUISCE LE SCARTATE');
{
  const { build } = await import('esbuild');
  const { fileURLToPath } = await import('node:url');
  const SDK_FINTO = `
const entita = (nome) => ({
  list: async (_o, _l, skip) => (skip ? [] : (globalThis.__ARCHIVI[nome] || [])),
  filter: async (_f, _o, _l, skip) => (skip ? [] : (globalThis.__ARCHIVI[nome] || [])),
  create: async (r) => { globalThis.__SCRITTE.push('create ' + nome); return { id: 'n', ...r }; },
  update: async () => { globalThis.__SCRITTE.push('update ' + nome); return {}; },
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
  const pacchetto = await build({
    entryPoints: [fileURLToPath(new URL('../base44/functions/preparaAnno/entry.ts', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
    } }],
  });
  const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  const tratta = { direzione: 'PASSIVA', prestazione: 'TRASPORTO_SECONDARIA', fornitore_nome: 'TRANSAR SRL', fornitore_id: 'f-transar', produttore: 'NAPPI SUD SRL', destinatario: 'Irigom S.r.l.', unita_misura: '€/viaggio', stato: 'attivo' };
  const anno = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date())) + 1;
  globalThis.__ARCHIVI = { Tariffa: [
    { ...tratta, id: 'vecchia', tipologia: 'TUTTE', valore: 400, data_inizio_validita: `${anno - 1}-01-01`, data_fine_validita: `${anno - 1}-12-31` },
    { ...tratta, id: 'nuova', tipologia: 'RETE', valore: 420, data_inizio_validita: `${anno}-01-01`, data_fine_validita: `${anno}-12-31` },
  ] };
  const chiama = async (corpo) => {
    globalThis.__SCRITTE = [];
    const r = await modulo.default({ json: async () => corpo });
    return { stato: r.status, j: await r.json(), scritte: globalThis.__SCRITTE };
  };
  const sim = await chiama({ anno, azione: 'copia_tariffe', simula: true });
  verifica('in simulazione: 0 da copiare e una scartata, con tipologia e motivo', sim.stato === 200 && sim.j.quante === 0 && sim.j.scartate.length === 1
    && sim.j.scartate[0].tipologia === 'TUTTE' && sim.j.scartate[0].chi === 'TRANSAR SRL' && /si sovrappone/.test(sim.j.scartate[0].motivo), JSON.stringify(sim.j).slice(0, 400));
  const vera = await chiama({ anno, azione: 'copia_tariffe' });
  verifica('dopo la copia: niente scritto, e la scartata torna col motivo', vera.stato === 200 && vera.scritte.length === 0 && vera.j.creati === 0 && vera.j.scartate.length === 1, JSON.stringify({ s: vera.stato, w: vera.scritte, c: vera.j.creati, sc: vera.j.scartate }));
}

// LA CONFERMA DEI VALORI COPIATI ENTRA NELLO STORICO (decisioni dell'utente del
// 13/10/2026, gruppo B). Confermare toglie la nota «da confermare» e non cambia
// nessun campo tracciato: fino a quel giorno lo storico delle modifiche non
// registrava niente, e «chi ha confermato il prezzo del 2027, e quando» lo
// diceva solo la nota. Ora una riga per ogni valore confermato, con chi, quando
// e «confermato il valore copiato dall'anno prima»; il banco e' quello delle
// funzioni intere (prove/dati/bancoFunzioni.mjs), che tiene ModificaDato.
console.log('LA CONFERMA DELLE TARIFFE COPIATE LASCIA LA SUA RIGA NELLO STORICO');
{
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  const pa = await caricaFunzione('preparaAnno');
  const anno = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date())) + 1;
  const nota = `copiato dal ${anno - 1}, da confermare`;
  const dell = (p) => ({ unita_misura: '€/t', stato: 'attivo', data_inizio_validita: `${anno}-01-01`, data_fine_validita: `${anno}-12-31`, ...p });
  const DB = { Tariffa: [
    dell({ id: 'a1', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'Ecotyre Scrl', servizio_ecotyre: 'TRASP_TRATT', valore: 202, note: nota }),
    dell({ id: 'a2', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'Ecotyre Scrl', valore: 190, note: `${nota} · accordo di giugno` }),
    dell({ id: 'a3', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 210 }),
    dell({ id: 'p1', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_nome: 'EMMESSE SRL', fornitore_id: 'fE', valore: 90, note: nota }),
  ] };
  const sim = await chiama(pa, { db: DB, corpo: { anno, azione: 'conferma_tariffe', direzione: 'ATTIVA', simula: true } });
  verifica('in simulazione dice quante, e non scrive niente, nemmeno nello storico', sim.stato === 200 && sim.j.quante === 2 && sim.scritte.length === 0, JSON.stringify({ j: sim.j, s: sim.scritte }));

  const r = await chiama(pa, { db: DB, corpo: { anno, azione: 'conferma_tariffe', direzione: 'ATTIVA' } });
  const reg = r.db.ModificaDato || [];
  verifica('due tariffe attive confermate, due righe nello storico, una per valore', r.stato === 200 && r.j.confermate === 2 && reg.length === 2
    && reg.map(x => x.record_id).sort().join() === 'a1,a2', JSON.stringify({ j: r.j.confermate, reg }));
  verifica('il prezzo, uguale prima e dopo: e\' stato controllato, non cambiato', reg.length === 2 && reg.every(x => x.entita === 'Tariffa' && x.campo === 'valore' && x.operazione === 'update' && x.prima === x.dopo)
    && (reg.find(x => x.record_id === 'a1') || {}).dopo === '202' && (reg.find(x => x.record_id === 'a2') || {}).dopo === '190', JSON.stringify(reg));
  verifica('chi, quando, da dove e perche\'', reg.length === 2 && reg.every(x => x.utente === 'prova@prova' && x.origine === 'Nuovo anno, tariffe' && x.il && x.il === reg[0].il
    && x.motivo === `confermato il valore copiato dall'anno prima (${anno - 1}), sul contratto ${anno}`), JSON.stringify(reg));
  verifica('con l\'etichetta e l\'anno della tariffa, l\'unita\' e il segno: l\'attiva non e\' un costo', reg.length === 2 && reg.every(x => x.anno === anno && x.unita === '€/t' && x.riservato === false && /^Ecotyre Scrl · attiva · (RETE|ACI)/.test(x.etichetta)), JSON.stringify(reg));
  verifica('le righe si scrivono insieme, una scrittura sola nel registro', r.scritte.filter(s => s.entita === 'ModificaDato').length === 1, JSON.stringify(r.scritte));
  verifica('e la risposta porta la traccia con le due righe', r.j.traccia && r.j.traccia.scritta === true && r.j.traccia.righe === 2, JSON.stringify(r.j.traccia));
  const dopo = r.db.Tariffa;
  verifica('la nota della copia se ne va, il resto della nota resta, e chi ha confermato e\' scritto', !daConfermare(dopo.find(x => x.id === 'a1')) && /accordo di giugno/.test(dopo.find(x => x.id === 'a2').note) && /^Confermata sul contratto/.test(dopo.find(x => x.id === 'a1').note) && /prova@prova/.test(dopo.find(x => x.id === 'a1').note), JSON.stringify(dopo));
  verifica('la tariffa gia\' confermata e la passiva non si toccano', !r.scritte.some(s => s.entita === 'Tariffa' && ['a3', 'p1'].includes(s.id)) && daConfermare(dopo.find(x => x.id === 'p1')), JSON.stringify(r.scritte));

  const p = await chiama(pa, { db: DB, corpo: { anno, azione: 'conferma_tariffe', direzione: 'PASSIVA' } });
  const regP = p.db.ModificaDato || [];
  verifica('la passiva: la sua riga, riservata, perche\' il prezzo di un fornitore e\' un costo', p.stato === 200 && regP.length === 1 && regP[0].record_id === 'p1' && regP[0].riservato === true && regP[0].prima === '90' && regP[0].dopo === '90' && /^EMMESSE SRL · RACCOLTA · RETE/.test(regP[0].etichetta), JSON.stringify(regP));

  const niente = await chiama(pa, { db: r.db, corpo: { anno, azione: 'conferma_tariffe', direzione: 'ATTIVA' } });
  verifica('ripetuta, non c\'e\' niente da confermare e nessuna riga in piu\'', niente.stato === 200 && niente.j.confermate === 0 && (niente.db.ModificaDato || []).length === 2 && !niente.scritte.length, JSON.stringify({ j: niente.j.confermate, s: niente.scritte }));
  const utente = await chiama(pa, { db: DB, ruolo: 'user', corpo: { anno, azione: 'conferma_tariffe', direzione: 'ATTIVA' } });
  verifica('chi non e\' amministratore non conferma e non scrive', utente.stato !== 200 && !utente.scritte.length, JSON.stringify({ s: utente.stato, w: utente.scritte }));
}
// LA LISTA E IL MODULO CONTRATTI DICONO GLI STESSI ATTESI (15/10/2026, difetto
// 21): preparaAnno calcola i totali con situazioneContratti, le stesse letture e
// la stessa regola di contrattiAnno, e li passa alla lista. Il banco e' quello
// delle funzioni intere: due archivi uguali, due funzioni, lo stesso numero.
console.log('LA VOCE DEI CONTRATTI DI PREPARAANNO E IL MODULO CONTRATTI DICONO GLI STESSI NUMERI');
{
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  const ca = await caricaFunzione('contrattiAnno');
  const pa = await caricaFunzione('preparaAnno');
  const anno = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date())) + 1;
  const prima = anno - 1;
  // due ritiri di rete dell'anno prima: NAPPI SUD raccoglie, Irigom tratta
  const mov = (id) => ({
    id, stato: 'terminato', id_ordine: 'ET' + id, numero_fir: 'F' + id, trasportatore: 'NAPPI SUD SRL', destinazione: 'Irigom S.r.l.', tipo_destinazione: 'imp',
    classe: 'P', peso_effettivo: 2000, provincia: 'NA', regione: 'Campania', cer: '160103', ordine_immesso_il: `${prima}-09-01T10:00:00.000Z`,
    trasporto_iniziato_il: `${prima}-09-10T08:00:00.000Z`, trasporto_finito_il: `${prima}-09-10T10:00:00.000Z`, ordine_chiuso_il: `${prima}-09-12T10:00:00.000Z`,
  });
  const contratto = (chiave, nome, tipo, stato) => ({ id: `c-${chiave}-${tipo}`, anno, soggetto_chiave: chiave, soggetto_nome: nome, tipo_contratto: tipo, canale: 'RETE', stato });
  const DB = (contratti) => ({
    Fornitore: [{ id: 'fN', ragione_sociale: 'NAPPI SUD SRL', stato: 'attivo', ruolo_raccolta: true }, { id: 'fI', ragione_sociale: 'Irigom S.r.l.', stato: 'attivo', ruolo_trattamento: true }],
    PrimariaRete: [mov('1'), mov('2')], PrimariaAci: [], ExtraRaccolta: [], Secondaria: [], Tariffa: [], ContrattoFornitore: contratti,
    ModelloContratto: [], TargetRaccoglitore: [], ImpiantoTargetSecondaria: [], QualificaInclusione: [], GiacenzaSito: [], CommessaEcotyre: [], GiacenzaStoccaggio: [],
  });
  const confronta = async (contratti) => {
    const c = await chiama(ca, { db: DB(contratti), corpo: { anno } });
    const p = await chiama(pa, { db: DB(contratti), corpo: { anno } });
    return { totali: c.j.totali, voce: (p.j.voci || []).find(v => v.chiave === 'contratti_fornitori'), stato: p.stato };
  };
  const nessuno = await confronta([]);
  verifica('senza contratti: due attesi in tutti e due i moduli, e la voce «manca»', nessuno.stato === 200 && nessuno.totali.attesi === 2 && nessuno.voce.attesi === 2 && nessuno.voce.controfirmati === 0 && nessuno.voce.stato === 'manca', JSON.stringify(nessuno));
  const uno = await confronta([contratto('nappi sud', 'NAPPI SUD SRL', 'raccolta', 'controfirmato'), contratto('irigom', 'Irigom S.r.l.', 'trattamento', 'annullato')]);
  verifica('uno controfirmato e uno annullato: 1 su 2, «parziale», come il modulo Contratti', uno.totali.controfirmati === 1 && uno.voce.controfirmati === 1 && uno.voce.attesi === uno.totali.attesi && uno.voce.stato === 'parziale', JSON.stringify(uno));
  const tutti = await confronta([contratto('nappi sud', 'NAPPI SUD SRL', 'raccolta', 'controfirmato'), contratto('irigom', 'Irigom S.r.l.', 'trattamento', 'controfirmato')]);
  verifica('controprova: tutti e due controfirmati, «pronto»', tutti.totali.attesi === 2 && tutti.totali.controfirmati === 2 && tutti.voce.stato === 'pronto', JSON.stringify(tutti));
}
// CHI NON E' AMMINISTRATORE NON LEGGE IL COSTO DI UNA TARIFFA DA CHIUDERE
// (revisione del 15/10/2026). Lo script del revisore: una raccolta GATIM di rete
// 2027 a 73 €/t scritta senza fine (il sito di oggi la salva ancora), e chi non
// e' amministratore apre Target & Status › Nuovo anno 2028. Con la voce «da
// chiudere» la risposta portava «73,00 €/t» e { valore: 73 }. La funzione vera,
// sul banco, col ruolo di chi legge soltanto.
console.log('LA VOCE «DA CHIUDERE» NON DICE IL PREZZO DI UN FORNITORE A CHI NON E\' AMMINISTRATORE');
{
  const { caricaFunzione, chiama } = await import('./dati/bancoFunzioni.mjs');
  const pa = await caricaFunzione('preparaAnno');
  const gatim = { id: 'g27aperta', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'x', fornitore_nome: 'GATIM S.R.L.', regione: 'Calabria',
    unita_misura: '€/t', valore: 73, stato: 'attivo', data_inizio_validita: '2027-01-01', data_fine_validita: null };
  const DB = { Tariffa: [gatim], GiacenzaSito: [], TargetRaccoglitore: [], CommessaEcotyre: [], ContrattoFornitore: [], GiacenzaStoccaggio: [],
    Fornitore: [], PrimariaRete: [], PrimariaAci: [], ExtraRaccolta: [], Secondaria: [], ModelloContratto: [], ImpiantoTargetSecondaria: [], QualificaInclusione: [] };
  const r = await chiama(pa, { db: DB, ruolo: 'user', corpo: { anno: 2028 } });
  const pas = ((r.j && r.j.voci) || []).find(v => v.chiave === 'tariffe_passive') || {};
  verifica('chi non e\' amministratore legge la lista del 2028: GATIM «da chiudere», col nome', r.stato === 200 && r.j.puo_scrivere === false && pas.stato === 'manca' && /GATIM S\.R\.L\. raccolta RETE Calabria/.test(pas.dettaglio || ''), JSON.stringify({ s: r.stato, pas }));
  verifica('ma nella risposta il costo di GATIM non c\'e\' da nessuna parte', !/73/.test(JSON.stringify(r.j)), JSON.stringify(pas));
}
console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
