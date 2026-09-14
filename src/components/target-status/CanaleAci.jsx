import React from 'react';
import { tonnellate, percentuale } from '@/lib/target';
import { formatNumber } from '@/lib/utils';

// Canale ACI, indipendente dalla RETE: raccolto dai centri di demolizione per
// regione confrontato con la previsione del contratto ACI Ecotyre, che e'
// indicativa perche' i ritiri dipendono dalle richieste dei demolitori e dalla
// capienza del fondo ACI. Il prezzo e' il corrispettivo per tonnellata.

const leggiLista = (json) => { try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const euro = (v) => `${formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export default function CanaleAci({ raccoltoAci, commessa, anno }) {
  const previsione = leggiLista(commessa?.target_prezzo_regioni_json);
  const perRegione = new Map((raccoltoAci?.by_regione || []).map(r => [String(r.regione).toLowerCase(), r]));
  const regioni = [...new Set([...previsione.map(p => p.regione), ...(raccoltoAci?.by_regione || []).map(r => r.regione)])].filter(Boolean);
  if (!regioni.length) {
    return <p className="text-sm text-muted-foreground border rounded-lg px-4 py-3">Nessun ritiro ACI terminato nel {anno} e nessuna previsione ACI inserita nella scheda Commessa Ecotyre.</p>;
  }
  const righe = regioni.map(regione => {
    const p = previsione.find(x => String(x.regione).toLowerCase() === String(regione).toLowerCase());
    const racc = perRegione.get(String(regione).toLowerCase());
    const prev = p ? Number(p.target_t) || 0 : 0;
    const fatto = racc ? racc.totale : 0;
    const prezzo = p ? Number(p.prezzo) || 0 : 0;
    return { regione, prev, fatto, prezzo, perc: prev ? (fatto / prev) * 100 : null, valore: fatto * prezzo };
  });
  const tot = righe.reduce((s, r) => ({ prev: s.prev + r.prev, fatto: s.fatto + r.fatto, valore: s.valore + r.valore }), { prev: 0, fatto: 0, valore: 0 });
  return (
    <div className="border rounded-lg overflow-x-auto bg-card">
      <table className="w-full text-sm">
        <thead className="bg-amber-50 text-left">
          <tr>
            <th className="px-3 py-2">Regione</th>
            <th className="px-3 py-2 text-right">Previsione ACI (t)</th>
            <th className="px-3 py-2 text-right">Raccolto ACI {anno} (t)</th>
            <th className="px-3 py-2 text-right">% della previsione</th>
            <th className="px-3 py-2 text-right">Corrispettivo (€/t)</th>
            <th className="px-3 py-2 text-right">Valore del raccolto</th>
          </tr>
        </thead>
        <tbody>
          {righe.map(r => (
            <tr key={r.regione} className="border-t">
              <td className="px-3 py-2 font-medium">{r.regione}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.prev ? tonnellate(r.prev) : '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{tonnellate(r.fatto)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.perc !== null ? `${percentuale(r.perc)}%` : '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.prezzo ? euro(r.prezzo) : '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.prezzo ? euro(r.valore) : '—'}</td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold bg-muted/30">
            <td className="px-3 py-2">Totale</td>
            <td className="px-3 py-2 text-right tabular-nums">{tonnellate(tot.prev)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{tonnellate(tot.fatto)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{tot.prev ? `${percentuale((tot.fatto / tot.prev) * 100)}%` : '—'}</td>
            <td />
            <td className="px-3 py-2 text-right tabular-nums">{euro(tot.valore)}</td>
          </tr>
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted-foreground border-t">
        Canale indipendente dalla RETE: non entra nel target del contratto né in quelli dei raccoglitori. La previsione del contratto ACI Ecotyre è indicativa:
        i ritiri partono solo su richiesta dei demolitori (almeno 1,5 t, compatibili con i veicoli radiati) e se il fondo ACI ha capienza.
      </p>
    </div>
  );
}
