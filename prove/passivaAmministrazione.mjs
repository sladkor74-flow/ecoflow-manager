// IL FOGLIO DELLA PASSIVA NEL «FORMAT AMMINISTRAZIONE»
// (src/lib/passivaAmministrazione.js).
//
// Il foglio dell'amministrazione elenca, sotto ogni fornitore, voci fisse con il
// loro prezzo, e le mostra SEMPRE anche a zero. Scelta dell'utente, 03/10/2026,
// fra le opzioni proposte: modello fisso E modificabile da lui.
//
// Il perche' si legge nel suo foglio di settembre: sotto LOGISTICA & PNEUMATICI
// ci sono quattro righe - Napoli 68, Salerno 68, Avellino 71, Caserta 72 - e tre
// sono a zero. Tenerle vuol dire che il foglio e' identico ogni mese e che un
// conferimento comparso dove prima non ce n'erano si vede a colpo d'occhio.
//
// I numeri delle prove sono quelli veri di settembre 2026, che l'utente ha
// verificato a mano. npm run prove
import { caricaLibPagine } from './dati/libPagine.mjs';

const { importoVoce, vociOrdinate, tonnellateDellaVoce, bloccoPassiva, foglioPassiva, modelloDaPassiva } = await caricaLibPagine('lib/passivaAmministrazione');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Le quattro voci di LOGISTICA & PNEUMATICI, dal foglio vero.
const LOGISTICA = [
  { anno: 2026, canale: 'RETE', blocco: 'raccoglitori', soggetto: 'LOGISTICA & PNEUMATICI SRL (*)', voce: 'Campania - NAPOLI', prezzo: 68, ordine: 10, criterio_json: JSON.stringify({ provincia: 'NAPOLI' }) },
  { anno: 2026, canale: 'RETE', blocco: 'raccoglitori', soggetto: 'LOGISTICA & PNEUMATICI SRL (*)', voce: 'Campania - SALERNO', prezzo: 68, ordine: 20, criterio_json: JSON.stringify({ provincia: 'SALERNO' }) },
  { anno: 2026, canale: 'RETE', blocco: 'raccoglitori', soggetto: 'LOGISTICA & PNEUMATICI SRL (*)', voce: 'Campania - AVELLINO', prezzo: 71, ordine: 30, criterio_json: JSON.stringify({ provincia: 'AVELLINO' }) },
  { anno: 2026, canale: 'RETE', blocco: 'raccoglitori', soggetto: 'LOGISTICA & PNEUMATICI SRL (*)', voce: 'Campania - CASERTA', prezzo: 72, ordine: 40, criterio_json: JSON.stringify({ provincia: 'CASERTA' }) },
];

console.log('IL TOTALE DI UNA VOCE');
verifica('a tonnellata', importoVoce(68, 'euro_tonnellata', 89.18, 0) === 6064.24, String(importoVoce(68, 'euro_tonnellata', 89.18, 0)));
verifica('a viaggio', importoVoce(30, 'euro_viaggio', 101.6, 7) === 210, String(importoVoce(30, 'euro_viaggio', 101.6, 7)));
verifica('senza quantita fa zero', importoVoce(72, 'euro_tonnellata', 0, 0) === 0);

console.log('LE VOCI SI VEDONO SEMPRE, ANCHE A ZERO');
{
  // Settembre: Napoli 89,18 t e Caserta 35,62 t; Salerno e Avellino nessun
  // conferimento. Le quattro righe devono esserci tutte e quattro.
  const dati = [
    { soggetto: 'LOGISTICA & PNEUMATICI SRL (*)', provincia: 'NAPOLI', tonnellate: 89.18, viaggi: 0 },
    { soggetto: 'LOGISTICA & PNEUMATICI SRL (*)', provincia: 'CASERTA', tonnellate: 35.62, viaggi: 0 },
  ];
  const b = bloccoPassiva(LOGISTICA, dati, 'RETE', 'raccoglitori');
  const voci = b.righe.filter(r => r.tipo === 'voce');
  verifica('quattro voci, anche le due vuote', voci.length === 4, String(voci.length));
  verifica('Napoli fa 6.064,24', voci[0].totale === 6064.24, String(voci[0].totale));
  verifica('Salerno e Avellino restano a zero', voci[1].totale === 0 && voci[2].totale === 0);
  verifica('Caserta fa 2.564,64', voci[3].totale === 2564.64, String(voci[3].totale));
  // La riga del soggetto porta il totale delle sue voci.
  const capo = b.righe.find(r => r.tipo === 'soggetto');
  verifica('il soggetto somma le sue voci', capo.tonnellate === 124.8 && capo.totale === 8628.88,
    JSON.stringify({ t: capo.tonnellate, e: capo.totale }));
  verifica('e il blocco somma i soggetti', b.totale_t === 124.8 && b.totale_euro === 8628.88, JSON.stringify(b.totale_euro));
}

console.log('A CIASCUNA VOCE I SUOI CHILI');
{
  // Due voci dello stesso fornitore, distinte dalla provincia: i chili non si
  // devono sommare su tutte e due.
  const righe = [
    { soggetto: 'X', provincia: 'NAPOLI', tonnellate: 10 },
    { soggetto: 'X', provincia: 'CASERTA', tonnellate: 4 },
  ];
  verifica('la voce di Napoli prende solo Napoli',
    tonnellateDellaVoce({ criterio_json: JSON.stringify({ provincia: 'NAPOLI' }) }, righe).tonnellate === 10);
  verifica('e quella di Caserta solo Caserta',
    tonnellateDellaVoce({ criterio_json: JSON.stringify({ provincia: 'CASERTA' }) }, righe).tonnellate === 4);
  // Senza criterio la voce prende tutto il soggetto: e' il caso dei fornitori con
  // una riga sola, che nel foglio dell'amministrazione sono la maggior parte.
  verifica('senza criterio prende tutto', tonnellateDellaVoce({}, righe).tonnellate === 14);
  // Un criterio scritto male non deve far sparire i chili in silenzio: non
  // combacia, e la voce resta a zero - si vede.
  verifica('un criterio che non combacia lascia la voce a zero',
    tonnellateDellaVoce({ criterio_json: JSON.stringify({ provincia: 'BARI' }) }, righe).tonnellate === 0);
  verifica('e un criterio illeggibile non butta via niente',
    tonnellateDellaVoce({ criterio_json: '{rotto' }, righe).tonnellate === 14);
  // Le classi: una riga ne puo' portare piu' d'una.
  verifica('le classi si confrontano una per una',
    tonnellateDellaVoce({ criterio_json: JSON.stringify({ classi: ['G2'] }) }, [{ classe: 'P, M', tonnellate: 5 }, { classe: 'G2', tonnellate: 3 }]).tonnellate === 3);
}

console.log('CHI HA MOVIMENTI MA NON E NEL MODELLO SI DICE');
{
  // Non si butta via e non si inventa un prezzo: si elenca, perche' e' il segnale
  // che il modello va aggiornato.
  const b = bloccoPassiva(LOGISTICA, [
    { soggetto: 'LOGISTICA & PNEUMATICI SRL (*)', provincia: 'NAPOLI', tonnellate: 89.18 },
    { soggetto: 'FORNITORE NUOVO SRL', provincia: 'BARI', tonnellate: 12.5 },
  ], 'RETE', 'raccoglitori');
  verifica('il fornitore fuori modello e segnalato', b.non_previsti.length === 1 && b.non_previsti[0].soggetto === 'FORNITORE NUOVO SRL', JSON.stringify(b.non_previsti));
  verifica('coi suoi chili', b.non_previsti[0].tonnellate === 12.5);
  verifica('e non entra nei totali', b.totale_t === 89.18, String(b.totale_t));
}

console.log('L ORDINE DEL FOGLIO');
{
  const mescolate = [
    { canale: 'RETE', blocco: 'raccoglitori', soggetto: 'B', voce: '', ordine: 20 },
    { canale: 'RETE', blocco: 'raccoglitori', soggetto: 'A', voce: '', ordine: 10 },
    { canale: 'ACI', blocco: 'raccoglitori', soggetto: 'C', voce: '', ordine: 5 },
    { canale: 'RETE', blocco: 'impianti', soggetto: 'D', voce: '', ordine: 1 },
    { canale: 'RETE', blocco: 'raccoglitori', soggetto: 'Z', voce: '', ordine: 10, attiva: false },
  ];
  const v = vociOrdinate(mescolate, 'RETE', 'raccoglitori');
  verifica('un canale e un blocco per volta', v.length === 2, String(v.length));
  verifica('nell ordine scritto', v[0].soggetto === 'A' && v[1].soggetto === 'B');
  verifica('e le voci spente restano fuori', !v.some(x => x.soggetto === 'Z'));
}

console.log('IL FOGLIO INTERO');
{
  const passiva = {
    raccoglitori: [{ soggetto: 'A', tonnellate: 10 }],
    impianti_stoccaggi: [{ soggetto: 'I', tonnellate: 20 }],
    trasporti_secondaria: [{ produttore: 'P', trasportatore: 'T', destinatario: 'D', tonnellate: 5, viaggi: 2, tariffa_valore: 30, unita_misura: 'euro_tonnellata', importo: 150 }],
  };
  const voci = [
    { canale: 'RETE', blocco: 'raccoglitori', soggetto: 'A', voce: '', prezzo: 70, ordine: 10 },
    { canale: 'RETE', blocco: 'impianti', soggetto: 'I', voce: '', prezzo: 105, ordine: 10 },
  ];
  const f = foglioPassiva(voci, passiva, 'RETE', 'Settembre');
  verifica('i tre blocchi ci sono', !!f.raccoglitori && !!f.impianti && !!f.trasporti);
  verifica('il trasporto si riporta com e', f.trasporti.righe.length === 1 && f.trasporti.totale_euro === 150);
  // Il totale in cima e' la somma dei tre blocchi DI QUESTO CANALE: 700 + 2100 + 150.
  verifica('il totale in cima somma i tre blocchi', f.totale_euro === 2950, String(f.totale_euro));
  verifica('e il canale resta scritto', f.canale === 'RETE' && f.mese === 'Settembre');
}

console.log('IL MODELLO PROPOSTO DA UN MESE GIA FATTO');
{
  // Serve a non far cominciare da un foglio vuoto: una voce per soggetto, col
  // prezzo che quel mese ha usato. E' un punto di partenza da correggere.
  const m = modelloDaPassiva({
    raccoglitori: [{ soggetto: 'A', tariffa_valore: 70, unita_misura: 'euro_tonnellata' }, { soggetto: 'A', tariffa_valore: 70 }],
    impianti_stoccaggi: [{ soggetto: 'I', tariffa_valore: 105 }],
  }, 'RETE', 2026);
  verifica('un soggetto una voce, senza doppioni', m.length === 2, String(m.length));
  verifica('col suo blocco e il suo prezzo',
    m[0].blocco === 'raccoglitori' && m[0].prezzo === 70 && m[1].blocco === 'impianti' && m[1].prezzo === 105);
  verifica('e con l anno e il canale giusti', m.every(v => v.anno === 2026 && v.canale === 'RETE'));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
