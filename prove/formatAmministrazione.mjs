// IL «FORMAT AMMINISTRAZIONE» (src/lib/formatAmministrazione.js).
//
// I fogli come li vuole l'amministrazione, IN AGGIUNTA a quelli che il gestionale
// gia' produce: il report attuale resta dov'e' e non si tocca (richiesta
// dell'utente, 03/10/2026).
//
// IL RISCONTRO E' SETTEMBRE 2026, che l'utente ha verificato a mano e ha
// indicato come prova: «sì, settembre è corretto». Dai suoi due file:
//   rete  380 ordini, 1.120.240 kg, 226.288,48 euro (0,202 euro/kg)
//   ACI     6 ordini,    18.890 kg,   4.410,10 euro (240 euro/t Campania e
//           Puglia, 230 euro/t Calabria)
// Gli stessi numeri si ricostruiscono dalle primarie: terminati del mese, partner
// operativo SMOCO, canale deciso dalla classe. npm run prove
import { caricaLibPagine } from './dati/libPagine.mjs';

const { tabellaAmministrazione, euroAlChilo, nomeFileAmministrazione } = await caricaLibPagine('lib/formatAmministrazione');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Le sei righe ACI vere di settembre 2026, dal file dell'amministrazione.
const ACI_SETTEMBRE = [
  { regione: 'Puglia', ordine: 'ET26126228', data_fine_trasporto: '2026-09-01T00:00:00Z', numero_fir: 'BSDCL002361RK', classe: 'PFU Autodemolizione', quantita: 2140, tariffa_valore: 240, totale: 513.6 },
  { regione: 'Calabria', ordine: 'ET26145279', data_fine_trasporto: '2026-09-11T00:00:00Z', numero_fir: 'TYDJR004693GV', classe: 'PFU Autodemolizione', quantita: 3820, tariffa_valore: 230, totale: 878.6 },
  { regione: 'Calabria', ordine: 'ET26147676', data_fine_trasporto: '2026-09-11T00:00:00Z', numero_fir: 'TYDJR004683LY', classe: 'PFU Autodemolizione', quantita: 4130, tariffa_valore: 230, totale: 949.9 },
  { regione: 'Campania', ordine: 'ET26152038', data_fine_trasporto: '2026-09-18T00:00:00Z', numero_fir: 'RGYTR027856CZ', classe: 'PFU Autodemolizione', quantita: 1640, tariffa_valore: 240, totale: 393.6 },
  { regione: 'Puglia', ordine: 'ET26134539', data_fine_trasporto: '2026-09-23T00:00:00Z', numero_fir: 'BSDCL002480RN', classe: 'PFU Autodemolizione', quantita: 2760, tariffa_valore: 240, totale: 662.4 },
  { regione: 'Calabria', ordine: 'ET26139262', data_fine_trasporto: '2026-09-29T00:00:00Z', numero_fir: 'TYDJR004821WH', classe: 'PFU Autodemolizione', quantita: 4400, tariffa_valore: 230, totale: 1012 },
];

console.log('ACI: IL FOGLIO DI SETTEMBRE, AL CENTESIMO');
{
  const t = tabellaAmministrazione('ACI', ACI_SETTEMBRE, 2026, 'Settembre');
  verifica('sei righe', t.righe.length === 6, String(t.righe.length));
  verifica('18.890 kg', t.totale_kg === 18890, String(t.totale_kg));
  verifica('4.410,10 euro', t.totale_euro === 4410.1, String(t.totale_euro));
  // Le colonne sono quelle del file dell'amministrazione, nell'ordine, e il
  // ticket NON c'e' (nel report che gia' esiste invece si').
  const titoli = t.colonne.map(c => c.titolo);
  verifica('le colonne sono quelle del file',
    String(titoli) === String(['Regione', 'Fatturante', 'Periodo', 'Tipo', 'Ordine', 'Data fine trasporto', 'Numero FIR', 'Classe', 'Quantità (kg)', 'Prezzo Unitario (Euro/TON)', 'Prezzo Totale', 'Note']),
    String(titoli));
  verifica('niente colonna del ticket', !titoli.some(x => /ticket/i.test(x)));
  // La riga sopra la tabella: SMOCO, ACI, il mese.
  verifica('sopra la tabella c e la riga SMOCO / ACI / mese',
    t.intestazione && t.intestazione[0] === 'SMOCO' && t.intestazione[2] === 'ACI' && t.intestazione[7] === 'SETTEMBRE 2026',
    JSON.stringify(t.intestazione));
  // LE NOTE RESTANO VUOTE: «la scrivo io a mano» (utente, 03/10/2026). Dicono se
  // la dichiarazione e' stata ricevuta e inviata al consorzio, e una frase
  // sbagliata su una fattura non la scrive il gestionale.
  verifica('le note restano vuote', t.righe.every(r => r[11] === ''));
  // Il prezzo ACI resta a TONNELLATA, e cambia con la regione.
  verifica('il prezzo e a tonnellata e segue la regione',
    t.righe[0][9] === 240 && t.righe[1][9] === 230, JSON.stringify([t.righe[0][9], t.righe[1][9]]));
  verifica('il fatturante, se non detto, e SMOCO Srl', t.righe[0][1] === 'SMOCO Srl');
  verifica('il periodo e scritto come nel file', t.righe[0][2] === '2026 Settembre', t.righe[0][2]);
}

console.log('RETE: IL PREZZO AL CHILO E LA REGIONE');
{
  // Nel foglio della rete il prezzo e' in euro al CHILO - 202 euro a tonnellata
  // sono 0,202 - e l'ultima colonna e' la regione del ritiro. Sono le due
  // differenze col report che il gestionale gia' produce.
  verifica('202 euro a tonnellata fanno 0,202 al chilo', euroAlChilo(202) === 0.202, String(euroAlChilo(202)));
  verifica('e 90 fanno 0,09', euroAlChilo(90) === 0.09, String(euroAlChilo(90)));
  const righe = [
    { ordine: 'ET26135194', data_fine_trasporto: '2026-09-01T00:00:00Z', numero_fir: 'RGYTR027031WF', classe: 'P', quantita: 1940, tariffa_valore: 202, totale: 391.88, regione: 'Campania' },
    { ordine: 'ET26137286', data_fine_trasporto: '2026-09-01T00:00:00Z', numero_fir: 'LQQDP001425TP', classe: 'M', quantita: 10120, tariffa_valore: 202, totale: 2044.24, regione: 'Campania' },
  ];
  const t = tabellaAmministrazione('RETE', righe, 2026, 'Settembre');
  const titoli = t.colonne.map(c => c.titolo);
  verifica('le colonne sono quelle del file',
    String(titoli) === String(['Periodo', 'Tipo', 'Ordine', 'Data fine trasporto', 'Numero FIR', 'Classe', 'Quantità (kg)', 'Prezzo Unitario (Euro/Kg)', 'Prezzo Totale', 'Regione']),
    String(titoli));
  verifica('il prezzo e scritto al chilo', t.righe[0][7] === 0.202, String(t.righe[0][7]));
  verifica('e la regione e in fondo', t.righe[0][9] === 'Campania');
  verifica('il periodo e 2026 SETTEMBRE', t.righe[0][0] === '2026 SETTEMBRE', t.righe[0][0]);
  verifica('i totali stanno sotto le loro colonne', t.iKg === 6 && t.iTotale === 8);
  verifica('e sommano kg ed euro', t.totale_kg === 12060 && t.totale_euro === 2436.12, JSON.stringify([t.totale_kg, t.totale_euro]));
}

console.log('QUELLO CHE NON ENTRA');
{
  // Una riga sospesa non si fattura: resta fuori, come nel report che gia' c'e'.
  const t = tabellaAmministrazione('RETE', [
    { ordine: 'A', quantita: 1000, tariffa_valore: 202, totale: 202 },
    { ordine: 'B', quantita: 5000, tariffa_valore: 202, totale: 1010, sospesa: true },
  ], 2026, 'Settembre');
  verifica('una riga sospesa resta fuori', t.righe.length === 1 && t.totale_kg === 1000, JSON.stringify(t.totale_kg));
}
{
  verifica('senza righe non si rompe niente', tabellaAmministrazione('RETE', [], 2026, 'Settembre').totale_kg === 0);
  verifica('e nemmeno senza elenco', tabellaAmministrazione('ACI', null, 2026, 'Settembre').righe.length === 0);
}

console.log('IL NOME DEL FILE DICE CHE FORMATO E');
verifica('si riconosce dal nome', nomeFileAmministrazione('RETE', 2026, 'Settembre', 'xlsx') === 'Format_amministrazione_RETE_Settembre_2026.xlsx',
  nomeFileAmministrazione('RETE', 2026, 'Settembre', 'xlsx'));

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
