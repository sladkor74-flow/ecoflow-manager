import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, AlertTriangle, Info, FileSpreadsheet, Copy, CheckCircle2 } from 'lucide-react';
import { formatKg, formatTonnellate } from '@/lib/utils';
import { leggiRegistroIrigom, MESI } from '@/lib/registroIrigom';
import { quantoDichiarare, componiDichiarazione, quotaFerro, MAX_PER_DICHIARAZIONE_KG } from '@/lib/dichiarazioniIrigom';
import { esportaTabellaExcel } from '@/lib/esportaTabella';

// La dichiarazione mensile di Irigom, CSS-C compreso.
//
// Si carica il registro di carico e scarico dell'impianto e il gestionale ne
// ricava, per il mese scelto: le uscite di CSS-C della nostra commessa - i DDT
// che l'impianto evidenzia in arancione - la giacenza di cippato e di PFU interi
// a fine mese, e quindi quanto va dichiarato a portale perche' la giacenza che
// resta sia quella giusta.
//
// Il file non si conserva: si legge qui nel browser e restano i numeri a schermo,
// che poi si trascrivono nel foglio delle dichiarazioni e negli allegati VII.

const t = (kg) => formatTonnellate((Number(kg) || 0) / 1000);

export default function CsscIrigom({ giacenzaPortaleT, anno }) {
  const input = useRef(null);
  const [registro, setRegistro] = useState(null);
  const [errore, setErrore] = useState('');
  const [caricando, setCaricando] = useState(false);
  const [mese, setMese] = useState(() => MESI[Math.max(0, new Date().getMonth() - 1)]);
  const [portaleManuale, setPortaleManuale] = useState('');
  const [copiato, setCopiato] = useState(false);

  const carica = async (file) => {
    setCaricando(true);
    setErrore('');
    try {
      setRegistro(await leggiRegistroIrigom(file, anno));
    } catch (e) {
      setRegistro(null);
      setErrore(e.message || String(e));
    }
    setCaricando(false);
  };

  const riga = registro ? registro.mesi.find(m => m.mese === mese) : null;
  const ddtMese = registro ? registro.cssc.righe.filter(r => r.mese === mese && r.nostra) : [];

  const portaleKg = useMemo(() => {
    if (portaleManuale.trim() !== '') return Math.round(Number(portaleManuale.replace(',', '.')) * 1000);
    return Math.round((Number(giacenzaPortaleT) || 0) * 1000);
  }, [portaleManuale, giacenzaPortaleT]);

  // Un mese che nel registro e' ancora tutto a zero non e' un mese da zero
  // giacenza: e' un mese non compilato. Senza questo controllo il conto diceva
  // di dichiarare tutta la giacenza a portale, che per Irigom sono centinaia di
  // tonnellate, e nessuno se ne sarebbe accorto guardando il numero.
  const meseVuoto = !!riga
    && !(Number(riga.giacenza_pfu_kg) > 0)
    && !(Number(riga.uscite_cssc_kg) > 0)
    && !(Number(riga.uscite_ferro_kg) > 0)
    && !ddtMese.length;
  const conto = riga && !meseVuoto ? quantoDichiarare(portaleKg, riga.giacenza_pfu_kg) : null;
  const dich = conto ? componiDichiarazione(conto.da_dichiarare_kg, ddtMese) : null;
  const ferro = dich && riga ? quotaFerro(dich.ferro_kg, riga.uscite_ferro_kg) : null;

  const copia = async () => {
    if (!dich) return;
    const testo = [
      ['DDT', 'PESO', 'PESO USCITA', 'UNITÀ DI MISURA', 'DATA TRASPORTO', 'DATA CONFERIMENTO', 'CSS-C', 'FERRO', 'TOTALE (PFU)', 'TRATTAMENTO'].join('\t'),
      ...dich.righe.map(r => [r.ddt, r.cssc_kg, r.cssc_kg, 'KG', r.data, r.data, r.cssc_kg, r.ferro_kg, r.totale_kg, 'DA PFU'].join('\t')),
      ['', '', '', '', '', '', dich.cssc_kg, dich.ferro_kg, dich.totale_kg, ''].join('\t'),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(testo);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2500);
    } catch (e) {
      setErrore('Non riesco a copiare negli appunti: seleziona la tabella a mano.');
    }
  };

  const esporta = async () => {
    if (!dich) return;
    await esportaTabellaExcel({
      nomeFile: `Dichiarazione Irigom ${mese} ${anno}`,
      foglio: 'CSS-C',
      titolo: `Irigom · dichiarazione di ${mese} ${anno}`,
      sottotitolo: `Da dichiarare ${formatKg(dich.da_dichiarare_kg)} kg perché a portale resti una giacenza di ${formatKg(conto.giacenza_attesa_kg)} kg di PFU (cippato ${formatKg(riga.giacenza_cippato_kg)} + interi ${formatKg(riga.giacenza_intero_kg)})`,
      colonne: [
        { titolo: 'DDT', valore: r => (r.ddt ? r.ddt + (r.parte ? ' (parte ' + r.parte + ')' : '') : 'soli metalli'), tipo: 'testo' },
        { titolo: 'Data', valore: r => r.data, tipo: 'data' },
        { titolo: 'CSS-C', valore: r => r.cssc_kg, tipo: 'kg' },
        { titolo: 'Metalli ferrosi', valore: r => r.ferro_kg, tipo: 'kg' },
        { titolo: 'Totale PFU', valore: r => r.totale_kg, tipo: 'kg' },
      ],
      righe: dich.righe,
      totali: { etichetta: 'Totale', valori: { 2: dich.cssc_kg, 3: dich.ferro_kg, 4: dich.totale_kg } },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Carica il registro di carico e scarico di Irigom: il gestionale ne legge le uscite di CSS-C della nostra commessa, quelle
          che l&apos;impianto evidenzia in arancione, e la giacenza di cippato e PFU interi a fine mese. Da lì calcola quanto dichiarare
          a portale perché la giacenza che resta sia esattamente quella del registro. Il CSS-C viaggia con DDT e non con formulario,
          perché ha cessato la qualifica di rifiuto. Il file non viene conservato: si legge qui e restano i numeri.
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input ref={input} type="file" className="hidden" accept=".xlsx,.xlsm,.xls"
          onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) carica(f); }} />
        <Button variant={registro ? 'outline' : 'default'} disabled={caricando} onClick={() => input.current && input.current.click()}>
          {caricando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {registro ? 'Cambia registro' : 'Carica il registro Irigom'}
        </Button>
        {registro && (
          <>
            <select value={mese} onChange={e => setMese(e.target.value)} className="px-2 py-1.5 rounded-md border bg-card text-sm">
              {MESI.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">{registro.file_nome}</span>
          </>
        )}
      </div>

      {errore && (
        <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errore}</span>
        </div>
      )}

      {registro && registro.controlli.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium"><AlertTriangle className="w-4 h-4" />Il registro non torna con se stesso</div>
          {registro.controlli.map((c, i) => <div key={i} className="text-xs">{c}</div>)}
        </div>
      )}

      {riga && meseVuoto && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium"><AlertTriangle className="w-4 h-4" />Questo mese nel registro è ancora vuoto</div>
          <div className="text-xs">
            Nella riga di {mese} del foglio Cons. non ci sono né giacenze né uscite, e non risultano DDT di CSS-C della nostra commessa.
            Non è un mese con giacenza zero: è un mese che Irigom non ha ancora compilato. Finché resta così non si calcola nulla,
            perché il conto direbbe di dichiarare tutta la giacenza a portale.
          </div>
        </div>
      )}

      {riga && conto && dich && (
        <>
          <div className="flex gap-2 flex-wrap">
            <div className="px-3 py-2 rounded-md border bg-muted/30 min-w-[170px]">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Giacenza a portale</div>
              <div className="tabular-nums">{t(conto.giacenza_portale_kg)} t</div>
              <input value={portaleManuale} onChange={e => setPortaleManuale(e.target.value)}
                placeholder="correggi in t" className="mt-1 w-full border rounded px-1.5 py-0.5 text-xs tabular-nums" />
            </div>
            <div className="px-3 py-2 rounded-md border bg-muted/30 min-w-[170px]">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Deve restare</div>
              <div className="tabular-nums">{t(conto.giacenza_attesa_kg)} t</div>
              <div className="text-[11px] text-muted-foreground">cippato {t(riga.giacenza_cippato_kg)} + interi {t(riga.giacenza_intero_kg)}</div>
            </div>
            <div className="px-3 py-2 rounded-md border bg-primary/5 border-primary/30 min-w-[170px]">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Da dichiarare</div>
              <div className="tabular-nums font-semibold text-lg">{t(conto.da_dichiarare_kg)} t</div>
              <div className="text-[11px] text-muted-foreground">{formatKg(conto.da_dichiarare_kg)} kg</div>
            </div>
            <div className="px-3 py-2 rounded-md border bg-muted/30 min-w-[170px]">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">CSS-C del mese</div>
              <div className="tabular-nums">{t(dich.cssc_kg)} t</div>
              <div className="text-[11px] text-muted-foreground">{ddtMese.length} {ddtMese.length === 1 ? 'DDT arancione' : 'DDT arancioni'}</div>
            </div>
            <div className="px-3 py-2 rounded-md border bg-muted/30 min-w-[170px]">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Metalli ferrosi</div>
              <div className="tabular-nums">{t(dich.ferro_kg)} t</div>
              {ferro && <div className="text-[11px] text-muted-foreground">{ferro.quota}% delle {t(ferro.uscito_kg)} t uscite: il resto è delle terziarie</div>}
            </div>
          </div>

          {dich.avvisi.map((a, i) => (
            <div key={i} className="flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-2.5 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{a}</span>
            </div>
          ))}
          {ferro && ferro.eccede && (
            <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-2.5 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Il ferro da dichiarare, {t(ferro.dichiarato_kg)} t, è più di quello uscito dall&apos;impianto nel mese, {t(ferro.uscito_kg)} t: qualcosa non torna fra registro e giacenza a portale.</span>
            </div>
          )}

          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h4 className="font-heading font-semibold text-sm">Dichiarazione di {mese} {anno}</h4>
                <p className="text-xs text-muted-foreground">
                  {dich.dichiarazioni} {dich.dichiarazioni === 1 ? 'dichiarazione' : 'dichiarazioni'} da caricare a portale, al massimo {formatKg(MAX_PER_DICHIARAZIONE_KG)} kg ciascuna:
                  è il limite del portale e il conto si spezza di conseguenza.
                  {dich.dichiarazioni_solo_ferro > 0 && ` ${dich.dichiarazioni_solo_ferro} ${dich.dichiarazioni_solo_ferro === 1 ? 'è' : 'sono'} di soli metalli.`}
                  {' '}La suddivisione del ferro è una proposta: il totale è quello che conta.
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={copia}>
                  {copiato ? <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiato ? 'copiata' : 'Copia per Excel'}
                </Button>
                <Button size="sm" variant="outline" onClick={esporta}><FileSpreadsheet className="w-3.5 h-3.5 mr-1" />Excel</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">DDT</th>
                    <th className="px-3 py-2 font-semibold">Data</th>
                    <th className="px-3 py-2 font-semibold text-right">CSS-C</th>
                    <th className="px-3 py-2 font-semibold text-right">Metalli ferrosi</th>
                    <th className="px-3 py-2 font-semibold text-right">Totale PFU</th>
                  </tr>
                </thead>
                <tbody>
                  {dich.righe.map((r, i) => (
                    <tr key={i} className={`border-t ${r.tipo === 'ferro' ? 'bg-muted/20' : ''}`}>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.ddt ? <>{r.ddt}{r.parte ? <span className="font-sans text-muted-foreground"> · parte {r.parte}</span> : null}</> : <span className="font-sans text-muted-foreground">soli metalli</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.data ? r.data.split('-').reverse().join('/') : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatKg(r.cssc_kg)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatKg(r.ferro_kg)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatKg(r.totale_kg)}</td>
                    </tr>
                  ))}
                  {dich.righe.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-sm">
                      Niente da dichiarare per questo mese.
                    </td></tr>
                  )}
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-3 py-2" colSpan={3}>Totale · {dich.dichiarazioni} {dich.dichiarazioni === 1 ? 'dichiarazione' : 'dichiarazioni'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKg(dich.cssc_kg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKg(dich.ferro_kg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKg(dich.totale_kg)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Nel mese il registro segna: cippato prodotto {t(riga.cippato_prodotto_kg)} t, ferro prodotto {t(riga.ferro_prodotto_kg)} t,
            CSS-C prodotto {t(riga.cssc_prodotto_kg)} t; uscite di cippato {t(riga.uscite_cippato_kg)} t, di ferro {t(riga.uscite_ferro_kg)} t,
            di CSS-C {t(riga.uscite_cssc_kg)} t. Giacenze a fine mese: CSS-C {t(riga.giacenza_cssc_kg)} t, cippato {t(riga.giacenza_cippato_kg)} t,
            interi {t(riga.giacenza_intero_kg)} t, ferro {t(riga.giacenza_ferro_kg)} t.
          </div>
        </>
      )}
    </div>
  );
}
