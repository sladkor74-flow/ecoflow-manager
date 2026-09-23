import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { formatKg, formatTonnellate, formatIntero } from '@/lib/utils';
import { giorno, kgSegno, rigaClasse, rigaCandidato } from '@/components/giacenze/ControlloRilevazione';
import { riassuntoArchivio } from '@/components/giacenze/SituazioneTable';

// La riconciliazione permanente del piazzale (richiesta dell'utente,
// 23/09/2026): il lavoro fatto a mano su Nappi Sud il 22 e il 23 settembre,
// rifatto dal gestionale a ogni caricamento e per ogni piazzale.
//
// Quattro cose, un canale per volta - rete e ACI non si sommano mai:
// 1. da dove viene la giacenza di adesso, letta come un estratto conto:
//    la fotografia del portale, piu' gli ingressi e meno le uscite finiti dopo,
//    classe per classe, fino al numero che la pagina mostra;
// 2. lo storico delle letture, ognuna col suo verdetto: prima si vedeva solo
//    l'ultima contro la precedente, e una lettura sbagliata piu' indietro nel
//    tempo non si ripescava piu';
// 3. com'e' adesso: se l'ultima lettura tornava, e se no di quanto, se il
//    totale del canale torna (il materiale c'e', sta nella classe sbagliata)
//    oppure no (materiale che manca davvero), con i candidati a spiegarlo;
// 4. quando conviene rileggere il portale.
//
// I conti li fa calcolaGiacenze (riconciliazionePiazzale in
// base44/shared/giacenzaStoccaggi.ts): qui si mostrano e basta. Le frasi che
// spiegano lo scarto e i candidati arrivano da li' e da ControlloRilevazione,
// perche' la stessa cosa si deve leggere con le stesse parole.

/** Kg interi, o un trattino: senza fotografia il numero di adesso non esiste. */
const kg = (n) => (n === null || n === undefined ? '—' : `${formatKg(n)} kg`);

/** I canali che il portale rileva, nell'ordine in cui si guardano. Mai un totale insieme. */
const CANALI = [
  { chiave: 'RETE', titolo: 'Rete', classi: 'classi P, M, G1 e G2' },
  { chiave: 'ACI', titolo: 'ACI', classi: 'classe 9' },
];

const STILE = {
  quadra: { box: 'bg-emerald-50 border-emerald-300 text-emerald-900', Icona: CheckCircle2 },
  scosta: { box: 'bg-amber-50 border-amber-300 text-amber-900', Icona: AlertTriangle },
  senza_lettura: { box: 'bg-amber-50 border-amber-300 text-amber-900', Icona: AlertTriangle },
  senza_precedente: { box: 'bg-muted/50 border-border text-foreground', Icona: Info },
  fuori_portale: { box: 'bg-muted/50 border-border text-foreground', Icona: Info },
};

/** L'esito della riconciliazione in due parole, per la riga di un elenco. */
export function esitoBreveRiconciliazione(riconciliazione) {
  const r = riconciliazione;
  if (!r) return null;
  if (r.senza_rilevazione) return { stato: 'senza_lettura', testo: 'nessuna lettura del portale' };
  // Prima si dice se qualcosa non torna, poi se conviene rileggere: un piazzale
  // che non quadra e' piu' urgente di uno con la fotografia vecchia.
  const scosta = CANALI.filter(c => r.canali[c.chiave] && r.canali[c.chiave].stato.esito === 'scosta');
  if (scosta.length) {
    return {
      stato: 'scosta',
      testo: scosta.map(c => `${c.titolo}: ${r.canali[c.chiave].stato.classi_che_scostano.join(', ')}`).join(' · '),
    };
  }
  const rileggere = CANALI.filter(c => r.canali[c.chiave] && r.canali[c.chiave].rileggere.conviene);
  if (rileggere.length) return { stato: 'rileggere', testo: 'conviene rileggere il portale' };
  return { stato: 'quadra', testo: 'quadra' };
}

/** Il badge da mettere sulla riga del piazzale: apre la riconciliazione. */
export function EsitoRiconciliazione({ riconciliazione, onApri }) {
  const e = esitoBreveRiconciliazione(riconciliazione);
  if (!e) return <span className="text-muted-foreground text-xs">—</span>;
  const colore = e.stato === 'quadra' ? 'text-emerald-700 border-emerald-300 bg-emerald-50'
    : e.stato === 'rileggere' ? 'text-muted-foreground border-border bg-muted/40'
      : 'text-amber-700 border-amber-300 bg-amber-50';
  return (
    <button
      type="button"
      onClick={onApri}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${colore} hover:opacity-80`}
      title="Apri la riconciliazione del piazzale: da dove viene la giacenza, lo storico delle letture, che cosa non torna"
    >
      {e.stato === 'scosta' && <AlertTriangle className="w-3 h-3 shrink-0" />}
      {e.stato === 'rileggere' && <RefreshCw className="w-3 h-3 shrink-0" />}
      {e.testo}
    </button>
  );
}

// 1. L'estratto conto: dalla fotografia al numero che la pagina mostra.
function Estratto({ canale }) {
  const e = canale.estratto;
  const intestazioneFoto = canale.fotografia
    ? `Fotografia del ${giorno(canale.fotografia.del)}`
    : 'Fotografia';
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-2 py-1.5 font-semibold">Classe</th>
              <th className="px-2 py-1.5 font-semibold text-right">{intestazioneFoto}</th>
              <th className="px-2 py-1.5 font-semibold text-right">Ingressi dopo</th>
              <th className="px-2 py-1.5 font-semibold text-right">Uscite dopo</th>
              <th className="px-2 py-1.5 font-semibold text-right">Adesso</th>
            </tr>
          </thead>
          <tbody>
            {e.classi.map(c => (
              <tr key={c.classe} className="border-t">
                <td className="px-2 py-1.5 font-medium">{c.classe}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{kg(c.fotografia_kg)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{c.ingressi ? `+${formatKg(c.ingressi_kg)} kg · ${formatIntero(c.ingressi)}` : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{c.uscite ? `−${formatKg(c.uscite_kg)} kg · ${formatIntero(c.uscite)}` : '—'}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${c.adesso_kg !== null && c.adesso_kg < 0 ? 'text-amber-700' : ''}`}>
                  {c.adesso_kg !== null && c.adesso_kg < 0 && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                  {kg(c.adesso_kg)}
                </td>
              </tr>
            ))}
            {e.classi.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-3 text-center text-muted-foreground">Nessuna classe e nessun movimento su questo canale.</td></tr>
            )}
          </tbody>
          {e.classi.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-2 py-1.5">Totale</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{kg(e.fotografia_kg)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{e.ingressi ? `+${formatKg(e.ingressi_kg)} kg · ${formatIntero(e.ingressi)}` : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{e.uscite ? `−${formatKg(e.uscite_kg)} kg · ${formatIntero(e.uscite)}` : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {kg(e.adesso_kg)}{e.adesso_kg !== null ? ` · ${formatTonnellate(e.adesso_kg / 1000)} t` : ''}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="px-2 py-1.5 text-[11px] text-muted-foreground italic">
        {canale.fotografia
          ? `Il saldo che il portale mostrava il ${giorno(canale.fotografia.del)}, piu' gli ingressi e meno le uscite finiti dopo, per fine trasporto: contano dal giorno successivo alla lettura. E' il numero che la pagina mostra.`
          : "Senza una lettura del portale non c'e' un punto di partenza: i movimenti si contano lo stesso, ma la loro somma non e' una giacenza."}
      </p>
    </div>
  );
}

// 2. Lo storico delle letture: ognuna col suo verdetto, anche quelle vecchie.
function Letture({ canale }) {
  if (!canale.letture.length) return null;
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr className="text-left">
              <th className="px-2 py-1.5 font-semibold">Lettura</th>
              <th className="px-2 py-1.5 font-semibold text-right">Letto</th>
              <th className="px-2 py-1.5 font-semibold">Verdetto</th>
              <th className="px-2 py-1.5 font-semibold text-right">Scarto</th>
            </tr>
          </thead>
          <tbody>
            {canale.letture.map(l => (
              <React.Fragment key={l.del}>
                <tr className={`border-t ${l.quadra === false ? 'bg-amber-50' : ''}`}>
                  <td className="px-2 py-1.5">
                    {giorno(l.del)}
                    {l.ultima && <span className="ml-1 text-[10px] text-muted-foreground">(ultima)</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatKg(l.letto_kg)} kg</td>
                  <td className="px-2 py-1.5">
                    {l.senza_precedente
                      ? <span className="text-muted-foreground">prima lettura: niente da confrontare</span>
                      : l.quadra
                        ? <span className="text-emerald-700">tornava</span>
                        : l.ripartizione_sbagliata
                          ? <span className="text-amber-700">il totale tornava, la ripartizione no</span>
                          : <span className="text-amber-700">non tornava</span>}
                    {!l.senza_precedente && (
                      <span className="text-muted-foreground"> · contro il {giorno(l.precedente_del)}, {formatIntero(l.movimenti)} movimenti nel periodo</span>
                    )}
                  </td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${l.quadra === false ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}>
                    {l.quadra === false ? kgSegno(l.scarto_kg) : '—'}
                  </td>
                </tr>
                {l.classi.map(c => (
                  <tr key={`${l.del}|${c.classe}`} className="bg-amber-50/50">
                    <td />
                    <td colSpan={3} className="px-2 pb-1.5 text-[11px] text-amber-900">{rigaClasse(c)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-2 py-1.5 text-[11px] text-muted-foreground italic">
        Ogni lettura a confronto con quella prima di lei, piu&apos; i movimenti fra le due date: anche le piu&apos; vecchie, perche&apos; una lettura sbagliata resta il punto di partenza di tutto quello che viene dopo.
      </p>
    </div>
  );
}

// 3. Com'e' adesso: il verdetto dell'ultima lettura, e chi puo' spiegarlo.
function Stato({ canale }) {
  const s = canale.stato;
  const { box, Icona } = STILE[s.esito] || STILE.senza_precedente;
  return (
    <div className={`border rounded-md p-3 space-y-2 ${box}`}>
      <div className="flex items-start gap-2 text-xs">
        <Icona className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{s.perche}</span>
      </div>
      {s.classi.filter(c => c.scarto).map(c => (
        <div key={c.classe} className="bg-card/70 border rounded-md p-2 space-y-1 text-foreground">
          <div className="text-xs font-medium">{rigaClasse(c)}</div>
          {c.nota && <div className="text-[11px]">{c.nota}</div>}
          {c.candidati.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[11px] text-muted-foreground">Ordini che possono spiegarlo:</div>
              {c.candidati.map((mov, i) => (
                <div key={i} className={`text-[11px] ${mov.peso_esatto ? 'font-medium' : 'text-muted-foreground'}`}>· {rigaCandidato(mov)}</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 4. Quando conviene rileggere il portale, con parole semplici.
function Rileggere({ canale }) {
  const r = canale.rileggere;
  if (!r.conviene) {
    return (
      <p className="text-[11px] text-muted-foreground italic">
        {r.perche.length ? r.perche[0] : `Non serve rileggere: la lettura ha ${formatIntero(r.giorni || 0)} giorni e il piazzale torna.`}
      </p>
    );
  }
  return (
    <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-md p-3 space-y-1">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <RefreshCw className="w-4 h-4 shrink-0" /> Conviene rileggere il portale
      </div>
      {r.perche.map((p, i) => <div key={i} className="text-[11px]">· {p}</div>)}
      <div className="text-[11px] pt-1">
        La lettura si rifa&apos; dalla pagina Unita&apos; Locali di Stoccaggio del portale e si registra qui: e&apos; il punto di partenza dei calcoli, e ricaricare i file non la corregge.
      </div>
    </div>
  );
}

// La somma dei soli movimenti in archivio, accanto e non al posto della
// giacenza: vale dal primo movimento caricato, non da quando il piazzale era vuoto.
function Archivio({ canale }) {
  const a = riassuntoArchivio({ [canale.canale]: canale.archivio }, canale.canale);
  if (!a) return null;
  return (
    <p className="text-[11px] text-muted-foreground">
      Per confronto, {a.riga} — {a.dettaglio} {a.avvertenza}
      {a.senza_fine > 0 && ` ${formatIntero(a.senza_fine)} movimenti restano fuori perche' non hanno la fine trasporto.`}
    </p>
  );
}

function Canale({ titolo, classi, canale }) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold text-sm">
        {titolo} <span className="font-normal text-muted-foreground text-xs">({classi})</span>
      </h3>
      <Stato canale={canale} />
      <Estratto canale={canale} />
      <Letture canale={canale} />
      <Rileggere canale={canale} />
      <Archivio canale={canale} />
    </section>
  );
}

export default function Riconciliazione({ sito, riconciliazione }) {
  const r = riconciliazione;
  if (!r) return null;
  const extra = r.canali.EXTRA_RACCOLTA;
  const haExtra = extra && extra.estratto.classi.length > 0;
  return (
    <div className="space-y-4 text-sm">
      <div className="text-xs text-muted-foreground">
        {r.senza_rilevazione
          ? `${sito}: nessuna lettura del portale. Sotto ci sono i ${formatIntero(r.movimenti)} movimenti in archivio, che una giacenza non sono.`
          : `${sito}: ultima lettura del portale del ${giorno(r.ultima_del)}${r.giorni_dalla_lettura !== null ? `, ${formatIntero(r.giorni_dalla_lettura)} giorni fa` : ''} · ${formatIntero(r.rilevazioni)} letture in archivio · ${formatIntero(r.movimenti)} movimenti.`}
      </div>

      {CANALI.map(c => (
        <Canale key={c.chiave} titolo={c.titolo} classi={c.classi} canale={r.canali[c.chiave]} />
      ))}

      {haExtra && (
        <section className="space-y-2">
          <h3 className="font-semibold text-sm">
            Extra raccolta <span className="font-normal text-muted-foreground text-xs">(fuori portale)</span>
          </h3>
          <div className="border rounded-md p-3 text-xs text-muted-foreground space-y-1">
            <div>{extra.stato.perche}</div>
            <div>
              In archivio: {formatIntero(extra.estratto.ingressi)} ingressi per {formatKg(extra.estratto.ingressi_kg)} kg,
              {' '}{formatIntero(extra.estratto.uscite)} uscite per {formatKg(extra.estratto.uscite_kg)} kg.
            </div>
            <Archivio canale={extra} />
          </div>
        </section>
      )}

      <p className="text-[11px] text-muted-foreground italic">
        Rete, ACI ed extra raccolta non si sommano mai: ogni canale ha la sua fotografia, il suo estratto conto e il suo verdetto. Un movimento conta dal giorno in cui finisce il trasporto; la chiusura a portale si mostra soltanto, perche&apos; il portale chiude gli ordini giorni dopo.
      </p>
    </div>
  );
}

/** La stessa riconciliazione dentro una finestra, per chi la apre da un elenco. */
export function RiconciliazioneDialog({ open, onClose, sito, riconciliazione }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Riconciliazione del piazzale — {sito}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <Riconciliazione sito={sito} riconciliazione={riconciliazione} />
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
