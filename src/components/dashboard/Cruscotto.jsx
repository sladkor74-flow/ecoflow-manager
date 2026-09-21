import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertTriangle, AlertOctagon, Info, CheckCircle, ArrowRight, Hourglass, DatabaseZap, Scale, FileCheck } from 'lucide-react';
import { formatIntero, formatNumber, formatPercentuale, fmtTon } from '@/lib/utils';

const NOMI_FILE = { primarie: 'Primarie e assegnati', secondarie: 'Secondarie', terziarie: 'Terziarie', ordini_non_dichiarati: 'Ordini non dichiarati', dichiarazioni_trattamento: 'Dichiarazioni di trattamento', pdr: 'Punti di raccolta' };
const NOMI_CANALE = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const TONI = {
  critico: { Icona: AlertOctagon, riga: 'border-red-200 bg-red-50', testo: 'text-red-800', etichetta: 'critico' },
  attenzione: { Icona: AlertTriangle, riga: 'border-amber-200 bg-amber-50', testo: 'text-amber-900', etichetta: 'attenzione' },
  info: { Icona: Info, riga: 'border-border bg-muted/30', testo: 'text-foreground', etichetta: 'da sapere' },
};
const giorno = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');
const euro = (v) => (v === null || v === undefined ? '—' : formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// La prima cosa che si vede aprendo il gestionale: che cosa richiede attenzione,
// tutto insieme e ordinato per gravita', con il collegamento al punto in cui si
// risolve. Poi l'arretrato, la freschezza dei dati, i mesi della fatturazione e,
// per l'amministratore, il margine per canale. I canali non si sommano mai.
export default function Cruscotto({ isAdmin }) {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState('');
  const [margine, setMargine] = useState(null);
  const [margineErrore, setMargineErrore] = useState('');

  useEffect(() => {
    let vivo = true;
    base44.functions.invoke('cruscottoOperativo', {})
      .then(r => { if (vivo) setDati(r.data); })
      .catch(e => { if (vivo) setErrore(e?.response?.data?.error || e.message); });
    return () => { vivo = false; };
  }, []);

  // Il margine rilegge gli archivi grandi: si chiede dopo, e solo per l'amministratore.
  useEffect(() => {
    if (!isAdmin) return undefined;
    let vivo = true;
    base44.functions.invoke('calcolaMargine', {})
      .then(r => { if (vivo) setMargine(r.data); })
      .catch(e => { if (vivo) setMargineErrore(e?.response?.data?.error || e.message); });
    return () => { vivo = false; };
  }, [isAdmin]);

  if (errore) return <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4 text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Il cruscotto non si è caricato: {errore}</div>;
  if (!dati) return <div className="flex items-center py-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Controllo di che cosa c'è da gestire...</div>;

  // Le anomalie di prezzo delle due fatturazioni arrivano dal margine: stessi numeri, stessa lista
  const daMargine = [];
  for (const c of margine?.canali || []) {
    for (const m of c.mesi) {
      if (m.righe_senza_prezzo > 0) daMargine.push({ area: 'Fatturazione attiva', gravita: 'critico', titolo: `${NOMI_CANALE[c.canale]}, ${m.mese}: ${m.righe_senza_prezzo} righe senza tariffa`, dettaglio: 'Fatturate a zero euro finché la tariffa manca.', link: '/fatturazione' });
      if (m.anomalie_passiva > 0) daMargine.push({ area: 'Fatturazione passiva', gravita: 'attenzione', titolo: `${NOMI_CANALE[c.canale]}, ${m.mese}: ${m.anomalie_passiva} ${m.anomalie_passiva === 1 ? 'anomalia' : 'anomalie'} in passiva`, dettaglio: 'Il dettaglio è nella fatturazione passiva del mese.', link: '/fatturazione' });
    }
  }
  const ordine = { critico: 0, attenzione: 1, info: 2 };
  const voci = [...dati.da_gestire, ...daMargine].sort((a, b) => ordine[a.gravita] - ordine[b.gravita]);
  const quanti = (g) => voci.filter(v => v.gravita === g).length;

  return (
    <div className="space-y-6">
      {/* L'elenco unico */}
      <div className="border rounded-lg p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-heading font-semibold text-lg">Da gestire</h2>
          <p className="text-xs text-muted-foreground">
            {voci.length === 0 ? 'niente in sospeso' : `${quanti('critico')} critici · ${quanti('attenzione')} da guardare · ${quanti('info')} da sapere`}
            {isAdmin && !margine && !margineErrore && ' · sto ancora controllando i prezzi delle fatturazioni…'}
          </p>
        </div>
        {voci.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-700 text-sm"><CheckCircle className="w-5 h-5" /> Nessuna anomalia aperta nei moduli controllati.</div>
        ) : (
          <div className="space-y-1.5">
            {voci.map((v, i) => {
              const t = TONI[v.gravita];
              return (
                <Link key={i} to={v.link} className={`flex items-start gap-3 border rounded-md px-3 py-2 hover:shadow-sm transition-shadow ${t.riga}`}>
                  <t.Icona className={`w-4 h-4 mt-0.5 shrink-0 ${t.testo}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${t.testo}`}><span className="text-xs font-normal opacity-70 mr-2">{v.area}</span>{v.titolo}</p>
                    {v.dettaglio && <p className="text-xs text-muted-foreground mt-0.5">{v.dettaglio}</p>}
                  </div>
                  <ArrowRight className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Il margine, per canale: solo amministratore */}
      {isAdmin && (
        <div className="border rounded-lg p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="font-heading font-semibold text-lg flex items-center gap-2"><Scale className="w-5 h-5 text-primary" /> Margine {margine?.anno || ''}</h2>
            <Link to="/fatturazione" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Mese per mese, in Fatturazione → Margine <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {margineErrore ? <p className="text-sm text-destructive">{margineErrore}</p>
            : !margine ? <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Calcolo sui dati di oggi...</div>
            : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {margine.canali.map(c => (
                  <div key={c.canale} className="border rounded-lg p-4">
                    <p className="text-sm font-medium">{NOMI_CANALE[c.canale]}</p>
                    <p className={`text-2xl font-heading font-bold mt-1 ${c.anno.margine < 0 ? 'text-red-600' : ''}`}>€ {euro(c.anno.margine)}</p>
                    <p className="text-xs text-muted-foreground">{c.anno.margine_pct === null ? 'nessun ricavo' : `${formatPercentuale(c.anno.margine_pct)}% del ricavo`} · {fmtTon(c.anno.tonnellate)}</p>
                    <div className="mt-2 pt-2 border-t text-xs space-y-0.5">
                      <div className="flex justify-between"><span className="text-muted-foreground">Ricavo</span><span className="tabular-nums">€ {euro(c.anno.ricavo)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Costo</span><span className="tabular-nums">€ {euro(c.anno.costo)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Per tonnellata</span><span className="tabular-nums">{euro(c.anno.ricavo_t)} − {euro(c.anno.costo_t)} = {euro(c.anno.margine_t)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          <p className="text-xs text-muted-foreground mt-2">Tre commesse, tre margini: non si sommano.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Arretrato per canale */}
        <div className="border rounded-lg p-5">
          <h2 className="font-heading font-semibold text-lg flex items-center gap-2 mb-3"><Hourglass className="w-5 h-5 text-primary" /> Ordini aperti: da quanto aspettano</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-1.5 font-medium">Canale</th><th className="py-1.5 font-medium text-right">Aperti</th><th className="py-1.5 font-medium text-right">≤ 30 gg</th><th className="py-1.5 font-medium text-right">31–60</th><th className="py-1.5 font-medium text-right">&gt; 60</th>
            </tr></thead>
            <tbody>
              {[['RETE', '/assegnati'], ['ACI', '/assegnati-aci']].map(([k, link]) => {
                const e = dati.arretrato[k];
                return (
                  <tr key={k} className="border-b last:border-0">
                    <td className="py-1.5"><Link to={link} className="text-primary hover:underline">{NOMI_CANALE[k]}</Link></td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{formatIntero(e.totale)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatIntero(e.entro_30)}</td>
                    <td className="py-1.5 text-right tabular-nums text-amber-600">{formatIntero(e.da_31_a_60)}</td>
                    <td className="py-1.5 text-right tabular-nums text-red-600 font-medium">{formatIntero(e.oltre_60)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {dati.arretrato.RETE.piu_vecchio && (
            <p className="text-xs text-muted-foreground mt-2">Il più vecchio della rete: {dati.arretrato.RETE.piu_vecchio.id_ordine} · {dati.arretrato.RETE.piu_vecchio.ragione_sociale}{dati.arretrato.RETE.piu_vecchio.provincia ? ` (${dati.arretrato.RETE.piu_vecchio.provincia})` : ''}, da {formatIntero(dati.arretrato.RETE.piu_vecchio.giorni)} giorni. Oltre 60 giorni: {fmtTon((dati.arretrato.RETE.kg_oltre_60 || 0) / 1000)} stimate.</p>
          )}
        </div>

        {/* Freschezza dei dati */}
        <div className="border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-lg flex items-center gap-2"><DatabaseZap className="w-5 h-5 text-primary" /> A quando sono aggiornati i dati</h2>
            <Link to="/caricamento-dati" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Carica <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {dati.caricamenti.archivi.map(a => (
                <tr key={a.tipo_file} className="border-b last:border-0">
                  <td className="py-1.5">{NOMI_FILE[a.tipo_file] || a.tipo_file}</td>
                  <td className="py-1.5 text-right tabular-nums">{giorno(a.il)}</td>
                  <td className={`py-1.5 text-right text-xs w-28 ${a.il === null || a.giorni_fa > 10 ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>{a.il === null ? 'mai caricato' : a.giorni_fa === 0 ? 'oggi' : a.giorni_fa === 1 ? 'ieri' : `${a.giorni_fa} giorni fa`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* I mesi della fatturazione attiva */}
      {dati.mesi_attiva.length > 0 && (
        <div className="border rounded-lg p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="font-heading font-semibold text-lg flex items-center gap-2"><FileCheck className="w-5 h-5 text-primary" /> Fatturazione attiva {dati.anno}: i mesi finiti</h2>
            <Link to="/fatturazione" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Apri la fatturazione <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {/* Ogni canale ha il suo documento e il suo stato: un mese con la rete
              elaborata e l'ACI no non e' "elaborato", e' indietro sull'ACI. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {dati.mesi_attiva.map(m => {
              const indietro = !m.elaborato || (m.canali_mancanti || []).length > 0;
              return (
                <div key={m.mese} className={`border rounded-md px-3 py-2 text-xs ${m.chiuso ? 'bg-emerald-50 border-emerald-200' : indietro ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                  <p className="font-medium text-sm">{m.mese}</p>
                  {m.canali
                    ? Object.entries(m.canali).map(([k, c]) => (
                      <p key={k} className={c.elaborato ? '' : 'text-amber-800 font-medium'}>{NOMI_CANALE[k]}: {c.stato}</p>
                    ))
                    : <p>{m.stato}</p>}
                  <p className="text-muted-foreground">{m.prefattura ? 'prefattura caricata' : 'senza prefattura'}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
