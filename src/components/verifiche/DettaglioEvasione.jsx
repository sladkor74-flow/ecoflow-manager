import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Loader2, Star, Truck, History } from 'lucide-react';
import { MESI, STATI_RICHIESTA, GRAVITA, tonnellate, dataIt, dataOraIt } from '@/lib/evasioneAssegnati';

// Dettaglio dell'evasione di una lista: alert, previsione, stato di ogni
// richiesta e ordini fuori lista. Ogni caricamento delle primarie del mese ha il
// suo controllo, consultabile dallo storico finche' la lista resta in archivio.

const FILTRI = [
  { chiave: 'tutte', etichetta: 'Tutte' },
  { chiave: 'aperta', etichetta: 'Aperte' },
  { chiave: 'evasa', etichetta: 'Evase' },
  { chiave: 'fuori_ordine', etichetta: 'Fuori ordine' },
  { chiave: 'altro', etichetta: 'Da altri o non più presenti' },
];

function Tessera({ etichetta, valore, dettaglio, tono = '' }) {
  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="text-xs text-muted-foreground">{etichetta}</div>
      <div className={`text-xl font-bold tabular-nums ${tono}`}>{valore}</div>
      {dettaglio && <div className="text-xs text-muted-foreground">{dettaglio}</div>}
    </div>
  );
}

function Riga({ etichetta, valore }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b last:border-0">
      <span className="text-muted-foreground">{etichetta}</span>
      <span className="tabular-nums text-right">{valore}</span>
    </div>
  );
}

export default function DettaglioEvasione({ riga, anno, mese, open, onClose }) {
  const [controlli, setControlli] = useState([]);
  const [indice, setIndice] = useState(0);
  const [caricando, setCaricando] = useState(false);
  const [filtro, setFiltro] = useState('tutte');

  useEffect(() => {
    if (!open || !riga || !riga.lista) return;
    let annullato = false;
    setCaricando(true);
    setIndice(0);
    setFiltro('tutte');
    base44.entities.ControlloEvasione.filter({ lista_id: riga.lista.id }, '-eseguito_il', 100)
      .then(r => { if (!annullato) setControlli(r); })
      .catch(() => { if (!annullato) setControlli([]); })
      .finally(() => { if (!annullato) setCaricando(false); });
    return () => { annullato = true; };
  }, [open, riga]);

  const c = controlli[indice] || null;
  const esito = useMemo(() => (c && c.esito_json ? JSON.parse(c.esito_json) : null), [c]);
  const alert = useMemo(() => (c && c.alert_json ? JSON.parse(c.alert_json) : []), [c]);

  if (!open || !riga) return null;

  const p = esito ? esito.previsione : null;
  const s = esito ? esito.storico : null;
  const righe = esito ? esito.righe.filter(r => {
    if (filtro === 'tutte') return true;
    if (filtro === 'fuori_ordine') return r.saltate > 0;
    if (filtro === 'altro') return ['evasa_da_altri', 'riassegnata', 'non_piu_presente', 'evasa_prima'].includes(r.stato);
    return r.stato === filtro;
  }) : [];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader className="text-left space-y-1">
          <SheetTitle className="text-xl pr-6">{riga.nome}</SheetTitle>
          <SheetDescription>
            Lista di {MESI[mese - 1]} {anno} · {riga.lista.file_nomi} · caricata il {dataIt(riga.lista.caricata_il)}
          </SheetDescription>
        </SheetHeader>

        {caricando ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Caricamento…</div>
        ) : !c ? (
          <p className="mt-6 text-sm text-muted-foreground">Nessun controllo ancora eseguito su questa lista.</p>
        ) : (
          <div className="mt-5 space-y-6">
            {controlli.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <History className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Controlli del mese:</span>
                {controlli.map((x, i) => (
                  <button key={x.id} onClick={() => setIndice(i)}
                    className={`px-2 py-0.5 rounded-full border ${i === indice ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                    {dataOraIt(x.primarie_caricate_il || x.eseguito_il)}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Primarie caricate il {dataOraIt(c.primarie_caricate_il)}, con trasporti conclusi fino al {dataIt(c.dati_al)}.
            </p>

            {alert.length > 0 && (
              <section className="space-y-1.5">
                {alert.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 px-2 py-0.5 rounded-full border text-xs font-medium shrink-0 ${GRAVITA[a.gravita].classe}`}>{GRAVITA[a.gravita].etichetta}</span>
                    <span>{a.messaggio}</span>
                  </div>
                ))}
              </section>
            )}

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <Tessera etichetta="Richieste" valore={c.richieste} />
              <Tessera etichetta="Evase" valore={c.evase} tono="text-emerald-600" />
              <Tessera etichetta="Aperte" valore={c.aperte} dettaglio={c.prioritarie_aperte ? `${c.prioritarie_aperte} prioritarie` : ''} tono={c.prioritarie_aperte ? 'text-red-600' : ''} />
              <Tessera etichetta="Fuori ordine" valore={c.fuori_ordine} tono={c.fuori_ordine ? 'text-amber-600' : ''} />
              <Tessera etichetta="Fuori lista" valore={c.fuori_lista} />
              <Tessera etichetta="Da altri" valore={c.evase_da_altri} dettaglio={c.riassegnate || c.non_piu_presenti ? `${c.riassegnate} riassegnate, ${c.non_piu_presenti} sparite` : ''} />
            </div>

            {p && (
              <div className="grid md:grid-cols-2 gap-4">
                <section className="border rounded-lg p-4 bg-card text-sm">
                  <h4 className="font-semibold mb-2">Target e previsione</h4>
                  <Riga etichetta="Target del mese" valore={p.target_kg ? `${tonnellate(p.target_kg)} t` : 'non impostato'} />
                  <Riga etichetta="Raccolto finora" valore={`${tonnellate(c.raccolto_kg)} t${p.target_kg ? ` · ${Math.round((c.raccolto_kg / p.target_kg) * 100)}%` : ''}`} />
                  <Riga etichetta="Giorni lavorativi" valore={`${p.giorni_trascorsi} trascorsi su ${p.giorni_totali}, ${p.giorni_residui} residui`} />
                  <Riga etichetta="Ritmo del mese" valore={p.ritmo_mese_kg_giorno !== null ? `${tonnellate(p.ritmo_mese_kg_giorno)} t al giorno` : '—'} />
                  <Riga etichetta="Ritmo dell'anno" valore={p.ritmo_storico_kg_giorno ? `${tonnellate(p.ritmo_storico_kg_giorno)} t al giorno` : '—'} />
                  <Riga etichetta="Proiezione a fine mese" valore={`${tonnellate(p.proiezione_kg)} t${p.percentuale_proiezione !== null ? ` · ${p.percentuale_proiezione}%` : ''}`} />
                  <Riga etichetta="Richieste aperte" valore={`${c.aperte}, circa ${tonnellate(p.kg_richieste_aperte)} t`} />
                  <Riga etichetta="Evadibili al ritmo stimato" valore={`circa ${p.evadibili_ritmo} su ${c.aperte}`} />
                  {p.target_kg ? <Riga etichetta="Evadibili entro il target" valore={`${p.evadibili_target} su ${c.aperte}`} /> : null}
                  {p.viaggi_necessari !== null && <Riga etichetta="Viaggi per il target residuo" valore={`${p.viaggi_necessari} necessari, circa ${p.viaggi_possibili ?? '—'} possibili`} />}
                  <p className="text-xs text-muted-foreground mt-2">
                    Il peso di una richiesta aperta si stima solo dal peso effettivo a destinazione: quello dei ritiri già fatti presso lo stesso
                    punto di raccolta, altrimenti il peso tipico di un formulario della stessa classe.
                  </p>
                </section>

                <section className="border rounded-lg p-4 bg-card text-sm">
                  <h4 className="font-semibold mb-2">Storia dell'anno</h4>
                  <Riga etichetta="Formulari" valore={`${s.ordini}, ${tonnellate(s.kg)} t`} />
                  <Riga etichetta="Viaggi" valore={`${s.viaggi}, ${s.ordini_per_viaggio ?? '—'} formulari per viaggio`} />
                  <Riga etichetta="Peso medio per viaggio" valore={s.kg_per_viaggio ? `${tonnellate(s.kg_per_viaggio)} t` : '—'} />
                  <div className="mt-3 text-xs">
                    <div className="grid grid-cols-3 gap-2 font-medium text-muted-foreground border-b pb-1">
                      <span>Classe</span><span className="text-right">Formulari</span><span className="text-right">Peso effettivo tipico</span>
                    </div>
                    {Object.entries(s.classi).sort((a, b) => b[1].ordini - a[1].ordini).map(([cl, v]) => (
                      <div key={cl} className="grid grid-cols-3 gap-2 py-0.5 tabular-nums">
                        <span>{cl}</span><span className="text-right">{v.ordini}</span>
                        <span className="text-right">{v.kg_medio_ordine ? `${v.kg_medio_ordine.toLocaleString('it-IT')} kg` : '—'}</span>
                      </div>
                    ))}
                  </div>
                  {s.mezzi.length > 0 && (
                    <div className="mt-3 text-xs">
                      <div className="flex items-center gap-1 font-medium text-muted-foreground border-b pb-1"><Truck className="w-3.5 h-3.5" />Mezzi</div>
                      {s.mezzi.slice(0, 6).map(z => (
                        <div key={z.automezzo} className="grid grid-cols-4 gap-2 py-0.5 tabular-nums">
                          <span className="font-mono">{z.automezzo}</span><span className="text-right">{z.viaggi} viaggi</span>
                          <span className="text-right">media {tonnellate(z.kg_medio)} t</span><span className="text-right">max {tonnellate(z.kg_max)} t</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {esito && esito.per_regione.length > 0 && (
              <section className="text-sm">
                <h4 className="font-semibold mb-2">Per regione</h4>
                <div className="flex flex-wrap gap-2">
                  {esito.per_regione.map(r => (
                    <div key={r.regione} className="border rounded-lg px-3 py-2 bg-card">
                      <div className="font-medium">{r.regione}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{r.evase} evase su {r.richieste} · {r.aperte} aperte · raccolto {tonnellate(r.raccolto_kg)} t</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {esito && (
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="font-semibold">Richieste della lista</h4>
                  <div className="flex gap-1 flex-wrap">
                    {FILTRI.map(f => (
                      <button key={f.chiave} onClick={() => setFiltro(f.chiave)}
                        className={`px-2.5 py-0.5 rounded-full border text-xs ${filtro === f.chiave ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>{f.etichetta}</button>
                    ))}
                  </div>
                </div>
                <div className="border rounded-lg overflow-x-auto bg-card">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-2 py-2">#</th><th className="px-2 py-2">ID</th><th className="px-2 py-2">Immessa</th>
                        <th className="px-2 py-2">Punto di raccolta</th><th className="px-2 py-2">Classe</th><th className="px-2 py-2">Stato</th>
                        <th className="px-2 py-2">Evasa</th><th className="px-2 py-2 text-right">Peso</th><th className="px-2 py-2">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {righe.map(r => (
                        <tr key={r.id_ordine} className={`border-t ${r.prioritaria ? 'bg-yellow-50' : ''}`}>
                          <td className="px-2 py-1.5 tabular-nums">{r.posizione}{r.prioritaria && <Star className="inline w-3 h-3 ml-0.5 text-amber-500 fill-amber-400" />}</td>
                          <td className="px-2 py-1.5 font-mono">{r.id_ordine}</td>
                          <td className="px-2 py-1.5 tabular-nums">{dataIt(r.data_immissione)}</td>
                          <td className="px-2 py-1.5">{r.produttore}<div className="text-muted-foreground">{r.comune}{r.provincia ? ` (${r.provincia})` : ''}</div></td>
                          <td className="px-2 py-1.5">{r.classe || '—'}</td>
                          <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded-full border ${(STATI_RICHIESTA[r.stato] || STATI_RICHIESTA.aperta).classe}`}>{(STATI_RICHIESTA[r.stato] || {}).etichetta || r.stato}</span></td>
                          <td className="px-2 py-1.5 tabular-nums">{r.chiusa_il ? dataIt(r.chiusa_il) : ''}{r.chiusa_da && r.stato !== 'evasa' ? <div className="text-muted-foreground">{r.stato === 'riassegnata' ? 'a ' : 'da '}{r.chiusa_da}</div> : null}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {r.kg !== null && r.kg !== undefined ? `${r.kg.toLocaleString('it-IT')} kg` : r.stima_kg ? <span className="text-muted-foreground" title={r.metodo_stima}>~{r.stima_kg.toLocaleString('it-IT')} kg</span> : ''}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {r.saltate > 0 && <span className="text-amber-700">saltate {r.saltate} precedenti</span>}
                            {r.stato === 'aperta' && r.entro_capacita === false && <span>oltre la capacità stimata del mese</span>}
                          </td>
                        </tr>
                      ))}
                      {righe.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">Nessuna richiesta con questo filtro.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {esito && esito.fuori_lista.length > 0 && (
              <section className="space-y-2">
                <h4 className="font-semibold">Ordini evasi fuori lista</h4>
                <div className="border rounded-lg divide-y bg-card text-xs">
                  {esito.fuori_lista.map(f => (
                    <div key={f.id_ordine} className="px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                      <span>
                        <span className="font-mono">{f.id_ordine}</span>
                        <span className="text-muted-foreground"> · evaso il {dataIt(f.chiusa_il)} · {f.produttore}{f.comune ? `, ${f.comune}` : ''}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          {f.tipo === 'nuova' ? 'immesso dopo l\'invio della lista' : f.tipo === 'lista_altrui' ? `dalla lista di ${f.lista_di}` : 'già esistente all\'invio'}
                        </span>
                        <span className="tabular-nums">{f.kg.toLocaleString('it-IT')} kg</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
