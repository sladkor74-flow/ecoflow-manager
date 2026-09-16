import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { giorniAllaScadenza, fasciaScadenza } from '@/lib/omologhe';

// Omologhe per PDR, per mostrarle dove si programma il ritiro.
//
// Il collegamento a un PDR viene dai numeri di formulario dei carichi (esatto) o
// da chi lo ha fatto a mano, caso per caso; mai dal nome, perche' molti punti di
// raccolta si chiamano allo stesso modo. L'elenco si legge una volta per sessione
// e lo usano tutte le righe della tabella.

let promessa = null;

const quando = (o) => o.scadenza_effettiva || o.omologa_a || '';

function costruisci(righe) {
  const perPdr = new Map();
  const perCliente = new Map();
  const tieni = (mappa, chiave, o) => {
    if (!chiave) return;
    const gia = mappa.get(chiave);
    // Se un punto ne ha piu' d'una vale quella che scade piu' tardi.
    if (!gia || quando(o) > quando(gia)) mappa.set(chiave, o);
  };
  for (const o of righe) {
    if (o.stato === 'annullata') continue;
    for (const p of [...(o.pdr_collegati || []), ...(o.pdr_manuali || [])]) tieni(perPdr, String(p), o);
    for (const c of o.clienti_collegati || []) tieni(perCliente, String(c), o);
  }
  return { perPdr, perCliente };
}

export function caricaIndiceOmologhe() {
  if (!promessa) {
    promessa = fetchAllClient(base44.entities.Omologa, null, 'produttore')
      .then(costruisci)
      .catch((e) => { promessa = null; throw e; });
  }
  return promessa;
}

/** Da richiamare dopo un aggiornamento delle omologhe, per rileggerle. */
export function dimenticaIndiceOmologhe() { promessa = null; }

export function useIndiceOmologhe() {
  const [indice, setIndice] = useState(null);
  useEffect(() => {
    let attivo = true;
    caricaIndiceOmologhe().then((i) => { if (attivo) setIndice(i); }).catch(() => { if (attivo) setIndice({ errore: true }); });
    return () => { attivo = false; };
  }, []);
  return indice;
}

/**
 * Omologa di un punto di raccolta.
 * livello 'pdr': registrata su questo punto; 'cliente': sullo stesso produttore
 * ma su un altro punto, da verificare; null: nessuna omologa registrata.
 */
export function omologaDelPunto(indice, idPdr, idCliente) {
  if (!indice || indice.errore) return null;
  const o = (idPdr != null && indice.perPdr.get(String(idPdr))) || null;
  if (o) return descrivi(o, 'pdr');
  const c = (idCliente != null && indice.perCliente.get(String(idCliente))) || null;
  if (c) return descrivi(c, 'cliente');
  return { livello: null };
}

function descrivi(o, livello) {
  const scadenza = quando(o) || null;
  const giorni = giorniAllaScadenza(scadenza);
  return { livello, omologa: o, scadenza, giorni, fascia: fasciaScadenza(giorni) };
}
