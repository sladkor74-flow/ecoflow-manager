import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, ShieldCheck } from 'lucide-react';
import { formatIntero } from '@/lib/utils';
import { avvisiDaMostrare, testoEseguiti, titoloAvviso, avvisoRosso, archiviSenzaConteggio, archiviConFraseLoro, riparazioniDaDire, dettaglioRiparazione } from '@/lib/importGrandeFile';

// Come si chiamano le righe dello storico conservato. Si conservano i terminati
// E gli ordini in stato "eseguito" (base44/shared/storicoConservato.ts, regola
// dell'utente del 28/09/2026): chiamarle tutte "di ordini terminati" sarebbe
// falso. Il caricamento delle primarie dice anche quanti sono gli eseguiti, e
// allora si e' precisi; il percorso delle secondarie e delle terziarie quel
// numero non lo manda, e allora si dice la cosa che e' vera in tutti i casi
// invece di affermare un numero che non si ha.
const ordiniDelloStorico = (storico) => {
  if (!storico || !storico.eseguiti) return 'terminati o in stato «eseguito»';
  return storico.eseguiti.righe > 0 ? 'terminati o eseguiti' : 'terminati';
};

// Estrae le informazioni di errore dalla risposta SDK (per HTTP 400/409/500).
// Il client mette stato e dati della risposta sull'errore; le versioni precedenti
// li tenevano in response.
export function extractUploadError(e) {
  const status = e?.status ?? e?.response?.status;
  const data = e?.data || e?.response?.data || {};
  return {
    type: 'error',
    status,
    error: data.error || e?.message || 'Errore sconosciuto',
    dettaglio: data.dettaglio,
    fase: data.fase,
    // Solo il backend sa se l'errore e' arrivato prima o dopo lo svuotamento
    // dell'archivio: senza una conferma esplicita non si rassicura l'utente.
    // I rifiuti del file (400) e i blocchi anti-regressione (409) arrivano sempre
    // prima di qualsiasi scrittura, salvo diversa indicazione del backend.
    dati_intatti: data.dati_intatti === true || (data.dati_intatti === undefined && (status === 400 || status === 409)),
    tipo_rilevato: data.tipo_rilevato,
    fogli_trovati: data.fogli_trovati,
    esempi_mancanti: data.esempi_mancanti,
    richiede_conferma: data.richiede_conferma,
    righe_file: data.righe_file,
    righe_archivio: data.righe_archivio,
    mancanti: data.mancanti,
    // Quale controllo sta chiedendo la conferma: confermarne uno non deve
    // spegnere l'altro (vedi conferme in importaBlocco/entry.ts).
    conferma: data.conferma,
    // Un collega che sta caricando adesso non ha niente da forzare.
    caricamento_in_corso: data.caricamento_in_corso,
  };
}

// Gli avvisi non bloccanti di una risposta riuscita. La regola di quali siano
// sta in src/lib/importGrandeFile.js (avvisiDaMostrare), dove la controllano le
// prove: qui si mostrano e basta.
export const extractUploadWarnings = avvisiDaMostrare;

// Dialog modale per risultati di caricamento (errore bloccante o avviso non bloccante)
// state: null | { type: 'error'|'warning', ... }
// state.onForza: callback opzionale per "Forza caricamento" (solo error con richiede_conferma)
export default function UploadResultDialog({ state, onClose }) {
  const [confirmingForza, setConfirmingForza] = useState(false);
  if (!state) return null;

  const isError = state.type === 'error';
  // Il titolo e il colore sono una regola, non grafica: stanno in
  // src/lib/importGrandeFile.js (titoloAvviso, avvisoRosso), dove le prove li
  // controllano. Un collega che sta caricando adesso non e' un rischio di
  // perdita dati: non c'e' niente da forzare e niente da temere, si aspetta.
  const title = titoloAvviso(state);
  const rosso = avvisoRosso(state);
  const titleColor = rosso ? 'text-red-700' : 'text-amber-700';
  const Icon = rosso ? AlertTriangle : AlertCircle;
  const iconColor = rosso ? 'text-red-600' : 'text-amber-600';

  const handleForza = () => {
    setConfirmingForza(false);
    onClose();
    if (state.onForza) state.onForza();
  };

  return (
    <Dialog open={!!state} onOpenChange={(open) => { if (!open) { setConfirmingForza(false); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${titleColor}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {isError && state.error && (
            <p className="font-medium text-foreground">{state.error}</p>
          )}

          {state.tipo_rilevato && (
            <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 font-medium">
              {state.tipo_rilevato}
            </div>
          )}

          {state.dettaglio && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Dettaglio</p>
              <p className="text-foreground">{state.dettaglio}</p>
            </div>
          )}

          {state.righe_archivio != null && state.mancanti != null && (
            <p className="text-foreground">
              Righe nel file: <strong>{state.righe_file != null ? formatIntero(state.righe_file) : '—'}</strong> · In archivio: <strong>{formatIntero(state.righe_archivio)}</strong> · Mancanti: <strong>{formatIntero(state.mancanti)}</strong>
            </p>
          )}

          {state.esempi_mancanti && state.esempi_mancanti.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">ID mancanti (primi 10)</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {state.esempi_mancanti.map((id, i) => (
                  <li key={i} className="font-mono text-xs text-foreground">{id}</li>
                ))}
              </ul>
            </div>
          )}

          {state.fogli_trovati && state.fogli_trovati.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Fogli rilevati nel file</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {state.fogli_trovati.map((f, i) => (
                  <li key={i} className="text-foreground">{f}</li>
                ))}
              </ul>
            </div>
          )}

          {state.avviso_colonne && state.avviso_colonne.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Colonne mancanti (non bloccanti)</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {state.avviso_colonne.map((c, i) => (
                  <li key={i} className="text-foreground">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {state.avviso_date && (
            <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
              <strong>Avviso date:</strong> ultima data nel file ({new Date(state.avviso_date.data_file).toLocaleDateString('it-IT')})
              {' '}precedente all'archivio ({new Date(state.avviso_date.data_archivio).toLocaleDateString('it-IT')}).
            </div>
          )}

          {/* Non e' un problema, e' una notizia: i terminati degli anni prima
              che il file non contiene sono rimasti in archivio come erano. Il
              testo e' quello dell'utente, parola per parola: la prima versione
              parlava dell'anno da cui comincia il file ed e' stata corretta
              apposta. */}
          {state.storico_conservato && (
            <div className="p-2.5 rounded-md bg-sky-50 border border-sky-300 text-sky-900 text-sm">
              <strong>Storico conservato:</strong> {formatIntero(state.storico_conservato.righe)} righe di ordini
              {' '}{ordiniDelloStorico(state.storico_conservato)}
              {' '}che il file non contiene sono rimaste in archivio, come erano.
              {' '}Il portale filtra l&apos;export per data di immissione; per i terminati conta la fine trasporto, e restano nel loro anno.
              {/* Gli ordini in stato "eseguito" si conservano come i terminati, ma
                  chiamarli terminati sarebbe falso: sono un passaggio, e vanno
                  segnalati (regola dell'utente, 28/09/2026). L'avviso sugli
                  eseguiti guarda il file, e questi nel file non ci sono: se non
                  si dicono qui non si vedono da nessuna parte. */}
              {state.storico_conservato.eseguiti && state.storico_conservato.eseguiti.righe > 0 && (
                <> Di queste, {formatIntero(state.storico_conservato.eseguiti.righe)} righe
                  {' '}su {formatIntero(state.storico_conservato.eseguiti.ordini)} {state.storico_conservato.eseguiti.ordini === 1 ? 'ordine' : 'ordini'}
                  {' '}sono in stato «eseguito»: hanno tutti i dati ma a portale non è stato premuto Chiudi, quindi non entrano in nessun conto.
                  {' '}Restano in archivio e vanno chiusi a portale: il caricamento dopo li riscrive con lo stato definitivo, se l&apos;export li contiene ancora.
                </>
              )}
            </div>
          )}

          {/* E quando invece lo storico NON torna: righe degli anni prima che
              non ci sono piu'. Il file non le contiene, quindi ricaricare lo
              stesso file non le rimette: l'unico rimedio e' l'export completo
              dal primo anno, e lo puo' fare solo chi lavora. */}
          {state.avviso_storico_non_torna && (
            <div className="p-2.5 rounded-md bg-red-50 border border-red-300 text-red-900 text-sm">
              <strong>Lo storico conservato non torna:</strong> {state.avviso_storico_non_torna.righe === 1 ? 'manca' : 'mancano'} {formatIntero(state.avviso_storico_non_torna.righe)} {state.avviso_storico_non_torna.righe === 1 ? 'riga' : 'righe'}
              {' '}su {formatIntero(state.avviso_storico_non_torna.ordini)} {state.avviso_storico_non_torna.ordini === 1 ? 'ordine' : 'ordini'} degli anni prima.
              {' '}Il file non le contiene e il gestionale non può rimetterle da solo: l&apos;unico rimedio è ricaricare il file completo dal primo anno.
            </div>
          )}

          {state.avviso_calo && (
            <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
              <strong>Avviso calo:</strong> il file contiene {state.avviso_calo.righe_attuali} righe, meno della metà del caricamento precedente ({state.avviso_calo.righe_precedenti} righe). Verifica che il file sia completo.
            </div>
          )}

          {/* Il totale che non torna. Non si ripete quando sotto c'è già il
              riquadro delle righe di troppo o di quelle mancanti, che dicono la
              stessa notizia con i nomi degli ordini: tre riquadri per una
              notizia sola non si leggono.
              Qui non si dice più «ha già provato a rimetterle a posto»: quella
              frase non poteva uscire mai — sulle primarie un totale che non
              torna produce sempre anche gli ordini di troppo o mancanti, e
              allora questo riquadro non si disegna; sull'altro percorso la
              riparazione non esiste. Quello che la riparazione ha fatto si legge
              nei riquadri qui sotto, dove è vero. */}
          {state.avviso_disallineamento && !state.avviso_doppioni && !state.avviso_mancanti && (
            <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
              <strong>Archivio non allineato al file:</strong>{' '}
              {state.avviso_disallineamento.storico > 0
                ? `il file più lo storico conservato fanno ${formatIntero(state.avviso_disallineamento.file)} righe (di cui ${formatIntero(state.avviso_disallineamento.storico)} di storico)`
                : `il file contiene ${formatIntero(state.avviso_disallineamento.file)} righe`}
              {' '}ma in archivio ne risultano {formatIntero(state.avviso_disallineamento.archivio)}.
              {' '}Ricarica lo stesso file, senza rifiltrarlo.
            </div>
          )}

          {/* CHE COSA HA FATTO LA RIPARAZIONE. La regola di chi finisce in quale
              riquadro sta in src/lib/importGrandeFile.js (riparazioniDaDire),
              dove le prove la controllano, ed è la STESSA che usa la riga sotto
              la scheda: quando i due se la calcolavano per conto proprio, della
              stessa Primarie RETE si leggeva qui «il gestionale NON HA PROVATO a
              rimettere a posto le righe» e due centimetri sotto «il gestionale ha
              provato a rimettere a posto da solo delle righe (50 riscritte)», su
              un archivio che era tornato a 450 righe su 450. */}
          {(() => {
            const r = riparazioniDaDire(state);
            const dove = (elenco) => elenco.map(dettaglioRiparazione).join(', ');
            return (
              <>
                {/* La riparazione riuscita: il campo arrivava alla finestra e
                    non lo disegnava nessuno, e la notizia si leggeva solo nella
                    riga piccola. */}
                {r.risolti.length > 0 && (
                  <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                    <strong>Il gestionale ha rimesso a posto da solo delle righe ({dove(r.risolti)}):</strong>
                    {' '}adesso {r.risolti.length === 1 ? "quell'archivio torna" : 'quegli archivi tornano'} con il file. Lì non c'è niente da rifare.
                  </div>
                )}
                {r.restati.length > 0 && (
                  <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                    <strong>Il gestionale ha provato a rimettere a posto da solo delle righe ({dove(r.restati)}):</strong>
                    {' '}ma {r.restati.length === 1 ? "quell'archivio non torna" : 'quegli archivi non tornano'} ancora con il file.
                  </div>
                )}
                {r.nonContati.length > 0 && (
                  <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                    <strong>Il gestionale ha provato a rimettere a posto da solo delle righe ({dove(r.nonContati)}):</strong>
                    {' '}ma poi non si è potuto contare {r.nonContati.length === 1 ? "quell'archivio" : 'quegli archivi'}: non si sa se adesso torni con il file.
                  </div>
                )}
                {/* Ci ha provato e non è arrivato in fondo: UNA frase sola. */}
                {r.aMeta.map((a, i) => (
                  <div key={`ameta|${a.nome}|${i}`} className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                    <strong>Il gestionale ha provato a rimettere a posto da solo delle righe ({dettaglioRiparazione(a)}):</strong>
                    {' '}ma non è arrivato in fondo: {a.motivo}.
                  </div>
                ))}
                {/* Il buco l'ha fatto il gestionale adesso, e si dice QUANTE
                    righe: fra gli ordini rimessi a posto ci sono quasi sempre
                    quelli che in archivio non avevano nessuna riga. */}
                {r.tentata.map((a, i) => (
                  <div key={`tentata|${a.nome}|${i}`} className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                    <strong>Il gestionale ha provato a rimettere a posto {a.nome} da solo:</strong>
                    {a.righe > 0
                      ? ` ha tolto ${formatIntero(a.righe)} ${a.righe === 1 ? 'riga' : 'righe'} e non è riuscito a riscriverle. Quelle le ha tolte adesso il gestionale; le altre che mancassero non erano mai entrate.`
                      : " ha chiesto di togliere delle righe e non è riuscito a riscriverle."}
                  </div>
                ))}
                {/* La cancellazione è partita e la risposta non è tornata: non si
                    dice «ho tolto» e non si dice «non ho toccato niente». E i
                    numeri si promettono solo dove ci sono. */}
                {r.incertaConNumeri.length > 0 && (
                  <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                    <strong>Il gestionale ha chiesto di togliere delle righe da {r.incertaConNumeri.join(', ')} e non ha saputo come sia andata:</strong>
                    {' '}ha ricontato l'archivio, i numeri qui sotto sono quelli di adesso.
                  </div>
                )}
                {r.incertaSenzaNumeri.length > 0 && (
                  <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                    <strong>Il gestionale ha chiesto di togliere delle righe da {r.incertaSenzaNumeri.join(', ')} e non ha saputo come sia andata:</strong>
                    {' '}ha provato a ricontare l'archivio e non ci è riuscito, quindi non si sa nemmeno quante righe ci siano adesso.
                  </div>
                )}
                {/* Non ci ha nemmeno provato, ed è un'altra cosa: chi legge deve
                    distinguere «ci ha provato e non è bastato» da «non ci ha
                    provato». Qui ci finiscono SOLO gli archivi di cui i riquadri
                    qui sopra non parlano. */}
                {r.nonFatta.length > 0 && (
                  <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                    <strong>Il gestionale non ha provato a rimettere a posto le righe da solo:</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                      {r.nonFatta.map((x, i) => (
                        <li key={`${x.nome}|${i}`}>{x.nome}: {x.motivo}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            );
          })()}

          {/* Righe entrate due volte: i loro pesi adesso si contano doppi. */}
          {state.avviso_doppioni && (
            <div className="p-2.5 rounded-md bg-red-50 border border-red-300 text-red-900 text-sm">
              <strong>In archivio ci sono {formatIntero(state.avviso_doppioni.righe_in_piu)} righe di troppo</strong>
              {state.avviso_doppioni.ordini > 0 ? ` su ${formatIntero(state.avviso_doppioni.ordini)} ordini` : ''}:
              {' '}i pesi di quelle righe vengono contati doppi{state.con_ricalcoli === false ? '' : ' e i moduli collegati non sono stati ricalcolati'}.
              {' '}Ricarica lo stesso file, senza rifiltrarlo.
            </div>
          )}

          {/* Righe che nel file ci sono e in archivio no. */}
          {state.avviso_mancanti && (
            <div className="p-2.5 rounded-md bg-red-50 border border-red-300 text-red-900 text-sm">
              <strong>In archivio mancano {formatIntero(state.avviso_mancanti.righe_mancanti)} righe</strong>
              {state.avviso_mancanti.ordini > 0 ? ` su ${formatIntero(state.avviso_mancanti.ordini)} ordini` : ''}:
              {' '}non entrano in nessun conto{state.con_ricalcoli === false ? '' : ' e i moduli collegati non sono stati ricalcolati'}.
              {' '}Ricarica lo stesso file, senza rifiltrarlo.
              {(state.avviso_mancanti.archivi || []).some(a => (a.esempi || []).length > 0) && (
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  {(state.avviso_mancanti.archivi || []).flatMap(a => (a.esempi || []).map((e, i) => (
                    <li key={`${a.nome}|${e.id_ordine}|${i}`} className="font-mono text-xs">
                      {a.nome} · {e.id_ordine} ({formatIntero(e.volte)} righe invece di {formatIntero(e.nel_file)})
                    </li>
                  )))}
                </ul>
              )}
            </div>
          )}

          {/* Un archivio che non si e' riusciti a contare, o righe rimaste in
              sospeso: finche' e' cosi' il gestionale non si aggiorna. */}
          {state.avviso_non_verificato && (() => {
            // Gli archivi che non si sono fermati su un numero e quelli la cui
            // lettura smentisce le scritture confermate NON si nominano dentro
            // «Non si è riusciti a contare»: sono contati, e sotto c'è la loro
            // frase. Nominarli qui voleva dire dire due cose diverse dello
            // stesso archivio in due righe una sotto l'altra.
            const a = state.avviso_non_verificato;
            // Anche gli archivi con degli ordini che le scritture confermate non
            // coprono hanno risposto al conteggio, e hanno la loro frase qui
            // sotto: nominarli dentro «Non si è riusciti a contare» voleva dire
            // dire due cose diverse dello stesso archivio. E lasciarli fuori da
            // questo elenco senza dar loro un riquadro era peggio ancora: con
            // l'elenco vuoto scattava la frase generica, e la finestra scriveva
            // «Non si è riusciti a contare l'archivio» di un archivio contato
            // dieci volte, mentre la riga sotto la scheda diceva la cosa giusta.
            const nonConfermati = a.non_confermati || [];
            const aParte = archiviConFraseLoro(a);
            const soloNonContati = archiviSenzaConteggio(a);
            return (
            <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
              {a.non_contato && (soloNonContati.length > 0 || aParte.length === 0) && (
                <p>
                  <strong>Non si è riusciti a contare {soloNonContati.length ? soloNonContati.join(', ') : "l'archivio"}</strong>:
                  {' '}non si sa se le righe ci siano tutte e una volta sola.
                </p>
              )}
              {/* LO STATO NUOVO: restano ordini che le scritture confermate non
                  coprono. Non è «mancano delle righe» e non è «è tutto a
                  posto»: di quegli ordini il gestionale non sa quante righe
                  siano entrate, la scrittura non ha risposto e la riparazione
                  non è riuscita a rifarle. Una lettura che dice «tornano» non
                  lo può smentire né confermare — è proprio ciò che direbbe una
                  lettura in ritardo. La frase è la STESSA della riga sotto la
                  scheda (testoVerificaArchivio). */}
              {nonConfermati.length > 0 && (
                <p>
                  <strong>Di {nonConfermati.map(x => `${formatIntero(x.ordini)} ordini di ${x.nome}`).join(', ')} non si è potuto confermare che le righe siano entrate una volta sola</strong>:
                  {' '}la scrittura non ha risposto e il gestionale non è riuscito a rifarle da solo. Il conteggio da solo non basta a dirlo.
                </p>
              )}
              {(a.incoerenti || []).length > 0 && (
                <p>
                  <strong>{a.incoerenti.join(', ')} ha risposto con meno righe di quante ne sono state scritte davvero</strong>:
                  {' '}la lettura non è affidabile, e su un conteggio così il gestionale non dichiara niente, né che l'archivio è a posto né quante righe manchino.
                </p>
              )}
              {/* Il conteggio che non si ferma su un numero è un'altra cosa dal
                  conteggio che non riesce: l'archivio risponde, ma dà due
                  numeri diversi uno dopo l'altro, e su un numero che sta ancora
                  cambiando non si dichiara niente. */}
              {(a.instabili || []).length > 0 && (
                <p>
                  {/* Senza «dopo la riparazione»: il conteggio si può fermare
                      male anche PRIMA che la riparazione parta — anzi, se non si
                      ferma la riparazione non parte affatto — e chi leggeva
                      quella frase andava a cercare che cosa avesse toccato il
                      gestionale, che non aveva toccato niente. */}
                  <strong>{a.instabili.join(', ')} ha dato due numeri diversi uno dopo l'altro</strong>:
                  {' '}finché il conteggio non si ferma, il gestionale non dichiara che l'archivio è a posto.
                </p>
              )}
              {a.righe_incerte > 0 && (
                <p>{formatIntero(a.righe_incerte)} righe sono rimaste in sospeso: non si sapeva se fossero entrate e non sono state riscritte, per non farne entrare due volte le stesse.</p>
              )}
              {/* I moduli collegati si nominano solo dove ce ne sono: per
                  ordini non dichiarati e dichiarazioni di trattamento non c'è
                  niente da far ripartire. */}
              <p className="mt-1">
                {state.con_ricalcoli === false ? '' : 'Finché non ricarichi, report settimanali, alert, quadratura FIR, predittività e ritiri ECT non si aggiornano. '}
                Ricarica lo stesso file, senza rifiltrarlo.
              </p>
            </div>
            );
          })()}

          {/* Gli ordini "eseguito" a portale: tutti i dati, ma nessuno ha
              premuto Chiudi. Non si sommano ai terminati: si dicono. */}
          {testoEseguiti(state.avviso_eseguiti) && (
            <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
              <strong>Ordini in attesa di chiusura a portale:</strong> {testoEseguiti(state.avviso_eseguiti)}
            </div>
          )}

          {/* Un collega sta caricando adesso: non c'e' niente da forzare. */}
          {state.caricamento_in_corso && (
            <p className="text-foreground">
              Il caricamento in corso è {state.caricamento_in_corso.nome_file ? `del file ${state.caricamento_in_corso.nome_file}` : 'di un altro utente'}
              {state.caricamento_in_corso.utente ? `, avviato da ${state.caricamento_in_corso.utente}` : ''}. Riprova quando ha finito.
            </p>
          )}

          {state.ultimo_errore && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Ultimo errore riportato dal database</p>
              <p className="font-mono text-xs text-foreground break-all">{state.ultimo_errore}</p>
            </div>
          )}

          {isError && state.fase && (
            <p className="text-xs text-muted-foreground">Fase: {state.fase}</p>
          )}

          {isError && (
            state.dati_intatti ? (
              // Il verde parla del CARICAMENTO INTERO, non della sola
              // invocazione che si e' guastata: la bandierina la tiene il
              // browser (importaPrimarie in src/lib/importGrandeFile.js) e la
              // abbassa appena un archivio e' stato toccato, anche quando il
              // server - che sa dire solo della propria invocazione - risponde
              // in buona fede di non aver toccato niente. Senza quella
              // bandierina qui usciva "non ho modificato niente" sopra un
              // archivio appena svuotato e riscritto, e chi legge questa frase
              // non ricarica.
              <p className="flex items-start gap-1.5 text-green-700 font-medium pt-2 border-t">
                <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Questo tentativo non ha modificato né cancellato nessun dato.
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-amber-800 font-medium pt-2 border-t">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                L'interruzione è avvenuta dopo l'inizio della scrittura: l'archivio potrebbe essere incompleto. Ricarica il file prima di consultare i dati.
              </p>
            )
          )}
        </div>

        <DialogFooter>
          {isError && state.richiede_conferma && state.onForza ? (
            confirmingForza ? (
              <>
                <Button variant="outline" onClick={() => setConfirmingForza(false)}>Annulla</Button>
                <Button variant="destructive" onClick={handleForza}>
                  Confermo, forza caricamento
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>Chiudi</Button>
                <Button variant="destructive" onClick={() => setConfirmingForza(true)}>
                  Forza caricamento
                </Button>
              </>
            )
          ) : (
            <Button variant="outline" onClick={onClose}>Chiudi</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}