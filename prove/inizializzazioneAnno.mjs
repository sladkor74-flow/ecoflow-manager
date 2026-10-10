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
import { listaAnno, tariffeDaRinnovare, tariffeDaConfermare, copiaTariffa, copreIlGiorno, chiaveTariffa, giorniAlPrimoGennaio } from '../base44/shared/inizializzazioneAnno.ts';
import { daConfermare } from '../base44/shared/annoTarget.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Le sette tariffe attive del 2026 e tre passive, come stanno in archivio.
const t = (p) => ({ unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', ...p });
const TARIFFE_2026 = [
  t({ direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'Ecotyre Scrl', servizio_ecotyre: 'TRASP_TRATT', valore: 202 }),
  t({ direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'Ecotyre Scrl', valore: 202 }),
  t({ direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'Ecotyre Scrl', regione: 'Campania', valore: 95 }),
  t({ direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'Ecotyre Scrl', regione: 'Puglia', valore: 88 }),
  t({ direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_nome: 'Emmesse', destinazione: 'Gatim', valore: 72 }),
  t({ direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_nome: 'Emmesse', destinazione: 'Irigom', valore: 90 }),
  t({ direzione: 'PASSIVA', tipologia: 'ACI', prestazione: 'TRATTAMENTO', fornitore_nome: 'Tecnogum', valore: 95 }),
];

console.log('QUANDO UNA TARIFFA COPRE UN GIORNO');
verifica('dentro la finestra', copreIlGiorno(TARIFFE_2026[0], '2026-06-30'));
verifica('fuori, il giorno dopo la scadenza', !copreIlGiorno(TARIFFE_2026[0], '2027-01-01'));
verifica('senza data di fine vale per sempre', copreIlGiorno(t({ data_fine_validita: '' }), '2030-01-01'));
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
  const vuoto = listaAnno({ anno: 2027, tariffe: TARIFFE_2026, piazzali: ['irigom', 'nappi sud'], rilevazioni: [], oggi: '2026-10-10' });
  verifica('sei voci', vuoto.voci.length === 6, String(vuoto.voci.length));
  verifica('tutte da fare, e il conto lo dice', vuoto.mancanti === 6 && vuoto.pronte === 0 && vuoto.pronto === false);
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
}

console.log('QUANDO L ANNO E PRONTO, LA LISTA TACE');
{
  const pronto = listaAnno({
    anno: 2027,
    // Le tariffe copiate E confermate: nessuna nota di copia.
    tariffe: TARIFFE_2026.map(x => ({ ...copiaTariffa(x, 2027), note: '' })),
    giacenzeSito: [{ anno: 2027, sito: 'Irigom', tipo_destinazione: 'imp' }],
    impiantiTarget: [{ anno: 2027, impianto: 'Irigom', mese: 'Gennaio', target: 100 }],
    commesse: [{ anno: 2027, target_annuo_t: 11000 }],
    contrattiFornitore: [{ anno: 2027 }, { anno: 2027 }, { anno: 2026 }],
    piazzali: ['irigom'],
    rilevazioni: [{ sito: 'irigom', data_rilevazione: '2026-12-31' }],
    oggi: '2026-12-31',
  });
  verifica('sei voci pronte e niente da fare', pronto.pronte === 6 && pronto.mancanti === 0 && pronto.pronto === true,
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
  verifica('non offre piu di copiarle: sono gia li', att.azione === '');
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
  verifica('la verifica la puo guardare chiunque, la copia solo l amministratore',
    f.includes("if (azione === 'copia_tariffe' && !puoScrivere) return rispostaSolaLettura();"));
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
console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
