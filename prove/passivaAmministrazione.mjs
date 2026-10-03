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

const { importoVoce, vociOrdinate, righePiatte, assegnaRighe, rigaDellaVoce, bloccoPassiva, foglioPassiva, modelloDaPassiva } = await caricaLibPagine('lib/passivaAmministrazione');

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

console.log('A CIASCUNA VOCE I SUOI CHILI, UNA VOLTA SOLA');
{
  // I chili si ASSEGNANO: ogni movimento va a una voce sola, la prima che lo
  // riconosce. Prima si filtrava - ogni voce guardava tutte le righe del
  // fornitore - e una voce senza criterio riprendeva anche i chili che le altre
  // avevano gia' preso: il totale del fornitore usciva doppio.
  const voce = (criterio) => ({ soggetto: 'X', criterio_json: criterio ? JSON.stringify(criterio) : '' });
  const righe = [
    { soggetto: 'X', provincia: 'NA', tonnellate: 10 },
    { soggetto: 'X', provincia: 'CE', tonnellate: 4 },
  ];
  {
    const napoli = voce({ provincia: 'NA' }), caserta = voce({ provincia: 'CE' });
    const { quote, fuori } = assegnaRighe([napoli, caserta], righe);
    verifica('la voce di Napoli prende solo Napoli', quote.get(napoli).tonnellate === 10);
    verifica('e quella di Caserta solo Caserta', quote.get(caserta).tonnellate === 4);
    verifica('e niente resta fuori', fuori.length === 0);
  }
  {
    // E' il caso di T-CYCLE: tre voci sulle classi e una, «STOCK (fatturato)»,
    // senza criterio. Quella senza criterio prende SOLO quello che resta.
    const classi = voce({ classi: ['P', 'M'] }), resto = voce(null);
    const { quote } = assegnaRighe([classi, resto], [
      { soggetto: 'X', classe: 'P, M', tonnellate: 124.8 },
      { soggetto: 'X', classe: '—', tonnellate: 3 },
    ]);
    verifica('la voce sulle classi prende i suoi', quote.get(classi).tonnellate === 124.8, String(quote.get(classi).tonnellate));
    verifica('e quella senza criterio solo il resto, non tutto', quote.get(resto).tonnellate === 3, String(quote.get(resto).tonnellate));
  }
  {
    // Un criterio che non combacia lascia la voce a zero - e i chili non
    // spariscono: senza una voce che li prenda restano fuori e si dichiarano.
    const bari = voce({ provincia: 'BA' });
    const { quote, fuori } = assegnaRighe([bari], righe);
    verifica('un criterio che non combacia lascia la voce a zero', quote.get(bari).tonnellate === 0);
    verifica('e i chili senza voce restano fuori, non sparisco', fuori.length === 2);
  }
  {
    // Un criterio illeggibile non e' un criterio: la voce prende quello che resta.
    const rotta = { soggetto: 'X', criterio_json: '{rotto' };
    const { quote } = assegnaRighe([rotta], righe);
    verifica('un criterio illeggibile non butta via niente', quote.get(rotta).tonnellate === 14);
  }
  // Le classi: una riga ne puo' portare piu' d'una, e basta che ne combaci una.
  verifica('le classi si confrontano una per una',
    rigaDellaVoce({ classi: ['G2'] }, { classe: 'G2' }) && !rigaDellaVoce({ classi: ['G2'] }, { classe: 'P, M' }));
  verifica('una riga con due classi combacia con la voce che ne chiede una',
    rigaDellaVoce({ classi: ['P', 'M'] }, { classe: 'P, M' }));
  // La prestazione, negli impianti: stoccaggio e trattamento si scrivono in due
  // modi e devono combaciare entrambi.
  verifica('stoccaggio combacia con CONFERIMENTO_STOCCAGGIO',
    rigaDellaVoce({ prestazione: 'stoccaggio' }, { prestazione: 'CONFERIMENTO_STOCCAGGIO' }));
  verifica('e non col trattamento',
    !rigaDellaVoce({ prestazione: 'stoccaggio' }, { prestazione: 'TRATTAMENTO' }));
  // La destinazione e' una ragione sociale: «Gatim» nel foglio e «GATIM S.R.L.»
  // nei movimenti sono la stessa cosa.
  verifica('la destinazione si riconosce anche scritta in un altro modo',
    rigaDellaVoce({ destinazione: 'Gatim' }, { destinazione: 'GATIM S.R.L.' }));
  verifica('ma non si confonde con un altro impianto',
    !rigaDellaVoce({ destinazione: 'Gatim' }, { destinazione: 'Irigom S.r.l.' }));
  // La regione, se sulla riga non c'e', si ricava dalla provincia.
  verifica('la regione si ricava dalla sigla della provincia',
    rigaDellaVoce({ regione: 'Campania' }, { provincia: 'NA' }));
}

console.log('I CHILI CHE NESSUNA VOCE PRENDE SI SCRIVONO');
{
  // Un chilo che sparisce dal foglio e' un chilo che non si fattura: la riga
  // «senza voce» esiste per non farlo sparire in silenzio.
  const b = bloccoPassiva([
    { canale: 'RETE', blocco: 'impianti', soggetto: 'IMPIANTO X', voce: 'classi P+M', prezzo: 90, ordine: 10, criterio_json: JSON.stringify({ classi: ['P', 'M'] }) },
  ], [
    { soggetto: 'IMPIANTO X', classe: 'P, M', tonnellate: 10 },
    { soggetto: 'IMPIANTO X', classe: 'G2', tonnellate: 2 },
  ], 'RETE', 'impianti');
  const senza = b.righe.find(r => r.tipo === 'senza_voce');
  verifica('la riga senza voce c e', !!senza && senza.tonnellate === 2, JSON.stringify(senza));
  verifica('e dice di che si tratta', senza && /G2/.test(senza.dettaglio), senza && senza.dettaglio);
  verifica('il totale del soggetto li comprende', b.righe[0].tonnellate === 12, String(b.righe[0].tonnellate));
  verifica('ma non si fatturano a un prezzo inventato', b.totale_euro === 900, String(b.totale_euro));
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

console.log('LA FORMA VERA DI calcolaPassiva');
{
  // calcolaPassiva raggruppa per fornitore: { fornitore, righe: [...], totale_* }.
  // Il 03/10/2026 il foglio e uscito TUTTO A ZERO coi nomi vuoti perche cercavo
  // r.soggetto su righe che si chiamano fornitore e tengono i numeri dentro
  // righe[]. L'utente: «ci sono ancora errori».
  const gruppi = [
    { fornitore: 'C.L. SERVICE S.R.L.', righe: [{ provincia: 'NAPOLI', tonnellate: 2.14, tariffa_valore: 71, importo: 151.94 }], totale_tonnellate: 2.14, totale_euro: 151.94 },
    { fornitore: 'SENZA DETTAGLIO SRL', righe: [], totale_tonnellate: 9, totale_euro: 630 },
  ];
  const piatte = righePiatte(gruppi);
  verifica('il nome del fornitore finisce su ogni riga', piatte[0].soggetto === 'C.L. SERVICE S.R.L.', JSON.stringify(piatte[0]));
  verifica('e i numeri sono quelli della riga', piatte[0].tonnellate === 2.14);
  verifica('un fornitore senza dettaglio non si perde', piatte.length === 2 && piatte[1].tonnellate === 9, String(piatte.length));
  verifica('senza gruppi non si rompe niente', righePiatte(null).length === 0);
}

console.log('IL FOGLIO INTERO');
{
  // La forma e' quella vera di calcolaPassiva: gruppi con dentro le righe.
  const passiva = {
    raccoglitori: [{ fornitore: 'A', righe: [{ tonnellate: 10 }], totale_tonnellate: 10, totale_euro: 700 }],
    impianti_stoccaggi: [{ fornitore: 'I', righe: [{ tonnellate: 20 }], totale_tonnellate: 20, totale_euro: 2100 }],
    trasporti_secondaria: [{ fornitore: 'T', righe: [{ stoccaggio: 'P', destinazione: 'D', tonnellate: 5, viaggi: 2, tariffa_valore: 30, unita_misura: 'euro_tonnellata', importo: 150 }] }],
  };
  const voci = [
    { canale: 'RETE', blocco: 'raccoglitori', soggetto: 'A', voce: '', prezzo: 70, ordine: 10 },
    { canale: 'RETE', blocco: 'impianti', soggetto: 'I', voce: '', prezzo: 105, ordine: 10 },
  ];
  const f = foglioPassiva(voci, passiva, 'RETE', 'Settembre');
  verifica('i tre blocchi ci sono', !!f.raccoglitori && !!f.impianti && !!f.trasporti);
  verifica('i raccoglitori prendono i loro chili', f.raccoglitori.totale_t === 10 && f.raccoglitori.totale_euro === 700, JSON.stringify(f.raccoglitori.totale_euro));
  verifica('e gli impianti i loro', f.impianti.totale_euro === 2100, String(f.impianti.totale_euro));
  verifica('il trasporto porta il trasportatore, il produttore e il destinatario',
    f.trasporti.righe.length === 1 && f.trasporti.righe[0].trasportatore === 'T' && f.trasporti.righe[0].produttore === 'P' && f.trasporti.righe[0].destinatario === 'D',
    JSON.stringify(f.trasporti.righe));
  verifica('e il suo importo', f.trasporti.totale_euro === 150);
  // Il totale in cima e la somma dei tre blocchi DI QUESTO CANALE: 700 + 2100 + 150.
  verifica('il totale in cima somma i tre blocchi', f.totale_euro === 2950, String(f.totale_euro));
  verifica('e il canale resta scritto', f.canale === 'RETE' && f.mese === 'Settembre');
}

console.log('IL MODELLO PROPOSTO DA UN MESE GIA FATTO');
{
  // Serve a non far cominciare da un foglio vuoto: una voce per soggetto, col
  // prezzo che quel mese ha usato. E' un punto di partenza da correggere.
  const m = modelloDaPassiva({
    raccoglitori: [{ fornitore: 'A', righe: [{ tariffa_valore: 70, unita_misura: 'euro_tonnellata' }] }],
    impianti_stoccaggi: [{ fornitore: 'I', righe: [{ tariffa_valore: 105 }] }],
  }, 'RETE', 2026);
  verifica('un soggetto una voce, senza doppioni', m.length === 2, String(m.length));
  verifica('col suo blocco e il suo prezzo',
    m[0].blocco === 'raccoglitori' && m[0].prezzo === 70 && m[1].blocco === 'impianti' && m[1].prezzo === 105);
  verifica('e con l anno e il canale giusti', m.every(v => v.anno === 2026 && v.canale === 'RETE'));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
