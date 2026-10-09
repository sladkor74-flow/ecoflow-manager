import React from 'react';
import { statoDichiarazione, STATI } from '@/lib/dichiarazioniImpianti';
import { formatKg } from '@/lib/utils';

// Una casella del riepilogo: il colore dice che fine ha fatto quel mese, il
// numero dice quanto. Stessa lettura del foglio di gestione, con le parole nella
// legenda sopra la tabella invece che in ogni casella.

const kg = (v) => formatKg(v);
const gg = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '');

export default function CellaMese({ mese, onApri, soloLettura, dove = {} }) {
  const d = mese.dichiarazione;
  const conferito = mese.conferito_kg;
  // La rete non dovuta per accordo si scrive solo dove qualcosa e' arrivato:
  // sui mesi vuoti la casella resta vuota.
  let stato = statoDichiarazione(d, dove);
  if (stato === 'non_dovuta' && !(d && d.motivo_assenza) && !(conferito > 0)) stato = 'nessuna';
  // QUANTO DI QUESTO MESE E' USCITO E QUANTO C'E' ANCORA (09/10/2026).
  //
  // Non e' il dichiarato scritto su questo mese: il portale aggancia le
  // quantita' agli ordini piu' vecchi aperti, quindi i PFU di gennaio escono con
  // la dichiarazione di marzo. Il report del portale lo dice ordine per ordine e
  // la funzione lo porta qui gia' fatto (base44/shared/usciteDichiarate.ts).
  //
  // Prima di questa data la casella mostrava, mese per mese, gli ingressi meno
  // il dichiarato DI QUEL MESE: su T-Cycle gennaio, febbraio, aprile e maggio
  // restavano in giallo - cioe' da dichiarare - mentre erano partiti da mesi con
  // le navi di marzo e di giugno, e la somma delle caselle (532,68 t) smentiva la
  // colonna del totale (352,94 t). Parole dell'utente: «tenerlo in giallo
  // potrebbe confondere».
  const uscito = Number(mese.uscito_kg) || 0;
  const resta = Number(mese.da_dichiarare_kg) || 0;
  // Dove non si deve niente: la rete non dovuta per accordo e i mesi di soli
  // metalli, che si dichiarano con la prossima uscita di gomma. Non sono un
  // arretrato, e la casella non li conta come tale.
  const nonDovuto = stato === 'non_dovuta' || stato === 'solo_metalli';
  const inAmbra = resta > 0 && !nonDovuto && stato !== 'caricata' && !(uscito > 0);
  const uscitoTutto = uscito > 0 && resta <= 0;
  const uscitoInParte = uscito > 0 && resta > 0;

  // IL NUMERO DELLA CASELLA, uno solo.
  const dichiarato = d && Number(d.quantita_kg) > 0 ? kg(d.quantita_kg) : '';
  // I MESI DI SOLO FERRO PORTANO IL FERRO USCITO (utente, 02/10/2026). Erano
  // caselle chiare e vuote: nessun numero, perche' la quantita' dichiarata e'
  // zero - a portale quel mese non si carica nulla - e nessuna parola, dopo che
  // le parole sono uscite dalle caselle. Ma qualcosa e' uscito eccome, ed e'
  // ferro: si scrive quanto, e si dice che e' quello.
  const ferro = d && Number(d.metalli_kg) > 0 ? kg(d.metalli_kg) : '';
  // Il tilde dice che quella parte il gestionale l'ha ripartita da se', perche'
  // il report del portale non ha ancora quella dichiarazione: un numero stimato
  // non si presenta come un numero letto.
  const circa = mese.uscito_stimato ? '~' : '';
  const numero = stato === 'solo_metalli' ? ferro
    : stato === 'caricata' ? dichiarato
      : nonDovuto ? dichiarato
        : uscito > 0 ? `${circa}${kg(uscito)}`
          : inAmbra ? kg(resta)
            : dichiarato;

  // I COLORI, E CHE COSA DICONO (rivisti il 09/10/2026 su richiesta dell'utente:
  // «marcando in verde i quantitativi effettivamente usciti... e colorare
  // diversamente le celle in cui avviene il caricamento a portale delle
  // dichiarazioni, quando cioe' ci sono le uscite su nave»).
  //
  // INDACO: qui la dichiarazione e' stata caricata a portale. E' l'evento - la
  // nave, per un R1 - e il numero e' quello che si e' caricato, non quello che di
  // questo mese e' uscito: i mesi che quel caricamento ha portato via li dice il
  // titolo. VERDE PIENO: di questo mese e' uscito tutto. VERDE CHIARO: e' uscito
  // in parte, e il resto sta nella riga «resta in giacenza» sotto. ARANCIONE: i
  // metalli ferrosi, che a portale non sono gestibili e si dichiarano al
  // consorzio VIA EMAIL - sono dichiarati eccome, e il colore pieno lo dice
  // (regola dell'utente, 03/10/2026: «usa colori piu' chiari solo per il non
  // dichiarato»). AMBRA: di questo mese non e' uscito niente. Chiarissimo e
  // spento: quello che non si deve.
  const fondo = stato === 'caricata' ? 'bg-indigo-600 text-white hover:bg-indigo-700'
    : stato === 'solo_metalli' ? 'bg-orange-300 hover:bg-orange-400 text-orange-950'
      : nonDovuto ? 'bg-slate-50 hover:bg-slate-100 text-slate-500'
        : uscitoTutto ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : uscitoInParte ? 'bg-emerald-200 hover:bg-emerald-300 text-emerald-950'
            : inAmbra ? 'bg-amber-50 hover:bg-amber-100 text-amber-900'
              : d ? 'bg-emerald-100 hover:bg-emerald-200'
                : 'hover:bg-muted';
  const daStoccaggi = (mese.da_stoccaggi || []).map(s => `${kg(s.kg)} kg da ${s.stoccaggio}`).join(', ');
  // Quali mesi questa dichiarazione ha portato via: e' il processo che l'utente
  // vuole leggere, e il portale lo dice ordine per ordine.
  const copre = mese.copre && mese.copre.mesi && mese.copre.mesi.length
    ? `caricata a portale il ${gg(mese.copre.giorno)}: ha chiuso ${mese.copre.mesi.map(x => `${x.mese} ${kg(x.kg)} kg`).join(', ')}`
    : '';
  const titolo = [
    `${mese.mese}`,
    conferito ? `arrivati ${kg(conferito)} kg${daStoccaggi ? ` (in secondaria: ${daStoccaggi})` : ''}` : 'nessun conferimento',
    conferito ? `usciti ${kg(uscito)} kg${mese.uscito_stimato ? ' (in parte ripartiti dal gestionale: il report del portale non ha ancora quella dichiarazione)' : ''}` : '',
    d && d.quantita_kg > 0 ? `dichiarati ${kg(d.quantita_kg)} kg` : '',
    copre,
    // «usciti» solo in un mese di soli metalli, dove metalli_kg e' davvero il
    // ferro uscito dal registro. Negli altri mesi e' il ferro DENTRO le
    // dichiarazioni caricate a portale, e puo' essere piu' di quello uscito nel
    // mese, perche' porta anche l'arretrato dei mesi senza nave: chiamarlo
    // «uscito» faceva sembrare che dal registro fossero usciti chili che non
    // c'erano, e sommando le caselle il totale annuo dell'EER 19.12.02 saliva.
    d && Number(d.metalli_kg) > 0
      ? `${stato === 'solo_metalli' ? 'metalli ferrosi usciti' : 'di cui metalli ferrosi'} ${kg(d.metalli_kg)} kg` : '',
    // Quando l'email al consorzio e' partita: a portale il ferro non si carica, e
    // senza questa data di quell'invio non restava traccia da nessuna parte.
    d && Number(d.metalli_kg) > 0 && d.inviata_consorzio_il
      ? `al consorzio il ${gg(d.inviata_consorzio_il)}` : '',
    resta > 0 ? `resta in giacenza ${kg(resta)} kg` : (conferito > 0 ? 'niente piu\' in giacenza di questo mese' : ''),
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

          Quindi: un numero e basta. Le parole stanno nella legenda sopra la
          tabella, dove si leggono una volta per tutte invece che in ogni casella,
          e il dettaglio completo - arrivati, usciti, con quale caricamento, quanto
          resta - sta nel titolo che esce passandoci sopra.

          IL NUMERO NON CAMBIA SIGNIFICATO A META' TABELLA. Dove il fondo e' verde
          il numero e' quello che di quel mese e' uscito; dove e' indaco e' quello
          che in quel mese si e' caricato a portale; dove e' ambra e' quello che
          resta. La lezione del 01/10/2026 - l'utente che legge «105.740» in un
          mese mai dichiarato - resta valida proprio cosi': un numero che non
          corrisponde al colore, in quella casella non ci va. */}
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
