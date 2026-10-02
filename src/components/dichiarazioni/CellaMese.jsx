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
  // Quanto resta da dichiarare A PORTALE di quel mese: gli ingressi del mese in
  // quell'impianto meno quello che per quel mese e' stato davvero caricato. Una
  // dichiarazione che c'e' ma non e' ancora a portale non decurta niente: lo dice
  // l'entita' stessa, e il 02/10/2026 non era cosi' che si contava.
  const resta = Number(mese.da_dichiarare_kg) || 0;
  const titolo = [
    `${mese.mese}`,
    conferito ? `arrivati ${kg(conferito)} kg${daStoccaggi ? ` (in secondaria: ${daStoccaggi})` : ''}` : 'nessun conferimento',
    d && d.quantita_kg > 0 ? `dichiarati ${kg(d.quantita_kg)} kg` : '',
    resta > 0 ? `ancora da dichiarare a portale ${kg(resta)} kg` : '',
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
      {/* QUANTO RESTA, ANCHE DOVE LA CASELLA FINORA TACEVA.

          Due buchi, tutti e due segnalati dall'utente il 02/10/2026.

          Il primo: con una dichiarazione in mano e non ancora caricata a portale
          lo stato e' 'da segnare', e il numero mancante si scriveva solo dove di
          dichiarazioni non ce n'era nessuna. Su Green Tyre settembre la casella
          diceva 105.740 e basta, mentre a portale erano da dichiarare 255.780.

          Il secondo: sui canali diversi dalla rete 'attesa' e' falsa - una
          dichiarazione mensile li' non e' la regola - e con essa cadeva anche il
          numero. Risultato: un mese di ACI arrivato e non dichiarato era una
          casella VUOTA, indistinguibile da un mese in cui non e' arrivato niente,
          mentre il totale di riga lo contava. L'utente li ha trovati uno per uno:
          l'ACI in secondaria di Tecnogum, quello di Emmesse su Gatim, quello
          arrivato a Gatim da Irigom, tutti di settembre.

          Qui non si CHIEDE una dichiarazione, si DICE quanto resta: niente ambra,
          niente allarme, solo il numero. La richiesta resta dov'era, sulla rete. */}
      // NON DOVUTA: la casella tace. Un impianto che sulla rete non ci deve la
      // dichiarazione per accordo non ha un arretrato, e il 02/10/2026 il nuovo
      // numero gliel'ha scritto su ogni mese dell'anno.
      {resta > 0 && !manca && stato !== 'caricata' && stato !== 'non_dovuta' && (
        <span className="block text-[9px] leading-tight opacity-80">manca {kg(resta)}</span>
      )}
    </button>
  );
}
