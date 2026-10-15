import React from 'react';
import { MESI_BREVI } from '@/lib/pfuConstants';
import EditableCell from './EditableCell';
import { formatNumber } from '@/lib/utils';
import { targetCopiatiDelleRighe, fraseTargetCopiati, segnoTargetCopiati } from '@/lib/andamentoTarget';

// I TARGET COPIATI E NON CONFERMATI (prova generale del cambio d'anno,
// 15/10/2026). Copiato l'anno, i target dei raccoglitori sono quelli dell'anno
// prima finche' l'amministratore non li conferma in Target raccoglitori: la
// dashboard li toglie dalla classifica e lo dice, gli avvisi non li contano.
// Qui, il 15/01/2027 col contratto 2027 gia' confermato e i 147 target mensili e
// 14 annui ancora copiati, la tabella li mostrava con target, residuo e Δ come
// decisi. Ora le righe dell'Andamento (righeAndamento) dicono quali target sono
// copiati: la riga porta «copiato, da confermare», le celle copiate sono in
// corsivo arancio, il residuo e il Δ di un target copiato non si colorano
// (non e' un obiettivo mancato o raggiunto), e sopra la tabella si dice quanti
// sono: quelli dell'anno (copiati, da targetCopiatiDellAnno), la stessa frase
// del Report generale; senza, si contano sulle righe. L'anno da cui vengono e'
// calcolato, mai scritto a mano. La frase e il segno della riga stanno in
// andamentoTarget (fraseTargetCopiati, segnoTargetCopiati), perche' i file
// dell'Andamento li dicano con le stesse parole (revisione del 15/10/2026).

const COPIATA = 'italic text-amber-700';

export default function TargetTable({ data, anno, copiati: copiatiDellAnno = null, onSaveTargetAnnuo, onSaveTargetMensile }) {
  const copiati = copiatiDellAnno || targetCopiatiDelleRighe(data);
  return (
    <div className="space-y-2">
      {copiati.copiati > 0 && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
          {fraseTargetCopiati(copiati, anno)} In corsivo arancio i target copiati.
        </p>
      )}
      <div className="border rounded-lg overflow-x-auto">
        <table className="text-xs whitespace-nowrap border-collapse">
          <thead className="bg-muted">
            <tr>
              <th className="sticky left-0 bg-muted px-3 py-2 text-left">Regione</th>
              <th className="sticky left-[100px] bg-muted px-3 py-2 text-left">Raccoglitore</th>
              <th className="px-2 py-2 text-right">Target Annuo</th>
              <th className="px-2 py-2 text-right">Raccolto</th>
              {/* Il residuo dell'anno, target annuo meno raccolto: era «Leftover»,
                  col negativo (target superato) in rosso (11/10/2026). */}
              <th className="px-2 py-2 text-right" title="Target annuo meno raccolto: quanto manca. Negativo: target superato.">Residuo</th>
              {MESI_BREVI.map((m) => (
                <th key={m} className="px-1 py-1 text-center text-[10px] font-medium" colSpan={3}>{m}</th>
              ))}
            </tr>
            <tr className="bg-muted border-t">
              <th className="sticky left-0 bg-muted" colSpan={5}></th>
              {MESI_BREVI.map((m) => (
                <React.Fragment key={m}>
                  <th className="px-1 py-1 text-right text-[10px] font-normal text-muted-foreground">T</th>
                  <th className="px-1 py-1 text-right text-[10px] font-normal text-muted-foreground">R</th>
                  <th className="px-1 py-1 text-right text-[10px] font-normal text-muted-foreground" title="Target del mese meno raccolto: positivo, manca raccolta">Δ</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const segno = segnoTargetCopiati(row);
              return (
                <tr key={`${row.regione}|||${row.raccoglitore}`} className="border-t hover:bg-muted/30">
                  <td className="sticky left-0 bg-card px-3 py-1.5">{row.regione}</td>
                  <td className="sticky left-[100px] bg-card px-3 py-1.5 font-medium max-w-[180px] truncate">
                    {row.raccoglitore}
                    {segno && (
                      <span className="block text-[10px] font-normal text-amber-700">{segno}</span>
                    )}
                  </td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${row.annuoDaConfermare ? COPIATA : ''}`}>
                    {onSaveTargetAnnuo ? <EditableCell value={row.targetAnnuo} onSave={(v) => onSaveTargetAnnuo(row.raccoglitore, row.regione, v)} /> : formatNumber(row.targetAnnuo)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(row.raccoltoTotale)}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${row.annuoDaConfermare ? 'text-muted-foreground' : row.leftover <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {formatNumber(row.leftover)}
                  </td>
                  {row.mesi.map((m, j) => (
                    <React.Fragment key={j}>
                      <td className={`px-1 py-1.5 text-right tabular-nums ${m.daConfermare ? COPIATA : ''}`}>
                        {onSaveTargetMensile ? <EditableCell value={m.target} onSave={(v) => onSaveTargetMensile(row.raccoglitore, row.regione, m.mese, v)} /> : formatNumber(m.target)}
                      </td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{formatNumber(m.raccolto)}</td>
                      <td className={`px-1 py-1.5 text-right tabular-nums ${m.daConfermare ? 'text-muted-foreground' : m.delta > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                        {formatNumber(m.delta)}
                      </td>
                    </React.Fragment>
                  ))}
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr><td colSpan={41} className="px-3 py-4 text-center text-muted-foreground">Nessun dato disponibile</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
