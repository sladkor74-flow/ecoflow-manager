import React from 'react';
import { Target, TrendingUp, AlertTriangle, CalendarClock } from 'lucide-react';
import { tonnellate } from '@/lib/target';

// Le card dell'Andamento di Target & Status (chiusura dell'audit, 11/10/2026).
//
// Erano «Leftover Complessivo Annuo» e «Delta Mese In Corso»: due parole inglesi,
// un delta col positivo in rosso e nessuno che dicesse che cosa voleva dire il
// segno, e un target annuo che senza contratto diventava zero. Ora:
// - il target annuo del contratto, o «—» se l'anno non ha contratto; e si dice
//   quando e' il ripiego scritto nel gestionale o una copia da confermare;
// - il residuo dell'anno: target meno raccolto, quanto manca (negativo: target
//   superato);
// - lo scarto del mese sull'atteso: raccolto meno atteso, dove l'atteso e' il
//   target del mese per i giorni che i dati coprono (positivo: avanti;
//   negativo: indietro).
//
// I FILTRI DELLA SCHEDA NON TOCCANO L'ANNO (segnalazione alta del 20/09,
// corretta il 12/10/2026). Raccolto e residuo dell'anno arrivano dalla pagina
// senza filtri, e con un filtro attivo la card lo dice; lo scarto e' quello dei
// mesi scelti e delle righe filtrate, e la card dice con quali filtri.
const giornoMese = (g) => (g ? `${g.slice(8, 10)}/${g.slice(5, 7)}` : '');
const conSegno = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${tonnellate(v)}`);

// LE VARIAZIONI DEL CONSORZIO NELLA CARD DEL TARGET (giro del 14/10/2026). Il
// target annuo e' gia' quello con le variazioni registrate (11.650 t con le 100 t
// di ottobre in Puglia), ma la card diceva solo «Dal contratto Ecotyre»: chi la
// guardava non sapeva da dove venissero le 100 t in piu' sulle 11.550 di inizio
// anno. Le dice la tabella per regione, sotto; qui una riga e il target senza.

/**
 * Le variazioni in vigore per la card: { quante, t, senza_t, voci } o null.
 * variazioni sono quelle di variazioniDelContratto (src/lib/attesoContratto.js):
 * una superata (in_vigore falso) non e' piu' nel target e non si conta.
 */
export function variazioniPerLaCard(variazioni, targetT) {
  const vv = (variazioni || []).filter(v => v && v.in_vigore !== false && Number.isFinite(Number(v.t)));
  if (!vv.length || targetT === null || targetT === undefined || !Number.isFinite(Number(targetT))) return null;
  const t = Math.round(vv.reduce((s, v) => s + Number(v.t), 0) * 1000) / 1000;
  return { quante: vv.length, t, senza_t: Math.round((Number(targetT) - t) * 1000) / 1000, voci: vv.map(v => ({ mese: v.mese, regione: v.regione, t: Number(v.t) })) };
}

/** La riga della card: «Compresa la variazione del consorzio (+100,00 t di ottobre in Puglia): senza, 11.550,00 t.» */
export function notaVariazioni(variazioni) {
  if (!variazioni || !variazioni.quante) return '';
  const una = variazioni.quante === 1 && variazioni.voci && variazioni.voci[0];
  const quali = una
    ? `Compresa la variazione del consorzio (${conSegno(una.t)} t di ${String(una.mese || '').toLowerCase()} in ${una.regione})`
    : `Comprese le ${variazioni.quante} variazioni del consorzio (in tutto ${conSegno(variazioni.t)} t)`;
  return `${quali}: senza, sarebbe ${tonnellate(variazioni.senza_t)} t. Il dettaglio è sotto la tabella per regione.`;
}

export default function KpiCards({ kpis, anno }) {
  const notaBase = kpis.targetAnnuoTotale === null
    ? `Il contratto del ${anno} non è inserito: scrivilo nella scheda Commessa Ecotyre.`
    : kpis.targetDaConfermare
      ? "Copiato dall'anno prima, da confermare nella scheda Commessa Ecotyre."
      : kpis.fonteTarget === 'ripiego'
        ? `Il contratto del ${anno} non ha il target annuo: è quello scritto nel gestionale come ripiego.`
        : 'Dal contratto Ecotyre, canale RETE.';
  const notaTarget = [notaBase, kpis.targetAnnuoTotale === null ? '' : notaVariazioni(kpis.variazioni)].filter(Boolean).join(' ');
  const mesi = (kpis.mesiScarto || []).join(', ').toLowerCase();
  const tuttoLAnno = kpis.conFiltri ? " Tutto l'anno: i filtri non valgono qui." : '';
  const filtriScarto = (kpis.filtriScarto || []).length ? ` Con i filtri: ${kpis.filtriScarto.join('; ')}.` : '';
  const cards = [
    {
      label: 'Target annuo del contratto', value: tonnellate(kpis.targetAnnuoTotale), icon: Target,
      color: 'text-blue-600 bg-blue-50', nota: notaTarget, avviso: kpis.targetAnnuoTotale === null || kpis.targetDaConfermare || kpis.fonteTarget === 'ripiego',
    },
    { label: "Raccolto RETE nell'anno", value: tonnellate(kpis.raccoltoTotale), icon: TrendingUp, color: 'text-green-600 bg-green-50', nota: `Formulari terminati, per fine trasporto.${tuttoLAnno}` },
    {
      label: "Residuo dell'anno", value: tonnellate(kpis.residuoAnno), icon: AlertTriangle,
      color: kpis.residuoAnno !== null && kpis.residuoAnno < 0 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-600 bg-amber-50',
      nota: `Target meno raccolto: quanto manca. Negativo: target superato.${tuttoLAnno}`,
    },
    {
      label: `Scarto ${mesi ? `di ${mesi}` : 'del mese'} sull'atteso`, value: conSegno(kpis.scartoMese), icon: CalendarClock,
      color: kpis.scartoMese === null ? 'text-muted-foreground bg-muted' : kpis.scartoMese >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50',
      nota: kpis.scartoMese === null
        ? "L'atteso non si calcola: non c'è ancora nessun ritiro terminato con la fine trasporto."
        : `Raccolto meno atteso al ${giornoMese(kpis.giornoDati)} (${tonnellate(kpis.attesoMese)} t: il target dei raccoglitori per i giorni coperti dai dati). Positivo: avanti; negativo: indietro.${filtriScarto}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="border rounded-lg p-4 bg-card">
            <div className={`inline-flex p-2 rounded-md mb-2 ${c.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-heading font-bold tabular-nums">
              {c.value} {c.value !== '—' && <span className="text-sm font-normal text-muted-foreground">t</span>}
            </p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
            {c.nota && <p className={`text-xs mt-0.5 ${c.avviso ? 'text-amber-700' : 'text-muted-foreground'}`}>{c.nota}</p>}
          </div>
        );
      })}
    </div>
  );
}
