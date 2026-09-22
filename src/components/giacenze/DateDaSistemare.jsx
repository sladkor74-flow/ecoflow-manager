import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatKg } from '@/lib/utils';
import { CANALI } from '@/lib/dichiarazioniImpianti';

// I formulari terminati con le date da sistemare di un soggetto, un canale per
// volta. Regola dell'utente del 22/09/2026: «le date immissione, inizio e fine
// trasporto sono obbligatorie nei formulari, se non ci sono vanno segnalate e
// questo vale sempre dove ci sono ordini terminati». I gruppi arrivano gia'
// fatti dalle funzioni (formulariDaSistemare in base44/shared/giacenzaPortale.ts),
// con l'elenco degli ordini e l'avviso su che cosa comporta per la giacenza.
// Lo usano Giacenze e Dichiarazioni Impianti: stesse parole in tutti e due.
//
// Rete, ACI ed extra raccolta restano su righe diverse e non si sommano: nemmeno
// il numero dei formulari. Le terziarie non sono un canale - partono
// dall'impianto verso le cementerie e la giacenza di PFU non la toccano - e
// hanno una riga loro: contate nella rete gonfiavano il numero della rete.

const FUORI_CANALE = { TERZIARIE: 'Terziarie (fuori dai canali)' };
const nomeCanale = (c) => FUORI_CANALE[c] || (CANALI.find(x => x.chiave === c) || { nome: c }).nome;
const giorno = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '—');
const RUOLO = { imp: 'impianto', stoc: 'stoccaggio' };

/**
 * Che cosa comporta, per i conti, un ordine con le date da sistemare. Dove il
 * portale lo conta si dice: fra i non dichiarati e' nella sua giacenza, gia'
 * dichiarato non piu', sconosciuto in nessuna delle due (22/09/2026).
 */
export function effettoOrdine(o) {
  if (!o.senza_fine) return 'nei conti per fine trasporto: il formulario va completato';
  if (o.ruolo === 'stoc') {
    return `in nessun mese e fra i movimenti dopo la rilevazione ${o.verso === 'partenza' ? 'non si toglie' : 'non si aggiunge'}: non si sa se e' prima o dopo`;
  }
  if (o.tipo === 'terziaria') return "in nessun mese: fuori dalle uscite dell'anno finche' la fine trasporto non arriva";
  const portale = o.nel_file === true ? "; il portale lo ha fra i non dichiarati e lo conta nella sua giacenza"
    : o.noto_al_portale === true && o.nel_file === false ? "; a portale risulta gia' dichiarato"
      : o.noto_al_portale === true ? '; il portale lo conosce e lo conta nei suoi conti'
        : o.noto_al_portale === false ? '; il portale non lo conosce ancora' : '';
  // Immesso in un altro anno: compare perche' il portale lo conosce, e la sua
  // giacenza non ha anno (22/09/2026).
  const altroAnno = o.fuori_anno && o.immesso_il ? `; immesso nel ${String(o.immesso_il).slice(0, 4)}` : '';
  return `in nessun mese: il gestionale non lo conta finche' la fine trasporto non arriva${portale}${altroAnno}`;
}

/** La fine trasporto: quella del formulario o, se manca, quella che scrive il portale. */
const fineDi = (o) => (o.finito_il ? giorno(o.finito_il) : o.fine_a_portale ? `— (a portale ${giorno(o.fine_a_portale)}: va riportata)` : '—');

/** Arrivato da chi, partito verso chi. */
export const versoOrdine = (o) => `${o.tipo} ${o.verso === 'partenza' ? 'partita' : 'arrivata'}${o.controparte ? (o.verso === 'partenza' ? ` verso ${o.controparte}` : ` da ${o.controparte}`) : ''}`;

/**
 * Gli stessi ordini per un foglio Excel, uno per riga, con le stesse parole della
 * pagina: li usano gli export di Giacenze e di Dichiarazioni Impianti. Le date
 * restano GG/MM/AAAA, i pesi kg interi; il canale su ogni riga, mai sommati.
 */
export const INTESTAZIONE_DATE = ['Soggetto', 'Ruolo', 'Canale', 'ID ordine', 'FIR', 'Movimento', 'Peso (kg)', 'Immissione', 'Inizio trasporto', 'Fine trasporto', 'Fine trasporto scritta dal portale', 'Da sistemare', 'Nei conti', 'Che cosa comporta per il soggetto'];
export function righeExcelDate(gruppi) {
  const vuota = (g) => (g ? giorno(g) : '');
  return (gruppi || []).flatMap(g => (g.ordini || []).map(o => {
    const r = { ...o, canale: g.canale, sito: g.sito, ruolo: g.ruolo };
    return [
      g.sito || '', RUOLO[g.ruolo] || g.ruolo || '', nomeCanale(g.canale), o.id_ordine || '', o.numero_fir || '', versoOrdine(o),
      Math.round(Number(o.kg) || 0), vuota(o.immesso_il), vuota(o.iniziato_il), vuota(o.finito_il), vuota(o.fine_a_portale),
      o.testo || '', effettoOrdine(r), g.avviso || '',
    ];
  }));
}

/**
 * Quelli senza fine trasporto di un gruppo, divisi per verso: "2 arrivati
 * (12.000 kg), 1 terziaria partita (25.000 kg)". Arrivi e partenze non si
 * sommano in un peso (22/09/2026): sono materiali diversi, in versi opposti, e
 * una terziaria nella giacenza di PFU non entra comunque. Stringa vuota se non
 * ne manca nessuna.
 */
export function senzaFinePerVerso(g) {
  const sf = (g && g.senza_fine) || {};
  const stoc = g && g.ruolo === 'stoc';
  const parti = [];
  if (sf.arrivi_n) parti.push(`${sf.arrivi_n} ${sf.arrivi_n === 1 ? 'arrivato' : 'arrivati'} (${formatKg(sf.arrivi_kg)} kg)`);
  if (sf.partenze_n) {
    const cosa = stoc ? (sf.partenze_n === 1 ? 'secondaria partita' : 'secondarie partite') : (sf.partenze_n === 1 ? 'terziaria partita' : 'terziarie partite');
    parti.push(`${sf.partenze_n} ${cosa} (${formatKg(sf.partenze_kg)} kg)`);
  }
  return parti.join(', ');
}

/** Una riga di riassunto per canale: "Rete: 4 formulari da sistemare; senza fine trasporto 2 arrivati (12.000 kg), 1 terziaria partita (25.000 kg)". */
export function riassuntoGruppo(g) {
  const quanti = `${g.n} ${g.n === 1 ? 'formulario' : 'formulari'}`;
  const verso = senzaFinePerVerso(g);
  return `${nomeCanale(g.canale)}: ${quanti} da sistemare${verso ? `; senza fine trasporto ${verso}` : ''}`;
}

export default function DateDaSistemare({ gruppi, mostraSito = false, className = '' }) {
  const [aperto, setAperto] = useState(false);
  if (!gruppi || !gruppi.length) return null;
  const ordini = gruppi.flatMap(g => (g.ordini || []).map(o => ({ ...o, canale: g.canale, sito: g.sito, ruolo: g.ruolo })));
  return (
    <div className={`border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-xs space-y-1 ${className}`}>
      <p className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        Formulari terminati con le date da sistemare: immissione, inizio e fine trasporto sono obbligatorie
      </p>
      {gruppi.map(g => (
        <div key={`${g.sito || ''}-${g.ruolo || ''}-${g.canale}`}>
          <p>
            {mostraSito && g.sito ? <strong>{g.sito}{g.ruolo ? ` (${RUOLO[g.ruolo] || g.ruolo})` : ''} · </strong> : null}
            {riassuntoGruppo(g)}
          </p>
          {g.avviso && <p className="text-amber-800">{g.avviso}</p>}
        </div>
      ))}
      {ordini.length > 0 && (
        <button type="button" onClick={() => setAperto(v => !v)} className="inline-flex items-center gap-1 text-amber-800 hover:underline">
          {aperto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {aperto ? 'Nascondi gli ordini' : `Quali sono (${ordini.length})`}
        </button>
      )}
      {aperto && (
        <div className="overflow-x-auto bg-white/60 rounded border border-amber-200">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left border-b border-amber-200">
                {mostraSito && <th className="px-2 py-1 font-semibold">Soggetto</th>}
                <th className="px-2 py-1 font-semibold">Canale</th>
                <th className="px-2 py-1 font-semibold">ID ordine</th>
                <th className="px-2 py-1 font-semibold">FIR</th>
                <th className="px-2 py-1 font-semibold">Movimento</th>
                <th className="px-2 py-1 font-semibold text-right">Peso (kg)</th>
                <th className="px-2 py-1 font-semibold">Immissione</th>
                <th className="px-2 py-1 font-semibold">Inizio trasporto</th>
                <th className="px-2 py-1 font-semibold">Fine trasporto</th>
                <th className="px-2 py-1 font-semibold">Da sistemare</th>
                <th className="px-2 py-1 font-semibold">Nei conti</th>
              </tr>
            </thead>
            <tbody>
              {ordini.map((o, i) => (
                <tr key={`${o.sito}-${o.canale}-${o.tipo}-${o.id_ordine}-${o.verso}-${i}`} className="border-b last:border-b-0 border-amber-100 align-top">
                  {mostraSito && <td className="px-2 py-1">{o.sito}</td>}
                  <td className="px-2 py-1">{nomeCanale(o.canale)}</td>
                  <td className="px-2 py-1 font-mono">{o.id_ordine || '—'}</td>
                  <td className="px-2 py-1 font-mono">{o.numero_fir || '—'}</td>
                  <td className="px-2 py-1">{versoOrdine(o)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{formatKg(o.kg)}</td>
                  <td className="px-2 py-1">{giorno(o.immesso_il)}</td>
                  <td className="px-2 py-1">{giorno(o.iniziato_il)}</td>
                  <td className="px-2 py-1">{fineDi(o)}</td>
                  <td className="px-2 py-1 font-medium">{o.testo}</td>
                  <td className="px-2 py-1">{effettoOrdine(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
