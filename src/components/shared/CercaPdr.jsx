import React from 'react';
import { MapPin, X } from 'lucide-react';
import { formatIntero } from '@/lib/utils';

// RICERCA PER PUNTO DI RACCOLTA (richiesta dell'utente del 12/10/2026, testuale:
// «nei terminati rete serve un campo ricerca per pdr»).
//
// Si cerca come il portale scrive l'ordine: il codice del PDR (id_pdr, lo stesso
// numero dell'anagrafica del modulo PDR, che lega ordini e punti per id_pdr), o
// il nome, cioe' il punto di raccolta («Eurogomme di Greco Giuseppe - Nemoli») o
// la ragione sociale del produttore («Eurogomme di Greco Giuseppe»). Maiuscole,
// spazi, accenti e punteggiatura non contano: «s.r.l.» trova «SRL», e
// «eurogomme nemoli» trova il punto di Nemoli, perche' ogni parola cercata deve
// esserci, in qualunque ordine.
//
// Un numero da solo («315», o «PDR 315») e' il codice del punto e vale uguale,
// non contenuto: i codici vanno da poche cifre a cinque, e «31» dentro 315, 1310
// e 23100 darebbe gli ordini di tre punti diversi. L'ID ordine invece si cerca
// anche a pezzi (CercaIdOrdine), perche' e' lungo e nessun pezzo e' un altro ID.

const normalizza = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const parole = (testo) => String(testo || '').split(/\s+/).map(normalizza).filter(Boolean);
const CODICE = /^\s*(?:pdr\s*)?(\d+)\s*$/i;

/** Il codice PDR cercato, se il testo e' solo un numero (anche «PDR 315»), altrimenti null. */
export function codicePdrCercato(testo) {
  const m = String(testo || '').match(CODICE);
  return m ? Number(m[1]) : null;
}

/** Vero se nel testo c'e' qualcosa da cercare (spazi e punteggiatura da soli non cercano niente). */
export const cercaPdrAttiva = (testo) => codicePdrCercato(testo) !== null || parole(testo).length > 0;

// A ogni tasto si filtra tutto l'archivio (10.487 ordini l'11/10/2026): il testo
// cercato si legge una volta per tasto, non una per ordine, e i nomi di un ordine
// si normalizzano una volta sola. Misurato sui dati veri: da 20-36 ms a tasto a
// pochi millisecondi dal secondo tasto in poi.
let ultimaRicerca = { testo: null, codice: null, cercate: [] };
const ricerca = (testo) => {
  if (ultimaRicerca.testo !== testo) ultimaRicerca = { testo, codice: codicePdrCercato(testo), cercate: parole(testo) };
  return ultimaRicerca;
};
const nomiNormalizzati = new WeakMap();
// I due nomi separati da un segno che nessuna parola cercata contiene: una
// parola non si trova a cavallo fra il punto di raccolta e la ragione sociale.
const nomiDi = (record) => {
  if (!record || typeof record !== 'object') return `${normalizza(null)}|${normalizza(null)}`;
  let n = nomiNormalizzati.get(record);
  if (n === undefined) { n = `${normalizza(record.punto_di_raccolta)}|${normalizza(record.ragione_sociale)}`; nomiNormalizzati.set(record, n); }
  return n;
};

/** Vero se l'ordine e' del punto di raccolta cercato: per codice (uguale) o per nome (tutte le parole). */
export function corrispondePdr(record, testo) {
  const { codice, cercate } = ricerca(testo);
  if (codice !== null) return record?.id_pdr != null && record.id_pdr !== '' && Number(record.id_pdr) === codice;
  if (!cercate.length) return true;
  const nomi = nomiDi(record);
  return cercate.every(p => nomi.includes(p));
}

/**
 * I punti di raccolta degli ordini trovati, uno per codice PDR, col numero di
 * ordini: il nome della ditta da solo non basta a distinguerli («MASTRIA GOMME
 * SRL» ha due punti, viale Pio X e viale Europa).
 */
export function puntiDiRaccolta(records) {
  const perCodice = new Map();
  for (const r of records || []) {
    const chiave = r.id_pdr != null && r.id_pdr !== '' ? `#${r.id_pdr}` : `@${normalizza(r.punto_di_raccolta || r.ragione_sociale)}`;
    const p = perCodice.get(chiave);
    if (p) { p.ordini++; continue; }
    perCodice.set(chiave, {
      id_pdr: r.id_pdr != null && r.id_pdr !== '' ? r.id_pdr : null,
      nome: (r.punto_di_raccolta || r.ragione_sociale || '').trim(),
      ragione_sociale: (r.ragione_sociale || '').trim(),
      comune: (r.comune || '').trim(),
      provincia: (r.provincia || '').trim(),
      ordini: 1,
    });
  }
  return [...perCodice.values()].sort((a, b) => b.ordini - a.ordini || a.nome.localeCompare(b.nome, 'it'));
}

const ordini = (n) => `${formatIntero(n)} ${n === 1 ? 'ordine' : 'ordini'}`;
const PUNTI_MOSTRATI = 8;

/**
 * Il campo di ricerca per punto di raccolta, accanto a quello per ID ordine.
 * trovati: gli ordini mostrati (null mentre l'archivio si legge); inArchivio:
 * quanti ne ha il punto in tutto l'archivio, quando i filtri ne tolgono qualcuno
 * (null altrimenti); conIdOrdine: c'e' anche una ricerca per ID, e i trovati
 * sono quelli che rispondono a tutte e due; punti: puntiDiRaccolta dei trovati.
 */
export default function CercaPdr({ value, onChange, trovati = null, inArchivio = null, conFiltri = false, conIdOrdine = false, punti = [], className = '' }) {
  const attiva = cercaPdrAttiva(value);
  const dove = conIdOrdine ? "insieme all'ID ordine, in tutto l'archivio" : conFiltri ? 'con i filtri scelti' : "in tutto l'archivio";
  const altri = punti.length - PUNTI_MOSTRATI;
  return (
    <div className={`flex flex-col gap-1.5 w-full sm:w-auto min-w-0 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Cerca PDR: codice o nome (es. 315)"
            aria-label="Cerca punto di raccolta per codice PDR o nome"
            title="Il codice del punto di raccolta (lo stesso del modulo PDR) o il suo nome, come lo scrive il portale: punto di raccolta o ragione sociale. Maiuscole e spazi non contano."
            className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-9 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600/30 focus:border-sky-700 [&::-webkit-search-cancel-button]:hidden"
          />
          {value && (
            <button type="button" onClick={() => onChange('')} title="Cancella la ricerca" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {attiva && trovati !== null && (
          <span className="text-xs text-slate-600">
            {trovati === 0 ? 'Nessun ordine trovato' : `${ordini(trovati)} ${trovati === 1 ? 'trovato' : 'trovati'}`} {dove}
            {inArchivio !== null && inArchivio !== trovati && <> · {ordini(inArchivio)} in tutto l&apos;archivio</>}
          </span>
        )}
      </div>
      {attiva && trovati !== null && punti.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs min-w-0">
          <span className="text-slate-600">{punti.length === 1 ? 'Punto di raccolta:' : `In ${formatIntero(punti.length)} punti di raccolta:`}</span>
          {punti.slice(0, PUNTI_MOSTRATI).map(p => {
            const luogo = [p.comune, p.provincia ? `(${p.provincia})` : ''].filter(Boolean).join(' ');
            const titolo = [p.id_pdr != null ? `PDR ${p.id_pdr}` : 'senza codice PDR', p.nome, p.ragione_sociale !== p.nome ? p.ragione_sociale : '', luogo].filter(Boolean).join(' · ');
            const testo = (
              <>
                {p.id_pdr != null && <span className="font-medium tabular-nums">{p.id_pdr}</span>}
                <span className="truncate">{p.nome || '—'}</span>
                {punti.length > 1 && <span className="text-slate-500 tabular-nums shrink-0">{formatIntero(p.ordini)}</span>}
              </>
            );
            // Con piu' punti si sceglie quello giusto: il clic cerca il suo codice.
            return punti.length > 1 && p.id_pdr != null ? (
              <button key={`${p.id_pdr}-${p.nome}`} type="button" onClick={() => onChange(String(p.id_pdr))} title={`${titolo}\nSolo gli ordini di questo punto`}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-100">
                {testo}
              </button>
            ) : (
              <span key={`${p.id_pdr}-${p.nome}`} title={titolo} className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5">
                {testo}
                {luogo && <span className="text-slate-500 shrink-0">{luogo}</span>}
              </span>
            );
          })}
          {altri > 0 && <span className="text-slate-500">e altri {formatIntero(altri)}</span>}
        </div>
      )}
    </div>
  );
}
