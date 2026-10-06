import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { ultimaVerificaPerPdr, indicePerSoggetto, chiaviSoggetto } from '@/lib/sediOperative';

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
      .then(righe => ({ perPdr: ultimaVerificaPerPdr(righe), perSoggetto: indicePerSoggetto(righe), tutte: righe }))
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
    caricaIndiceSedi().then((i) => { if (attivo) setIndice(i); }).catch(() => { if (attivo) setIndice({ errore: true, perPdr: new Map(), perSoggetto: new Map(), tutte: [] }); });
    return () => { attivo = false; };
  }, [versione]);
  return indice;
}

/** L'ultimo controllo di un punto di raccolta, o null se non e' mai stato controllato. */
export function sedeDelPunto(indice, idPdr) {
  if (!indice || indice.errore || idPdr == null) return null;
  return indice.perPdr.get(Number(idPdr)) || null;
}

/**
 * La sede gia' decisa per lo STESSO soggetto ma su un ALTRO punto di raccolta.
 * E' il caso del gommista che si re-iscrive: il portale gli da' un id nuovo e il
 * punto risulta mai controllato, mentre la sede l'avevi gia' decisa. Non vale
 * come decisione - e' un altro punto, e potrebbe essere un'altra officina - ma
 * deve vedersi, altrimenti si rifa' un lavoro gia' fatto o, peggio, si stampa
 * l'indirizzo vecchio senza sapere che qualcuno l'aveva gia' corretto.
 */
export function sedeDecisaAltrove(indice, record) {
  if (!indice || indice.errore || !record || !indice.perSoggetto) return null;
  for (const k of chiaviSoggetto(record)) {
    const v = indice.perSoggetto.get(k);
    if (v && Number(v.id_pdr) !== Number(record.id_pdr)) return v;
  }
  return null;
}
