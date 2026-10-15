import React from 'react';
import { Scale, Lock, Loader2 } from 'lucide-react';
import Sezione from '@/components/dashboard/Sezione';
import { t, pct, euro, NOMI_CANALE } from '@/components/dashboard/formato';

// L'ECONOMIA DELLA COMMESSA, SOLO PER L'AMMINISTRATORE (migliorie
// dell'11/10/2026). Il blocco del margine di prima, che pero' segue l'anno scelto
// in testa alla pagina: prima chiamava calcolaMargine senza anno, e scegliendo
// il 2025 i numeri sopra parlavano del 2025 e il margine del 2026, sotto lo
// stesso titolo. Tre commesse, tre margini: non si sommano. A chi non e'
// amministratore la sezione non esiste e la funzione non si chiama: i costi dei
// fornitori sono dell'amministratore.
//
// UN MARGINE CON PREZZI MANCANTI E' «—» (prova del cambio d'anno, 15/10/2026). Il
// 15/01/2027, senza le tariffe 2027, la sezione diceva «Rete € 0,00 · nessun
// ricavo · 7,10 t» ed «Extra raccolta € -113,50 · -77,2% del ricavo». Ora il
// margine e i suoi €/t sono «—» con la frase del calcolo («7 righe senza prezzo
// (...): margine non calcolabile», testo_prezzi_mancanti), ricavo e costo sono
// detti parziali, e «nessun ricavo» si scrive solo senza tonnellate. Come la
// scheda di Fatturazione › Margine (sottoIlMargine in MargineCommessa.jsx).
const sottoIlMargine = (x) => (x.testo_prezzi_mancanti ? x.testo_prezzi_mancanti
  : x.margine_pct !== null && x.margine_pct !== undefined ? `${pct(x.margine_pct)} del ricavo`
    : Number(x.tonnellate) > 0 ? '— del ricavo' : 'nessun ricavo');

export default function SezioneEconomia({ margine, errore, anno, daGestire, onDaGestire }) {
  return (
    <Sezione
      id="economia" icona={Scale}
      titolo={`Economia della commessa ${anno}`}
      sottotitolo="Ricavi dalla fatturazione attiva, costi dalla passiva, mese per mese fino a oggi. Tre commesse, tre margini: non si sommano."
      perche={(
        <>
          <p>Il ricavo è quello della fatturazione attiva verso Ecotyre, il costo quello della passiva dei fornitori, sui mesi del {anno} fino a oggi; per tonnellata, ricavo meno costo fa il margine.</p>
          <p>È lo stesso conto di Fatturazione → Margine, mese per mese.</p>
        </>
      )}
      collegamenti={[{ a: '/fatturazione', testo: 'Fatturazione → Margine' }]}
      daGestire={daGestire} onDaGestire={onDaGestire}
      destra={<span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Lock className="w-3 h-3" aria-hidden="true" /> visibile solo all&apos;amministratore</span>}
    >
      {errore ? <p className="text-sm text-destructive">Il margine non si è potuto calcolare: {errore}</p>
        : !margine ? <p className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> Calcolo sui dati di oggi…</p>
          : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(margine.canali || []).map(c => (
                <div key={c.canale} className="border rounded-lg p-4 bg-background">
                  <p className="text-sm font-medium">{NOMI_CANALE[c.canale] || c.canale}</p>
                  <p className={`text-2xl font-heading font-bold mt-1 ${c.anno.margine < 0 ? 'text-red-700' : ''}`}>{euro(c.anno.margine)}</p>
                  <p className={`text-xs ${c.anno.parziale ? 'text-amber-700' : 'text-muted-foreground'}`}>{sottoIlMargine(c.anno)} · {t(c.anno.tonnellate)}</p>
                  {c.anno.testo_da_confermare && <p className="text-xs text-amber-700">{c.anno.testo_da_confermare}</p>}
                  <dl className="mt-2 pt-2 border-t text-xs space-y-0.5">
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Ricavo{c.anno.parziale ? ' (parziale)' : ''}</dt><dd className="tabular-nums">{euro(c.anno.ricavo)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Costo{c.anno.parziale ? ' (parziale)' : ''}</dt><dd className="tabular-nums">{euro(c.anno.costo)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Per tonnellata</dt><dd className="tabular-nums text-right">{c.anno.parziale ? '—' : `${euro(c.anno.ricavo_t)} − ${euro(c.anno.costo_t)} = ${euro(c.anno.margine_t)}`}</dd></div>
                  </dl>
                </div>
              ))}
            </div>
          )}
    </Sezione>
  );
}
