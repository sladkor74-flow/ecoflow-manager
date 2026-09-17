import React from 'react';
import { statoDichiarazione, STATI } from '@/lib/dichiarazioniImpianti';
import { Check, Mail } from 'lucide-react';

// Una casella del riepilogo: il colore dice se la dichiarazione c'è, il segno se
// è caricata a portale. Stessa lettura del foglio di gestione, con le parole al
// posto dei colori per chi lo vede la prima volta.

const kg = (v) => Math.round(Number(v) || 0).toLocaleString('it-IT');

export default function CellaMese({ mese, onApri, soloLettura }) {
  const d = mese.dichiarazione;
  const stato = statoDichiarazione(d);
  const conferito = mese.conferito_kg;
  const manca = !d && conferito > 0;
  const fondo = stato === 'caricata' ? 'bg-emerald-600 text-white hover:bg-emerald-700'
    : stato === 'ricevuta' ? 'bg-emerald-100 hover:bg-emerald-200'
      : stato === 'inserita' ? 'bg-slate-100 hover:bg-slate-200'
        : manca ? 'bg-amber-50 hover:bg-amber-100 text-amber-900'
          : 'hover:bg-muted';
  const titolo = [
    `${mese.mese}`,
    conferito ? `conferiti ${kg(conferito)} kg` : 'nessun conferimento',
    d ? `dichiarati ${kg(d.quantita_kg)} kg` : 'nessuna dichiarazione',
    STATI[stato].nome,
    soloLettura ? '' : 'clicca per aprire',
  ].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={() => onApri && onApri(mese)}
      title={titolo}
      className={`w-full rounded-md border px-1.5 py-1 text-center transition-colors ${fondo} ${soloLettura ? 'cursor-default' : ''}`}
    >
      <span className="block text-[11px] leading-tight tabular-nums font-medium">
        {d && d.quantita_kg ? kg(d.quantita_kg) : manca ? '—' : ''}
      </span>
      <span className="flex items-center justify-center gap-1 text-[9px] leading-tight opacity-80">
        {stato === 'caricata' && <><Check className="w-3 h-3" /> portale</>}
        {stato === 'ricevuta' && <><Mail className="w-3 h-3" /> in mano</>}
        {stato === 'inserita' && 'da segnare'}
        {stato === 'nessuna' && (manca ? 'da chiedere' : '')}
      </span>
    </button>
  );
}
