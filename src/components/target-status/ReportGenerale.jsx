import React, { useMemo, useState } from 'react';
import { MESI } from '@/lib/pfuConstants';
import { tonnellate, chiaveNome } from '@/lib/target';
import { calcolaReportGenerale, raggruppa, sommaRighe, valoriMese, impiantiMese, totaliPerImpianto } from '@/lib/reportGeneraleVista';

// Report Generale: target assegnati contro raccolto RETE per regione e
// raccoglitore. L'impianto di destinazione si legge a consuntivo: sotto ogni
// raccoglitore il raccolto e' ripartito per impianto effettivo. Solo lettura.

const leggiLista = (json) => { try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const num = (v) => (v === null || v === undefined ? '—' : tonnellate(v));
const segno = (v) => (v > 0 ? 'text-red-600' : v < 0 ? 'text-emerald-700' : '');

function Celle({ v, forte }) {
  const c = forte ? 'font-semibold' : '';
  return (
    <>
      <td className={`px-2 py-1.5 text-right tabular-nums ${c}`}>{num(v.annuo || null)}</td>
      <td className={`px-2 py-1.5 text-right tabular-nums text-muted-foreground ${c}`}>{num(v.mediaResidua)}</td>
      <td className={`px-2 py-1.5 text-right tabular-nums border-l ${c}`}>{num(v.target)}</td>
      <td className={`px-2 py-1.5 text-right tabular-nums ${c}`}>{num(v.raccolto)}</td>
      <td className={`px-2 py-1.5 text-right tabular-nums ${segno(v.delta)} ${c}`}>{v.target || v.raccolto ? num(v.delta) : '—'}</td>
      <td className={`px-2 py-1.5 text-right tabular-nums border-l ${c}`}>{num(v.progressivo)}</td>
      <td className={`px-2 py-1.5 text-right tabular-nums ${v.residuo < 0 ? 'text-emerald-700' : ''} ${c}`}>{v.annuo ? num(v.residuo) : '—'}</td>
      <td className={`px-2 py-1.5 text-right tabular-nums ${c}`}>{v.percentualeAnnuo !== null ? `${tonnellate(v.percentualeAnnuo)}%` : '—'}</td>
    </>
  );
}

function RigheImpianti({ elenco, totaleMese }) {
  return elenco.map(i => (
    <tr key={i.impianto} className="text-xs text-muted-foreground">
      <td className="px-2 py-0.5 pl-14">→ {i.impianto}</td>
      <td /><td />
      <td className="border-l" />
      <td className="px-2 py-0.5 text-right tabular-nums">{num(i.raccolto)}{totaleMese > 0 && i.raccolto > 0 ? ` (${Math.round(i.raccolto / totaleMese * 100)}%)` : ''}</td>
      <td />
      <td className="px-2 py-0.5 text-right tabular-nums border-l">{num(i.progressivo)}</td>
      <td /><td />
    </tr>
  ));
}

export default function ReportGenerale({ anno, mensili, annui, raccolto, commessa }) {
  const oggi = new Date();
  const [meseIdx, setMeseIdx] = useState(anno === oggi.getFullYear() ? oggi.getMonth() : 11);
  const [dettaglio, setDettaglio] = useState(true);

  const righe = useMemo(
    () => calcolaReportGenerale({ mensili, annui, raccolto: raccolto?.by_raccoglitore_impianto || [], chiave: chiaveNome }),
    [mensili, annui, raccolto],
  );
  const gruppi = useMemo(() => raggruppa(righe), [righe]);
  const totale = useMemo(() => sommaRighe(righe), [righe]);

  if (!righe.length) {
    return <p className="text-sm text-muted-foreground border rounded-lg px-4 py-3">Nessun target raccoglitori per il {anno}: inseriscili nella scheda Target raccoglitori.</p>;
  }

  const contratto = leggiLista(commessa?.target_mensile_json).map(v => Number(v) || 0);
  const vTot = valoriMese(totale, meseIdx);
  const contrattoMese = contratto[meseIdx] || 0;
  const contrattoProgressivo = contratto.slice(0, meseIdx + 1).reduce((s, v) => s + v, 0);
  const senzaTarget = righe.filter(r => !r.conTarget);
  const perImpianto = totaliPerImpianto(righe, meseIdx);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground">Mese</label>
        <select value={meseIdx} onChange={e => setMeseIdx(Number(e.target.value))} className="border rounded-md px-2 py-1.5 text-sm bg-background">
          {MESI.map((m, i) => <option key={m} value={i}>{m} {anno}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={dettaglio} onChange={e => setDettaglio(e.target.checked)} /> Mostra il raccolto per impianto
        </label>
        <span className="text-xs text-muted-foreground">Raccolto RETE: formulari terminati per data di fine trasporto. Delta = target meno raccolto, rosso se manca raccolta.</span>
      </div>
      <div className="border rounded-lg overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="px-2 py-2">Regione / raccoglitore / impianto a consuntivo</th>
              <th className="px-2 py-2 text-right">Target annuo</th>
              <th className="px-2 py-2 text-right">Media mensile residua</th>
              <th className="px-2 py-2 text-right border-l">Target {MESI[meseIdx]}</th>
              <th className="px-2 py-2 text-right">Raccolto {MESI[meseIdx]}</th>
              <th className="px-2 py-2 text-right">Delta</th>
              <th className="px-2 py-2 text-right border-l">Raccolto al {new Date(anno, meseIdx + 1, 0).getDate()} {MESI[meseIdx]}</th>
              <th className="px-2 py-2 text-right">Residuo annuo</th>
              <th className="px-2 py-2 text-right">% annuo</th>
            </tr>
          </thead>
          <tbody>
            {gruppi.map(g => (
              <React.Fragment key={g.regione}>
                <tr className="border-t-2 bg-primary/5">
                  <td className="px-2 py-1.5 font-semibold">{g.regione || 'Regione non indicata'}</td>
                  <Celle v={valoriMese(sommaRighe(g.righe), meseIdx)} forte />
                </tr>
                {g.righe.map(r => {
                  const v = valoriMese(r, meseIdx);
                  return (
                    <React.Fragment key={`${r.regione}|${r.kRaccoglitore}`}>
                      <tr className="border-t">
                        <td className="px-2 py-1.5 pl-6">
                          {r.raccoglitore}
                          {!r.conTarget && <span className="ml-2 text-xs rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">senza target</span>}
                        </td>
                        <Celle v={v} />
                      </tr>
                      {dettaglio && <RigheImpianti elenco={impiantiMese(r, meseIdx)} totaleMese={v.raccolto} />}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
            <tr className="border-t-2 bg-muted/60">
              <td className="px-2 py-2 font-semibold">Totale complessivo</td>
              <Celle v={vTot} forte />
            </tr>
            {contratto.some(Boolean) && (
              <tr className="border-t">
                <td className="px-2 py-2">Target del contratto Ecotyre (rivisto)</td>
                <td className="px-2 py-2 text-right tabular-nums">{num(commessa?.target_annuo_t)}</td>
                <td />
                <td className="px-2 py-2 text-right tabular-nums border-l">{num(contrattoMese)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{num(vTot.raccolto)}</td>
                <td className={`px-2 py-2 text-right tabular-nums ${segno(contrattoMese - vTot.raccolto)}`}>{num(contrattoMese - vTot.raccolto)}</td>
                <td className="px-2 py-2 text-right tabular-nums border-l" colSpan={3}>
                  progressivo contratto {num(contrattoProgressivo)} t · raccolto {num(vTot.progressivo)} t ·{' '}
                  <span className={segno(contrattoProgressivo - vTot.progressivo)}>{contrattoProgressivo - vTot.progressivo > 0 ? 'mancano' : 'avanti di'} {num(Math.abs(contrattoProgressivo - vTot.progressivo))} t</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {senzaTarget.length > 0 && (
        <p className="text-xs text-amber-800">
          {senzaTarget.length} {senzaTarget.length === 1 ? 'riga ha' : 'righe hanno'} raccolto RETE in una regione dove il raccoglitore non ha target: controlla nella scheda Target raccoglitori se manca un target.
        </p>
      )}
      {perImpianto.length > 0 && (
        <div className="border rounded-lg overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="px-3 py-2">Impianto di destinazione a consuntivo</th>
                <th className="px-3 py-2 text-right">Raccolto RETE {MESI[meseIdx]}</th>
                <th className="px-3 py-2 text-right">Quota del mese</th>
                <th className="px-3 py-2 text-right">Progressivo al {new Date(anno, meseIdx + 1, 0).getDate()} {MESI[meseIdx]}</th>
              </tr>
            </thead>
            <tbody>
              {perImpianto.map(i => (
                <tr key={i.impianto} className="border-t">
                  <td className="px-3 py-1.5">{i.impianto}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{num(i.raccolto)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{vTot.raccolto > 0 ? `${tonnellate(i.raccolto / vTot.raccolto * 100)}%` : '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{num(i.progressivo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
