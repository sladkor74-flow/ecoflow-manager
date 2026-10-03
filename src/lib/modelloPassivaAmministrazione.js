// IL MODELLO DELLE VOCI DELLA PASSIVA, COM'E' NEL FOGLIO DELL'AMMINISTRAZIONE.
//
// Queste sono le righe e i prezzi che l'amministrazione ha nel suo foglio di
// settembre 2026 (passiva\Fatturazione passiva Ecotyre (settembre).xlsx), messe
// qui perche' il gestionale sappia comporre il foglio da solo. E' il senso del
// lavoro di questi mesi: il file di lavoro serve per cominciare, poi il
// ragionamento deve stare dentro il gestionale.
//
// PERCHE' UN MODELLO SCRITTO E NON UNA PROPOSTA AUTOMATICA. La proposta
// automatica (modelloDaPassiva) sa fare una riga per fornitore col prezzo del
// mese: non sa che LOGISTICA & PNEUMATICI ha quattro province con quattro
// prezzi, che a Irigom le classi G1 costano 120 e le G2 250, che Emmesse si paga
// 72 se conferisce a Gatim e 90 se conferisce a Irigom. Quelle sono le righe su
// cui l'amministrazione lavora, e il foglio deve nascere con dentro quelle.
//
// IL RISCONTRO E' SETTEMBRE 2026, e torna al centesimo:
//   rete  raccoglitori 1.120,24 t -> 65.351,38 euro
//         impianti     1.293,34 t -> 87.888,39 euro
//   ACI   raccoglitori    18,89 t ->  1.509,38 euro
//         impianti        33,35 t ->  2.873,89 euro
// prove/modelloPassivaAmministrazione.mjs ricostruisce quei quattro numeri dalle
// tonnellate vere del mese: se un prezzo qui dentro cambia, la prova lo dice.
//
// I PREZZI QUI DENTRO SONO L'ULTIMA RISORSA, NON LA FONTE.
//
// La fonte e' il TARIFFARIO, dove stanno i prezzi dei contratti 2026. Il foglio
// prende il prezzo che il mese ha applicato davvero sui movimenti e, per le righe
// a zero, quello che il tariffario dice in quel mese (prezzoDellaVoce in
// passivaAmministrazione.js). I numeri scritti qui si usano soltanto quando ne' i
// movimenti ne' il tariffario dicono niente, e in quel caso il foglio lo dichiara
// nella colonna delle note: un prezzo senza una fonte, su una fattura, va detto.
// Sono quelli che il foglio dell'amministrazione ha usato a settembre 2026, e
// servono da riscontro.
//
// L'utente, 03/10/2026: «gli altri prezzi li dovresti gia' avere nel tariffario
// 2026 anche perche' hai letto tutti i loro contratti».

const criterio = (c) => (c && Object.keys(c).length ? JSON.stringify(c) : '');

// [soggetto, voce, prezzo, criterio, nota, colonna_prezzo, unita_misura]
//
// Il soggetto e' scritto come lo scrive il gestionale negli archivi, non come lo
// scrive l'amministrazione: e' il nome su cui si agganciano i movimenti. Il
// confronto passa comunque dalla normalizzazione delle ragioni sociali, quindi
// «Gatim» e «GATIM S.R.L.» sono lo stesso soggetto.
//
// IL CRITERIO SI SCRIVE SOLO DOVE SERVE A DIVIDERE. Un fornitore con una riga
// sola non ne ha bisogno: la sua riga prende tutto quello che ha portato nel
// mese, come nel foglio dell'amministrazione, e il nome della voce («Campania»,
// «stoccaggio») resta a dire di che si tratta. Scrivere un criterio anche la'
// sarebbe peggio: se un mese quel fornitore conferisse da un'altra regione, i
// suoi chili non troverebbero nessuna riga e sparirebbero dal foglio. Il criterio
// c'e' dove il prezzo cambia - le province di Logistica & Pneumatici, le classi
// di Irigom e Green Tyre, la destinazione di Emmesse, la primaria e la secondaria
// di Gatim - e in quell'ordine: la prima riga che riconosce il movimento se lo
// prende.
const RETE_RACCOGLITORI = [
  // ECO.GEA e' una tantum: nel 2026 un ritiro solo, a giugno, e si paga a
  // VIAGGIO, non a tonnellata (detto dall'utente il 03/10/2026). Il prezzo lo
  // dice il tariffario quando il movimento c'e'; qui la riga serve a tenerla nel
  // foglio anche nei mesi in cui non ha portato niente.
  ['ECO.GEA SRL', 'Campania', 0, null, 'Una tantum: nel 2026 un solo ritiro, a giugno, pagato a viaggio.', '', 'euro_viaggio'],
  ['C.L. SERVICE S.R.L.', 'Campania', 71, null],
  ['ECOLOGICAL SYSTEMS SRL', 'Basilicata', 75, null],
  ['Ecorecuperi Srl', 'Campania', 72, null],
  // Il prezzo di Emmesse cambia con l'impianto di scarico: 72 su Gatim, 90 su
  // Irigom. E' il criterio della destinazione, non quello della regione.
  ['EMMESSE SRLS', 'Calabria (conferimenti su Gatim)', 72, { destinazione: 'Gatim' }],
  ['EMMESSE SRLS', 'Calabria (conferimenti su Irigom)', 90, { destinazione: 'Irigom' }],
  ['GATIM S.R.L.', 'Calabria', 70, null],
  ['GREEN TYRE PROJECT SRL', 'Sicilia (P+M+G1)', 90, { classi: ['P', 'M', 'G1'] }],
  ['GREEN TYRE PROJECT SRL', 'Sicilia (G2)', 300, { classi: ['G2'] }],
  ['LOGISTICA & PNEUMATICI SRL', 'Campania - NAPOLI', 68, { provincia: 'NA' }],
  ['LOGISTICA & PNEUMATICI SRL', 'Campania - SALERNO', 68, { provincia: 'SA' }],
  ['LOGISTICA & PNEUMATICI SRL', 'Campania - AVELLINO', 71, { provincia: 'AV' }],
  ['LOGISTICA & PNEUMATICI SRL', 'Campania - CASERTA', 72, { provincia: 'CE' }],
  ['LOGISTICA & PNEUMATICI SRL', 'Campania - conferiti c\\o Nappi Sud', 71, { destinazione: 'Nappi Sud' }],
  ['Nappi Sud Srl A Socio Unico', 'Campania', 58, { regione: 'Campania' }],
  ['Nappi Sud Srl A Socio Unico', 'Basilicata', 58, { regione: 'Basilicata' }],
  ['PNEUSERVICE CONVERSANO SRL', 'Puglia', 100, null],
  // SMOCO raccoglie con i propri mezzi: le sue righe stanno nel foglio perche' i
  // chili vanno visti, ma non si fattura a se stessi.
  ['SMOCO S.R.L.', 'Basilicata', 0, { regione: 'Basilicata' }, 'Interno: non fatturato.'],
  ['SMOCO S.R.L.', 'Calabria', 0, { regione: 'Calabria' }, 'Interno: non fatturato.'],
  ['SMOCO S.R.L.', 'Puglia', 0, { regione: 'Puglia' }, 'Interno: non fatturato.'],
];

const RETE_IMPIANTI = [
  ['Gatim', '(P+M+G1)', 105, { classi: ['P', 'M', 'G1'] }],
  ['Gatim', 'G2', 135, { classi: ['G2'] }],
  ['GREEN TYRE PROJECT SRL', '(P+M+G1)', 105, { classi: ['P', 'M', 'G1'] }],
  ['GREEN TYRE PROJECT SRL', '(G2)', 300, { classi: ['G2'] }],
  // Irigom distingue le classi E la provenienza: la primaria, la secondaria che
  // arriva dagli stoccaggi e l'extra raccolta hanno righe separate anche quando
  // il prezzo e' lo stesso, perche' in fattura si leggono separate.
  ['Irigom S.r.l.', 'classi P+M', 90, { classi: ['P', 'M'], provenienza: 'primaria' }],
  ['Irigom S.r.l.', 'classi G1', 120, { classi: ['G1'], provenienza: 'primaria' }],
  ['Irigom S.r.l.', 'classi G2', 250, { classi: ['G2'], provenienza: 'primaria' }],
  ['Irigom S.r.l.', 'da extra raccolta (classi P+M)', 90, { classi: ['P', 'M'], provenienza: 'extra' }],
  ['Irigom S.r.l.', 'da secondaria classe P', 90, { classi: ['P'], provenienza: 'secondaria' }],
  ['Irigom S.r.l.', 'da secondaria classe M', 90, { classi: ['M'], provenienza: 'secondaria' }],
  ['Irigom S.r.l.', 'da secondaria classe G1', 120, { classi: ['G1'], provenienza: 'secondaria' }],
  ['Irigom S.r.l.', 'da secondaria classe G2', 250, { classi: ['G2'], provenienza: 'secondaria' }],
  ['NAPPI SUD SRL', 'stoccaggio', 16, null],
  ['TECNOGUM SRL', 'da primaria rete', 0, { provenienza: 'primaria' }, 'Sulla rete Tecnogum non e\' contrattualizzata: i chili si vedono, non si pagano.'],
  ['TECNOGUM SRL', 'da secondaria rete', 0, { provenienza: 'secondaria' }, 'Sulla rete Tecnogum non e\' contrattualizzata: i chili si vedono, non si pagano.'],
  ['T.R.S. SRL', '', 115, null],
  ['T-CYCLE INDUSTRIES SRL', 'classi P+M', 70, { classi: ['P', 'M'] }],
  ['T-CYCLE INDUSTRIES SRL', 'classi G1', 70, { classi: ['G1'] }],
  ['T-CYCLE INDUSTRIES SRL', 'classi G2', 160, { classi: ['G2'] }],
  // La riga dello stock fatturato non ha criterio: raccoglie quello che le altre
  // tre non prendono. Nel foglio dell'amministrazione e' una riga che si compila
  // a mano quando si fattura una giacenza.
  ['T-CYCLE INDUSTRIES SRL', 'STOCK (fatturato)', 25, null, 'Si riempie solo quando si fattura una giacenza: controllala prima di mandare il foglio.'],
];

// L'ACI nel loro foglio e' PIATTO: una riga per voce, col nome del soggetto e fra
// parentesi il dettaglio. Il gestionale lo riproduce con lo stesso modello: qui
// cambia solo come si stampa.
const ACI_RACCOGLITORI = [
  ['GATIM S.R.L.', '', 90, null],
  ['Nappi Sud Srl A Socio Unico', 'Campania', 92, { regione: 'Campania' }],
  ['Nappi Sud Srl A Socio Unico', 'Basilicata', 82, { regione: 'Basilicata' }],
  ['EMMESSE SRLS', '', 110, null],
  ['SMOCO S.R.L.', '', 0, null, 'Interno: non fatturato.'],
  // Green Tyre sull'ACI ha un prezzo unico che comprende anche il trattamento:
  // si paga una volta sola, sul conferito, e negli impianti non si ripete.
  ['GREEN TYRE PROJECT SRL', '', 225, null, 'Prezzo unico: comprende raccolta e trattamento.'],
];

const ACI_IMPIANTI = [
  ['Irigom S.r.l.', '', 10, null, '', 'stoccaggio'],
  ['NAPPI SUD SRL', '', 16, null, '', 'stoccaggio'],
  ['TECNOGUM SRL', 'da secondaria', 95, null, '', 'trattamento'],
  ['Gatim', 'da primaria', 105, { provenienza: 'primaria' }, '', 'trattamento'],
  ['Gatim', 'da secondaria', 105, { provenienza: 'secondaria' }, '', 'trattamento'],
  ['T.R.S. SRL', 'da secondaria', 115, null, '', 'trattamento'],
];

const BLOCCHI = [
  ['RETE', 'raccoglitori', RETE_RACCOGLITORI],
  ['RETE', 'impianti', RETE_IMPIANTI],
  ['ACI', 'raccoglitori', ACI_RACCOGLITORI],
  ['ACI', 'impianti', ACI_IMPIANTI],
];

/**
 * Le voci del modello dell'amministrazione, pronte da scrivere nell'archivio.
 * @param {number} anno l'anno a cui attaccarle: i prezzi di un anno sono suoi.
 * @returns {array} le voci, nell'ordine in cui vanno stampate.
 */
export function modelloAmministrazione(anno) {
  const out = [];
  for (const [canale, blocco, righe] of BLOCCHI) {
    let i = 0;
    for (const [soggetto, voce, prezzo, crit, nota, colonna, unita] of righe) {
      out.push({
        anno: Number(anno),
        canale,
        blocco,
        soggetto,
        voce: voce || '',
        prezzo: Number(prezzo) || 0,
        unita_misura: unita || 'euro_tonnellata',
        colonna_prezzo: colonna || '',
        ordine: ++i * 10,
        criterio_json: criterio(crit),
        attiva: true,
        note: nota || '',
      });
    }
  }
  return out;
}

/** Quante voci porta il modello, per dirlo prima di caricarlo. */
export const quanteVociModello = () => BLOCCHI.reduce((s, [, , righe]) => s + righe.length, 0);
