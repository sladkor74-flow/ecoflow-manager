import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertTriangle, CheckCircle, Route, Info } from 'lucide-react';
import { formatKg, formatIntero, formatTonnellate } from '@/lib/utils';

const giorno = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');

// Chi conferisce dove, e i formulari che sembrano chiusi sulla destinazione
// sbagliata. Le rotte si leggono dalla storia dell'anno, flusso per flusso e con i
// canali separati: nessuno le scrive a mano. Il controllo esisteva gia'
// (controlloRotte) ma nessuna pagina lo mostrava.
export default function ControlloRotte() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    let vivo = true;
    base44.functions.invoke('controlloRotte', {})
      .then(r => { if (vivo) setData(r.data); })
      .catch(e => { if (vivo) setErrore(e?.response?.data?.error || e.message); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, []);

  if (loading) return <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Lettura delle rotte dell'anno...</div>;
  if (errore) return <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4 text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {errore}</div>;
  if (!data) return null;

  const sospetti = (data.flussi || []).flatMap(f => (f.sospetti || []).map(s => ({ ...s, flusso: f.nome })));
  const tariffe = data.tariffe_da_verificare || [];
  // I terminati con le date obbligatorie da sistemare, flusso per flusso e di
  // qualunque anno (regola del 22/09/2026): chi non ha la fine trasporto resta
  // fuori dalle rotte dell'anno, e va detto.
  const conDate = (data.flussi || []).filter(f => f.date_da_sistemare && f.date_da_sistemare.ordini > 0);

  return (
    <div className="space-y-4">
      <div className={`border-2 rounded-lg p-4 ${sospetti.length ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
        <div className={`flex items-center gap-2 font-semibold ${sospetti.length ? 'text-amber-900' : 'text-emerald-800'}`}>
          {sospetti.length ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {sospetti.length
            ? `${sospetti.length} ${sospetti.length === 1 ? 'formulario sembra chiuso' : 'formulari sembrano chiusi'} sulla destinazione sbagliata (${data.anno})`
            : `Nessun formulario del ${data.anno} su una destinazione insolita`}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {(data.flussi || []).map(f => `${f.nome}: ${formatIntero(f.movimenti)} movimenti, ${formatIntero((f.sospetti || []).length)} da guardare`).join(' · ')}
        </p>
      </div>

      {sospetti.length > 0 && (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr>
              <th className="text-left px-3 py-2 font-semibold">Flusso</th>
              <th className="text-left px-3 py-2 font-semibold">ID ordine</th>
              <th className="text-left px-3 py-2 font-semibold">Formulario</th>
              <th className="text-left px-3 py-2 font-semibold">Fine trasporto</th>
              <th className="text-left px-3 py-2 font-semibold">Da</th>
              <th className="text-left px-3 py-2 font-semibold">Chiuso su</th>
              <th className="text-left px-3 py-2 font-semibold">Di norma</th>
              <th className="text-right px-3 py-2 font-semibold">kg</th>
            </tr></thead>
            <tbody>
              {sospetti.map((s, i) => (
                <tr key={i} className="border-t align-top" title={s.testo}>
                  <td className="px-3 py-1.5">{s.flusso}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{s.id_ordine || '—'}</td>
                  <td className="px-3 py-1.5 text-xs">{s.numero_fir || '—'}</td>
                  <td className="px-3 py-1.5">{giorno(s.giorno)}</td>
                  <td className="px-3 py-1.5">{s.origine}</td>
                  <td className={`px-3 py-1.5 font-medium ${s.impossibile ? 'text-red-600' : 'text-amber-700'}`}>{s.destinazione}{s.impossibile ? ' (non può essere)' : ` (${s.viaggi_su_questa_destinazione} su ${s.viaggi_totali_origine} viaggi)`}</td>
                  <td className="px-3 py-1.5">{s.destinazione_abituale || s.sito_proprio || '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatKg(s.kg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sospetti.some(s => s.date_da_sistemare) && (
            <div className="border-t px-3 py-2 text-xs text-red-700 space-y-0.5">
              {sospetti.filter(s => s.date_da_sistemare).map((s, i) => (
                <div key={i}>{s.id_ordine || s.numero_fir || 'Ordine senza ID'}: {s.date_da_sistemare}. Le date obbligatorie vanno inserite o corrette.</div>
              ))}
            </div>
          )}
        </div>
      )}

      {conDate.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 space-y-1.5">
          <p className="text-sm font-semibold text-red-900 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Terminati con date obbligatorie mancanti o incoerenti</p>
          <p className="text-xs text-red-900">
            Immissione, inizio e fine trasporto sono obbligatorie nei formulari. Chi non ha la fine trasporto non ha un anno e non entra nelle rotte qui sopra;
            gli altri ci sono, ma le date vanno inserite o corrette. Di qualunque anno, flusso per flusso.
          </p>
          <div className="space-y-1 text-sm">
            {conDate.map(f => (
              <div key={f.flusso}>
                <span className="font-medium">{f.nome}</span>: {formatIntero(f.date_da_sistemare.ordini)} {f.date_da_sistemare.ordini === 1 ? 'ordine' : 'ordini'}
                {f.date_da_sistemare.senza_fine ? `, di cui ${formatIntero(f.date_da_sistemare.senza_fine)} senza fine trasporto` : ''}
                <span className="block text-xs text-muted-foreground">
                  {f.date_da_sistemare.esempi.map(x => `${x.id_ordine || 'senza ID'}${x.numero_fir ? ` (FIR ${x.numero_fir})` : ''}: ${x.date}`).join('; ')}
                  {f.date_da_sistemare.ordini > f.date_da_sistemare.esempi.length ? `; e altri ${formatIntero(f.date_da_sistemare.ordini - f.date_da_sistemare.esempi.length)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tariffe.length > 0 && (
        <div className="border rounded-lg p-4">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Info className="w-4 h-4 text-primary" /> Raccoglitori che conferiscono su più destinazioni senza un prezzo per ciascuna</p>
          <p className="text-xs text-muted-foreground mb-2">Se il contratto prevede un prezzo diverso per impianto di scarico, si sta applicando quello generico: da verificare sul contratto, non da correggere a occhio.</p>
          <div className="space-y-1 text-sm">
            {tariffe.map((t, i) => (
              <div key={i}><span className="font-medium">{t.origine}</span> <span className="text-muted-foreground">({t.tipologia})</span>: {t.destinazioni.map(d => `${d.destinazione} ${formatIntero(d.viaggi)} viaggi${d.tariffa !== null && d.tariffa !== undefined ? `, ${d.tariffa} €/t` : ', senza prezzo suo'}`).join(' · ')}</div>
            ))}
          </div>
        </div>
      )}

      {(data.stoccaggi_condivisi || []).length > 0 && (
        <div className="border rounded-lg p-4">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Route className="w-4 h-4 text-primary" /> Stoccaggi che alimentano più impianti (secondarie di rete)</p>
          <div className="space-y-1 text-sm mt-2">
            {data.stoccaggi_condivisi.map((q, i) => (
              <div key={i}><span className="font-medium">{q.stoccaggio || q.nome || ''}</span>: {(q.impianti || []).map(x => `${x.impianto || x.destinazione} ${formatTonnellate((x.kg || 0) / 1000)} t (${Math.round((x.quota || 0) * 100)}%)`).join(' · ')}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
