// Prova dei report della fatturazione attiva (src/lib/fatturazioneExport.js): la
// tabella da cui nascono sia l'Excel sia il PDF, un report per canale. npm run prove
import { caricaLibPagine } from './dati/libPagine.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// la libreria importa xlsx e gli alias @: qui si prova la sola costruzione della
// tabella. Si carica con caricaLibPagine, che risolve anche l'import relativo di
// ecotyreTariffe.js (il prezzo a tonnellata, 11/10/2026).
const { tabellaAttiva, nomeFileAttiva } = await caricaLibPagine('lib/fatturazioneExport', [
  ["import { formattaPesi } from '@/lib/formatoExcel';", 'const formattaPesi = null;'],
]);
const { tabellaAmministrazione } = await caricaLibPagine('lib/formatAmministrazione');

const base = { data_fine_trasporto: '2026-07-10T00:00:00.000Z', numero_fir: 'FIR1', classe: 'P', unita_misura: '€/t', fattore_conversione: 1000 };
const righeRete = [
  { ...base, ordine: 'ET1', servizio_ecotyre: 'TRASP_TRATT', quantita: 2300, tariffa_valore: 202, totale: 464.6 },
  { ...base, ordine: 'ET2', servizio_ecotyre: 'TRASP', quantita: 3840, tariffa_valore: 202, totale: 775.68 },
  { ...base, ordine: 'ET3', servizio_ecotyre: 'TRASP_TRATT', quantita: 1000, tariffa_valore: 202, totale: 202, sospesa: true },
];
const rete = tabellaAttiva('RETE', righeRete, 2026, 'Luglio');
const col = (t, nome) => t.colonne.findIndex(c => c.titolo === nome);
verifica('rete: nove colonne, le sospese restano fuori', rete.colonne.length === 9 && rete.righe.length === 2);
verifica('rete: il tipo di servizio e\' quello della riga, non fisso', rete.righe[0][col(rete, 'Tipo')] === 'Trasp.+Tratt.' && rete.righe[1][col(rete, 'Tipo')] === 'Trasp.');
verifica('rete: prezzo a tonnellata (202), quantita\' in chili', rete.righe[0][col(rete, 'Prezzo Unitario (Euro/TON)')] === 202 && rete.righe[0][col(rete, 'Quantità (kg)')] === 2300);
verifica('rete: il totale esclude le sospese e sta sotto "Prezzo Totale"', rete.totale === 1240.28 && rete.colonne[rete.iTotale].titolo === 'Prezzo Totale');

const aci = tabellaAttiva('ACI', [{ ...base, ordine: 'EA1', regione: 'Puglia', fatturante: 'ECOTYRE', ticket_n: '162399-21', servizio_ecotyre: 'TRASP_TRATT', classe: 'PFU Autodemolizione', quantita: 2640, tariffa_valore: 230, totale: 607.2, note: '' }], 2026, 'Luglio');
verifica('aci: tredici colonne col ticket, prezzo a tonnellata per regione', aci.colonne.length === 13 && aci.righe[0][col(aci, 'Ticket n°')] === '162399-21' && aci.righe[0][col(aci, 'Prezzo Unitario (Euro/TON)')] === 230);
verifica('aci: il totale sta sotto "Prezzo Totale", non sotto le Note', aci.colonne[aci.iTotale].titolo === 'Prezzo Totale' && aci.totale === 607.2);

const extra = tabellaAttiva('EXTRA_RACCOLTA', [
  { ...base, ordine: 'BSDCL002230PQ', quantita: 460, tariffa_valore: 202, totale: 92.92, note: "Prezzo scritto sull'intervento" },
  { ...base, ordine: 'BSDCL002230PQ', descrizione: 'Sovracosto raccolta', quantita: 0, tariffa_valore: 120, totale: 120, unita_misura: '€ a corpo', note: "Sovracosto raccolta scritto sull'intervento" },
], 2026, 'Luglio');
verifica('extra: intervento e sovracosto sono due righe, e il totale li somma (212,92)', extra.righe.length === 2 && extra.totale === 212.92 && /Sovracosto/.test(extra.righe[1][col(extra, 'Note')]) && extra.colonne[extra.iTotale].titolo === 'Prezzo Totale');
verifica('un file per canale e per formato', nomeFileAttiva('ACI', 2026, 'Luglio', 'pdf') === 'Fatturazione_ACI_Luglio_2026.pdf' && nomeFileAttiva('RETE', 2026, 'Luglio', 'xlsx') === 'Fatturazione_RETE_Luglio_2026.xlsx');
verifica('ogni colonna ha il suo tipo, per i formati del PDF', [rete, aci, extra].every(t => t.colonne.every(c => ['testo', 'kg', 'euro'].includes(c.tipo)) && t.righe.every(r => r.length === t.colonne.length)));

// UN PREZZO A TONNELLATA UNICO NEI REPORT DELL'ATTIVA (chiusura dell'audit,
// 11/10/2026). Una tariffa scritta in €/kg (0,202) usciva 0,202 sotto
// «Euro/TON» nei due report, e 0,0002 al chilo nel format della rete: il
// totale della riga era giusto, il prezzo stampato mille volte piu' piccolo.
console.log("IL PREZZO A TONNELLATA, QUALUNQUE SIA L'UNITA' DELLA TARIFFA");
{
  const alChilo = { ...base, unita_misura: '€/kg', unita_prezzo: '€/kg', fattore_conversione: 1 };
  const prezzoTon = (t) => t.righe[0][col(t, 'Prezzo Unitario (Euro/TON)')];
  const reteKg = tabellaAttiva('RETE', [{ ...alChilo, ordine: 'ET9', quantita: 2300, tariffa_valore: 0.202, totale: 464.6 }], 2026, 'Luglio');
  verifica('rete: una tariffa a 0,202 €/kg si stampa 202 sotto «Euro/TON» (prima 0,202)', prezzoTon(reteKg) === 202, String(prezzoTon(reteKg)));
  const aciKg = tabellaAttiva('ACI', [{ ...alChilo, ordine: 'EA9', regione: 'Puglia', quantita: 2640, tariffa_valore: 0.23, totale: 607.2 }], 2026, 'Luglio');
  verifica('aci: 0,23 €/kg si stampano 230 sotto «Euro/TON»', prezzoTon(aciKg) === 230, String(prezzoTon(aciKg)));
  const aViaggio = tabellaAttiva('ACI', [{ ...base, unita_misura: '€/viaggio', unita_prezzo: '€/viaggio', ordine: 'EA8', regione: 'Puglia', quantita: 2640, tariffa_valore: 300, totale: 300 }], 2026, 'Luglio');
  verifica('una riga a viaggio non ha un prezzo a tonnellata: vuoto, non 300 e non 0', prezzoTon(aViaggio) === null, String(prezzoTon(aViaggio)));
  const senzaUnita = tabellaAttiva('RETE', [{ ordine: 'ET0', quantita: 1000, tariffa_valore: 202, totale: 202 }], 2026, 'Luglio');
  verifica("una riga salvata senza unita' e' a tonnellata, come le prime: 202", prezzoTon(senzaUnita) === 202, String(prezzoTon(senzaUnita)));

  const amRete = tabellaAmministrazione('RETE', [{ ...alChilo, ordine: 'ET9', quantita: 2300, tariffa_valore: 0.202, totale: 464.6 }], 2026, 'Luglio');
  const iKg = amRete.colonne.findIndex(c => c.titolo === 'Prezzo Unitario (Euro/Kg)');
  verifica('format amministrazione, rete: 0,202 €/kg restano 0,202 al chilo (prima 0,0002)', amRete.righe[0][iKg] === 0.202, String(amRete.righe[0][iKg]));
  const amAci = tabellaAmministrazione('ACI', [{ ...alChilo, ordine: 'EA9', regione: 'Puglia', quantita: 2640, tariffa_valore: 0.23, totale: 607.2 }], 2026, 'Luglio');
  const iTon = amAci.colonne.findIndex(c => c.titolo === 'Prezzo Unitario (Euro/TON)');
  verifica('format amministrazione, ACI: 0,23 €/kg diventano 230 €/t', amAci.righe[0][iTon] === 230, String(amAci.righe[0][iTon]));
  const amTon = tabellaAmministrazione('RETE', [{ ...base, ordine: 'ET1', quantita: 2300, tariffa_valore: 202, totale: 464.6 }], 2026, 'Luglio');
  verifica('e a tonnellata non cambia niente: 202 €/t sono 0,202 al chilo', amTon.righe[0][iKg] === 0.202, String(amTon.righe[0][iKg]));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
