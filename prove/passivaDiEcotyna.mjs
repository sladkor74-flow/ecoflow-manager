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

// ===== Dalla revisione del 10/10/2026 =====
// Da qui gli archivi si allargano: i conti di sopra sono gia' stati fatti.
ARCHIVI.PrimariaRete.push(
  prim('10', 2000, 1, { trasportatore: 'ECO.GEA SRL', provincia: 'NA' }),
  prim('11', 1000, 1, { trasportatore: 'SILVANO RENATO', provincia: 'NA' }),
  prim('12', 1000, 1, { trasportatore: 'SILVANO TRASPORTI SRL', provincia: 'NA' }),
  prim('13', 3000, 2, { trasportatore: 'TORRES GIOVANNI', provincia: 'PA' }),
  prim('14', 1500, 1, { trasporto_finito_il: null }),
  prim('15', 1000, 1, { trasportatore: 'GAMMA NOPREZZO SRL', provincia: 'NA' }),
  prim('16', 1000, 2, { trasportatore: 'GAMMA NOPREZZO SRL', provincia: 'NA' }),
  prim('17', 500, 1, { trasportatore: 'GAMMA NOPREZZO SRL', provincia: 'NA', classe: 'C' }), // stesso mese, altra classe: un altro peso
);
ARCHIVI.Fornitore.push(
  { ragione_sociale: 'ECO.GEA SRL', stato: 'attivo' },
  { ragione_sociale: 'SILVANO RENATO', stato: 'attivo' },
  { ragione_sociale: 'SILVANO TRASPORTI SRL', stato: 'attivo' },
  { ragione_sociale: 'TORRES GIOVANNI', stato: 'attivo', fattura_tramite_nome: 'GREEN TYRE SRL' },
  { ragione_sociale: 'GAMMA NOPREZZO SRL', stato: 'attivo' },
);
ARCHIVI.Tariffa.push(
  { id: 'p5', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Eco.Gea Srl', tipologia: 'RETE', valore: 50, unita_misura: '€/t' },
  { id: 'p6', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Silvano Renato', tipologia: 'RETE', valore: 40, unita_misura: '€/t' },
  { id: 'p7', direzione: 'PASSIVA', stato: 'attivo', prestazione: 'RACCOLTA', fornitore_nome: 'Silvano Trasporti', tipologia: 'RETE', valore: 45, unita_misura: '€/t' },
);

console.log('IL FORNITORE SI RICONOSCE COME NEI MOVIMENTI');
{
  const eco = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', fornitore: 'eco gea' });
  verifica('«eco gea» trova ECO.GEA SRL: 2 t a 50 = 100 euro, non 0', eco.canali && eco.canali[0].euro === 100 && eco.fornitore_riconosciuto === 'ECO.GEA SRL', JSON.stringify(eco).slice(0, 300));
  const sil = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', fornitore: 'Silvano' });
  verifica('«Silvano» sono due soggetti: nessun numero, e lo dice', sil.canali && sil.canali[0].euro === null && /SILVANO RENATO/.test(sil.avviso_fornitore || '') && /SILVANO TRASPORTI/.test(sil.avviso_fornitore || '') && sil.numero_non_calcolabile, JSON.stringify(sil).slice(0, 400));
  const nessuno = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', fornitore: 'Pinco Pallino' });
  verifica('un nome che non c\'e\': nessun numero, non 0 euro', nessuno.canali[0].euro === null && /non risulta/.test(nessuno.avviso_fornitore || ''), JSON.stringify(nessuno).slice(0, 300));
  const torres = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', fornitore: 'Torres' });
  const rt = torres.canali && torres.canali[0];
  verifica('un subfornitore: la riga di chi lo fattura, e si dice che si paga a lui', rt && /GREEN TYRE SRL/.test(rt.avviso_fornitore || '') && rt.fornitori.righe.some(f => f.fornitore === 'GREEN TYRE SRL'), JSON.stringify(rt).slice(0, 400));
  // Il mese singolo, stesso riconoscimento.
  const finto2 = { ...finto, functions: { invoke: async (_n, corpo) => ({ data: calcolaPassivaMese(archiviModulo, ANNO, indiceMesePassiva(corpo.mese), corpo.mese, corpo.tipologia) }) } };
  const mese = (await fatturazione.esegui(finto2, { anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', mese: 'Gennaio', fornitore: 'Silvano' })).dati;
  verifica('anche col mese: «Silvano» non da\' un numero', mese.totale_del_fornitore_euro === null && /SILVANO RENATO/.test(mese.avviso_fornitore || ''), JSON.stringify(mese).slice(0, 300));
  const meseEco = (await fatturazione.esegui(finto2, { anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE', mese: 'Gennaio', fornitore: 'eco gea' })).dati;
  verifica('anche col mese: «eco gea» trova i suoi 100 euro', meseEco.totale_del_fornitore_euro === 100, JSON.stringify(meseEco).slice(0, 300));
}

console.log("LE ANOMALIE DELL'ANNO, UNA VOLTA");
{
  const d = await chiedi({ anno: ANNO, tipo: 'PASSIVA', tipologia: 'RETE' });
  const an = d.canali[0].anomalie.righe;
  const senzaFine = an.filter(a => a.tipo === 'date_senza_fine');
  verifica('il terminato senza fine trasporto si dice una volta, non una per mese', senzaFine.length === 1 && senzaFine[0].quanti === 1, JSON.stringify(senzaFine.map(a => [a.quanti, a.dal_mese])));
  verifica('e dice che resta fuori dalla passiva, non dal margine', senzaFine[0] && /dalla passiva/.test(senzaFine[0].descrizione), senzaFine[0] && senzaFine[0].descrizione.slice(0, 160));
  const gamma = an.filter(a => a.fornitore === 'GAMMA NOPREZZO SRL');
  const classe = (c) => gamma.find(a => a.classe === c);
  verifica('il fornitore senza tariffa: le tonnellate di tutti i mesi, non solo del primo (classe A: gennaio + febbraio = 2 t)', classe('A') && classe('A').tonnellate === 2 && classe('A').mesi.join() === 'Gennaio,Febbraio', JSON.stringify(gamma.map(a => [a.classe, a.tonnellate, a.mesi])));
  verifica("e una classe diversa nello stesso mese e' un'altra anomalia, col suo peso (classe C: 0,5 t)", gamma.length === 2 && classe('C') && classe('C').tonnellate === 0.5, JSON.stringify(gamma.map(a => [a.classe, a.tonnellate, a.mesi])));
}

console.log("IL CONFRONTO CON L'ANNO SCORSO TIENE I SUOI MESI");
{
  const { strumentiDalPiano } = await import(R + 'pianoAssistente.ts');
  const MESI10 = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre'];
  const piano = { strumenti: [
    { nome: 'raccolto', parametri: { canale: 'RETE', anno: 2026, mesi: MESI10 } },
    { nome: 'raccolto', parametri: { canale: 'RETE', anno: 2025, mesi: MESI10 } },
  ], canali: ['RETE'], periodo: { anno: 2026 } };
  const s = strumentiDalPiano(piano, STRUMENTI, '2026-10-10', 'Quanto abbiamo raccolto da gennaio a oggi rispetto allo stesso periodo del 2025?');
  const quest = s.find(x => x.parametri.anno === 2026), scorso = s.find(x => x.parametri.anno === 2025);
  verifica("il 2026 «da gennaio a oggi»: l'anno fino a oggi, senza mesi", quest && !quest.parametri.mesi && !quest.parametri.mese, JSON.stringify(quest));
  verifica('il 2025 tiene gennaio-ottobre: lo stesso periodo, non l\'anno intero', scorso && Array.isArray(scorso.parametri.mesi) && scorso.parametri.mesi.length === 10, JSON.stringify(scorso));
}

console.log('LE GIACENZE: TECNOGUM NON E\' UN IMPIANTO SENZA FILE');
{
  const giacenze = STRUMENTI.find(x => x.nome === 'giacenze');
  const righe = [
    { sito: 'TECNOGUM SRL', tipo_destinazione: 'imp', giacenza_rete_t: null, rete_non_dovuta: true, giacenza_aci_t: 0, fotografia: { del: '2026-10-03', foto_t: 0 } },
    { sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', giacenza_rete_t: 120.5, giacenza_aci_t: 3, fotografia: { del: '2026-10-03', foto_t: 120.5 } },
    { sito: 'SENZA FILE SRL', tipo_destinazione: 'imp', giacenza_rete_t: 0, fotografia: { del: '' } },
  ];
  const fintoG = { asServiceRole: finto.asServiceRole, functions: { invoke: async () => ({ data: { righe, anomalie: [] } }) } };
  const d = (await giacenze.esegui(fintoG, { anno: ANNO })).dati;
  const rete = d.totali && d.totali.rete;
  verifica('fra gli impianti senza file solo quello che il file non ce l\'ha', rete && JSON.stringify(rete.impianti_senza_file_del_portale_esclusi) === JSON.stringify(['SENZA FILE SRL']), JSON.stringify(rete));
  verifica('Tecnogum detto a parte, per accordo', rete && JSON.stringify(rete.impianti_che_per_accordo_non_dichiarano_la_rete) === JSON.stringify(['TECNOGUM SRL']), JSON.stringify(rete));
  const tec = d.siti.righe.find(r => r.sito === 'TECNOGUM SRL');
  verifica('e la sua riga dice il perche\'', tec && tec.rete_non_dovuta === true && /accordo/.test(JSON.stringify(tec.calcolo)) && !('file_del_portale_del' in tec.calcolo), JSON.stringify(tec).slice(0, 300));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
