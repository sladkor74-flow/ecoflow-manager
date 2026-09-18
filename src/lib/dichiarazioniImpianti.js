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
export const meseDa = (data) => (data ? MESI[new Date(data).getUTCMonth()] : '');

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

/** Stato di una casella del riepilogo: come i colori del foglio di gestione. */
export function statoDichiarazione(d) {
  if (!d || !(Number(d.quantita_kg) > 0)) return 'nessuna';
  if (d.caricata_inviata) return 'caricata';
  if (d.ricevuta_email) return 'ricevuta';
  return 'inserita';
}

export const STATI = {
  nessuna: { nome: 'Nessuna dichiarazione', classe: '' },
  inserita: { nome: 'Quantita\' inserita, documento non ancora segnato', classe: 'bg-slate-100' },
  ricevuta: { nome: 'Dichiarazione in mano, non ancora caricata a portale', classe: 'bg-emerald-100' },
  caricata: { nome: 'Caricata a portale: decurta la giacenza', classe: 'bg-emerald-600 text-white' },
};

const kg = (v) => Math.round(Number(v) || 0);

/**
 * Controlli di una dichiarazione mensile. `conferito` sono i kg conferiti in quel
 * mese in quell'impianto sullo stesso canale.
 */
export function controlliDichiarazione(d, conferito, operazione) {
  const esiti = [];
  const q = kg(d && d.quantita_kg);
  const materiali = kg(sommaMateriali(d));
  if (!q && conferito > 0) {
    esiti.push({ tipo: 'mancante', livello: 'attenzione', testo: `Conferiti ${conferito.toLocaleString('it-IT')} kg in questo mese e nessuna dichiarazione.` });
  }
  if (q > 0 && materiali === 0) {
    esiti.push({ tipo: 'senza_dettaglio', livello: 'info', testo: 'Manca il dettaglio dei materiali ricavati.' });
  }
  if (q > 0 && materiali > 0 && Math.abs(materiali - q) > 20) {
    esiti.push({ tipo: 'materiali_diversi', livello: 'attenzione', testo: `La somma dei materiali (${materiali.toLocaleString('it-IT')} kg) non corrisponde al totale dichiarato (${q.toLocaleString('it-IT')} kg).` });
  }
  if (q > 0 && !d.caricata_inviata) {
    esiti.push({ tipo: 'da_caricare', livello: 'attenzione', testo: 'Dichiarazione da caricare a portale: finche\' non la carichi non decurta la giacenza.' });
  }
  if (q > 0 && conferito > 0 && q > conferito * 1.2) {
    esiti.push({ tipo: 'oltre_conferito', livello: 'info', testo: `Dichiarati ${q.toLocaleString('it-IT')} kg contro ${conferito.toLocaleString('it-IT')} kg conferiti nel mese: puo\' succedere lavorando la giacenza dei mesi prima.` });
  }
  if (q > 0 && operazione === 'R3' && kg(d.ciabattato_kg) + kg(d.cippato_kg) + kg(d.cssc_kg) > 0) {
    esiti.push({ tipo: 'materiali_fuori_operazione', livello: 'info', testo: 'Impianto a recupero di materia (R3) con quantita\' di ciabattato, cippato o CSS-C: controlla l\'operazione.' });
  }
  return esiti;
}

export const TOLLERANZA_QUADRATURA_T = 0.5;

/**
 * Quadratura di un sito: la giacenza che risulta dalle dichiarazioni deve
 * coincidere con quella del portale, che è il conferito non ancora dichiarato.
 *
 * Tre accortezze, senza le quali i numeri non tornano mai:
 * - si confronta alla data della fotografia del portale (l'ultimo file degli
 *   ordini non dichiarati), non a oggi: quello che si è chiuso dopo il portale
 *   non lo sa ancora;
 * - solo il canale rete: i conferimenti ACI e l'extra raccolta hanno un giro
 *   proprio e non entrano nella giacenza del portale;
 * - le terziarie non si tolgono: sono uscite di materiale già trasformato, che
 *   il portale ha già scalato con la dichiarazione.
 */
export function quadratura(sito) {
  const calcolata = (sito.giacenza_iniziale_t || 0)
    + (sito.conferito_alla_foto_t || 0) + (sito.secondarie_in_alla_foto_t || 0)
    - (sito.dichiarato_caricato_rete_t || 0) - (sito.secondarie_out_alla_foto_t || 0);
  const portale = sito.giacenza_portale_t;
  const scarto = portale === null || portale === undefined ? null : Math.round((calcolata - portale) * 1000) / 1000;
  return {
    giacenza_calcolata_t: Math.round(calcolata * 1000) / 1000,
    giacenza_portale_t: portale === null || portale === undefined ? null : Math.round(portale * 1000) / 1000,
    scarto_t: scarto,
    quadra: scarto === null ? null : Math.abs(scarto) <= TOLLERANZA_QUADRATURA_T,
  };
}
