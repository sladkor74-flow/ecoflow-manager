import React, { useState } from 'react';
import { formatTonnellate, formatKg } from '@/lib/utils';
import { TOLLERANZA_QUADRATURA_T, CANALI } from '@/lib/dichiarazioniImpianti';
import { CheckCircle2, AlertTriangle, PlusCircle } from 'lucide-react';

// Quadratura con il portale, un canale per volta: la giacenza che risulta dai
// movimenti e dalle dichiarazioni deve coincidere con quella del portale.
//
// La giacenza a portale non resta ferma al giorno del file degli ordini non
// dichiarati: segue ogni caricamento. Alla fotografia si aggiungono i carichi
// che il gestionale conosce e il file no - si riconoscono dal numero d'ordine -
// e si tolgono le dichiarazioni caricate dopo. Tutto per fine del trasporto,
// mai per data di chiusura a portale.

const t = (v) => (v === null || v === undefined ? '—' : formatTonnellate(Number(v) || 0));
const giorno = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '');
const nomeCanale = (c) => (CANALI.find(x => x.chiave === c) || { nome: c }).nome;

function Aggiunti({ s }) {
  const [aperto, setAperto] = useState(false);
  const righe = s.aggiunti_alla_foto || [];
  if (!righe.length) return null;
  return (
    <div className="text-[11px] text-muted-foreground mt-0.5">
      <button type="button" className="inline-flex items-center gap-1 text-sky-700 hover:underline" onClick={() => setAperto(v => !v)}>
        <PlusCircle className="w-3 h-3" />
        {righe.length} {righe.length === 1 ? 'carico aggiunto' : 'carichi aggiunti'} alla fotografia: {t(s.aggiunti_alla_foto_t)} t
      </button>
      {aperto && (
        <table className="mt-1 text-[11px]">
          <tbody>
            {righe.map(o => (
              <tr key={`${o.tipo}-${o.id_ordine}-${o.numero_fir}`}>
                <td className="pr-2 font-mono">{o.id_ordine}</td>
                <td className="pr-2">{o.tipo === 'secondaria' ? `secondaria da ${o.da}` : o.da}</td>
                <td className="pr-2">fine trasporto {giorno(o.fine_trasporto)}</td>
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
  const righe = [...dati.siti].sort((a, b) => (a.tipo_destinazione === b.tipo_destinazione ? 0 : a.tipo_destinazione === 'imp' ? -1 : 1)
    || Math.abs(b.scarto_t || 0) - Math.abs(a.scarto_t || 0));
  const foto = dati.foto_portale_il;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Un canale per volta. Per gli impianti è la <strong>rete</strong>: giacenza al 31/12 dell&apos;anno prima, più quello che è arrivato
        all&apos;impianto in primaria e in secondaria dagli stoccaggi, meno quello che è stato dichiarato e caricato. Deve dare la giacenza del
        portale, che parte dal file degli ordini non dichiarati{foto ? <> del <strong>{giorno(foto)}</strong></> : ''} e si aggiorna a ogni
        caricamento: si aggiungono i carichi che il gestionale conosce e il file non contiene ancora - riconosciuti dal numero d&apos;ordine - e
        si tolgono le dichiarazioni caricate dopo{dati.movimenti_fino_al ? <>; i movimenti caricati arrivano al <strong>{giorno(dati.movimenti_fino_al)}</strong></> : ''}.
        {' '}Per gli stoccaggi la giacenza a portale è la rilevazione per classe - P, M, G1 e G2 per la rete, la classe 9 per l&apos;ACI - più i
        movimenti finiti dopo. Tutto per fine del trasporto. In linea fino a {formatTonnellate(TOLLERANZA_QUADRATURA_T)} t di scarto.
      </p>

      <div className="border rounded-xl bg-card" data-scorre-lato>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/50 min-w-[230px]">Impianto · canale</th>
              <th className="text-right px-2 py-2 font-semibold">Giacenza iniziale</th>
              <th className="text-right px-2 py-2 font-semibold">Entrato</th>
              <th className="text-right px-2 py-2 font-semibold">Uscito in secondaria</th>
              <th className="text-right px-2 py-2 font-semibold">Dichiarato caricato</th>
              <th className="text-right px-2 py-2 font-semibold">Giacenza calcolata</th>
              <th className="text-right px-2 py-2 font-semibold" title="Il file degli ordini non dichiarati, o la rilevazione dello stoccaggio">A portale, fotografia</th>
              <th className="text-right px-2 py-2 font-semibold" title="Carichi che il gestionale conosce e il file del portale non contiene ancora">+ non ancora nel file</th>
              <th className="text-right px-2 py-2 font-semibold" title="Dichiarazioni caricate a portale dopo il giorno del file">− dichiarato dopo</th>
              <th className="text-right px-2 py-2 font-semibold">Giacenza a portale aggiornata</th>
              <th className="text-right px-2 py-2 font-semibold">Scarto</th>
              <th className="text-left px-3 py-2 font-semibold">Esito</th>
            </tr>
          </thead>
          <tbody>
            {righe.map(s => {
              const stoc = s.tipo_destinazione === 'stoc';
              return (
                <tr key={s.chiave} className="border-b last:border-b-0 align-top">
                  <td className="px-3 py-1.5 sticky left-0 bg-card">
                    <span className="font-medium">{s.sito}</span>
                    <span className="text-[11px] text-muted-foreground block">
                      {stoc ? `stoccaggio · ${nomeCanale(s.canale)}` : 'impianto · rete'}
                      {stoc && s.rilevazione_il ? ` · rilevazione del ${giorno(s.rilevazione_il)}` : ''}
                    </span>
                    {!stoc && <Aggiunti s={s} />}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{t(s.giacenza_iniziale_t)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{t(s.entrato_confronto_t)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{s.uscito_confronto_t ? t(s.uscito_confronto_t) : '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{stoc ? '—' : t(s.dichiarato_caricato_rete_t)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">{t(s.giacenza_calcolata_t)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{stoc ? (s.giacenza_portale_t === null ? '—' : 'rilevazione') : t(s.giacenza_portale_foto_t)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{!stoc && s.aggiunti_alla_foto_t ? `+ ${t(s.aggiunti_alla_foto_t)}` : '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{!stoc && s.dichiarato_dopo_foto_t ? `− ${t(s.dichiarato_dopo_foto_t)}` : '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">{t(s.giacenza_portale_t)}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${s.quadra === false ? 'text-red-700' : ''}`}>{t(s.scarto_t)}</td>
                  <td className="px-3 py-1.5">
                    {s.quadra === true && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> quadra</span>}
                    {s.quadra === false && <span className="inline-flex items-center gap-1 text-red-700"><AlertTriangle className="w-3.5 h-3.5" /> da verificare</span>}
                    {s.quadra === null && <span className="text-muted-foreground" title="Questo sito non compare fra gli ordini non dichiarati del portale e non ha una rilevazione di giacenza: non c'è un valore da confrontare">nessun dato a portale</span>}
                    {!stoc && Math.abs((s.dichiarato_portale_t || 0) - (s.dichiarato_caricato_rete_t || 0)) > 0.5 && (
                      <span className="block text-[11px] text-amber-700" title="Quello che risulta dichiarato nel report del portale per i carichi dell'anno. Una dichiarazione che il portale ha agganciato a carichi dell'anno prima non compare qui: la differenza non è per forza un mese sfuggito.">
                        nel report del portale risultano {t(s.dichiarato_portale_t)} t dichiarate
                      </span>
                    )}
                    {stoc && s.in_attesa_dichiarazione_t > 0 && (
                      <span className="block text-[11px] text-muted-foreground">{t(s.in_attesa_dichiarazione_t)} t ancora in piazzale secondo il file del portale</span>
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
}
