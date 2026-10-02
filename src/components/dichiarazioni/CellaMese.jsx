import React from 'react';
import { statoDichiarazione, STATI } from '@/lib/dichiarazioniImpianti';
import { formatKg } from '@/lib/utils';

// Una casella del riepilogo: il colore dice se la dichiarazione c'è, il segno se
// è caricata a portale. Stessa lettura del foglio di gestione, con le parole al
// posto dei colori per chi lo vede la prima volta.

const kg = (v) => formatKg(v);

export default function CellaMese({ mese, onApri, soloLettura, dove = {} }) {
  const d = mese.dichiarazione;
  const conferito = mese.conferito_kg;
  // La rete non dovuta per accordo si scrive solo dove qualcosa e' arrivato:
  // sui mesi vuoti la casella resta vuota.
  let stato = statoDichiarazione(d, dove);
  if (stato === 'non_dovuta' && !(d && d.motivo_assenza) && !(conferito > 0)) stato = 'nessuna';
  // Quanto resta da dichiarare A PORTALE di quel mese: gli ingressi del mese in
  // quell'impianto meno quello che per quel mese e' stato davvero caricato. Una
  // dichiarazione che c'e' ma non e' ancora a portale non decurta niente: lo dice
  // l'entita' stessa, e il 02/10/2026 non era cosi' che si contava.
  const resta = Number(mese.da_dichiarare_kg) || 0;
  // Dove non si deve niente: la rete non dovuta per accordo e i mesi di soli
  // metalli, che si dichiarano con la prossima uscita di gomma. Non sono un
  // arretrato, e la casella non li conta come tale.
  const nonDovuto = stato === 'non_dovuta' || stato === 'solo_metalli';
  const inAmbra = resta > 0 && !nonDovuto && stato !== 'caricata';

  // IL NUMERO DELLA CASELLA, uno solo. Caricato a portale: il dichiarato.
  // Altrimenti, se resta qualcosa, quello che resta - ed e il numero che si
  // cerca. Dove non si deve niente, il dichiarato se c'e' e nient'altro.
  const dichiarato = d && Number(d.quantita_kg) > 0 ? kg(d.quantita_kg) : '';
  const numero = stato === 'caricata' ? dichiarato : (inAmbra ? kg(resta) : dichiarato);

  // DUE COLORI, NON SEI. Verde: il mese e caricato a portale, non manca niente.
  // Ambra: manca qualcosa, e il numero dice quanto. Gli altri casi restano
  // chiari, perche non sono un arretrato.
  const fondo = stato === 'caricata' ? 'bg-emerald-600 text-white hover:bg-emerald-700'
    : inAmbra ? 'bg-amber-50 hover:bg-amber-100 text-amber-900'
      : stato === 'solo_metalli' ? 'bg-sky-50 hover:bg-sky-100 text-sky-900'
        : nonDovuto ? 'bg-slate-50 hover:bg-slate-100 text-slate-500'
          : d ? 'bg-emerald-100 hover:bg-emerald-200'
            : 'hover:bg-muted';
  const daStoccaggi = (mese.da_stoccaggi || []).map(s => `${kg(s.kg)} kg da ${s.stoccaggio}`).join(', ');
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
      {/* UN NUMERO SOLO, E IL COLORE DICE CHE COS'E'.

          Il 02/10/2026 questa casella era diventata illeggibile: il numero, poi
          una riga con la parola dello stato, poi un'altra con quanto mancava. Tre
          scritte in una casella larga settanta pixel, per dodici mesi e venti
          righe. Parole dell'utente: «ci devono solo essere in verde i dichiarati e
          in un altro colore cio' che manca con i numeri del mese... cosa sono
          tutte quelle scritte?».

          Quindi: un numero e basta. Verde, e' quello caricato a portale; ambra, e'
          quello che manca. Le parole stanno nella legenda sopra la tabella, dove
          si leggono una volta per tutte invece che in ogni casella, e il dettaglio
          completo - arrivati, dichiarati, quanto resta - sta nel titolo che esce
          passandoci sopra.

          IL NUMERO NON CAMBIA SIGNIFICATO A META' TABELLA. Dove il mese e'
          caricato a portale il numero e' il dichiarato, e il fondo e' verde pieno:
          non c'e' niente che manca. Dove non lo e', il numero e' quello che manca
          e il fondo non e' verde. La lezione del 01/10/2026 - l'utente che legge
          «105.740» in un mese mai dichiarato - resta valida proprio cosi': quel
          numero, oggi, in quella casella non ci va piu'. */}
      <span className="block text-[11px] leading-tight tabular-nums font-medium">
        {numero}
      </span>
    </button>
  );
}
