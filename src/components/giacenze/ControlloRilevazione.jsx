import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { formatKg } from '@/lib/utils';

// Il controllo della rilevazione appena inserita (richiesta dell'utente,
// 23/09/2026): la lettura del portale si confronta con quella precedente piu' i
// movimenti del periodo, e se una classe si scosta lo si dice subito, con gli
// ordini che possono spiegarlo.
//
// Il 16/09 la rilevazione di NAPPI SUD aveva 6.160 kg nella classe sbagliata -
// erano del formulario ET26138377, classe M, arrivato il 15/09 e chiuso a
// portale dopo la lettura - e il controllo avrebbe detto: M attesa 28.470,
// letta 22.310, 6.160 kg di scarto, quanto quel formulario. Il totale della rete
// tornava: a sbagliare era la ripartizione fra le classi, e nessun caricamento
// poteva correggerla perche' l'errore stava nel punto di partenza.
//
// Il conto lo fa calcolaGiacenze (verificaRilevazione in
// base44/shared/giacenzaStoccaggi.ts): qui si mostra e basta. Il salvataggio non
// si blocca mai - la lettura del portale e' un fatto e va salvata - si avvisa.

/** Un giorno 'AAAA-MM-GG' come lo si legge: GG/MM/AAAA. */
export const giorno = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '—');

/** Kg interi col segno davanti: uno scarto si legge solo se si vede da che parte va. */
export const kgSegno = (n) => `${Number(n) > 0 ? '+' : ''}${formatKg(n)} kg`;

/** Kg interi, o un trattino: senza rilevazione precedente l'attesa non esiste. */
const kgOppure = (n) => (n === null || n === undefined ? '—' : `${formatKg(n)} kg`);

// I canali restano separati: si nominano uno per volta, non si sommano mai.
const TOTALE_DI = { RETE: 'della rete', ACI: "dell'ACI" };

/**
 * L'esito del controllo in una frase sola, per chi ha appena salvato.
 * Tre casi e nessuno inventato: senza una rilevazione prima non c'e' un punto di
 * partenza, quindi non si dice se quadra.
 */
export function riassuntoVerifica(v) {
  if (!v) return null;
  const quando = `Rilevazione del ${giorno(v.del)}`;
  if (v.senza_precedente) {
    return {
      stato: 'senza_precedente',
      titolo: 'Prima rilevazione di questo piazzale',
      sintesi: `${quando}: non c'e' una rilevazione precedente da cui partire, quindi non c'e' niente da confrontare. Dalla prossima il controllo dira' che cosa ci si aspettava di leggere, classe per classe.`,
      scostano: [],
      ripartizione: [],
    };
  }
  const contro = `${quando}, confrontata con quella del ${giorno(v.precedente_del)} piu' i movimenti del periodo`;
  const scostano = (v.classi || []).filter(c => c.scarto);
  if (!scostano.length) {
    return {
      stato: 'quadra',
      titolo: 'Il controllo quadra',
      sintesi: `${contro}: ogni classe legge quello che i movimenti dicono.`,
      scostano: [],
      ripartizione: [],
    };
  }
  // Il caso del 16/09: il totale del canale torna, a sbagliare e' la ripartizione
  // fra le classi. E' la cosa piu' utile da dire, perche' indirizza la ricerca.
  const ripartizione = Object.entries(v.canali || {})
    .filter(([, c]) => c.ripartizione_sbagliata)
    .map(([k]) => TOTALE_DI[k] || k);
  const nomi = scostano.map(c => c.classe).join(', ');
  return {
    stato: 'scosta',
    titolo: scostano.length === 1 ? `La classe ${nomi} si scosta` : `Si scostano le classi ${nomi}`,
    sintesi: `${contro}: ${scostano.length === 1 ? 'una classe legge un valore diverso' : `${scostano.length} classi leggono un valore diverso`} da quello atteso.`
      + (ripartizione.length
        ? ` ${ripartizione.length === 1 ? `Il totale ${ripartizione[0]} torna` : `I totali ${ripartizione.join(' e ')} tornano`}: a sbagliare e' la ripartizione fra le classi.`
        : ''),
    scostano,
    ripartizione,
  };
}

/** Una classe che si scosta, in una riga: attesa, letta, scarto. */
export function rigaClasse(c) {
  return `Classe ${c.classe}: attesa ${kgOppure(c.atteso)}, letta ${kgOppure(c.letto)}, scarto ${kgSegno(c.scarto)}.`;
}

/** Da dove viene l'attesa: la rilevazione prima, piu' gli ingressi meno le uscite. */
export function dettaglioClasse(c, precedenteDel) {
  const ing = `${c.ingressi} ${c.ingressi === 1 ? 'ingresso' : 'ingressi'} per ${formatKg(c.ingressi_kg)} kg`;
  const usc = `${c.uscite} ${c.uscite === 1 ? 'uscita' : 'uscite'} per ${formatKg(c.uscite_kg)} kg`;
  return `Il ${giorno(precedenteDel)} erano ${kgOppure(c.precedente_kg)}; nel periodo ${ing} e ${usc}.`;
}

/**
 * Un ordine che puo' spiegare lo scarto. La chiusura a portale si scrive perche'
 * racconta il caso tipico - finito prima della lettura, chiuso dopo - ma non
 * colloca niente: il periodo di un movimento e' sempre la fine del trasporto.
 */
export function rigaCandidato(m) {
  const parti = [m.id_ordine || '(senza id ordine)'];
  if (m.numero_fir) parti.push(`FIR ${m.numero_fir}`);
  if (m.controparte) parti.push(m.verso === 'uscita' ? `verso ${m.controparte}` : `da ${m.controparte}`);
  parti.push(`classe ${m.classe}`);
  parti.push(`${formatKg(m.kg)} kg`);
  parti.push(`finito il ${giorno(m.finito_il)}`);
  if (m.chiuso_il) parti.push(`chiuso a portale il ${giorno(m.chiuso_il)}`);
  return `${parti.join(' · ')} — ${m.perche}`;
}

/** L'esito in poche parole, per la riga dell'elenco delle unita' locali. */
export function esitoBreve(v) {
  const r = riassuntoVerifica(v);
  if (!r) return null;
  if (r.stato === 'quadra') return { stato: 'quadra', testo: 'quadra' };
  if (r.stato === 'senza_precedente') return { stato: 'senza_precedente', testo: 'prima rilevazione' };
  return { stato: 'scosta', testo: r.scostano.map(c => `${c.classe} ${kgSegno(c.scarto)}`).join(' · ') };
}

const STILE = {
  quadra: { box: 'bg-emerald-50 border-emerald-300 text-emerald-900', Icona: CheckCircle2 },
  senza_precedente: { box: 'bg-muted/50 border-border text-foreground', Icona: Info },
  scosta: { box: 'bg-amber-50 border-amber-300 text-amber-900', Icona: AlertTriangle },
};

/** Il badge dell'esito, da mettere sulla riga dell'unita' locale. */
export function EsitoRilevazione({ verifica, onApri }) {
  const e = esitoBreve(verifica);
  if (!e) return <span className="text-muted-foreground text-xs">—</span>;
  const colore = e.stato === 'scosta' ? 'text-amber-700 border-amber-300 bg-amber-50'
    : e.stato === 'quadra' ? 'text-emerald-700 border-emerald-300 bg-emerald-50'
      : 'text-muted-foreground border-border bg-muted/40';
  return (
    <button
      type="button"
      onClick={onApri}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${colore} hover:opacity-80`}
      title="Apri il confronto fra la rilevazione e quello che i movimenti dicono"
    >
      {e.stato === 'scosta' && <AlertTriangle className="w-3 h-3 shrink-0" />}
      {e.testo}
    </button>
  );
}

export default function ControlloRilevazione({ open, onClose, sito, verifica }) {
  const r = riassuntoVerifica(verifica);
  if (!r) return null;
  const { box, Icona } = STILE[r.stato];
  const classi = verifica.classi || [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Controllo della rilevazione — {sito}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto text-sm">
          <div className={`border rounded-md p-3 ${box}`}>
            <div className="flex items-center gap-2 font-semibold">
              <Icona className="w-4 h-4 shrink-0" /> {r.titolo}
            </div>
            <p className="mt-1 text-xs">{r.sintesi}</p>
          </div>

          {!verifica.senza_precedente && (
            <div className="border rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-2 py-1.5 font-semibold">Classe</th>
                      <th className="px-2 py-1.5 font-semibold">Canale</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Il {giorno(verifica.precedente_del)}</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Ingressi</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Uscite</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Attesa</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Letta</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Scarto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classi.map(c => (
                      <tr key={`${c.canale}|${c.classe}`} className={`border-t ${c.scarto ? 'bg-amber-50' : ''}`}>
                        <td className="px-2 py-1.5 font-medium">{c.classe}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{c.canale === 'ACI' ? 'ACI' : 'rete'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{kgOppure(c.precedente_kg)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{c.ingressi ? `${c.ingressi} · ${formatKg(c.ingressi_kg)} kg` : '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{c.uscite ? `${c.uscite} · ${formatKg(c.uscite_kg)} kg` : '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{kgOppure(c.atteso)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{kgOppure(c.letto)}</td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${c.scarto ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}>
                          {c.scarto ? kgSegno(c.scarto) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-2 py-1.5 text-[11px] text-muted-foreground italic">
                I canali non si sommano: le classi P, M, G1 e G2 sono la rete, la classe 9 e&apos; l&apos;ACI. Un movimento conta dalla fine del trasporto; il periodo va dal giorno dopo la rilevazione precedente a quello della nuova, compreso.
              </p>
            </div>
          )}

          {r.scostano.map(c => (
            <div key={`dett|${c.canale}|${c.classe}`} className="border rounded-md p-3 space-y-1">
              <div className="font-medium">{rigaClasse(c)}</div>
              <div className="text-xs text-muted-foreground">{dettaglioClasse(c, verifica.precedente_del)}</div>
              <div className="text-xs">{c.nota}</div>
              {c.candidati.length > 0 && (
                <div className="pt-1 space-y-0.5">
                  <div className="text-xs text-muted-foreground">Ordini che possono spiegarlo:</div>
                  {c.candidati.map((m, i) => (
                    <div key={i} className={`text-xs ${m.peso_esatto ? 'font-medium' : 'text-muted-foreground'}`}>· {rigaCandidato(m)}</div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <p className="text-xs text-muted-foreground italic">
            La rilevazione e&apos; salvata: quello che il portale mostra e&apos; un fatto e va tenuto, il controllo serve solo a dire dove guardare. Ed e&apos; il punto di partenza dei calcoli, perche&apos; i movimenti si sommano da li&apos;: una rilevazione sbagliata non si corregge ricaricando i file, si corregge rileggendo la pagina Unita&apos; Locali di Stoccaggio del portale e inserendone una nuova.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
