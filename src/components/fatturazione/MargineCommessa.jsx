import React, { useState, useEffect, useMemo } from 'react';
import { anniDaScegliere, annoDiOggi } from '@/lib/periodoPagine';
import { oggiRoma } from '@/lib/giornoItaliano';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, FileSpreadsheet, AlertTriangle, Info } from 'lucide-react';
import { formatTonnellate, formatNumber, formatPercentuale } from '@/lib/utils';
import AvvisoCaricamenti from '@/components/shared/AvvisoCaricamenti';
import { TIPI_PASSIVA } from '@/lib/registroCaricamenti';
import { STILE_SURPLUS, nomiSurplusDistinti } from '@/lib/surplusVista';
import NomeSurplus from './NomeSurplus';

const NOMI = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const euro = (v) => (v === null || v === undefined ? '—' : formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const perc = (v) => (v === null || v === undefined ? '—' : `${formatPercentuale(v)}%`);
const conSegno = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${euro(Math.abs(v))}`);
// un importo col segno davanti all'euro: «+€ 1.268,40», «−€ 0,02»
const euroConSegno = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}€ ${euro(Math.abs(v))}`);
// «ottobre», «ottobre e novembre», «ottobre, novembre e dicembre»
const mesiAParole = (mesi) => {
  const m = (mesi || []).map(x => String(x).toLowerCase());
  return m.length > 1 ? `${m.slice(0, -1).join(', ')} e ${m[m.length - 1]}` : (m[0] || '');
};
const maiuscola = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

const COLONNE = [
  { titolo: 'Mese', valore: r => r.mese, tipo: 'testo', peso: 1 },
  { titolo: 'Tonnellate', valore: r => r.tonnellate, tipo: 't', peso: 0.9 },
  { titolo: 'Ricavo', valore: r => r.ricavo, tipo: 'euro', peso: 1.1 },
  { titolo: 'Costo raccolta', valore: r => r.costo_raccolta, tipo: 'euro', peso: 1.1 },
  { titolo: 'Costo impianti e stoccaggi', valore: r => r.costo_impianti, tipo: 'euro', peso: 1.3 },
  { titolo: 'Costo trasporto secondarie', valore: r => r.costo_trasporti, tipo: 'euro', peso: 1.3 },
  { titolo: 'Costo totale', valore: r => r.costo, tipo: 'euro', peso: 1.1 },
  { titolo: 'Margine', valore: r => r.margine, tipo: 'euro', peso: 1.1 },
  { titolo: 'Margine %', valore: r => (r.margine_pct === null ? '' : `${formatPercentuale(r.margine_pct)}%`), tipo: 'testo', peso: 0.8 },
  { titolo: 'Ricavo €/t', valore: r => r.ricavo_t, tipo: 'euro', peso: 0.9 },
  { titolo: 'Costo €/t', valore: r => r.costo_t, tipo: 'euro', peso: 0.9 },
  { titolo: 'Margine €/t', valore: r => r.margine_t, tipo: 'euro', peso: 0.9 },
];

// IL SURPLUS SULLE TARIFFE NEL MARGINE (il Fuel Surcharge, 13/10/2026). Ricavo e
// costo lo comprendono gia' (calcolaMargineAnno, base44/shared/margine.ts): qui
// si dice a parte quanto se ne incassa da Ecotyre, quanto si paga ai fornitori e
// quanto resta, con la ragione. Un surplus incassato e pagato sulle stesse
// tonnellate non cambia il margine; lo cambiano le tonnellate raccolte da SMOCO
// (incassato, non pagato), importi diversi fra attiva e passiva, un surplus solo
// da una parte. Senza surplus la pagina e il foglio sono quelli di prima.
const haSurplus = (c) => (c.anno?.surplus || []).length > 0 || (c.mesi || []).some(m => (m.surplus || []).length > 0);

/**
 * Il surplus di un canale: incassato, pagato, resta, e perche' resta qualcosa.
 * nome: quello che lo distingue da un altro record con lo stesso nome («Fuel
 * Surcharge a 5,00 €/t», revisione del 13/10/2026); senza, il suo nome.
 */
export function BloccoSurplus({ v, nome, conMesi = true }) {
  return (
    <div className={`rounded-md px-2.5 py-2 text-xs ${STILE_SURPLUS.fondo}`}>
      <p><NomeSurplus nome={nome || v.nome} />{conMesi && v.mesi && v.mesi.length > 0 && <span className="text-muted-foreground"> · {mesiAParole(v.mesi)}</span>}</p>
      <div className="grid grid-cols-3 gap-2 mt-1">
        <div><span className="block text-[11px] text-muted-foreground">Incassato</span><span className="tabular-nums font-medium">€ {euro(v.incassato)}</span></div>
        <div><span className="block text-[11px] text-muted-foreground">Pagato</span><span className="tabular-nums font-medium">€ {euro(v.pagato)}</span></div>
        <div><span className="block text-[11px] text-muted-foreground">Resta</span><span className={`tabular-nums font-semibold ${v.resta < 0 ? 'text-red-600' : ''}`}>{euroConSegno(v.resta)}</span></div>
      </div>
      {(v.perche || []).map((p, i) => <p key={i} className="text-[11px] text-muted-foreground mt-1">{maiuscola(p)}.</p>)}
    </div>
  );
}

/** Le colonne della tabella e del foglio di un canale: con un surplus nell'anno, tre in fondo. */
export function colonneMargine(c) {
  if (!haSurplus(c)) return COLONNE;
  return [
    ...COLONNE,
    { titolo: 'Surplus incassato', valore: r => ((r.surplus || []).length ? r.ricavo_surplus : null), tipo: 'euro', peso: 1 },
    { titolo: 'Surplus pagato', valore: r => ((r.surplus || []).length ? r.costo_surplus : null), tipo: 'euro', peso: 1 },
    { titolo: 'Surplus nel margine', valore: r => ((r.surplus || []).length ? r.surplus_netto : null), tipo: 'euro', peso: 1 },
  ];
}

/**
 * Che cosa dire sotto il margine (prova del cambio d'anno, 15/10/2026): con prezzi
 * che mancano «N righe senza prezzo: margine non calcolabile» (la frase la scrive
 * il calcolo, testo_prezzi_mancanti); senza tonnellate «nessun ricavo»; senza
 * ricavo ma con tonnellate non si scrive «nessun ricavo», che li' sarebbe falso.
 * Il 15/01/2027 la dashboard diceva «Rete € 0,00 · nessun ricavo · 7,10 t».
 */
export function sottoIlMargine(x) {
  if (!x) return '';
  if (x.testo_prezzi_mancanti) return x.testo_prezzi_mancanti;
  if (x.margine_pct !== null && x.margine_pct !== undefined) return `${formatPercentuale(x.margine_pct)}% del ricavo`;
  return Number(x.tonnellate) > 0 ? '— del ricavo' : 'nessun ricavo';
}

// La scheda di un canale per l'anno: il margine, ricavo e costo, e sotto il
// surplus dell'anno, uno per surplus (13/10/2026). Con prezzi che mancano il
// margine e' «—» col perche', e ricavo e costo si dicono parziali (15/10/2026).
export function SchedaMargine({ c, anno }) {
  const parziale = !!c.anno.parziale;
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-heading font-semibold">{NOMI[c.canale]} — {anno}</h3>
      <p className={`text-2xl font-bold mt-1 ${c.anno.margine < 0 ? 'text-red-600' : ''}`}>{c.anno.margine === null || c.anno.margine === undefined ? '—' : `€ ${euro(c.anno.margine)}`}</p>
      <p className={`text-xs ${parziale ? 'text-amber-700' : 'text-muted-foreground'}`}>margine · {sottoIlMargine(c.anno)}</p>
      {c.anno.testo_da_confermare && <p className="text-xs text-amber-700">{c.anno.testo_da_confermare}</p>}
      <div className="mt-3 pt-3 border-t text-xs space-y-1">
        <div className="flex justify-between"><span className="text-muted-foreground">Ricavo{parziale ? ' (parziale)' : ''}</span><span className="tabular-nums">€ {euro(c.anno.ricavo)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Costo{parziale ? ' (parziale)' : ''}</span><span className="tabular-nums">€ {euro(c.anno.costo)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Tonnellate</span><span className="tabular-nums">{formatTonnellate(c.anno.tonnellate)} t</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Per tonnellata: ricavo / costo / margine</span><span className="tabular-nums">{euro(c.anno.ricavo_t)} / {euro(c.anno.costo_t)} / {euro(c.anno.margine_t)}</span></div>
      </div>
      {(c.anno.surplus || []).length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] text-muted-foreground">Già dentro ricavo, costo e margine:</p>
          {c.anno.surplus.map((v, i, tutti) => <BloccoSurplus key={v.surplus_id || v.nome} v={v} nome={nomiSurplusDistinti(tutti)[i]} />)}
        </div>
      )}
      {/* Un terminato senza fine trasporto non e' in nessun mese, quindi
          nemmeno nel margine: si dice una volta per l'anno (22/09/2026) */}
      {c.senza_fine_trasporto && (
        <p className="mt-2 text-xs text-amber-700 flex items-start gap-1" title={c.senza_fine_trasporto.descrizione}>
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{c.senza_fine_trasporto.quanti} {c.senza_fine_trasporto.quanti === 1 ? 'terminato' : 'terminati'} senza fine trasporto ({formatTonnellate(c.senza_fine_trasporto.tonnellate)} t): fuori dal margine finché la data manca. L'elenco è nelle anomalie della passiva.</span>
        </p>
      )}
    </div>
  );
}

// La tabella dei mesi di un canale. Con un surplus nell'anno ha una colonna in
// piu', «di cui surplus €»: la parte del margine che viene dal surplus (quanto
// resta fra incassato e pagato), vuota nei mesi in cui il surplus non c'era; e
// sotto la tabella il surplus mese per mese, con la sua ragione.
export function TabellaMargine({ c }) {
  const conSurplus = haSurplus(c);
  const mesiSurplus = (c.mesi || []).filter(m => (m.surplus || []).length > 0);
  return (
    <>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-3 py-2 font-semibold">Mese</th>
            <th className="text-right px-3 py-2 font-semibold">t</th>
            <th className="text-right px-3 py-2 font-semibold">Ricavo €</th>
            <th className="text-right px-3 py-2 font-semibold">Raccolta €</th>
            <th className="text-right px-3 py-2 font-semibold">Impianti e stoccaggi €</th>
            <th className="text-right px-3 py-2 font-semibold">Secondarie €</th>
            <th className="text-right px-3 py-2 font-semibold">Costo €</th>
            <th className="text-right px-3 py-2 font-semibold">Margine €</th>
            {conSurplus && <th className="text-right px-3 py-2 font-semibold" title="Il surplus incassato da Ecotyre meno quello pagato ai fornitori: è già dentro il ricavo, il costo e il margine">di cui surplus €</th>}
            <th className="text-right px-3 py-2 font-semibold">%</th>
            <th className="text-right px-3 py-2 font-semibold">Margine €/t</th>
          </tr></thead>
          <tbody>
            {[...c.mesi, c.anno].map(r => {
              const rigaAnno = r.mese === 'Anno';
              // Vuoto e' un mese senza movimenti: un mese con tonnellate e
              // prezzi che mancano non e' vuoto, e' da sistemare (15/10/2026).
              const vuoto = !r.tonnellate && !r.ricavo && !r.costo;
              const suo = (r.surplus || []).length > 0;
              return (
                <tr key={r.mese} className={`border-t ${rigaAnno ? 'bg-primary/5 font-semibold border-t-2' : ''} ${vuoto && !rigaAnno ? 'text-muted-foreground' : ''}`}>
                  <td className="px-3 py-1.5">
                    {r.mese}
                    {(r.righe_senza_prezzo > 0 || r.anomalie_passiva > 0) && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-amber-700" title={r.testo_prezzi_mancanti || "Un'anomalia della passiva rende il margine meno affidabile: i dettagli sono nelle due fatturazioni."}>
                        <AlertTriangle className="w-3 h-3" />
                        {r.righe_senza_prezzo > 0 && `${r.righe_senza_prezzo} senza prezzo`}
                        {r.righe_senza_prezzo > 0 && r.anomalie_passiva > 0 && ' · '}
                        {r.anomalie_passiva > 0 && `${r.anomalie_passiva} ${r.anomalie_passiva === 1 ? 'anomalia' : 'anomalie'} in passiva`}
                      </span>
                    )}
                    {/* Con prezzi che mancano il margine del mese e' «—»: si dice
                        perche', e che ricavo e costo sono una parte (15/10/2026). */}
                    {r.testo_prezzi_mancanti && <span className="block text-[11px] font-normal text-amber-700">{r.testo_prezzi_mancanti}; ricavo e costo parziali</span>}
                    {r.testo_da_confermare && <span className="block text-[11px] font-normal text-amber-700">{r.testo_da_confermare}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatTonnellate(r.tonnellate)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{euro(r.ricavo)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{euro(r.costo_raccolta)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{euro(r.costo_impianti)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{euro(r.costo_trasporti)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{euro(r.costo)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${r.margine < 0 ? 'text-red-600' : ''}`}>{euro(r.margine)}</td>
                  {conSurplus && <td className={`px-3 py-1.5 text-right tabular-nums ${suo ? STILE_SURPLUS.fondo : ''}`}>{suo ? conSegno(r.surplus_netto) : ''}</td>}
                  <td className="px-3 py-1.5 text-right tabular-nums">{perc(r.margine_pct)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{euro(r.margine_t)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {mesiSurplus.length > 0 && (
        <div className="space-y-1">
          {mesiSurplus.flatMap(m => m.surplus.map((v, i, tutti) => (
            <div key={`${m.mese}|${v.surplus_id || v.nome}`} className={`rounded px-2.5 py-1.5 text-xs flex flex-wrap items-center gap-x-3 gap-y-0.5 ${STILE_SURPLUS.fondo}`}>
              <span className="font-medium w-20">{m.mese}</span>
              <NomeSurplus nome={nomiSurplusDistinti(tutti)[i]} />
              <span className="tabular-nums">incassato € {euro(v.incassato)}</span>
              <span className="tabular-nums">pagato € {euro(v.pagato)}</span>
              <span className="tabular-nums font-medium">resta {euroConSegno(v.resta)}</span>
              {(v.perche || []).length > 0 && <span className="text-muted-foreground basis-full sm:basis-auto">{v.perche.join('; ')}</span>}
            </div>
          )))}
        </div>
      )}
    </>
  );
}

/** Le opzioni del foglio Excel di un canale: con un surplus, le sue tre colonne e il sottotitolo che lo dice. */
export function opzioniFoglioMargine(c, anno) {
  const nomi = [...new Set((c.anno?.surplus || []).map(v => v.nome).filter(Boolean))];
  return {
    nomeFile: `Margine ${NOMI[c.canale]} ${anno}`,
    foglio: NOMI[c.canale],
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  MARGINE',
    titolo: `Margine ${NOMI[c.canale]} — ${anno}`,
    // Con prezzi che mancano le celle del margine restano vuote, e il
    // sottotitolo dice perche' (15/10/2026).
    sottotitolo: `Ricavo della fatturazione attiva meno costo della fatturazione passiva${nomi.length ? `; ricavo e costo comprendono ${nomi.join(' e ')}` : ''}${c.anno?.testo_prezzi_mancanti ? `. ${c.anno.testo_prezzi_mancanti}: dove mancano i prezzi le celle del margine sono vuote, ricavo e costo parziali` : ''}`,
    colonne: colonneMargine(c),
    righe: [...c.mesi, c.anno],
  };
}

// Il margine della commessa: ricavo della fatturazione attiva meno costo della
// passiva, per canale. Tre commesse, tre tabelle: non esiste un totale unico.
export default function MargineCommessa() {
  // Gli anni si contano quando la pagina si disegna, non quando il modulo si
  // carica (prova del cambio d'anno, 15/10/2026): con la scheda aperta dal 31/12,
  // il 04/01 la lista restava ferma al 2026. Come la Dashboard.
  const oggi = oggiRoma();
  const anni = useMemo(() => anniDaScegliere({ oggi }), [oggi]);
  const [anno, setAnno] = useState(() => annoDiOggi(oggi));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState('');
  const { toast } = useToast();

  const carica = async () => {
    setLoading(true); setErrore('');
    try {
      const res = await base44.functions.invoke('calcolaMargine', { anno });
      setData(res.data);
    } catch (e) {
      setData(null);
      setErrore(e?.response?.data?.error || e.message || 'Errore sconosciuto');
    }
    setLoading(false);
  };
  useEffect(() => { carica(); }, [anno]);

  const esporta = async (c) => {
    try {
      // esportaTabella si porta dietro jspdf e xlsx: si carica qui, al click.
      const { esportaTabellaExcel } = await import('@/lib/esportaTabella');
      await esportaTabellaExcel(opzioniFoglioMargine(c, data.anno));
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Anno</label>
          <Select value={String(anno)} onValueChange={v => setAnno(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{anni.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={carica} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />} Ricalcola
        </Button>
        <p className="text-xs text-muted-foreground max-w-2xl flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Sono gli stessi numeri delle due fatturazioni: il ricavo è il dovuto da Ecotyre, il costo è la passiva del mese. Il costo di un mese comprende stoccaggio, trattamento e secondarie di quel mese, che possono riguardare tonnellate raccolte prima: il singolo mese oscilla, il numero che conta è quello dell'anno. Un viaggio di secondaria che porta rete e ACI insieme, a prezzo per viaggio, pesa su tutti e due i margini in proporzione ai chili. I tre canali non si sommano.</span>
        </p>
      </div>

      {/* Il margine rifa' attiva e passiva: legge primarie e secondarie. Mentre
          si riscrivono, o dopo una riscrittura non riuscita, il margine e' a
          meta': lo si dice sopra i totali (11/10/2026). */}
      <AvvisoCaricamenti tipi={TIPI_PASSIVA} aggiorna={`${anno}|${loading}`} />

      {loading && <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo del margine sui dati di oggi...</div>}
      {errore && <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4 text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {errore}</div>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.canali.map(c => <SchedaMargine key={c.canale} c={c} anno={data.anno} />)}
          </div>

          {data.canali.map(c => (
            <div key={c.canale} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold">{NOMI[c.canale]}</h3>
                <Button variant="outline" size="sm" onClick={() => esporta(c)}><FileSpreadsheet className="w-4 h-4 mr-1.5" /> Excel</Button>
              </div>
              <TabellaMargine c={c} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
