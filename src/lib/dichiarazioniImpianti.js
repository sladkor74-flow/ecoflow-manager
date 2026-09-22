// Specchio di base44/shared/dichiarazioniImpianti.ts per il browser.
// Quando si cambia una regola va cambiata in tutti e due i file.
//
// Dichiarazioni degli impianti: regole comuni al modulo e ai controlli.
//
// Ogni mese l'impianto dichiara che cosa ha ricavato dai PFU che gli abbiamo
// conferito. La dichiarazione arriva per email (per Irigom la prepariamo noi) e
// poi si carica sul portale Ecotyre: solo quando e' caricata decurta la giacenza.
//
// Giacenza = giacenza al 31 dicembre dell'anno prima + conferito dell'anno -
// dichiarato e caricato. Deve coincidere con la giacenza del portale, che il
// portale stesso calcola come peso conferito non ancora dichiarato.

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export const CANALI = [
  { chiave: 'RETE', nome: 'Rete' },
  { chiave: 'ACI', nome: 'ACI' },
  { chiave: 'EXTRA_RACCOLTA', nome: 'Extra raccolta' },
];

/** Che cosa esce dalla lavorazione, secondo l'operazione dell'impianto. */
export const MATERIALI = [
  { chiave: 'granulo_kg', nome: 'Granulo', operazioni: ['R3'], eer: '19.12.04' },
  { chiave: 'fibre_kg', nome: 'Fibre tessili', operazioni: ['R3'], eer: '19.12.08' },
  { chiave: 'ciabattato_kg', nome: 'Ciabattato', operazioni: ['R1'], eer: '19.12.04' },
  { chiave: 'cippato_kg', nome: 'Cippato', operazioni: ['R1'], eer: '19.12.04' },
  { chiave: 'cssc_kg', nome: 'CSS-C', operazioni: ['R1'], eer: '19.12.10' },
  { chiave: 'metalli_kg', nome: 'Metalli ferrosi', operazioni: ['R3', 'R1'], eer: '19.12.02' },
  { chiave: 'altro_kg', nome: 'Altro', operazioni: ['R3', 'R1'], eer: '' },
];

export const OPERAZIONI = {
  R3: { nome: 'R3 — recupero di materia', spiega: 'Dai PFU si ricavano granulo, metalli ferrosi e fibre tessili.' },
  R1: { nome: 'R1 — valorizzazione energetica', spiega: 'I PFU diventano ciabattato o cippato, piu\' i metalli ferrosi separati; il combustibile va a cementerie o all\'estero.' },
};

/** Operazione di un sito a partire dalla tipologia di trattamento scritta in Giacenze. */
export function operazioneDa(tipologia) {
  const t = String(tipologia || '').toLowerCase();
  if (t.includes('frantum') || t.includes('r1')) return 'R1';
  if (t.includes('eow') || t.includes('r3')) return 'R3';
  return '';
}

export const materialiDi = (operazione) => MATERIALI.filter(m => m.operazioni.includes(operazione === 'R1' ? 'R1' : 'R3'));
export const sommaMateriali = (d) => MATERIALI.reduce((s, m) => s + (Number(d && d[m.chiave]) || 0), 0);

/**
 * Perche' un mese senza dichiarazione e' a posto lo stesso. Si segna sulla
 * dichiarazione del mese (motivo_assenza, con quantita' a zero); la rete di chi
 * non la manda per accordo (dichiara_rete falso in Giacenze) e' non dovuta anche
 * senza segnarla.
 */
export const MOTIVI_ASSENZA = {
  non_dovuta: {
    nome: 'Non dovuta',
    spiega: 'Il trattamento di questo canale non e\' a nostro carico: l\'impianto non ci deve la dichiarazione.',
  },
  solo_metalli: {
    nome: 'Solo metalli ferrosi',
    spiega: 'Nel mese sono usciti solo metalli ferrosi e nessuna gomma: a portale non si carica nulla e il ferro si dichiara con la prossima uscita di gomma.',
  },
};

/**
 * Stato di una casella del riepilogo: come i colori del foglio di gestione.
 * `dove` ({ canale, dichiara_rete }) serve a riconoscere la rete non dovuta.
 */
export function statoDichiarazione(d, dove = {}) {
  if (!d || !(Number(d.quantita_kg) > 0)) {
    const motivo = d && d.motivo_assenza;
    if (motivo === 'solo_metalli') return 'solo_metalli';
    if (motivo === 'non_dovuta' || (dove.dichiara_rete === false && (dove.canale || 'RETE') === 'RETE')) return 'non_dovuta';
    return 'nessuna';
  }
  if (d.caricata_inviata) return 'caricata';
  if (d.ricevuta_email) return 'ricevuta';
  return 'inserita';
}

export const STATI = {
  nessuna: { nome: 'Nessuna dichiarazione', classe: '' },
  non_dovuta: { nome: 'Dichiarazione non dovuta: il trattamento di questo canale non e\' a nostro carico', classe: 'bg-slate-50 text-slate-500' },
  solo_metalli: { nome: 'Solo metalli ferrosi usciti: nessuna gomma da dichiarare, il ferro va con la prossima uscita di gomma', classe: 'bg-sky-50 text-sky-900' },
  inserita: { nome: 'Quantita\' inserita, documento non ancora segnato', classe: 'bg-slate-100' },
  ricevuta: { nome: 'Dichiarazione in mano, non ancora caricata a portale', classe: 'bg-emerald-100' },
  caricata: { nome: 'Caricata a portale: decurta la giacenza', classe: 'bg-emerald-600 text-white' },
};

const kg = (v) => Math.round(Number(v) || 0);
// Il punto delle migliaia va messo a mano: toLocaleString qui non lo mette sui
// numeri di quattro cifre.
const mig = (v) => String(Math.round(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Controlli di una dichiarazione mensile. `conferito` sono i kg conferiti in quel
 * mese in quell'impianto sullo stesso canale.
 */
export function controlliDichiarazione(d, conferito, operazione, dove = {}) {
  const esiti = [];
  const q = kg(d && d.quantita_kg);
  const materiali = kg(sommaMateriali(d));
  // Uno stoccaggio non dichiara: quello che riceve riparte come secondaria ed e'
  // l'impianto che lo lavora a dichiararlo. E sui canali diversi dalla rete la
  // dichiarazione mensile non e' la regola: si segnala, ma senza allarme.
  const stoccaggio = dove.tipo_destinazione === 'stoc';
  const nonDichiaraRete = dove.dichiara_rete === false && (dove.canale || 'RETE') === 'RETE';
  // Se il portale non aspetta piu' niente per quel mese, la dichiarazione c'e'
  // stata: magari dentro quella del mese dopo, perche' il portale scala gli ordini
  // dal piu' vecchio. Non manca nulla e non si segnala.
  const attesoAPortale = dove.non_dichiarato_kg === undefined || dove.non_dichiarato_kg > 0;
  // Un mese segnato come non dovuto o di soli metalli e' a posto cosi'.
  const giustificato = !!(d && d.motivo_assenza);
  if (!q && conferito > 0 && !stoccaggio && !nonDichiaraRete && attesoAPortale && !giustificato) {
    const canale = dove.canale || 'RETE';
    esiti.push({
      tipo: 'mancante',
      livello: canale === 'RETE' ? 'attenzione' : 'info',
      testo: `Conferiti ${mig(conferito)} kg in questo mese e nessuna dichiarazione.`,
    });
  }
  // L'extra raccolta si dichiara sul mese del formulario (fine trasporto), anche
  // se la dichiarazione arriva mesi dopo: i PFU raccolti a luglio, lavorati e
  // usciti ad agosto, si dichiarano a consuntivo in settembre, ma il rigo resta
  // a luglio. Messa sul mese in cui la si riceve, la stessa raccolta comparirebbe
  // due volte: un mese col conferito senza dichiarazione, un altro con la
  // dichiarazione senza conferito.
  if (q > 0 && !conferito && (dove.canale || 'RETE') === 'EXTRA_RACCOLTA') {
    esiti.push({ tipo: 'extra_fuori_mese', livello: 'attenzione', testo: 'Nessun conferimento di extra raccolta in questo mese: la dichiarazione va sul mese del formulario (fine trasporto), non su quello in cui arriva.' });
  }
  if (q > 0 && giustificato) {
    esiti.push({ tipo: 'motivo_con_quantita', livello: 'info', testo: `Il mese e' segnato come «${(MOTIVI_ASSENZA[d.motivo_assenza] || {}).nome || d.motivo_assenza}» ma ha una quantita' dichiarata: vale la quantita'.` });
  }
  if (q > 0 && materiali === 0) {
    esiti.push({ tipo: 'senza_dettaglio', livello: 'info', testo: 'Manca il dettaglio dei materiali ricavati.' });
  }
  if (q > 0 && materiali > 0 && Math.abs(materiali - q) > 20) {
    esiti.push({ tipo: 'materiali_diversi', livello: 'attenzione', testo: `La somma dei materiali (${mig(materiali)} kg) non corrisponde al totale dichiarato (${mig(q)} kg).` });
  }
  if (q > 0 && !d.caricata_inviata) {
    esiti.push({ tipo: 'da_caricare', livello: 'attenzione', testo: 'Dichiarazione da caricare a portale: finche\' non la carichi non decurta la giacenza.' });
  }
  if (q > 0 && conferito > 0 && q > conferito * 1.2) {
    esiti.push({ tipo: 'oltre_conferito', livello: 'info', testo: `Dichiarati ${mig(q)} kg contro ${mig(conferito)} kg conferiti nel mese: puo\' succedere lavorando la giacenza dei mesi prima.` });
  }
  if (q > 0 && operazione === 'R3' && kg(d.ciabattato_kg) + kg(d.cippato_kg) + kg(d.cssc_kg) > 0) {
    esiti.push({ tipo: 'materiali_fuori_operazione', livello: 'info', testo: 'Impianto a recupero di materia (R3) con quantita\' di ciabattato, cippato o CSS-C: controlla l\'operazione.' });
  }
  return esiti;
}

export const TOLLERANZA_QUADRATURA_T = 0.5;

/**
 * Quadratura di un sito, un canale per volta: la giacenza che risulta dai
 * movimenti e dalle dichiarazioni deve coincidere con quella del portale.
 *
 *   calcolata = giacenza al 31/12 dell'anno prima + entrato - uscito
 *               - dichiarato e caricato
 *
 * Quattro accortezze, senza le quali i numeri non tornano mai:
 * - tutto per fine del trasporto, mai per data di chiusura dell'ordine a portale;
 * - la giacenza a portale segue i caricamenti: e' la fotografia degli ordini non
 *   dichiarati, piu' i carichi che il gestionale conosce e il file no (li si
 *   riconosce dal numero d'ordine), meno le dichiarazioni caricate dopo. Per uno
 *   stoccaggio e' la rilevazione per classe piu' i movimenti finiti dopo;
 * - un canale per volta: rete e ACI non si sommano, e l'extra raccolta a portale
 *   non c'e'. Per un impianto conta la rete che arriva all'impianto, in primaria
 *   e in secondaria; il suo stoccaggio, se ne ha uno, sta a parte;
 * - le terziarie non si tolgono: sono uscite di materiale gia' trasformato, che
 *   il portale ha gia' scalato con la dichiarazione.
 */
export function quadratura(sito) {
  const calcolata = (sito.giacenza_iniziale_t || 0)
    + (sito.entrato_confronto_t || 0) - (sito.uscito_confronto_t || 0)
    - (sito.dichiarato_caricato_rete_t || 0);
  const portale = sito.giacenza_portale_t;
  const scarto = portale === null || portale === undefined ? null : Math.round((calcolata - portale) * 1000) / 1000;
  return {
    giacenza_calcolata_t: Math.round(calcolata * 1000) / 1000,
    giacenza_portale_t: portale === null || portale === undefined ? null : Math.round(portale * 1000) / 1000,
    scarto_t: scarto,
    quadra: scarto === null ? null : Math.abs(scarto) <= TOLLERANZA_QUADRATURA_T,
  };
}
