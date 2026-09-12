import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function fmt(n) { return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function RuoloBadge({ td }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${td === 'imp' ? 'bg-primary/15 text-primary' : 'bg-accent/20 text-accent-foreground'}`}>
      {td === 'imp' ? 'Impianto' : 'Stoccaggio'}
    </span>
  );
}

export default function AciTable({ righe }) {
  const aciRighe = righe.filter(r =>
    r.aci_in_primarie_t || r.aci_in_sec_t || r.aci_out_sec_t || r.aci_dichiarato_t || r.aci_predisposto_t || r.giacenza_aci_t || r.divergenza_portale_t
  );

  if (aciRighe.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-heading font-semibold text-sm">Posizione ACI - fuori portale</h3>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Sito</th>
              <th className="text-center px-2 py-2 font-semibold">Ruolo</th>
              <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">ACI in da primarie</th>
              <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">ACI in da secondarie</th>
              <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">ACI in uscita</th>
              <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Dichiarato inviato</th>
              <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Dichiarato da inviare</th>
              <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Giacenza ACI reale</th>
              <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">Divergenza a portale</th>
            </tr>
          </thead>
          <tbody>
            {aciRighe.map((r, i) => (
              <tr key={i} className={`border-b ${i % 2 ? 'bg-muted/20' : ''}`}>
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">{r.sito}</td>
                <td className="px-2 py-1.5 text-center"><RuoloBadge td={r.tipo_destinazione} /></td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.aci_in_primarie_t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.aci_in_sec_t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.aci_out_sec_t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.aci_dichiarato_t)}</td>
                <td className="px-2 py-1.5 text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`tabular-nums cursor-help ${r.aci_predisposto_t > 0 ? 'text-amber-600 font-medium' : ''}`}>{fmt(r.aci_predisposto_t)}</span>
                      </TooltipTrigger>
                      {r.aci_predisposto_t > 0 && <TooltipContent>dichiarazione predisposta ma non ancora caricata a portale</TooltipContent>}
                    </Tooltip>
                  </TooltipProvider>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <span className={`tabular-nums font-medium ${r.giacenza_aci_t === 0 ? 'text-success' : 'text-amber-600'}`}>{fmt(r.giacenza_aci_t)}</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.divergenza_portale_t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Le dichiarazioni ACI non vengono caricate a portale: il portale registra gli ingressi ma non le uscite, quindi la giacenza che mostra è superiore a quella reale della differenza indicata nell'ultima colonna.</p>
    </div>
  );
}