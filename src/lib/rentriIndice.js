import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchAllClient } from '@/lib/fetchAllClient';

// RENTRI per punto di raccolta, per mostrarlo dove si programma il ritiro.
//
// Due fonti: il portale (anagrafica PDR: iscrizione e tipo di formulario) e la
// dichiarazione del produttore collegata a quel PDR. Si leggono una volta per
// sessione e le usano tutte le righe della tabella.

let promessa = null;

async function costruisci() {
  const [pdr, dichiarazioni] = await Promise.all([
    fetchAllClient(base44.entities.Pdr, null, 'id_pdr'),
    fetchAllClient(base44.entities.DichiarazioneRentri, null, 'produttore'),
  ]);
  const perPdr = new Map(pdr.map(p => [String(p.id_pdr), { pdr: p, dichiarazione: null }]));
  for (const d of dichiarazioni) {
    if (d.nel_foglio === false) continue;
    for (const id of d.pdr_collegati || []) {
      const voce = perPdr.get(String(id));
      if (voce && !voce.dichiarazione) voce.dichiarazione = d;
    }
  }
  return { perPdr };
}

export function caricaIndiceRentri() {
  if (!promessa) promessa = costruisci().catch((e) => { promessa = null; throw e; });
  return promessa;
}

export function dimenticaIndiceRentri() { promessa = null; }

export function useIndiceRentri() {
  const [indice, setIndice] = useState(null);
  useEffect(() => {
    let attivo = true;
    caricaIndiceRentri().then((i) => { if (attivo) setIndice(i); }).catch(() => { if (attivo) setIndice({ errore: true }); });
    return () => { attivo = false; };
  }, []);
  return indice;
}

const iscrizione = (v) => (/^s[iì]$/i.test(String(v || '').trim()) ? true : /^no$/i.test(String(v || '').trim()) ? false : null);
const formulario = (v) => (/digital/i.test(String(v || '')) ? 'digitale' : /cartace/i.test(String(v || '')) ? 'cartaceo' : null);

/**
 * Situazione RENTRI di un punto di raccolta:
 * { portale: { iscritto, formulario }, dichiarazione, diversa } oppure null se il PDR non c'e'.
 */
export function rentriDelPunto(indice, idPdr) {
  if (!indice || indice.errore || idPdr === undefined || idPdr === null) return null;
  const voce = indice.perPdr.get(String(idPdr));
  if (!voce) return null;
  const portale = { iscritto: iscrizione(voce.pdr.rentri_iscrizione), formulario: formulario(voce.pdr.tipo_formulario) };
  const d = voce.dichiarazione;
  let diversa = false;
  if (d) {
    if (portale.iscritto !== null && portale.iscritto !== (d.iscritto_rentri === true)) diversa = true;
    const dichiarato = d.fir_digitale && !d.fir_cartaceo ? 'digitale' : d.fir_cartaceo && !d.fir_digitale ? 'cartaceo' : null;
    if (portale.formulario && dichiarato && portale.formulario !== dichiarato) diversa = true;
  }
  return { portale, dichiarazione: d, diversa };
}
