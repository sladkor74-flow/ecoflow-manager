import React from 'react';
import { formatTonnellate } from '@/lib/utils';
import { TOLLERANZA_QUADRATURA_T } from '@/lib/dichiarazioniImpianti';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

// Quadratura con il portale: la giacenza che risulta dalle dichiarazioni deve
// coincidere con quella del modulo Giacenze del portale, che è il conferito non
// ancora dichiarato. Se non torna, il perché sta quasi sempre in un mese
// dichiarato ma non caricato.

const t = (v) => (v === null || v === undefined ? '—' : formatTonnellate(Number(v) || 0));

export default function Quadratura({ dati }) {
  const righe = [...dati.siti].sort((a, b) => Math.abs(b.scarto_t || 0) - Math.abs(a.scarto_t || 0));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Giacenza al 31/12 dell'anno prima, più quello che è entrato, meno quello che è stato dichiarato e caricato:
        deve dare la giacenza del portale. Si considera in linea uno scarto fino a {formatTonnellate(TOLLERANZA_QUADRATURA_T)} t.
      </p>
      <div className="border rounded-xl bg-card" data-scorre-lato>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/50 min-w-[200px]">Impianto</th>
              <th className="text-right px-2 py-2 font-semibold">Giacenza iniziale</th>
              <th className="text-right px-2 py-2 font-semibold">Conferito rete</th>
              <th className="text-right px-2 py-2 font-semibold">Conferito ACI</th>
              <th className="text-right px-2 py-2 font-semibold">Extra raccolta</th>
              <th className="text-right px-2 py-2 font-semibold">Secondarie in</th>
              <th className="text-right px-2 py-2 font-semibold">Secondarie out</th>
              <th className="text-right px-2 py-2 font-semibold">Terziarie (info)</th>
              <th className="text-right px-2 py-2 font-semibold">Dichiarato caricato</th>
              <th className="text-right px-2 py-2 font-semibold">Giacenza calcolata</th>
              <th className="text-right px-2 py-2 font-semibold">Giacenza a portale</th>
              <th className="text-right px-2 py-2 font-semibold">Scarto</th>
              <th className="text-left px-3 py-2 font-semibold">Esito</th>
            </tr>
          </thead>
          <tbody>
            {righe.map(s => (
              <tr key={s.chiave} className="border-b last:border-b-0">
                <td className="px-3 py-1.5 sticky left-0 bg-card">
                  <span className="font-medium">{s.sito}</span>
                  {s.tipo_destinazione === 'stoc' && <span className="text-[11px] text-muted-foreground block">stoccaggio</span>}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{t(s.giacenza_iniziale_t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{t(s.conferito_t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{s.conferito_aci_t ? t(s.conferito_aci_t) : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{s.conferito_extra_t ? t(s.conferito_extra_t) : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{s.secondarie_in_t ? t(s.secondarie_in_t) : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{s.secondarie_out_t ? t(s.secondarie_out_t) : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{s.terziarie_out_t ? t(s.terziarie_out_t) : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{t(s.dichiarato_caricato_t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">{t(s.giacenza_calcolata_t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">{t(s.giacenza_portale_t)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${s.quadra === false ? 'text-red-700' : ''}`}>{t(s.scarto_t)}</td>
                <td className="px-3 py-1.5">
                  {s.quadra === true && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> quadra</span>}
                  {s.quadra === false && <span className="inline-flex items-center gap-1 text-red-700"><AlertTriangle className="w-3.5 h-3.5" /> da verificare</span>}
                  {s.quadra === null && <span className="text-muted-foreground">nessun dato a portale</span>}
                  {s.in_attesa_dichiarazione_t > 0 && s.tipo_destinazione === 'stoc' && (
                    <span className="block text-[11px] text-muted-foreground">{t(s.in_attesa_dichiarazione_t)} t partite e non ancora dichiarate dall'impianto ricevente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
