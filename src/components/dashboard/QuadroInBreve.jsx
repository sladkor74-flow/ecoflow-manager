import React from 'react';
import { t, pct, intero, giornoMese, COLORI } from '@/components/dashboard/formato';
import { righeTesseraRete } from '@/components/dashboard/righeQuadro';

// IL QUADRO IN BREVE (migliorie dell'11/10/2026): quattro tessere, una per
// canale piu' gli impianti, che portano alla loro sezione. Mai una tessera che
// somma i canali: rete, ACI ed extra raccolta sono tre commesse.
//
// La tessera della rete dice anche se il numero e' buono o cattivo: accanto a
// «76,4%» l'atteso a quella data, col profilo del contratto, e lo scarto a
// parole («avanti di», «indietro di») oltre che a colori. Senza contratto il
// target e' «—», mai «0%» o «su 0 t»; un target copiato dall'anno prima si dice
// copiato, da confermare.
//
// La tessera degli impianti dice la quadratura con il portale come Dichiarazioni
// Impianti: stesse righe, stesso numero (revisione delle migliorie, 11/10/2026).

function Tessera({ etichetta, colore, valore, righe, onClick, caricamento }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left border rounded-lg p-3 lg:p-4 bg-card hover:shadow-sm transition-shadow min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {colore && <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: colore }} aria-hidden="true" />}
        {etichetta}
      </p>
      {caricamento
        ? <div className="h-7 mt-1.5 rounded bg-muted/50 animate-pulse" />
        : <p className="text-xl lg:text-2xl font-heading font-bold mt-1 break-words">{valore}</p>}
      {!caricamento && righe.filter(Boolean).map((r, i) => (
        <p key={i} className={`text-xs mt-0.5 ${r.classe || 'text-muted-foreground'}`}>{r.testo}</p>
      ))}
    </button>
  );
}

export default function QuadroInBreve({ quadro, impianti, annoInCorso, caricamento, onVai }) {
  const rete = quadro?.rete;
  const aci = quadro?.aci;
  const extra = quadro?.extra;
  const imp = impianti;
  const impValore = !annoInCorso ? '—'
    : imp && imp.stato === 'fresca' ? `${intero(imp.quadrano)} su ${intero(imp.con_confronto)}` : '—';
  const impRighe = !annoInCorso
    ? [{ testo: 'la quadratura di ogni notte è sull\'anno in corso: per gli anni chiusi si guarda Giacenze' }]
    : imp && imp.stato === 'fresca'
      ? [{ testo: 'rete: quadratura con il portale' }, { testo: `da dichiarare (rete): ${t(imp.da_dichiarare?.RETE?.t)}` }, { testo: `controllo della notte del ${giornoMese(imp.giorno)}` }]
      : [{ testo: imp ? imp.perche : 'controllo della notte in arrivo…' }];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Tessera etichetta="Rete" colore={COLORI.rete} caricamento={caricamento} onClick={() => onVai('rete')}
        valore={rete && rete.target_t !== null && rete.target_t !== undefined ? pct(rete.pct_target) : '—'}
        righe={righeTesseraRete(rete)} />
      <Tessera etichetta="ACI" colore={COLORI.aci} caricamento={caricamento} onClick={() => onVai('aci')}
        valore={t(aci?.raccolto_t)}
        righe={[
          { testo: aci && aci.previsione_t ? `su una previsione indicativa di ${t(aci.previsione_t)} (${pct(aci.pct_previsione)})` : 'nessuna previsione nel contratto ACI' },
          { testo: 'canale a sé: non si somma alla rete' },
        ]} />
      <Tessera etichetta="Extra raccolta" colore={COLORI.extra} caricamento={caricamento} onClick={() => onVai('extra')}
        valore={t(extra?.raccolto_t)}
        righe={[{ testo: `${intero(extra?.interventi)} ${extra?.interventi === 1 ? 'intervento terminato' : 'interventi terminati'} nel ${quadro?.anno ?? ''}` }]} />
      <Tessera etichetta="Impianti" caricamento={caricamento && !imp} onClick={() => onVai('impianti')}
        valore={impValore} righe={impRighe} />
    </div>
  );
}
