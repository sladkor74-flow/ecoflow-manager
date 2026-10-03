import React, { useEffect, useRef, useState } from 'react';
import EcoTyna, { comeSta } from '@/components/assistente/EcoTyna';
import EcoTynaFoto from '@/components/assistente/EcoTynaFoto';

// L'ANGOLINO: ECOTYNA SI FA VEDERE QUANDO SERVE E SI LEVA DI MEZZO QUANDO NO.
//
// Prima la faccia stava fissa nell'intestazione della chat, grande uguale sempre:
// mentre si scrive una domanda o si legge una risposta lunga non serve a niente e
// prende spazio. Qui invece sta rannicchiata in un angolo e si fa avanti solo
// quando e' interpellata - mentre pensa, mentre ascolta, mentre parla - e poi si
// ritira.
//
// Tre accorgimenti, tutti e tre per non dare fastidio:
//
// - NON COPRE NIENTE DI CLICCABILE. L'angolino non prende i clic
//   (pointer-events: none): il testo sotto si seleziona e si copia come se non ci
//   fosse.
// - NON SCAPPA VIA. Sta appiccicato in fondo all'elenco dei messaggi (sticky), non
//   sopra il riquadro dove si scrive: cosi' resta visibile mentre si scorre, ma
//   non si mette mai davanti alla tastiera.
// - NON SPARISCE DI COLPO. Quando ha finito di parlare aspetta un momento prima
//   di rimpicciolirsi, altrimenti a ogni pausa fra una frase e l'altra farebbe
//   su e giu'.
//
// Il disegno non si rimpicciolisce ridisegnandosi piu' piccolo: resta sempre lo
// stesso e si scala. Cosi' il passaggio e' continuo invece che a scatti, e la
// bocca che sta seguendo le sillabe non perde un colpo mentre la figura cresce.

const INDUGIO = 1400;   // quanto resta grande dopo aver finito
const MISURA = 104;     // la misura piena del disegno
const RANNICCHIATA = 0.38;   // quanto si fa piccola quando non serve

export default function EcoTynaAngolo({ stato = 'ferma', bocca = null }) {
  const attiva = stato !== 'ferma';
  const [avanti, setAvanti] = useState(false);
  // Se la fotografia non si carica (file mancante, rete che non va) si vede il
  // disegno: EcoTyna non deve sparire dalla pagina per un'immagine.
  const [senzaFoto, setSenzaFoto] = useState(false);
  const ritiro = useRef(null);

  useEffect(() => {
    clearTimeout(ritiro.current);
    if (attiva) { setAvanti(true); return undefined; }
    ritiro.current = setTimeout(() => setAvanti(false), INDUGIO);
    return () => clearTimeout(ritiro.current);
  }, [attiva]);

  return (
    // Il riquadro alto zero non occupa spazio e sta appiccicato in fondo; la
    // figura ci sta dentro appoggiata in basso a destra, quindi resta SOPRA il
    // bordo invece di sbordare sotto.
    <div className="sticky bottom-0 z-10 h-0" aria-hidden={!avanti}>
      <div
        className="pointer-events-none absolute bottom-2 right-1 flex flex-col items-center gap-1"
        style={{
          transform: `scale(${avanti ? 1 : RANNICCHIATA})`,
          transformOrigin: '100% 100%',
          opacity: avanti ? 1 : 0.45,
          transition: 'transform 280ms cubic-bezier(.2,.8,.3,1), opacity 280ms ease-out',
        }}
      >
        <div className="drop-shadow-lg">
          {senzaFoto
            ? <EcoTyna stato={stato} bocca={bocca} dimensione={MISURA} nome={false} />
            : <EcoTynaFoto stato={stato} bocca={bocca} dimensione={MISURA} onErrore={() => setSenzaFoto(true)} />}
        </div>
        {/* La didascalia compare solo quando e' venuta avanti: rannicchiata
            sarebbe una scritta minuscola e illeggibile in mezzo al testo. */}
        <span
          className="rounded-full bg-card/90 px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm"
          style={{ opacity: avanti && attiva ? 1 : 0, transition: 'opacity 200ms ease-out' }}
        >
          {comeSta(stato)}
        </span>
      </div>
    </div>
  );
}
