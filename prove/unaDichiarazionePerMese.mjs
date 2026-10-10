// Prova di UNA DICHIARAZIONE PER MESE, 10/10/2026.
//
// Richiesta dell'utente: «fai in modo che non debbano esserci dei duplicati
// quando si inserisce a mano e quando avviene automaticamente, ok solo per
// l'extra raccolta che non e' gestita a portale ma per il resto no».
//
// La chiave vera di una dichiarazione mensile non e' un'opinione: e' quella con
// cui il riepilogo aggancia le righe ai mesi, cioe' sito normalizzato, canale,
// provenienza e mese dentro l'anno. L'OPERAZIONE NON C'ENTRA - R1 o R3 e' una
// proprieta' del sito - e proprio per questo nasceva la gemella: la griglia
// cercava la cella anche per operazione, e il form di un flusso nuovo propone
// R3 mentre Irigom e T-Cycle sono R1.
//
// Quello che una gemella fa, se passa: il riepilogo ne tiene una sola e quelle
// tonnellate sparis cono, le giacenze le sommano e si contano due volte. Lo
// stesso errore, un dato in meno da una parte e uno in piu' dall'altra.
//
// L'extra raccolta e' l'eccezione, e allora chi legge DEVE sommare: permettere
// la seconda riga senza sommarla vorrebbe dire perderla.
// npm run prove
import {
  chiaveDichiarazione, ammetteRipetizioni, esitoScrittura, righeSullaStessaChiave,
  doppioniDichiarazioni, unisciDichiarazioni, kgCaricatiDi, CANALE_CON_RIPETIZIONI,
} from '../base44/shared/dichiarazioniImpianti.ts';
import { fotografiaDelGiorno, notaDoppioni, leggiFotografia } from '../base44/shared/indicatoriGiorno.ts';
import { cruscotto } from '../base44/shared/cruscotto.ts';
import { normalizzaRagioneSociale } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const norm = normalizzaRagioneSociale;
const chiaveDi = norm;
const K = (d) => chiaveDichiarazione(d, norm);

console.log('LA CHIAVE: SITO, CANALE, PROVENIENZA, MESE');
// I due nomi veri di Gatim negli archivi: impianto «Gatim», piazzale «GATIM S.R.L.».
verifica('due scritture dello stesso soggetto fanno la stessa chiave',
  K({ sito: 'Gatim', canale: 'ACI', provenienza: 'primaria', mese: 'Aprile' })
  === K({ sito: 'GATIM S.R.L.', canale: 'ACI', provenienza: 'primaria', mese: 'Aprile' }));
verifica("l'operazione non entra nella chiave: e' una proprieta' del sito",
  K({ sito: 'Irigom S.r.l.', canale: 'RETE', mese: 'Marzo', operazione: 'R1' })
  === K({ sito: 'Irigom S.r.l.', canale: 'RETE', mese: 'Marzo', operazione: 'R3' }));
verifica('il canale la cambia', K({ sito: 'A', canale: 'RETE', mese: 'Marzo' }) !== K({ sito: 'A', canale: 'ACI', mese: 'Marzo' }));
verifica('la provenienza la cambia: ACI primaria e secondaria sono due dichiarazioni',
  K({ sito: 'Gatim', canale: 'ACI', provenienza: 'primaria', mese: 'Aprile' })
  !== K({ sito: 'Gatim', canale: 'ACI', provenienza: 'secondaria', mese: 'Aprile' }));
verifica('il mese la cambia', K({ sito: 'A', canale: 'RETE', mese: 'Marzo' }) !== K({ sito: 'A', canale: 'RETE', mese: 'Aprile' }));
verifica('senza canale vale la rete', K({ sito: 'A', mese: 'Marzo' }) === K({ sito: 'A', canale: 'RETE', mese: 'Marzo' }));
verifica('e senza normalizzatore non si schianta', typeof chiaveDichiarazione({ sito: 'A', mese: 'Marzo' }) === 'string');

console.log("DOVE RIPETERSI E' LEGITTIMO");
verifica("solo l'extra raccolta", ammetteRipetizioni('EXTRA_RACCOLTA') === true);
verifica('la rete no', ammetteRipetizioni('RETE') === false);
verifica("l'ACI no", ammetteRipetizioni('ACI') === false);
verifica('senza canale si intende la rete, quindi no', ammetteRipetizioni('') === false);
verifica("il canale dell'eccezione sta scritto in un posto solo", CANALE_CON_RIPETIZIONI === 'EXTRA_RACCOLTA');

// --- Il caso vero: Irigom, rete, marzo, scritta R1 ---
const IRIGOM_MARZO = { id: 'd1', sito: 'Irigom S.r.l.', anno: 2026, mese: 'Marzo', canale: 'RETE', provenienza: '', operazione: 'R1', quantita_kg: 370000, caricata_inviata: true };

console.log('SI PUO\' SCRIVERE? LA STESSA RISPOSTA PER TUTTI');
{
  const vuoto = esitoScrittura([], { sito: 'Irigom S.r.l.', anno: 2026, mese: 'Marzo', canale: 'RETE' }, { anno: 2026, chiaveDi });
  verifica('su un mese vuoto si crea', vuoto.azione === 'crea' && !vuoto.esistente, JSON.stringify(vuoto.azione));
  // IL CASO CHE GENERAVA LA GEMELLA: il form propone R3, la riga c'e' ed e' R1.
  const conR3 = esitoScrittura([IRIGOM_MARZO], { sito: 'Irigom S.r.l.', anno: 2026, mese: 'Marzo', canale: 'RETE', operazione: 'R3' }, { anno: 2026, chiaveDi });
  verifica('un flusso proposto R3 trova la riga R1 e la aggiorna', conR3.azione === 'aggiorna' && conR3.esistente.id === 'd1', JSON.stringify(conR3.azione));
  // E il nome scritto in un altro modo non deve far nascere la seconda.
  const altroNome = esitoScrittura([IRIGOM_MARZO], { sito: 'IRIGOM SRL', anno: 2026, mese: 'Marzo', canale: 'RETE' }, { anno: 2026, chiaveDi });
  verifica("un'altra scrittura del nome non crea una riga nuova", altroNome.azione === 'aggiorna' && altroNome.esistente.id === 'd1');
  // Un altro anno non e' lo stesso mese.
  const altroAnno = esitoScrittura([{ ...IRIGOM_MARZO, anno: 2025 }], { sito: 'Irigom S.r.l.', anno: 2026, mese: 'Marzo', canale: 'RETE' }, { anno: 2026, chiaveDi });
  verifica("la riga dell'anno prima non c'entra", altroAnno.azione === 'crea');
  // Chi modifica la riga che ha in mano non si trova da solo.
  const seStessa = esitoScrittura([IRIGOM_MARZO], { ...IRIGOM_MARZO }, { anno: 2026, chiaveDi });
  verifica('aggiornare la propria riga non la conta come gemella', seStessa.azione === 'crea' || seStessa.esistente === null, JSON.stringify(seStessa.azione));
}

console.log('DUE GEMELLE: NON SI SCRIVE, E SI DICE PERCHE\'');
{
  const due = [IRIGOM_MARZO, { ...IRIGOM_MARZO, id: 'd2', operazione: 'R3', quantita_kg: 12000, caricata_inviata: false }];
  const e = esitoScrittura(due, { sito: 'Irigom S.r.l.', anno: 2026, mese: 'Marzo', canale: 'RETE' }, { anno: 2026, chiaveDi });
  verifica('con due righe non si sceglie a caso', e.azione === 'rifiuta' && e.esistente === null, JSON.stringify(e.azione));
  verifica('e il motivo dice quante e dove', /2 dichiarazioni/.test(e.motivo) && /Marzo/.test(e.motivo) && /Rete/.test(e.motivo), e.motivo);
  verifica('e dice che non lo decide il gestionale', /non lo decide il gestionale/.test(e.motivo), e.motivo);
}

console.log('L\'EXTRA RACCOLTA: DUE CAMPAGNE NELLO STESSO MESE SONO DUE COSE VERE');
{
  const campagna = { id: 'x1', sito: 'Irigom S.r.l.', anno: 2026, mese: 'Luglio', canale: 'EXTRA_RACCOLTA', provenienza: '', quantita_kg: 460, caricata_inviata: true };
  const senzaChiedere = esitoScrittura([campagna], { sito: 'Irigom S.r.l.', anno: 2026, mese: 'Luglio', canale: 'EXTRA_RACCOLTA' }, { anno: 2026, chiaveDi });
  verifica('scrivere nella casella aggiorna quella che c\'e\', non aggiunge', senzaChiedere.azione === 'aggiorna', JSON.stringify(senzaChiedere.azione));
  const chiedendo = esitoScrittura([campagna], { sito: 'Irigom S.r.l.', anno: 2026, mese: 'Luglio', canale: 'EXTRA_RACCOLTA' }, { anno: 2026, chiaveDi, ripeti: true });
  verifica('chiedendolo si aggiunge la seconda campagna', chiedendo.azione === 'crea', JSON.stringify(chiedendo.azione));
  const reteRipeti = esitoScrittura([IRIGOM_MARZO], { sito: 'Irigom S.r.l.', anno: 2026, mese: 'Marzo', canale: 'RETE' }, { anno: 2026, chiaveDi, ripeti: true });
  verifica('ma sulla rete nemmeno chiedendolo', reteRipeti.azione === 'aggiorna', JSON.stringify(reteRipeti.azione));
}

console.log('I DOPPIONI CHE CI SONO GIA\'');
{
  // I tre mesi veri di Gatim: primaria E secondaria nello stesso mese. NON sono
  // doppioni, sono due dichiarazioni diverse, e un controllo che le segnalasse
  // manderebbe a correggere una cosa giusta.
  const gatimVero = [
    { id: 'a', sito: 'Gatim', anno: 2026, mese: 'Aprile', canale: 'ACI', provenienza: 'primaria', quantita_kg: 8200, caricata_inviata: true },
    { id: 'b', sito: 'Gatim', anno: 2026, mese: 'Aprile', canale: 'ACI', provenienza: 'secondaria', quantita_kg: 14340, caricata_inviata: true },
  ];
  verifica('primaria e secondaria nello stesso mese non sono un doppione',
    doppioniDichiarazioni(gatimVero, { anno: 2026, chiaveDi }).length === 0,
    JSON.stringify(doppioniDichiarazioni(gatimVero, { anno: 2026, chiaveDi })));

  const conGemelle = [
    ...gatimVero,
    { id: 'c', sito: 'GATIM S.R.L.', anno: 2026, mese: 'Aprile', canale: 'ACI', provenienza: 'primaria', quantita_kg: 8200, caricata_inviata: true },
    { id: 'd', sito: 'Irigom S.r.l.', anno: 2026, mese: 'Marzo', canale: 'RETE', provenienza: '', quantita_kg: 370000, caricata_inviata: true },
    { id: 'e', sito: 'Irigom S.r.l.', anno: 2026, mese: 'Marzo', canale: 'RETE', provenienza: '', quantita_kg: 370000, caricata_inviata: false },
    // Extra raccolta ripetuta: legittima, resta fuori.
    { id: 'f', sito: 'Irigom S.r.l.', anno: 2026, mese: 'Luglio', canale: 'EXTRA_RACCOLTA', provenienza: '', quantita_kg: 460, caricata_inviata: true },
    { id: 'g', sito: 'Irigom S.r.l.', anno: 2026, mese: 'Luglio', canale: 'EXTRA_RACCOLTA', provenienza: '', quantita_kg: 300, caricata_inviata: true },
  ];
  const dopp = doppioniDichiarazioni(conGemelle, { anno: 2026, chiaveDi });
  verifica('due doppioni, non tre', dopp.length === 2, JSON.stringify(dopp.map(x => x.chiave)));
  verifica("l'extra raccolta ripetuta non e' fra loro",
    !dopp.some(x => x.canale === 'EXTRA_RACCOLTA'), JSON.stringify(dopp.map(x => x.canale)));
  verifica('il piu\' grosso viene per primo', dopp[0].canale === 'RETE' && dopp[0].kg_in_piu === 370000, JSON.stringify([dopp[0].canale, dopp[0].kg_in_piu]));
  verifica('e dice dove si sistema: sito, mese, canale, provenienza',
    dopp[1].mese === 'Aprile' && dopp[1].canale === 'ACI' && dopp[1].provenienza === 'primaria' && /GATIM|Gatim/.test(dopp[1].sito),
    JSON.stringify(dopp[1]));
  verifica('dice quante righe e quanti chili di troppo', dopp[1].quante === 2 && dopp[1].kg === 16400 && dopp[1].kg_in_piu === 8200, JSON.stringify(dopp[1]));
  verifica('e quante sono caricate a portale, che e\' quello che decurta', dopp[0].caricate === 1 && dopp[1].caricate === 2, JSON.stringify([dopp[0].caricate, dopp[1].caricate]));
  verifica('porta gli id, perche\' poi una va tolta', dopp[1].ids.length === 2 && dopp[1].ids.includes('c'), JSON.stringify(dopp[1].ids));
  verifica("le righe sulla stessa chiave si sanno elencare", righeSullaStessaChiave(conGemelle, { sito: 'Irigom S.r.l.', canale: 'RETE', provenienza: '', mese: 'Marzo', anno: 2026 }, { anno: 2026, chiaveDi }).length === 2);
}

console.log('DUE RIGHE SULLA STESSA CHIAVE, LETTE COME SI DEVE');
{
  const a = { id: 'f', canale: 'EXTRA_RACCOLTA', quantita_kg: 460, granulo_kg: 400, metalli_kg: 60, caricata_inviata: true };
  const b = { id: 'g', canale: 'EXTRA_RACCOLTA', quantita_kg: 300, granulo_kg: 250, metalli_kg: 50, caricata_inviata: false };
  const u = unisciDichiarazioni(a, b);
  verifica('extra raccolta: le quantita\' si sommano', u.quantita_kg === 760, String(u.quantita_kg));
  verifica('e i materiali con loro', u.granulo_kg === 650 && u.metalli_kg === 110, JSON.stringify([u.granulo_kg, u.metalli_kg]));
  verifica('si sa che sono due', u.ripetizioni === 2, String(u.ripetizioni));
  // QUESTA E' LA PARTE CHE CONTA: caricato vuol dire caricato, e decurta.
  verifica('caricata vuol dire caricata tutta: con una sola a portale non lo e\'', u.caricata_inviata === false, String(u.caricata_inviata));
  verifica('ma i chili che hanno decurtato sono quelli veri, non il totale', u.caricato_kg === 460, String(u.caricato_kg));
  verifica('e kgCaricatiDi li legge', kgCaricatiDi(u) === 460, String(kgCaricatiDi(u)));
  verifica('su una riga sola e\' tutto o niente', kgCaricatiDi({ quantita_kg: 100, caricata_inviata: true }) === 100 && kgCaricatiDi({ quantita_kg: 100, caricata_inviata: false }) === 0);
  verifica('e senza riga e\' zero, non un errore', kgCaricatiDi(null) === 0);
  const tre = unisciDichiarazioni(u, { id: 'h', canale: 'EXTRA_RACCOLTA', quantita_kg: 40, caricata_inviata: true });
  verifica('tre campagne si sommano come due', tre.quantita_kg === 800 && tre.ripetizioni === 3 && tre.caricato_kg === 500, JSON.stringify([tre.quantita_kg, tre.ripetizioni, tre.caricato_kg]));

  // Sugli altri canali NON si somma: sommare un errore lo nasconderebbe dentro
  // un numero credibile. Si tiene la prima e si segna che ce n'e' un'altra.
  const r1 = { id: 'd', canale: 'RETE', quantita_kg: 370000, caricata_inviata: true };
  const r2 = { id: 'e', canale: 'RETE', quantita_kg: 370000, caricata_inviata: false };
  const ur = unisciDichiarazioni(r1, r2);
  verifica('rete: non si somma niente', ur.quantita_kg === 370000, String(ur.quantita_kg));
  verifica("ma si sa che ce n'e' un'altra", (ur.altre || []).includes('e'), JSON.stringify(ur.altre));
  verifica('una sola riga resta se stessa', unisciDichiarazioni(null, r1).id === 'd' && unisciDichiarazioni(r1, null).id === 'd');
}

console.log('IL GUARDIANO LO GUARDA, E UN DOPPIONE SI PRESENTA COME DOPPIONE');
const SITI = [
  { sito: 'IRIGOM S.R.L.', chiave: 'irigom', tipo_destinazione: 'imp', giacenza_portale_t: 652.84, giacenza_calcolata_t: 652.84, scarto_t: 0, quadra: true, giacenze_canale: [{ canale: 'RETE', giacenza_t: 652.84, entrato_t: 1000, dichiarato_caricato_t: 347.16 }], flussi: [] },
  { sito: 'T-CYCLE INDUSTRIES SRL', chiave: 'tcycle', tipo_destinazione: 'imp', giacenza_portale_t: 364.8, giacenza_calcolata_t: 364.8, scarto_t: 0, quadra: true, giacenze_canale: [{ canale: 'RETE', giacenza_t: 364.8, entrato_t: 800, dichiarato_caricato_t: 435.2 }], flussi: [] },
];
const DOPPIONI = [{ chiave: 'IRIGOMSRL|RETE||Marzo', sito: 'Irigom S.r.l.', canale: 'RETE', provenienza: '', mese: 'Marzo', quante: 2, kg: 740000, kg_in_piu: 370000, caricate: 1, ids: ['d', 'e'] }];
{
  const pulita = fotografiaDelGiorno(SITI, { giorno: '2026-10-10', anno: 2026 });
  verifica('senza doppioni la notte e\' in linea', pulita.esito === 'in_linea', pulita.nota);
  verifica('e il campo c\'e\' comunque, vuoto', pulita.doppioni_json === '[]', pulita.doppioni_json);

  // TUTTI GLI IMPIANTI QUADRANO, E PERO' C'E' UN DOPPIONE: deve bastare.
  const f = fotografiaDelGiorno(SITI, { giorno: '2026-10-10', anno: 2026, doppioni: DOPPIONI });
  verifica('un doppione da solo fa «da guardare», anche se tutto quadra', f.esito === 'da_guardare', f.esito);
  verifica('la nota dice la quadratura E il doppione', /quadrano/.test(f.nota) && /doppia/.test(f.nota), f.nota);
  verifica('e dice dove: sito, mese e canale', /Irigom/.test(f.nota) && /Marzo/.test(f.nota) && /rete/.test(f.nota), f.nota);
  verifica('si rileggono dalla riga scritta', leggiFotografia({ ...f, doppioni_json: f.doppioni_json }).doppioni.length === 1);
  verifica('e una riga vecchia senza quel campo non rompe niente', leggiFotografia({ giorno: '2026-10-01' }).doppioni.length === 0);

  verifica('la riga dei doppioni da sola non si scrive se non ce ne sono', notaDoppioni([]) === '');
  verifica('una sola si dice al singolare', /Una dichiarazione/.test(notaDoppioni(DOPPIONI)), notaDoppioni(DOPPIONI));
  const tanti = [...DOPPIONI, { ...DOPPIONI[0], mese: 'Aprile' }, { ...DOPPIONI[0], mese: 'Maggio' }];
  verifica('oltre due si contano le altre, altrimenti la riga non e\' una riga', /e altre 1/.test(notaDoppioni(tanti)), notaDoppioni(tanti));
}

console.log('LA MATTINA, IN CIMA ALLE COSE DA GESTIRE');
{
  const base = { oggi: '2026-10-10', adessoMs: Date.UTC(2026, 9, 10, 6, 0, 0), anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], riepilogoQualifica: null, richiesteEct: [] };
  const vociDi = (fotografiaGiorno) => cruscotto({ ...base, fotografiaGiorno }).da_gestire;
  const conDoppione = leggiFotografia(fotografiaDelGiorno(SITI, { giorno: '2026-10-10', anno: 2026, doppioni: DOPPIONI }));
  const voci = vociDi(conDoppione);
  const v = voci.find(x => x.area === 'Dichiarazioni');
  verifica('un doppione si trova la mattina senza aprire niente', !!v, JSON.stringify(voci.map(x => x.area)));
  verifica('ed e\' critico: finche\' c\'e\', i numeri dipendono da quale modulo si guarda', v && v.gravita === 'critico', v && v.gravita);
  verifica('dice sito, mese e canale', v && /Irigom/.test(v.dettaglio) && /Marzo/.test(v.dettaglio) && /rete/.test(v.dettaglio), v && v.dettaglio);
  verifica('dice i chili di troppo nelle giacenze', v && /370\.000 kg di troppo/.test(v.dettaglio), v && v.dettaglio);
  verifica('e porta alla pagina dove si sistema', v && v.link === '/dichiarazioni-impianti', v && v.link);

  // LA PARTE CHE MI SONO QUASI PERSO: l'esito e' «da guardare» ma nessun
  // impianto si scosta. Una voce sola avrebbe scritto «0 impianti non quadrano
  // col portale», cioe' un avviso a zero come quello dei file.
  verifica('e NON dice «0 impianti non quadrano»: nessun avviso a zero',
    !voci.some(x => /0 impianti/.test(x.titolo || '')), JSON.stringify(voci.map(x => x.titolo)));
  verifica('la voce delle giacenze non compare affatto, se nessuno si scosta',
    voci.filter(x => x.area === 'Giacenze').length === 0, JSON.stringify(voci.filter(x => x.area === 'Giacenze')));

  // E con tutte e due le cose, due voci distinte: sono due problemi diversi.
  const storti = SITI.map(s => (s.chiave === 'tcycle' ? { ...s, giacenza_calcolata_t: 366, scarto_t: 1.2, quadra: false } : s));
  const entrambi = leggiFotografia(fotografiaDelGiorno(storti, { giorno: '2026-10-10', anno: 2026, doppioni: DOPPIONI }));
  const due = vociDi(entrambi);
  verifica('uno scostamento e un doppione fanno due voci, non una',
    due.filter(x => x.area === 'Giacenze').length === 1 && due.filter(x => x.area === 'Dichiarazioni').length === 1,
    JSON.stringify(due.map(x => x.area + '/' + x.titolo)));
  const pulita = leggiFotografia(fotografiaDelGiorno(SITI, { giorno: '2026-10-10', anno: 2026 }));
  verifica('e una notte senza niente non dice niente',
    vociDi(pulita).filter(x => x.area === 'Dichiarazioni' || x.area === 'Giacenze').length === 0);
}

console.log('LA CONTROPROVA: COM\'ERA PRIMA');
{
  // 1. CON L'OPERAZIONE NELLA CHIAVE la riga di Irigom non si trovava.
  const chiaveConOperazione = (d) => [norm(d.sito), d.operazione, d.canale || 'RETE', d.provenienza || '', d.mese].join('|');
  const flussoR3 = { sito: 'Irigom S.r.l.', anno: 2026, mese: 'Marzo', canale: 'RETE', provenienza: '', operazione: 'R3' };
  verifica('con l\'operazione dentro, la riga R1 di quel mese non si trovava',
    chiaveConOperazione(IRIGOM_MARZO) !== chiaveConOperazione(flussoR3));
  verifica('e senza, si trova: e\' tutta la differenza fra aggiornare e duplicare',
    K(IRIGOM_MARZO) === K(flussoR3));
  verifica('cioe\' la regola adesso dice «aggiorna» dove prima diceva «crea»',
    esitoScrittura([IRIGOM_MARZO], flussoR3, { anno: 2026, chiaveDi }).azione === 'aggiorna');

  // 2. CON Map.set SECCA (com'era il riepilogo) la seconda campagna di extra
  // raccolta spariva: permetterla senza sommarla vuol dire perderla.
  const campagne = [
    { id: 'f', sito: 'Irigom S.r.l.', canale: 'EXTRA_RACCOLTA', provenienza: '', mese: 'Luglio', quantita_kg: 460, caricata_inviata: true },
    { id: 'g', sito: 'Irigom S.r.l.', canale: 'EXTRA_RACCOLTA', provenienza: '', mese: 'Luglio', quantita_kg: 300, caricata_inviata: true },
  ];
  const comeEraPrima = new Map();
  for (const d of campagne) comeEraPrima.set(K(d), d);
  verifica('prima ne restava una sola, e 300 kg uscivano dai conti',
    comeEraPrima.get(K(campagne[0])).quantita_kg === 300, String(comeEraPrima.get(K(campagne[0])).quantita_kg));
  const adesso = new Map();
  for (const d of campagne) { const k = K(d); adesso.set(k, unisciDichiarazioni(adesso.get(k), d)); }
  verifica('adesso si sommano: 760 kg, che e\' quello che e\' uscito davvero',
    adesso.get(K(campagne[0])).quantita_kg === 760, String(adesso.get(K(campagne[0])).quantita_kg));

  // 3. SULLA RETE la stessa Map.set nascondeva la gemella mentre le giacenze la
  // sommavano: un dato in meno da una parte e uno in piu' dall'altra.
  const gemelle = [
    { id: 'd', sito: 'Irigom S.r.l.', canale: 'RETE', provenienza: '', mese: 'Marzo', quantita_kg: 370000, caricata_inviata: true },
    { id: 'e', sito: 'Irigom S.r.l.', canale: 'RETE', provenienza: '', mese: 'Marzo', quantita_kg: 370000, caricata_inviata: true },
  ];
  const sommaGiacenze = gemelle.filter(d => d.caricata_inviata).reduce((s, d) => s + d.quantita_kg, 0);
  const unaSola = new Map();
  for (const d of gemelle) unaSola.set(K(d), d);
  verifica('le giacenze vedevano 740.000 kg e il riepilogo 370.000: lo stesso errore, in due direzioni',
    sommaGiacenze === 740000 && unaSola.get(K(gemelle[0])).quantita_kg === 370000,
    JSON.stringify([sommaGiacenze, unaSola.get(K(gemelle[0])).quantita_kg]));
  verifica('e nessuno dei due lo diceva: adesso lo dice il controllo notturno',
    doppioniDichiarazioni(gemelle.map(d => ({ ...d, anno: 2026 })), { anno: 2026, chiaveDi }).length === 1);
}

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
