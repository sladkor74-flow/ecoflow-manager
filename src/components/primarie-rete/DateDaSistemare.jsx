import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { DATE_OBBLIGATORIE, testoDate, ordiniDaSistemare, mancantiOrdine, incoerentiOrdine, testoOrdine, ordineSenzaFine } from '@/lib/movimenti';
import { formatIntero } from '@/lib/utils';

// Le date obbligatorie di un formulario terminato - immissione, inizio e fine
// trasporto - negli elenchi e nei conti dei movimenti. Regola dell'utente del
// 22/09/2026: se mancano vanno segnalate, e vale dovunque ci siano ordini
// terminati, non solo nei report settimanali. Anche le date nell'ordine sbagliato
// si segnalano. La regola sta in src/lib/movimenti.js (dateMancanti,
// dateIncoerenti, dateDaSistemare, testoDate) e non si riscrive: qui c'e' solo
// come si mostra, uguale in ogni modulo.
//
// Quanti sono si conta in ORDINI distinti, come negli altri moduli, mai in
// righe: un ordine puo' averne piu' d'una. E il numero dice sempre di che cosa
// parla, perche' le pagine passano insieme gli ordini del periodo scelto e i
// terminati senza fine trasporto di qualunque anno, che nessun filtro di periodo
// prende: le due quote si scrivono separate.
//
// - SegnoDate: il segno sulla riga, col testo di testoDate nel title;
// - AvvisoDateDaSistemare: l'avviso in testa a un elenco, con quanti ordini sono
//   e di che periodo, quali date mancano, l'elenco e il pulsante del filtro;
// - RiepilogoDate: una riga, di un canale, col riepilogo che le funzioni
//   restituiscono in date_da_sistemare (riepilogoDate di raccoltoCalculator.ts):
//   anche quel conto e' di ordini distinti, e il perimetro lo sa la funzione che
//   lo manda; qui si mostra e basta;
// - NotaDate: una nota in linea accanto a un'esportazione, per le righe che
//   finiscono nel file.
//
// Sta con gli elenchi delle primarie, dove e' nata; la usano anche secondarie,
// terziarie, extra raccolta, dashboard e verifiche.

/** Il segno di una riga con le date da sistemare. Niente se sono a posto. */
export function SegnoDate({ record, testo }) {
  const t = testo !== undefined ? testo : testoDate(record);
  if (!t) return null;
  return (
    <span title={`Date da sistemare: ${t}`} aria-label={`Date da sistemare: ${t}`} className="inline-flex align-middle mr-1 text-amber-600">
      <AlertTriangle className="w-3.5 h-3.5" />
    </span>
  );
}

// Gli ORDINI con le date da sistemare, non le righe, e che cosa c'e' da
// sistemare in ciascuno: la regola sta in src/lib/movimenti.js
// (ordiniDaSistemare, mancantiOrdine, incoerentiOrdine, testoOrdine,
// ordineSenzaFine), la stessa che contano le funzioni. Era scritta qui e i
// conti dei moduli contavano righe: per lo stesso insieme uscivano due numeri
// diversi.

// Il dettaglio a parole, come il testo di riepilogoDate nelle funzioni:
// "3 senza fine trasporto, 1 con date incoerenti". Conta ordini: a un ordine a
// cui mancano due date conta in tutte e due le voci, una volta sola anche se le
// sue righe sono piu' d'una.
function dettaglioDate(ordini) {
  const mancanti = Object.fromEntries(DATE_OBBLIGATORIE.map(d => [d.nome, 0]));
  let incoerenti = 0;
  for (const o of ordini) {
    for (const nome of mancantiOrdine(o)) mancanti[nome] = (mancanti[nome] || 0) + 1;
    if (incoerentiOrdine(o).length) incoerenti++;
  }
  const parti = DATE_OBBLIGATORIE.filter(d => mancanti[d.nome] > 0).map(d => `${formatIntero(mancanti[d.nome])} senza ${d.nome}`);
  if (incoerenti) parti.push(`${formatIntero(incoerenti)} con date incoerenti`);
  return parti.join(', ');
}

/**
 * Di che cosa parla il numero in testa all'avviso. Le pagine passano gli ordini
 * del periodo scelto PIU' i terminati senza fine trasporto di qualunque anno,
 * che nessun filtro di periodo prende: sommarli senza dirlo faceva leggere "446
 * segnalati" a chi nel 2026 ne vedeva 200. Le due quote si dicono separate.
 */
function perimetroDate(senzaFine, nelPeriodo) {
  if (senzaFine && nelPeriodo) {
    return `${formatIntero(senzaFine)} senza fine trasporto, di qualunque anno e fuori da ogni filtro di periodo, e ${formatIntero(nelPeriodo)} fra quelli che l'elenco mostra`;
  }
  if (senzaFine) return `tutti senza fine trasporto, di qualunque anno e fuori da ogni filtro di periodo`;
  return '';
}

/**
 * I numeri dell'avviso, in un punto solo (e quello che le prove controllano:
 * prove/dateDaSistemareAvvisi.mjs): quanti ordini distinti, quanti senza fine
 * trasporto e quanti fra quelli che l'elenco mostra, il perimetro e il dettaglio
 * a parole. Un numero solo per ogni cosa, cosi' testo ed elenco non possono
 * dirne due diversi.
 */
export function riepilogoAvviso(righe) {
  const ordini = ordiniDaSistemare(righe);
  const senzaFine = ordini.filter(ordineSenzaFine).length;
  const nelPeriodo = ordini.length - senzaFine;
  return {
    ordini,
    quanti: ordini.length,
    senza_fine_trasporto: senzaFine,
    nel_periodo: nelPeriodo,
    perimetro: perimetroDate(senzaFine, nelPeriodo),
    dettaglio: dettaglioDate(ordini),
  };
}

const NOTA_PORTALE = 'Vanno corrette nel file del portale e ricaricate.';
const MOSTRATI = 50;

/**
 * L'avviso in testa a un elenco. righe: gli ordini che l'elenco mostra o potrebbe
 * mostrare (si tengono i terminati con le date da sistemare); canale: di chi
 * sono ('Rete', 'ACI', ...), un canale solo; nomi: [singolare, plurale];
 * nota: cosa succede nella pagina a chi non ha la fine trasporto; correzione:
 * dove si correggono; attivo / onFiltra: il filtro "date da sistemare".
 *
 * Il numero e' di ORDINI distinti, non di righe, e dice sempre di che cosa parla:
 * quanti senza fine trasporto, che sono di qualunque anno, e quanti fra quelli
 * che i filtri dell'elenco mostrano.
 */
export default function AvvisoDateDaSistemare({ righe, canale, nomi = ['ordine terminato', 'ordini terminati'], nota, correzione = NOTA_PORTALE, attivo = false, onFiltra }) {
  const { ordini: daSistemare, quanti: n, perimetro, dettaglio } = riepilogoAvviso(righe);
  if (!n && !attivo) return null;
  const filtro = onFiltra && (
    <button type="button" onClick={() => onFiltra(!attivo)} className="text-primary hover:underline font-medium whitespace-nowrap">
      {attivo ? 'Mostra tutti' : n === 1 ? 'Mostra solo questo' : 'Mostra solo questi'}
    </button>
  );
  if (!n) {
    return (
      <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm flex flex-wrap items-center gap-2">
        <span>{canale ? `${canale}: n` : 'N'}essun {nomi[0]} con date da sistemare per questi filtri.</span>
        {filtro}
      </div>
    );
  }
  return (
    <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm space-y-1">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <p className="flex-1">
          <strong>{canale ? `${canale} · ` : ''}{formatIntero(n)} {n === 1 ? nomi[0] : nomi[1]} con date da sistemare</strong>
          {perimetro ? ` (${perimetro})` : ''}: {dettaglio}.
          {' '}Immissione, inizio e fine trasporto sono obbligatorie in ogni formulario.
          {nota ? ` ${nota}` : ''}{correzione ? ` ${correzione}` : ''}
        </p>
        {filtro}
      </div>
      <details className="pl-6 text-xs">
        <summary className="cursor-pointer select-none">Quali sono{n > MOSTRATI ? ` (i primi ${MOSTRATI})` : ''}</summary>
        <ul className="mt-1 space-y-0.5">
          {daSistemare.slice(0, MOSTRATI).map((o, i) => {
            const r = o.righe[0];
            const testo = testoOrdine(o);
            return (
              <li key={`${o.chiave}|${i}`} title={testo}>
                <span className="font-mono">{r.id_ordine || r.numero_fir || 'senza ID'}</span>
                {r.id_ordine && r.numero_fir ? <> · FIR <span className="font-mono">{r.numero_fir}</span></> : null}
                {o.righe.length > 1 ? ` · ${formatIntero(o.righe.length)} righe` : ''}
                {' · '}{testo}
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}

/**
 * Una nota in linea, accanto ai pulsanti di un'esportazione: quanti degli ordini
 * che vanno nel file hanno le date da sistemare, e quali date, con l'elenco nel
 * title. Niente se sono tutti a posto. righe: le righe esportate; nomi:
 * [singolare, plurale]. Nasce per l'Extra Raccolta (22/09/2026): chi esporta la
 * fatturazione deve saperlo prima di mandare il file, qualunque cosa il file
 * mostri. Come l'avviso, conta ordini distinti, non righe.
 */
export function NotaDate({ righe, nomi = ['ordine esportato', 'ordini esportati'], className = '' }) {
  const daSistemare = ordiniDaSistemare(righe);
  const n = daSistemare.length;
  if (!n) return null;
  const chi = (r) => [r.id_ordine, r.numero_fir ? `FIR ${r.numero_fir}` : ''].filter(Boolean).join(' · ') || 'senza ID';
  const elenco = daSistemare.slice(0, MOSTRATI).map(o => `${chi(o.righe[0])}: ${testoOrdine(o)}`);
  if (n > MOSTRATI) elenco.push(`e altri ${formatIntero(n - MOSTRATI)}`);
  return (
    <span className={`inline-flex items-start gap-1 text-xs text-amber-800 ${className}`} title={elenco.join('\n')}>
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span>{formatIntero(n)} {n === 1 ? nomi[0] : nomi[1]} con date da sistemare ({dettaglioDate(daSistemare)}).</span>
    </span>
  );
}

// Che cosa succede nei conti a chi ha le date da sistemare: chi non ha la fine
// trasporto non ha un mese ed e' escluso; gli altri sono contati nel mese della
// fine trasporto, ma vanno corretti lo stesso.
function effettoSuiConti(riep) {
  const sf = Number(riep.senza_fine_trasporto) || 0;
  const altri = Math.max(0, (Number(riep.totale) || 0) - sf);
  const esclusi = sf ? `${formatIntero(sf)} ${sf === 1 ? 'escluso' : 'esclusi'} da ogni mese perché senza fine trasporto` : '';
  const contati = altri ? `${formatIntero(altri)} ${altri === 1 ? 'contato' : 'contati'} nel mese della fine trasporto` : '';
  return [esclusi, contati].filter(Boolean).join(', ');
}

/**
 * Una riga di riepilogo, di un canale, dal date_da_sistemare di una funzione.
 * Niente se il riepilogo manca o e' a zero. effetto: dire chi e' escluso dai
 * conti e chi no (di serie); esempi: mostrare gli ordini che la funzione elenca;
 * attivo / onFiltra: il filtro "date da sistemare" della pagina, se ce l'ha.
 */
export function RiepilogoDate({ canale, riepilogo, nomi = ['ordine terminato', 'ordini terminati'], effetto = true, esempi = false, nota, attivo = false, onFiltra, className = '' }) {
  if (!riepilogo || !(Number(riepilogo.totale) > 0)) return null;
  const n = Number(riepilogo.totale);
  const conti = effetto ? effettoSuiConti(riepilogo) : '';
  const elenco = esempi && Array.isArray(riepilogo.esempi) ? riepilogo.esempi : [];
  return (
    <div className={`text-xs text-amber-800 ${className}`}>
      <p className="flex items-start gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          {canale ? `${canale}: ` : ''}{formatIntero(n)} {n === 1 ? nomi[0] : nomi[1]} con date da sistemare{riepilogo.testo ? ` (${riepilogo.testo})` : ''}{conti ? `: ${conti}` : ''}.
          {nota ? ` ${nota}` : ''}
          {onFiltra && (
            <button type="button" onClick={() => onFiltra(!attivo)} className="ml-1.5 text-primary hover:underline font-medium">
              {attivo ? 'Mostra tutti' : n === 1 ? 'Mostra solo questo' : 'Mostra solo questi'}
            </button>
          )}
        </span>
      </p>
      {elenco.length > 0 && (
        <details className="pl-5">
          <summary className="cursor-pointer select-none">Quali sono{n > elenco.length ? ` (i primi ${elenco.length})` : ''}</summary>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {elenco.map((o, i) => (
              <li key={`${o.id_ordine}|${i}`} title={o.testo}>
                <span className="font-mono">{o.id_ordine || o.numero_fir || 'senza ID'}</span>
                {o.id_ordine && o.numero_fir ? <> · FIR <span className="font-mono">{o.numero_fir}</span></> : null}
                {/* quante righe dell'archivio stanno dietro a quest'unico ordine */}
                {o.righe > 1 ? ` · ${formatIntero(o.righe)} righe` : ''}
                {o.stoccaggio || o.destinazione ? <> · {o.stoccaggio || 'N/D'} → {o.destinazione || 'N/D'}</> : null}
                {' · '}{o.testo}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
