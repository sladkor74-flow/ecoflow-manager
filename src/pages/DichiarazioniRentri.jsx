import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePermessi } from '@/lib/permessi';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { parole, corrispondeA } from '@/lib/ricercaNomi';
import {
  controlliDichiarazione, segnalazioni, eCodiceEsempio, impronta, verificaValida, COLLEGAMENTI, LIVELLI_CONTROLLO,
} from '@/lib/dichiarazioniRentri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { BannerSolaLettura } from '@/components/shared/SolaLettura';
import AggiornaGestione from '@/components/shared/AggiornaGestione';
import { formatIntero } from '@/lib/utils';
import { Loader2, FileBadge, Search, FileSpreadsheet, Check } from 'lucide-react';

// Modulo Dichiarazioni RENTRI.
//
// Per ogni produttore: la sua dichiarazione (iscritto o no al RENTRI, FIR digitale
// o cartaceo) e, accanto, cio' che il portale dice dei suoi punti di raccolta
// (Iscrizione al R.E.N.T.Ri., ID U/L RENTRi, Tipo di formulario dell'anagrafica
// PDR). Le dichiarazioni non scadono, ma le condizioni cambiano: dove dichiarazione
// e portale non coincidono il modulo lo dice, e la dichiarazione si aggiorna.
//
// I dati del portale non si copiano: si leggono dal modulo PDR, quindi quando si
// ricarica l'anagrafica PDR le colonne sono subito aggiornate.

const dataIt = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');
const siNo = (v) => (v ? 'sì' : 'no');

function Riquadro({ titolo, valore, dettaglio, classe }) {
  return (
    <div className={`border rounded-lg bg-card p-3 ${classe || ''}`}>
      <div className="text-xs text-muted-foreground">{titolo}</div>
      <div className="text-2xl font-semibold tabular-nums">{valore}</div>
      {dettaglio && <div className="text-xs text-muted-foreground">{dettaglio}</div>}
    </div>
  );
}

// Valore del portale, evidenziato se non dice la stessa cosa della dichiarazione.
function ValorePortale({ valore, diverso }) {
  const v = String(valore ?? '').trim();
  if (!v) return <span className="text-muted-foreground">—</span>;
  return <span className={diverso ? 'text-red-700 font-semibold' : v === '?' ? 'text-muted-foreground' : ''}>{v}</span>;
}

export default function DichiarazioniRentri() {
  const { user, isAdmin } = usePermessi();
  const { toast } = useToast();
  const [dichiarazioni, setDichiarazioni] = useState([]);
  const [pdrPerId, setPdrPerId] = useState(new Map());
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(null);
  const [params] = useSearchParams();
  const [cerca, setCerca] = useState(() => params.get('cerca') || '');
  const [filtroIscritto, setFiltroIscritto] = useState('tutti');
  const [filtroFormulario, setFiltroFormulario] = useState('tutti');
  const [filtroControllo, setFiltroControllo] = useState('tutti');
  const [apertaScelta, setApertaScelta] = useState(null);
  const [inCorso, setInCorso] = useState(null);

  const carica = useCallback(async () => {
    setCaricamento(true); setErrore(null);
    try {
      const [righe, pdr] = await Promise.all([
        fetchAllClient(base44.entities.DichiarazioneRentri, null, 'produttore'),
        fetchAllClient(base44.entities.Pdr, null, 'id_pdr'),
      ]);
      setDichiarazioni(righe.filter(r => r.nel_foglio !== false));
      setPdrPerId(new Map(pdr.map(p => [String(p.id_pdr), p])));
    } catch (e) {
      setErrore(e.message || 'Non riesco a leggere le dichiarazioni.');
    }
    setCaricamento(false);
  }, []);

  useEffect(() => { carica(); }, [carica]);

  const conControlli = useMemo(() => dichiarazioni.map(d => {
    const pdr = (d.pdr_collegati || []).map(id => pdrPerId.get(String(id))).filter(Boolean);
    const controlli = controlliDichiarazione(d, pdr);
    let candidati = [];
    try { candidati = JSON.parse(d.candidati_json || '[]'); } catch (_e) { candidati = []; }
    let storico = [];
    try { storico = JSON.parse(d.storico_json || '[]'); } catch (_e) { storico = []; }
    const verificata = verificaValida(d, controlli);
    // Da guardare: segnalazioni vere non ancora verificate cosi' come sono adesso.
    const daGuardare = segnalazioni(controlli).length > 0 && !verificata;
    return { ...d, pdr, controlli, candidati, storico, verificata, daGuardare };
  }), [dichiarazioni, pdrPerId]);

  const filtrate = useMemo(() => {
    const cercate = parole(cerca);
    return conControlli.filter(d => {
      if (!corrispondeA(cercate, d.produttore, ...d.pdr.map(p => p.ragione_sociale))) return false;
      if (filtroIscritto === 'si' && !d.iscritto_rentri) return false;
      if (filtroIscritto === 'no' && d.iscritto_rentri) return false;
      if (filtroFormulario === 'digitale' && !d.fir_digitale) return false;
      if (filtroFormulario === 'cartaceo' && !d.fir_cartaceo) return false;
      if (filtroControllo === 'nessuno' && segnalazioni(d.controlli).length) return false;
      if (filtroControllo === 'info' && !d.controlli.some(c => c.livello === 'info')) return false;
      if (['aggiornare', 'verificare', 'collegare'].includes(filtroControllo) && !(d.daGuardare && d.controlli.some(c => c.livello === filtroControllo))) return false;
      if (filtroControllo === 'verificate' && !d.verificata) return false;
      if (filtroControllo === 'iscritto_cartaceo' && !(d.iscritto_rentri && d.fir_cartaceo && !d.fir_digitale)) return false;
      return true;
    });
  }, [conControlli, cerca, filtroIscritto, filtroFormulario, filtroControllo]);

  const conta = (f) => conControlli.filter(f).length;
  const conLivello = (l) => conta(d => d.daGuardare && d.controlli.some(c => c.livello === l));

  const collega = async (d, ids) => {
    const puliti = [...new Set(ids.map(String).filter(s => /^\d+$/.test(s)))];
    setInCorso(d.id);
    try {
      const clienti = [...new Set(puliti.map(id => pdrPerId.get(id)).filter(Boolean).map(p => String(p.id_cliente || '')).filter(Boolean))];
      await base44.entities.DichiarazioneRentri.update(d.id, puliti.length
        ? { pdr_manuali: puliti, pdr_collegati: puliti, clienti_collegati: clienti, collegamento: 'manuale', candidati_json: '' }
        : { pdr_manuali: [], pdr_collegati: [], clienti_collegati: [], collegamento: 'nessuno' });
      setApertaScelta(null);
      await carica();
    } catch (e) {
      toast({ title: 'Non riesco a salvare il collegamento', description: e.message, variant: 'destructive' });
    }
    setInCorso(null);
  };

  const segnaVerificata = async (d, annulla = false) => {
    let nota = '';
    if (!annulla) {
      nota = window.prompt(`Esito del controllo su ${d.produttore} (facoltativo).\nLa verifica vale finché le segnalazioni restano queste; se cambiano, la dichiarazione torna da guardare.`, d.verifica_nota || '');
      if (nota === null) return;
    }
    setInCorso(d.id);
    try {
      await base44.entities.DichiarazioneRentri.update(d.id, annulla
        ? { verificata_il: null, verificata_da: '', verifica_nota: '', verifica_impronta: '' }
        : { verificata_il: new Date().toISOString(), verificata_da: (user && (user.full_name || user.email)) || '', verifica_nota: nota.trim(), verifica_impronta: impronta(d.controlli) });
      await carica();
    } catch (e) {
      toast({ title: 'Non riesco a salvare la verifica', description: e.message, variant: 'destructive' });
    }
    setInCorso(null);
  };

  const collegaAMano = (d) => {
    const testo = window.prompt(
      `ID PDR di ${d.produttore}, separati da virgola.\nLascia vuoto per togliere il collegamento a mano: al prossimo aggiornamento il gestionale lo cercherà di nuovo.`,
      ((d.pdr_manuali || []).length ? d.pdr_manuali : (d.pdr_collegati || [])).join(', '),
    );
    if (testo === null) return;
    collega(d, testo.split(/[\s,;]+/).filter(Boolean));
  };

  const esporta = async () => {
    const XLSX = await import('xlsx');
    const dati = filtrate.map(d => ({
      Produttore: d.produttore,
      'Data dichiarazione': dataIt(d.data_dichiarazione),
      'Iscritto al RENTRI': siNo(d.iscritto_rentri),
      'FIR digitale': siNo(d.fir_digitale),
      'FIR cartaceo': siNo(d.fir_cartaceo),
      Nota: d.nota || '',
      PDR: d.pdr.map(p => p.id_pdr).join(', '),
      'Collegamento': COLLEGAMENTI[d.collegamento || 'nessuno'].nome,
      'Iscrizione al R.E.N.T.Ri. (portale)': d.pdr.map(p => p.rentri_iscrizione || '').join(', '),
      'ID U/L RENTRi (portale)': d.pdr.map(p => p.rentri_id_ul || '').join(', '),
      'Tipo di formulario (portale)': d.pdr.map(p => p.tipo_formulario || '').join(', '),
      Controlli: d.controlli.map(c => c.testo).join(' | '),
    }));
    const ws = XLSX.utils.json_to_sheet(dati);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dichiarazioni RENTRI');
    XLSX.writeFile(wb, `Dichiarazioni_RENTRI_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
          <FileBadge className="w-7 h-7 text-primary" /> Dichiarazioni RENTRI
        </h1>
        <p className="text-muted-foreground mt-1 max-w-4xl">
          Per ogni produttore la sua dichiarazione e, accanto, ciò che il portale dice dei suoi punti di raccolta. Le dichiarazioni
          non scadono, ma le condizioni cambiano: dove dichiarazione e portale non coincidono il modulo lo segnala. I dati del
          portale vengono dal modulo PDR e si aggiornano quando si ricarica l'anagrafica.
        </p>
      </div>

      <BannerSolaLettura cosa="le dichiarazioni RENTRI" />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <Riquadro titolo="Dichiarazioni" valore={formatIntero(conControlli.length)} />
        <Riquadro titolo="Iscritti al RENTRI" valore={formatIntero(conta(d => d.iscritto_rentri))} dettaglio={`${formatIntero(conta(d => !d.iscritto_rentri))} non iscritti`} />
        <Riquadro titolo="FIR" valore={`${formatIntero(conta(d => d.fir_digitale))} · ${formatIntero(conta(d => d.fir_cartaceo))}`} dettaglio="digitale · cartaceo" />
        <Riquadro titolo="Da aggiornare" valore={formatIntero(conLivello('aggiornare'))} dettaglio="diverse dal portale" classe={conLivello('aggiornare') ? 'border-red-300' : ''} />
        <Riquadro titolo="Da verificare" valore={formatIntero(conLivello('verificare'))} dettaglio="da guardare" classe={conLivello('verificare') ? 'border-amber-300' : ''} />
        <Riquadro titolo="Da collegare" valore={formatIntero(conLivello('collegare'))} dettaglio="PDR da scegliere o confermare" />
      </div>

      {errore && <div className="border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">{errore}</div>}

      <Tabs defaultValue="elenco">
        <TabsList>
          <TabsTrigger value="elenco">Elenco ({formatIntero(filtrate.length)})</TabsTrigger>
          {isAdmin && <TabsTrigger value="aggiorna">Aggiorna dal file</TabsTrigger>}
        </TabsList>

        <TabsContent value="elenco" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Cerca un produttore…" value={cerca} onChange={(e) => setCerca(e.target.value)} />
            </div>
            <Select value={filtroIscritto} onValueChange={setFiltroIscritto}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Iscritti e non</SelectItem>
                <SelectItem value="si">Iscritti al RENTRI</SelectItem>
                <SelectItem value="no">Non iscritti</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroFormulario} onValueChange={setFiltroFormulario}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Ogni formulario</SelectItem>
                <SelectItem value="digitale">FIR digitale</SelectItem>
                <SelectItem value="cartaceo">FIR cartaceo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroControllo} onValueChange={setFiltroControllo}>
              <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti i controlli</SelectItem>
                <SelectItem value="aggiornare">Da aggiornare</SelectItem>
                <SelectItem value="verificare">Da verificare</SelectItem>
                <SelectItem value="iscritto_cartaceo">Iscritti che usano il FIR cartaceo</SelectItem>
                <SelectItem value="collegare">Da collegare o confermare</SelectItem>
                <SelectItem value="verificate">Già verificate</SelectItem>
                <SelectItem value="info">Senza dato nel portale</SelectItem>
                <SelectItem value="nessuno">Senza segnalazioni</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={esporta} disabled={!filtrate.length}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
            </Button>
          </div>

          {caricamento ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Leggo dichiarazioni e anagrafica PDR…</div>
          ) : !filtrate.length ? (
            <div className="border rounded-lg bg-card px-4 py-10 text-center text-muted-foreground text-sm">
              {conControlli.length ? 'Nessun produttore con questi filtri.' : 'Ancora nessuna dichiarazione: aggiorna il modulo dal file.'}
            </div>
          ) : (
            <div className="border rounded-lg bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Produttore</th>
                    <th className="text-left px-2 py-2">Dichiarazione</th>
                    <th className="text-left px-2 py-2">Iscritto RENTRI</th>
                    <th className="text-left px-2 py-2">FIR digitale</th>
                    <th className="text-left px-2 py-2">FIR cartaceo</th>
                    <th className="text-left px-2 py-2">Nota</th>
                    <th className="text-left px-2 py-2">PDR</th>
                    <th className="text-left px-2 py-2 bg-sky-50">Iscrizione al R.E.N.T.Ri.</th>
                    <th className="text-left px-2 py-2 bg-sky-50">ID U/L RENTRi</th>
                    <th className="text-left px-2 py-2 bg-sky-50">Tipo di formulario</th>
                    <th className="text-left px-2 py-2">Controlli</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrate.map(d => {
                    const tipi = new Set(d.controlli.map(c => c.tipo));
                    const livelli = [...new Set(d.controlli.map(c => c.livello))];
                    return (
                      <tr key={d.id} className="border-t align-top">
                        <td className="px-3 py-2 min-w-[220px]">
                          <div className="font-medium">{d.produttore}</div>
                          {d.storico.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              cambiata: {d.storico.map(s => `fino al ${dataIt(s.fino_al)} ${s.iscritto_rentri ? 'iscritto' : 'non iscritto'}, FIR ${s.fir_digitale ? 'digitale' : s.fir_cartaceo ? 'cartaceo' : '—'}`).join('; ')}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 tabular-nums whitespace-nowrap">{dataIt(d.data_dichiarazione)}</td>
                        <td className={`px-2 py-2 ${tipi.has('iscritto_nel_portale') || tipi.has('non_iscritto_nel_portale') ? 'text-red-700 font-semibold' : ''}`}>{siNo(d.iscritto_rentri)}</td>
                        <td className="px-2 py-2">{siNo(d.fir_digitale)}</td>
                        <td className={`px-2 py-2 ${tipi.has('obbligato_cartaceo') ? 'text-amber-700 font-semibold' : ''}`}>{siNo(d.fir_cartaceo)}</td>
                        <td className="px-2 py-2 text-xs max-w-[220px] break-words">{d.nota || ''}</td>
                        <td className="px-2 py-2 text-xs min-w-[170px]">
                          {d.pdr.map(p => (
                            <div key={p.id_pdr} title={`${p.ragione_sociale || ''} · ${p.descrizione_pdr || ''}`}>
                              <span className="tabular-nums">{p.id_pdr}</span> <span className="text-muted-foreground">{p.comune_pdr || ''}{p.provincia_pdr ? ` (${p.provincia_pdr})` : ''}</span>
                            </div>
                          ))}
                          <div className="text-muted-foreground" title={COLLEGAMENTI[d.collegamento || 'nessuno'].spiega}>
                            {COLLEGAMENTI[d.collegamento || 'nessuno'].nome}
                          </div>
                          {isAdmin && (
                            <div className="flex flex-wrap gap-x-2 mt-0.5">
                              {d.collegamento === 'simile' && (
                                <button type="button" className="text-primary hover:underline" disabled={inCorso === d.id} onClick={() => collega(d, d.pdr_collegati || [])}>
                                  {inCorso === d.id ? 'salvo…' : 'conferma'}
                                </button>
                              )}
                              {d.candidati.length > 0 && d.collegamento !== 'manuale' && (
                                <button type="button" className="text-primary hover:underline" onClick={() => setApertaScelta(apertaScelta === d.id ? null : d.id)}>
                                  {apertaScelta === d.id ? 'chiudi' : `scegli (${d.candidati.length})`}
                                </button>
                              )}
                              <button type="button" className="text-primary hover:underline" onClick={() => collegaAMano(d)}>
                                {(d.pdr_manuali || []).length ? 'modifica' : 'ID a mano'}
                              </button>
                            </div>
                          )}
                          {apertaScelta === d.id && (
                            <div className="mt-1 border rounded p-1 bg-muted/30 space-y-0.5">
                              {d.candidati.map(c => (
                                <button key={c.id_pdr} type="button" disabled={inCorso === d.id}
                                  className="block w-full text-left px-1 py-0.5 rounded hover:bg-primary/10"
                                  onClick={() => collega(d, [c.id_pdr])}>
                                  <span className="tabular-nums">{c.id_pdr}</span> · {c.ragione_sociale}{c.comune ? ` · ${c.comune}` : ''}{c.provincia ? ` (${c.provincia})` : ''}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 bg-sky-50/40 text-xs">
                          {d.pdr.length ? d.pdr.map(p => (
                            <div key={p.id_pdr}><ValorePortale valore={p.rentri_iscrizione} diverso={tipi.has('iscritto_nel_portale') || tipi.has('non_iscritto_nel_portale')} /></div>
                          )) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-2 bg-sky-50/40 text-xs tabular-nums">
                          {d.pdr.length ? d.pdr.map(p => (
                            <div key={p.id_pdr}>
                              {eCodiceEsempio(p.rentri_id_ul)
                                ? <span className="text-muted-foreground" title="Codice d'esempio del portale: il produttore non ha ancora inserito quello della sua unità locale">esempio</span>
                                : <ValorePortale valore={p.rentri_id_ul} diverso={tipi.has('codice_diverso')} />}
                            </div>
                          )) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-2 bg-sky-50/40 text-xs">
                          {d.pdr.length ? d.pdr.map(p => (
                            <div key={p.id_pdr}><ValorePortale valore={p.tipo_formulario} diverso={tipi.has('formulario_diverso')} /></div>
                          )) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-2 text-xs min-w-[240px]">
                          {!d.controlli.length ? (
                            <span className="inline-flex items-center gap-1 text-green-700"><Check className="w-3.5 h-3.5" /> coincide</span>
                          ) : !segnalazioni(d.controlli).length ? (
                            <span className="text-muted-foreground">{d.controlli.map(c => c.testo).join(' ')}</span>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1">
                                {livelli.map(l => <span key={l} className={`px-1.5 py-0.5 rounded border ${LIVELLI_CONTROLLO[l].classe}`}>{LIVELLI_CONTROLLO[l].nome}</span>)}
                              </div>
                              {d.controlli.map((c, i) => <div key={i} className="text-muted-foreground">{c.testo}</div>)}
                            </div>
                          )}
                          {d.verificata && (
                            <div className="mt-1 text-green-800">
                              <Check className="w-3.5 h-3.5 inline -mt-0.5" /> verificata il {dataIt(d.verificata_il)}{d.verificata_da ? ` da ${d.verificata_da}` : ''}
                              {d.verifica_nota && <div className="text-muted-foreground">{d.verifica_nota}</div>}
                            </div>
                          )}
                          {!d.verificata && d.verificata_il && (
                            <div className="mt-1 text-amber-700">verificata il {dataIt(d.verificata_il)}, ma da allora le segnalazioni sono cambiate</div>
                          )}
                          {isAdmin && segnalazioni(d.controlli).length > 0 && (
                            <button type="button" className="mt-1 text-primary hover:underline" disabled={inCorso === d.id}
                              onClick={() => segnaVerificata(d, d.verificata)}>
                              {inCorso === d.id ? 'salvo…' : d.verificata ? 'togli la verifica' : 'segna verificata'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Le colonne azzurre vengono dall'anagrafica PDR del portale; in rosso i valori che non coincidono con la dichiarazione.
          </p>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="aggiorna" className="mt-4">
            <AggiornaGestione onAggiornato={carica} />
          </TabsContent>
        )}
      </Tabs>

    </div>
  );
}
