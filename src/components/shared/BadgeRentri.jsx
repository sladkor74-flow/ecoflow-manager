import React from 'react';
import { Link } from 'react-router-dom';
import { rentriDelPunto } from '@/lib/rentriIndice';

// Segno RENTRI accanto a un punto di raccolta: iscrizione e formulario come li dice
// il portale e, se c'e', la dichiarazione del produttore. Se le due fonti non
// coincidono il segno si colora e porta al modulo Dichiarazioni RENTRI.
// Non e' un giudizio: un piccolo produttore iscritto puo' scegliere il FIR cartaceo.

export default function BadgeRentri({ indice, idPdr, nome }) {
  if (!indice) return <span className="text-muted-foreground text-xs">…</span>;
  if (indice.errore) return <span className="text-muted-foreground text-xs" title="Dati RENTRI non disponibili">?</span>;
  const s = rentriDelPunto(indice, idPdr);
  if (!s) return <span className="text-muted-foreground text-xs" title="PDR non presente nell'anagrafica">—</span>;

  const d = s.dichiarazione;
  const iscritto = s.portale.iscritto !== null ? s.portale.iscritto : (d ? d.iscritto_rentri === true : null);
  const formulario = s.portale.formulario || (d ? (d.fir_digitale ? 'digitale' : d.fir_cartaceo ? 'cartaceo' : null) : null);
  const soloDichiarato = s.portale.iscritto === null && !s.portale.formulario && !!d;

  const testo = iscritto === null && !formulario ? 'non indicato' : `${iscritto === null ? '?' : iscritto ? 'iscritto' : 'non iscritto'}${formulario ? ` · ${formulario}` : ''}`;
  const spiega = [
    `Portale: iscrizione ${s.portale.iscritto === null ? 'non indicata' : s.portale.iscritto ? 'sì' : 'no'}, formulario ${s.portale.formulario || 'non indicato'}.`,
    d ? `Dichiarazione di ${d.produttore}: ${d.iscritto_rentri ? 'iscritto' : 'non iscritto'}, FIR ${d.fir_digitale ? 'digitale' : d.fir_cartaceo ? 'cartaceo' : 'non indicato'}.` : 'Nessuna dichiarazione collegata a questo punto.',
    s.diversa ? 'Portale e dichiarazione non coincidono: la dichiarazione va aggiornata.' : null,
  ].filter(Boolean).join(' ');

  const classe = s.diversa
    ? 'bg-red-50 text-red-800 border-red-300'
    : iscritto ? 'bg-sky-50 text-sky-800 border-sky-200' : 'bg-slate-50 text-slate-700 border-slate-200';

  const contenuto = (
    <span className={`inline-block px-1.5 py-0.5 rounded border text-xs whitespace-nowrap ${classe} ${soloDichiarato ? 'italic' : ''}`} title={spiega}>
      {s.diversa ? '≠ ' : ''}{testo}
    </span>
  );
  if (!s.diversa || !nome) return contenuto;
  return <Link to={`/dichiarazioni-rentri?cerca=${encodeURIComponent(nome)}`}>{contenuto}</Link>;
}
