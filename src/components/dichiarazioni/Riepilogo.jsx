import React from 'react';
import CellaMese from '@/components/dichiarazioni/CellaMese';
import { MESI_BREVI, CANALI, MOTIVI_ASSENZA } from '@/lib/dichiarazioniImpianti';
import { formatTonnellate, formatKg } from '@/lib/utils';
import { Check, Mail, Minus } from 'lucide-react';

// Riepilogo: una riga per impianto e canale, una colonna per mese.
// Verde pieno = caricata a portale, verde chiaro = dichiarazione in mano,
// ambra = conferimenti senza dichiarazione.
//
// Solo impianti: uno stoccaggio non tratta e non dichiara. Quello che spedisce
// in secondaria sta sulla riga dell'impianto che lo riceve, nel mese in cui
// arriva, ed e' quell'impianto a dichiararlo.

const nomeCanale = (f) => {
  const c = CANALI.find(x => x.chiave === f.canale);
  return `${c ? c.nome : f.canale}${f.provenienza ? ` ${f.provenienza}` : ''}`;
};

export default function Riepilogo({ dati, onApri, soloLettura }) {
  // Un canale su cui l'impianto non ha mai dichiarato niente e su cui il portale
  // non aspetta niente non e' una riga di questa tabella: sarebbe dodici caselle
  // vuote. Gli ACI di Irigom, per esempio, ripartono come secondarie ed e' chi li
  // lavora a dichiararli.
  const tutte = dati.siti.filter(s => s.tipo_destinazione !== 'stoc').flatMap(s => s.flussi.map(f => ({ sito: s, flusso: f })));
  const righe = tutte.filter(({ flusso }) => flusso.dichiarato_totale_t > 0 || flusso.mesi.some(m => m.non_dichiarato_kg > 0));
  const nascoste = tutte.length - righe.length;
  // I formulari arrivati agli impianti senza fine trasporto non sono in nessuna
  // casella: si dice quanti e quanto pesano, canale per canale, mai sommati
  // (22/09/2026). Solo gli ARRIVI agli IMPIANTI, perche' le caselle sono quello:
  // il totale del canale contava anche gli stoccaggi e le terziarie, che qui non
  // comparirebbero comunque, e il numero "fuori dalle caselle" usciva gonfiato.
  // Ogni formulario arriva a un impianto solo: sommarli per impianto non conta
  // nessuno due volte.
  const impianti = dati.siti.filter(s => s.tipo_destinazione !== 'stoc');
  const fuoriDaiMesi = CANALI.map(c => {
    const gruppi = impianti.flatMap(s => (s.date_da_sistemare || []).filter(g => g.canale === c.chiave && g.ruolo !== 'stoc'));
    const quanti = (campo) => gruppi.reduce((tot, g) => tot + ((g.senza_fine && g.senza_fine[campo]) || 0), 0);
    return { nome: c.nome, n: quanti('arrivi_n'), kg: quanti('arrivi_kg') };
  }).filter(c => c.n > 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-600 inline-flex items-center justify-center"><Check className="w-3 h-3 text-white" /></span> caricata a portale</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-100 inline-flex items-center justify-center"><Mail className="w-3 h-3" /></span> dichiarazione in mano</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-50 border" /> conferimenti senza dichiarazione</span>
        <span className="flex items-center gap-1" title={MOTIVI_ASSENZA.solo_metalli.spiega}><span className="w-4 h-4 rounded bg-sky-50 border" /> solo metalli ferrosi</span>
        <span className="flex items-center gap-1" title={MOTIVI_ASSENZA.non_dovuta.spiega}><span className="w-4 h-4 rounded bg-slate-50 border inline-flex items-center justify-center"><Minus className="w-3 h-3 text-slate-500" /></span> non dovuta</span>
        <span>Le quantità sono in kg; i totali in tonnellate contano solo le dichiarazioni caricate.</span>
        <span>Gli stoccaggi non compaiono perché non dichiarano: le secondarie che spediscono stanno sulla riga dell&apos;impianto che le riceve.</span>
        {nascoste > 0 && <span>Non compaiono {nascoste === 1 ? 'una riga' : `${nascoste} righe`} su cui non c'è mai stata una dichiarazione e su cui il portale non aspetta niente.</span>}
      </div>
      {fuoriDaiMesi.length > 0 && (
        <p className="text-xs text-amber-800">
          Senza fine trasporto un formulario arrivato all&apos;impianto non è in nessun mese, e nelle caselle non compare finché la data non arriva:{' '}
          {fuoriDaiMesi.map(c => `${c.nome} ${c.n} (${formatKg(c.kg)} kg)`).join(' · ')}. Quali sono, nella scheda Impianti.
        </p>
      )}

      <div className="border rounded-xl bg-card" data-scorre-lato>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/50 min-w-[230px]">Impianto · canale</th>
              {MESI_BREVI.map(m => <th key={m} className="px-1 py-2 font-semibold text-center min-w-[74px]">{m}</th>)}
              <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Caricato (t)</th>
            </tr>
          </thead>
          <tbody>
            {righe.map(({ sito, flusso }, i) => (
              <tr key={`${sito.chiave}-${flusso.canale}-${flusso.provenienza}`} className={`border-b ${i % 2 ? 'bg-muted/20' : ''}`}>
                <td className="px-3 py-1.5 sticky left-0 bg-inherit">
                  <span className="font-medium">{sito.sito}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {nomeCanale(flusso)}{sito.operazione ? ` · ${sito.operazione}` : ''}
                    {flusso.da_stoccaggi_t > 0 ? ` · ${formatTonnellate(flusso.da_stoccaggi_t)} t da stoccaggi` : ''}
                  </span>
                </td>
                {flusso.mesi.map(m => (
                  <td key={m.mese} className="px-0.5 py-1">
                    <CellaMese mese={m} soloLettura={soloLettura} attesa={flusso.canale === 'RETE' && sito.dichiara_rete !== false && m.non_dichiarato_kg > 0} dove={{ canale: flusso.canale, dichiara_rete: sito.dichiara_rete }} onApri={() => onApri(sito, flusso, m)} />
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{formatTonnellate(flusso.dichiarato_caricato_t)}</td>
              </tr>
            ))}
            {righe.length === 0 && (
              <tr><td colSpan={14} className="text-center py-6 text-muted-foreground">Nessun impianto con movimenti o dichiarazioni per quest'anno.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
