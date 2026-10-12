import React from 'react';
import { DatabaseZap, CheckCircle2 } from 'lucide-react';
import Perche from '@/components/shared/Perche';
import Sezione, { Tabella, SegnoDaGestire } from '@/components/dashboard/Sezione';
import { giorno, intero } from '@/components/dashboard/formato';
import { FILTRO_CONTROLLI } from '@/components/dashboard/vociDashboard';

// A QUANDO SONO AGGIORNATI I DATI (migliorie dell'11/10/2026: il riquadro di
// prima, col perche' del «dati fino al» al tocco invece che in title=, che sul
// telefono non si vede). Due date per file (chiusura dell'audit, 11/10/2026): il
// giorno del caricamento non dice fino a dove arrivano i dati, e un file
// caricato il 9 puo' fermarsi al 6. Sotto, i controlli automatici della notte:
// tutti regolari, o quante voci sono da guardare in Da gestire.
//
// I CONTROLLI AUTOMATICI DICONO QUELLO CHE DICE DA GESTIRE (revisione delle
// migliorie, 11/10/2026). Il conto e' quello di riassuntoControlli
// (vociDashboard.js): i presidi e il guardiano fermo, che prima mancava e faceva
// scrivere «tutti regolari» accanto a «non gira da 4 giorni». Il segno porta al
// filtro dei controlli, non alla sezione «dati»: un'identita' rotta sta negli
// impianti, e filtrata sui dati spariva. Le voci si chiamano col loro nome
// («identità fra moduli rotta», «lavoro pianificato che non riesce»), non tutte
// «lavori». «Tutti regolari» solo quando si sa: non mentre il cruscotto e' in
// lettura, e non se il controllo della notte non ha mai scritto.

// Il nome dell'archivio arriva dalla funzione (nomeArchivio): questo resta per
// una risposta di prima.
const NOMI_FILE = { primarie: 'Primarie e assegnati', secondarie: 'Secondarie', terziarie: 'Terziarie', ordini_non_dichiarati: 'Ordini non dichiarati', dichiarazioni_trattamento: 'Dichiarazioni di trattamento', pdr: 'Punti di raccolta' };
// Lo stato di un archivio che un caricamento rende inaffidabile (avvisoCaricamento).
const STATI_ARCHIVIO = {
  non_riuscito: { testo: 'non riuscito: ricarica', classe: 'text-red-700 font-medium' },
  interrotto: { testo: 'interrotto: ricarica', classe: 'text-red-700 font-medium' },
  in_corso: { testo: 'in caricamento', classe: 'text-blue-700 font-medium' },
};

/**
 * L'ultima colonna: lo stato, se c'e'; altrimenti quanto e' vecchio. Un archivio
 * e' vecchio quando il caricamento ha piu' di dieci giorni, oppure, per primarie
 * e non dichiarati, quando dentro il file i dati si fermano piu' di tre
 * settimane prima del caricamento (freschezzaArchivi, cruscotto.ts).
 */
export function etaArchivio(a) {
  if (a.stato && STATI_ARCHIVIO[a.stato]) return STATI_ARCHIVIO[a.stato];
  if (a.il === null) return { testo: 'mai caricato', classe: 'text-amber-800 font-medium' };
  if (a.vecchio) return { testo: `fermo da ${a.eta_giorni} giorni`, classe: 'text-amber-800 font-medium' };
  return { testo: a.giorni_fa === 0 ? 'caricato oggi' : a.giorni_fa === 1 ? 'caricato ieri' : `caricato ${a.giorni_fa} giorni fa`, classe: 'text-muted-foreground' };
}

/** La riga dei controlli automatici, a parole: { testo, critica } o null se e' tutto regolare. */
export function testoControlli(controlli) {
  if (!controlli || !controlli.quante) return null;
  const parti = [];
  if (controlli.identita) parti.push(`${intero(controlli.identita)} ${controlli.identita === 1 ? 'identità fra moduli rotta' : 'identità fra moduli rotte'}`);
  if (controlli.lavori) parti.push(`${intero(controlli.lavori)} ${controlli.lavori === 1 ? 'lavoro pianificato che non riesce' : 'lavori pianificati che non riescono'}`);
  return { testo: parti.join(' · '), critica: controlli.critiche > 0 };
}

export default function FreschezzaDati({ caricamenti, controlli = null, notteAssente = false, daGestire, onDaGestire }) {
  const archivi = (caricamenti && caricamenti.archivi) || [];
  const riga = testoControlli(controlli);
  return (
    <Sezione
      id="dati" icona={DatabaseZap}
      titolo="A quando sono aggiornati i dati"
      sottotitolo="Per ogni file, il giorno del caricamento e l'ultimo giorno che c'è dentro."
      perche={(
        <>
          <p>«Dati fino al» è l&apos;ultimo giorno che c&apos;è dentro il file: la fine trasporto dei terminati, il giorno della fotografia del portale, l&apos;ultima dichiarazione SMOCO.</p>
          <p>Terziarie, secondarie e dichiarazioni non arrivano tutti i giorni: per loro una data lontana non vuol dire un file vecchio. Le primarie sì, ma con i buchi di Natale e Ferragosto: il file si dà per vecchio solo se i dati si fermano più di tre settimane prima del caricamento.</p>
        </>
      )}
      collegamenti={[{ a: '/caricamento-dati', testo: 'Caricamento Dati' }]}
      daGestire={daGestire} onDaGestire={onDaGestire}
    >
      {!archivi.length ? <p className="text-sm text-muted-foreground">Il registro dei caricamenti non si è potuto leggere.</p> : (
        <Tabella className="border rounded-md">
          <thead className="bg-muted/40"><tr className="text-left text-xs text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">File</th>
            <th className="px-2 py-1.5 font-medium text-right">Caricato il</th>
            <th className="px-2 py-1.5 font-medium text-right">Dati fino al</th>
            <th className="px-2 py-1.5 font-medium text-right">Stato</th>
          </tr></thead>
          <tbody>
            {archivi.map(a => {
              const eta = etaArchivio(a);
              const spiegazione = a.fino_al ? a.fino_al_cosa : a.fino_al_perche;
              return (
                <tr key={a.tipo_file} className="border-t">
                  <td className="px-2 py-1.5">{a.nome || NOMI_FILE[a.tipo_file] || a.tipo_file}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{giorno(a.il)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 justify-end">
                      {giorno(a.fino_al)}
                      {spiegazione && <Perche allinea="end" etichetta="Che cosa dice questa data"><p>{spiegazione}</p></Perche>}
                    </span>
                  </td>
                  <td className={`px-2 py-1.5 text-right text-xs whitespace-nowrap ${eta.classe}`}>{eta.testo}</td>
                </tr>
              );
            })}
          </tbody>
        </Tabella>
      )}
      <div className="mt-3 flex items-center gap-2 flex-wrap text-sm">
        <span className="font-medium">Controlli automatici:</span>
        {!controlli ? (
          <span className="text-muted-foreground">—</span>
        ) : riga ? (
          <>
            <span className={riga.critica ? 'text-red-700 font-medium' : ''}>{riga.testo}</span>
            <SegnoDaGestire quante={controlli.quante} onApri={() => onDaGestire && onDaGestire(FILTRO_CONTROLLI)} />
          </>
        ) : notteAssente ? (
          <span className="text-muted-foreground">nessun esito: il controllo della notte non ha ancora scritto niente</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-4 h-4" aria-hidden="true" /> tutti regolari</span>
        )}
      </div>
    </Sezione>
  );
}
