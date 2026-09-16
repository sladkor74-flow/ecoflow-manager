import React from 'react';
import { omologaDelPunto } from '@/lib/omologheIndice';

// Segno dell'omologa accanto a un punto di raccolta, per quando si programma il
// ritiro. Il colore segue la scadenza come nel modulo Omologhe. Non e' un alert:
// e' il promemoria di chiedere il documento se manca o sta per scadere.

const dataIt = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '');

const COLORE = {
  scaduta: 'bg-red-600 text-white border-red-700',
  critica: 'bg-red-100 text-red-800 border-red-300',
  vicina: 'bg-orange-100 text-orange-800 border-orange-300',
  avviso: 'bg-amber-100 text-amber-800 border-amber-300',
  lontana: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  valida: 'bg-green-50 text-green-800 border-green-300',
  senza_data: 'bg-slate-100 text-slate-700 border-slate-300',
};

export default function BadgeOmologa({ indice, idPdr, idCliente }) {
  if (!indice) return <span className="text-muted-foreground text-xs">…</span>;
  if (indice.errore) return <span className="text-muted-foreground text-xs" title="Omologhe non disponibili">?</span>;

  const s = omologaDelPunto(indice, idPdr, idCliente);
  if (!s || !s.livello) {
    return (
      <span className="text-muted-foreground text-xs" title="Nessuna omologa registrata per questo punto di raccolta: se il ritiro va all'impianto, chiedi il documento.">
        nessuna
      </span>
    );
  }

  const o = s.omologa;
  if (o.stato === 'in_sospeso') {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded border text-xs bg-slate-100 text-slate-700 border-slate-300" title={`Omologa di ${o.produttore} in sospeso: da verificare in ufficio.`}>
        in sospeso
      </span>
    );
  }

  const testo = s.giorni === null ? 'senza data'
    : s.giorni < 0 ? `scaduta ${dataIt(s.scadenza)}`
      : `al ${dataIt(s.scadenza)}`;
  const spiegazione = [
    `Omologa di ${o.produttore}`,
    s.scadenza ? (s.giorni < 0 ? `scaduta il ${dataIt(s.scadenza)}` : `valida fino al ${dataIt(s.scadenza)} (fra ${s.giorni} giorni)`) : 'senza data di scadenza',
    s.livello === 'cliente' ? 'registrata su un altro punto di raccolta dello stesso produttore: verificare che copra anche questo' : null,
  ].filter(Boolean).join(' · ');

  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded border text-xs whitespace-nowrap ${COLORE[s.fascia] || COLORE.valida} ${s.livello === 'cliente' ? 'border-dashed' : ''}`}
      title={spiegazione}
    >
      {s.livello === 'cliente' ? '≈ ' : ''}{testo}
    </span>
  );
}
