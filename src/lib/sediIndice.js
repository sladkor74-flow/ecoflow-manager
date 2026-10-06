import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { ultimaVerificaPerPdr } from '@/lib/sediOperative';

// L'ultimo controllo della sede operativa di ogni punto di raccolta, per
// mostrarlo dove serve: nella scheda del PDR e nella sezione «Sedi operative».
//
// Il collegamento e' l'ID del punto di raccolta, mai il nome: di «Eurogomme» ce
// ne sono quindici, in comuni diversi. L'elenco si legge una volta per sessione,
// come quello delle omologhe.

let promessa = null;

export function caricaIndiceSedi() {
  if (!promessa) {
    promessa = fetchAllClient(base44.entities.VerificaSedePdr, null, 'id')
      .then(righe => ({ perPdr: ultimaVerificaPerPdr(righe), tutte: righe }))
      .catch((e) => { promessa = null; throw e; });
  }
  return promessa;
}

/** Da richiamare dopo un controllo o una decisione, per rileggere. */
export function dimenticaIndiceSedi() { promessa = null; }

export function useIndiceSedi(versione = 0) {
  const [indice, setIndice] = useState(null);
  useEffect(() => {
    let attivo = true;
    caricaIndiceSedi().then((i) => { if (attivo) setIndice(i); }).catch(() => { if (attivo) setIndice({ errore: true, perPdr: new Map(), tutte: [] }); });
    return () => { attivo = false; };
  }, [versione]);
  return indice;
}

/** L'ultimo controllo di un punto di raccolta, o null se non e' mai stato controllato. */
export function sedeDelPunto(indice, idPdr) {
  if (!indice || indice.errore || idPdr == null) return null;
  return indice.perPdr.get(Number(idPdr)) || null;
}
