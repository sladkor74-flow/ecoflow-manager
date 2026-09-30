// Come la quadratura FIR capisce a quale flusso appartiene una pivot, e che cosa
// fa quando non lo capisce.
//
// Tutto quello che c'e' qui dentro nasce dalla settimana 39 del 2026, segnalata
// dall'utente il 30/09/2026: "mi hai restituito l'ok per le primarie ma non per
// le secondarie ne' rete ne' aci, inoltre mi parli di extra raccolta che non
// esiste... tutto e' caricato correttamente nel gestionale e se faccio i calcoli
// sul mio vecchio file excel tutto corrisponde".
//
// Le intestazioni della sua stampa, che lui RICEVE e non scrive:
//   "WIN SINFO" / "PORTALE ECOTYRE"            primarie rete      85 / 263.780
//   "WIN SEC" / "PORTALE ECT SEC"              secondarie rete     3 /  42.480
//   "WINSINFO ECT SEC-ACI" / "GESTIONALE ECT ACI"  secondarie ACI  1 /   1.640
//   "WINSINFO ECT ACI" / "GESTIONALE ECT ACI"      primarie ACI    1 /   2.760
//
// npm run prove
import {
  flussoDaTitolo, fonteDaTitolo, settimanaDaTitolo, fuoriPerimetro,
  normalizzaLettura, confronta, sintesi, FLUSSI, ORDINE_FLUSSI,
} from '../base44/shared/quadraturaFir.ts';
import { leggiPivotDaGriglia } from '../src/lib/pivotQuadratura.js';
import { caricaGestionale, confrontaSettimana, osservazioneExtraRaccolta, CANALI_QUADRATURA } from '../base44/shared/quadraturaFirDati.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('I QUATTRO FLUSSI, NON SEI');
verifica('la quadratura ha quattro flussi', ORDINE_FLUSSI.length === 4, ORDINE_FLUSSI.join(','));
verifica("l'extra raccolta non e' un flusso della quadratura", !FLUSSI.extra_primarie && !FLUSSI.extra_secondarie);
verifica('i canali quadrati sono rete e ACI', CANALI_QUADRATURA.join(',') === 'RETE,ACI', CANALI_QUADRATURA.join(','));

console.log('LE INTESTAZIONI VERE DELLA STAMPA');
const atteso = {
  'WIN SINFO': null,
  'PORTALE ECOTYRE': null,
  'WIN SEC': 'rete_secondarie',
  'PORTALE ECT SEC': 'rete_secondarie',
  'WINSINFO ECT SEC-ACI': 'aci_secondarie',
  'GESTIONALE ECT ACI': 'aci_primarie',
  'WINSINFO ECT ACI': 'aci_primarie',
};
for (const [titolo, flusso] of Object.entries(atteso)) {
  verifica(`"${titolo}" -> ${flusso}`, flussoDaTitolo(titolo) === flusso, '= ' + flussoDaTitolo(titolo));
}
// Il difetto che ha rotto la settimana 39: la secondarieta' si decide PRIMA del canale.
verifica('SEC-ACI non finisce mai fra le primarie ACI', flussoDaTitolo('WINSINFO ECT SEC-ACI') !== 'aci_primarie');
verifica('"SEC" da solo vale secondarie', flussoDaTitolo('WIN SEC') === 'rete_secondarie');
verifica('"SECONDARIE" continua a valere', flussoDaTitolo('SECONDARIE ECOTYRE SETT. 37') === 'rete_secondarie');
verifica('i titoli del formato vecchio non cambiano', flussoDaTitolo('RACCOLTA ECOTYRE SETT. 37') === 'rete_primarie'
  && flussoDaTitolo('ACI SETT. 37') === 'aci_primarie');
verifica("l'extra raccolta si riconosce come fuori perimetro", fuoriPerimetro('EXTRA RACCOLTA') && flussoDaTitolo('EXTRA RACCOLTA') === null);

console.log('LA FONTE DAL TITOLO');
verifica('"WIN SINFO" con lo spazio', fonteDaTitolo('WIN SINFO') === 'winsinfo');
verifica('"WINSINFO ECT SEC-ACI" e WINSINFO, non il portale', fonteDaTitolo('WINSINFO ECT SEC-ACI') === 'winsinfo');
verifica('"PORTALE ECOTYRE"', fonteDaTitolo('PORTALE ECOTYRE') === 'ecotyre');
verifica('"PORTALE ECT SEC"', fonteDaTitolo('PORTALE ECT SEC') === 'ecotyre');
verifica('"GESTIONALE ECT ACI"', fonteDaTitolo('GESTIONALE ECT ACI') === 'ecotyre');
verifica('un titolo che non dice la fonte', fonteDaTitolo('RACCOLTA SETT. 39') === null);

console.log('LA SETTIMANA NEL RIQUADRO GIALLO');
verifica('"W 39"', settimanaDaTitolo('W 39') === 39);
verifica('"W39"', settimanaDaTitolo('W39') === 39);
verifica('"SETT. 37" continua a funzionare', settimanaDaTitolo('RACCOLTA ECOTYRE SETT. 37') === 37);
verifica('"Nr. Settimana 39"', settimanaDaTitolo('Nr. Settimana 39') === 39);
verifica('un numero che non e\' una settimana non passa', settimanaDaTitolo('W 99') === null);

// --- gli attrezzi per costruire una lettura ---
let n = 0;
const tab = (titolo, fonte, conteggio, kg, extra = {}) => ({
  titolo, fonte,
  righe: [{ impianto: 'GATIM SRL', trasportatore: 'EMMESSE SRL' + (extra.diverso ? ' ' + (++n) : ''), conteggio, kg }],
  totale_conteggio: conteggio, totale_kg: kg,
  ...extra,
});

console.log('DUE TABELLE SULLO STESSO FLUSSO E SULLA STESSA FONTE NON SI SCELGONO');
{
  // Esattamente la settimana 39: SEC-ACI e ACI finivano tutte e due su aci_primarie.
  const lettura = normalizzaLettura({ tabelle: [
    tab('WINSINFO ECT SEC-ACI', 'winsinfo', 1, 1640),
    tab('WINSINFO ECT ACI', 'winsinfo', 1, 2760),
  ] });
  // Con la correzione dei titoli non si scontrano piu': flussi diversi.
  verifica('adesso vanno su due flussi diversi',
    lettura.tabelle[0].flusso === 'aci_secondarie' && lettura.tabelle[1].flusso === 'aci_primarie',
    lettura.tabelle.map(t => t.flusso).join(','));
  verifica('nessuna delle due e doppia', !lettura.tabelle.some(t => t.doppia));
}
{
  // E se lo scontro capita davvero (due pivot assegnate allo stesso flusso), si dice.
  const lettura = normalizzaLettura({ tabelle: [
    tab('WINSINFO ECT ACI', 'winsinfo', 1, 2760),
    tab('WINSINFO ECT ACI', 'winsinfo', 1, 1640),
  ] });
  verifica('tutte e due marcate doppie', lettura.tabelle.every(t => t.doppia));
  verifica('il problema lo dice in chiaro', lettura.problemi.some(p => /2 tabelle assegnate allo stesso flusso/.test(p)), lettura.problemi.join(' | '));
  verifica('e la lettura non e piu verificata', lettura.verificata === false && lettura.flussi_riconosciuti === false);
  const esito = confronta(lettura, {}, { anno: 2026, settimana: 39, inizio: '2026-09-21', fine: '2026-09-27' });
  const aci = esito.flussi.find(f => f.chiave === 'aci_primarie');
  verifica('il flusso non prende nessuna delle due', !aci.totali.winsinfo, JSON.stringify(aci.totali));
  verifica('e lo spiega nella nota', aci.note.some(x => /2 tabelle di WINSINFO assegnate a questo flusso/.test(x)), aci.note.join(' | '));
  verifica('senza dire la bugia "non c e nessuna tabella"', !aci.note.some(x => /non c'è nessuna tabella di questo flusso/.test(x)), aci.note.join(' | '));
}

console.log('LA SCELTA DELL UTENTE VINCE SUL TITOLO');
{
  const lettura = normalizzaLettura({ tabelle: [
    { ...tab('WIN SINFO', 'winsinfo', 85, 263780), flusso: 'rete_primarie' },
    { ...tab('PORTALE ECOTYRE', 'ecotyre', 85, 263780), flusso: 'rete_primarie' },
  ] });
  verifica('il flusso scelto viene usato', lettura.tabelle.every(t => t.flusso === 'rete_primarie'));
  verifica('e si sa che e stato scelto', lettura.tabelle.every(t => t.flusso_scelto === true));
  verifica('la proposta automatica resta registrata', lettura.tabelle[0].proposto === null);
  verifica('tutto riconosciuto', lettura.verificata === true, JSON.stringify(lettura.problemi));
}
{
  const lettura = normalizzaLettura({ tabelle: [{ ...tab('WIN SEC', 'winsinfo', 3, 42480), flusso: 'pippo' }] });
  verifica('un flusso inventato si ignora e vale la proposta', lettura.tabelle[0].flusso === 'rete_secondarie', lettura.tabelle[0].flusso);
}

console.log('TRE ESITI DIVERSI, TRE FRASI DIVERSE');
{
  // Le somme tornano tutte: il problema e' solo il titolo. Prima si accusava la trascrizione.
  const lettura = normalizzaLettura({ tabelle: [tab('WIN SINFO', 'winsinfo', 85, 263780)] });
  verifica('i totali tornano', lettura.totali_quadrano === true);
  verifica('la fonte si e capita', lettura.fonti_riconosciute === true);
  verifica('il flusso no', lettura.flussi_riconosciuti === false);
  verifica('e quindi la lettura non e verificata', lettura.verificata === false);
  verifica('nessun problema parla di somme che non tornano', !lettura.problemi.some(p => /non torna con i totali/.test(p)), lettura.problemi.join(' | '));
}

console.log('LA SETTIMANA LA SCEGLIE L UTENTE, NON IL FOGLIO');
{
  const periodo = { anno: 2026, settimana: 39, inizio: '2026-09-21', fine: '2026-09-27' };
  const senza = confronta(normalizzaLettura({ tabelle: [{ ...tab('WIN SINFO', 'winsinfo', 85, 263780), flusso: 'rete_primarie' }] }), {}, periodo);
  verifica('senza settimana sul file non si dice niente', !senza.osservazioni.some(o => /numero di settimana/.test(o)), senza.osservazioni.join(' | '));
  const discorde = confronta(normalizzaLettura({ settimana: 38, tabelle: [{ ...tab('WIN SINFO', 'winsinfo', 85, 263780), flusso: 'rete_primarie' }] }), {}, periodo);
  verifica('ma una settimana diversa si dice eccome', discorde.settimana_discorde === true
    && discorde.osservazioni.some(o => /è scritta la settimana 38/.test(o)), discorde.osservazioni.join(' | '));
}

console.log('UNA TABELLA SENZA FLUSSO PORTA I SUOI NUMERI CON SE');
{
  const lettura = normalizzaLettura({ tabelle: [tab('WIN SINFO', 'winsinfo', 85, 263780)] });
  const esito = confronta(lettura, {}, { anno: 2026, settimana: 39, inizio: '2026-09-21', fine: '2026-09-27' });
  verifica('i numeri letti si dicono', esito.osservazioni.some(o => /85 formulari per 263.780 kg letti/.test(o)), esito.osservazioni.join(' | '));
  verifica('e si dice che quadrano', esito.osservazioni.some(o => /quadranti con i totali stampati/.test(o)));
  verifica('e che aspettano solo il flusso', esito.osservazioni.some(o => /non ancora attribuiti a nessuno dei quattro flussi/.test(o)));
}

console.log('UN FLUSSO CHE LA STAMPA NON COPRE NON E "DA SISTEMARE"');
{
  const gestionale = {
    rete_primarie: { celle: [{ impianto: 'GATIM SRL', trasportatore: 'EMMESSE SRL', n: 2, kg: 5000, formulari: [] }], totale: { n: 2, kg: 5000 } },
  };
  const esito = confronta(normalizzaLettura({ tabelle: [] }), gestionale, { anno: 2026, settimana: 39, inizio: '2026-09-21', fine: '2026-09-27' });
  const f = esito.flussi.find(x => x.chiave === 'rete_primarie');
  verifica('il flusso e marcato fuori stampa', f.fuori_stampa === true);
  const s = sintesi({ ...esito, lettura_verificata: true });
  verifica('le sue righe non sono incongruenti', s.incongruenti === 0, JSON.stringify(s));
  verifica('sono contate a parte', s.fuori_stampa === 1, JSON.stringify(s));
  verifica('la conformita resta parziale, ma per il motivo giusto', s.conformita === 'parziale');
}

console.log("L'EXTRA RACCOLTA: SOLO RETE, E SOLO SE C'E'");
{
  verifica('senza movimenti non se ne parla', osservazioneExtraRaccolta({ extra_rete: { totale: { n: 0, kg: 0 } } }).length === 0);
  verifica('senza il flusso nemmeno', osservazioneExtraRaccolta({}).length === 0);
  const o = osservazioneExtraRaccolta({ extra_rete: { totale: { n: 2, kg: 15400 } } });
  verifica('con movimenti si dice in una riga', o.length === 1 && /2 formulari terminati per 15.400 kg/.test(o[0]), o.join(''));
  verifica('e si dice che l ACI qui non esiste', /l'ACI qui non esiste/.test(o[0]), o[0]);
}
{
  // La prova che chiude la segnalazione dell'utente: un ordine di extra raccolta
  // fuori settimana non deve far comparire l'extra raccolta nell'esito.
  const vecchio = {
    id: 'X1', id_ordine: 'EX1', numero_fir: 'F1', stato: 'terminato', peso_effettivo: 1000,
    destinazione: 'TECNOGUM', trasportatore: 'SMOCO', tipo_movimento: 'primaria',
    ordine_immesso_il: '2024-03-01T08:00:00Z', trasporto_iniziato_il: '2024-03-01T08:00:00Z', trasporto_finito_il: null,
  };
  const periodo = { anno: 2026, settimana: 39, inizio: '2026-09-21', fine: '2026-09-27' };
  const g = await caricaGestionale({ asServiceRole: { entities: {} } }, periodo, null, {
    archivi: { PrimariaRete: [], Secondaria: [], PrimariaAci: [], ExtraRaccolta: [vecchio] },
    caricamenti: { ultimi: {}, in_corso: [] },
  });
  const esito = confrontaSettimana(normalizzaLettura({ tabelle: [] }), g, periodo);
  verifica('nessun canale EXTRA RACCOLTA nell esito', !esito.per_canale.some(c => /EXTRA/.test(c.canale)), JSON.stringify(esito.per_canale.map(c => c.canale)));
  verifica('e nessuna osservazione di extra raccolta', !esito.osservazioni.some(o => /Extra raccolta/i.test(o)), esito.osservazioni.filter(o => /Extra/i.test(o)).join(' | '));
}

console.log('IL LETTORE EXCEL GUARDA SOLO LE PIVOT DELLA QUADRATURA');
{
  // La griglia riproduce il foglio vero: la pivot settimanale non ha un titolo
  // sopra, solo "Nr. Settimana | 39", e accanto c'e' la pivot mensile intitolata
  // "RACCOLTA". Prima il titolo del vicino finiva su tutte e due.
  const v = (r, c, x) => { griglia[r] = griglia[r] || []; griglia[r][c] = x; };
  const griglia = [];
  // pivot mensile a sinistra (colonna 1), con il suo titolo in colonna 3
  v(1, 1, 'Partner_Operativo'); v(1, 2, 'SMOCO Srl'); v(1, 3, 'RACCOLTA');
  v(4, 1, 'Etichette di riga'); v(4, 2, 'G1'); v(4, 3, 'M');
  v(5, 1, 'Basilicata'); v(5, 2, 500); v(5, 3, 10325);
  v(6, 1, 'Totale complessivo'); v(6, 2, 500); v(6, 3, 10325);
  // pivot settimanale a destra (colonna 21), senza titolo
  v(0, 21, 'Nr. Settimana'); v(0, 22, 39);
  v(1, 21, 'Mese'); v(1, 22, 'Settembre');
  v(3, 21, 'Etichette di riga'); v(3, 22, 'Conteggio di ID'); v(3, 23, 'Somma di Peso_effettivo');
  v(4, 21, 'Gatim'); v(4, 22, 7); v(4, 23, 30520);
  v(5, 21, 'GATIM S.R.L.'); v(5, 22, 4); v(5, 23, 19730);
  v(6, 21, 'EMMESSE SRLS'); v(6, 22, 3); v(6, 23, 10790);
  v(7, 21, 'Totale complessivo'); v(7, 22, 7); v(7, 23, 30520);

  const lette = leggiPivotDaGriglia(griglia, 'REPORT MENSILE');
  verifica('la pivot di chili per classe non si legge', lette.length === 1, JSON.stringify(lette.map(t => t.totale_conteggio + '/' + t.totale_kg)));
  verifica('si legge quella settimanale, coi numeri giusti', lette[0].totale_conteggio === 7 && lette[0].totale_kg === 30520);
  verifica('il titolo del vicino non viene rubato', lette[0].titolo === '', JSON.stringify(lette[0].titolo));
  verifica('la settimana si legge dal "Nr. Settimana"', lette[0].settimana === 39, String(lette[0].settimana));
  verifica("l'impianto e il suo trasportatore si separano", lette[0].righe.length === 2 && lette[0].subtotali.length === 1, JSON.stringify(lette[0].righe));
  verifica('il subtotale del gruppo e Gatim', lette[0].subtotali[0].impianto === 'Gatim' && lette[0].subtotali[0].conteggio === 7);
}
{
  // Con un titolo suo, quello si legge.
  const griglia = [];
  const v = (r, c, x) => { griglia[r] = griglia[r] || []; griglia[r][c] = x; };
  v(0, 1, 'WINSINFO ECT SEC-ACI');
  v(2, 1, 'Etichette di riga'); v(2, 2, 'Conteggio di Qta Kg'); v(2, 3, 'Somma di Qta Kg');
  v(3, 1, 'TECNOGUM SRL'); v(3, 2, 1); v(3, 3, 1640);
  v(4, 1, 'LOGISTICA S.R.L.'); v(4, 2, 1); v(4, 3, 1640);
  v(5, 1, 'Totale complessivo'); v(5, 2, 1); v(5, 3, 1640);
  const lette = leggiPivotDaGriglia(griglia, 'W39');
  verifica('il titolo proprio si legge', lette[0].titolo === 'WINSINFO ECT SEC-ACI', JSON.stringify(lette[0].titolo));
  verifica('e porta al flusso giusto', flussoDaTitolo(lette[0].titolo) === 'aci_secondarie');
  verifica('e alla fonte giusta', fonteDaTitolo(lette[0].titolo) === 'winsinfo');
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
