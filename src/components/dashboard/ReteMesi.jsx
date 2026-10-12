import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { t, tSegno, giornoMese, COLORI } from '@/components/dashboard/formato';
import { righeMesi } from '@/components/dashboard/righeQuadro';
import { Tabella } from '@/components/dashboard/Sezione';

// LA RETE MESE PER MESE (migliorie dell'11/10/2026): il target del profilo del
// contratto contro il raccolto, per fine trasporto. Un asse solo: target e
// raccolto sono la stessa grandezza. Nel mese dei dati la barra del target e'
// l'atteso fino a quel giorno, perche' un mese a meta' contro il target del mese
// intero sembrerebbe sempre indietro; il target del mese intero sta nella
// tabella. I mesi che i dati non coprono hanno il target e nessun raccolto (non
// zero). La tabella c'e' sempre, a un tocco: un grafico da solo non si legge con
// lo screen reader e i colori non bastano.

const formato = (v) => t(v);

export default function ReteMesi({ mesi, giornoDati, conTarget, anno }) {
  const [vista, setVista] = useState('mesi');
  const [tabella, setTabella] = useState(false);
  const righe = righeMesi(mesi);
  const meseDati = righe.find(r => r.aMeta);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <h3 className="text-sm font-semibold">Mese per mese</h3>
        <div className="inline-flex rounded-md border p-0.5 text-xs" role="group" aria-label="Vista del grafico">
          {[['mesi', 'Mese per mese'], ['cumulato', 'Progressivo']].map(([k, testo]) => (
            <button key={k} type="button" onClick={() => setVista(k)} aria-pressed={vista === k}
              className={`rounded px-2 py-1 ${vista === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{testo}</button>
          ))}
        </div>
      </div>
      {!conTarget && <p className="text-xs text-muted-foreground mb-2">Il contratto Ecotyre del {anno} non è inserito in Target &amp; Status: qui c&apos;è solo il raccolto.</p>}
      <div className="h-[220px] sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          {vista === 'mesi' ? (
            <BarChart data={righe} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={44} />
              <Tooltip formatter={formato} labelFormatter={(n, p) => (p && p[0] && p[0].payload.aMeta ? `${p[0].payload.mese} (target fino al ${giornoMese(giornoDati)})` : (p && p[0] ? p[0].payload.mese : n))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {conTarget && <Bar dataKey="target" name="Target del profilo" fill={COLORI.target} radius={[4, 4, 0, 0]} />}
              <Bar dataKey="raccolto" name="Raccolto" fill={COLORI.rete} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={righe} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={52} />
              <Tooltip formatter={formato} labelFormatter={(n, p) => (p && p[0] ? p[0].payload.mese : n)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {conTarget && <Line type="monotone" dataKey="targetCum" name="Target progressivo" stroke={COLORI.target} strokeWidth={2} dot={false} connectNulls />}
              <Line type="monotone" dataKey="raccoltoCum" name="Raccolto progressivo" stroke={COLORI.rete} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {meseDati && conTarget && (
        <p className="text-xs text-muted-foreground mt-1">In {meseDati.mese.toLowerCase()} la barra del target è l&apos;atteso fino al {giornoMese(giornoDati)}: il target del mese intero è nella tabella.</p>
      )}
      <button type="button" onClick={() => setTabella(v => !v)} aria-expanded={tabella} className="text-xs text-primary hover:underline mt-2">
        {tabella ? 'Nascondi la tabella' : 'Mostra la tabella'}
      </button>
      {tabella && (
        <Tabella className="mt-2 border rounded-md">
          <thead className="bg-muted/40"><tr className="text-left text-xs text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">Mese</th>
            <th className="px-2 py-1.5 font-medium text-right">Target del profilo</th>
            <th className="px-2 py-1.5 font-medium text-right">Budget SMOCO</th>
            <th className="px-2 py-1.5 font-medium text-right">Raccolto</th>
            <th className="px-2 py-1.5 font-medium text-right">Scarto del mese</th>
            <th className="px-2 py-1.5 font-medium text-right">Target progressivo</th>
            <th className="px-2 py-1.5 font-medium text-right">Raccolto progressivo</th>
          </tr></thead>
          <tbody>
            {righe.map(r => (
              <tr key={r.mese} className="border-t">
                <td className="px-2 py-1.5 whitespace-nowrap">{r.mese}{r.aMeta ? ` (al ${giornoMese(giornoDati)})` : ''}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(r.targetMese)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(r.budget)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(r.raccolto)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${r.scarto === null ? '' : r.scarto >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{tSegno(r.scarto)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(r.targetCum)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(r.raccoltoCum)}</td>
              </tr>
            ))}
          </tbody>
        </Tabella>
      )}
    </div>
  );
}
