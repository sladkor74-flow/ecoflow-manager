import React from 'react';
import { Factory, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { ton, it, viaggiDec, SCENARI, senzaProiezioni, esitoFinale, Barra, Cifra, Vuoto } from './Comuni';

// Gli impianti seguiti: quanto manca al target, e quanto ci arrivera' ancora in
// due modi affiancati - sul target che resta ai raccoglitori e sul ritmo reale
// delle ultime settimane - con la prudente, flusso per flusso la piu' bassa, che
// e' quella su cui si programma (utente, 26/09/2026). In un anno chiuso, o
// quando la programmazione di un impianto e' finita, non si proietta piu'
// niente: si dice com'e' finita.

const settimane = (n) => formatNumber(Number(n) || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Proiezioni({ i }) {
  const colonna = (sc) => (sc === 'prudente' ? 'bg-primary/10 border-x-2 border-primary/40' : '');
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="text-left px-3 py-2 font-semibold">
              Da qui al {it(i.fine)}{i.orizzonte ? ` (${settimane(i.orizzonte.settimane)} settimane)` : ''}
            </th>
            {SCENARI.map(s => (
              <th key={s.chiave} className={`text-right px-3 py-2 font-semibold ${colonna(s.chiave)}`}>
                {s.nome}
                {s.nota && <span className="block text-[11px] font-normal text-primary">{s.nota}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="px-3 py-2">Arriverà in primaria</td>
            {SCENARI.map(s => <td key={s.chiave} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${colonna(s.chiave)}`}>{ton(i.primaria_attesa[s.chiave])}</td>)}
          </tr>
          <tr className="border-t">
            <td className="px-3 py-2 font-medium">Serve in secondaria</td>
            {SCENARI.map(s => <td key={s.chiave} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium ${colonna(s.chiave)}`}>{ton(i.fabbisogno_secondarie[s.chiave])}</td>)}
          </tr>
          {(i.da_stoccaggi || []).map(d => (
            <tr key={d.stoccaggio} className="border-t">
              <td className="px-3 py-2">Da {d.nome}</td>
              {SCENARI.map(s => (
                <td key={s.chiave} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${colonna(s.chiave)}`}>
                  {ton((d.kg || {})[s.chiave])}
                  {Number((d.kg || {})[s.chiave]) > 0 && (
                    <span className="block text-[11px] text-muted-foreground">
                      {viaggiDec((d.viaggi_totali || {})[s.chiave])} viaggi, {viaggiDec((d.viaggi_settimana || {})[s.chiave])} a settimana
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
          {i.senza_stoccaggi && (
            <tr className="border-t">
              <td className="px-3 py-2 text-muted-foreground" colSpan={4}>
                Nessuno stoccaggio alimenta {i.nome}: quello che manca può arrivare solo in primaria.
              </td>
            </tr>
          )}
          <tr className="border-t">
            <td className="px-3 py-2 font-medium">Arriva al target?</td>
            {SCENARI.map(s => (
              <td key={s.chiave} className={`px-3 py-2 text-right whitespace-nowrap ${colonna(s.chiave)}`}>
                {i.raggiunge[s.chiave]
                  ? <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Sì</span>
                  : <span className="inline-flex items-center gap-1 text-red-700 font-medium"><AlertTriangle className="w-3.5 h-3.5" /> Mancano {ton(i.mancanza_kg[s.chiave])}</span>}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Al posto delle proiezioni, quando non ce ne sono piu': target raggiunto o quanto e' mancato. */
function EsitoFinale({ i, risposta }) {
  const e = esitoFinale(i);
  return (
    <div className={`text-sm rounded-lg border px-3 py-2 flex items-start gap-2 ${e.raggiunto ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
      {e.raggiunto ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
      {risposta.sola_lettura ? (
        <span><strong>{e.testo}</strong>.</span>
      ) : (
        <span>
          La programmazione di {i.nome} è finita il {it(i.fine)}: <strong>{e.testo.charAt(0).toLowerCase() + e.testo.slice(1)}</strong>.
          {' '}Fino al 31/12 il già arrivato può ancora crescere con i formulari che si caricano.
        </span>
      )}
    </div>
  );
}

function Raccoglitori({ i, finito }) {
  const righe = i.primarie || [];
  if (!righe.length) return <p className="text-xs text-muted-foreground">Nessun raccoglitore ha portato primarie a {i.nome} quest&apos;anno.</p>;
  return (
    <details className="border rounded-lg">
      <summary className="px-3 py-2 text-sm font-medium cursor-pointer select-none">Raccoglitori che portano primarie a {i.nome} ({righe.length})</summary>
      <div className="overflow-x-auto border-t">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Raccoglitore</th>
              <th className="text-right px-3 py-2 font-semibold">Target dell&apos;anno</th>
              <th className="text-right px-3 py-2 font-semibold">Già portato</th>
              {!finito && (
                <>
                  <th className="text-right px-3 py-2 font-semibold">Ritmo a settimana</th>
                  <th className="text-right px-3 py-2 font-semibold">Porterà sul target</th>
                  <th className="text-right px-3 py-2 font-semibold">Porterà sul ritmo</th>
                  <th className="text-right px-3 py-2 font-semibold bg-primary/10">Prudente</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {righe.map((r, n) => (
              <tr key={`${r.raccoglitore}-${n}`} className="border-t">
                <td className="px-3 py-2">{r.raccoglitore}</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{r.target_kg === null || r.target_kg === undefined ? <span className="text-muted-foreground">nessuno</span> : ton(r.target_kg)}</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{ton(r.consuntivo_kg)}</td>
                {!finito && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{ton(r.ritmo_settimanale_kg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{r.target_kg === null || r.target_kg === undefined ? '—' : ton(r.attesa.target)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{ton(r.attesa.ritmo)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap bg-primary/5 font-medium">{ton(r.attesa.prudente)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Impianto({ i, risposta }) {
  const c = i.composizione;
  const finito = senzaProiezioni(i, risposta);
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Factory className="w-5 h-5 text-blue-600" />
        <h3 className="font-heading font-bold text-lg">{i.nome}</h3>
        <span className="text-xs text-muted-foreground">target entro il {it(i.fine)}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Cifra etichetta="Target" valore={ton(i.target_kg)} />
        <Cifra etichetta="Già arrivato" valore={ton(i.gia_arrivato_kg)} />
        {i.target_superato
          ? <Cifra etichetta="Quanto manca" valore="Target raggiunto" classe="text-emerald-700" />
          : <Cifra etichetta="Quanto manca" valore={ton(i.residuo_kg)} classe="text-amber-700" />}
      </div>
      <Barra parte={i.gia_arrivato_kg} totale={i.target_kg} colore={i.target_superato ? 'bg-emerald-500' : 'bg-primary'} />
      {c && (
        <p className="text-xs text-muted-foreground">
          Già arrivato: primarie all&apos;impianto {ton(c.primaria_impianto_kg)}
          {(c.primaria_piazzale_netta_kg > 0 || c.piazzale_ripartito_kg > 0) && <> · nel suo piazzale {ton(c.primaria_piazzale_netta_kg)}{c.piazzale_ripartito_kg > 0 && <> (tolte {ton(c.piazzale_ripartito_kg)} ripartite per altri impianti)</>}</>}
          {' '}· secondarie da altri stoccaggi {ton(c.secondaria_kg)}.
        </p>
      )}
      {(i.note || []).length > 0 && (
        <ul className="text-[11px] text-muted-foreground space-y-1">
          {i.note.map((n, k) => <li key={k} className="flex items-start gap-1.5"><Info className="w-3 h-3 mt-0.5 shrink-0" /><span>{n}</span></li>)}
        </ul>
      )}
      {finito
        ? <EsitoFinale i={i} risposta={risposta} />
        : i.target_superato
          ? <p className="text-sm text-emerald-700">Il target è raggiunto: a {i.nome} non servono altre secondarie.</p>
          : <Proiezioni i={i} />}
      <Raccoglitori i={i} finito={finito} />
    </div>
  );
}

export default function SchedaImpianti({ risposta }) {
  const impianti = risposta.impianti || [];
  if (!impianti.length) return <Vuoto>Nessun impianto seguito con un target per il {risposta.anno}.</Vuoto>;
  const f = risposta.finestra_ritmo || {};
  const tuttiFiniti = impianti.every(i => senzaProiezioni(i, risposta));
  return (
    <div className="space-y-4">
      {tuttiFiniti ? (
        <p className="text-sm text-muted-foreground">
          {risposta.sola_lettura
            ? `Il ${risposta.anno} è chiuso: per ogni impianto, com'è finito l'anno.`
            : `La programmazione del ${risposta.anno} è finita: per ogni impianto, com'è andata.`}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Quanto arriverà ancora in primaria si stima in due modi: sul target che resta ai raccoglitori e sul ritmo reale
          {f.settimane ? ` delle ultime ${f.settimane} settimane` : ''}{f.dal ? ` (dal ${it(f.dal)} al ${it(f.al)})` : ''}.
          La prudente prende, raccoglitore per raccoglitore, la più bassa delle due (senza target vale il ritmo): il programma si fa su quella.
        </p>
      )}
      {impianti.map(i => <Impianto key={i.chiave} i={i} risposta={risposta} />)}
    </div>
  );
}
