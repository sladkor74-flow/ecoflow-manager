// IL MODELLO DELLE VOCI DELLA PASSIVA, CONTRO IL FOGLIO VERO DI SETTEMBRE 2026.
//
// Questa prova esiste per un motivo preciso: il 03/10/2026 il «format
// amministrazione» della passiva usciva tutto a zero, e le prove passavano
// comunque, perche' le avevo scritte sulla forma dei dati che immaginavo invece
// che su quella vera. Qui i numeri sono quelli del foglio dell'amministrazione
// (passiva\Fatturazione passiva Ecotyre (settembre).xlsx), riga per riga, e le
// tonnellate sono quelle che il gestionale calcola per settembre 2026.
//
// Se uno di questi quattro totali non torna, o il modello ha un prezzo sbagliato
// o l'assegnazione dei chili alle voci ha smesso di funzionare:
//   rete  raccoglitori 1.120,24 t -> 65.351,38 euro
//         impianti     1.293,34 t -> 87.888,39 euro
//         trasporto      173,10 t ->  3.572,96 euro   (totale canale 156.812,73)
//   ACI   raccoglitori    18,89 t ->  1.509,38 euro
//         impianti        33,35 t ->  2.873,89 euro
//         trasporto        1,64 t ->     49,20 euro   (totale canale   4.432,47)
// npm run prove
import { caricaLibPagine } from './dati/libPagine.mjs';

const { foglioPassiva } = await caricaLibPagine('lib/passivaAmministrazione');
const { modelloAmministrazione, quanteVociModello } = await caricaLibPagine('lib/modelloPassivaAmministrazione');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const voci = modelloAmministrazione(2026);

// Le righe come le restituisce calcolaPassiva: raggruppate per fornitore, coi
// numeri dentro righe[]. Le tonnellate sono quelle vere di settembre 2026.
const g = (fornitore, righe) => ({ fornitore, interno: false, righe, totale_tonnellate: righe.reduce((s, r) => s + r.tonnellate, 0), totale_euro: 0 });
const racc = (o) => ({ provincia: '—', destinazione: '—', classe: '—', regione: '—', viaggi: 1, tariffa_valore: 0, unita_misura: '€/t', importo: 0, ...o });
const imp = (o) => ({ prestazione: 'TRATTAMENTO', classe: '—', provenienza: 'primaria', viaggi: 1, tariffa_valore: 0, unita_misura: '€/t', importo: 0, ...o });

// LE TARIFFE STANNO SULLE RIGHE, come le scrive il calcolo della passiva: il
// prezzo del foglio e' quello che il mese ha applicato davvero, non un numero
// ricopiato («gli altri prezzi li dovresti gia' avere nel tariffario 2026 anche
// perche' hai letto tutti i loro contratti», utente 03/10/2026).
const RETE = {
  raccoglitori: [
    g('GREEN TYRE PROJECT SRL', [racc({ tonnellate: 255.78, classe: 'P, M', regione: 'Sicilia', tariffa_valore: 90 })]),
    // SMOCO raccoglie con i propri mezzi: tre regioni, nessun euro. Le sue righe
    // non hanno tariffa, perche' a se stessi non si fattura.
    g('SMOCO S.R.L.', [
      racc({ tonnellate: 22.54, regione: 'Basilicata' }),
      racc({ tonnellate: 37.88, regione: 'Calabria' }),
      racc({ tonnellate: 193.26, regione: 'Puglia' }),
    ]),
    g('Nappi Sud Srl A Socio Unico', [racc({ tonnellate: 187.6, regione: 'Campania', tariffa_valore: 58 })]),
    // Logistica & Pneumatici si paga per provincia: Napoli 68, Caserta 72. Qui la
    // regione NON e' scritta, come capita negli archivi: si ricava dalla sigla.
    g('LOGISTICA & PNEUMATICI SRL', [
      racc({ tonnellate: 89.18, provincia: 'NA', tariffa_valore: 68 }),
      racc({ tonnellate: 35.62, provincia: 'CE', tariffa_valore: 72 }),
    ]),
    g('Ecorecuperi Srl', [racc({ tonnellate: 101.63, regione: 'Campania', tariffa_valore: 72 })]),
    g('GATIM S.R.L.', [racc({ tonnellate: 63.02, regione: 'Calabria', tariffa_valore: 70 })]),
    // Emmesse conferisce su Gatim: 72. Se conferisse su Irigom sarebbe 90.
    g('EMMESSE SRLS', [racc({ tonnellate: 59.15, regione: 'Calabria', destinazione: 'GATIM S.R.L.', tariffa_valore: 72 })]),
    g('PNEUSERVICE CONVERSANO SRL', [racc({ tonnellate: 49.96, regione: 'Puglia', tariffa_valore: 100 })]),
    g('ECOLOGICAL SYSTEMS SRL', [racc({ tonnellate: 22.48, regione: 'Basilicata', tariffa_valore: 75 })]),
    g('C.L. SERVICE S.R.L.', [racc({ tonnellate: 2.14, regione: 'Campania', tariffa_valore: 71 })]),
  ],
  impianti_stoccaggi: [
    g('Irigom S.r.l.', [
      imp({ tonnellate: 300.84, classe: 'P, M', provenienza: 'primaria', tariffa_valore: 90 }),
      imp({ tonnellate: 2.8, classe: 'G1', provenienza: 'primaria', tariffa_valore: 120 }),
      imp({ tonnellate: 71.5, classe: 'P', provenienza: 'secondaria', tariffa_valore: 90 }),
    ]),
    g('GREEN TYRE PROJECT SRL', [imp({ tonnellate: 255.78, classe: 'P, M', tariffa_valore: 105 })]),
    g('TECNOGUM SRL', [
      imp({ tonnellate: 101.6, provenienza: 'secondaria' }),
      imp({ tonnellate: 101.63, provenienza: 'primaria' }),
    ]),
    g('NAPPI SUD SRL', [imp({ tonnellate: 189.74, prestazione: 'CONFERIMENTO_STOCCAGGIO', tariffa_valore: 16 })]),
    g('T-CYCLE INDUSTRIES SRL', [imp({ tonnellate: 124.8, classe: 'P, M', tariffa_valore: 70 })]),
    g('Gatim', [imp({ tonnellate: 122.17, classe: 'P, M', tariffa_valore: 105 })]),
    g('T.R.S. SRL', [imp({ tonnellate: 22.48, provenienza: 'secondaria', tariffa_valore: 115 })]),
  ],
  trasporti_secondaria: [
    g('Logistica Srl A Socio Unico', [
      { stoccaggio: 'NAPPI SUD SRL', destinazione: 'TECNOGUM SRL', tonnellate: 101.6, viaggi: 7, tariffa_valore: 30, unita_misura: '€/t', importo: 3048 },
      { stoccaggio: 'NAPPI SUD SRL', destinazione: 'Irigom S.r.l.', tonnellate: 15.44, viaggi: 1, tariffa_valore: 34, unita_misura: '€/t', importo: 524.96 },
    ]),
    // Il trasporto fatto da SMOCO non si fattura a se stessi: pesa, non costa.
    g('SMOCO S.R.L.', [
      { stoccaggio: 'NAPPI SUD SRL', destinazione: 'Irigom S.r.l.', tonnellate: 56.06, viaggi: 4, tariffa_valore: 0, unita_misura: '€/t', importo: 0 },
    ]),
  ],
};

const ACI = {
  raccoglitori: [
    g('EMMESSE SRLS', [racc({ tonnellate: 12.35, regione: 'Calabria', tariffa_valore: 110 })]),
    g('SMOCO S.R.L.', [racc({ tonnellate: 4.9, regione: 'Puglia' })]),
    g('Nappi Sud Srl A Socio Unico', [racc({ tonnellate: 1.64, regione: 'Campania', tariffa_valore: 92 })]),
  ],
  impianti_stoccaggi: [
    g('Gatim', [
      imp({ tonnellate: 12.35, provenienza: 'primaria', tariffa_valore: 105 }),
      imp({ tonnellate: 12.82, provenienza: 'secondaria', tariffa_valore: 105 }),
    ]),
    g('Irigom S.r.l.', [imp({ tonnellate: 4.9, prestazione: 'CONFERIMENTO_STOCCAGGIO', tariffa_valore: 10 })]),
    g('TECNOGUM SRL', [imp({ tonnellate: 1.64, provenienza: 'secondaria', tariffa_valore: 95 })]),
    g('NAPPI SUD SRL', [imp({ tonnellate: 1.64, prestazione: 'CONFERIMENTO_STOCCAGGIO', tariffa_valore: 16 })]),
  ],
  trasporti_secondaria: [
    g('Logistica Srl A Socio Unico', [
      { stoccaggio: 'NAPPI SUD SRL', destinazione: 'TECNOGUM SRL', tonnellate: 1.64, viaggi: 1, tariffa_valore: 30, unita_misura: '€/t', importo: 49.2 },
    ]),
    g('SMOCO S.R.L.', [
      { stoccaggio: 'Irigom S.r.l.', destinazione: 'Gatim', tonnellate: 12.82, viaggi: 1, tariffa_valore: 0, unita_misura: '€/t', importo: 0 },
    ]),
  ],
};

const rete = foglioPassiva(voci, RETE, 'RETE', 'Settembre', 2026);
const aci = foglioPassiva(voci, ACI, 'ACI', 'Settembre', 2026);

console.log('IL MODELLO C E TUTTO');
verifica('il modello porta le voci dei quattro blocchi', quanteVociModello() === voci.length && voci.length > 40, String(voci.length));
verifica('nessuna voce senza soggetto', voci.every(v => v.soggetto), '');
// Tutte a tonnellata tranne ECO.GEA, che e' una tantum e si paga a viaggio:
// nel 2026 un ritiro solo, a giugno (utente, 03/10/2026).
verifica('i prezzi sono a tonnellata, tranne ECO.GEA che e a viaggio',
  voci.filter(v => v.unita_misura !== 'euro_tonnellata').map(v => v.soggetto).join() === 'ECO.GEA SRL',
  voci.filter(v => v.unita_misura !== 'euro_tonnellata').map(v => `${v.soggetto}/${v.unita_misura}`).join());
verifica('le due colonne di prezzo esistono solo negli impianti ACI',
  voci.filter(v => v.colonna_prezzo).every(v => v.canale === 'ACI' && v.blocco === 'impianti'));

console.log('RETE: I DUE TOTALI DEL FOGLIO DELL AMMINISTRAZIONE, AL CENTESIMO');
verifica('raccoglitori 1.120,24 t', rete.raccoglitori.totale_t === 1120.24, String(rete.raccoglitori.totale_t));
verifica('raccoglitori 65.351,38 euro', rete.raccoglitori.totale_euro === 65351.38, String(rete.raccoglitori.totale_euro));
verifica('impianti 1.293,34 t', rete.impianti.totale_t === 1293.34, String(rete.impianti.totale_t));
verifica('impianti 87.888,39 euro', rete.impianti.totale_euro === 87888.39, String(rete.impianti.totale_euro));
verifica('trasporto 173,10 t', rete.trasporti.totale_t === 173.1, String(rete.trasporti.totale_t));
verifica('trasporto 3.572,96 euro', rete.trasporti.totale_euro === 3572.96, String(rete.trasporti.totale_euro));
verifica('il totale del canale e 156.812,73 euro', rete.totale_euro === 156812.73, String(rete.totale_euro));

console.log('ACI: GLI ALTRI DUE TOTALI');
verifica('raccoglitori 18,89 t', aci.raccoglitori.totale_t === 18.89, String(aci.raccoglitori.totale_t));
verifica('raccoglitori 1.509,38 euro', aci.raccoglitori.totale_euro === 1509.38, String(aci.raccoglitori.totale_euro));
verifica('impianti 33,35 t', aci.impianti.totale_t === 33.35, String(aci.impianti.totale_t));
verifica('impianti 2.873,89 euro', aci.impianti.totale_euro === 2873.89, String(aci.impianti.totale_euro));
verifica('trasporto 49,20 euro', aci.trasporti.totale_euro === 49.2, String(aci.trasporti.totale_euro));
verifica('il totale del canale e 4.432,47 euro', aci.totale_euro === 4432.47, String(aci.totale_euro));

console.log('NIENTE RESTA FUORI E NIENTE SI CONTA DUE VOLTE');
{
  // Il controllo che conta: la somma delle voci di un fornitore deve fare
  // esattamente le sue tonnellate del mese. Se una voce senza criterio riprende
  // i chili che un'altra ha gia' preso, qui si vede subito.
  for (const foglio of [rete, aci]) {
    for (const blocco of [foglio.raccoglitori, foglio.impianti]) {
      verifica(`nessun fornitore senza voce nel modello (${foglio.canale})`, blocco.non_previsti.length === 0,
        JSON.stringify(blocco.non_previsti));
      verifica(`nessun chilo senza voce (${foglio.canale})`, !blocco.righe.some(r => r.tipo === 'senza_voce'),
        JSON.stringify(blocco.righe.filter(r => r.tipo === 'senza_voce')));
      for (const s of blocco.righe.filter(r => r.tipo === 'soggetto')) {
        const sue = blocco.righe.filter(r => r.tipo === 'voce' && r.soggetto === s.soggetto);
        const somma = Math.round(sue.reduce((x, r) => x + r.tonnellate, 0) * 1000) / 1000;
        verifica(`${s.soggetto}: le voci sommano il suo totale`, somma === s.tonnellate, `${somma} contro ${s.tonnellate}`);
      }
    }
  }
}
{
  // Le voci a zero restano nel foglio: e' la ragione per cui il modello e' fisso.
  const zero = rete.raccoglitori.righe.filter(r => r.tipo === 'voce' && r.tonnellate === 0);
  verifica('le voci a zero si scrivono comunque', zero.length >= 4, String(zero.length));
  verifica('fra queste ci sono Salerno e Avellino, che a settembre non hanno portato niente',
    zero.some(r => /SALERNO/i.test(r.voce)) && zero.some(r => /AVELLINO/i.test(r.voce)));
}

console.log('LE DUE FORME DEL FOGLIO');
verifica('la rete sta a due livelli', rete.stile === 'due_livelli');
verifica('l ACI e piatta', aci.stile === 'piatto');
verifica('gli impianti ACI hanno due colonne di prezzo', aci.impianti.due_prezzi === true);
verifica('gli impianti della rete ne hanno una', rete.impianti.due_prezzi === false);
verifica('lo stoccaggio Irigom sta nella colonna dello stoccaggio',
  aci.impianti.righe.some(r => r.tipo === 'voce' && /irigom/i.test(r.soggetto) && r.colonna_prezzo === 'stoccaggio' && r.totale === 49));
verifica('il trattamento Gatim sta nella colonna del trattamento',
  aci.impianti.righe.filter(r => r.tipo === 'voce' && /gatim/i.test(r.soggetto)).every(r => r.colonna_prezzo === 'trattamento'));

console.log('I PREZZI CHE CAMBIANO CON QUALCOSA');
{
  const voce = (blocco, cerca) => blocco.righe.find(r => r.tipo === 'voce' && cerca.test(r.voce));
  verifica('Napoli 68 e Caserta 72', voce(rete.raccoglitori, /NAPOLI/).prezzo === 68 && voce(rete.raccoglitori, /CASERTA/).prezzo === 72);
  verifica('Napoli prende 89,18 t e Caserta 35,62 t, dalla sola sigla della provincia',
    voce(rete.raccoglitori, /NAPOLI/).tonnellate === 89.18 && voce(rete.raccoglitori, /CASERTA/).tonnellate === 35.62);
  verifica('Emmesse su Gatim 72, su Irigom 90',
    voce(rete.raccoglitori, /su Gatim/).prezzo === 72 && voce(rete.raccoglitori, /su Irigom/).prezzo === 90);
  verifica('e i suoi 59,15 t stanno sulla riga di Gatim',
    voce(rete.raccoglitori, /su Gatim/).tonnellate === 59.15 && voce(rete.raccoglitori, /su Irigom/).tonnellate === 0);
  verifica('Irigom: le classi G1 a 120 e le P+M a 90',
    voce(rete.impianti, /^classi G1$/).prezzo === 120 && voce(rete.impianti, /^classi P\+M$/).prezzo === 90);
  verifica('e la secondaria classe P tiene i suoi 71,5 t separati dalla primaria',
    voce(rete.impianti, /da secondaria classe P$/).tonnellate === 71.5 && voce(rete.impianti, /^classi P\+M$/).tonnellate === 300.84);
  verifica('Tecnogum sulla rete non si paga', voce(rete.impianti, /da primaria rete/).totale === 0 && voce(rete.impianti, /da secondaria rete/).totale === 0);
  verifica('ma le sue tonnellate si vedono', voce(rete.impianti, /da primaria rete/).tonnellate === 101.63);
}

console.log('IL PREZZO VIENE DAL TARIFFARIO, NON DAL FOGLIO');
{
  // 1. Con i movimenti vince la tariffa che il mese ha applicato: il foglio dice
  // lo stesso numero del modulo della fatturazione passiva a video.
  const voce = rete.raccoglitori.righe.find(r => r.tipo === 'voce' && /NAPOLI/.test(r.voce));
  verifica('sulle righe con movimenti il prezzo e quello applicato', voce.fonte_prezzo === 'movimenti', voce.fonte_prezzo);
  // 2. Una tariffa diversa da quella scritta sulla voce: vince il tariffario.
  const conAltraTariffa = {
    raccoglitori: [g('GATIM S.R.L.', [racc({ tonnellate: 10, regione: 'Calabria', tariffa_valore: 74 })])],
    impianti_stoccaggi: [], trasporti_secondaria: [],
  };
  const f = foglioPassiva(voci, conAltraTariffa, 'RETE', 'Settembre', 2026);
  const g1 = f.raccoglitori.righe.find(r => r.tipo === 'voce' && r.soggetto === 'GATIM S.R.L.');
  verifica('se il tariffario e cambiato, il foglio segue il tariffario', g1.prezzo === 74 && g1.totale === 740,
    JSON.stringify([g1.prezzo, g1.totale, g1.fonte_prezzo]));
  // 3. Le righe a zero leggono il tariffario del mese.
  const TARIFFE = [
    { fornitore_nome: 'LOGISTICA & PNEUMATICI SRL', prestazione: 'RACCOLTA', tipologia: 'RETE', direzione: 'PASSIVA', stato: 'attivo', provincia: 'SA', valore: 69, unita_misura: '€/t' },
    { fornitore_nome: 'LOGISTICA & PNEUMATICI SRL', prestazione: 'RACCOLTA', tipologia: 'RETE', direzione: 'PASSIVA', stato: 'attivo', provincia: 'AV', valore: 71, unita_misura: '€/t', data_fine_validita: '2026-06-30' },
  ];
  const conTariffario = foglioPassiva(voci, RETE, 'RETE', 'Settembre', 2026, TARIFFE);
  const salerno = conTariffario.raccoglitori.righe.find(r => r.tipo === 'voce' && /SALERNO/.test(r.voce));
  verifica('una riga a zero prende il prezzo dal tariffario', salerno.prezzo === 69 && salerno.fonte_prezzo === 'tariffario',
    JSON.stringify([salerno.prezzo, salerno.fonte_prezzo]));
  // Una tariffa scaduta a giugno non vale a settembre: si torna al modello.
  const avellino = conTariffario.raccoglitori.righe.find(r => r.tipo === 'voce' && /AVELLINO/.test(r.voce));
  verifica('una tariffa scaduta non si usa', avellino.fonte_prezzo === 'modello', avellino.fonte_prezzo);
  // 4. Senza niente da nessuna parte si usa il prezzo della voce, e si dichiara.
  const senza = {
    raccoglitori: [g('GATIM S.R.L.', [racc({ tonnellate: 10, regione: 'Calabria' })])],
    impianti_stoccaggi: [], trasporti_secondaria: [],
  };
  const v4 = foglioPassiva(voci, senza, 'RETE', 'Settembre', 2026).raccoglitori.righe.find(r => r.tipo === 'voce' && r.soggetto === 'GATIM S.R.L.');
  verifica('senza tariffa si usa il prezzo del modello', v4.prezzo === 70 && v4.fonte_prezzo === 'modello', JSON.stringify([v4.prezzo, v4.fonte_prezzo]));
  verifica('e il foglio lo dichiara nelle note', /tariffario/i.test(v4.note), v4.note);
  // 5. Due tariffe diverse sulla stessa voce: il prezzo non si scrive, l'importo
  // e' quello calcolato riga per riga.
  const miste = {
    raccoglitori: [g('GATIM S.R.L.', [
      racc({ tonnellate: 10, regione: 'Calabria', tariffa_valore: 70, importo: 700 }),
      racc({ tonnellate: 5, regione: 'Calabria', tariffa_valore: 74, importo: 370 }),
    ])],
    impianti_stoccaggi: [], trasporti_secondaria: [],
  };
  const v5 = foglioPassiva(voci, miste, 'RETE', 'Settembre', 2026).raccoglitori.righe.find(r => r.tipo === 'voce' && r.soggetto === 'GATIM S.R.L.');
  verifica('con tariffe diverse il prezzo resta vuoto', v5.prezzo === null && v5.fonte_prezzo === 'vari', JSON.stringify([v5.prezzo, v5.fonte_prezzo]));
  verifica('e l importo e la somma delle righe', v5.totale === 1070, String(v5.totale));
  verifica('e si dice che vanno distinte', /Tariffe diverse/.test(v5.note), v5.note);
  // 6. Euro al chilo: 0,090 al chilo sono 90 a tonnellata, e il conto torna.
  const alChilo = {
    raccoglitori: [g('GATIM S.R.L.', [racc({ tonnellate: 10, regione: 'Calabria', tariffa_valore: 0.09, unita_misura: '€/kg' })])],
    impianti_stoccaggi: [], trasporti_secondaria: [],
  };
  const v6 = foglioPassiva(voci, alChilo, 'RETE', 'Settembre', 2026).raccoglitori.righe.find(r => r.tipo === 'voce' && r.soggetto === 'GATIM S.R.L.');
  verifica('il prezzo al chilo si scrive a tonnellata', v6.prezzo === 90 && v6.totale === 900, JSON.stringify([v6.prezzo, v6.totale]));
  // 7. ECO.GEA: una tantum a viaggio. Un viaggio a 400 euro fa 400 euro,
  // qualunque sia il peso.
  const aViaggio = {
    raccoglitori: [g('ECO.GEA SRL', [racc({ tonnellate: 18.2, regione: 'Campania', viaggi: 1, tariffa_valore: 400, unita_misura: '€/viaggio' })])],
    impianti_stoccaggi: [], trasporti_secondaria: [],
  };
  const v7 = foglioPassiva(voci, aViaggio, 'RETE', 'Giugno', 2026).raccoglitori.righe.find(r => r.tipo === 'voce' && r.soggetto === 'ECO.GEA SRL');
  verifica('ECO.GEA si paga a viaggio, non a tonnellata',
    v7.unita_misura === 'euro_viaggio' && v7.prezzo === 400 && v7.totale === 400,
    JSON.stringify([v7.unita_misura, v7.prezzo, v7.totale]));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
