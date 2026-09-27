import React from 'react';
import { fmtTon, formatKg, formatNumber, formatPercentuale } from '@/lib/utils';

// Formati e pezzi comuni delle schede della predittivita'. I numeri arrivano dal
// motore (base44/shared/predittivita.ts) sempre in chili interi: qui si
// scrivono come vuole il gestionale - tonnellate con 2 decimali (3 se i kg non
// sono tondi), kg interi col punto delle migliaia, date gg/mm/aaaa, percentuali
// con la virgola - e senza sigle.

/** Tonnellate da chili: '1.234,50 t'. */
export const ton = (kg) => fmtTon((Number(kg) || 0) / 1000);
/** 'AAAA-MM-GG' -> 'gg/mm/aaaa'. */
export const it = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '');
/** 'AAAA-MM-GG' -> 'gg/mm'. */
export const itBreve = (g) => (g ? `${String(g).slice(8, 10)}/${String(g).slice(5, 7)}` : '');
/** Una percentuale con la virgola: '45,3%'. */
export const pct = (parte, totale) => (Number(totale) > 0 ? `${formatPercentuale((Number(parte) || 0) / Number(totale) * 100)}%` : '');
/** Viaggi calcolati (non interi): una cifra decimale, '23,5'. */
export const viaggiDec = (v) => formatNumber(Number(v) || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** 'N viaggio/viaggi'. */
export const viaggi = (n) => `${formatKg(n)} ${Number(n) === 1 ? 'viaggio' : 'viaggi'}`;

/** I tre modi di guardare quanto arrivera' ancora, con i nomi per chi legge. */
export const SCENARI = [
  { chiave: 'target', nome: 'Sul target dei raccoglitori' },
  { chiave: 'ritmo', nome: 'Sul ritmo reale' },
  { chiave: 'prudente', nome: 'Prudente', nota: 'quella usata per programmare' },
];

/** L'errore di una chiamata, detto con le parole del server quando ci sono. */
export const testoErrore = (e) => (e && ((e.response && e.response.data && e.response.data.error) || (e.data && e.data.error) || e.message)) || String(e || 'errore sconosciuto');

/** Una barra di avanzamento, con la percentuale scritta accanto. */
export function Barra({ parte, totale, colore = 'bg-primary' }) {
  const p = Number(totale) > 0 ? Math.max(0, Math.min(100, (Number(parte) || 0) / Number(totale) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${colore}`} style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-14 text-right">{pct(parte, totale)}</span>
    </div>
  );
}

/** Un numero con la sua etichetta, nei riquadri in cima alle schede. */
export function Cifra({ etichetta, valore, nota, classe = '' }) {
  return (
    <div className={`border rounded-md px-3 py-2 bg-muted/20 ${classe}`}>
      <div className="text-xs text-muted-foreground">{etichetta}</div>
      <div className="font-semibold tabular-nums">{valore}</div>
      {nota && <div className="text-[11px] text-muted-foreground mt-0.5">{nota}</div>}
    </div>
  );
}

/** Il riquadro al posto di una scheda che non ha ancora niente da mostrare. */
export function Vuoto({ children }) {
  return <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">{children}</div>;
}
