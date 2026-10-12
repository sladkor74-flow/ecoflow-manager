import React from 'react';
import Perche from '@/components/shared/Perche';
import { giorno } from '@/components/dashboard/formato';

// L'INTESTAZIONE DEL QUADRO DELLA COMMESSA (migliorie dell'11/10/2026).
//
// «Commessa Ecotyre 2026 · SMOCO Srl, partner operativo · dati fino al 08/10/2026»:
// di che commessa si parla, per chi, e fino a che giorno arrivano i numeri. Un
// anno solo alla volta (una commessa e' annuale: «2025, 2026» sommava due
// contratti e due raccolti), scelto qui e scritto nell'indirizzo (/?anno=2025),
// cosi' un collegamento lo porta.
export default function IntestazioneCommessa({ anno, anni, onAnno, giornoDati, ultimoCaricamento, annoChiuso, caricamento, errore = false, azioni = null }) {
  const nessunRitiro = !caricamento && !errore && (!giornoDati || Number(String(giornoDati).slice(0, 4)) < Number(anno));
  return (
    <header className="flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dashboard</p>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold">Commessa Ecotyre {anno}</h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
          <span>SMOCO Srl, partner operativo</span>
          <span aria-hidden="true">·</span>
          {annoChiuso
            ? <span>anno chiuso: numeri finali del {anno}</span>
            : caricamento ? <span>dati in arrivo…</span>
            : errore ? <span>dati non arrivati</span>
            : nessunRitiro ? <span>nessun ritiro del {anno} ancora terminato</span>
            : <span>dati fino al {giorno(giornoDati)}</span>}
          <Perche>
            <p>«Dati fino al» è il giorno dell&apos;ultimo ritiro di rete terminato che c&apos;è nell&apos;archivio, per fine trasporto sul giorno italiano (mai la chiusura a portale), e mai oltre oggi: è il giorno su cui si contano l&apos;atteso del contratto e lo scarto.</p>
            {ultimoCaricamento && <p>Il file delle primarie è stato caricato il {giorno(ultimoCaricamento)}. Gli altri file hanno le loro date in fondo alla pagina, in «A quando sono aggiornati i dati».</p>}
            <p>Rete, ACI ed extra raccolta sono canali separati: in questa pagina non si sommano mai.</p>
          </Perche>
          {ultimoCaricamento && !annoChiuso && <><span aria-hidden="true">·</span><span>ultimo caricamento {giorno(ultimoCaricamento)}</span></>}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
          Anno
          <select
            value={anno}
            onChange={(e) => onAnno(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {[...anni].reverse().map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        {azioni}
      </div>
    </header>
  );
}

/**
 * L'indice delle sezioni: una riga che scorre di lato sul telefono, coi segni
 * delle voci da gestire. Porta alla sezione senza cambiare l'indirizzo: un
 * «#rete» in piu' nella cronologia farebbe del tasto Indietro un giro fra le
 * sezioni invece di un ritorno alla pagina di prima.
 */
export function IndiceSezioni({ voci, contaPerSezione, onVai }) {
  return (
    <nav aria-label="Sezioni della pagina" className="-mx-4 px-4 overflow-x-auto">
      <ul className="flex gap-1.5 w-max pb-1">
        {voci.map(v => {
          const n = contaPerSezione ? contaPerSezione(v.id) : 0;
          return (
            <li key={v.id}>
              <button type="button" onClick={() => onVai(v.id)} className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs hover:bg-muted whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {v.testo}
                {n > 0 && <span className="rounded-full bg-amber-100 text-amber-900 px-1.5 text-[10px] font-semibold" aria-label={`${n} da gestire`}>{n}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
