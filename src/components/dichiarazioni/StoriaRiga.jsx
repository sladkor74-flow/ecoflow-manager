import React from 'react';
import { BookOpen, Info } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { formatTonnellate } from '@/lib/utils';
import { MESI } from '@/lib/dichiarazioniImpianti';
import { casellaDaSpiegare, percheCasella, percheFineMese, fineMeseDaSpiegare } from '@/lib/storiaRiepilogo';

// LA STORIA DI UNA RIGA, AL TOCCO (12/10/2026).
//
// Richiesta dell'utente sul Riepilogo, dopo il caso T-Cycle: «rendi visibile il
// quadro della situazione anche a chi, diversamente da me, vede per la prima
// volta questo gestionale e deve comprenderne la storia, le movimentazioni e i
// perche' sottesi». Qui i pezzi che lo fanno: il racconto della riga, la «i»
// nell'angolo della casella che dice quali mesi una dichiarazione ha coperto, la
// riga della giacenza a fine mese e le righe dello stoccaggio dello stesso sito.
// Tutto al tocco (non title=, che su iPhone e iPad non si vede), tutto scritto
// dai numeri che arrivano dal riepilogo, e niente di questo entra nei totali.

const tonnellate = (kg) => formatTonnellate((Number(kg) || 0) / 1000);

// Il riquadro che si apre al tocco: largo quanto lo schermo lo consente, e se il
// testo e' lungo scorre invece di uscire dalla pagina (a 375 px il racconto di
// Irigom e' una ventina di righe).
function Riquadro({ children }) {
  return (
    <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto text-xs leading-relaxed space-y-1.5">
      {children}
    </PopoverContent>
  );
}

/** Il racconto della riga, dietro un pulsante «storia» accanto al nome. */
export function RaccontoRiga({ frasi, titolo }) {
  if (!frasi || !frasi.length) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`La storia di ${titolo} nell'anno`}
          className="ml-1 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[10px] leading-4 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring align-middle">
          <BookOpen className="w-3 h-3" aria-hidden="true" /> storia
        </button>
      </PopoverTrigger>
      <Riquadro>
        <p className="font-semibold">{titolo}</p>
        {frasi.map((f, i) => <p key={i}>{f}</p>)}
        <p className="text-muted-foreground">Scritto dai numeri della pagina. Le righe informative sotto la riga non entrano nei totali.</p>
      </Riquadro>
    </Popover>
  );
}

/**
 * LA «i» NELL'ANGOLO DELLA CASELLA: quali mesi ha coperto la dichiarazione di
 * quel mese e chi ha coperto quel mese («20,62 t di marzo coperte dalla
 * dichiarazione di giugno»). Sta accanto al pulsante della casella, non dentro:
 * un pulsante dentro un pulsante non si tocca.
 *
 * z-[1], non z-10 (revisione del 13/10/2026): il contenitore della casella non
 * fa un contesto di sovrapposizione suo, e la prima colonna ferma della tabella
 * ha z-index 2 (src/index.css). Con z-10, scorrendo il riepilogo di lato, le
 * «i» dei mesi passati sotto la colonna ferma si disegnavano sopra i nomi
 * degli impianti. Per stare sopra la casella accanto basta 1.
 */
export function AngoloPerche({ mese }) {
  if (!casellaDaSpiegare(mese)) return null;
  const frasi = percheCasella(mese);
  if (!frasi.length) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Che cosa ha coperto la dichiarazione di ${String(mese.mese || '').toLowerCase()}`}
          className="absolute -top-1.5 -right-1 z-[1] inline-flex items-center justify-center w-4 h-4 rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-2 after:content-['']">
          <Info className="w-2.5 h-2.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <Riquadro>
        {frasi.map((f, i) => <p key={i}>{f}</p>)}
      </Riquadro>
    </Popover>
  );
}

/** Un numero che al tocco dice da dove viene. */
function NumeroSpiegato({ testo, frasi, etichetta }) {
  if (!frasi || !frasi.length) return <span>{testo}</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={etichetta} className="underline decoration-dotted underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
          {testo}
        </button>
      </PopoverTrigger>
      <Riquadro>{frasi.map((f, i) => <p key={i}>{f}</p>)}</Riquadro>
    </Popover>
  );
}

/**
 * LA GIACENZA A FINE MESE. Quanto resta alla fine di ogni mese di tutto quello
 * che e' entrato, dall'anno prima compreso, meno le dichiarazioni caricate fino
 * a quel mese, nella colonna in cui stanno. Su T-Cycle rete 2026: gennaio 87,74,
 * febbraio 124,16, marzo 20,62 (dopo la dichiarazione di marzo), ..., ottobre
 * 364,80, che e' la giacenza di oggi e il «Da dichiarare» della riga.
 */
export function RigaGiacenzaFineMese({ flusso, nonDovuta, sfondo }) {
  const mesi = flusso.mesi || [];
  if (!mesi.some(m => m && m.giacenza_fine_kg !== undefined)) return null;
  const partenza = flusso.giacenza_partenza_kg;
  return (
    <tr className={sfondo}>
      <td className="px-3 pb-1 sticky left-0 bg-inherit text-[11px] text-muted-foreground">
        giacenza a fine mese
        <span className="block text-[10px] leading-tight">entrato meno dichiarazioni caricate</span>
      </td>
      <td className="px-1 pb-1 text-center tabular-nums text-[11px] text-muted-foreground">
        {!nonDovuta && partenza > 0 ? tonnellate(partenza) : <span className="text-muted-foreground/50">—</span>}
      </td>
      {mesi.map((m, i) => {
        const kg = m.giacenza_fine_kg;
        const vuoto = nonDovuta || kg === null || kg === undefined;
        // Si spiega dove c'e' una dichiarazione, dove la chiusura sul canale ha
        // spostato una parte della giacenza fra le righe dell'ACI (13/10/2026) e
        // dove lo spostamento cambia o finisce rispetto al mese prima (seconda
        // revisione del 13/10/2026: a settembre di Gatim ACI la riga passava da 0
        // a 14,62 t con 12,82 arrivate, e al tocco non si apriva niente).
        const precedente = i > 0 ? mesi[i - 1] : null;
        const frasi = !vuoto && fineMeseDaSpiegare(m, precedente) ? percheFineMese(m, partenza > 0, precedente) : [];
        return (
          <td key={m.mese} className="px-1 pb-1 text-center tabular-nums text-[11px] text-slate-700 dark:text-slate-300">
            {vuoto ? <span className="text-muted-foreground/50">—</span>
              : <NumeroSpiegato testo={tonnellate(kg)} frasi={frasi} etichetta={`Giacenza a fine ${String(m.mese || '').toLowerCase()}: da dove viene`} />}
          </td>
        );
      })}
      <td className="px-3 pb-1" />
      <td className="px-3 pb-1" />
    </tr>
  );
}

/**
 * LO STOCCAGGIO DELLO STESSO SITO (12/10/2026). Per chi nell'anno e' stato,
 * sullo stesso canale, impianto e stoccaggio (T-Cycle sulla rete fino a
 * maggio): quello che e' entrato in stoccaggio, tal quale, e verso chi e'
 * ripartito in secondaria. Non entra nella riga dell'impianto, ne' nel
 * «Caricato», ne' nel «Da dichiarare»: lo dichiara chi lo riceve.
 */
export function RigheStoccaggio({ stoccaggio, sfondo }) {
  if (!stoccaggio) return null;
  const cella = (kg) => (kg > 0 ? tonnellate(kg) : <span className="text-muted-foreground/50">—</span>);
  const totale = (kg) => <td colSpan={2} className="px-3 py-0.5 text-right tabular-nums text-[11px] text-sky-800 dark:text-sky-300 whitespace-nowrap">{tonnellate(kg)} t in tutto</td>;
  const sotto = `${sfondo} bg-sky-50/60 dark:bg-sky-950/20`;
  return (
    <>
      <tr className={sotto}>
        <td className="px-3 py-0.5 sticky left-0 bg-sky-50 dark:bg-sky-950 text-[11px] text-sky-900 dark:text-sky-200">
          in stoccaggio nel mese
          <span className="block text-[10px] leading-tight text-sky-800/80 dark:text-sky-300/80">tal quale, non si dichiara qui · solo da leggere</span>
        </td>
        <td className="px-1 py-0.5 text-center text-[11px]"><span className="text-muted-foreground/50">—</span></td>
        {MESI.map((mese, i) => <td key={mese} className="px-1 py-0.5 text-center tabular-nums text-[11px] text-sky-900 dark:text-sky-200">{cella(stoccaggio.entrato_kg[i])}</td>)}
        {totale(stoccaggio.entrato_kg.reduce((s, x) => s + x, 0))}
      </tr>
      {stoccaggio.verso.map(v => (
        <tr key={v.chiave || v.impianto} className={sotto}>
          <td className="px-3 py-0.5 sticky left-0 bg-sky-50 dark:bg-sky-950 text-[11px] text-sky-900 dark:text-sky-200">
            ripartito in secondaria verso {v.impianto}
            <span className="block text-[10px] leading-tight text-sky-800/80 dark:text-sky-300/80">
              {v.dichiara ? `lo dichiara ${v.impianto}, nella sua riga` : `${v.impianto} non ci dichiara la rete, per accordo`}
              {' '}
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="Dove si dichiara lo stoccaggio" className="inline-flex items-center justify-center w-5 h-5 -my-1 rounded-full align-middle hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Info className="w-3 h-3" aria-hidden="true" />
                  </button>
                </PopoverTrigger>
                <Riquadro>{(stoccaggio.frasi || []).map((f, i) => <p key={i}>{f}</p>)}</Riquadro>
              </Popover>
            </span>
          </td>
          <td className="px-1 py-0.5 text-center text-[11px]"><span className="text-muted-foreground/50">—</span></td>
          {MESI.map((mese, i) => <td key={mese} className="px-1 py-0.5 text-center tabular-nums text-[11px] text-sky-900 dark:text-sky-200">{cella(v.mesi_kg[i])}</td>)}
          {totale(v.kg)}
        </tr>
      ))}
    </>
  );
}
