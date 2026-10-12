import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { t, tSegno, pct, giornoMese, giorno, avantiIndietro } from '@/components/dashboard/formato';
import { Tabella } from '@/components/dashboard/Sezione';
import { righeRegioni } from '@/components/dashboard/righeQuadro';

// LE REGIONI DELLA RETE (migliorie dell'11/10/2026), al posto dei due grafici di
// prima. Il riparto e' quello del contratto, con l'atteso al giorno dei dati e lo
// scarto. Il raccolto delle province fuori dalle regioni del contratto (o senza
// provincia) prima spariva dal grafico, e la somma delle regioni non tornava col
// raccolto della rete: ora ha la sua riga, e il totale e' quello della rete,
// solo della rete. Accanto, lo scarto in barre con lo zero al centro: avanti a
// destra, indietro a sinistra, sempre con la parola.
//
// giornoDati e' il giorno della misura (quadro.giorno_misura): per un anno chiuso
// il 31/12. Senza scarto si dice il perche' vero (revisione delle migliorie,
// 11/10/2026): il 2025 ha un target di ripiego senza riparto per regione, e la
// pagina diceva «senza ritiri dell'anno» su 11.101,57 t di ritiri. Un target di
// ripiego non e' un contratto (12/10/2026): il riparto manca perche' il
// contratto non c'e', e la frase non nomina un «contratto Ecotyre del 2025» che
// nel gestionale non esiste.

/** Perche' lo scarto per regione non c'e'. */
export function percheSenzaScarto(rete, righe, anno) {
  if (!rete || rete.target_t === null || rete.target_t === undefined) return 'senza contratto non c\'è.';
  const conRiparto = (righe || []).some(r => !r.fuori && r.target_t !== null && r.target_t !== undefined);
  if (!conRiparto && (rete.ripiego || rete.fonte_target === 'ripiego')) {
    return `il ${anno} ha un target di ripiego (quello scritto nel gestionale finché il contratto non è inserito), e senza contratto non c'è un riparto per regione: c'è il solo raccolto.`;
  }
  if (!conRiparto) return `il contratto Ecotyre del ${anno} non ha il riparto per regione: c'è il solo raccolto.`;
  if (!rete.atteso) return 'senza ritiri dell\'anno non c\'è ancora.';
  return 'l\'atteso per regione non si è potuto calcolare.';
}

export default function ReteRegioni({ rete, giornoDati, anno }) {
  const righe = righeRegioni(rete);
  if (!righe.length) return <p className="text-sm text-muted-foreground">Nessun ritiro di rete terminato nel {anno}.</p>;
  const conScarto = righe.filter(r => r.scarto_t !== null && r.scarto_t !== undefined);
  const massimo = Math.max(0.001, ...conScarto.map(r => Math.abs(r.scarto_t)));
  const alGiorno = giornoDati ? `al ${giornoMese(giornoDati)}` : '';
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <Tabella className="lg:col-span-3 border rounded-md">
        <thead className="bg-muted/40"><tr className="text-left text-xs text-muted-foreground">
          <th className="px-2 py-1.5 font-medium">Regione</th>
          <th className="px-2 py-1.5 font-medium text-right">Target</th>
          <th className="px-2 py-1.5 font-medium text-right">Atteso {alGiorno}</th>
          <th className="px-2 py-1.5 font-medium text-right">Raccolto</th>
          <th className="px-2 py-1.5 font-medium text-right">Scarto</th>
          <th className="px-2 py-1.5 font-medium text-right">% dell&apos;atteso</th>
        </tr></thead>
        <tbody>
          {righe.map(r => (
            <tr key={r.regione} className={`border-t ${r.fuori ? 'text-muted-foreground' : ''}`}>
              <td className="px-2 py-1.5">{r.regione}{r.dettaglio ? <span className="block text-[11px]">{r.dettaglio}</span> : null}</td>
              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(r.target_t)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(r.atteso_t)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(r.raccolto_t)}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${r.scarto_t === null || r.scarto_t === undefined ? '' : r.scarto_t >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{tSegno(r.scarto_t)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{pct(r.pct_atteso)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t font-medium">
          <td className="px-2 py-1.5">Totale rete</td>
          <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(rete?.target_t)}</td>
          <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(rete?.atteso?.atteso_t)}</td>
          <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(rete?.raccolto_t)}</td>
          <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{tSegno(rete?.atteso?.scarto_t)}</td>
          <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{pct(rete?.atteso ? (rete.raccolto_t / rete.atteso.atteso_t) * 100 : null)}</td>
        </tr></tfoot>
      </Tabella>
      <div className="lg:col-span-2">
        {conScarto.length === 0 ? (
          <p className="text-xs text-muted-foreground">Lo scarto per regione si misura sull&apos;atteso del contratto: {percheSenzaScarto(rete, righe, anno)}</p>
        ) : (
          <ul className="space-y-2" aria-label="Scarto sull'atteso per regione">
            {conScarto.map(r => {
              const quota = (Math.abs(r.scarto_t) / massimo) * 50;
              const avanti = r.scarto_t >= 0;
              const domanda = `Perché la ${r.regione} è ${avanti ? 'avanti' : 'indietro'} di ${t(Math.abs(r.scarto_t))} sull'atteso del contratto al ${giorno(giornoDati)}?`;
              return (
                <li key={r.regione}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{r.regione}</span>
                    <span className={avanti ? 'text-emerald-700' : 'text-red-700'}>{avanti ? '▲' : '▼'} {avantiIndietro(r.scarto_t)}</span>
                  </div>
                  <div className="relative h-2.5 mt-1 rounded bg-muted/50" aria-hidden="true">
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-muted-foreground/40" />
                    <div className={`absolute top-0 bottom-0 rounded ${avanti ? 'bg-emerald-500' : 'bg-red-500'}`} style={avanti ? { left: '50%', width: `${quota}%` } : { right: '50%', width: `${quota}%` }} />
                  </div>
                  <Link to={`/assistente?domanda=${encodeURIComponent(domanda)}`} className="text-[11px] text-violet-700 hover:underline inline-flex items-center gap-1 mt-0.5">
                    <Sparkles className="w-3 h-3" aria-hidden="true" /> Chiedi a EcoTyna
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
