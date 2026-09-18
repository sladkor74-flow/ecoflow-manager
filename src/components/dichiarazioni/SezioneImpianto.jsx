import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTonnellate, formatKg } from '@/lib/utils';
import { materialiDi, OPERAZIONI, CANALI, controlliDichiarazione } from '@/lib/dichiarazioniImpianti';
import { Pencil, AlertTriangle, CheckCircle2 } from 'lucide-react';

// La sezione di un impianto: mese per mese quanto è stato conferito, quanto è
// stato dichiarato e che cosa ne è uscito, con il conto della giacenza in fondo.

const kg = (v) => (Number(v) ? formatKg(v) : '—');
const t = (v) => formatTonnellate(Number(v) || 0);

export default function SezioneImpianto({ sito, onApri, soloLettura }) {
  const materiali = materialiDi(sito.operazione);
  const operazione = OPERAZIONI[sito.operazione];
  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold flex items-center gap-2">
            {sito.sito}
            {sito.tipo_destinazione === 'stoc' && <Badge variant="outline" className="font-normal">stoccaggio</Badge>}
            {sito.operazione && <Badge variant="outline" className="font-normal">{sito.operazione}</Badge>}
          </p>
          {operazione && <p className="text-xs text-muted-foreground mt-0.5">{operazione.spiega}</p>}
        </div>
        <div className="text-right text-sm">
          {sito.quadra === true && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-4 h-4" /> giacenza in linea con il portale</span>}
          {sito.quadra === false && <span className="inline-flex items-center gap-1 text-red-700"><AlertTriangle className="w-4 h-4" /> scarto di {t(sito.scarto_t)} t sul portale</span>}
          {sito.quadra === null && <span className="text-muted-foreground text-xs">giacenza a portale non disponibile</span>}
        </div>
      </div>

      {sito.flussi.map(flusso => {
        const canale = CANALI.find(c => c.chiave === flusso.canale);
        const mesiConDati = flusso.mesi.filter(m => m.conferito_kg > 0 || (m.dichiarazione && m.dichiarazione.quantita_kg > 0));
        if (!mesiConDati.length) return null;
        return (
          <div key={`${flusso.canale}-${flusso.provenienza}`} className="border-b last:border-b-0">
            <p className="px-4 pt-3 pb-1 text-sm font-medium">
              {canale ? canale.nome : flusso.canale}{flusso.provenienza ? ` · ${flusso.provenienza}` : ''}
              <span className="text-xs text-muted-foreground font-normal"> — conferiti {t(flusso.conferito_t)} t, dichiarati e caricati {t(flusso.dichiarato_caricato_t)} t</span>
            </p>
            <div data-scorre-lato>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-y bg-muted/40">
                    <th className="text-left px-3 py-1.5 font-semibold min-w-[110px]">Mese</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Conferito (kg)</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Dichiarato (kg)</th>
                    {materiali.map(m => <th key={m.chiave} className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">{m.nome} (kg)</th>)}
                    <th className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">Stato</th>
                    <th className="px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {mesiConDati.map(m => {
                    const d = m.dichiarazione;
                    const avvisi = controlliDichiarazione(d, m.conferito_kg, sito.operazione, { tipo_destinazione: sito.tipo_destinazione, canale: flusso.canale }).filter(c => c.livello === 'attenzione');
                    return (
                      <tr key={m.mese} className="border-b last:border-b-0">
                        <td className="px-3 py-1.5 font-medium">{m.mese}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{kg(m.conferito_kg)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">{kg(d && d.quantita_kg)}</td>
                        {materiali.map(x => <td key={x.chiave} className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{kg(d && d[x.chiave])}</td>)}
                        <td className="px-2 py-1.5">
                          {d && d.caricata_inviata ? <span className="text-emerald-700">caricata a portale</span>
                            : d && d.ricevuta_email ? <span className="text-emerald-800">in mano, da caricare</span>
                              : d && d.quantita_kg > 0 ? <span className="text-slate-600">inserita</span>
                                : <span className="text-amber-700">da chiedere</span>}
                          {avvisi.length > 0 && <span className="block text-[11px] text-amber-700">{avvisi[0].testo}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {!soloLettura && (
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onApri(sito, flusso, m)}>
                              <Pencil className="w-3.5 h-3.5" /> apri
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="px-4 py-3 bg-muted/20 text-xs grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        <span>Giacenza al 31/12 dell'anno prima: <strong>{t(sito.giacenza_iniziale_t)} t</strong></span>
        <span>Conferito rete: <strong>{t(sito.conferito_t)} t</strong></span>
        {sito.conferito_aci_t > 0 && <span>Conferito ACI: <strong>{t(sito.conferito_aci_t)} t</strong></span>}
        {sito.conferito_extra_t > 0 && <span>Extra raccolta: <strong>{t(sito.conferito_extra_t)} t</strong></span>}
        {sito.secondarie_in_t > 0 && <span>Secondarie in ingresso: <strong>{t(sito.secondarie_in_t)} t</strong></span>}
        {sito.secondarie_out_t > 0 && <span>Secondarie in uscita: <strong>{t(sito.secondarie_out_t)} t</strong></span>}
        {sito.terziarie_out_t > 0 && <span>Terziarie in uscita: <strong>{t(sito.terziarie_out_t)} t</strong></span>}
        <span>Dichiarato e caricato: <strong>{t(sito.dichiarato_caricato_t)} t</strong></span>
        <span>Giacenza che ne risulta: <strong>{t(sito.giacenza_calcolata_t)} t</strong></span>
        <span>Giacenza a portale: <strong>{sito.giacenza_portale_t === null ? '—' : `${t(sito.giacenza_portale_t)} t`}</strong></span>
      </div>
    </div>
  );
}
