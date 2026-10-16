import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import SortHeader from '@/components/shared/SortHeader';
import { formatNumber } from '@/lib/utils';
import { eTerminato, giornoMovimento, giornoOrdine, meseOrdine, tempiRaccolta, dateIncoerenti, testoDate } from '@/lib/movimenti';
import { dataPortaleIt } from '@/lib/giornoItaliano';
import { SegnoDate } from '@/components/primarie-rete/DateDaSistemare';

// LA COLONNA PDR (13/10/2026). La ragione sociale da sola non distingue due
// punti di raccolta della stessa ditta: MASTRIA GOMME SRL ha viale Pio X e
// viale Europa, e nell'archivio dell'11/10/2026 le ditte con piu' punti sono 71.
// La colonna dice il codice del punto (id_pdr, la chiave del modulo PDR e della
// ricerca qui sopra) e il suo nome come lo scrive il portale. Il codice viene
// prima e non si taglia, anche a 375 px; il nome si tronca come la ragione
// sociale. Si ordina per codice, come numero.
const COLUMNS = [
  { key: 'id_ordine', label: 'ID Ordine' },
  { key: 'ragione_sociale', label: 'Ragione Sociale' },
  { key: 'pdr', label: 'PDR', format: 'pdr' },
  { key: 'provincia', label: 'Prov.' },
  { key: 'regione', label: 'Regione' },
  { key: 'destinazione', label: 'Destinazione' },
  { key: 'classe', label: 'Classe' },
  { key: 'quantita_richiesta', label: 'Q.Rich', format: 'number' },
  { key: 'quantita_ritirata', label: 'Q.Ritir', format: 'number' },
  { key: 'peso_effettivo', label: 'Kg', format: 'number' },
  { key: 'mese', label: 'Mese' },
  { key: 'trasportatore', label: 'Trasportatore' },
  { key: 'fine_trasporto', label: 'Fine trasporto', format: 'date' },
  { key: 'nr_giorni', label: 'Giorni', format: 'number' },
  { key: 'raccolta_nei_tempi', label: 'Tempi' },
  { key: 'stato', label: 'Stato' },
  // la chiusura a portale si mostra soltanto: non ordina e non misura niente
  { key: 'ordine_chiuso_il', label: 'Chiuso il', format: 'date' },
];

// Le date si mostrano 'GG/MM/AAAA' con dataPortaleIt: il giorno scritto nel file
// del portale (difetto 9, 16/10/2026). La chiusura e' l'ora italiana del
// portale salvata con la Z, e letta col fuso italiano (giornoRoma, com'era qui)
// una chiusura dopo le 22 d'estate o dopo le 23 d'inverno usciva col giorno
// dopo. La fine del trasporto qui e' gia' un giorno (giornoMovimento).

// Il codice del punto di raccolta, come numero; null se l'ordine non lo porta
// (allora la cella dice «—», non 0). E' un codice, non una quantita': si scrive
// senza il punto delle migliaia (42872, non 42.872).
const codicePdr = (r) => {
  if (r.id_pdr == null || String(r.id_pdr).trim() === '') return null;
  const n = Number(r.id_pdr);
  return Number.isFinite(n) ? n : null;
};

// Ragione sociale, punto di raccolta e destinazione si troncano alla stessa
// larghezza (la cella del PDR ha la sua resa, con la stessa classe).
const TRONCA = 'truncate max-w-[200px]';
const TRONCATE = new Set(['ragione_sociale', 'destinazione']);

// Le segnalazioni della colonna Tempi, in ambra: un terminato che non si puo'
// misurare lo dice, invece di restare vuoto come un ordine ancora aperto.
const SENZA_FINE = 'MANCA FINE TRASPORTO';
const SENZA_IMMISSIONE = 'MANCA IMMISSIONE';
const DATE_INCOERENTI = 'DATE INCOERENTI';
const SEGNALAZIONI = new Set([SENZA_FINE, SENZA_IMMISSIONE, DATE_INCOERENTI]);

// Non e' una segnalazione: l'ordine e' stato registrato a portale dopo il ritiro
// e non c'e' un tempo da misurare. Si dice in grigio, non in ambra, e non c'e'
// niente da correggere nel formulario.
const IMMISSIONE_DOPO_RITIRO = 'IMMESSO DOPO IL RITIRO';
const NOTA_IMMISSIONE_DOPO = "l'ordine è stato registrato a portale dopo il ritiro: non si misura";

// Come computeSlaMetrics (primarieReteAnalytics.ts): un terminato con le date
// incoerenti non si misura. L'unica incoerenza e' una fine trasporto prima
// dell'inizio; un ritiro finito prima dell'immissione non e' un errore, ma non
// si misura nemmeno lui - contarlo zero giorni e "OK" avrebbe detto un tempo che
// nessuno ha misurato (movimenti.js, 22/09/2026).
const incoerente = (r) => dateIncoerenti(r).length > 0;

function esitoTempi(r, tempi, fine) {
  if (eTerminato(r) && fine && incoerente(r)) return DATE_INCOERENTI;
  if (tempi && tempi.prima_dell_immissione) return IMMISSIONE_DOPO_RITIRO;
  if (tempi && tempi.esito) return tempi.esito;
  if (!eTerminato(r)) return null;
  if (!fine) return SENZA_FINE;
  return tempi ? null : SENZA_IMMISSIONE;
}

export default function PrimarieReteTable({ records, loading }) {
  // Mese, giorni e tempi si ricalcolano dalla fine del trasporto (movimenti.js)
  // invece di leggere i campi salvati: nr_giorni e raccolta_nei_tempi venivano
  // dalla chiusura a portale, e un archivio caricato prima della correzione li
  // porta ancora. Un terminato senza fine trasporto non si misura e si segnala,
  // e non ha nemmeno un mese: giornoOrdine e meseOrdine ripiegherebbero
  // sull'immissione, e la colonna Mese direbbe il mese dell'ordine mentre la
  // colonna Tempi dice che il ritiro non ha una data.
  //
  // Immissione, inizio e fine trasporto sono obbligatorie in ogni formulario
  // terminato (regola dell'utente, 22/09/2026): la riga che ne ha una che manca
  // o non torna ha il segno accanto all'ID, con il testo di testoDate nel title.
  const righe = useMemo(() => records.map((r) => {
    const tempi = tempiRaccolta(r);
    const fine = giornoMovimento(r);
    const senzaPeriodo = eTerminato(r) && !fine;
    const nonMisurato = eTerminato(r) && (incoerente(r) || !!(tempi && tempi.prima_dell_immissione));
    return {
      ...r,
      pdr: codicePdr(r),
      pdr_nome: String(r.punto_di_raccolta || '').trim(),
      giorno_ordine: senzaPeriodo ? null : giornoOrdine(r) || null,
      fine_trasporto: fine || null,
      mese: senzaPeriodo ? null : meseOrdine(r),
      nr_giorni: !nonMisurato && tempi && tempi.giorni != null ? tempi.giorni : null,
      raccolta_nei_tempi: esitoTempi(r, tempi, fine),
      date_da_sistemare: testoDate(r),
    };
  }), [records]);
  // I 500 mostrati sono gli ultimi per fine trasporto (l'immissione per un ordine
  // non terminato): ordinati per chiusura, un ritiro di ieri non ancora chiuso a
  // portale finiva in fondo e poteva non comparire. I terminati senza fine
  // trasporto non hanno giorno e nell'ordine decrescente stanno in cima.
  const sorted = useTableSort(righe, 'giorno_ordine', 'desc');

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento record...</div>;
  }

  if (records.length === 0) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Nessun record trovato per i filtri selezionati.</div>;
  }

  return (
    <div className="border rounded-lg overflow-x-auto max-h-[600px]">
      <table className="w-full text-xs">
        <thead className="bg-muted sticky top-0">
          <tr>
            {COLUMNS.map((col) => (
              <SortHeader key={col.key} col={col} sortKey={sorted.sortKey} sortDir={sorted.sortDir} onSort={sorted.toggleSort} className="px-2 py-2 text-xs" />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.sorted.slice(0, 500).map((r, i) => (
            <tr key={r.id} className={`border-t hover:bg-muted/30 ${r.date_da_sistemare ? 'bg-amber-50/60' : i % 2 ? 'bg-muted/10' : ''}`}>
              {COLUMNS.map((col) => {
                if (col.format === 'pdr') {
                  return (
                    <td key={col.key} title={[r.pdr != null ? `PDR ${r.pdr}` : 'senza codice PDR', r.pdr_nome].filter(Boolean).join(' · ')} className={`px-2 py-1.5 whitespace-nowrap ${TRONCA}`}>
                      <span className="font-medium tabular-nums">{r.pdr != null ? String(r.pdr) : '—'}</span>
                      {r.pdr_nome && <span className="text-muted-foreground"> · {r.pdr_nome}</span>}
                    </td>
                  );
                }
                let val = r[col.key];
                if (col.format === 'number') val = val != null ? formatNumber(val, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '';
                else if (col.format === 'date') val = dataPortaleIt(val);
                const isTempi = col.key === 'raccolta_nei_tempi';
                return (
                  <td
                    key={col.key}
                    title={isTempi && val === IMMISSIONE_DOPO_RITIRO ? NOTA_IMMISSIONE_DOPO : (isTempi && SEGNALAZIONI.has(val) && r.date_da_sistemare ? r.date_da_sistemare : undefined)}
                    className={`px-2 py-1.5 whitespace-nowrap ${col.format === 'number' ? 'text-right' : ''} ${TRONCATE.has(col.key) ? TRONCA : ''} ${isTempi && val === 'DOPO SCADENZA' ? 'text-red-600 font-medium' : ''} ${isTempi && val === 'OK' ? 'text-green-600 font-medium' : ''} ${isTempi && SEGNALAZIONI.has(val) ? 'text-amber-600 font-medium' : ''} ${isTempi && val === IMMISSIONE_DOPO_RITIRO ? 'text-muted-foreground' : ''}`}
                  >
                    {col.key === 'id_ordine' && <SegnoDate testo={r.date_da_sistemare} />}
                    {val ?? ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.sorted.length > 500 && <p className="text-xs text-muted-foreground p-2">Mostrati primi 500 di {formatNumber(sorted.sorted.length, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} record{sorted.sortKey === 'giorno_ordine' && sorted.sortDir === 'desc' ? ', i più recenti per fine trasporto (per un ordine non terminato, per immissione; i terminati senza fine trasporto in cima)' : ''}.</p>}
    </div>
  );
}
