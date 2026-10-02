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
  // Una riga si mostra anche quando nel mese sono ARRIVATI dei carichi e non
  // sono ancora dichiarati, non solo quando lo dice la fotografia del portale:
  // la fotografia e' di un giorno preciso e puo' essere vecchia di settimane, e
  // un impianto che ha ricevuto a settembre spariva dal riepilogo invece di
  // comparire con «da chiedere» (regola dell'utente, 01/10/2026).
  const righe = tutte.filter(({ flusso }) => flusso.dichiarato_totale_t > 0
    || flusso.mesi.some(m => m.non_dichiarato_kg > 0 || m.da_dichiarare_kg > 0));
  const nascoste = tutte.length - righe.length;
  // I formulari arrivati agli impianti senza fine trasporto non sono in nessuna
  // casella: si dice quanti e quanto pesano, canale per canale, mai sommati
  // (22/09/2026). Solo gli ARRIVI agli IMPIANTI, perche' le caselle sono quello:
  // il totale del canale contava anche gli stoccaggi e le terziarie, che qui non
  // comparirebbero comunque, e il numero "fuori dalle caselle" usciva gonfiato.
  // Ogni formulario arriva a un impianto solo: sommarli per impianto non conta
  // nessuno due volte.
  const impianti = dati.siti.filter(s => s.tipo_destinazione !== 'stoc');
  // GLI ORDINI IN LIMBO: "eseguito" a portale, e il pulsante Chiudi mai premuto.
  //
  // Hanno tutti i dati dentro - peso, formulario, date - ma finche' restano cosi'
  // il gestionale non li conta da nessuna parte, perche' conta i terminati. Quei
  // chili non sono in nessuna casella di questa tabella, e senza questo avviso il
  // totale sembra completo: e' il modo peggiore di perdere un dato.
  //
  // Chiesto dall'utente il 02/10/2026 dopo il caso di Green Tyre: due ritiri di
  // Torres del 30 settembre, 11.700 kg, che a portale non comparivano ne' fra i
  // dichiarati ne' fra i non dichiarati, e la pagina mostrava meno del vero senza
  // dire perche'.
  const inLimbo = impianti.flatMap(s => (s.eseguiti || []).map(e => ({ sito: s.sito, chiave: s.chiave, ...e })));
  const limboKg = inLimbo.reduce((t, e) => t + e.kg, 0);
  const limboOrdini = inLimbo.reduce((t, e) => t + e.ordini, 0);
  // Per riga: la casella non puo' dirlo da sola, perche' quei chili non stanno in
  // nessun mese. Si dice sotto il nome dell'impianto, sul canale giusto.
  const limboDi = (sito, canale) => inLimbo.find(e => e.chiave === sito.chiave && e.canale === canale);

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
      {inLimbo.length > 0 && (
        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
          <p>
            <strong>{limboOrdini === 1 ? "Un ordine è" : `${limboOrdini} ordini sono`} in stato «eseguito» a portale e non {limboOrdini === 1 ? "è stato chiuso" : "sono stati chiusi"}:</strong>{" "}
            {formatKg(limboKg)} kg che non sono in nessuna casella di questa tabella, perché il gestionale conta i formulari chiusi.
            Hanno già tutti i dati: manca solo il pulsante Chiudi, a portale. Finché resta così, quei chili non risultano né raccolti né da dichiarare.
          </p>
          <ul className="pl-4 list-disc">
            {inLimbo.map(e => (
              <li key={`${e.chiave}-${e.canale}`}>
                <span className="font-medium">{e.sito}</span> · {(CANALI.find(c => c.chiave === e.canale) || { nome: e.canale }).nome} ·{" "}
                {e.ordini === 1 ? "1 ordine" : `${e.ordini} ordini`} ({formatKg(e.kg)} kg)
                {e.mesi.length ? ` · ${e.mesi.join(", ")}` : " · senza fine trasporto"}
                {e.esempi.length ? <span className="text-amber-800">{" — "}{e.esempi.map(o => o.id_ordine || o.numero_fir).filter(Boolean).join(", ")}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border rounded-xl bg-card" data-scorre-lato>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/50 min-w-[230px]">Impianto · canale</th>
              {MESI_BREVI.map(m => <th key={m} className="px-1 py-2 font-semibold text-center min-w-[74px]">{m}</th>)}
              <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Caricato (t)</th>
              <th className="px-3 py-2 font-semibold text-right whitespace-nowrap" title="La giacenza di rete: quello che e arrivato, meno quello che e stato davvero caricato a portale. E il residuo da dichiarare, lo stesso numero della scheda Impianti. Dove l impianto dichiara mese per mese coincide con la somma dei mesi non dichiarati; dove dichiara quando il prodotto esce (R1, CSS-C) no, e vale la giacenza.">Da dichiarare (t)</th>
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
                    {/* Una dichiarazione la si aspetta se qualcosa e' arrivato
                        e non e' ancora dichiarato: lo dicono i nostri ingressi
                        (da_dichiarare_kg), non solo la fotografia del portale. */}
                    <CellaMese mese={m} soloLettura={soloLettura} attesa={flusso.canale === 'RETE' && sito.dichiara_rete !== false && (m.da_dichiarare_kg > 0 || m.non_dichiarato_kg > 0)} dove={{ canale: flusso.canale, dichiara_rete: sito.dichiara_rete }} onApri={() => onApri(sito, flusso, m)} />
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{formatTonnellate(flusso.dichiarato_caricato_t)}</td>
                {/* QUANTO RESTA DA DICHIARARE, SU TUTTA LA RIGA.

                    E LA GIACENZA, non la somma dei mesi non dichiarati. Le due cose
                    coincidono dove l impianto dichiara mese per mese - Gatim 234,41,
                    Green Tyre 260,20, gli stessi numeri - ma non dove dichiara quando
                    il prodotto esce. Irigom e un R1: il mese in cui parte la nave
                    dichiara piu di quanto gli e arrivato in quel mese, e sommando i
                    mesi con il max a zero quell eccedenza si perdeva: usciva 1.301,08
                    invece di 543,22. Parole dell utente, 02/10/2026: «il residuo da
                    dichiarare di Irigom e pari alla sua giacenza», e «non devi sommare
                    tutto quando le uscite sono di solo ferro perche quello poi va via
                    con la nave successiva».

                    La giacenza il gestionale la calcola gia e la confronta col portale
                    (giacenza_calcolata_t, scheda Impianti): cosi le due schede dicono
                    lo stesso numero. Vale per la rete, che e il canale che il portale
                    tiene; sugli altri resta la somma dei mesi.

                    Dove la dichiarazione non e dovuta per accordo la colonna tace: non
                    e un arretrato. */}
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                  {(() => {
                    if (flusso.canale === 'RETE' && sito.dichiara_rete === false) return <span className="text-muted-foreground">—</span>;
                    const resta = flusso.canale === 'RETE' ? sito.giacenza_calcolata_t : flusso.da_dichiarare_t;
                    return resta > 0
                      ? <span className="text-amber-700">{formatTonnellate(resta)}</span>
                      : <span className="text-muted-foreground">—</span>;
                  })()}
                </td>
              </tr>
            ))}
            {righe.length === 0 && (
              <tr><td colSpan={15} className="text-center py-6 text-muted-foreground">Nessun impianto con movimenti o dichiarazioni per quest'anno.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
