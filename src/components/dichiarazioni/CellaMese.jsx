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
  // I MESI DI SOLO FERRO PORTANO IL FERRO USCITO (utente, 02/10/2026). Erano
  // caselle chiare e vuote: nessun numero, perche' la quantita' dichiarata e'
  // zero - a portale quel mese non si carica nulla - e nessuna parola, dopo che
  // le parole sono uscite dalle caselle. Ma qualcosa e' uscito eccome, ed e'
  // ferro: si scrive quanto, e si dice che e' quello.
  const ferro = d && Number(d.metalli_kg) > 0 ? kg(d.metalli_kg) : '';
  const numero = stato === 'solo_metalli' ? ferro
    : (stato === 'caricata' ? dichiarato : (inAmbra ? kg(resta) : dichiarato));

  // I COLORI, E CHE COSA DICONO.
  //
  // Verde pieno: caricato a portale. ARANCIONE: i metalli ferrosi, che a portale
  // non sono gestibili e si dichiarano al consorzio VIA EMAIL - sono dichiarati
  // eccome, e il colore pieno lo dice (regola dell'utente, 03/10/2026: «usa
  // colori piu' chiari solo per il non dichiarato»). Chiaro: quello che manca.
  // Chiarissimo e spento: quello che non si deve.
  const fondo = stato === 'caricata' ? 'bg-emerald-600 text-white hover:bg-emerald-700'
    : stato === 'solo_metalli' ? 'bg-orange-300 hover:bg-orange-400 text-orange-950'
      : inAmbra ? 'bg-amber-50 hover:bg-amber-100 text-amber-900'
        : nonDovuto ? 'bg-slate-50 hover:bg-slate-100 text-slate-500'
          : d ? 'bg-emerald-100 hover:bg-emerald-200'
            : 'hover:bg-muted';
  const daStoccaggi = (mese.da_stoccaggi || []).map(s => `${kg(s.kg)} kg da ${s.stoccaggio}`).join(', ');
  const titolo = [
    `${mese.mese}`,
    conferito ? `arrivati ${kg(conferito)} kg${daStoccaggi ? ` (in secondaria: ${daStoccaggi})` : ''}` : 'nessun conferimento',
    d && d.quantita_kg > 0 ? `dichiarati ${kg(d.quantita_kg)} kg` : '',
    // «usciti» solo in un mese di soli metalli, dove metalli_kg e' davvero il
    // ferro uscito dal registro. Negli altri mesi e' il ferro DENTRO le
    // dichiarazioni caricate a portale, e puo' essere piu' di quello uscito nel
    // mese, perche' porta anche l'arretrato dei mesi senza nave: chiamarlo
    // «uscito» faceva sembrare che dal registro fossero usciti chili che non
    // c'erano, e sommando le caselle il totale annuo dell'EER 19.12.02 saliva.
    d && Number(d.metalli_kg) > 0
      ? `${stato === 'solo_metalli' ? 'metalli ferrosi usciti' : 'di cui metalli ferrosi'} ${kg(d.metalli_kg)} kg` : '',
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
      {stato === 'solo_metalli' && (
        <span className="block text-[9px] leading-tight opacity-80">
          {ferro ? 'solo metalli ferrosi' : 'solo metalli: ferro da indicare'}
        </span>
      )}
    </button>
  );
}
