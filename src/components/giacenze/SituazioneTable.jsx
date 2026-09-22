import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';
import { formatNumber, formatTonnellate, formatIntero, formatKg } from '@/lib/utils';
import { riassuntoGruppo } from '@/components/giacenze/DateDaSistemare';

function fmt(n, dec = 2) {
  if (n == null || n === '' || isNaN(n)) return '—';
  // Conteggi interi; tonnellate con due decimali, tre se i kg non sono tondi.
  return dec === 0 ? formatNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : dec === 2 ? formatTonnellate(n) : formatNumber(n, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// Le classi come nel portale Ecotyre, in kg per confrontarle direttamente.
const CLASSI = [
  { chiave: 'P', titolo: 'P', aiuto: 'fino a 35 kg (auto/moto)' },
  { chiave: 'M', titolo: 'M', aiuto: 'fino a 155 kg (camion, bus)' },
  { chiave: 'G1', titolo: 'G1', aiuto: 'oltre 155 kg (agricoltura)' },
  { chiave: 'G2', titolo: 'G2', aiuto: 'oltre 155 kg (industriali)' },
  { chiave: 'ACI', titolo: 'ACI', aiuto: 'PFU da autodemolizione' },
];

const IN_ATTESA_TOOLTIP = "Materiale gia' partito da questo stoccaggio verso un impianto: il portale lo attribuisce ancora qui finche' il destinatario non presenta la dichiarazione. Non e' giacenza.";
const RILEVAZ_OBSOLETA_TOOLTIP = "Rilevazione di oltre trenta giorni fa: aggiornala dalla pagina Unita' Locali di Stoccaggio del portale.";
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('it-IT'); }
function fmtDataOra(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${x.toLocaleDateString('it-IT')} ${x.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
}

// Come si arriva alla giacenza di uno stoccaggio: rilevazione, ingressi e uscite
// finiti dopo, un canale per volta. L'extra raccolta, che a portale non c'e', a parte.
function DettaglioStoccaggio({ r }) {
  const d = r.dopo_rilevazione;
  if (!d) return null;
  const kgRil = (soloAci) => Object.entries(r.rilevazione_classi_kg || {}).reduce((s, [c, v]) => s + ((c === 'ACI') === soloAci ? v : 0), 0);
  const mov = (m) => (m && (m.ingressi || m.uscite) ? ` · +${m.ingressi} −${m.uscite}` : '');
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`mt-1 text-xs flex items-center justify-end gap-1 cursor-help ${r.rilevazione_obsoleta ? 'text-amber-600' : 'text-muted-foreground'}`}>
            {r.rilevazione_obsoleta && <AlertTriangle className="w-3 h-3" />}
            <span className="underline decoration-dotted underline-offset-2">
              rilevato il {fmtDate(r.data_rilevazione)}{mov(d.rete)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm text-xs space-y-1">
          <div>Rilevazione del portale del {fmtDate(d.dal)}: rete {formatKg(kgRil(false))} kg (classi P, M, G1, G2), ACI {formatKg(kgRil(true))} kg (classe 9).</div>
          <div>Rete, finiti dopo la rilevazione: {d.rete.ingressi} ingressi per {formatKg(d.rete.ingressi_kg)} kg, {d.rete.uscite} uscite per {formatKg(d.rete.uscite_kg)} kg.</div>
          <div>ACI, finiti dopo la rilevazione: {d.aci.ingressi} ingressi per {formatKg(d.aci.ingressi_kg)} kg, {d.aci.uscite} uscite per {formatKg(d.aci.uscite_kg)} kg.</div>
          {r.giacenza_extra_t ? <div>Extra raccolta in piazzale, fuori portale: {fmt(r.giacenza_extra_t)} t.</div> : null}
          <div>Movimenti caricati fino al {fmtDate(r.aggiornata_al)}, per fine trasporto. {r.rilevazione_obsoleta ? RILEVAZ_OBSOLETA_TOOLTIP : ''}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// La giacenza di un impianto: la fotografia del portale aggiornata ai caricamenti.
function DettaglioImpianto({ r }) {
  const f = r.fotografia;
  if (!f) return null;
  const aggiornata = f.aggiunti > 0 || f.dichiarato_dopo_t > 0;
  return (
    <div className="mt-1 text-xs text-muted-foreground" title="La giacenza a portale segue i caricamenti: alla fotografia si aggiungono i carichi che il file del portale non contiene ancora, riconosciuti dal numero d'ordine, e si tolgono le dichiarazioni caricate dopo">
      {f.del ? `file del portale del ${fmtDate(f.del)}: ${fmt(f.foto_t)} t` : 'nessun file del portale'}
      {f.rete_non_dichiarata && <span className="block">la rete non la dichiara per accordo: il portale non ne tiene la giacenza per noi, e i carichi non si aggiungono</span>}
      {aggiornata && <span className="block">{f.aggiunti > 0 ? `+ ${fmt(f.aggiunti_t)} t di ${f.aggiunti} carichi non ancora nel file` : ''}{f.dichiarato_dopo_t > 0 ? ` − ${fmt(f.dichiarato_dopo_t)} t dichiarate dopo` : ''}</span>}
    </div>
  );
}

// I formulari terminati con le date da sistemare di questo soggetto, per canale
// (regola dell'utente, 22/09/2026). Qui il riassunto; l'elenco degli ordini sta
// nelle anomalie in cima alla pagina e nell'export.
function DateRiga({ r }) {
  const gruppi = r.date_da_sistemare || [];
  if (!gruppi.length) return null;
  const nome = { RETE: 'rete', ACI: 'ACI', EXTRA_RACCOLTA: 'extra' };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mt-0.5 text-[11px] text-amber-700 flex items-center gap-1 cursor-help">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="underline decoration-dotted underline-offset-2">
              date da sistemare: {gruppi.map(g => `${nome[g.canale] || g.canale} ${g.n}`).join(' · ')}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm text-xs space-y-1">
          {gruppi.map(g => <div key={g.canale}><strong>{riassuntoGruppo(g)}.</strong> {g.avviso}</div>)}
          <div>Immissione, inizio e fine trasporto sono obbligatorie. Gli ordini sono elencati nelle anomalie, in cima alla pagina.</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function SituazioneTable({ righe, totali, onVaiDaDichiarare }) {
  const maxGiacenza = Math.max(...righe.map(r => r.giacenza_portale_t || 0), 0.01);
  const kg = (r, c) => (r.giacenza_classi_kg ? r.giacenza_classi_kg[c] || 0 : null);

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold" rowSpan={2}>Sito</th>
              <th className="px-3 py-2 font-semibold" rowSpan={2}>Ruolo</th>
              <th className="px-3 py-2 font-semibold text-right" rowSpan={2} title="Rete: per gli impianti la fotografia del portale aggiornata ai caricamenti, per gli stoccaggi la rilevazione per classe aggiornata con i movimenti. L'ACI e' nella sua colonna e non si somma">Giacenza rete a portale</th>
              <th className="px-3 pt-2 pb-0 font-semibold text-center border-l" colSpan={CLASSI.length}>Giacenza per classe (kg)</th>
              <th className="px-3 py-2 font-semibold text-right border-l" rowSpan={2}>In attesa di dichiarazione</th>
              <th className="px-3 py-2 font-semibold text-right" rowSpan={2}>Ordini da dichiarare</th>
              <th className="px-3 py-2 font-semibold text-right" rowSpan={2}>Dichiarato nell'anno</th>
              <th className="px-3 py-2 font-semibold" rowSpan={2}>Tipologia trattamento</th>
            </tr>
            <tr>
              {CLASSI.map((c, i) => (
                <th key={c.chiave} className={`px-3 pb-2 pt-1 font-medium text-right text-xs ${i === 0 ? 'border-l' : ''}`} title={c.aiuto}>{c.titolo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {righe.map((r, i) => {
              const barWidth = Math.max((r.giacenza_portale_t / maxGiacenza) * 100, 1);
              return (
                <tr key={i} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">{r.sito}<DateRiga r={r} /></td>
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
                    {r.tipo_destinazione === 'stoc' && r.data_rilevazione && <DettaglioStoccaggio r={r} />}
                    {r.tipo_destinazione === 'imp' && <DettaglioImpianto r={r} />}
                  </td>
                  {CLASSI.map((c, k) => {
                    const v = kg(r, c.chiave);
                    return (
                      <td key={c.chiave} className={`px-3 py-2 text-right tabular-nums ${k === 0 ? 'border-l' : ''} ${v < 0 ? 'text-red-600 font-semibold' : v ? '' : 'text-muted-foreground'}`}>
                        {v == null ? '—' : formatKg(v)}
                      </td>
                    );
                  })}
                  <td className={`px-3 py-2 text-right border-l ${r.in_attesa_dichiarazione_t > 0.01 ? 'text-amber-600' : ''}`}>
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
                      {formatIntero(r.ordini_da_dichiarare || 0)}
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
              {CLASSI.map((c, k) => (
                <td key={c.chiave} className={`px-3 py-2 text-right tabular-nums ${k === 0 ? 'border-l' : ''}`}>
                  {totali.giacenza_classi_kg ? formatKg(totali.giacenza_classi_kg[c.chiave] || 0) : '—'}
                </td>
              ))}
              <td className="px-3 py-2 text-right border-l">{fmt(totali.in_attesa_dichiarazione_t)} t</td>
              <td className="px-3 py-2 text-right">{formatIntero(totali.ordini_da_dichiarare || 0)}</td>
              <td className="px-3 py-2 text-right">{fmt(totali.dichiarato_t)} t</td>
              <td className="px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-3 py-2 text-xs text-muted-foreground italic">
        La giacenza a portale e' della rete, per classe come nel portale; l'ACI sta nella sua colonna e l'extra raccolta, che a portale non c'e', nel dettaglio dello stoccaggio: i canali non si sommano. Per gli impianti e' il peso degli ordini non ancora dichiarati del file del portale, aggiornato a ogni caricamento con i carichi che il file non contiene ancora e le dichiarazioni caricate dopo. Per gli stoccaggi e' il saldo rilevato dalla pagina Unita' Locali di Stoccaggio, aggiornato con gli ingressi e le uscite finiti dopo la rilevazione: passa col mouse sulla data per il dettaglio. Tutto per fine del trasporto: un terminato senza fine trasporto non si colloca in nessun periodo e non entra ne' fra i carichi aggiunti alla fotografia ne' fra i movimenti dopo la rilevazione finche' la data non arriva, mentre il portale, se lo conosce, lo conta; la riga del sito lo segnala, con le altre date obbligatorie che mancano. La colonna In attesa di dichiarazione indica invece materiale gia' partito da uno stoccaggio verso un impianto, che il portale continua ad attribuire allo stoccaggio finche' il destinatario non presenta la dichiarazione: non e' giacenza.
      </p>
    </div>
  );
}
