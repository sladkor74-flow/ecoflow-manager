import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';

function fmt(n, dec = 2) {
  if (n == null || n === '' || isNaN(n)) return '—';
  // Conteggi interi; tonnellate con due decimali, tre se i kg non sono tondi.
  return Number(n).toLocaleString('it-IT', dec === 0 ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

const IN_ATTESA_TOOLTIP = "Materiale gia' partito da questo stoccaggio verso un impianto: il portale lo attribuisce ancora qui finche' il destinatario non presenta la dichiarazione. Non e' giacenza.";
const RILEVAZ_OBSOLETA_TOOLTIP = "Rilevazione di oltre trenta giorni fa: aggiornala dalla pagina Unita' Locali di Stoccaggio del portale.";
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('it-IT'); }

export default function SituazioneTable({ righe, totali, onVaiDaDichiarare }) {
  const maxGiacenza = Math.max(...righe.map(r => r.giacenza_portale_t || 0), 0.01);

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold">Sito</th>
              <th className="px-3 py-2 font-semibold">Ruolo</th>
              <th className="px-3 py-2 font-semibold text-right">Giacenza a portale</th>
              <th className="px-3 py-2 font-semibold text-right">In attesa di dichiarazione</th>
              <th className="px-3 py-2 font-semibold text-right">Ordini da dichiarare</th>
              <th className="px-3 py-2 font-semibold text-right">Dichiarato nell'anno</th>
              <th className="px-3 py-2 font-semibold">Tipologia trattamento</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r, i) => {
              const barWidth = Math.max((r.giacenza_portale_t / maxGiacenza) * 100, 1);
              return (
                <tr key={i} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">{r.sito}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.tipo_destinazione === 'imp'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-accent/15 text-accent-foreground'
                    }`}>
                      {r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-bold">{fmt(r.giacenza_portale_t)} t</div>
                    <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${barWidth}%` }} />
                    </div>
                    {r.tipo_destinazione === 'stoc' && r.data_rilevazione && (
                      <div className={`mt-1 text-xs flex items-center justify-end gap-1 ${r.rilevazione_obsoleta ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {r.rilevazione_obsoleta && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild><AlertTriangle className="w-3 h-3" /></TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">{RILEVAZ_OBSOLETA_TOOLTIP}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <span>rilevato il {fmtDate(r.data_rilevazione)}</span>
                      </div>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right ${r.in_attesa_dichiarazione_t > 0.01 ? 'text-amber-600' : ''}`}>
                    {r.in_attesa_dichiarazione_t > 0.01 ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted underline-offset-2">{fmt(r.in_attesa_dichiarazione_t)} t</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">{IN_ATTESA_TOOLTIP}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={() => onVaiDaDichiarare(r.sito)}
                    >
                      {r.ordini_da_dichiarare || 0}
                    </Button>
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(r.dichiarato_t)} t</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.tipologia_trattamento || '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/50 font-bold border-t-2">
            <tr>
              <td className="px-3 py-2">TOTALE</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right">{fmt(totali.giacenza_portale_t)} t</td>
              <td className="px-3 py-2 text-right">{fmt(totali.in_attesa_dichiarazione_t)} t</td>
              <td className="px-3 py-2 text-right">{totali.ordini_da_dichiarare || 0}</td>
              <td className="px-3 py-2 text-right">{fmt(totali.dichiarato_t)} t</td>
              <td className="px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-3 py-2 text-xs text-muted-foreground italic">
        La giacenza a portale e' il dato ufficiale del portale Ecotyre: per gli impianti e' il peso degli ordini ricevuti e non ancora dichiarati come recuperati, per gli stoccaggi e' il saldo rilevato dalla pagina Unita' Locali di Stoccaggio. La colonna In attesa di dichiarazione indica invece materiale gia' partito da uno stoccaggio verso un impianto, che il portale continua ad attribuire allo stoccaggio finche' il destinatario non presenta la dichiarazione: non e' giacenza.
      </p>
    </div>
  );
}