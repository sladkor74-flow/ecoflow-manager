import React from 'react';
import { statoDichiarazione, STATI } from '@/lib/dichiarazioniImpianti';
import { formatKg } from '@/lib/utils';
import { Check, Mail, Minus } from 'lucide-react';

// Una casella del riepilogo: il colore dice se la dichiarazione c'è, il segno se
// è caricata a portale. Stessa lettura del foglio di gestione, con le parole al
// posto dei colori per chi lo vede la prima volta.

const kg = (v) => formatKg(v);

export default function CellaMese({ mese, onApri, soloLettura, attesa = true, dove = {} }) {
  const d = mese.dichiarazione;
  const conferito = mese.conferito_kg;
  // La rete non dovuta per accordo si scrive solo dove qualcosa e' arrivato:
  // sui mesi vuoti la casella resta vuota.
  let stato = statoDichiarazione(d, dove);
  if (stato === 'non_dovuta' && !(d && d.motivo_assenza) && !(conferito > 0)) stato = 'nessuna';
  // "Da chiedere" ha senso solo dove una dichiarazione ci si aspetta davvero:
  // sui canali diversi dalla rete non e' la regola. Gli stoccaggi qui non
  // arrivano: non dichiarano.
  const manca = !d && conferito > 0 && attesa && stato === 'nessuna';
  const fondo = stato === 'caricata' ? 'bg-emerald-600 text-white hover:bg-emerald-700'
    : stato === 'ricevuta' ? 'bg-emerald-100 hover:bg-emerald-200'
      : stato === 'inserita' ? 'bg-slate-100 hover:bg-slate-200'
        : stato === 'solo_metalli' ? 'bg-sky-50 hover:bg-sky-100 text-sky-900'
          : stato === 'non_dovuta' ? 'bg-slate-50 hover:bg-slate-100 text-slate-500'
            : manca ? 'bg-amber-50 hover:bg-amber-100 text-amber-900'
          : 'hover:bg-muted';
  const daStoccaggi = (mese.da_stoccaggi || []).map(s => `${kg(s.kg)} kg da ${s.stoccaggio}`).join(', ');
  // Quanto resta da dichiarare di quel mese: gli ingressi del mese in quell'
  // impianto meno il dichiarato. E' il numero che l'utente cerca quando apre la
  // pagina (01/10/2026), e sulla casella si legge senza aprirla.
  const resta = Number(mese.da_dichiarare_kg) || 0;
  const titolo = [
    `${mese.mese}`,
    conferito ? `arrivati ${kg(conferito)} kg${daStoccaggi ? ` (in secondaria: ${daStoccaggi})` : ''}` : 'nessun conferimento',
    d && d.quantita_kg > 0 ? `dichiarati ${kg(d.quantita_kg)} kg` : '',
    resta > 0 ? `ancora da dichiarare ${kg(resta)} kg` : '',
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
      {/* IL NUMERO GRANDE E' SEMPRE E SOLO IL DICHIARATO.
          Il 01/10/2026 avevo messo qui anche quanto restava da dichiarare: nello
          stesso posto, nello stesso formato, distinto solo dalla scritta
          piccola. Il giorno dopo l'utente ha letto «105.740» nella casella di
          settembre di un impianto che non aveva ancora dichiarato niente e ha
          chiesto, giustamente, perche' risultasse gia' dichiarato in parte. Un
          numero in questa casella ha sempre voluto dire «questo e' quanto
          abbiamo dichiarato»: cambiarne il significato a meta' tabella non si
          fa. Quanto manca si legge sotto, con scritto che manca. */}
      <span className="block text-[11px] leading-tight tabular-nums font-medium">
        {d && d.quantita_kg ? kg(d.quantita_kg) : manca ? '—' : ''}
      </span>
      <span className="flex items-center justify-center gap-1 text-[9px] leading-tight opacity-80">
        {stato === 'caricata' && <><Check className="w-3 h-3" /> portale</>}
        {stato === 'ricevuta' && <><Mail className="w-3 h-3" /> in mano</>}
        {stato === 'inserita' && 'da segnare'}
        {stato === 'solo_metalli' && 'solo metalli'}
        {stato === 'non_dovuta' && <><Minus className="w-3 h-3" /> non dovuta</>}
        {stato === 'nessuna' && (manca ? `da dichiarare ${kg(resta)}` : '')}
      </span>
    </button>
  );
}
