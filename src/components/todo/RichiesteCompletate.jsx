import React from 'react';
import { CheckSquare, Square, Loader2 } from 'lucide-react';
import SezioneCompletati from '@/components/todo/SezioneCompletati';
import { completamentoRichiesta, testoCompletamentoRichiesta, gg } from '@/lib/todoSezioni';
import { listaOrdini, annoRichiesta, testoTermine } from '@/lib/richiesteEct';
import { oggiRoma } from '@/lib/giornoItaliano';
import NoteRichiesta from '@/components/todo/NoteRichiesta';

// LE RICHIESTE ECT COMPLETATE (richiesta dell'utente del 12/10/2026). Una
// richiesta evasa - da sola, perche' i suoi ordini risultano terminati, dal
// foglio del consorzio o con la spunta - o annullata esce dalla tabella delle
// richieste da ritirare e sta qui, coi ritiri piu' recenti in alto, col giorno
// del ritiro (la fine trasporto, regola 1) e il perche'.
//
// Una richiesta chiusa da sola aspetta ancora la RISPOSTA al consorzio, che
// scrive per email: la spunta vuol dire «ho risposto». Quelle senza spunta si
// contano sull'intestazione, che si vede anche a sezione chiusa (e' la stessa
// voce della dashboard, «aspettano la risposta al consorzio»), e la spunta si
// mette da qui. Togliendola, una richiesta col ritiro rilevato resta qui; una
// spuntata a mano senza ritiro torna fra le da ritirare.
//
// Il termine e' quello che valeva: corretto a mano dall'amministratore, se c'e',
// e allora lo dice col termine del foglio accanto (testoTermine, 15/10/2026).
// Fra le completate non si corregge: una richiesta chiusa non ha piu' un ritiro
// da fare entro un giorno.
//
// Schede e non tabella: a 375 px una riga si legge senza scorrere di lato.
//
// `tutte` sono le completate (gia' ordinate da dividiRichieste), `righe` quelle
// da mostrare (con la ricerca in corso); `esitoDi` e' la regola della pagina.
export default function RichiesteCompletate({ tutte = [], righe = tutte, esitoDi = (r) => r.esito, isAdmin = false, occupato = null, onSpunta = () => {} }) {
  // UNA RICHIESTA DELL'ANNO PRIMA LO DICE (chiusura della prova generale del
  // cambio d'anno, 15/10/2026). Da gennaio fra le completate restano anche le
  // richieste di dicembre chiuse nell'anno nuovo (richiesteDellaTodo): come nella
  // tabella delle da fare, la scheda scrive «richiesta del 2026». L'anno e'
  // quello salvato, o quello della mail; oggi e' il giorno italiano.
  const annoOggi = Number(oggiRoma().slice(0, 4));
  const annoDi = (r) => Number(r && r.anno) || annoRichiesta(r);
  const daRispondere = tutte.filter(r => (completamentoRichiesta(r, esitoDi(r)) || {}).da_rispondere).length;
  const nota = daRispondere
    ? `${daRispondere === 1 ? 'una aspetta' : `${daRispondere} aspettano`} la risposta al consorzio e la spunta`
    : '';
  return (
    <SezioneCompletati
      titolo="Completate"
      numero={righe.length}
      di={tutte.length}
      nota={nota}
      vuota={tutte.length
        ? 'Nessuna richiesta completata con questa ricerca.'
        : 'Ancora nessuna richiesta completata: quando una si chiude, da sola o con la spunta, esce dalla tabella qui sopra e la trovi qui.'}
    >
      {righe.map((r) => {
        const esito = esitoDi(r);
        const c = completamentoRichiesta(r, esito);
        const ids = listaOrdini(r);
        const dove = [r.provincia, r.classe ? `classe ${r.classe}` : ''].filter(Boolean).join(' · ');
        return (
          <div key={r.id} className="border rounded-lg p-3 text-sm space-y-1 bg-muted/20" data-completata={r.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium break-words">{r.pdr_nome}</p>
                {(dove || ids.length > 0) && (
                  <p className="text-xs text-muted-foreground break-words">
                    {dove}{dove && ids.length ? ' · ' : ''}{ids.length > 0 && <span className="font-mono break-all">{ids.join(', ')}</span>}
                  </p>
                )}
              </div>
              {isAdmin && esito !== 'annullata' && (
                <button
                  onClick={() => onSpunta(r)}
                  disabled={occupato === r.id}
                  aria-label={r.evasione_confermata ? 'Togli la spunta' : 'Spunta: hai risposto al consorzio'}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-muted whitespace-nowrap shrink-0"
                >
                  {occupato === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : r.evasione_confermata ? <CheckSquare className="w-3.5 h-3.5 text-emerald-700" /> : <Square className="w-3.5 h-3.5" />}
                  {r.evasione_confermata ? 'spuntata' : 'spunta'}
                </button>
              )}
            </div>
            <p className={`text-xs ${c && c.come === 'annullata' ? 'text-muted-foreground' : 'text-green-700'}`}>{testoCompletamentoRichiesta(c)}</p>
            {c && c.da_rispondere && (
              <p className="text-xs text-amber-800">Da rispondere al consorzio con la data del ritiro: la spunta la metti quando hai risposto.</p>
            )}
            {c && !c.da_rispondere && c.come !== 'a_mano' && c.come !== 'annullata' && r.evasione_confermata_il && (
              <p className="text-xs text-muted-foreground">Spuntata il {gg(r.evasione_confermata_il)}.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Mail del {gg(r.mail_inviata_il) || '—'}{testoTermine(r) ? `, ${testoTermine(r)}` : ''}{r.trasportatore ? ` · ${r.trasportatore}` : ''}
            </p>
            {annoDi(r) && annoDi(r) !== annoOggi && <p className="text-[11px] text-amber-800">richiesta del {annoDi(r)}</p>}
            {r.nota && <p className="text-[11px] text-muted-foreground break-words">{r.nota}</p>}
            {/* La nota interna e le annotazioni restano, da leggere (15/10/2026). */}
            <NoteRichiesta richiesta={r} />
          </div>
        );
      })}
    </SezioneCompletati>
  );
}
