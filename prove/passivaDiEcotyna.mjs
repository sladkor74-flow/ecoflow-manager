// Prova della PASSIVA DI ECOTYNA SENZA IL MESE, 10/10/2026.
//
// Trovato dall'audit di congruenza del 10/10/2026. Alla domanda «quanto abbiamo
// pagato a Green Tyre quest'anno» EcoTyna leggeva le voci dei documenti salvati
// della passiva; il modulo la calcola e non la salva, quelle voci sono zero, e la
// risposta era «nessun importo» mentre il modulo diceva migliaia di euro. Col mese
// indicato faceva gia' il conto vero: senza, no.
//
// Ora senza mese fa lo stesso conto del modulo, mese per mese. La prova guarda
// che il numero sia lo stesso dei mesi del modulo sommati, lo stesso costo del
// margine, e che i canali restino separati.
// npm run prove
const R = new URL('../base44/shared/', import.meta.url).href;
const { STRUMENTI } = await import(R + 'strumentiAssistente.ts');
const { calcolaPassivaMese, indiceMesePassiva } = await import(R + 'passivaCalcolo.ts');
const { calcolaMargineAnno } = await import(R + 'margine.ts');
const { oggiRoma } = await import(R + 'giornoItaliano.ts');
const { MESI } = await import(R + 'reportMensile.ts');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Le righe sono dell'anno di oggi, cosi' la prova vale anche l'anno prossimo.
const ANNO = Number(oggiRoma().slice(0, 4));
const MESE_OGGI = Number(oggiRoma().slice(5, 7)) - 1;
const g = (mese, giorno) => `${ANNO}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}T00:00:00Z`;
const base = { stato: 'terminato', cer: '160103', classe: 'A' };
const prim = (id, kg, mese, campi = {}) => ({
  ...base, id, id_ordine: 'ET' + id, numero_fir: 'F' + id, peso_effettivo: kg,
  ordine_immesso_il: g(mese, 1), trasporto_iniziato_il: g(mese, 2), trasporto_finito_il: g(mese, 3),
  trasportatore: 'GREEN TYRE SRL', destinazione: 'BETA IMPIANTI', provincia: 'PA', tipo_destinazione: 'imp', automezzo: 'AA111AA', ...campi,
});
const ARCHIVI = {
  PrimariaRete: [prim('1', 10000, 1), prim('2', 5000, 2), prim('3', 8000, 2, { trasportatore: 'ALFA SRL', provincia: 'BA' })],
  PrimariaAci: [prim('4', 2000, 2, { classe: 'C', regione: 'Sicilia', peso_stimato: 2000 })],
  Secondaria: [], ExtraRaccolta: [],
  Fornitore: [{ ragione_sociale: 'GREEN TYRE SRL', stato: 'attivo' }, { ragione_sociale: 'ALFA SRL', stato: 'attivo' }, { ragione_sociale: 'BETA IMPIANTI', stato: 'attivo' }],
  Tariffa: [
    { id: 'p1', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Green Tyre', tipologia: 'RETE', valore: 300, unita_misura: '€/t' },
    { id: 'p2', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Alfa s.r.l.', tipologia: 'RETE', valore: 60, unita_misura: '€/t' },
    { id: 'p3', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'TRATTAMENTO', fornitore_nome: 'Beta Impianti', tipologia: 'RETE', valore: 80, unita_misura: '€/t' },
    { id: 'p4', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Green Tyre', tipologia: 'ACI', valore: 90, unita_misura: '€/t' },
  ],
  // Le voci dei documenti: della passiva non ce n'e' nessuna, come in produzione.
  VoceFatturazione: [],
};
let letture = [];
const finto = {
  asServiceRole: {
    entities: new Proxy({}, {
      get: (t, entita) => ({
        filter: async (filtro = {}) => {
          letture.push(String(entita));
          return (ARCHIVI[entita] || []).filter(r => Object.entries(filtro).every(([c, v]) => r[c] === v));
        },
        list: async () => { letture.push(String(entita)); return ARCHIVI[String(entita)] || []; },
      }),
    }),
  },
  functions: { invoke: async () => { throw new Error('senza mese non si chiama la funzione del modulo'); } },
};
const fatturazione = STRUMENTI.find(s => s.nome === 'fatturazione');
const chiedi = async (p) => { letture = []; return (await fatturazione.esegui(finto, p)).dati; };

// Il conto del modulo, mese per mese, per confronto.
const archiviModulo = {
  primarieRete: ARCHIVI.PrimariaRete, primarieAci: ARCHIVI.PrimariaAci, secondarieAll: [], extraRaccoltaAll: [],
  tariffeAll: ARCHIVI.Tariffa, fornitoriAll: ARCHIVI.Fornitore,
};
const delModulo = (canale) => MESI.slice(0, MESE_OGGI + 1)
  .reduce((s, m) => s + calcolaPassivaMese(archiviModulo, ANNO, indiceMesePassiva(m), m, canale).totali.totale_complessivo, 0);

console.log("SENZA IL MESE, EcoTyna FA IL CONTO DEL MODULO");
{
  const d = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE' });
  const rete = d.canali && d.canali[0];
  verifica('un canale solo, la rete', d.canali && d.canali.length === 1 && rete.canale === 'RETE', JSON.stringify(d.canali && d.canali.map(c => c.canale)));
  // Green Tyre 15 t a 300 = 4.500; Alfa 8 t a 60 = 480; Beta 23 t a 80 = 1.840.
  verifica("il totale dell'anno: 4.500 + 480 + 1.840 = 6.820 euro", rete && rete.euro === 6820, rete && String(rete.euro));
  verifica('lo stesso numero dei mesi del modulo sommati', rete && Math.abs(rete.euro - delModulo('RETE')) < 0.005, `${rete && rete.euro} / ${delModulo('RETE')}`);
  verifica('le tonnellate raccolte: 23', rete && rete.tonnellate_raccolte === 23, rete && String(rete.tonnellate_raccolte));
  verifica("tutti i mesi fino a quello in corso, anche quelli a zero", rete && rete.mesi.length === MESE_OGGI + 1 && rete.mesi[0].euro === 3000 + 800 && rete.mesi[1].euro === 1500 + 480 + 1040 && rete.mesi[2].euro === 0, rete && JSON.stringify(rete.mesi.slice(0, 3)));
  const green = rete && rete.fornitori.righe.find(f => f.fornitore === 'GREEN TYRE SRL');
  verifica('Green Tyre: 15 t, 4.500 euro, in due mesi', green && green.tonnellate === 15 && green.euro === 4500 && green.mesi === 2, JSON.stringify(green));
  verifica('le voci salvate non si leggono piu\', e la funzione del modulo non si chiama', !letture.includes('VoceFatturazione'), letture.join());
  verifica('gli archivi si leggono una volta sola, non una per mese', letture.filter(x => x === 'PrimariaRete').length === 1, letture.join());

  // Il costo del margine e' lo stesso conto: i due numeri devono coincidere.
  const margine = calcolaMargineAnno({
    reteAll: ARCHIVI.PrimariaRete, aciAll: ARCHIVI.PrimariaAci, extraAll: [], secondarieAll: [],
    fornitori: ARCHIVI.Fornitore, tariffe: ARCHIVI.Tariffa,
  }, ANNO, MESE_OGGI);
  const costoRete = margine.canali.find(c => c.canale === 'RETE').anno.costo;
  verifica('e lo stesso costo della rete nel margine', rete && Math.abs(rete.euro - costoRete) < 0.005, `${rete && rete.euro} / ${costoRete}`);
}

console.log('UN FORNITORE SOLO');
{
  const d = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', fornitore: 'Green Tyre' });
  const rete = d.canali[0];
  verifica('solo i suoi euro: 4.500', rete.euro === 4500, String(rete.euro));
  verifica('solo lui fra i fornitori', rete.fornitori.quanti === 1 && rete.fornitori.righe[0].fornitore === 'GREEN TYRE SRL', JSON.stringify(rete.fornitori));
  verifica('e solo i suoi mesi: gennaio 3.000, febbraio 1.500', rete.mesi.length === 2 && rete.mesi[0].euro === 3000 && rete.mesi[1].euro === 1500, JSON.stringify(rete.mesi));
  // Visto in produzione il 10/10/2026: col canale chiesto, la nota generica
  // («rete, ACI ed extra raccolta non si sommano») faceva scrivere a EcoTyna che
  // il conto «non distingue i canali». La nota dice qual e' il canale.
  verifica("la nota dice che e' solo la rete", d.nota.includes('SOLO il canale RETE'), d.nota.slice(-160));
}

console.log('SENZA IL CANALE: TRE CONTI, NESSUN TOTALE');
{
  const d = await chiedi({ anno: ANNO, tipo: 'PASSIVA', fornitore: 'Green Tyre' });
  verifica('rete, ACI ed extra raccolta, ciascuno col suo', d.canali.map(c => c.canale).join() === 'RETE,ACI,EXTRA_RACCOLTA');
  const aci = d.canali.find(c => c.canale === 'ACI');
  verifica("l'ACI di Green Tyre: 2 t a 90 = 180 euro, separati dalla rete", aci.euro === 180, String(aci.euro));
  verifica('nessun totale che somma i canali', !('euro' in d) && !('totale' in d) && !('totale_euro' in d));
  verifica('e la nota dice che sono tre conti', d.nota.includes('tre conti'), d.nota.slice(-160));
}

console.log("PIU' MESI INSIEME");
{
  const due = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', mesi: ['Febbraio', 'Marzo'] });
  verifica('febbraio e marzo: 1.500 + 480 + 1.040 = 3.020 euro, solo quei due mesi', due.canali[0].euro === 3020 && due.canali[0].mesi.map(m => m.mese).join() === 'Febbraio,Marzo', JSON.stringify(due.canali[0].mesi));
  const intervallo = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', fornitore: 'Green Tyre', mese: 'da gennaio a febbraio' });
  verifica('un intervallo scritto nel mese si apre: gennaio e febbraio di Green Tyre, 4.500 euro', intervallo.canali[0].euro === 4500, JSON.stringify(intervallo.canali[0].mesi));
}

console.log("IL PIANIFICATORE: «DA GENNAIO A OGGI» E' L'ANNO FINO A OGGI");
{
  // Visto in produzione il 10/10/2026: il pianificatore metteva il mese in corso
  // e la risposta diceva un mese solo, «il cumulativo non e' disponibile».
  const { strumentiDalPiano } = await import(R + 'pianoAssistente.ts');
  const piano = (mese) => ({ strumenti: [{ nome: 'fatturazione', parametri: { tipo: 'PASSIVA', fornitore: 'Green Tyre', tipologia: 'RETE', mese } }], periodo: { anno: 2026, mese } });
  const [a] = strumentiDalPiano(piano('Ottobre'), STRUMENTI, '2026-10-10', 'Quanto abbiamo da pagare a Green Tyre per la rete nel 2026, da gennaio a oggi?');
  verifica("da gennaio a oggi: nessun mese, quindi tutto l'anno", a && !a.parametri.mese && !a.parametri.mesi, JSON.stringify(a && a.parametri));
  const [b] = strumentiDalPiano(piano('Ottobre'), STRUMENTI, '2026-10-10', 'Quanto dobbiamo a Green Tyre per ottobre?');
  verifica('ottobre resta ottobre', b && b.parametri.mese === 'Ottobre', JSON.stringify(b && b.parametri));
  const [c] = strumentiDalPiano({ ...piano(''), strumenti: [{ nome: 'fatturazione', parametri: { tipo: 'PASSIVA', tipologia: 'RETE', mesi: ['Gennaio', 'Febbraio', 'Marzo'] } }] }, STRUMENTI, '2026-10-10', 'La passiva della rete da gennaio a marzo');
  verifica('da gennaio a marzo restano tre mesi, e lo strumento li riceve', c && Array.isArray(c.parametri.mesi) && c.parametri.mesi.length === 3, JSON.stringify(c && c.parametri));
  // Visto in produzione il 10/10/2026, dopo il Publish: il pianificatore scriveva
  // il canale come «canale», la fatturazione lo chiama «tipologia». Il canale
  // arrivava giusto, ma restava fra gli ignorati e la risposta diceva «non e'
  // filtrato per canale» su un numero della sola rete.
  const conCanale = { strumenti: [{ nome: 'fatturazione', parametri: { tipo: 'PASSIVA', fornitore: 'Green Tyre', canale: 'RETE' } }], canali: ['RETE'], periodo: { anno: 2026 } };
  const [d] = strumentiDalPiano(conCanale, STRUMENTI, '2026-10-10', 'Quanto dobbiamo a Green Tyre per la rete quest\'anno?');
  verifica('il canale scritto «canale» arriva come tipologia', d && d.parametri.tipologia === 'RETE' && !('canale' in d.parametri), JSON.stringify(d && d.parametri));
  verifica('e non finisce fra gli ignorati', d && (d.ignorati || []).length === 0, JSON.stringify(d && d.ignorati));
  const conAci = { strumenti: [{ nome: 'fatturazione', parametri: { tipo: 'PASSIVA', canale: 'aci' } }], canali: [], periodo: { anno: 2026 } };
  const [e] = strumentiDalPiano(conAci, STRUMENTI, '2026-10-10', "La passiva dell'ACI quest'anno");
  verifica("scritto minuscolo vale lo stesso: l'ACI", e && e.parametri.tipologia === 'ACI' && (e.ignorati || []).length === 0, JSON.stringify(e));
}

console.log('LE DOMANDE STORTE');
{
  const d = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', mese: 'Marzolino' });
  verifica('un mese che non esiste: si dice, e si prende l\'anno', d.avviso_periodo && d.avviso_periodo.includes('Marzolino') && d.canali[0].euro === 6820, d.avviso_periodo);
  const futuro = await chiedi({ anno: ANNO + 1, tipo: 'PASSIVA', tipologia: 'RETE' });
  verifica("l'anno che non e' cominciato: nessun mese e l'avviso", futuro.canali[0].mesi.length === 0 && futuro.avviso_periodo, JSON.stringify(futuro.avviso_periodo));
  const strano = await chiedi({ anno: ANNO, tipo: 'BOLLETTE' });
  verifica('un tipo che non esiste non diventa «nessun importo»', strano.avviso && strano.avviso.includes('PASSIVA') && !strano.canali, JSON.stringify(strano));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
