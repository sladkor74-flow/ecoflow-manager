import React from 'react';
import { STILE_SURPLUS } from '@/lib/surplusVista';

// IL NOME DI UN SURPLUS NELLE PAGINE DELL'ATTIVA E DEL MARGINE (il surplus sulle
// tariffe, 13/10/2026): la barretta indaco, l'etichetta «Surplus» per chi non
// distingue il colore e il nome in corsivo, la stessa forma della prima cella
// della riga del surplus nella passiva (EtichettaSurplus di PassivaSurplus.jsx).
// Chi l'ha vista una volta la riconosce ovunque.
export default function NomeSurplus({ nome }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0 align-middle">
      <span aria-hidden="true" className={STILE_SURPLUS.barra} />
      <span className={STILE_SURPLUS.etichetta}>Surplus</span>
      <span className={STILE_SURPLUS.nome}>{nome || 'Surplus'}</span>
    </span>
  );
}
