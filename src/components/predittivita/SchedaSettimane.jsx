import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ton, it, itBreve, viaggi, programmiNonLetti, Vuoto } from './Comuni';

// Settimana per settimana e percorso: i viaggi programmati - quelli fissati il
// mercoledi' o a mano, che non cambiano piu' - contro quelli fatti. Prima il
// previsto di una settimana diventava uguale all'arrivato al primo camion e non
// si vedeva mai se si era in anticipo o in ritardo (26/09/2026).

const SETTIMANE_VISIBILI = 8;

/** Com'e' messa una settimana: 'chiusa', 'in_corso' o 'prossima' (un anno chiuso non ne ha in corso). */
export function statoSettimana(x, risposta) {
  const oggi = risposta.oggi || '';
  if (risposta.sola_lettura) return 'chiusa';
  if (x.settimana > oggi) return 'prossima';
  if (x.al >= oggi) return 'in_corso';
  return 'chiusa';
}

/** Una settimana passata i cui formulari potrebbero non essere ancora tutti caricati. */
export const settimanaParziale = (x, risposta) => statoSettimana(x, risposta) === 'chiusa' && !risposta.sola_lettura && !!risposta.dati_al && x.al > risposta.dati_al;

/** Programmato contro fatto, a parole, con il tono per il colore. */
export function esitoSettimana(x, risposta) {
  const stato = statoSettimana(x, risposta);
  const p = x.programmati;
  if (stato === 'prossima') return { testo: p === null || p === undefined ? '' : 'Da fare', tono: 'neutro' };
  if (stato === 'in_corso') {
    return { testo: p === null || p === undefined ? `In corso: ${viaggi(x.fatti)} ${x.fatti === 1 ? 'fatto' : 'fatti'}` : `In corso: fatti ${x.fatti} su ${p}`, tono: 'neutro' };
  }
  if (p === null || p === undefined) return { testo: 'Nessun programma fissato', tono: 'neutro' };
  const d = x.fatti - p;
  if (d === 0) return { testo: 'Come programmato', tono: 'bene' };
  if (d < 0) return { testo: `In ritardo: ${viaggi(-d)} in meno del programma`, tono: 'male' };
  return { testo: `In anticipo: ${viaggi(d)} in più del programma`, tono: 'avanti' };
}

const TONO = { bene: 'text-emerald-700', male: 'text-red-700', avanti: 'text-blue-700', neutro: 'text-muted-foreground' };

/** Le righe raggruppate per settimana, dalla piu' recente. */
export function perSettimana(righe) {
  const gruppi = [];
  for (const x of righe || []) {
    const g = gruppi[gruppi.length - 1];
    if (g && g.settimana === x.settimana) g.righe.push(x);
    else gruppi.push({ settimana: x.settimana, al: x.al, righe: [x] });
  }
  return gruppi;
}

export default function SchedaSettimane({ risposta }) {
  const [tutte, setTutte] = useState(false);
  const gruppi = perSettimana(risposta.settimane);
  if (!gruppi.length) return <Vuoto>Nel {risposta.anno} non ci sono ancora secondarie verso gli impianti seguiti né programmi fissati.</Vuoto>;
  const visibili = tutte ? gruppi : gruppi.slice(0, SETTIMANE_VISIBILI);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Programmati: i viaggi fissati il mercoledì o a mano. Fatti: un camion in un giorno sullo stesso percorso, anche se porta più formulari.
      </p>
      {programmiNonLetti(risposta) && (
        <p className="text-sm text-red-700">
          I programmi fissati non si sono potuti leggere: dove qui mancano i viaggi programmati, non vuol dire che non siano stati fissati.
        </p>
      )}
      {visibili.map(g => {
        const stato = statoSettimana(g, risposta);
        const conProgramma = g.righe.filter(x => x.programmati !== null && x.programmati !== undefined);
        const programmati = conProgramma.length ? conProgramma.reduce((t, x) => t + (Number(x.programmati) || 0), 0) : '—';
        const fatti = g.righe.reduce((t, x) => t + x.fatti, 0);
        const kg = g.righe.reduce((t, x) => t + x.fatti_kg, 0);
        return (
          <div key={g.settimana} className={`border rounded-lg overflow-hidden ${stato === 'in_corso' ? 'border-primary' : ''}`}>
            <div className="px-3 py-2 bg-muted/40 flex items-center gap-2 flex-wrap">
              <span className="font-medium">Settimana dal {itBreve(g.settimana)} al {it(g.al)}</span>
              {stato === 'in_corso' && <span className="text-xs px-1.5 py-0.5 rounded bg-primary text-primary-foreground">in corso</span>}
              {stato === 'prossima' && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">prossima</span>}
              {settimanaParziale(g, risposta) && <span className="text-xs text-amber-800">i formulari potrebbero non essere ancora tutti caricati</span>}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                programmati {programmati} · fatti {fatti} · {ton(kg)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left px-3 py-1.5 font-medium">Da</th>
                    <th className="text-left px-3 py-1.5 font-medium">A</th>
                    <th className="text-right px-3 py-1.5 font-medium">Programmati</th>
                    <th className="text-right px-3 py-1.5 font-medium">Fatti</th>
                    <th className="text-right px-3 py-1.5 font-medium">Tonnellate fatte</th>
                    <th className="text-left px-3 py-1.5 font-medium">Com&apos;è andata</th>
                  </tr>
                </thead>
                <tbody>
                  {g.righe.map(x => {
                    const e = esitoSettimana(x, risposta);
                    return (
                      <tr key={`${x.stoccaggio}|${x.impianto}`} className="border-t">
                        <td className="px-3 py-1.5 whitespace-nowrap">{x.stoccaggio}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{x.impianto}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {x.programmati === null || x.programmati === undefined ? <span className="text-muted-foreground">—</span> : x.programmati}
                          {x.programmati_manuale && <span className="block text-[11px] text-violet-700">a mano</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{x.fatti}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{ton(x.fatti_kg)}</td>
                        <td className={`px-3 py-1.5 text-xs ${TONO[e.tono]}`}>{e.testo}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {gruppi.length > SETTIMANE_VISIBILI && (
        <Button variant="outline" size="sm" onClick={() => setTutte(v => !v)}>
          {tutte ? `Mostra solo le ultime ${SETTIMANE_VISIBILI} settimane` : `Mostra tutte le settimane (${gruppi.length})`}
        </Button>
      )}
    </div>
  );
}
