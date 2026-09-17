import { testo, daData, siNo, apriFoglio, griglia } from '@/lib/foglioExcel';

// Dichiarazioni RENTRI: lettura del foglio e controlli con i dati del portale.
//
// Le dichiarazioni non scadono, ma le condizioni cambiano: chi oggi non e' iscritto
// al RENTRI puo' esserlo domani. Il portale lo sa per ogni punto di raccolta
// (anagrafica PDR), quindi qui si confronta cio' che il produttore ha dichiarato
// con cio' che risulta nel portale, e si segnala dove la dichiarazione va
// aggiornata o verificata. Nessun controllo cambia i dati da solo.

// FIR digitale obbligatorio dal 16 settembre 2026 (DL 200/2025 art. 13, convertito
// dalla L. 26/2026) per chi e' obbligato all'iscrizione al RENTRI. Precisazione
// dell'utente del 17/09/2026: i produttori di rifiuti speciali non pericolosi (i PFU
// lo sono) con meno di 10 dipendenti non hanno l'obbligo e possono ancora scegliere
// il cartaceo, anche se iscritti; da 10 dipendenti in su il FIR deve essere digitale.
// Quindi "iscritto con FIR cartaceo" non e' di per se' un problema: lo diventa solo
// se risulta l'obbligo, che nel foglio si legge dalla nota ("iscrizione obbligatoria
// +10 dipendenti", "10 dipendenti o piu'", "almeno 10 dipendenti"...).
export const FIR_DIGITALE_OBBLIGATORIO_DAL = '2026-09-16';

const OBBLIGO_DA_NOTA = /(\+|pi[uù] di|oltre|almeno|\bda|>=?|≥)\s*10\s*(o pi[uù]\s*)?dipendent|\b10\s*(\+|o pi[uù]|e oltre)\s*dipendent|\b10\s*dipendenti\s*(o pi[uù]|e oltre|in su)|iscrizione\s+obbligatori/i;
export const obbligoIndicatoNellaNota = (nota) => OBBLIGO_DA_NOTA.test(String(nota || ''));

// Nel portale il campo ID U/L RENTRi porta un codice d'esempio finche' il
// produttore non inserisce quello della sua unita' locale: non e' un codice vero.
export const CODICE_ESEMPIO = 'OP1234567890123-XX0000';
export const eCodiceEsempio = (v) => String(v || '').trim().toUpperCase() === CODICE_ESEMPIO;

export const COLLEGAMENTI = {
  codice: { nome: 'codice RENTRI', spiega: "Il codice RENTRI scritto nella nota è quello dell'unità locale del PDR: collegamento certo." },
  nome: { nome: 'per nome', spiega: "Il nome, tolta la forma societaria, è identico a quello di un solo produttore dell'anagrafica." },
  simile: { nome: 'da confermare', spiega: 'Il nome somiglia a quello di un solo produttore: controlla che sia lui e conferma.' },
  manuale: { nome: 'scelto a mano', spiega: "Collegamento scelto o confermato dall'amministratore." },
  nessuno: { nome: 'da collegare', spiega: 'Nessun produttore con questo nome, oppure più produttori diversi con lo stesso nome: scegli quello giusto.' },
};

/**
 * Legge il foglio delle dichiarazioni. Le colonne si cercano per intestazione;
 * la nota e' la prima colonna dopo "FIR cartaceo", che nel foglio non ha titolo.
 */
export async function leggiDichiarazioniRentri(file) {
  const { XLSX, ws, nome } = await apriFoglio(file, /rentri/i);
  const ymd = daData(XLSX);
  const g = griglia(XLSX, ws);

  let capo = -1;
  const col = {};
  for (let r = 0; r < Math.min(g.length, 15); r++) {
    const riga = (g[r] || []).map(v => testo(v).toLowerCase());
    const prod = riga.findIndex(v => v.includes('produttore'));
    const iscr = riga.findIndex(v => v.includes('iscritto'));
    if (prod >= 0 && iscr >= 0) {
      capo = r;
      col.produttore = prod;
      col.iscritto = iscr;
      col.tipologia = riga.findIndex(v => v.includes('tipologia'));
      col.data = riga.findIndex(v => v.includes('dichiarazione') || v.includes('data'));
      col.digitale = riga.findIndex(v => v.includes('digitale'));
      col.cartaceo = riga.findIndex(v => v.includes('cartaceo'));
      col.nota = col.cartaceo >= 0 ? col.cartaceo + 1 : -1;
      break;
    }
  }
  if (capo < 0) throw new Error(`Nel foglio «${nome}» non trovo le colonne "Produttore" e "Iscritto al RENTRI".`);

  const cella = (r, c) => (c >= 0 && g[r] && g[r][c] !== undefined ? g[r][c] : null);
  const righe = [];
  for (let r = capo + 1; r < g.length; r++) {
    const produttore = testo(cella(r, col.produttore));
    if (!produttore) continue;
    righe.push({
      riga: r + 1,
      nome: produttore,
      tipologia: testo(cella(r, col.tipologia)),
      data: ymd(cella(r, col.data)),
      iscritto: siNo(cella(r, col.iscritto)),
      digitale: siNo(cella(r, col.digitale)),
      cartaceo: siNo(cella(r, col.cartaceo)),
      nota: testo(cella(r, col.nota)),
    });
  }
  if (!righe.length) throw new Error(`Nel foglio «${nome}» non ho trovato nessuna dichiarazione.`);
  return righe;
}

// Valori del portale: "Sì", "No", "?" per l'iscrizione; "Digitale", "Cartaceo", "?".
const iscrittoPortale = (v) => (/^s[iì]$/i.test(testo(v)) ? true : /^no$/i.test(testo(v)) ? false : null);
const formularioPortale = (v) => (/digital/i.test(testo(v)) ? 'digitale' : /cartace/i.test(testo(v)) ? 'cartaceo' : null);

/**
 * Controlli di una dichiarazione rispetto ai suoi PDR.
 * Restituisce una lista di { tipo, livello, testo }: livello 'aggiornare' se la
 * dichiarazione non corrisponde piu' al portale, 'verificare' se qualcosa va
 * guardato, 'collegare' se manca il PDR.
 */
export function controlliDichiarazione(d, pdr, oggi = new Date().toISOString().slice(0, 10)) {
  const esiti = [];
  const conDato = pdr.filter(p => iscrittoPortale(p.rentri_iscrizione) !== null);
  const iscrittiPortale = conDato.filter(p => iscrittoPortale(p.rentri_iscrizione) === true);

  if (!pdr.length) {
    esiti.push({ tipo: 'da_collegare', livello: 'collegare', testo: 'Nessun PDR collegato: i dati del portale non si possono confrontare.' });
  } else if (d.collegamento === 'simile') {
    esiti.push({ tipo: 'da_confermare', livello: 'collegare', testo: 'PDR trovato con un nome simile: conferma che sia il produttore giusto.' });
  }

  if (pdr.length && !conDato.length) {
    esiti.push({ tipo: 'portale_senza_dato', livello: 'info', testo: "Nel portale l'iscrizione al RENTRI di questo punto non è indicata (?): non c'è niente da confrontare." });
  }
  if (conDato.length) {
    if (!d.iscritto_rentri && iscrittiPortale.length) {
      esiti.push({ tipo: 'iscritto_nel_portale', livello: 'aggiornare', testo: 'Nel portale risulta iscritto al RENTRI, nella dichiarazione no: la dichiarazione va aggiornata.' });
    }
    if (d.iscritto_rentri && !iscrittiPortale.length) {
      esiti.push({ tipo: 'non_iscritto_nel_portale', livello: 'aggiornare', testo: 'Nella dichiarazione è iscritto al RENTRI, nel portale no.' });
    }
  }

  const formulari = new Set(pdr.map(p => formularioPortale(p.tipo_formulario)).filter(Boolean));
  if (formulari.size) {
    if (d.fir_digitale && !d.fir_cartaceo && !formulari.has('digitale')) {
      esiti.push({ tipo: 'formulario_diverso', livello: 'aggiornare', testo: 'Dichiara il FIR digitale, nel portale il formulario è cartaceo.' });
    }
    if (d.fir_cartaceo && !d.fir_digitale && !formulari.has('cartaceo')) {
      esiti.push({ tipo: 'formulario_diverso', livello: 'aggiornare', testo: 'Dichiara il FIR cartaceo, nel portale il formulario è digitale.' });
    }
  }

  const codiciPortale = new Set(pdr.map(p => testo(p.rentri_id_ul).toUpperCase()).filter(c => c && !eCodiceEsempio(c)));
  if (d.codice_rentri && codiciPortale.size && !codiciPortale.has(d.codice_rentri)) {
    esiti.push({ tipo: 'codice_diverso', livello: 'aggiornare', testo: `Il codice RENTRI della nota (${d.codice_rentri}) non è quello del portale (${[...codiciPortale].join(', ')}).` });
  }

  if (d.fir_cartaceo && !d.fir_digitale && obbligoIndicatoNellaNota(d.nota) && oggi >= FIR_DIGITALE_OBBLIGATORIO_DAL) {
    esiti.push({ tipo: 'obbligato_cartaceo', livello: 'verificare', testo: "La nota indica l'iscrizione obbligatoria (10 dipendenti o più) ma la dichiarazione è con FIR cartaceo: per chi è obbligato il FIR è digitale dal 16/09/2026." });
  }
  if (pdr.some(p => eCodiceEsempio(p.rentri_id_ul))) {
    esiti.push({ tipo: 'codice_esempio', livello: 'info', testo: "Nel portale l'ID dell'unità locale è ancora il codice d'esempio: il produttore non ha inserito il suo." });
  }
  if (!d.fir_digitale && !d.fir_cartaceo) {
    esiti.push({ tipo: 'formulario_mancante', livello: 'verificare', testo: 'La dichiarazione non indica né FIR digitale né cartaceo.' });
  }
  if (d.doppia) {
    esiti.push({ tipo: 'doppia', livello: 'verificare', testo: 'Il produttore compare più di una volta nel foglio: qui vale la prima riga.' });
  }
  return esiti;
}

export const LIVELLI_CONTROLLO = {
  aggiornare: { nome: 'Da aggiornare', classe: 'bg-red-50 text-red-800 border-red-200' },
  verificare: { nome: 'Da verificare', classe: 'bg-amber-50 text-amber-800 border-amber-200' },
  collegare: { nome: 'Da collegare', classe: 'bg-slate-100 text-slate-700 border-slate-300' },
  info: { nome: 'Nessun dato nel portale', classe: 'bg-white text-muted-foreground border-slate-200' },
};

/** Le segnalazioni vere, senza le sole informazioni. */
export const segnalazioni = (controlli) => controlli.filter(c => c.livello !== 'info');

/** Impronta delle segnalazioni: la verifica vale finche' resta la stessa. */
export const impronta = (controlli) => [...new Set(segnalazioni(controlli).map(c => c.tipo))].sort().join('|');

/** true se la dichiarazione e' stata verificata con le segnalazioni di adesso. */
export const verificaValida = (d, controlli) => !!d.verificata_il && (d.verifica_impronta || '') === impronta(controlli);
