import React, { useState } from 'react';
import EsportaPdf from '@/components/shared/EsportaPdf';

// IL RIEPILOGO DELLA SETTIMANA PER LA DIREZIONE (14/10/2026).
//
// Fra le cose da creare approvate dall'utente il 14/10/2026: «un riepilogo
// settimanale per la direzione, il lunedi', in PDF o per email: target e scarti
// per regione, alert critici, dichiarazioni da fare, fatture del mese». Qui il
// pulsante, per chiunque guardi la dashboard; il PDF lo costruisce
// src/lib/riepilogoSettimanale.js coi numeri che la pagina ha gia' letto, e si
// scarica al clic, come il PDF del quadro.
//
// - La settimana e' da lunedi' a domenica sul giorno italiano: quella appena
//   finita, o quella in corso, scelta qui, coi giorni scritti.
// - L'unica lettura in piu' e' il raccolto della settimana (funzione
//   riepilogoSettimana), e parte solo al clic: la passa la pagina in
//   `leggiSettimana`, cosi' questo componente non chiama niente da se'.
// - Niente email: il PDF si scarica e lo manda chi lo ha fatto. Lo dice la nota
//   sotto il pulsante.
// - Costi e margine solo nella copia dell'amministratore: la pagina passa
//   isAdmin, e a chi non lo e' il PDF non li scrive mai.
// - Il riepilogo prende i numeri dell'anno scelto in testa alla pagina: se la
//   settimana non ha giorni di quell'anno, il pulsante dice quale scegliere,
//   invece di mettere accanto una settimana e un anno che non c'entrano.

const due = (n) => String(n).padStart(2, '0');
/** 'AAAA-MM-GG' spostato di n giorni sul calendario, senza passare da nessun fuso. */
const piuGiorni = (g, n) => {
  const d = new Date(Date.UTC(Number(g.slice(0, 4)), Number(g.slice(5, 7)) - 1, Number(g.slice(8, 10)) + n));
  return `${d.getUTCFullYear()}-${due(d.getUTCMonth() + 1)}-${due(d.getUTCDate())}`;
};
export const NOMI_GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

/**
 * La settimana da riepilogare, sul giorno italiano `oggi`: 'finita' e' quella
 * da lunedi' a domenica appena finita (il lunedi' mattina, quella di ieri),
 * 'in_corso' quella di oggi. Il numero e l'anno sono quelli della settimana ISO,
 * come settimanaIso e annoSettimanaIso di movimenti.js: il giovedi' della
 * settimana dice l'anno, e il numero e' quante settimane sono cominciate da
 * capodanno di quell'anno. Qui si contano a mano per non portare movimenti.js
 * nel pezzo che la dashboard scarica all'apertura (3 kB); la prova
 * (prove/riepilogoSettimanale.mjs) li confronta con quelle due ogni giorno di
 * due anni.
 * -> { quale, dal, al, numero, anno_settimana, anni, giorni: [{ giorno, nome }] }
 */
export function settimanaDaRiepilogare(oggi, quale = 'finita') {
  const g = String(oggi || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g)) return null;
  const d = new Date(Date.UTC(Number(g.slice(0, 4)), Number(g.slice(5, 7)) - 1, Number(g.slice(8, 10))));
  const lunedi = piuGiorni(g, -((d.getUTCDay() + 6) % 7));
  const dal = quale === 'in_corso' ? lunedi : piuGiorni(lunedi, -7);
  const al = piuGiorni(dal, 6);
  const giovedi = piuGiorni(dal, 3);
  const annoIso = Number(giovedi.slice(0, 4));
  const giornoDellAnno = (Date.UTC(annoIso, Number(giovedi.slice(5, 7)) - 1, Number(giovedi.slice(8, 10))) - Date.UTC(annoIso, 0, 1)) / 86400000;
  return {
    quale: quale === 'in_corso' ? 'in_corso' : 'finita',
    dal, al,
    numero: Math.floor(giornoDellAnno / 7) + 1,
    anno_settimana: annoIso,
    anni: [...new Set([Number(dal.slice(0, 4)), Number(al.slice(0, 4))])],
    giorni: NOMI_GIORNI.map((nome, i) => ({ giorno: piuGiorni(dal, i), nome })),
  };
}

/** «05/10 – 11/10/2026», o «29/12/2025 – 04/01/2026» a cavallo dell'anno. */
export function giorniDellaSettimana(s) {
  if (!s) return '';
  const it = (x) => x.split('-').reverse().join('/');
  return s.dal.slice(0, 4) === s.al.slice(0, 4) ? `${it(s.dal).slice(0, 5)} – ${it(s.al)}` : `${it(s.dal)} – ${it(s.al)}`;
}

/**
 * Il pulsante. `dati` sono i numeri gia' letti dalla pagina (quadro, cruscotto,
 * voci, mesi dell'attiva, margine, con i loro errori); `pronto` vale quando ogni
 * lettura ha risposto, con i dati o con un errore; `leggiSettimana(dal)` da' il
 * raccolto della settimana come { dati, errore }.
 */
export default function RiepilogoSettimanale({ oggi, anno, isAdmin = false, pronto = false, dati = {}, leggiSettimana }) {
  const [quale, setQuale] = useState('finita');
  const finita = settimanaDaRiepilogare(oggi, 'finita');
  const inCorso = settimanaDaRiepilogare(oggi, 'in_corso');
  const settimana = quale === 'in_corso' ? inCorso : finita;
  const fuoriAnno = !!settimana && !settimana.anni.includes(Number(anno));
  const nota = fuoriAnno
    ? `La settimana ${giorniDellaSettimana(settimana)} è del ${settimana.anni.join(' e del ')}: per il riepilogo scegli ${settimana.anni.length > 1 ? 'uno dei due anni' : `il ${settimana.anni[0]}`}.`
    : !pronto ? 'Il riepilogo si prepara quando i numeri della dashboard sono arrivati.'
      : `Da girare alla direzione: il PDF si scarica e lo mandi tu, il gestionale non manda email.${isAdmin ? ' La tua copia, da amministratore, ha anche costi e margine.' : ''}`;
  return (
    <div className="flex items-center gap-2 flex-wrap w-full">
      <label className="text-xs text-muted-foreground flex items-center gap-1.5">
        Settimana
        <select
          value={quale}
          onChange={(e) => setQuale(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="finita">appena finita · {giorniDellaSettimana(finita)}</option>
          <option value="in_corso">in corso · {giorniDellaSettimana(inCorso)}</option>
        </select>
      </label>
      <EsportaPdf
        etichetta="Riepilogo della settimana (PDF)"
        disabilitato={!settimana || fuoriAnno || !pronto || typeof leggiSettimana !== 'function'}
        // Il modulo del PDF si scarica al clic, insieme alla lettura della settimana.
        sezioni={async () => {
          const [{ argomentiRiepilogoPdf }, lettura] = await Promise.all([
            import('@/lib/riepilogoSettimanale'),
            leggiSettimana(settimana.dal),
          ]);
          return argomentiRiepilogoPdf({ ...dati, settimana, lettura, isAdmin, oggi });
        }}
      />
      <p className="text-[11px] text-muted-foreground w-full max-w-xl">{nota}</p>
    </div>
  );
}
