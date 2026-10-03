// I SOVRACOSTI DI UN INTERVENTO DI EXTRA RACCOLTA, PAGATI A CHI SPETTANO.
//
// La precisazione dell'utente del 03/10/2026: «il sovraccosto nella passiva puo'
// essere dovuto al raccoglitore (quando ad esempio ha dovuto sostenere costi
// imprevisti nella raccolta per diverse ragioni) o per l'impianto di
// conferimento che li deve lavorare (trattare/triturare) per diversi motivi (ad
// esempio costi non previsti sostenuti per la pulizia di pfu sporchi prima del
// trattamento)».
//
// Quindi un sovracosto ha un padrone: si somma all'importo della riga del
// raccoglitore oppure a quella dell'impianto di destinazione, una volta sola.
// Questa prova guarda gli importi al centesimo e, soprattutto, che il totale del
// canale cresca esattamente della somma dei sovracosti pagati: il rischio di
// questo lavoro e' pagare due volte lo stesso importo. npm run prove
import { calcolaPassivaMese, indiceMesePassiva } from '../base44/shared/passivaCalcolo.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const GIORNO = '2026-09-10T08:00:00Z';
const MESE = indiceMesePassiva('Settembre');

// Un intervento di extra raccolta come lo scrive l'amministratore: terminato,
// con le tre date obbligatorie e i costi scritti a mano sulla riga.
const intervento = (campi) => ({
  stato: 'terminato', cer: '160103', classe: 'A', tipo_movimento: 'primaria',
  ordine_immesso_il: GIORNO, trasporto_iniziato_il: GIORNO, trasporto_finito_il: GIORNO,
  tipo_destinazione: 'imp', provincia: 'BA', automezzo: 'AA111AA',
  costo_raccolta_t: 0, costo_stoccaggio_t: 0, costo_trattamento_t: 0,
  sovracosto_pagato_raccoglitore: 0, sovracosto_pagato_impianto: 0,
  costo_pulizia: 0, costi_aggiuntivi: 0, costo_trasporto_viaggio: 0,
  ...campi,
});

const fornitori = [
  { ragione_sociale: 'ALFA SRL', stato: 'attivo' },
  { ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' },
  { ragione_sociale: 'GAMMA TRASPORTI', stato: 'attivo' },
  { ragione_sociale: 'DELTA IMPIANTI', stato: 'attivo' },
  { ragione_sociale: 'EPSILON RACCOLTE', stato: 'attivo' },
  { ragione_sociale: 'ZETA IMPIANTI', stato: 'attivo' },
  { ragione_sociale: 'SMOCO SRL', stato: 'attivo', interno: true },
];

// A: solo il sovracosto del raccoglitore. E ed F stanno nello stesso gruppo di A
// (stesso raccoglitore, stessa destinazione, stessa provincia, stesso prezzo):
// e' il caso che fa sbagliare i conti, perche' un gruppo raccoglie tre interventi
// e il sovracosto di ciascuno deve entrare una volta e una sola.
const interventi = [
  intervento({
    id: 'A', id_ordine: 'EX-A', numero_fir: 'A1', peso_effettivo: 10000,
    trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI',
    costo_raccolta_t: 50, costo_trattamento_t: 100,
    sovracosto_pagato_raccoglitore: 120, note_costi: 'strada chiusa, due viaggi invece di uno',
  }),
  intervento({
    id: 'B', id_ordine: 'EX-B', numero_fir: 'B1', peso_effettivo: 4000,
    trasportatore: 'GAMMA TRASPORTI', destinazione: 'DELTA IMPIANTI',
    costo_raccolta_t: 60, costo_trattamento_t: 90,
    sovracosto_pagato_impianto: 80, note_costi: 'pfu sporchi, lavati prima di triturarli',
  }),
  intervento({
    id: 'C', id_ordine: 'EX-C', numero_fir: 'C1', peso_effettivo: 2500,
    trasportatore: 'EPSILON RACCOLTE', destinazione: 'ZETA IMPIANTI',
    costo_raccolta_t: 40, costo_trattamento_t: 120,
    sovracosto_pagato_raccoglitore: 50.5, sovracosto_pagato_impianto: 30.25,
    note_costi: 'ritiro in salita e cerchioni da togliere',
  }),
  intervento({
    id: 'D', id_ordine: 'EX-D', numero_fir: 'D1', peso_effettivo: 1000,
    trasportatore: 'SMOCO SRL', destinazione: 'SMOCO SRL',
    costo_raccolta_t: 50, costo_trattamento_t: 100,
    sovracosto_pagato_raccoglitore: 200, sovracosto_pagato_impianto: 100,
    note_costi: 'fatto in casa',
  }),
  intervento({
    id: 'E', id_ordine: 'EX-E', numero_fir: 'E1', peso_effettivo: 3000,
    trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI',
    costo_raccolta_t: 50, costo_trattamento_t: 100,
    costo_pulizia: 150, costi_aggiuntivi: 50, note_costi: 'pulizia del piazzale',
  }),
  intervento({
    id: 'F', id_ordine: 'EX-F', numero_fir: 'F1', peso_effettivo: 2000,
    trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI',
    costo_raccolta_t: 50, costo_trattamento_t: 100,
    sovracosto_pagato_raccoglitore: 30, note_costi: 'gomme da scavare dal fango',
  }),
];

const dati = {
  primarieRete: [], primarieAci: [], secondarieAll: [],
  extraRaccoltaAll: interventi,
  tariffeAll: [], fornitoriAll: fornitori,
};
const res = calcolaPassivaMese(dati, 2026, MESE, 'Settembre', 'EXTRA_RACCOLTA');

const racc = (nome) => res.raccoglitori.find(f => f.fornitore === nome);
const imp = (nome) => res.impianti_stoccaggi.find(f => f.fornitore === nome);
const euro = (v) => Math.round(v * 100);

console.log('IL SOVRACOSTO DEL RACCOGLITORE SI PAGA AL RACCOGLITORE');
{
  // ALFA ha raccolto A (10 t), E (3 t) e F (2 t) allo stesso prezzo: una riga
  // sola, 15 t a 50 euro sono 750, piu' 120 di A e 30 di F.
  const f = racc('ALFA SRL');
  verifica('una riga sola per i tre interventi dello stesso gruppo', f && f.righe.length === 1, JSON.stringify(f && f.righe));
  const r = f.righe[0];
  verifica('le tonnellate sono quelle dei tre interventi', r.tonnellate === 15, String(r.tonnellate));
  verifica('l importo e 15 t per 50 euro piu i due sovracosti: 900,00', euro(r.importo) === 90000, String(r.importo));
  verifica('il sovracosto e un campo suo e vale 150,00', euro(r.sovracosto_euro) === 15000, String(r.sovracosto_euro));
  verifica('la tariffa mostrata resta quella dell intervento', r.tariffa_valore === 50 && r.unita_misura === '€/t');
  verifica('la nota spiega la differenza fra la moltiplicazione e l importo',
    /sovracosto/.test(r.note) && /150,00/.test(r.note), r.note);
  verifica('e dice da quali interventi viene', /A1/.test(r.note) && /F1/.test(r.note), r.note);
  verifica('l intervento senza sovracosto non entra nella nota', !/E1/.test(r.note), r.note);
  verifica('la nota non e un errore da colorare di rosso', r.nota_informativa === true, String(r.nota_informativa));
  // Il motivo e' testo libero dell'utente e sta in un campo suo: nella nota
  // della riga le parole «interno», «compreso» e «senza tariffa» cambiano il
  // senso di una riga per il format amministrazione.
  verifica('il motivo scritto sull intervento viene riportato', /strada chiusa/.test(r.sovracosto_motivo) && /fango/.test(r.sovracosto_motivo), r.sovracosto_motivo);
  verifica('il motivo non finisce dentro la nota della riga', !/strada chiusa/.test(r.note), r.note);
  verifica('il totale del fornitore e quello della sua riga', euro(f.totale_euro) === 90000, String(f.totale_euro));
}

console.log('IL SOVRACOSTO DEL RACCOGLITORE NON TOCCA LA RIGA DELL IMPIANTO');
{
  // BETA ha ricevuto gli stessi 15 t: 1.500,00 e nient altro. Se il sovracosto
  // di ALFA finisse anche qui, lo pagheremmo due volte.
  const f = imp('BETA IMPIANTI');
  verifica('una riga sola di trattamento', f && f.righe.length === 1 && f.righe[0].prestazione === 'TRATTAMENTO', JSON.stringify(f && f.righe));
  verifica('15 t a 100 euro: 1.500,00 e basta', euro(f.righe[0].importo) === 150000, String(f.righe[0].importo));
  verifica('sulla riga dell impianto il sovracosto e zero', f.righe[0].sovracosto_euro === 0, String(f.righe[0].sovracosto_euro));
  verifica('e la riga non ha niente da spiegare', f.righe[0].note === '', JSON.stringify(f.righe[0].note));
}

console.log('IL SOVRACOSTO DELL IMPIANTO SI PAGA ALL IMPIANTO');
{
  const fi = imp('DELTA IMPIANTI');
  verifica('4 t a 90 euro piu 80: 440,00', euro(fi.righe[0].importo) === 44000, String(fi.righe[0].importo));
  verifica('il campo dice 80,00', euro(fi.righe[0].sovracosto_euro) === 8000, String(fi.righe[0].sovracosto_euro));
  verifica('la nota parla del trattamento, non della raccolta', /del trattamento/.test(fi.righe[0].note), fi.righe[0].note);
  verifica('e riporta il motivo dell intervento', /pfu sporchi/.test(fi.righe[0].sovracosto_motivo), fi.righe[0].sovracosto_motivo);
  const fr = racc('GAMMA TRASPORTI');
  verifica('il raccoglitore dello stesso intervento paga solo la raccolta: 240,00', euro(fr.righe[0].importo) === 24000, String(fr.righe[0].importo));
  verifica('e sulla sua riga il sovracosto e zero', fr.righe[0].sovracosto_euro === 0, String(fr.righe[0].sovracosto_euro));
}

console.log('UN INTERVENTO CON TUTTI E DUE I SOVRACOSTI');
{
  const fr = racc('EPSILON RACCOLTE');
  verifica('raccolta 2,5 t a 40 euro piu 50,50: 150,50', euro(fr.righe[0].importo) === 15050, String(fr.righe[0].importo));
  verifica('con il suo campo a 50,50', euro(fr.righe[0].sovracosto_euro) === 5050, String(fr.righe[0].sovracosto_euro));
  const fi = imp('ZETA IMPIANTI');
  verifica('trattamento 2,5 t a 120 euro piu 30,25: 330,25', euro(fi.righe[0].importo) === 33025, String(fi.righe[0].importo));
  verifica('con il suo campo a 30,25', euro(fi.righe[0].sovracosto_euro) === 3025, String(fi.righe[0].sovracosto_euro));
  verifica('i due sovracosti dello stesso intervento non si mescolano',
    euro(fr.righe[0].sovracosto_euro + fi.righe[0].sovracosto_euro) === 8075);
}

console.log('A SE STESSI NON SI FATTURA, NEMMENO IL SOVRACOSTO');
{
  const fr = racc('SMOCO SRL');
  const fi = imp('SMOCO SRL');
  verifica('il raccoglitore interno non prende niente', euro(fr.totale_euro) === 0, String(fr.totale_euro));
  verifica('e il suo sovracosto non si paga', fr.righe[0].sovracosto_euro === 0, String(fr.righe[0].sovracosto_euro));
  verifica('la riga dice che e interno', /interno, non fatturato/.test(fr.righe[0].note), fr.righe[0].note);
  verifica('e dice anche che i 200,00 non si pagano', /200,00/.test(fr.righe[0].note), fr.righe[0].note);
  verifica('l impianto interno non prende niente', euro(fi.totale_euro) === 0 && fi.righe[0].sovracosto_euro === 0, JSON.stringify(fi.righe[0]));
  verifica('e lo dice anche per i suoi 100,00', /100,00/.test(fi.righe[0].note), fi.righe[0].note);
}

console.log('LA PULIZIA E I COSTI AGGIUNTIVI RESTANO SENZA PADRONE');
{
  const a = res.anomalie.filter(x => x.prestazione === 'ONERI INTERVENTO');
  verifica('un onere senza padrone resta un anomalia, una sola', a.length === 1, JSON.stringify(a.map(x => x.ambito)));
  verifica('e riguarda l intervento E1, quello con la pulizia', a[0].ambito === 'FIR E1', a[0].ambito);
  verifica('dice i 200,00 euro che il modulo Extra Raccolta conta nel costo', /200,00/.test(a[0].descrizione), a[0].descrizione);
  verifica('e dice il rimedio: scriverli nel sovracosto di chi li ha sostenuti',
    /sovracosto pagato al raccoglitore/.test(a[0].descrizione) && /sovracosto pagato all'impianto/.test(a[0].descrizione), a[0].descrizione);
  verifica('e riporta la nota dell intervento', /pulizia del piazzale/.test(a[0].descrizione), a[0].descrizione);
  // I due sovracosti nuovi sono pagati: non sono piu' un'anomalia.
  verifica('un intervento con un sovracosto pagato non e un anomalia',
    !res.anomalie.some(x => /A1|B1|C1|F1/.test(String(x.ambito)) && /SOVRACOSTO|ONERI/.test(String(x.prestazione))),
    JSON.stringify(res.anomalie.map(x => x.prestazione + ' ' + x.ambito)));
}

console.log('IL TOTALE DEL CANALE CRESCE ESATTAMENTE DEI SOVRACOSTI PAGATI');
{
  // Lo stesso mese con i due campi azzerati: la differenza fra i due totali
  // deve essere la somma dei sovracosti pagati, non un centesimo di piu'.
  const senza = calcolaPassivaMese({
    ...dati,
    extraRaccoltaAll: interventi.map(r => ({ ...r, sovracosto_pagato_raccoglitore: 0, sovracosto_pagato_impianto: 0 })),
  }, 2026, MESE, 'Settembre', 'EXTRA_RACCOLTA');

  // 120 + 30 ad ALFA, 80 a DELTA, 50,50 a EPSILON, 30,25 a ZETA. I 300 di SMOCO
  // non si pagano: e' interno.
  const pagati = 120 + 30 + 80 + 50.5 + 30.25;
  verifica('senza sovracosti il canale vale 3.250,00', euro(senza.totali.totale_complessivo) === 325000, String(senza.totali.totale_complessivo));
  verifica('con i sovracosti vale 3.560,75', euro(res.totali.totale_complessivo) === 356075, String(res.totali.totale_complessivo));
  verifica('la differenza e esattamente 310,75',
    euro(res.totali.totale_complessivo) - euro(senza.totali.totale_complessivo) === euro(pagati),
    String(res.totali.totale_complessivo - senza.totali.totale_complessivo));
  verifica('il blocco dei raccoglitori cresce dei suoi 200,50',
    euro(res.totali.raccoglitori) - euro(senza.totali.raccoglitori) === euro(120 + 30 + 50.5));
  verifica('il blocco degli impianti cresce dei suoi 110,25',
    euro(res.totali.impianti_stoccaggi) - euro(senza.totali.impianti_stoccaggi) === euro(80 + 30.25));
  verifica('il trasporto delle secondarie non c entra', res.totali.trasporti_secondaria === 0 && senza.totali.trasporti_secondaria === 0);
  // Il controllo fatto dall'altro verso: la somma dei campi sovracosto_euro di
  // tutte le righe dei due blocchi e' la stessa cifra. Se un importo comparisse
  // due volte, qui non tornerebbe.
  const sommaCampi = [...res.raccoglitori, ...res.impianti_stoccaggi]
    .flatMap(f => f.righe).reduce((s, r) => s + Number(r.sovracosto_euro || 0), 0);
  verifica('e la somma dei campi delle righe dice la stessa cosa', euro(sommaCampi) === euro(pagati), String(sommaCampi));
  verifica('le tonnellate non cambiano: un sovracosto non e un peso',
    res.quadratura.tonnellate_totali === senza.quadratura.tonnellate_totali && res.quadratura.coincidente === true);
}

console.log('IL SOVRACOSTO SEGUE LA CATENA DEI SUBFORNITORI');
{
  // Torres raccoglie col proprio nome ma fattura tramite il principale: anche il
  // suo sovracosto si paga al principale, come il resto del calcolo.
  const res2 = calcolaPassivaMese({
    ...dati,
    extraRaccoltaAll: [intervento({
      id: 'H', id_ordine: 'EX-H', numero_fir: 'H1', peso_effettivo: 5000,
      trasportatore: 'TORRES GIOVANNI', destinazione: 'BETA IMPIANTI',
      costo_raccolta_t: 70, costo_trattamento_t: 100,
      sovracosto_pagato_raccoglitore: 45, note_costi: 'gomme da sollevare a mano',
    })],
    fornitoriAll: [...fornitori, { ragione_sociale: 'TORRES GIOVANNI', stato: 'attivo', fattura_tramite_nome: 'ALFA SRL' }],
  }, 2026, MESE, 'Settembre', 'EXTRA_RACCOLTA');
  verifica('la riga e del principale, non del subraccoglitore',
    res2.raccoglitori.length === 1 && res2.raccoglitori[0].fornitore === 'ALFA SRL',
    JSON.stringify(res2.raccoglitori.map(f => f.fornitore)));
  verifica('5 t a 70 euro piu 45: 395,00', euro(res2.raccoglitori[0].righe[0].importo) === 39500, String(res2.raccoglitori[0].righe[0].importo));
  verifica('con il campo a 45,00', euro(res2.raccoglitori[0].righe[0].sovracosto_euro) === 4500);
  verifica('e il subraccoglitore resta visibile come di cui',
    res2.raccoglitori[0].di_cui.length === 1 && res2.raccoglitori[0].di_cui[0].fornitore === 'TORRES GIOVANNI',
    JSON.stringify(res2.raccoglitori[0].di_cui));
}

console.log('UN SOVRACOSTO SENZA NESSUNO A CUI PAGARLO SI DICE');
{
  // Senza raccoglitore e senza destinazione quelle righe non nascono: il
  // sovracosto sparirebbe dai conti senza una parola, e nessuno lo cercherebbe.
  const res3 = calcolaPassivaMese({
    ...dati,
    extraRaccoltaAll: [
      intervento({
        id: 'G', id_ordine: 'EX-G', numero_fir: 'G1', peso_effettivo: 1000,
        trasportatore: '', destinazione: 'BETA IMPIANTI',
        costo_raccolta_t: 50, costo_trattamento_t: 100, sovracosto_pagato_raccoglitore: 99,
      }),
      intervento({
        id: 'I', id_ordine: 'EX-I', numero_fir: 'I1', peso_effettivo: 1000,
        trasportatore: 'ALFA SRL', destinazione: '',
        costo_raccolta_t: 50, sovracosto_pagato_impianto: 77,
      }),
    ],
  }, 2026, MESE, 'Settembre', 'EXTRA_RACCOLTA');
  const senzaRacc = res3.anomalie.find(x => x.prestazione === 'SOVRACOSTO RACCOGLITORE');
  const senzaImp = res3.anomalie.find(x => x.prestazione === 'SOVRACOSTO IMPIANTO');
  verifica('il sovracosto del raccoglitore senza raccoglitore e un anomalia',
    senzaRacc && /99,00/.test(senzaRacc.descrizione) && senzaRacc.ambito === 'FIR G1', JSON.stringify(senzaRacc));
  verifica('il sovracosto dell impianto senza destinazione e un anomalia',
    senzaImp && /77,00/.test(senzaImp.descrizione) && senzaImp.ambito === 'FIR I1', JSON.stringify(senzaImp));
  // 1 t a 50 per l'intervento I (il G non ha raccoglitore) e 1 t a 100 di
  // trattamento per il G: 150,00, senza nessuno dei due sovracosti.
  verifica('e nessuno dei due entra nei totali', euro(res3.totali.totale_complessivo) === 15000, String(res3.totali.totale_complessivo));
}

console.log('I CANALI RESTANO SEPARATI');
{
  // Rete, ACI ed extra raccolta non si sommano mai. I campi del sovracosto
  // stanno sull'intervento di extra raccolta: su un movimento di rete non
  // esistono, e se qualcuno li scrivesse non devono pagare niente.
  const res4 = calcolaPassivaMese({
    primarieRete: [{
      stato: 'terminato', cer: '160103', classe: 'A', id: 'R1', id_ordine: 'ET1', numero_fir: 'R1',
      peso_effettivo: 10000, provincia: 'BA', automezzo: 'AA111AA',
      ordine_immesso_il: GIORNO, trasporto_iniziato_il: GIORNO, trasporto_finito_il: GIORNO,
      trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', tipo_destinazione: 'imp',
      sovracosto_pagato_raccoglitore: 500, sovracosto_pagato_impianto: 500,
    }],
    primarieAci: [], secondarieAll: [], extraRaccoltaAll: [],
    tariffeAll: [
      { id: 't1', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'ALFA SRL', tipologia: 'RETE', valore: 60, unita_misura: '€/t' },
      { id: 't2', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'BETA IMPIANTI', tipologia: 'RETE', valore: 80, unita_misura: '€/t' },
    ],
    fornitoriAll: fornitori,
  }, 2026, MESE, 'Settembre', 'RETE');
  verifica('sulla rete il sovracosto di un intervento non si paga: 600 + 800',
    euro(res4.totali.totale_complessivo) === 140000, String(res4.totali.totale_complessivo));
  verifica('e le righe della rete hanno il campo a zero',
    res4.raccoglitori[0].righe[0].sovracosto_euro === 0 && res4.impianti_stoccaggi[0].righe[0].sovracosto_euro === 0);
  verifica('senza niente da spiegare nelle note',
    res4.raccoglitori[0].righe[0].note === '' && res4.impianti_stoccaggi[0].righe[0].note === '');
}

// STOCCAGGIO E TRATTAMENTO SULLO STESSO CARICO: SI PAGANO TUTTI E DUE.
//
// Difetto alta dell'audit del 03/10/2026. Il blocco degli impianti sceglieva UNA
// prestazione guardando il tipo di destinazione: 'stoc' lo stoccaggio, 'imp' il
// trattamento. Se sull'intervento c'erano tutti e due i costi, se ne pagava uno
// e l'altro spariva senza nemmeno un'anomalia. Il modulo dell'extra raccolta,
// che li paga tutti e due (src/lib/extraRaccoltaCalc.js), diceva un altro
// numero: due moduli, due totali, e nessuno dei due che lo dicesse.
console.log('\nSTOCCAGGIO E TRATTAMENTO SULLO STESSO INTERVENTO');
{
  const dueCosti = (tipo) => calcolaPassivaMese({
    primarieRete: [], primarieAci: [], secondarieAll: [],
    extraRaccoltaAll: [intervento({
      id: 'DUE', id_ordine: 'EX-DUE', numero_fir: 'D1', peso_effettivo: 10000,
      trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', tipo_destinazione: tipo,
      costo_raccolta_t: 50, costo_stoccaggio_t: 16, costo_trattamento_t: 90,
    })],
    tariffeAll: [], fornitoriAll: fornitori,
  }, 2026, MESE, 'Settembre', 'EXTRA_RACCOLTA');

  const aStoccaggio = dueCosti('stoc');
  const beta = aStoccaggio.impianti_stoccaggi.find(f => f.fornitore === 'BETA IMPIANTI');
  verifica('la destinazione prende tutte e due le righe, stoccaggio e trattamento',
    beta.righe.length === 2
    && beta.righe.some(x => x.prestazione === 'CONFERIMENTO_STOCCAGGIO' && euro(x.importo) === euro(160))
    && beta.righe.some(x => x.prestazione === 'TRATTAMENTO' && euro(x.importo) === euro(900)),
    JSON.stringify(beta.righe.map(x => [x.prestazione, x.importo])));
  verifica('nessuno dei due costi sparisce: 500 di raccolta piu\' 160 piu\' 900',
    euro(aStoccaggio.totali.totale_complessivo) === euro(1560), String(aStoccaggio.totali.totale_complessivo));
  verifica('e si dice che quel trattamento e\' finito addosso a uno stoccaggio',
    aStoccaggio.anomalie.some(a => /anche un costo di trattamento/.test(a.descrizione) && a.fornitore === 'BETA IMPIANTI'),
    JSON.stringify(aStoccaggio.anomalie.map(a => a.descrizione)));

  // Lo stesso al contrario: destinazione impianto con anche il costo di stoccaggio.
  const aImpianto = dueCosti('imp');
  verifica('vale anche al contrario, e il totale e\' lo stesso',
    euro(aImpianto.totali.totale_complessivo) === euro(1560)
    && aImpianto.impianti_stoccaggi.find(f => f.fornitore === 'BETA IMPIANTI').righe.length === 2,
    String(aImpianto.totali.totale_complessivo));

  // IL SOVRACOSTO NON SI RADDOPPIA: e' un importo fisso dell'intervento, non
  // della prestazione, e le righe adesso sono due.
  const conSovracosto = calcolaPassivaMese({
    primarieRete: [], primarieAci: [], secondarieAll: [],
    extraRaccoltaAll: [intervento({
      id: 'DUE2', id_ordine: 'EX-DUE2', numero_fir: 'D2', peso_effettivo: 10000,
      trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', tipo_destinazione: 'stoc',
      costo_raccolta_t: 50, costo_stoccaggio_t: 16, costo_trattamento_t: 90,
      sovracosto_pagato_impianto: 120,
    })],
    tariffeAll: [], fornitoriAll: fornitori,
  }, 2026, MESE, 'Settembre', 'EXTRA_RACCOLTA');
  verifica('il sovracosto dell\'impianto si paga una volta sola, non su tutte e due le righe',
    euro(conSovracosto.totali.totale_complessivo) === euro(1680), String(conSovracosto.totali.totale_complessivo));

  // Un intervento con un costo solo resta una riga sola, come prima.
  const unoSolo = calcolaPassivaMese({
    primarieRete: [], primarieAci: [], secondarieAll: [],
    extraRaccoltaAll: [intervento({
      id: 'UNO', id_ordine: 'EX-UNO', numero_fir: 'U1', peso_effettivo: 10000,
      trasportatore: 'ALFA SRL', destinazione: 'BETA IMPIANTI', tipo_destinazione: 'imp',
      costo_raccolta_t: 50, costo_trattamento_t: 90,
    })],
    tariffeAll: [], fornitoriAll: fornitori,
  }, 2026, MESE, 'Settembre', 'EXTRA_RACCOLTA');
  verifica('con un costo solo la riga resta una, e il conto e\' quello di prima',
    unoSolo.impianti_stoccaggi.find(f => f.fornitore === 'BETA IMPIANTI').righe.length === 1
    && euro(unoSolo.totali.totale_complessivo) === euro(1400), String(unoSolo.totali.totale_complessivo));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
