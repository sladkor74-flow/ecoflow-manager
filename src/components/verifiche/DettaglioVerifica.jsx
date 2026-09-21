import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Download, RefreshCw, Trash2, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet, FileText } from 'lucide-react';
import { dataIt, scaricaExcelVerifica, segnalazioni, analisiInCorso, ETICHETTE_ESITO, rigaReport, descriviLettura, sintesiVerifica, gravita, ordineRiga } from '@/lib/verifiche';
import { esportaEsitoVerificaPdf } from '@/lib/esitoVerificaPdf';
import { formatKg, formatIntero, dataServer } from '@/lib/utils';
import { conCampiCompleti, eliminaParti } from '@/lib/testoLungo';

// Formulari, chili ed esiti si mostrano per movimentazione e canale: rete, ACI
// ed extra raccolta non si sommano mai, nemmeno in una riga di totale o in una
// tessera di "ingressi nel gestionale".
const NOME_TIPO = { ingresso: 'Ingressi', uscita: 'Uscite' };
const NOME_CANALE = { rete: 'Rete', aci: 'ACI', extra: 'Extra raccolta', non_registrati: 'Non registrati per l\'impianto' };
const ORDINE_CANALI = ['rete', 'aci', 'extra', 'non_registrati'];

// Il canale di una riga del report e' quello della movimentazione a cui e'
// abbinata; le righe che il gestionale non registra per l'impianto non ne hanno.
function canaleRiga(e) {
  const parti = String(e.categoria || '').split('-');
  if (parti.length === 3) return parti[2];
  if (e.categoria === 'non_registrati' || !e.tipo || !e.gestionale) return 'non_registrati';
  return e.gestionale.canale || 'non_registrati';
}

/** Righe del report, conformi e da sistemare, canale per canale. */
function esitiPerCanale(esito) {
  return ORDINE_CANALI.map(canale => {
    const righe = (esito.esiti || []).filter(e => canaleRiga(e) === canale);
    const assenti = (esito.assenti || []).filter(a => (a.canale || 'rete') === canale);
    if (!righe.length && !assenti.length) return null;
    const anomala = (e) => (e.anomalia !== undefined ? !!e.anomalia : e.esito !== 'conforme');
    return {
      canale,
      righe: righe.length,
      conformi: righe.filter(e => e.esito === 'conforme').length,
      da_sistemare: righe.filter(anomala).length + assenti.length,
      assenti: assenti.length,
    };
  }).filter(Boolean);
}

/** "Ingressi primaria · rete, 3 formulari per 12.340 kg; ..." dalle righe della quadratura. */
const descriviRegistrati = (righe) => righe
  .map(q => `${q.nome}, ${formatIntero(q.formulari_gestionale)} ${q.formulari_gestionale === 1 ? 'formulario' : 'formulari'} per ${formatKg(q.kg_gestionale)} kg`)
  .join('; ');
const STILE_GRAVITA = { osservazione: 'text-sky-700', rettifica: 'text-slate-500' };
const ETICHETTA_GRAVITA = { osservazione: 'osservazione', rettifica: 'rettifica a nostra cura' };
const differenza = (n, kg) => (n === 0 ? '0' : `${n > 0 ? '+' : '-'}${kg ? formatKg(Math.abs(n)) : formatIntero(Math.abs(n))}`);

const STILE_ESITO = {
  conforme: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  discrepanze: 'bg-amber-100 text-amber-800 border-amber-200',
  non_trovata: 'bg-red-100 text-red-800 border-red-200',
  duplicata: 'bg-red-100 text-red-800 border-red-200',
};

function Tessera({ etichetta, valore, dettaglio, tono = '' }) {
  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="text-xs text-muted-foreground">{etichetta}</div>
      <div className={`text-xl font-bold tabular-nums ${tono}`}>{valore}</div>
      {dettaglio && <div className="text-xs text-muted-foreground">{dettaglio}</div>}
    </div>
  );
}

export default function DettaglioVerifica({ verificaId, isAdmin, open, onClose, onModificata }) {
  const [v, setV] = useState(null);
  const [caricando, setCaricando] = useState(false);
  const [lavorando, setLavorando] = useState(null);
  const [mostraConformi, setMostraConformi] = useState(false);
  const [mostraEscluse, setMostraEscluse] = useState(false);
  const { toast } = useToast();

  const carica = async () => {
    if (!verificaId) return;
    setCaricando(true);
    try {
      // Esito e lettura di un report lungo sono divisi in parti: si ricompongono qui.
      setV(await conCampiCompleti('VerificaReport', await base44.entities.VerificaReport.get(verificaId), ['esito_json', 'lettura_json']));
    } catch (e) {
      toast({ title: 'Verifica non disponibile', description: e.message || String(e), variant: 'destructive' });
    }
    setCaricando(false);
  };

  useEffect(() => { if (open) { setV(null); setMostraConformi(false); setMostraEscluse(false); carica(); } }, [open, verificaId]);

  // Mentre la verifica e' in corso il pannello si aggiorna da solo.
  useEffect(() => {
    if (!open || !analisiInCorso(v)) return undefined;
    const t = setTimeout(carica, 8000);
    return () => clearTimeout(t);
  }, [open, v]);

  if (!open) return null;

  const esito = v && v.esito_json ? JSON.parse(v.esito_json) : { esiti: [], assenti: [] };
  const escluse = esito.escluse || [];
  const sintesi = v && v.stato === 'completata' ? sintesiVerifica(v, esito) : null;
  const lettura = v && v.lettura_json ? JSON.parse(v.lettura_json) : {};
  const daSistemare = esito.esiti.filter(e => e.esito !== 'conforme');
  const conformi = esito.esiti.filter(e => e.esito === 'conforme');
  const perCanale = sintesi ? esitiPerCanale(esito) : [];
  // Movimentazioni con formulari registrati nella settimana, e fra queste le uscite.
  const registrate = sintesi ? sintesi.categorie.filter(q => q.chiave !== 'non_registrati' && q.formulari_gestionale > 0) : [];
  const usciteRegistrate = registrate.filter(q => q.tipo === 'uscita');

  const riesegui = async () => {
    setLavorando('riesegui');
    try {
      await base44.functions.invoke('elaboraReportSettimanale', { verifica_id: v.id, solo_verifica: true });
      toast({ title: 'Verifica ripetuta sui dati aggiornati del gestionale' });
    } catch (e) {
      const msg = (e && e.data && e.data.error) || (e && e.response && e.response.data && e.response.data.error);
      // Un 409 non e' un errore: un caricamento sta riscrivendo gli archivi e la verifica si rifa' a caricamento finito.
      const rinviata = !!((e && e.data && e.data.rinviato) || (e && e.response && e.response.data && e.response.data.rinviato));
      toast({ title: rinviata ? 'Verifica rinviata' : 'Verifica non riuscita', description: msg || e.message || String(e), variant: rinviata ? undefined : 'destructive' });
    }
    await carica();
    onModificata();
    setLavorando(null);
  };

  const elimina = async () => {
    if (!window.confirm(`Eliminare la verifica del report di ${v.soggetto_nome} per la settimana ${v.settimana}? L'operazione non si può annullare.`)) return;
    setLavorando('elimina');
    try {
      await eliminaParti('VerificaReport', v.id);
      await base44.entities.VerificaReport.delete(v.id);
      onModificata();
      onClose();
    } catch (e) {
      toast({ title: 'Eliminazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
    setLavorando(null);
  };

  const scaricaPdf = async () => {
    setLavorando('pdf');
    try {
      await esportaEsitoVerificaPdf(v);
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
    setLavorando(null);
  };

  const scarica = async () => {
    setLavorando('excel');
    try {
      await scaricaExcelVerifica(v);
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
    setLavorando(null);
  };

  return (
    <Sheet open={open} onOpenChange={(x) => { if (!x) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        {!v || caricando && !v ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Caricamento…</div>
        ) : (
          <>
            <SheetHeader className="text-left space-y-1">
              <SheetTitle className="text-xl pr-6">{v.soggetto_nome}</SheetTitle>
              <SheetDescription>
                Settimana {v.settimana} · dal {dataIt(v.data_inizio)} al {dataIt(v.data_fine)} · {v.file_nome}
                <br />
                {v.verificata_il ? `Verificato il ${dataServer(v.verificata_il).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}` : ''}
                {v.scade_il ? ` · si cancella il ${dataIt(v.scade_il)}` : ''}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button size="sm" onClick={scaricaPdf} disabled={v.stato !== 'completata' || lavorando === 'pdf'}>
                {lavorando === 'pdf' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
                PDF per l'impianto
              </Button>
              <Button size="sm" variant="outline" onClick={scarica} disabled={v.stato !== 'completata' || lavorando === 'excel'}>
                {lavorando === 'excel' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                Excel
              </Button>
              {isAdmin && (
                <>
                  <Button size="sm" variant="outline" onClick={riesegui} disabled={!v.righe_report_json || !!lavorando || analisiInCorso(v)}>
                    {lavorando === 'riesegui' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                    Ripeti la verifica
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={elimina} disabled={!!lavorando}>
                    <Trash2 className="w-4 h-4 mr-1" /> Elimina
                  </Button>
                </>
              )}
            </div>

            {analisiInCorso(v) && (
              <div className="mt-4 flex items-center gap-2 text-sm text-violet-700 border border-violet-200 bg-violet-50 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {v.stato === 'in_lettura' ? 'L\'agente sta leggendo il file…' : 'Confronto con il gestionale in corso…'}
              </div>
            )}

            {v.stato === 'errore' && (
              <div className="mt-4 flex items-start gap-2 text-sm text-red-800 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{v.errore}</span>
              </div>
            )}

            {v.stato === 'completata' && (
              <div className="mt-5 space-y-6">
                {lettura.trascritto_da_agente && (
                  <div className="flex items-start gap-2 text-sm text-amber-900 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>Il report non era un Excel: i formulari li ha trascritti l'agente. Prima di contestare un formulario errato, confrontalo con il documento originale.</span>
                  </div>
                )}

                {sintesi && (
                  <div className={`rounded-lg border px-4 py-3 ${sintesi.piena ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className={`flex items-center gap-2 font-semibold ${sintesi.piena ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {sintesi.piena ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                      {sintesi.dichiarazione || !sintesi.perCanale.length
                        ? (sintesi.piena ? 'Conformità piena' : 'Conformità parziale')
                        : sintesi.piena ? (sintesi.perCanale.length > 1 ? 'Conformità piena in ogni canale' : `Conformità piena · ${sintesi.perCanale[0].nome}`) : 'Esito per canale'}
                    </div>
                    {!sintesi.dichiarazione && sintesi.perCanale.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {sintesi.perCanale.map(c => (
                          <span key={c.canale} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${c.conformita === 'piena' ? 'border-emerald-300 bg-white text-emerald-800' : 'border-amber-300 bg-white text-amber-900 font-medium'}`}>
                            {c.conformita === 'piena' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {c.nome}: {c.conformita === 'piena' ? 'conformità piena' : `parziale, ${c.anomalie} ${c.anomalie === 1 ? 'anomalia' : 'anomalie'}${c.assenti ? ` (${c.assenti} formulari mancanti nel report)` : ''}`}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-sm mt-1 text-slate-700">
                      {sintesi.piena
                        ? 'Stessi formulari, stessi pesi effettivi e stesse date di fine trasporto dei formulari registrati.'
                        : !sintesi.dichiarazione && sintesi.perCanale.length
                          ? (sintesi.inPiu.length
                            ? `${sintesi.inPiu.length} ${sintesi.inPiu.length === 1 ? 'formulario del report non registrato' : 'formulari del report non registrati'}: il gestionale non li conosce, quindi non hanno canale.`
                            : 'Le anomalie di ciascun canale sono elencate qui sotto.')
                        : `${sintesi.numeroAnomalie} ${sintesi.numeroAnomalie === 1 ? 'anomalia' : 'anomalie'}: ${[
                          sintesi.anomalie.length ? `${new Set(sintesi.anomalie.map(a => a.esito)).size} righe con errori o sviste` : '',
                          sintesi.mancanti.length ? `${sintesi.mancanti.length} formulari mancanti nel report` : '',
                          sintesi.inPiu.length ? `${sintesi.inPiu.length} formulari non registrati` : '',
                        ].filter(Boolean).join(', ')}.`}
                    </div>
                  </div>
                )}

                {sintesi && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Quadratura di formulari e pesi</h4>
                    <div className="border rounded-lg overflow-x-auto bg-card">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium"></th>
                            <th className="text-right px-3 py-2 font-medium">Formulari report</th>
                            <th className="text-right px-3 py-2 font-medium">Registrati</th>
                            <th className="text-right px-3 py-2 font-medium">Diff.</th>
                            <th className="text-right px-3 py-2 font-medium">Kg report</th>
                            <th className="text-right px-3 py-2 font-medium">Kg registrati</th>
                            <th className="text-right px-3 py-2 font-medium">Diff. kg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sintesi.quadratura.length === 0 && (
                            <tr className="border-t"><td colSpan={7} className="px-3 py-2 text-muted-foreground">Nessuna movimentazione nel report né fra i formulari registrati.</td></tr>
                          )}
                          {sintesi.quadratura.map(q => {
                            const dF = q.formulari_report - q.formulari_gestionale;
                            const dK = q.kg_report - q.kg_gestionale;
                            return (
                              <tr key={q.chiave || q.tipo} className="border-t tabular-nums">
                                <td className="px-3 py-2">{q.nome || NOME_TIPO[q.tipo]}</td>
                                <td className="px-3 py-2 text-right">{formatIntero(q.formulari_report)}</td>
                                <td className="px-3 py-2 text-right">{formatIntero(q.formulari_gestionale)}</td>
                                <td className={`px-3 py-2 text-right font-medium ${dF ? 'text-red-600' : 'text-emerald-600'}`}>{differenza(dF)}</td>
                                <td className="px-3 py-2 text-right">{formatKg(q.kg_report)}</td>
                                <td className="px-3 py-2 text-right">{formatKg(q.kg_gestionale)}</td>
                                <td className={`px-3 py-2 text-right font-medium ${dK ? 'text-red-600' : 'text-emerald-600'}`}>{differenza(dK, true)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Una tessera per canale: righe del report, conformi e da sistemare
                    (compresi i registrati assenti nel report). Le righe che il
                    gestionale non registra per l'impianto hanno la loro, perche' un
                    canale non ce l'hanno. */}
                {perCanale.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {perCanale.map(c => (
                      <Tessera key={c.canale} etichetta={`${NOME_CANALE[c.canale] || c.canale} · da sistemare`} valore={c.da_sistemare}
                        tono={c.da_sistemare ? 'text-red-600' : 'text-emerald-600'}
                        dettaglio={[
                          `${c.righe} ${c.righe === 1 ? 'riga' : 'righe'} del report, ${c.conformi} ${c.conformi === 1 ? 'conforme' : 'conformi'}`,
                          c.assenti ? `${c.assenti} ${c.assenti === 1 ? 'registrato assente' : 'registrati assenti'} nel report` : '',
                        ].filter(Boolean).join(' · ')} />
                    ))}
                  </div>
                )}

                {lettura.modo === 'dichiarazione' && (
                  <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${v.conformita === 'piena' ? 'text-emerald-900 border-emerald-200 bg-emerald-50' : 'text-red-900 border-red-200 bg-red-50'}`}>
                    <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      L'impianto ha comunicato che nella settimana non ci sono state movimentazioni{v.nota ? ` (${v.nota})` : ''}.{' '}
                      {v.conformita === 'piena'
                        ? 'Nel gestionale non risultano formulari: la comunicazione è confermata.'
                        : `Nel gestionale risultano formulari registrati${registrate.length ? `: ${descriviRegistrati(registrate)}` : ''}. La comunicazione è smentita ed è stato aperto un alert.`}
                    </span>
                  </div>
                )}

                {usciteRegistrate.length > 0 && !v.uscite_verificate && lettura.modo !== 'dichiarazione' && (
                  <div className="flex items-start gap-2 text-sm text-red-900 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>Il report non contiene uscite, e le secondarie partite nella settimana mancano nel report: {descriviRegistrati(usciteRegistrate)}.</span>
                  </div>
                )}

                {lettura.modo === 'excel' && (
                  <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="space-y-0.5">
                      {descriviLettura(lettura).map((testo, i) => <span key={i} className="block">{testo}</span>)}
                    </span>
                  </div>
                )}

                {segnalazioni(v) === 0 && lettura.modo !== 'dichiarazione' && (
                  <div className="flex items-center gap-2 text-sm text-emerald-800 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4" /> Il report corrisponde al gestionale riga per riga.
                  </div>
                )}

                {daSistemare.length > 0 && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Righe da sistemare</h4>
                    {daSistemare.map((e) => (
                      <div key={e.n + '-' + (e.report && e.report.fir)} className="border rounded-lg p-3 bg-card space-y-1.5">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="text-sm">
                            <span className="text-muted-foreground first-letter:uppercase inline-block">{rigaReport(e)}{e.tipo ? ` · ${e.tipo === 'uscita' ? 'uscita' : 'ingresso'}` : ''}</span>
                            <span className="font-mono ml-2">{(e.report && e.report.fir) || 'senza formulario'}</span>
                            {ordineRiga(e) ? <span className="text-muted-foreground"> · ordine <span className="font-mono">{ordineRiga(e)}</span></span> : null}
                            {e.report && e.report.kg != null && <span className="text-muted-foreground"> · {formatKg(Number(e.report.kg))} kg</span>}
                          </div>
                          <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${STILE_ESITO[e.esito]}`}>{ETICHETTE_ESITO[e.esito]}</span>
                        </div>
                        <ul className="text-sm space-y-0.5">
                          {e.discrepanze.map((d, i) => {
                            const g = gravita(d);
                            return (
                              <li key={i} className="flex gap-1.5">
                                <span className={STILE_GRAVITA[g] || 'text-red-600'}>•</span>
                                <span>{d.messaggio}{ETICHETTA_GRAVITA[g] && <span className={`ml-1 text-xs ${STILE_GRAVITA[g]}`}>({ETICHETTA_GRAVITA[g]})</span>}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </section>
                )}

                {sintesi && sintesi.mancanti.length > 0 && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Movimenti del gestionale assenti nel report</h4>
                    <div className="border rounded-lg divide-y bg-card">
                      {sintesi.mancanti.map((m, i) => (
                        <div key={i} className="px-3 py-2 text-sm flex items-center justify-between gap-3 flex-wrap">
                          <span>
                            <span className="font-mono">{m.fir}</span>
                            {m.ordine ? <span className="text-muted-foreground"> · ordine <span className="font-mono">{m.ordine}</span></span> : null}
                            <span className="text-muted-foreground"> · {m.tipo === 'uscita' ? 'uscita verso ' + m.destinatario : 'ingresso'} · {dataIt(m.fine)} · {m.trasportatore}</span>
                          </span>
                          <span className="tabular-nums">{formatKg(Number(m.kg))} kg</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {escluse.length > 0 && (
                  <section>
                    <button onClick={() => setMostraEscluse(x => !x)} className="text-sm text-primary hover:underline">
                      {mostraEscluse ? 'Nascondi' : 'Mostra'} le {escluse.length} righe non considerate: altre settimane o altri consorzi
                    </button>
                    {mostraEscluse && (
                      <div className="border rounded-lg divide-y bg-card mt-2">
                        {escluse.map((e, i) => (
                          <div key={i} className="px-3 py-1.5 text-sm flex items-start justify-between gap-3">
                            <span>
                              <span className="text-muted-foreground first-letter:uppercase inline-block">{rigaReport(e)}</span>
                              <span className="font-mono ml-2">{e.fir || 'senza formulario'}</span>
                              {e.ordine ? <span className="text-muted-foreground"> · ordine <span className="font-mono">{e.ordine}</span></span> : null}
                              <span className="block text-xs text-muted-foreground">{e.motivo}</span>
                            </span>
                            <span className="tabular-nums text-muted-foreground">{e.kg != null ? `${formatKg(Number(e.kg))} kg` : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {conformi.length > 0 && (
                  <section>
                    <button onClick={() => setMostraConformi(x => !x)} className="text-sm text-primary hover:underline">
                      {mostraConformi ? 'Nascondi' : 'Mostra'} le {conformi.length} righe conformi
                    </button>
                    {mostraConformi && (
                      <div className="border rounded-lg divide-y bg-card mt-2">
                        {conformi.map((e, i) => (
                          <div key={i} className="px-3 py-1.5 text-sm flex items-center justify-between gap-3">
                            <span><span className="text-muted-foreground first-letter:uppercase inline-block">{rigaReport(e)}</span> <span className="font-mono ml-2">{e.report.fir}</span>{ordineRiga(e) ? <span className="text-muted-foreground"> · ordine <span className="font-mono">{ordineRiga(e)}</span></span> : null}</span>
                            <span className="tabular-nums text-muted-foreground">{formatKg(Number(e.report.kg))} kg</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
