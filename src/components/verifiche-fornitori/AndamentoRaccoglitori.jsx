import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Download, MapPin, TrendingUp } from 'lucide-react';
import { formatKg, formatTonnellate } from '@/lib/utils';
import { scaricaExcelAndamento } from '@/lib/andamentoRaccoglitoriExport';

// L'ANDAMENTO DELLA RACCOLTA, MESE PER MESE E PER ZONA.
//
// Richiesta dell'utente (29/09/2026): «una fotografia istantanea dell'andamento
// della loro raccolta mensile man mano che il gestionale viene aggiornato», e
// «l'andamento generale per zone di competenza».
//
// I numeri si calcolano ogni volta dall'archivio delle primarie, quindi sono
// sempre quelli di adesso: non c'e' niente da aggiornare a mano e niente che possa
// restare indietro. Solo RETE: ACI ed extra raccolta hanno i loro conti.

const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function Cella({ m }) {
  if (!m.kg) return <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>;
  // Il colore dice solo dove un target c'e': senza target un giudizio sarebbe inventato.
  const colore = m.scarto_kg === null ? '' : m.scarto_kg >= 0 ? 'text-emerald-700' : 'text-amber-700';
  return (
    <td className={`px-2 py-1.5 text-right tabular-nums ${colore}`}
      title={m.target_kg === null ? `${m.ritiri} ritiri` : `${m.ritiri} ritiri · target ${formatKg(m.target_kg)} kg · ${m.copertura}%`}>
      {formatKg(m.kg)}
    </td>
  );
}

export default function AndamentoRaccoglitori({ isAdmin }) {
  const oggi = new Date();
  const [anno, setAnno] = useState(oggi.getFullYear());
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(false);
  const [errore, setErrore] = useState('');
  const [vista, setVista] = useState('raccoglitori');
  const ultima = useRef(0);

  const carica = useCallback(async () => {
    const n = ++ultima.current;
    setCaricando(true);
    setErrore('');
    try {
      const r = await base44.functions.invoke('andamentoRaccoglitori', { anno });
      if (n !== ultima.current) return;
      const corpo = (r && r.data) || r;
      if (!corpo || corpo.error) throw new Error((corpo && corpo.error) || 'L\'andamento non e\' arrivato.');
      setDati(corpo);
    } catch (e) {
      if (n === ultima.current) setErrore(e && e.message ? e.message : String(e));
    } finally {
      if (n === ultima.current) setCaricando(false);
    }
  }, [anno]);

  // I numeri dell'anno prima spariscono prima di chiedere i nuovi.
  useEffect(() => { setDati(null); carica(); }, [carica]);

  const a = dati && dati.andamento;
  const zone = dati && dati.zone;
  const anni = [oggi.getFullYear(), oggi.getFullYear() - 1, oggi.getFullYear() - 2];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium mb-1">Anno</label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={anno} onChange={e => setAnno(Number(e.target.value))}>
            {anni.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          <Button variant={vista === 'raccoglitori' ? 'default' : 'outline'} size="sm" onClick={() => setVista('raccoglitori')}>
            <TrendingUp className="w-4 h-4 mr-1.5" /> Per raccoglitore
          </Button>
          <Button variant={vista === 'zone' ? 'default' : 'outline'} size="sm" onClick={() => setVista('zone')}>
            <MapPin className="w-4 h-4 mr-1.5" /> Per zona
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={carica} disabled={caricando}>
          {caricando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null} Aggiorna
        </Button>
        {a && a.righe.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => scaricaExcelAndamento(a, zone)}>
            <Download className="w-4 h-4 mr-1.5" /> Esporta Excel
          </Button>
        )}
      </div>

      {errore && (
        <div className="flex items-start gap-2 text-sm border border-destructive/30 bg-destructive/10 text-destructive rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{errore}</span>
        </div>
      )}
      {caricando && !a && <p className="text-sm text-muted-foreground">Sto leggendo la raccolta dell&apos;anno…</p>}

      {/* Finche' le zone non sono scritte il modulo non puo' dire niente sul fuori
          zona, e lo dice invece di tacere: una tabella muta si leggerebbe come
          "va tutto bene". */}
      {a && a.senza_zona.length > 0 && (
        <div className="flex items-start gap-2 text-sm border border-amber-200 bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {a.senza_zona.length === 1
              ? `Un raccoglitore non ha una zona di competenza scritta (${a.senza_zona[0]}): di lui si vede dove ha raccolto, ma non si può dire se ha raccolto fuori zona.`
              : `${a.senza_zona.length} raccoglitori non hanno una zona di competenza scritta (${a.senza_zona.slice(0, 6).join(', ')}${a.senza_zona.length > 6 ? ` e altri ${a.senza_zona.length - 6}` : ''}): di loro si vede dove hanno raccolto, ma non si può dire se hanno raccolto fuori zona.`}
            {isAdmin ? ' Le zone si scrivono in Target & Status; lì trovi anche una proposta, presa da dove ciascuno ha davvero raccolto.' : ''}
          </span>
        </div>
      )}

      {a && a.righe.length === 0 && !caricando && <p className="text-sm text-muted-foreground">Nessuna raccolta di rete nel {anno}.</p>}

      {a && a.righe.length > 0 && vista === 'raccoglitori' && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-2 py-2 font-semibold whitespace-nowrap">Raccoglitore</th>
                  {MESI_BREVI.map(m => <th key={m} className="px-2 py-2 font-semibold text-right">{m}</th>)}
                  <th className="px-2 py-2 font-semibold text-right border-l whitespace-nowrap">Anno kg</th>
                  <th className="px-2 py-2 font-semibold text-right whitespace-nowrap">Target</th>
                  <th className="px-2 py-2 font-semibold text-right whitespace-nowrap">Scarto</th>
                  <th className="px-2 py-2 font-semibold whitespace-nowrap">Dove ha raccolto</th>
                </tr>
              </thead>
              <tbody>
                {a.righe.map(r => (
                  <tr key={r.chiave} className="border-t hover:bg-muted/30 align-top">
                    <td className="px-2 py-1.5 font-medium whitespace-nowrap">{r.nome}</td>
                    {r.mesi.map((m, i) => <Cella key={i} m={m} />)}
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium border-l">{formatKg(r.kg)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{r.target_anno_kg === null ? '—' : formatKg(r.target_anno_kg)}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${r.scarto_anno_kg === null ? 'text-muted-foreground' : r.scarto_anno_kg >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {r.scarto_anno_kg === null ? '—' : `${r.scarto_anno_kg > 0 ? '+' : ''}${formatKg(r.scarto_anno_kg)}`}
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {r.province.map(p => (
                        <span key={p.provincia}
                          className={`inline-block mr-1 mb-0.5 px-1.5 py-0.5 rounded ${r.fuori_zona.some(f => f.provincia === p.provincia) ? 'bg-amber-100 text-amber-900 font-medium' : 'bg-muted'}`}
                          title={`${formatKg(p.kg)} kg in ${p.ritiri} ritiri${r.fuori_zona.some(f => f.provincia === p.provincia) ? ' — fuori dalla sua zona' : ''}`}>
                          {p.provincia}
                        </span>
                      ))}
                      {r.fuori_zona.length > 0 && (
                        <span className="block text-amber-800 mt-0.5">fuori zona: {formatKg(r.fuori_zona_kg)} kg</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/50 font-bold border-t-2">
                <tr>
                  <td className="px-2 py-2">TOTALE</td>
                  {a.totali_mese.map((k, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{k ? formatKg(k) : '—'}</td>)}
                  <td className="px-2 py-2 text-right tabular-nums border-l">{formatKg(a.totale_kg)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="px-3 py-2 text-xs text-muted-foreground border-t">
            {formatTonnellate(a.totale_kg / 1000)} t di rete nel {a.anno}, per fine trasporto. ACI ed extra raccolta hanno i loro conti e non si sommano qui.
            Il colore di un mese confronta col target di Target &amp; Status: dove un target non c&apos;è, il numero resta neutro, perché uno scarto senza target sarebbe un giudizio inventato.
            Una provincia in ambra è fuori dalla zona di competenza scritta.
          </p>
        </div>
      )}

      {a && a.righe.length > 0 && vista === 'zone' && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  {['Provincia', 'Regione', 'Raccolto kg', 'Ritiri', 'Chi ci ha raccolto'].map(h => (
                    <th key={h} className="px-2 py-2 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zone.map(z => (
                  <tr key={z.provincia} className="border-t align-top">
                    <td className="px-2 py-1.5 font-medium">{z.provincia}</td>
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{z.regione || '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatKg(z.kg)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{z.ritiri}</td>
                    <td className="px-2 py-1.5 text-xs">
                      {z.raccoglitori.map(r => (
                        <span key={r.chiave} className={`inline-block mr-2 ${r.di_sua_competenza === false ? 'text-amber-800 font-medium' : ''}`}>
                          {r.nome} {formatKg(r.kg)} kg
                          {r.di_sua_competenza === false ? ' (fuori zona)' : r.di_sua_competenza === null ? ' (zona non scritta)' : ''}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-xs text-muted-foreground border-t">
            Quanto è uscito da ogni provincia e per mano di chi. «Fuori zona» si può dire solo dove la zona è scritta: dove non lo è, la riga lo dichiara invece di dare per buono.
          </p>
        </div>
      )}
    </div>
  );
}
