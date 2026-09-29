import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Scale, AlertTriangle, CheckCircle2, CalendarX } from 'lucide-react';
import { formatKg, formatTonnellate } from '@/lib/utils';
import { scaricaExcelConferimenti } from '@/lib/reportConferimentiExport';

// I CONFERIMENTI DI UN MESE, SETTIMANA PER SETTIMANA.
//
// Richiesta dell'utente (29/09/2026). Un componente solo per tutti i casi: le
// secondarie di rete e ACI nel modulo Secondarie, le primarie e le secondarie di
// extra raccolta nella loro pagina, le primarie ACI nella loro. Cambia il canale e
// il tipo, non il modo di contare: tre tabelle scritte in tre posti sarebbero, fra
// qualche mese, tre modi diversi di contare gli stessi chili.
//
// Il conto lo fa il server (base44/functions/reportConferimenti), che legge
// l'archivio una volta sola. La quadratura con la fatturazione passiva si CHIEDE
// con un pulsante: quel conto legge sei archivi interi e farlo a ogni apertura
// riempirebbe il limite di richieste al minuto della piattaforma.

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const gg = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');

export default function ReportConferimenti({ canale, tipo = 'secondaria', titolo, anno: annoIniziale }) {
  const oggi = new Date();
  const [anno, setAnno] = useState(annoIniziale || oggi.getFullYear());
  const [mese, setMese] = useState(oggi.getMonth() + 1);
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(false);
  const [errore, setErrore] = useState('');
  const [quadrando, setQuadrando] = useState(false);
  // VALE SOLO L'ULTIMA RICHIESTA. Il componente non si rimonta quando cambia il
  // canale (in Secondarie e' un prop, e la scheda Rete/ACI sta fuori): senza
  // questo contatore, una risposta della rete arrivata in ritardo finiva sotto
  // l'intestazione ACI. E la quadratura, che legge sei archivi ed e' lenta, poteva
  // atterrare dopo un cambio di mese e rimettere a video il mese prima. E' lo
  // stesso difetto che la pagina Secondarie aveva gia' risolto cosi'.
  const ultima = useRef(0);

  const carica = useCallback(async (conPassiva = false) => {
    const n = ++ultima.current;
    conPassiva ? setQuadrando(true) : setCaricando(true);
    setErrore('');
    try {
      const r = await base44.functions.invoke('reportConferimenti', { anno, mese, canale, tipo, con_passiva: conPassiva });
      if (n !== ultima.current) return;
      const corpo = (r && r.data) || r;
      if (!corpo || corpo.error) throw new Error((corpo && corpo.error) || 'Il report non e\' arrivato.');
      setDati(corpo);
    } catch (e) {
      if (n !== ultima.current) return;
      setErrore(e && e.message ? e.message : String(e));
    } finally {
      if (n === ultima.current) { setCaricando(false); setQuadrando(false); }
    }
  }, [anno, mese, canale, tipo]);

  // I numeri vecchi spariscono PRIMA di chiedere i nuovi: mostrare i chili della
  // rete sotto il titolo dell'ACI, o quelli di agosto sotto il selettore di
  // settembre, sarebbe una bugia che dura quanto la chiamata.
  useEffect(() => { setDati(null); carica(false); }, [carica]);

  const report = dati && dati.report;
  const quadratura = dati && dati.quadratura;
  const quadraturaPossibile = !quadratura || quadratura.applicabile !== false;
  const anni = [oggi.getFullYear() + 1, oggi.getFullYear(), oggi.getFullYear() - 1, oggi.getFullYear() - 2];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium mb-1">Anno</label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={anno} onChange={e => setAnno(Number(e.target.value))}>
            {anni.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Mese di competenza</label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={mese} onChange={e => setMese(Number(e.target.value))}>
            {MESI.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={() => carica(false)} disabled={caricando}>
          {caricando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null} Aggiorna
        </Button>
        {/* Il pulsante c'e' solo dove la quadratura per tratta si puo' davvero
            fare: sulle primarie e sull'extra raccolta la passiva raggruppa in un
            altro modo, e offrirlo lo stesso avrebbe fatto leggere sei archivi per
            dire una frase. Il perche' si legge sotto la tabella. */}
        {quadraturaPossibile && (
          <Button variant="outline" size="sm" onClick={() => carica(true)} disabled={quadrando || caricando}
            title="Confronta questi chili con quelli che la fatturazione passiva paga sulle stesse tratte. Legge sei archivi, quindi si chiede quando serve">
            {quadrando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Scale className="w-4 h-4 mr-1.5" />} Quadra con la passiva
          </Button>
        )}
        {report && report.righe.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => scaricaExcelConferimenti(report, quadratura, titolo)}>
            <Download className="w-4 h-4 mr-1.5" /> Esporta Excel
          </Button>
        )}
      </div>

      {errore && (
        <div className="flex items-start gap-2 text-sm border border-destructive/30 bg-destructive/10 text-destructive rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{errore}</span>
        </div>
      )}

      {caricando && !report && <p className="text-sm text-muted-foreground">Sto leggendo i conferimenti…</p>}

      {report && report.righe.length === 0 && !caricando && (
        <p className="text-sm text-muted-foreground">
          Nessun conferimento {canale === 'EXTRA_RACCOLTA' ? 'di extra raccolta' : `di ${canale === 'ACI' ? 'ACI' : 'rete'}`} con la fine trasporto in {MESI[mese - 1]} {anno}.
        </p>
      )}

      {/* I terminati senza la data si segnalano SEMPRE (regola dell'utente,
          22/09/2026): stava dentro il blocco della tabella, e in un mese senza
          conferimenti spariva - proprio quando e' l'unica cosa da dire. */}
      {report && report.senza_fine > 0 && (
        <div className="flex items-start gap-2 text-sm border border-amber-200 bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
          <CalendarX className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Restano fuori {report.senza_fine} {report.senza_fine === 1 ? 'movimento terminato' : 'movimenti terminati'} senza la data di fine trasporto,
            per {formatKg(report.senza_fine_kg)} kg ({report.senza_fine_ordini.join(', ')}{report.senza_fine > report.senza_fine_ordini.length ? ` e altri ${report.senza_fine - report.senza_fine_ordini.length}` : ''}):
            senza quella data non stanno in nessuna settimana, e la data va inserita a portale.
          </span>
        </div>
      )}

      {report && report.righe.length > 0 && (
        <>
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">{report.tipo === 'secondaria' ? 'Stoccaggio di origine' : 'Provincia di ritiro'}</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">Destinazione</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">Trasportatore</th>
                    {report.settimane.map(s => (
                      /* Il numero della settimana da solo sarebbe ambiguo da un anno
                         all'altro: accanto c'e' sempre l'intervallo dei giorni. */
                      <th key={s.numero} className="px-2 py-2 font-semibold text-right whitespace-nowrap">
                        S{s.numero}
                        <span className="block text-[10px] font-normal text-muted-foreground">{gg(s.dal)}–{gg(s.al)}</span>
                      </th>
                    ))}
                    <th className="px-2 py-2 font-semibold text-right whitespace-nowrap border-l">Totale kg</th>
                    <th className="px-2 py-2 font-semibold text-right whitespace-nowrap">Formulari</th>
                  </tr>
                </thead>
                <tbody>
                  {report.righe.map(r => (
                    <tr key={r.chiave} className="border-t hover:bg-muted/30">
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.origine || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.destinazione || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{r.trasportatore || '—'}</td>
                      {report.settimane.map(s => (
                        <td key={s.numero} className={`px-2 py-1.5 text-right tabular-nums ${r.settimane[s.numero].kg ? '' : 'text-muted-foreground'}`}>
                          {r.settimane[s.numero].kg ? formatKg(r.settimane[s.numero].kg) : '—'}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium border-l">{formatKg(r.kg)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{r.formulari}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 font-bold border-t-2">
                  <tr>
                    <td className="px-2 py-2" colSpan={3}>TOTALE</td>
                    {report.settimane.map(s => (
                      <td key={s.numero} className="px-2 py-2 text-right tabular-nums">{formatKg(report.totali_settimana[s.numero].kg)}</td>
                    ))}
                    <td className="px-2 py-2 text-right tabular-nums border-l">{formatKg(report.totale_kg)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{report.totale_formulari}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="px-3 py-2 text-xs text-muted-foreground border-t">
              {formatTonnellate(report.totale_t)} t in {MESI[report.mese - 1]} {report.anno}, un canale solo: rete, ACI ed extra raccolta non si sommano mai.
              Un carico sta nella settimana in cui il trasporto e&apos; FINITO, non in quella in cui il portale ha chiuso l&apos;ordine.
              Una settimana a cavallo di due mesi conta qui solo per i giorni che cadono nel mese.
            </p>
          </div>

          {/* I conferimenti per impianto: e' la domanda da cui nasce il report. */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b font-semibold text-sm">Totale per destinazione</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {report.per_destinazione.map(d => (
                    <tr key={d.destinazione} className="border-t">
                      <td className="px-3 py-1.5">{d.destinazione || '—'}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground whitespace-nowrap">{d.tratte} {d.tratte === 1 ? 'tratta' : 'tratte'} · {d.formulari} formulari</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium whitespace-nowrap">{formatKg(d.kg)} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {quadratura && quadratura.disponibile && (
            <div className={`border rounded-lg overflow-hidden ${quadratura.quadra ? 'border-emerald-200' : 'border-amber-300'}`}>
              <div className={`px-3 py-2 text-sm font-semibold flex items-center gap-2 ${quadratura.quadra ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
                {quadratura.quadra ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {quadratura.quadra
                  ? `Quadra con la fatturazione passiva: ${formatKg(quadratura.totale_report_kg)} kg su tutte le tratte.`
                  : `${quadratura.n_difformi} ${quadratura.n_difformi === 1 ? 'tratta non quadra' : 'tratte non quadrano'} con la fatturazione passiva.`}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      {['Origine', 'Destinazione', 'Trasportatore', 'kg qui', 'kg in passiva', 'Scarto', 'Importo passiva'].map(h => (
                        <th key={h} className="px-2 py-1.5 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quadratura.voci.map((v, i) => (
                      <tr key={i} className={`border-t ${v.torna === false || v.solo_report ? 'bg-amber-50' : ''}`}>
                        <td className="px-2 py-1.5 whitespace-nowrap">{v.origine || '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{v.destinazione || '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{v.trasportatore || '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatKg(v.kg_report)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{v.kg_passiva === null ? '—' : formatKg(v.kg_passiva)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {v.solo_report
                            ? <span className="text-amber-800">non la paga nessuno</span>
                            : v.scarto_kg === 0 ? '0' : <span className="text-amber-800 font-medium">{v.scarto_kg > 0 ? '+' : ''}{formatKg(v.scarto_kg)}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          {v.importo_passiva === null ? '—' : `${formatTonnellate(v.importo_passiva)} €`}{v.unita_misura ? ` (${v.unita_misura})` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-3 py-2 text-xs text-muted-foreground border-t">
                Si confrontano i CHILI, non gli euro: l&apos;importo della passiva dipende anche dai viaggi e dalle tariffe, e qui sta accanto solo per informazione.
                Una tratta che sta qui e non nella passiva di solito non ha una tariffa, quindi nessuno la paga: va guardata.
                Lo scarto si dice e non si aggiusta — un totale ritoccato per far quadrare la vista nasconderebbe proprio la cosa da capire.
              </p>
            </div>
          )}

          {quadratura && !quadratura.disponibile && quadratura.motivo && (
            <p className="text-xs text-muted-foreground">{quadratura.motivo}</p>
          )}
        </>
      )}
    </div>
  );
}
