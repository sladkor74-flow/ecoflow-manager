import React, { useState } from 'react';
import { formatTonnellate, formatKg } from '@/lib/utils';
import { TOLLERANZA_QUADRATURA_T } from '@/lib/dichiarazioniImpianti';
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

// Quadratura con il portale: la giacenza che risulta dalle dichiarazioni deve
// coincidere con quella del modulo Giacenze del portale, che è il conferito non
// ancora dichiarato.
//
// Il confronto si fa con quello che il portale conosceva il giorno della
// fotografia, cioè con gli ordini che quel giorno erano CHIUSI. Un carico
// arrivato prima e chiuso dopo è vero ed è già in piazzale, ma il portale non
// l'aveva ancora contato: non è uno scarto, e si mostra ordine per ordine.

const t = (v) => (v === null || v === undefined ? '—' : formatTonnellate(Number(v) || 0));
const giorno = (g) => (g ? g.split('-').reverse().join('/') : '');

function InViaggio({ s }) {
  const [aperto, setAperto] = useState(false);
  if (!s.in_viaggio_a_portale || !s.in_viaggio_a_portale.length) return null;
  const n = s.in_viaggio_a_portale.length;
  return (
    <div className="text-[11px] text-muted-foreground mt-0.5">
      <button type="button" className="inline-flex items-center gap-1 text-sky-700 hover:underline" onClick={() => setAperto(v => !v)}>
        <Clock className="w-3 h-3" />
        {n} {n === 1 ? 'carico arrivato' : 'carichi arrivati'} prima della fotografia e {n === 1 ? 'chiuso' : 'chiusi'} a portale dopo: {t(s.in_viaggio_a_portale_t)} t
      </button>
      {aperto && (
        <table className="mt-1 text-[11px]">
          <tbody>
            {s.in_viaggio_a_portale.map(o => (
              <tr key={`${o.tipo}-${o.id_ordine}-${o.numero_fir}`}>
                <td className="pr-2 font-mono">{o.id_ordine}</td>
                <td className="pr-2">{o.tipo === 'secondaria' ? `secondaria da ${o.da}` : o.da}</td>
                <td className="pr-2">arrivato il {giorno(o.fine_trasporto)}</td>
                <td className="pr-2">chiuso il {giorno(o.chiuso_il)}</td>
                <td className="text-right tabular-nums">{formatKg(o.kg)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Quadratura({ dati }) {
  const righe = [...dati.siti].sort((a, b) => Math.abs(b.scarto_t || 0) - Math.abs(a.scarto_t || 0));
  const foto = dati.foto_portale_il;
  const vecchia = foto && dati.movimenti_chiusi_fino_al && dati.movimenti_chiusi_fino_al > foto;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Giacenza al 31/12 dell&apos;anno prima, più quello che è arrivato all&apos;impianto dalla rete - in primaria e in secondaria dagli
        stoccaggi - meno quello che è stato dichiarato e caricato: deve dare la giacenza del portale. Si considera in linea uno scarto fino
        a {formatTonnellate(TOLLERANZA_QUADRATURA_T)} t.
        {foto && <> Il confronto è con quello che il portale conosceva il <strong>{giorno(foto)}</strong>, giorno dell&apos;ultimo file degli
          ordini non dichiarati: il portale mette un carico in giacenza quando <strong>chiude</strong> l&apos;ordine, non quando il camion arriva.
          Quello che è stato chiuso dopo lo trovi nella colonna «chiuso dopo».</>}
        {' '}ACI ed extra raccolta restano fuori: hanno un giro proprio e non entrano nella giacenza del portale.
        {' '}Gli stoccaggi fanno eccezione, perché la loro giacenza a portale è la rilevazione fisica per classi: lì il conto si fa su quello
        che c&apos;è davvero in piazzale, di qualunque canale.
      </p>

      {vecchia && (
        <div className="flex items-start gap-2 border border-sky-200 bg-sky-50 text-sky-900 rounded-lg px-3 py-2 text-sm">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            I movimenti del gestionale arrivano al <strong>{giorno(dati.movimenti_chiusi_fino_al)}</strong>, la fotografia del portale è del{' '}
            <strong>{giorno(foto)}</strong>. Il confronto resta giusto, perché si fa con quello che il portale conosceva quel giorno; per
            vedere anche gli ultimi giorni carica in «Caricamento Dati» il file «Ordini non dichiarati» e il «Report Dichiarazioni di trattamento» di oggi.
          </span>
        </div>
      )}

      <div className="border rounded-xl bg-card" data-scorre-lato>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/50 min-w-[220px]">Impianto</th>
              <th className="text-right px-2 py-2 font-semibold">Giacenza iniziale</th>
              <th className="text-right px-2 py-2 font-semibold">Arrivato rete</th>
              <th className="text-right px-2 py-2 font-semibold" title="Ordini chiusi a portale dopo la fotografia: il portale non li conosceva ancora">chiuso dopo</th>
              <th className="text-right px-2 py-2 font-semibold">Secondarie in</th>
              <th className="text-right px-2 py-2 font-semibold">Secondarie out</th>
              <th className="text-right px-2 py-2 font-semibold">Dichiarato caricato (rete)</th>
              <th className="text-right px-2 py-2 font-semibold">Dichiarato a portale</th>
              <th className="text-right px-2 py-2 font-semibold">Giacenza calcolata</th>
              <th className="text-right px-2 py-2 font-semibold">Giacenza a portale</th>
              <th className="text-right px-2 py-2 font-semibold">Scarto</th>
              <th className="text-left px-3 py-2 font-semibold">Esito</th>
            </tr>
          </thead>
          <tbody>
            {righe.map(s => (
              <tr key={`${s.chiave}-${s.tipo_destinazione}`} className="border-b last:border-b-0 align-top">
                <td className="px-3 py-1.5 sticky left-0 bg-card">
                  <span className="font-medium">{s.sito}</span>
                  {s.tipo_destinazione === 'stoc' && <span className="text-[11px] text-muted-foreground block">stoccaggio</span>}
                  <InViaggio s={s} />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{t(s.giacenza_iniziale_t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{t(s.conferito_alla_foto_t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{s.conferito_dopo_foto_t ? t(s.conferito_dopo_foto_t) : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{s.secondarie_in_alla_foto_t ? t(s.secondarie_in_alla_foto_t) : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{s.secondarie_out_alla_foto_t ? t(s.secondarie_out_alla_foto_t) : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{t(s.dichiarato_caricato_rete_t)}</td>
                <td
                  className={`px-2 py-1.5 text-right tabular-nums ${Math.abs((s.dichiarato_portale_t || 0) - (s.dichiarato_caricato_rete_t || 0)) > 0.5 ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}
                  title="Quello che risulta dichiarato nei report del portale per gli ordini chiusi nell'anno. Una dichiarazione che il portale ha collegato a ordini dell'anno prima non compare qui: la differenza non è per forza un mese sfuggito."
                >
                  {t(s.dichiarato_portale_t)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">{t(s.giacenza_calcolata_t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                  {t(s.giacenza_portale_t)}
                  {s.rilevazione_stoccaggio_t > 0 && (
                    <span className="block text-[10px] font-normal text-muted-foreground" title="Giacenza rilevata nel suo stoccaggio: sta nella scheda Stoccaggi e non entra nel conto dell'impianto">
                      + {t(s.rilevazione_stoccaggio_t)} allo stoccaggio
                    </span>
                  )}
                </td>
                <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${s.quadra === false ? 'text-red-700' : ''}`}>{t(s.scarto_t)}</td>
                <td className="px-3 py-1.5">
                  {s.quadra === true && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> quadra</span>}
                  {s.quadra === false && <span className="inline-flex items-center gap-1 text-red-700"><AlertTriangle className="w-3.5 h-3.5" /> da verificare</span>}
                  {s.quadra === null && <span className="text-muted-foreground" title="Questo sito non compare fra gli ordini non dichiarati del portale e non ha una rilevazione di giacenza: non c'è un valore da confrontare">nessun dato a portale</span>}
                  {s.in_attesa_dichiarazione_t > 0 && s.tipo_destinazione === 'stoc' && (
                    <span className="block text-[11px] text-muted-foreground">{t(s.in_attesa_dichiarazione_t)} t ancora in piazzale secondo il portale</span>
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
