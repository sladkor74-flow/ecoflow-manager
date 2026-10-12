import React from 'react';
import { FileCheck, CheckCircle2, CircleDot, Circle } from 'lucide-react';
import Sezione from '@/components/dashboard/Sezione';
import { NOMI_CANALE } from '@/components/dashboard/formato';

// LA FATTURAZIONE ATTIVA VERSO ECOTYRE (migliorie dell'11/10/2026): una fattura
// per canale e per mese, e lo stato di ogni mese finito canale per canale. E' uno
// stato, non un avviso: icona e parola (chiusa, elaborata, da elaborare), non
// riquadri gialli; gli avvisi sono le voci «Fatturazione attiva» di Da gestire.
// Un canale che manca non diventa verde perche' gli altri sono chiusi. Ci sono
// anche i mesi dell'anno prima ancora aperti, finche' non si chiudono.
//
// Un anno passato si guarda dal primo mese con un documento (revisione delle
// migliorie, 11/10/2026): il 2025, fatturato prima del gestionale, era dodici mesi
// «da elaborare». I mesi che restano fuori li dice la nota (quadro.mesi_attiva_nota).
//
// Nessun importo: la sezione la vede chiunque.

const STATI = {
  chiusa: { Icona: CheckCircle2, classe: 'text-emerald-700', parola: 'chiusa' },
  elaborata: { Icona: CircleDot, classe: 'text-blue-700', parola: 'elaborata' },
  da_elaborare: { Icona: Circle, classe: 'text-amber-800', parola: 'da elaborare' },
};
/** Lo stato di un canale di un mese, in tre parole. */
export const statoCanale = (c) => (!c || !c.elaborato ? STATI.da_elaborare : c.chiuso ? STATI.chiusa : STATI.elaborata);

export default function SezioneFatturazione({ mesi, anno, nota = '', daGestire, onDaGestire, caricamento }) {
  return (
    <Sezione
      id="fatturazione" icona={FileCheck}
      titolo={`Fatturazione attiva verso Ecotyre ${anno}`}
      sottotitolo="Una fattura per canale e per mese: lo stato di ogni mese finito, canale per canale."
      perche={(
        <>
          <p>Lo stato viene dai documenti della fatturazione attiva: «chiusa» quando il documento del canale è chiuso, «elaborata» quando c&apos;è e non è ancora chiuso, «da elaborare» quando manca.</p>
          <p>Il mese in corso non si fattura ancora. I mesi dell&apos;anno prima non ancora chiusi restano qui finché non si chiudono.</p>
          <p>Un anno passato si guarda dal primo mese che ha un documento nel gestionale: i mesi fatturati prima del gestionale non si sono mai elaborati qui, e non c&apos;è niente da elaborare.</p>
          <p>La prefattura del portale copre rete e ACI, non l&apos;extra raccolta.</p>
        </>
      )}
      collegamenti={[{ a: '/fatturazione', testo: 'Fatturazione' }]}
      daGestire={daGestire} onDaGestire={onDaGestire}
    >
      {!caricamento && mesi && nota && <p className="text-sm text-muted-foreground mb-2">{nota}</p>}
      {caricamento ? <p className="text-sm text-muted-foreground">Lettura dei mesi…</p>
        : !mesi ? <p className="text-sm text-muted-foreground">I documenti della fatturazione del {anno} non si sono potuti leggere.</p>
          : !mesi.length ? (nota ? null : <p className="text-sm text-muted-foreground">Nessun mese finito da fatturare nel {anno}.</p>)
            : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {mesi.map(m => (
                  <li key={m.etichetta || m.mese} className="border rounded-md px-3 py-2 text-xs bg-background">
                    <p className="font-medium text-sm">{m.etichetta || m.mese}</p>
                    {m.canali
                      ? Object.entries(m.canali).map(([k, c]) => {
                        const s = statoCanale(c);
                        return (
                          <p key={k} className={`flex items-center gap-1 ${s.classe}`}>
                            <s.Icona className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span className="text-foreground/80">{NOMI_CANALE[k] || k}:</span> {s.parola}
                          </p>
                        );
                      })
                      : <p>{m.stato}</p>}
                    <p className="text-muted-foreground mt-0.5">{m.prefattura ? 'prefattura caricata' : 'senza prefattura'}</p>
                  </li>
                ))}
              </ul>
            )}
    </Sezione>
  );
}
