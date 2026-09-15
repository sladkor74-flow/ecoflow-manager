import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Download, RefreshCw, Trash2, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet, FileText } from 'lucide-react';
import { dataIt, tonnellate, scaricaExcelVerifica, segnalazioni, analisiInCorso, ETICHETTE_ESITO, rigaReport, descriviLettura, sintesiVerifica, gravita } from '@/lib/verifiche';
import { esportaEsitoVerificaPdf } from '@/lib/esitoVerificaPdf';
import { formatKg, formatIntero } from '@/lib/utils';
import { conCampiCompleti, eliminaParti } from '@/lib/testoLungo';

const NOME_TIPO = { ingresso: 'Ingressi', uscita: 'Uscite', totale: 'Totale' };
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

  const riesegui = async () => {
    setLavorando('riesegui');
    try {
      await base44.functions.invoke('elaboraReportSettimanale', { verifica_id: v.id, solo_verifica: true });
      toast({ title: 'Verifica ripetuta sui dati aggiornati del gestionale' });
    } catch (e) {
      const msg = (e && e.data && e.data.error) || (e && e.response && e.response.data && e.response.data.error);
      toast({ title: 'Verifica non riuscita', description: msg || e.message || String(e), variant: 'destructive' });
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
                {v.verificata_il ? `Verificato il ${new Date(v.verificata_il).toLocaleString('it-IT')}` : ''}
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
                  <div className={`rounded-lg border px-4 py-3 ${sintesi.conformita === 'piena' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className={`flex items-center gap-2 font-semibold ${sintesi.conformita === 'piena' ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {sintesi.conformita === 'piena' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                      {sintesi.conformita === 'piena' ? 'Conformità piena' : 'Conformità parziale'}
                    </div>
                    <div className="text-sm mt-1 text-slate-700">
                      {sintesi.conformita === 'piena'
                        ? 'Stessi formulari, stessi pesi effettivi e stesse date di fine trasporto dei formulari registrati.'
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
                          {[...sintesi.quadratura, sintesi.totale].map(q => {
                            const dF = q.formulari_report - q.formulari_gestionale;
                            const dK = q.kg_report - q.kg_gestionale;
                            return (
                              <tr key={q.chiave || q.tipo} className={`border-t tabular-nums ${q.tipo === 'totale' ? 'font-semibold bg-muted/30' : ''}`}>
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

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <Tessera etichetta="Righe verificate" valore={v.righe_report || 0}
                    dettaglio={`${tonnellate(v.peso_report_kg)} t${v.righe_escluse ? ` · altre ${v.righe_escluse} non considerate` : ''}`} />
                  <Tessera etichetta="Ingressi nel gestionale" valore={v.ingressi_gestionale || 0} dettaglio={`${tonnellate(v.peso_ingressi_kg)} t`} />
                  <Tessera etichetta="Uscite nel gestionale" valore={v.uscite_gestionale || 0}
                    dettaglio={`${tonnellate(v.peso_uscite_kg)} t${v.uscite_gestionale && !v.uscite_verificate ? ' · non nel report' : ''}`} />
                  <Tessera etichetta="Conformi" valore={v.conformi || 0} tono="text-emerald-600" />
                  <Tessera etichetta="Da sistemare" valore={segnalazioni(v)} tono={segnalazioni(v) ? 'text-red-600' : 'text-emerald-600'}
                    dettaglio={segnalazioni(v) ? [
                      v.con_discrepanze ? `${v.con_discrepanze} con discrepanze` : '',
                      v.non_trovate ? `${v.non_trovate} non trovate` : '',
                      v.duplicate ? `${v.duplicate} duplicate` : '',
                      v.assenti_nel_report ? `${v.assenti_nel_report} assenti` : '',
                    ].filter(Boolean).join(', ') : 'nessuna'} />
                </div>

                {lettura.modo === 'dichiarazione' && (
                  <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${v.conformita === 'piena' ? 'text-emerald-900 border-emerald-200 bg-emerald-50' : 'text-red-900 border-red-200 bg-red-50'}`}>
                    <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      L'impianto ha comunicato che nella settimana non ci sono state movimentazioni{v.nota ? ` (${v.nota})` : ''}.{' '}
                      {v.conformita === 'piena'
                        ? 'Nel gestionale non risultano formulari: la comunicazione è confermata.'
                        : `Nel gestionale risultano ${sintesi ? sintesi.totale.formulari_gestionale : ''} formulari: la comunicazione è smentita ed è stato aperto un alert.`}
                    </span>
                  </div>
                )}

                {!!v.uscite_gestionale && !v.uscite_verificate && lettura.modo !== 'dichiarazione' && (
                  <div className="flex items-start gap-2 text-sm text-red-900 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>Il report non contiene uscite: le {v.uscite_gestionale} secondarie partite nella settimana ({tonnellate(v.peso_uscite_kg)} t) mancano nel report.</span>
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
                          <span><span className="font-mono">{m.fir}</span> <span className="text-muted-foreground">· {m.tipo === 'uscita' ? 'uscita verso ' + m.destinatario : 'ingresso'} · {dataIt(m.fine)} · {m.trasportatore}</span></span>
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
                            <span><span className="text-muted-foreground first-letter:uppercase inline-block">{rigaReport(e)}</span> <span className="font-mono ml-2">{e.report.fir}</span></span>
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
