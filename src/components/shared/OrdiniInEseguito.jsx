import React, { useState } from 'react';
import { Clock, Copy, Check, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { spiegazioneEseguiti, ilGiorno, intero, quantiOrdini } from '@/lib/ordiniEseguiti';

// GLI ORDINI RIMASTI «ESEGUITO» A PORTALE, A VIDEO (richiesta dell'utente del
// 14/10/2026: «devono essere sempre segnalati indicando l'id ordine affinche' vi
// si possa porre subito rimedio [...] nel modo meno invasivo possibile»).
//
// Un riquadro ambra piccolo, mai una finestra che interrompe: sotto la scheda del
// caricamento (EsitoEseguiti) e in testa alle pagine (AvvisoEseguiti, che usa
// ElencoEseguiti). Se non ce n'e' nessuno non compare niente. Gli ID si leggono
// aprendo «Quali sono», si copiano tutti con un clic e si scaricano in un foglio
// pulito, un canale per foglio.
//
// La regola - chi e' «eseguito», come si raggruppa, la frase di che cosa manca -
// sta in src/lib/ordiniEseguiti.js, la stessa della voce della dashboard:
// qui c'e' solo come si mostra.

/** Gli ID di tutti gli ordini dei gruppi, uno per riga: quello che si incolla a portale. */
export const idDaCopiare = (gruppi) => (gruppi || []).flatMap(g => (g.elenco || []).map(o => o.id_ordine || o.numero_fir).filter(Boolean));

// La copia negli appunti: il modo moderno, e quello vecchio dove il browser non
// lo concede (una pagina non sicura, un permesso negato).
async function copia(testo) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(testo); return true; }
  } catch (_e) { /* si prova il modo vecchio */ }
  try {
    const area = document.createElement('textarea');
    area.value = testo;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const fatto = document.execCommand('copy');
    document.body.removeChild(area);
    return fatto;
  } catch (_e) {
    return false;
  }
}

// I primi cinque ID di un gruppo, per la riga in testa.
const ID_IN_TESTA = 5;
function idInBreve(g) {
  const ids = (g.elenco || []).map(o => o.id_ordine || o.numero_fir).filter(Boolean);
  if (!ids.length) return '';
  const altri = g.ordini - Math.min(ids.length, ID_IN_TESTA);
  return `${ids.slice(0, ID_IN_TESTA).join(', ')}${altri > 0 ? ` e altri ${intero(altri)}` : ''}`;
}

function quando(o) {
  if (!o.fine_trasporto) return 'senza fine trasporto';
  const giorni = o.giorni === null || o.giorni === undefined ? '' : o.giorni === 0 ? ', oggi' : o.giorni === 1 ? ', ieri' : `, ${intero(o.giorni)} giorni fa`;
  return `fine trasporto ${ilGiorno(o.fine_trasporto)}${giorni}`;
}

/** Le due azioni: copiare gli ID e scaricare il foglio. */
function Azioni({ gruppi }) {
  const [copiati, setCopiati] = useState(null);
  const [scarico, setScarico] = useState(false);
  const ids = idDaCopiare(gruppi);
  const onCopia = async () => {
    const ok = await copia(ids.join('\n'));
    setCopiati(ok ? 'copiati' : 'non riuscito');
    setTimeout(() => setCopiati(null), 2500);
  };
  const onScarica = async () => {
    setScarico(true);
    try {
      const { scaricaExcelEseguiti } = await import('@/lib/ordiniEseguitiExcel');
      await scaricaExcelEseguiti(gruppi);
    } catch (e) {
      console.error(e);
    }
    setScarico(false);
  };
  if (!ids.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 -ml-2">
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-amber-900 hover:bg-amber-100" onClick={onCopia}>
        {copiati === 'copiati' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copiati === 'copiati' ? 'ID copiati' : copiati ? 'Copia non riuscita' : `Copia ${ids.length === 1 ? "l'ID" : 'gli ID'}`}
      </Button>
      {(gruppi || []).some(g => g.chiave) && (
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-amber-900 hover:bg-amber-100" onClick={onScarica} disabled={scarico}>
          {scarico ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Scarica Excel
        </Button>
      )}
    </div>
  );
}

/**
 * L'elenco degli ordini, gruppo per gruppo, con le azioni. gruppi: quelli di
 * ordiniEseguiti (src/lib/ordiniEseguiti.js). conNome: scrive il nome del
 * gruppo sopra il suo elenco (serve quando i gruppi sono piu' d'uno).
 */
export function ElencoEseguiti({ gruppi, conNome = true }) {
  const tutti = (gruppi || []).reduce((s, g) => s + g.ordini, 0);
  const mostrati = (gruppi || []).reduce((s, g) => s + (g.elenco || []).length, 0);
  return (
    <div className="space-y-1">
      <details className="text-xs">
        <summary className="cursor-pointer select-none">Quali sono{mostrati < tutti ? ` (i primi ${intero(mostrati)})` : ''}</summary>
        <div className="mt-1 space-y-1.5">
          {(gruppi || []).map(g => (
            <div key={g.chiave || g.nome}>
              {conNome && <p className="font-medium">{g.nome}</p>}
              <ul className="space-y-0.5">
                {(g.elenco || []).map((o, i) => (
                  <li key={`${o.id_ordine || o.numero_fir}|${i}`} className="break-words">
                    <span className="font-mono select-all">{o.id_ordine || o.numero_fir || 'senza ID'}</span>
                    {o.id_ordine && o.numero_fir ? <> · FIR <span className="font-mono">{o.numero_fir}</span></> : null}
                    {o.soggetto ? ` · ${o.soggetto}` : ''}
                    {o.luogo ? ` · ${o.luogo}${o.provincia ? ` (${o.provincia})` : ''}` : ''}
                    {` · ${quando(o)}`}
                    {o.kg !== null && o.kg !== undefined ? ` · ${intero(o.kg)} kg` : ''}
                    {o.manca ? <span className="text-amber-800/80"> — {o.manca}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
      <Azioni gruppi={gruppi} />
    </div>
  );
}

// Il conto per canale con i soli esempi del file: e' la forma di quando
// l'archivio non si e' potuto rileggere dopo il caricamento delle primarie
// (ordiniEseguitiDelFile in src/lib/importGrandeFile.js). Si mostra lo stesso
// elenco, coi dati che ci sono.
function gruppiDalFile(avviso) {
  return [['RETE', 'Rete', avviso.rete], ['ACI', 'ACI', avviso.aci]]
    .filter(([, , q]) => q && q.ordini > 0)
    .map(([canale, nome, q]) => ({
      nome, canale, ordini: q.ordini, kg: q.kg,
      elenco: (q.esempi || []).map(e => ({ id_ordine: e.id_ordine, numero_fir: e.numero_fir, kg: e.kg, fine_trasporto: null, giorni: null, manca: '' })),
    }));
}

/**
 * L'ESITO DEL CARICAMENTO: avviso e' avviso_eseguiti della risposta (primarie:
 * importaGrandeFile; secondarie e terziarie: importEcotyreFile). Se non ci sono
 * ordini in «eseguito» non compare niente; se l'archivio non si e' potuto
 * rileggere lo dice in una riga.
 */
export default function EsitoEseguiti({ avviso }) {
  if (!avviso) return null;
  const gruppi = Array.isArray(avviso.gruppi) ? avviso.gruppi : gruppiDalFile(avviso);
  const nonRiletti = (avviso.non_riletti || []).filter(Boolean);
  if (!gruppi.length && !nonRiletti.length) return null;
  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-xs text-amber-900 space-y-1">
      {gruppi.length > 0 && (
        <>
          <div className="flex items-start gap-1.5">
            <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              {/* Gli ID si leggono subito, senza aprire niente: di solito sono
                  uno o due. Oltre i cinque per gruppo si dice quanti altri, e
                  l'elenco intero sta in «Quali sono». */}
              {gruppi.map((g, i) => (
                <React.Fragment key={g.chiave || g.nome}>
                  {i > 0 ? ' · ' : ''}
                  <strong>{g.nome}: {quantiOrdini(g.ordini)} in «eseguito»</strong>
                  {idInBreve(g) ? <> (<span className="font-mono">{idInBreve(g)}</span>)</> : null}
                </React.Fragment>
              ))}
              {/* La spiegazione dipende dagli ordini: a quelli fuori
                  dall'export non si promette che spariscano da soli al
                  caricamento dopo (revisione del 14/10/2026). */}
              .{' '}{spiegazioneEseguiti(gruppi)}
            </p>
          </div>
          <div className="pl-5"><ElencoEseguiti gruppi={gruppi} conNome={gruppi.length > 1} /></div>
        </>
      )}
      {nonRiletti.length > 0 && (
        <p className="pl-5">
          Dopo il caricamento non si è potuto rileggere l&apos;archivio ({nonRiletti.join(', ')}): {gruppi.length ? 'l\'elenco qui sopra è quello del file, e ' : ''}gli ordini in «eseguito» conservati dagli anni prima li dicono la pagina del modulo e la dashboard.
        </p>
      )}
    </div>
  );
}
