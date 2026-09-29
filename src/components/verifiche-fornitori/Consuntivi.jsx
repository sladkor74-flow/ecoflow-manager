import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Download, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Snowflake } from 'lucide-react';
import { formatKg } from '@/lib/utils';
import { tabelleDalFile, scaricaExcelConsuntivo } from '@/lib/consuntivoFornitoreFile';

// I CONSUNTIVI DI CHIUSURA MESE DEI FORNITORI (richiesta dell'utente, 29/09/2026).
//
// Si carica il report definitivo con cui un fornitore chiude il mese, si verifica
// riga per riga contro i nostri movimenti, e accanto si mette l'importo che la
// fatturazione passiva gli riconosce. E' un report SUO, non una fattura: niente
// IVA, niente imponibile.
//
// Il file non si conserva: si legge nel browser e al server arrivano solo le celle.
//
// Tre ruoli, tre basi diverse, perche' tre sono le prestazioni che un fornitore ci
// fattura. Lo stesso soggetto che raccoglie e ha il piazzale manda due consuntivi.

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const CANALI = [['RETE', 'Rete'], ['ACI', 'ACI'], ['EXTRA_RACCOLTA', 'Extra raccolta']];
const RUOLI = [
  ['raccoglitore', 'Raccoglitore', 'le primarie che ha raccolto'],
  ['impianto', 'Impianto o stoccaggio', 'tutto quello che gli è arrivato, primarie e secondarie'],
  ['trasportatore', 'Trasportatore di secondarie', 'le secondarie che ha portato'],
];

export default function Consuntivi({ isAdmin }) {
  const oggi = new Date();
  const [anno, setAnno] = useState(oggi.getFullYear());
  const [mese, setMese] = useState(oggi.getMonth() === 0 ? 12 : oggi.getMonth());
  const [canale, setCanale] = useState('RETE');
  const [fornitore, setFornitore] = useState('');
  const [ruolo, setRuolo] = useState('raccoglitore');
  const [importo, setImporto] = useState('');
  const [elenco, setElenco] = useState([]);
  const [aperto, setAperto] = useState(null);
  const [esito, setEsito] = useState(null);
  const [occupato, setOccupato] = useState('');
  const [errore, setErrore] = useState('');
  const fileRef = useRef(null);

  const carica = useCallback(async () => {
    setErrore('');
    try {
      const r = await base44.entities.ConsuntivoFornitore.filter({ anno, mese, canale }, 'fornitore', 200);
      setElenco(r || []);
    } catch (e) { setErrore(e && e.message ? e.message : String(e)); }
  }, [anno, mese, canale]);

  useEffect(() => { setAperto(null); setEsito(null); carica(); }, [carica]);

  const chiama = async (corpo, etichetta) => {
    setOccupato(etichetta);
    setErrore('');
    try {
      const r = await base44.functions.invoke('elaboraConsuntivo', corpo);
      const d = (r && r.data) || r;
      if (!d || d.error) throw new Error((d && d.error) || 'Il confronto non è arrivato.');
      setEsito(d);
      setAperto(d.consuntivo || null);
      await carica();
      return d;
    } catch (e) {
      setErrore(e && e.message ? e.message : String(e));
      return null;
    } finally { setOccupato(''); }
  };

  const scegliFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    if (!fornitore.trim()) { setErrore('Scrivi prima di chi è il consuntivo.'); return; }
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) { setErrore('Il consuntivo si carica in Excel o CSV.'); return; }
    setOccupato('carica');
    try {
      const tabelle = await tabelleDalFile(file);
      await chiama({
        azione: 'carica', fornitore: fornitore.trim(), ruolo, anno, mese, canale,
        file_nome: file.name, tabelle,
        importo_consuntivo: importo.trim() === '' ? null : Number(String(importo).replace(',', '.')),
      }, 'carica');
    } catch (e) {
      setErrore(e && e.message ? e.message : String(e));
      setOccupato('');
    }
  };

  const apri = async (c) => { setAperto(c); await chiama({ azione: 'confronta', id: c.id }, 'confronta'); };
  const elimina = async (c) => {
    if (!window.confirm(`Elimino il consuntivo di ${c.fornitore} per ${MESI[c.mese - 1]} ${c.anno}? Le righe lette si perdono e il file va ricaricato.`)) return;
    await chiama({ azione: 'elimina', id: c.id }, 'elimina');
    setAperto(null); setEsito(null);
    await carica();
  };

  const congela = async () => {
    if (!window.confirm(`Congelo il conto della fatturazione passiva di ${MESI[mese - 1]} ${anno} per ${canale}? Serve a confrontare i consuntivi che arriveranno con il conto di oggi, non con quello ricalcolato allora.`)) return;
    setOccupato('congela');
    setErrore('');
    try {
      const r = await base44.functions.invoke('congelaPassivaMese', { anno, mese, canale, nota: 'chiusura del mese' });
      const d = (r && r.data) || r;
      if (!d || d.error) throw new Error((d && d.error) || 'Il congelamento non è riuscito.');
      if (aperto) await chiama({ azione: 'confronta', id: aperto.id }, 'confronta');
    } catch (e) { setErrore(e && e.message ? e.message : String(e)); }
    finally { setOccupato(''); }
  };

  const c = esito && esito.confronto;
  const v = esito && esito.esito;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium mb-1">Anno</label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={anno} onChange={e => setAnno(Number(e.target.value))}>
            {[oggi.getFullYear(), oggi.getFullYear() - 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Mese di competenza</label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={mese} onChange={e => setMese(Number(e.target.value))}>
            {MESI.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Canale</label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={canale} onChange={e => setCanale(e.target.value)}>
            {CANALI.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={congela} disabled={!!occupato}
            title="Fissa il conto della passiva di questo mese e canale: i consuntivi che arriveranno si confronteranno con questo, e non con il ricalcolo di allora">
            {occupato === 'congela' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Snowflake className="w-4 h-4 mr-1.5" />} Congela il conto della passiva
          </Button>
        )}
      </div>

      {isAdmin && (
        <div className="bg-card border rounded-lg p-3 space-y-2">
          <div className="text-sm font-semibold">Carica un consuntivo</div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium mb-1">Di chi è</label>
              <input value={fornitore} onChange={e => setFornitore(e.target.value)} placeholder="Ragione sociale, come la conosciamo"
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Con che cosa ci fattura</label>
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={ruolo} onChange={e => setRuolo(e.target.value)}>
                {RUOLI.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Importo sul consuntivo (facoltativo)</label>
              <input value={importo} onChange={e => setImporto(e.target.value)} placeholder="€" className="border rounded-md px-3 py-2 text-sm w-32" />
            </div>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={!!occupato}>
              {occupato === 'carica' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />} Scegli il file
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls,.csv" className="hidden" onChange={scegliFile} />
          </div>
          <p className="text-xs text-muted-foreground">
            {RUOLI.find(r => r[0] === ruolo)?.[2]}. Il file si legge qui nel browser e non viene conservato: al gestionale arrivano solo le righe.
            Lo stesso soggetto che raccoglie e ha il piazzale manda <strong>due</strong> consuntivi, uno per prestazione.
          </p>
        </div>
      )}

      {errore && (
        <div className="flex items-start gap-2 text-sm border border-destructive/30 bg-destructive/10 text-destructive rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{errore}</span>
        </div>
      )}

      {elenco.length === 0 && <p className="text-sm text-muted-foreground">Nessun consuntivo caricato per {MESI[mese - 1]} {anno} su {CANALI.find(x => x[0] === canale)?.[1]}.</p>}

      {elenco.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                {['Fornitore', 'Ruolo', 'File', 'Esito', ''].map(h => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {elenco.map(x => (
                <tr key={x.id} className={`border-t ${aperto && aperto.id === x.id ? 'bg-muted/40' : ''}`}>
                  <td className="px-2 py-1.5 font-medium">{x.fornitore}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{RUOLI.find(r => r[0] === x.ruolo)?.[1] || x.ruolo}</td>
                  <td className="px-2 py-1.5 text-xs font-mono text-muted-foreground">{x.file_nome || '—'}</td>
                  <td className="px-2 py-1.5">
                    {x.quadra === true
                      ? <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> quadra</span>
                      : x.quadra === false
                        ? <span className="text-amber-800 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> da guardare</span>
                        : <span className="text-muted-foreground">non ancora confrontato</span>}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right">
                    <Button size="sm" variant="outline" className="h-7 px-2 mr-1" onClick={() => apri(x)} disabled={!!occupato}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Confronta
                    </Button>
                    {isAdmin && (
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => elimina(x)} disabled={!!occupato}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {esito && c && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className={`px-3 py-2 text-sm font-semibold flex items-center justify-between gap-2 ${v.quadra_tutto ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
            <span className="flex items-center gap-2">
              {c.quadra && v.quadra_con_passiva !== false ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {esito.testo}
            </span>
            {aperto && (
              <Button size="sm" variant="outline" className="h-7" onClick={() => scaricaExcelConsuntivo(aperto, esito)}>
                <Download className="w-3.5 h-3.5 mr-1" /> Esporta
              </Button>
            )}
          </div>

          <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-b">
            <div><div className="text-xs text-muted-foreground">Chili del consuntivo</div><div className="tabular-nums font-medium">{formatKg(c.totale_consuntivo_kg)}</div></div>
            <div><div className="text-xs text-muted-foreground">Chili dei nostri movimenti</div><div className="tabular-nums font-medium">{formatKg(c.totale_gestionale_kg)}</div></div>
            <div>
              <div className="text-xs text-muted-foreground">Importo previsto</div>
              <div className="tabular-nums font-medium">{v.importo_previsto === null ? '—' : `${v.importo_previsto.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €`}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Sul consuntivo</div>
              <div className="tabular-nums font-medium">{v.importo_consuntivo === null ? 'non indicato' : `${Number(v.importo_consuntivo).toLocaleString('it-IT', { minimumFractionDigits: 2 })} €`}</div>
            </div>
          </div>

          {v.non_controllato && v.non_controllato.length > 0 && (
            <p className="px-3 py-2 text-xs text-amber-900 bg-amber-50 border-b">Non si e&apos; potuto controllare: {v.non_controllato.join('; ')}. Un controllo mancato non e&apos; un controllo passato.</p>
          )}
          {esito.costo && !esito.costo.trovato && (
            <p className="px-3 py-2 text-xs text-amber-900 bg-amber-50 border-b">{esito.costo.motivo}</p>
          )}
          {esito.congelato && (
            <p className="px-3 py-2 text-xs text-muted-foreground border-b">
              Il confronto usa il conto della passiva <strong>congelato</strong> il {String(esito.congelato.congelato_il).slice(0, 10).split('-').reverse().join('/')}
              {esito.congelato.congelato_da ? ` da ${esito.congelato.congelato_da}` : ''}: allora erano {esito.congelato.importo_allora === null ? '—' : `${esito.congelato.importo_allora} €`},
              ricalcolandolo oggi sono {esito.congelato.importo_oggi === null ? '—' : `${esito.congelato.importo_oggi} €`}.
              {esito.congelato.cambiato ? ' Si è mosso: prima di pagare va capito perché — di solito sono ordini chiusi dopo la chiusura del mese.' : ' Non si è mosso.'}
            </p>
          )}

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  {['Formulario o ordine', 'Esito', 'kg consuntivo', 'kg nostri', 'Scarto', 'ID ordine'].map(h => (
                    <th key={h} className="px-2 py-1.5 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.voci.map((x, i) => (
                  <tr key={i} className={`border-t ${x.esito === 'uguale' ? '' : 'bg-amber-50'}`}>
                    <td className="px-2 py-1 font-mono">{String(x.chiave).replace(/^(FIR|ORD):/, '')}</td>
                    <td className="px-2 py-1">{x.esito === 'uguale' ? 'torna' : x.esito === 'peso_diverso' ? 'peso diverso' : x.esito === 'solo_consuntivo' ? 'ce lo fattura e noi non l\'abbiamo' : 'l\'abbiamo noi e non lo riporta'}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{x.kg_consuntivo === null ? '—' : formatKg(x.kg_consuntivo)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{x.kg_gestionale === null ? '—' : formatKg(x.kg_gestionale)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{x.scarto_kg === null ? '—' : `${x.scarto_kg > 0 ? '+' : ''}${formatKg(x.scarto_kg)}`}</td>
                    <td className="px-2 py-1 text-muted-foreground">{x.id_ordine || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-xs text-muted-foreground border-t">
            È un report del fornitore, non una fattura: non c&apos;è IVA e non c&apos;è imponibile. Dal conto della fatturazione passiva restano
            fuori <strong>per costruzione</strong> le terziarie — che la passiva non legge affatto — e gli oneri fissi dell&apos;extra raccolta
            (pulizia e costi aggiuntivi), che escono solo come segnalazione: una differenza su quelle voci non è una difformità.
            {' '}Le <strong>secondarie di extra raccolta</strong> invece <em>sono</em> nel conto, pagate come raccolta a chi le trasporta,
            e qui sono contate come tali: la nota di prima diceva il contrario, ed era falsa.
          </p>
        </div>
      )}
    </div>
  );
}
