import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, History, FileSpreadsheet } from 'lucide-react';
import { MESI } from '@/lib/pfuConstants';
import { tonnellate, leggiNumero, leggiStorico, conModifica, nomeUtente, dataOra, REGIONI_COMMESSA } from '@/lib/target';
import { leggiFileTargetContratto } from '@/lib/targetContratto';

// Commessa Ecotyre dell'anno, cioe' quanto richiede il contratto: target annuo e
// per regione, ripartizione per classe, target mensile iniziale e rivisto, budget
// mensile rete e ACI, quantita' per destinazione e target con prezzo per regione.
// Si scrive una volta, o si importa dal foglio del contratto, e si aggiorna se
// Ecotyre lo rivede. L'Andamento confronta il raccolto per regione con questi dati.

const testo = (v) => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','));
const leggiJson = (json, riserva) => { try { const v = JSON.parse(json || 'null'); return v ?? riserva; } catch { return riserva; } };
const numero = (v) => { const n = leggiNumero(v); return n === null || Number.isNaN(n) ? null : n; };
const somma = (valori) => valori.reduce((s, v) => s + (numero(v) || 0), 0);
const dodici = (arr) => [...(arr || []).map(testo), ...Array(12).fill('')].slice(0, 12);

function statoDaRecord(r) {
  return {
    target_annuo_t: testo(r && r.target_annuo_t),
    regioni: r ? leggiJson(r.regioni_json, []).map(x => ({ regione: x.regione || '', province: x.province || '', target: testo(x.target_t) })) : REGIONI_COMMESSA.map(x => ({ regione: x, province: '', target: '' })),
    classi: r ? leggiJson(r.classi_json, []).map(x => ({ classe: x.classe || '', descrizione: x.descrizione || '', peso: x.peso || '', percentuale: testo(x.percentuale != null ? Math.round(x.percentuale * 10000) / 100 : '') })) : [],
    mensile_iniziale: dodici(r && leggiJson(r.target_mensile_iniziale_json, [])),
    mensile: dodici(r && leggiJson(r.target_mensile_json, [])),
    rete: dodici(r && leggiJson(r.budget_rete_json, [])),
    aci: dodici(r && leggiJson(r.budget_aci_json, [])),
    destinazioni: r ? leggiJson(r.destinazioni_json, []).map(x => ({ destinazione: x.destinazione || '', target: testo(x.target_t), trattamento: x.trattamento || '' })) : [],
    prezzo_regioni: r ? leggiJson(r.target_prezzo_regioni_json, []).map(x => ({ regione: x.regione || '', target: testo(x.target_t), prezzo: testo(x.prezzo) })) : [],
  };
}

function statoDaContratto(c) {
  return {
    target_annuo_t: testo(c.target_annuo_t),
    regioni: c.regioni.map(x => ({ regione: x.regione, province: x.province, target: testo(x.target_t) })),
    classi: c.classi.map(x => ({ classe: x.classe, descrizione: x.descrizione, peso: x.peso, percentuale: testo(x.percentuale != null ? Math.round(x.percentuale * 10000) / 100 : '') })),
    mensile_iniziale: dodici(c.target_mensile_iniziale),
    mensile: dodici(c.target_mensile),
    rete: dodici(c.budget_rete),
    aci: dodici(c.budget_aci),
    destinazioni: c.destinazioni.map(x => ({ destinazione: x.destinazione, target: testo(x.target_t), trattamento: x.trattamento })),
    prezzo_regioni: c.target_prezzo_regioni.map(x => ({ regione: x.regione, target: testo(x.target_t), prezzo: testo(x.prezzo) })),
  };
}

// Tabella con righe modificabili: colonne [{ chiave, etichetta, numero, classe }].
function Tabella({ colonne, righe, onChange, isAdmin, nuovaRiga, totale }) {
  const cambia = (i, chiave, v) => onChange(righe.map((r, j) => (j === i ? { ...r, [chiave]: v } : r)));
  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr className="text-muted-foreground">
            {colonne.map(c => <th key={c.chiave} className={`py-1 px-1 ${c.numero ? 'text-right' : 'text-left'}`}>{c.etichetta}</th>)}
            {isAdmin && <th className="w-6" />}
          </tr>
        </thead>
        <tbody>
          {righe.map((r, i) => (
            <tr key={i}>
              {colonne.map(c => (
                <td key={c.chiave} className={`py-0.5 px-1 ${c.classe || ''}`}>
                  <Input value={r[c.chiave]} onChange={e => cambia(i, c.chiave, e.target.value)} disabled={!isAdmin}
                    inputMode={c.numero ? 'decimal' : undefined} className={`h-8 ${c.numero ? 'text-right tabular-nums' : ''}`} />
                </td>
              ))}
              {isAdmin && <td><button onClick={() => onChange(righe.filter((_, j) => j !== i))} className="p-1 hover:bg-red-50 rounded" title="Togli riga"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button></td>}
            </tr>
          ))}
          {totale && (
            <tr className="border-t font-semibold">
              {colonne.map((c, i) => <td key={c.chiave} className={`py-1 px-1 ${c.numero ? 'text-right tabular-nums' : ''}`}>{i === 0 ? 'Totale' : (totale[c.chiave] ?? '')}</td>)}
              {isAdmin && <td />}
            </tr>
          )}
        </tbody>
      </table>
      {isAdmin && nuovaRiga && <button onClick={() => onChange([...righe, nuovaRiga])} className="mt-1 text-xs text-primary hover:underline inline-flex items-center gap-1"><Plus className="w-3 h-3" />Aggiungi riga</button>}
    </div>
  );
}

function Riquadro({ titolo, children, nota }) {
  return (
    <section className="border rounded-lg p-4 bg-card space-y-2">
      <h3 className="font-heading font-semibold">{titolo}</h3>
      {children}
      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
    </section>
  );
}

export default function CommessaEcotyreForm({ anno, isAdmin, user }) {
  const { toast } = useToast();
  const inputFile = useRef(null);
  const [record, setRecord] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [dati, setDati] = useState(statoDaRecord(null));
  const [modificato, setModificato] = useState(false);
  const [nota, setNota] = useState('');

  const carica = useCallback(async () => {
    setCaricando(true);
    try {
      const r = (await base44.entities.CommessaEcotyre.filter({ anno }))[0] || null;
      setRecord(r);
      setDati(statoDaRecord(r));
      setModificato(false);
      setNota('');
    } catch (e) {
      toast({ title: 'Caricamento non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
    setCaricando(false);
  }, [anno, toast]);

  useEffect(() => { carica(); }, [carica]);

  const imposta = (chiave, valore) => { setDati(prev => ({ ...prev, [chiave]: valore })); setModificato(true); };

  const importa = async (file) => {
    setImportando(true);
    try {
      const contratto = await leggiFileTargetContratto(file);
      setDati(statoDaContratto(contratto));
      setModificato(true);
      setNota(`importato da ${file.name}`);
      toast({ title: 'Dati del contratto letti dal file', description: `Controlla i valori e premi "Salva commessa ${anno}". ${contratto.avvisi.join(' ')}` });
    } catch (e) {
      toast({ title: 'Lettura non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
    setImportando(false);
  };

  const salva = async () => {
    const tuttiNumeri = [dati.target_annuo_t, ...dati.regioni.map(r => r.target), ...dati.classi.map(c => c.percentuale), ...dati.mensile_iniziale, ...dati.mensile, ...dati.rete, ...dati.aci,
      ...dati.destinazioni.map(d => d.target), ...dati.prezzo_regioni.flatMap(p => [p.target, p.prezzo])];
    if (tuttiNumeri.some(v => Number.isNaN(leggiNumero(v)) || (leggiNumero(v) ?? 0) < 0)) {
      toast({ title: 'Valori non validi', description: 'Nei campi numerici scrivi solo numeri, per esempio 11550 o 851,29.', variant: 'destructive' });
      return;
    }
    const valori = {
      anno,
      target_annuo_t: numero(dati.target_annuo_t),
      regioni_json: JSON.stringify(dati.regioni.filter(r => r.regione.trim()).map(r => ({ regione: r.regione.trim(), province: r.province.trim(), target_t: numero(r.target) }))),
      classi_json: JSON.stringify(dati.classi.filter(c => c.classe.trim()).map(c => ({ classe: c.classe.trim(), descrizione: c.descrizione.trim(), peso: c.peso.trim(), percentuale: numero(c.percentuale) === null ? null : numero(c.percentuale) / 100 }))),
      target_mensile_iniziale_json: JSON.stringify(dati.mensile_iniziale.map(numero)),
      target_mensile_json: JSON.stringify(dati.mensile.map(numero)),
      budget_rete_json: JSON.stringify(dati.rete.map(numero)),
      budget_aci_json: JSON.stringify(dati.aci.map(numero)),
      destinazioni_json: JSON.stringify(dati.destinazioni.filter(d => d.destinazione.trim()).map(d => ({ destinazione: d.destinazione.trim(), target_t: numero(d.target), trattamento: d.trattamento.trim() }))),
      target_prezzo_regioni_json: JSON.stringify(dati.prezzo_regioni.filter(p => p.regione.trim()).map(p => ({ regione: p.regione.trim(), target_t: numero(p.target), prezzo: numero(p.prezzo) }))),
    };
    setSalvando(true);
    try {
      if (record) {
        const prima = Object.fromEntries(Object.keys(valori).filter(k => k !== 'anno').map(k => [k, record[k] ?? null]));
        await base44.entities.CommessaEcotyre.update(record.id, { ...valori, storico_json: conModifica(record.storico_json, { utente: nomeUtente(user), nota, prima }) });
      } else {
        await base44.entities.CommessaEcotyre.create({ ...valori, storico_json: conModifica('[]', { utente: nomeUtente(user), nota, prima: null }) });
      }
      toast({ title: `Commessa ${anno} salvata` });
      await carica();
    } catch (e) {
      toast({ title: 'Salvataggio non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
    setSalvando(false);
  };

  if (caricando) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Caricamento…</div>;

  const annuo = numero(dati.target_annuo_t) || 0;
  const confronto = (valore) => (annuo ? (Math.abs(valore - annuo) < 0.5 ? <span className="text-emerald-700">coincide con il target annuo</span> : <span className="text-amber-700">{valore < annuo ? 'mancano' : 'eccedono'} {tonnellate(Math.abs(valore - annuo))} t rispetto al target annuo</span>) : null);
  const cambiaMese = (chiave, i, v) => imposta(chiave, dati[chiave].map((x, j) => (j === i ? v : x)));
  const sommaClassi = somma(dati.classi.map(c => c.percentuale));

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-3xl">
          Quanto richiede il contratto Ecotyre per il {anno}. Si importa dal foglio del contratto del file di gestione o si scrive a mano, e si aggiorna se Ecotyre
          lo rivede: ogni salvataggio resta nello storico. L'Andamento confronta il raccolto per regione con questi valori.
        </p>
        {isAdmin && (
          <>
            <input ref={inputFile} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) importa(f); }} />
            <Button size="sm" variant="outline" onClick={() => inputFile.current && inputFile.current.click()} disabled={importando}>
              {importando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1" />}Importa dal foglio del contratto
            </Button>
          </>
        )}
      </div>

      {!record && !modificato && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">La commessa {anno} non è ancora stata inserita.</p>}

      <div className="grid lg:grid-cols-2 gap-5">
        <Riquadro titolo="Target annuo e per regione" nota={<>Somma regioni {tonnellate(somma(dati.regioni.map(r => r.target)))} t: {confronto(somma(dati.regioni.map(r => r.target)))}</>}>
          <div className="flex items-center gap-2 max-w-[240px]">
            <Input value={dati.target_annuo_t} onChange={e => imposta('target_annuo_t', e.target.value)} disabled={!isAdmin} inputMode="decimal" className="h-9 text-right text-base font-semibold tabular-nums" placeholder="0" />
            <span className="text-sm text-muted-foreground">t annue</span>
          </div>
          <Tabella isAdmin={isAdmin} righe={dati.regioni} onChange={v => imposta('regioni', v)} nuovaRiga={{ regione: '', province: '', target: '' }}
            colonne={[{ chiave: 'regione', etichetta: 'Regione' }, { chiave: 'province', etichetta: 'Province' }, { chiave: 'target', etichetta: 't', numero: true, classe: 'w-28' }]} />
        </Riquadro>

        <Riquadro titolo="Target e budget mensili" nota={<>Target rivisto {tonnellate(somma(dati.mensile))} t: {confronto(somma(dati.mensile))}. Budget RETE {tonnellate(somma(dati.rete))} t; budget ACI {tonnellate(somma(dati.aci))} t, canale separato.</>}>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left py-1 pr-2" />
                  <th className="text-right py-1 px-1">Target iniziale</th>
                  <th className="text-right py-1 px-1">Target rivisto</th>
                  <th className="text-right py-1 px-1">Budget rete</th>
                  <th className="text-right py-1 px-1">Budget ACI</th>
                </tr>
              </thead>
              <tbody>
                {MESI.map((m, i) => (
                  <tr key={m}>
                    <td className="py-0.5 pr-2 font-medium">{m}</td>
                    {['mensile_iniziale', 'mensile', 'rete', 'aci'].map(k => (
                      <td key={k} className="py-0.5 px-1">
                        <Input value={dati[k][i]} onChange={e => cambiaMese(k, i, e.target.value)} disabled={!isAdmin} inputMode="decimal" className="h-8 text-right tabular-nums" />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t font-semibold">
                  <td className="py-1 pr-2">Totale</td>
                  {['mensile_iniziale', 'mensile', 'rete', 'aci'].map(k => <td key={k} className="py-1 px-1 text-right tabular-nums">{tonnellate(somma(dati[k]))}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </Riquadro>

        <Riquadro titolo="Ripartizione per classe" nota={dati.classi.length ? <>Somma {tonnellate(sommaClassi, 2)}%{Math.abs(sommaClassi - 100) > 0.01 ? <span className="text-amber-700"> (dovrebbe fare 100%)</span> : ''}</> : null}>
          <Tabella isAdmin={isAdmin} righe={dati.classi} onChange={v => imposta('classi', v)} nuovaRiga={{ classe: '', descrizione: '', peso: '', percentuale: '' }}
            colonne={[{ chiave: 'classe', etichetta: 'Classe', classe: 'w-16' }, { chiave: 'descrizione', etichetta: 'Veicoli' }, { chiave: 'peso', etichetta: 'Peso', classe: 'w-24' }, { chiave: 'percentuale', etichetta: '%', numero: true, classe: 'w-20' }]} />
        </Riquadro>

        <Riquadro titolo="Quantità per destinazione" nota={dati.destinazioni.length ? <>Totale {tonnellate(somma(dati.destinazioni.map(d => d.target)))} t: {confronto(somma(dati.destinazioni.map(d => d.target)))}</> : null}>
          <Tabella isAdmin={isAdmin} righe={dati.destinazioni} onChange={v => imposta('destinazioni', v)} nuovaRiga={{ destinazione: '', target: '', trattamento: '' }}
            colonne={[{ chiave: 'destinazione', etichetta: 'Destinazione' }, { chiave: 'target', etichetta: 't', numero: true, classe: 'w-28' }, { chiave: 'trattamento', etichetta: 'Trattamento' }]} />
        </Riquadro>

        <Riquadro titolo="Previsione ACI per regione (contratto ACI Ecotyre)" nota={<>{dati.prezzo_regioni.length ? <>Totale {tonnellate(somma(dati.prezzo_regioni.map(p => p.target)))} t, indicativo: il canale ACI è indipendente e non entra nel target RETE. </> : null}Il prezzo è il corrispettivo per tonnellata della regione.</>}>
          <Tabella isAdmin={isAdmin} righe={dati.prezzo_regioni} onChange={v => imposta('prezzo_regioni', v)} nuovaRiga={{ regione: '', target: '', prezzo: '' }}
            colonne={[{ chiave: 'regione', etichetta: 'Regione' }, { chiave: 'target', etichetta: 't', numero: true, classe: 'w-28' }, { chiave: 'prezzo', etichetta: '€/t', numero: true, classe: 'w-24' }]} />
        </Riquadro>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 flex-wrap sticky bottom-0 bg-background/95 py-3 border-t">
          <Input value={nota} onChange={e => setNota(e.target.value)} placeholder="Motivo della modifica, per esempio revisione Ecotyre di giugno (facoltativo)" className="h-9 max-w-md" />
          <Button onClick={salva} disabled={salvando || (!modificato && !!record)}>{salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salva commessa {anno}</Button>
          {modificato && <span className="text-xs text-amber-700">Modifiche non ancora salvate</span>}
        </div>
      )}

      {record && leggiStorico(record.storico_json).length > 0 && (
        <section className="text-xs text-muted-foreground space-y-1">
          <div className="font-medium flex items-center gap-1"><History className="w-3.5 h-3.5" />Modifiche</div>
          {[...leggiStorico(record.storico_json)].reverse().map((v, i) => (
            <div key={i}>{dataOra(v.il)}{v.da ? ` · ${v.da}` : ''}: {v.prima ? `target annuo prima ${tonnellate(v.prima.target_annuo_t)} t` : 'primo inserimento'}{v.nota ? ` — ${v.nota}` : ''}</div>
          ))}
        </section>
      )}
    </div>
  );
}
