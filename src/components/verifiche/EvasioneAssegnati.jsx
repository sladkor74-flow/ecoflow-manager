import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ChevronLeft, ChevronRight, Upload, Loader2, Eye, Trash2, AlertTriangle, Info, RefreshCw, Bell, CheckCircle2 } from 'lucide-react';
import DettaglioEvasione from '@/components/verifiche/DettaglioEvasione';
import { MESI, GRAVITA, tonnellate, dataIt, dataOraIt, leggiFogliLista } from '@/lib/evasioneAssegnati';
import { formatTonnellate } from '@/lib/utils';
import { eliminaParti } from '@/lib/testoLungo';
import { oggiRoma } from '@/lib/giornoItaliano';
import { TIPI_PRIMARIE } from '@/lib/registroCaricamenti';
import { creaAscoltoCaricamenti } from '@/lib/ascoltoCaricamenti';

// Sezione 2 del modulo Verifiche: evasione delle liste di assegnati inviate ai
// raccoglitori a inizio mese. A ogni caricamento delle primarie il gestionale
// controlla cronologia, priorita', ordini fuori lista e fattibilita' rispetto al
// target. La lista di un raccoglitore viene sostituita quando se ne carica una
// nuova per lo stesso mese; quelle dei mesi prima restano, e perdono solo il
// dettaglio richiesta per richiesta (29/09/2026): la storia di come ha lavorato
// resta scritta.
//
// Rete, ACI ed extra raccolta restano separati: lista, target e previsione
// riguardano la rete; di ACI ed extra si vedono raccolto e richieste aperte.

// Il caricamento delle primarie aperto, interrotto o concluso mentre la funzione
// leggeva gli archivi: lo dice evasioneAssegnati in caricamento_aperto, con le
// due letture del registro che stanno attorno a quella degli archivi (regola 2).
// In quel caso le liste non si ricontrollano, e raccolto, canali e alert dei
// canali vengono da un archivio che si stava riscrivendo: la pagina lo dice,
// invece di mostrarli come validi.
const DATI_IN_RISCRITTURA = "raccolto rete, ACI ed extra raccolta, richieste aperte e alert dei canali sono letti da un archivio che si stava riscrivendo e possono essere incompleti";

function testoCaricamentoAperto(c) {
  if (c.concluso) {
    return `Un caricamento delle primarie si è concluso mentre si leggevano gli archivi: ${DATI_IN_RISCRITTURA}. Riapri la pagina per vederli aggiornati, con le liste ricontrollate sui dati nuovi.`;
  }
  if (!c.created_date) return `${c.messaggio} I controlli delle liste restano quelli del caricamento precedente, e ${DATI_IN_RISCRITTURA}.`;
  const chi = [c.utente, c.nome_file].filter(Boolean).join(', ');
  const cosa = `Il caricamento delle primarie del ${dataOraIt(c.created_date)}${chi ? ` (${chi})` : ''}`;
  if (c.interrotto) {
    return `${cosa} risulta interrotto: l'archivio può essere incompleto e il caricamento va ripetuto. Fino ad allora le liste non si ricontrollano e restano i controlli del caricamento precedente, e ${DATI_IN_RISCRITTURA}.`;
  }
  return `${cosa} non è ancora concluso: le liste si ricontrollano da sole quando si conclude. Intanto restano i controlli del caricamento precedente, e ${DATI_IN_RISCRITTURA}.`;
}

function InRiscrittura() {
  return <div className="text-xs text-amber-700 font-medium" title="Letto mentre si caricavano le primarie: può essere incompleto">archivio in riscrittura</div>;
}

// Stato e messaggio di una funzione che ha risposto con un errore: l'SDK li mette
// sull'errore stesso o nella sua risposta (come in importGrandeFile.js).
const statoErrore = (e) => (e && (e.status || (e.response && e.response.status))) || undefined;
const messaggioErrore = (e) => {
  const dati = e && (e.data || (e.response && e.response.data));
  return (dati && dati.error) || (e && e.message) || String(e);
};
// 409: un caricamento delle primarie aperto o interrotto, che la funzione nomina.
const rinviato = (e) => statoErrore(e) === 409;

// UN ANNO LETTO, I MESI SFOGLIATI IN MEMORIA (segnalazione alta A3 del 20/09,
// corretta il 12/10/2026). Ogni mese che si guardava richiamava evasioneAssegnati,
// che rilegge per intero sei archivi, i target, le liste e un controllo per
// lista: sfogliare da ottobre a luglio erano quattro letture di tutto, sul limite
// di richieste al minuto che vale per tutta l'app. Ora la funzione risponde per
// i dodici mesi dell'anno in una chiamata ({ anno, anno_intero: true }) e la
// pagina sfoglia i mesi in memoria; un altro anno e' un'altra chiamata, e gli
// anni gia' letti restano. I numeri di ogni mese sono quelli di prima: il
// calcolo e' lo stesso (prove/evasioneAnnoInMemoria.mjs).
//
// Quanto restano buoni: un anno letto da piu' di VALIDITA_ANNO_MS, o letto mentre
// si caricavano le primarie, si rilegge in silenzio al primo cambio di mese, e
// intanto si vede quello che c'era. Dopo un caricamento o un'eliminazione di una
// lista e dopo «Controlla ora» si rilegge subito l'anno che si ha davanti, e gli
// altri si dimenticano.
//
// UN CARICAMENTO DELLE PRIMARIE AGGIORNA LA PAGINA (revisione del 13/10/2026).
// Senza iscrizione, dopo un caricamento chiuso da un'altra scheda o da un altro
// utente, per cinque minuti cambiando mese si vedevano i numeri di prima, e
// niente lo diceva: con la lettura mese per mese ogni mese rileggeva (regola 2).
// Rileggere quando il caricamento si chiude pero' rifarebbe i controlli delle
// liste insieme a controllaEvasioneAssegnati, che parte proprio allora. Il
// momento giusto e' la nota «moduli collegati aggiornati», che importaBlocco
// attacca alla riga del registro quando tutti i ricalcoli del caricamento,
// evasione compresa, sono finiti: li' si dimenticano gli anni letti e si rilegge
// quello davanti (src/lib/ascoltoCaricamenti.js). Fra l'inizio del caricamento e
// la nota la pagina dice che i numeri a video sono di prima.
//
// LA NOTA PUO' NON ARRIVARE, E UN PARZIALE NON SI RILEGGE DA SOLO (revisione del
// 13/10/2026). dopoCaricamento scrive la nota solo se riescono tutti e cinque i
// ricalcoli delle primarie, anche verifiche e qualifica che con l'evasione non
// c'entrano; e non la scrive se la scheda di chi carica si chiude prima. In quel
// caso l'evasione puo' essere stata ricontrollata e la pagina non rileggeva
// mai, mentre l'avviso prometteva che i numeri «si aggiornano da soli». Ora,
// passati ATTESA_NOTA_MS dalla chiusura senza la nota, gli anni letti prima
// sono vecchi: si rileggono al primo cambio di mese o con «Rileggi ora»
// nell'avviso, e l'avviso dice proprio questo. Mai da soli allo scadere: la
// chiusura arriva nello stesso istante a tutte le pagine aperte, e se il
// ricontrollo delle liste non e' riuscito ciascuna lo rifarebbe per conto suo,
// insieme alle altre. Per la stessa ragione un caricamento chiuso «parziale»
// (o una riscrittura finita in errore) non si rilegge piu' subito: dopo un
// parziale i ricalcoli non partono e la nota non arriva, quindi l'anno diventa
// vecchio subito e si rilegge al cambio di mese, con «Rileggi ora» o con
// «Controlla ora», che sono azioni di una persona e non partono in sincrono
// su tutte le pagine. I cinque minuti restano come rete di sicurezza, tranne
// mentre si aspetta la nota: li' rileggere rifarebbe i controlli due volte.
//
// LA NOTA ARRIVA MA LA RILETTURA NON RIESCE (revisione del 13/10/2026). Alla
// nota rileggono insieme tutte le pagine aperte, e lo stesso aggiornamento del
// registro fa ripartire il motore degli alert: la rilettura puo' fallire (un
// 500, o il limite di richieste che non passa). Prima, dopo una nota cosi',
// l'avviso prometteva ancora che la pagina rileggeva da sola, che non sarebbe
// piu' successo; fino alla fine dell'attesa il cambio di mese non rileggeva e
// «Rileggi ora» non c'era, e dopo l'avviso diceva che i ricalcoli «non
// risultano finiti», che era falso. Ora la nota segna che i ricalcoli sono
// finiti (fase 'ricalcoli_finiti'): se la rilettura non riesce l'anno e' vecchio
// senza attesa, si rilegge al cambio di mese o con «Rileggi ora», e l'avviso
// dice proprio questo. Mentre la rilettura e' in volo dice che la pagina sta
// rileggendo, e «Rileggi ora» e' fermo, per non partire due volte.
const VALIDITA_ANNO_MS = 5 * 60 * 1000;
// Tre minuti: il ricontrollo delle liste e' il primo dei ricalcoli, e con tutti
// i suoi tentativi (cinque attese sul limite di richieste, fino a 67 secondi
// in tutto, poi mezzo minuto e un secondo giro, src/lib/importGrandeFile.js e
// src/lib/limiteRichieste.js) si arrende entro i tre minuti. Il 09/10/2026 i
// cinque ricalcoli insieme ci hanno messo 18 secondi.
const ATTESA_NOTA_MS = 3 * 60 * 1000;

// L'ora italiana di un istante, per dire quando e' successo e fino a quando si aspetta.
const oraRoma = (ms) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });

// Che cosa dice l'avviso, per ogni fase del caricamento sentito dopo la lettura.
// Non promette mai un aggiornamento che non e' sicuro: dice che i numeri sono
// quelli di prima e quando si rileggono davvero. rilegge: una lettura dell'anno
// davanti e' in volo (dopo la nota, quella che la nota ha fatto partire).
function testoPrimarieCambiate(c, attesaFinita, rilegge) {
  const alle = oraRoma(c.il);
  const come = 'cambiando mese o con «Rileggi ora»';
  if (c.fase === 'in_corso') {
    return `Dopo la lettura di questa pagina è partito un caricamento delle primarie (alle ${alle}), non ancora chiuso: i numeri qui sotto sono quelli di prima.`;
  }
  if (c.fase === 'senza_ricalcoli') {
    const cosa = c.esito === 'parziale' ? "si è chiuso parziale: l'archivio è stato riscritto solo in parte" : "non è riuscito: l'archivio può essere vuoto o incompleto";
    return `Dopo la lettura di questa pagina un caricamento delle primarie ${cosa} (alle ${alle}), e i ricalcoli del caricamento non partono. I numeri qui sotto sono quelli di prima: si rileggono ${come}.`;
  }
  if (c.fase === 'ricalcoli_finiti') {
    return rilegge
      ? `Dopo la lettura di questa pagina le primarie sono state ricaricate (alle ${alle}) e i ricalcoli sono finiti: la pagina sta rileggendo i numeri, e intanto quelli qui sotto sono di prima.`
      : `Dopo la lettura di questa pagina le primarie sono state ricaricate (alle ${alle}): i ricalcoli sono finiti ma la rilettura non è riuscita, e i numeri qui sotto sono quelli di prima. Si rileggono ${come}.`;
  }
  if (attesaFinita) {
    return `Dopo la lettura di questa pagina le primarie sono state ricaricate (alle ${alle}), ma i ricalcoli del caricamento non risultano finiti: i numeri qui sotto sono quelli di prima e si rileggono ${come}.`;
  }
  return `Dopo la lettura di questa pagina le primarie sono state ricaricate (alle ${alle}): i numeri qui sotto sono quelli di prima. La pagina li rilegge da sola quando il caricamento segna finiti i suoi ricalcoli, evasione delle liste compresa; se alle ${oraRoma(c.il + ATTESA_NOTA_MS)} non è successo, si rileggono ${come}.`;
}

function Barra({ valore, massimo }) {
  const perc = massimo ? Math.min(100, Math.round((valore / massimo) * 100)) : 0;
  const colore = !massimo ? 'bg-muted-foreground/30' : perc >= 100 ? 'bg-emerald-500' : perc >= 60 ? 'bg-amber-500' : 'bg-orange-500';
  return <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${colore}`} style={{ width: `${perc}%` }} /></div>;
}

// Il target si legge da Target & Status, dove si scrive: qui e' solo mostrato.
function CampoTarget({ riga }) {
  const dettaglio = (riga.target_regioni || []).filter(r => r.target_t || r.non_raccoglie)
    .map(r => `${[r.regione, r.impianto].filter(Boolean).join(' verso ')}: ${r.non_raccoglie ? 'non raccoglie' : `${formatTonnellate(r.target_t)} t`}`).join('\n');
  return (
    <Link to="/target-status?tab=raccoglitori" className="tabular-nums hover:underline" title={`${dettaglio ? dettaglio + '\n' : ''}Si modifica in Target & Status`}>
      {riga.target_kg ? `${tonnellate(riga.target_kg)} t` : <span className="text-muted-foreground">—</span>}
    </Link>
  );
}

const alertDellaRiga = (riga) => [...(riga.controllo ? riga.controllo.alert : []), ...(riga.alert_canali || [])];
// Ordini terminati senza fine trasporto: esclusi da ogni conto, ma si vedono.
const senzaFine = (canale) => (canale && canale.senza_fine ? canale.senza_fine.length : 0);
// Evasi del mese con un'altra data obbligatoria che manca o non torna: contati,
// ma si vedono anche loro (regola dell'utente del 22/09/2026).
const conDate = (canale) => (canale && canale.date_da_sistemare ? canale.date_da_sistemare.length : 0);
const titoloDate = (canale) => (canale && canale.date_da_sistemare ? canale.date_da_sistemare.map(v => `${v.id_ordine}: ${v.date}`).join('\n') : '');
const attivitaCanali = (riga) => ['aci', 'extra'].some(k => riga.canali && (riga.canali[k].evasi > 0 || riga.canali[k].aperte.length > 0))
  || ['rete', 'aci', 'extra'].some(k => riga.canali && (senzaFine(riga.canali[k]) > 0 || conDate(riga.canali[k]) > 0));

function AlertBadge({ riga }) {
  const alert = alertDellaRiga(riga);
  if (!riga.controllo && !alert.length) return <span className="text-muted-foreground">—</span>;
  const alte = alert.filter(a => a.gravita === 'alta').length;
  const medie = alert.filter(a => a.gravita === 'media').length;
  // A un controllo alleggerito le frasi delle segnalazioni sono state tolte, ma i
  // contatori restano sul record: senza guardarli un mese con quattro
  // segnalazioni alte si mostrerebbe verde, "In linea", che e' il contrario del
  // vero. I numeri si mostrano in grigio, perche' del dettaglio resta la storia.
  const c = riga.controllo;
  if (c && c.alleggerito_il && !alert.length && (c.alert_alti > 0 || c.alert_totali > 0)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums"
        title="Al controllo è stato tolto il dettaglio: restano i contatori e la storia scritta">
        {c.alert_alti > 0 ? `${c.alert_alti} alte` : ''}{c.alert_alti > 0 && c.alert_totali > c.alert_alti ? ' · ' : ''}
        {c.alert_totali > c.alert_alti ? `${c.alert_totali - c.alert_alti} altre` : ''}
      </span>
    );
  }
  if (!alte && !medie) return <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />In linea</span>;
  return (
    <div className="flex gap-1">
      {alte > 0 && <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-xs font-semibold tabular-nums">{alte}</span>}
      {medie > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-xs font-semibold tabular-nums">{medie}</span>}
    </div>
  );
}

function CanaleBreve({ etichetta, canale, tono }) {
  const nSenzaFine = senzaFine(canale);
  const nDate = conDate(canale);
  if (!canale || (!canale.evasi && !canale.aperte.length && !nSenzaFine)) return <div className="text-xs text-muted-foreground">{etichetta} —</div>;
  return (
    <div className="text-xs tabular-nums">
      <span className="text-muted-foreground">{etichetta}</span> {tonnellate(canale.kg)} t · {canale.evasi} {canale.evasi === 1 ? 'evaso' : 'evasi'}
      {canale.aperte.length > 0 && <span className={`ml-1 font-semibold ${tono}`}>· {canale.aperte.length} {canale.aperte.length === 1 ? 'aperta' : 'aperte'}</span>}
      {nSenzaFine > 0 && <span className="ml-1 font-semibold text-red-600" title="Terminati senza data di fine trasporto: esclusi dal raccolto">· {nSenzaFine} senza fine trasporto</span>}
      {nDate > 0 && <span className="ml-1 font-semibold text-amber-700" title={`Evasi del mese, contati, con le date obbligatorie da sistemare:\n${titoloDate(canale)}`}>· {nDate} con date da sistemare</span>}
    </div>
  );
}

// Primo giorno feriale del mese: la data proposta per l'invio delle liste.
function primoFeriale(anno, mese) {
  const d = new Date(Date.UTC(anno, mese - 1, 1));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function RigaRaccoglitore({ riga, isAdmin, occupato, inRiscrittura, onCarica, onApri, onElimina }) {
  const input = useRef(null);
  const c = riga.controllo;
  const l = riga.lista;
  return (
    <tr className="border-t hover:bg-muted/30 align-top">
      <td className="px-4 py-3">
        <div className="font-medium">{riga.nome}</div>
        <div className="text-xs text-muted-foreground">rete: {riga.assegnati_ora} {riga.assegnati_ora === 1 ? 'ordine assegnato' : 'ordini assegnati'} ora</div>
      </td>
      <td className="px-4 py-3"><CampoTarget riga={riga} /></td>
      <td className="px-4 py-3 min-w-[130px]">
        <div className="tabular-nums text-sm">{tonnellate(riga.raccolto_kg)} t{riga.target_kg ? <span className="text-muted-foreground"> · {Math.round((riga.raccolto_kg / riga.target_kg) * 100)}%</span> : ''}</div>
        <Barra valore={riga.raccolto_kg} massimo={riga.target_kg} />
        {riga.canali && senzaFine(riga.canali.rete) > 0 && (
          <div className="text-xs text-red-600 font-medium mt-0.5" title="Terminati senza data di fine trasporto: esclusi dal raccolto">
            {senzaFine(riga.canali.rete)} senza fine trasporto, esclus{senzaFine(riga.canali.rete) === 1 ? 'o' : 'i'}
          </div>
        )}
        {riga.canali && conDate(riga.canali.rete) > 0 && (
          <div className="text-xs text-amber-700 font-medium mt-0.5" title={`Evasi del mese, contati, con le date obbligatorie da sistemare:\n${titoloDate(riga.canali.rete)}`}>
            {conDate(riga.canali.rete)} con date da sistemare, contat{conDate(riga.canali.rete) === 1 ? 'o' : 'i'}
          </div>
        )}
        {inRiscrittura && <InRiscrittura />}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <CanaleBreve etichetta="ACI" canale={riga.canali && riga.canali.aci} tono="text-red-600" />
        <CanaleBreve etichetta="Extra" canale={riga.canali && riga.canali.extra} tono="text-amber-700" />
        {inRiscrittura && <InRiscrittura />}
      </td>
      <td className="px-4 py-3 max-w-[200px]">
        {l ? (
          <>
            <div className="text-sm truncate" title={l.file_nomi}>{l.file_nomi}</div>
            <div className="text-xs text-muted-foreground">{l.richieste} richieste{l.prioritarie ? ` · ${l.prioritarie} prioritarie` : ''} · inviata il {dataIt(l.inviata_il || l.caricata_il)}</div>
          </>
        ) : riga.non_raccoglie ? (
          <span className="text-xs text-muted-foreground" title="Indicato in Target & Status">Non raccoglie questo mese</span>
        ) : (
          <span className="text-sm text-muted-foreground">{riga.assegnati_ora ? 'Da caricare' : '—'}</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
        {c ? (
          <>
            <div>{c.evase} evase su {c.richieste}</div>
            <div className="text-xs text-muted-foreground">{c.aperte} aperte{c.fuori_ordine ? ` · ${c.fuori_ordine} fuori ordine` : ''}{c.fuori_lista ? ` · ${c.fuori_lista} fuori lista` : ''}{c.annullate ? ` · ${c.annullate} annullate` : ''}</div>
          </>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        {c ? (
          <>
            <div className="tabular-nums">{tonnellate(c.proiezione_kg)} t{c.target_kg ? <span className={`ml-1 ${c.proiezione_kg >= c.target_kg ? 'text-emerald-700' : 'text-orange-700'}`}>{Math.round((c.proiezione_kg / c.target_kg) * 100)}%</span> : ''}</div>
            <div className="text-xs text-muted-foreground">evade ~{c.evadibili_ritmo} delle {c.aperte} aperte</div>
          </>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-3"><AlertBadge riga={riga} /></td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {isAdmin && (
            <>
              <input ref={input} type="file" multiple className="hidden" accept=".xlsx,.xlsm,.xls,.csv"
                onChange={(e) => { const files = [...(e.target.files || [])]; e.target.value = ''; if (files.length) onCarica(riga, files); }} />
              <Button size="sm" variant={l ? 'ghost' : 'outline'} className="h-8" disabled={occupato} onClick={() => input.current && input.current.click()}>
                {occupato ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                {l ? 'Sostituisci' : 'Carica lista'}
              </Button>
            </>
          )}
          {(l || riga.raccolto_kg > 0 || attivitaCanali(riga)) && <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Dettaglio" onClick={() => onApri(riga)}><Eye className="w-4 h-4" /></Button>}
          {l && isAdmin && <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700" title="Elimina lista" onClick={() => onElimina(riga)}><Trash2 className="w-4 h-4" /></Button>}
        </div>
      </td>
    </tr>
  );
}

export default function EvasioneAssegnati({ isAdmin }) {
  const { toast } = useToast();
  // Il mese di partenza e' quello di oggi in Italia, non quello dell'orologio del dispositivo.
  const annoOggi = Number(oggiRoma().slice(0, 4));
  const meseOggi = Number(oggiRoma().slice(5, 7));
  const [anno, setAnno] = useState(annoOggi);
  const [mese, setMese] = useState(meseOggi);
  // Gli anni letti, ciascuno con i suoi dodici mesi e l'ora della lettura.
  const [letti, setLetti] = useState({});
  // Gli anni che si stanno leggendo con il cerchio che gira (la prima volta).
  const [inLettura, setInLettura] = useState({});
  // Gli anni con una lettura in volo, anche in silenzio: l'avviso dopo la nota
  // dice che la pagina sta rileggendo, e non che la rilettura non e' riuscita
  // (revisione del 13/10/2026). inVolo, qui sotto, non ridisegna la pagina.
  const [rileggeAnno, setRileggeAnno] = useState({});
  const [errori, setErrori] = useState({});
  const [occupato, setOccupato] = useState(null);
  const [aperto, setAperto] = useState(null);
  const [inControllo, setInControllo] = useState(false);
  const [tuttiAlert, setTuttiAlert] = useState(false);
  const [mostraAltri, setMostraAltri] = useState(false);
  const [inviataIl, setInviataIl] = useState(primoFeriale(annoOggi, meseOggi));
  // Per anno: le letture in volo e l'ultima partita, che sola si prende lo schermo.
  const inVolo = useRef(new Set()).current;
  const ultimaDi = useRef({}).current;

  const caricaAnno = useCallback(async (a, silenzioso = false) => {
    const mia = (ultimaDi[a] = (ultimaDi[a] || 0) + 1);
    inVolo.add(a);
    setRileggeAnno(p => ({ ...p, [a]: true }));
    if (!silenzioso) setInLettura(p => ({ ...p, [a]: true }));
    // L'ora della lettura e' quella in cui parte: un caricamento chiuso mentre
    // la funzione leggeva e' successivo alla lettura, non precedente.
    const partita = Date.now();
    try {
      const res = await base44.functions.invoke('evasioneAssegnati', { anno: a, anno_intero: true });
      if (ultimaDi[a] === mia) {
        setLetti(p => ({ ...p, [a]: { ...(res.data || res), letto_il: partita } }));
        setErrori(p => ({ ...p, [a]: null }));
      }
    } catch (e) {
      if (ultimaDi[a] === mia) setErrori(p => ({ ...p, [a]: messaggioErrore(e) || 'Errore nel caricamento' }));
    }
    if (ultimaDi[a] === mia) {
      inVolo.delete(a);
      setInLettura(p => ({ ...p, [a]: false }));
      setRileggeAnno(p => ({ ...p, [a]: false }));
    }
  }, [inVolo, ultimaDi]);

  // All'apertura si legge l'anno di oggi.
  useEffect(() => { if (!inVolo.has(annoOggi)) caricaAnno(annoOggi); }, [annoOggi, caricaAnno, inVolo]);
  useEffect(() => { setInviataIl(primoFeriale(anno, mese)); }, [anno, mese]);
  const lettoAnno = letti[anno];

  // Dopo una scrittura (lista caricata o eliminata, controllo rifatto) si
  // rilegge l'anno che si ha davanti, e gli altri anni letti si dimenticano.
  const carica = useCallback(async () => {
    setLetti(p => (p[anno] ? { [anno]: p[anno] } : {}));
    await caricaAnno(anno, true);
  }, [anno, caricaAnno]);

  // I caricamenti delle primarie, ascoltati con un'iscrizione sola per tutta la
  // vita della pagina. Alla nota dei moduli aggiornati si rilegge l'anno davanti
  // (e gli altri si dimenticano, come dopo una scrittura). Per il resto si segna
  // la fase e quando, per dire che i numeri a video sono di prima:
  // - in_corso: il caricamento e' aperto;
  // - concluso: chiuso con successo, si aspetta la nota (ATTESA_NOTA_MS);
  // - senza_ricalcoli: chiuso parziale, o riscrittura finita in errore. La nota
  //   non arrivera' (moduliDaRicalcolare in src/lib/importGrandeFile.js) e
  //   l'anno e' subito vecchio, ma non si rilegge qui (revisione del 13/10/2026):
  //   l'evento arriva insieme a tutte le pagine aperte, e ognuna ricontrollerebbe
  //   da se' le stesse liste (statoPrimarie conta anche il parziale).
  // - ricalcoli_finiti: la nota e' arrivata sulla riga chiusa con successo
  //   (revisione del 13/10/2026). La rilettura parte qui; se non riesce, l'anno
  //   letto prima e' vecchio senza attesa, perche' un'altra nota non arrivera'.
  //   Una nota di un'altra riga (arrivata tardi) non segna finiti i ricalcoli
  //   del caricamento che si sta aspettando. Li segna invece la nota della
  //   riga vista aperta, se la sua chiusura non si e' sentita (un evento perso
  //   dall'iscrizione): la nota arriva solo dopo una chiusura riuscita, e senza
  //   segnarla l'avviso restava «non ancora chiuso» anche a ricalcoli finiti.
  // La riga vista aperta e chiusa in errore senza riscrivere niente (un rifiuto
  // prima dello svuotamento, o la riga che un caricamento nuovo chiude) toglie
  // l'avviso: i numeri a video valgono ancora, o li rilegge il caricamento nuovo.
  //
  // LE SCHEDE DI EXTRA RACCOLTA (revisione del 13/10/2026, lasciato fuori dal
  // giro di prima). Ogni salvataggio nel modulo Extra Raccolta scrive una riga
  // «extra_raccolta» gia' riuscita, senza nota. La pagina non la ascoltava, e
  // con l'anno tenuto in memoria il canale Extra restava quello di prima fino
  // alla rete dei cinque minuti (regola 2). Ora l'anno letto prima diventa
  // vecchio: si rilegge al primo cambio di mese o con «Rileggi ora», non da
  // solo, perche' un salvataggio dopo l'altro farebbe rileggere tutte le pagine
  // aperte a ogni scheda. I controlli delle liste non c'entrano: dipendono dalle
  // sole primarie, e nessun ricalcolo dell'extra raccolta li tocca.
  const [extraDopo, setExtraDopo] = useState(null);
  const [caricamentoDopo, setCaricamentoDopo] = useState(null);
  const suCaricamento = useRef(null);
  suCaricamento.current = (e) => {
    const adesso = Date.now();
    if (e.tipo_file === 'extra_raccolta') { if (e.concluso) setExtraDopo({ il: adesso }); return; }
    if (e.moduli_aggiornati) {
      const finiti = (c) => !!c && ((c.fase === 'concluso' && (!c.id || !e.id || c.id === e.id)) || (c.fase === 'in_corso' && !!c.id && c.id === e.id));
      setCaricamentoDopo(c => (finiti(c) ? { ...c, fase: 'ricalcoli_finiti' } : c));
      carica();
    } else if (e.concluso) setCaricamentoDopo({ fase: e.esito === 'successo' ? 'concluso' : 'senza_ricalcoli', esito: e.esito, id: e.id, il: adesso });
    else if (e.in_corso) setCaricamentoDopo(c => (c && c.fase === 'in_corso' && e.id && c.id === e.id ? c : { fase: 'in_corso', id: e.id, il: adesso }));
    else if (e.esito === 'errore') setCaricamentoDopo(c => (c && c.fase === 'in_corso' && c.id === e.id ? null : c));
  };
  // Allo scadere dell'attesa della nota la pagina si ridisegna, perche'
  // l'avviso dica come rileggere: nessuna richiesta parte da qui.
  const [, setScadenza] = useState(0);
  useEffect(() => {
    if (!caricamentoDopo || caricamentoDopo.fase !== 'concluso') return undefined;
    const resta = caricamentoDopo.il + ATTESA_NOTA_MS - Date.now();
    if (resta <= 0) return undefined;
    const t = setTimeout(() => setScadenza(Date.now()), resta + 100);
    return () => clearTimeout(t);
  }, [caricamentoDopo]);
  useEffect(() => {
    const leggi = creaAscoltoCaricamenti([...TIPI_PRIMARIE, 'extra_raccolta']);
    const unsub = base44.entities.UploadLog.subscribe((evento) => {
      const e = leggi(evento);
      if (e) suCaricamento.current(e);
    });
    return unsub;
  }, []);

  // Il mese che si guarda, nella forma di sempre.
  const dati = useMemo(() => {
    const m = lettoAnno && lettoAnno.mesi ? lettoAnno.mesi[mese] || lettoAnno.mesi[String(mese)] : null;
    if (!m) return null;
    return {
      anno, mese, primarie_caricate_il: lettoAnno.primarie_caricate_il, caricamento_aperto: lettoAnno.caricamento_aperto || null,
      controlli_non_riusciti: lettoAnno.controlli_non_riusciti || null, raccoglitori: m.raccoglitori || [], senza_raccolta: m.senza_raccolta || [],
    };
  }, [lettoAnno, anno, mese]);
  const caricando = !!inLettura[anno];
  const errore = errori[anno] || null;
  // Un caricamento delle primarie aperto o chiuso dopo la lettura dell'anno
  // davanti: finche' l'anno non si rilegge, i numeri a video sono di prima e lo
  // si dice. Si aspetta la nota solo per ATTESA_NOTA_MS dalla chiusura.
  const primarieCambiate = caricamentoDopo && lettoAnno && lettoAnno.letto_il < caricamentoDopo.il ? caricamentoDopo : null;
  const attesaDellaNota = !!caricamentoDopo && caricamentoDopo.fase === 'concluso' && Date.now() - caricamentoDopo.il < ATTESA_NOTA_MS;
  // Un anno letto prima di un caricamento che ha riscritto l'archivio e' vecchio:
  // subito se i ricalcoli non partono o se sono gia' finiti (la nota e' arrivata
  // e la sua rilettura non ha preso il posto di quella di prima), a nota mancata
  // se partono. Anche se dopo la lettura si sono salvate schede di extra raccolta.
  const vecchioPerCaricamento = (d) => (!!extraDopo && d.letto_il < extraDopo.il)
    || (!!caricamentoDopo && d.letto_il < caricamentoDopo.il
      && (caricamentoDopo.fase === 'senza_ricalcoli' || caricamentoDopo.fase === 'ricalcoli_finiti'
        || (caricamentoDopo.fase === 'concluso' && !attesaDellaNota)));
  // L'avviso delle schede di extra raccolta, quando quello delle primarie non c'e'
  // (che gia' dice che tutti i numeri sono di prima).
  const extraCambiata = !primarieCambiate && extraDopo && lettoAnno && lettoAnno.letto_il < extraDopo.il ? extraDopo : null;
  // Un anno letto prima della chiusura, mentre si aspetta la nota: lo rilegge la nota.
  const aspettaLaNota = (d) => attesaDellaNota && d.letto_il < caricamentoDopo.il;
  const rileggibile = !!(primarieCambiate || extraCambiata) && vecchioPerCaricamento(lettoAnno) && !aspettaLaNota(lettoAnno);
  // Una lettura dell'anno davanti in volo: «Rileggi ora» resta fermo, col
  // cerchio, per non far partire la stessa lettura due volte.
  const rilegge = !!rileggeAnno[anno];

  // Cambiando mese l'anno si legge se manca (o se l'ultima lettura non e'
  // riuscita), e si rilegge in silenzio se e' vecchio, letto durante un
  // caricamento delle primarie o prima di uno che l'ha riscritto. Finche'
  // l'anno e' buono non parte niente, e nemmeno mentre si aspetta la nota: li'
  // lavora controllaEvasioneAssegnati, e la nota fa rileggere da sola.
  const sposta = (passo) => {
    let m = mese + passo, a = anno;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setMese(m);
    setAnno(a);
    if (inVolo.has(a)) return;
    const d = letti[a];
    if (!d) { caricaAnno(a); return; }
    if (!aspettaLaNota(d) && (Date.now() - d.letto_il > VALIDITA_ANNO_MS || d.caricamento_aperto || vecchioPerCaricamento(d))) caricaAnno(a, true);
  };
  // «Rileggi ora», nell'avviso: l'anno davanti, come dopo una scrittura.
  const [rileggendo, setRileggendo] = useState(false);
  const rileggi = async () => {
    setRileggendo(true);
    await carica();
    setRileggendo(false);
  };

  const caricaLista = async (riga, files) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inviataIl)) {
      toast({ title: 'Indica quando sono state inviate le liste', description: 'Serve la data in "Liste inviate il", in alto.', variant: 'destructive' });
      return;
    }
    if (riga.lista && !window.confirm(`Sostituire la lista di ${riga.nome} per ${MESI[mese - 1]} ${anno}? I controlli fatti finora su quella lista verranno cancellati.`)) return;
    setOccupato(riga.chiave);
    try {
      const { fogli, senzaColori } = await leggiFogliLista(files);
      const res = await base44.functions.invoke('caricaListaAssegnati', {
        anno, mese, raccoglitore_chiave: riga.chiave, raccoglitore_nome: riga.nome, file_nomi: files.map(f => f.name).join(', '), fogli, inviata_il: inviataIl,
      });
      const d = res.data || res;
      const dettagli = [`${d.richieste} richieste, ${d.prioritarie} prioritarie.`];
      if (d.gia_evase) dettagli.push(`${d.gia_evase} risultavano già evase.`);
      if (d.gia_annullate) dettagli.push(`${d.gia_annullate} risultano già annullate sul portale.`);
      if (d.senza_fine) dettagli.push(`${d.senza_fine} ${d.senza_fine === 1 ? 'risulta terminata' : 'risultano terminate'} sul portale senza data di fine trasporto: ${d.senza_fine === 1 ? 'esclusa' : 'escluse'} dai conteggi finché la data manca.`);
      if (d.non_riconosciute) dettagli.push(`${d.non_riconosciute} ID non corrispondono a nessun ordine.`);
      // Ordini di altri canali finiti nella lista di rete: per canale, mai sommati.
      const altro = d.altro_canale || {};
      const fuori = [altro.aci ? `${altro.aci} ACI` : '', altro.extra ? `${altro.extra} di extra raccolta` : ''].filter(Boolean);
      if (fuori.length) dettagli.push(`Nella lista anche ${fuori.join(' e ')}: di altro canale, fuori dai conti.`);
      if (d.liste_ricontrollate) dettagli.push(`Ricontrollate anche ${d.liste_ricontrollate === 1 ? "un'altra lista" : `${d.liste_ricontrollate} altre liste`} degli altri raccoglitori, nei mesi toccati dal caricamento.`);
      if (senzaColori) dettagli.push('Il file non è in formato xlsx: le righe evidenziate non si possono riconoscere.');
      dettagli.push(...(d.avvisi || []));
      toast({ title: `Lista di ${riga.nome} caricata, inviata il ${dataIt(d.inviata_il || inviataIl)}`, description: dettagli.join(' ') });
    } catch (e) {
      toast({ title: rinviato(e) ? 'Caricamento rinviato' : 'Caricamento non riuscito', description: messaggioErrore(e), variant: 'destructive' });
    }
    // Anche dopo un errore: la lista puo' essere stata salvata senza controllo.
    await carica();
    setOccupato(null);
  };

  const eliminaLista = async (riga) => {
    if (!window.confirm(`Eliminare la lista di ${riga.nome} per ${MESI[mese - 1]} ${anno} con tutti i suoi controlli?`)) return;
    try {
      const controlli = await base44.entities.ControlloEvasione.filter({ lista_id: riga.lista.id }, '-eseguito_il', 500);
      for (const c of controlli) { await eliminaParti('ControlloEvasione', c.id); await base44.entities.ControlloEvasione.delete(c.id); }
      await eliminaParti('ListaAssegnati', riga.lista.id);
      await base44.entities.ListaAssegnati.delete(riga.lista.id);
    } catch (e) {
      toast({ title: 'Eliminazione non riuscita', description: e.message || String(e), variant: 'destructive' });
      await carica();
      return;
    }
    // L'eliminazione non lascia traccia nei controlli: le richieste passate a
    // questa lista restavano "in lista di altri" nelle liste degli altri
    // raccoglitori del mese fino al caricamento dopo delle primarie. Si
    // ricontrollano subito le liste rimaste in quel mese.
    try {
      await base44.functions.invoke('controllaEvasioneAssegnati', { forza: true, anno, mese });
    } catch (e) {
      // Con un caricamento aperto il ricontrollo lo rifa' la sua conclusione.
      toast({
        title: rinviato(e) ? 'Lista eliminata, ricontrollo delle altre liste rinviato' : 'Lista eliminata, le altre liste del mese non sono state ricontrollate',
        description: rinviato(e) ? messaggioErrore(e) : `${messaggioErrore(e)} Si ripete con "Controlla ora".`,
        variant: 'destructive',
      });
    }
    await carica();
  };

  const controllaOra = async () => {
    setInControllo(true);
    try {
      await base44.functions.invoke('controllaEvasioneAssegnati', { forza: true });
      await carica();
      toast({ title: 'Controllo aggiornato sulle ultime primarie caricate' });
    } catch (e) {
      toast({ title: rinviato(e) ? 'Controllo rinviato' : 'Controllo non riuscito', description: messaggioErrore(e), variant: 'destructive' });
    }
    setInControllo(false);
  };

  const righe = dati ? dati.raccoglitori : [];
  const caricamentoAperto = (dati && dati.caricamento_aperto) || null;
  const inEvidenza = (r) => r.lista || (!r.non_raccoglie && (r.assegnati_ora > 0 || r.raccolto_kg > 0)) || attivitaCanali(r);
  const principali = righe.filter(inEvidenza);
  const altri = righe.filter(r => !inEvidenza(r));
  const alert = useMemo(() => {
    const PESO = { alta: 0, media: 1, info: 2 };
    return righe.flatMap(r => alertDellaRiga(r).map(a => ({ ...a, riga: r })))
      .sort((a, b) => PESO[a.gravita] - PESO[b.gravita] || a.riga.nome.localeCompare(b.riga.nome, 'it'));
  }, [righe]);
  const alertVisibili = tuttiAlert ? alert : alert.filter(a => a.gravita !== 'info').slice(0, 10);
  const conLista = righe.filter(r => r.lista).length;
  const daCaricare = righe.filter(r => !r.lista && !r.non_raccoglie && r.assegnati_ora > 0).length;

  const intestazioneTabella = (
    <thead className="bg-muted/50 text-left">
      <tr>
        <th className="px-4 py-2.5 font-semibold">Raccoglitore</th>
        <th className="px-4 py-2.5 font-semibold">Target mese</th>
        <th className="px-4 py-2.5 font-semibold">Raccolto rete</th>
        <th className="px-4 py-2.5 font-semibold">ACI · Extra raccolta</th>
        <th className="px-4 py-2.5 font-semibold">Lista</th>
        <th className="px-4 py-2.5 font-semibold">Evasione</th>
        <th className="px-4 py-2.5 font-semibold">Previsione fine mese</th>
        <th className="px-4 py-2.5 font-semibold">Alert</th>
        <th className="px-4 py-2.5" />
      </tr>
    </thead>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => sposta(-1)} title="Mese precedente"><ChevronLeft className="w-4 h-4" /></Button>
          <div className="px-3 text-center min-w-[170px]">
            <div className="font-heading font-semibold text-lg leading-tight">{MESI[mese - 1]} {anno}</div>
            <div className="text-xs text-muted-foreground">{dati && dati.primarie_caricate_il ? `primarie del ${dataOraIt(dati.primarie_caricate_il)}` : ''}</div>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => sposta(1)} title="Mese successivo"><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <div className="flex items-center gap-4 text-sm flex-wrap">
          {dati && (
            <>
              <span><strong className="tabular-nums">{conLista}</strong> <span className="text-muted-foreground">liste caricate</span></span>
              <span><strong className={`tabular-nums ${daCaricare ? 'text-orange-600' : ''}`}>{daCaricare}</strong> <span className="text-muted-foreground">da caricare</span></span>
            </>
          )}
          {isAdmin && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Giorno in cui le liste del mese sono state mandate ai raccoglitori: da qui partono cronologia, priorità e trascurate. Vale per le liste che carichi.">
              Liste inviate il
              <input type="date" value={inviataIl} onChange={(e) => setInviataIl(e.target.value)} className="h-8 px-2 rounded border bg-card text-sm" />
            </label>
          )}
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={controllaOra} disabled={inControllo || caricando}>
              {inControllo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}Controlla ora
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Carica per ogni raccoglitore la lista inviata a inizio mese: uno o più file Excel insieme, con la colonna ID degli assegnati, con in giallo
          le prioritarie oppure in un file con PRIORITA' nel nome. Chi deve evadere lo decide la lista, anche se sul portale l'ordine è assegnato a un
          altro trasportatore. L'ordine si valuta per provincia: prima le prioritarie della lista, anche quando sono forzature chieste dal consorzio, poi con priorità assoluta le richieste immesse negli anni precedenti, poi per data di immissione. Il controllo si ripete da solo a ogni caricamento delle primarie, sulla data di fine trasporto: la chiusura sul portale non decide niente.
          Target e "non raccoglie questo mese" si scrivono in Target & Status, scheda Target raccoglitori: se cambiano, il controllo si aggiorna da solo. Caricando di nuovo la lista dello stesso mese, la precedente viene sostituita; le liste dei mesi passati restano con i loro numeri e una storia scritta, e perdono solo il dettaglio richiesta per richiesta.
          Lista, target e previsione riguardano la sola rete. ACI ed extra raccolta sono mostrati a parte: una richiesta ACI aperta o una richiesta
          di extra raccolta inserita come assegnata nel modulo Extra Raccolta genera un alert. Una richiesta resta assegnata finché non viene chiusa
          o cancellata sul portale: se è già stata ritirata ma non ancora chiusa risulta aperta, e gli alert chiedono di chiuderla. Un ordine terminato
          senza data di fine trasporto non si conta in nessun mese e si segnala. Nel dettaglio trovi quante richieste vale il target
          al peso tipico di un ritiro e quante ne servono in più quando, tra annullate ed evase da altri, quelle aperte non bastano.
        </span>
      </div>

      {caricamentoAperto && (
        <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{testoCaricamentoAperto(caricamentoAperto)}</span>
        </div>
      )}

      {(primarieCambiate || extraCambiata) && (
        <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm flex-wrap sm:flex-nowrap">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">
            {primarieCambiate
              ? testoPrimarieCambiate(primarieCambiate, !attesaDellaNota, rilegge)
              : `Dopo la lettura di questa pagina sono state salvate schede di extra raccolta (alle ${oraRoma(extraCambiata.il)}): il canale Extra qui sotto è quello di prima e si rilegge cambiando mese o con «Rileggi ora».`}
          </span>
          {rileggibile && (
            <Button size="sm" variant="outline" className="h-8 shrink-0 bg-card" onClick={rileggi} disabled={rileggendo || rilegge}>
              {rileggendo || rilegge ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}Rileggi ora
            </Button>
          )}
        </div>
      )}

      {errore && (
        <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errore}</span>
        </div>
      )}

      {/* Con l'anno intero, una lista che non si riesce a ricontrollare non
          toglie la vista dei dodici mesi: si dice quale, e i suoi numeri sono
          quelli dell'ultimo controllo riuscito. */}
      {dati && dati.controlli_non_riusciti && (
        <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{dati.controlli_non_riusciti}. Quelle liste mostrano l&apos;ultimo controllo riuscito{isAdmin ? ': si ripete con "Controlla ora".' : '.'}</span>
        </div>
      )}

      {caricando && !dati ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Controllo liste e primarie dell&apos;anno…</div>
      ) : dati && (
        <>
          {alert.length > 0 && (
            <section className="border border-amber-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200">
                <h3 className="font-heading font-semibold text-amber-900 flex items-center gap-2">
                  <Bell className="w-4 h-4" /> Alert del mese
                  <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-xs tabular-nums">{alert.filter(a => a.gravita !== 'info').length}</span>
                </h3>
                {alertVisibili.length < alert.length || tuttiAlert ? (
                  <button onClick={() => setTuttiAlert(v => !v)} className="text-xs text-amber-900 hover:underline">
                    {tuttiAlert ? 'Solo i più importanti' : `Mostra tutti, comprese le ${alert.filter(a => a.gravita === 'info').length} informazioni`}
                  </button>
                ) : null}
              </div>
              <ul className="divide-y bg-card">
                {alertVisibili.map((a, i) => (
                  <li key={i}>
                    <button onClick={() => setAperto(a.riga)} className="w-full text-left px-4 py-2.5 hover:bg-muted/40 flex items-start gap-3">
                      <span className={`mt-0.5 px-2 py-0.5 rounded-full border text-xs font-medium ${GRAVITA[a.gravita].classe}`}>{GRAVITA[a.gravita].etichetta}</span>
                      <span className="text-sm"><span className="font-medium">{a.riga.nome}</span> <span className="text-muted-foreground">·</span> {a.messaggio}</span>
                    </button>
                  </li>
                ))}
                {alertVisibili.length === 0 && <li className="px-4 py-2.5 text-sm text-muted-foreground">Solo informazioni, nessun alert da gestire.</li>}
              </ul>
            </section>
          )}

          <div className="border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm">
              {intestazioneTabella}
              <tbody>
                {principali.map(r => (
                  <RigaRaccoglitore key={r.chiave} riga={r} isAdmin={isAdmin} occupato={occupato === r.chiave} inRiscrittura={!!caricamentoAperto}
                    onCarica={caricaLista} onApri={setAperto} onElimina={eliminaLista} />
                ))}
                {principali.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Nessun raccoglitore con liste, raccolte o richieste aperte in questo mese.</td></tr>
                )}
                {altri.length > 0 && (
                  <tr className="border-t bg-muted/20">
                    <td colSpan={9} className="px-4 py-2">
                      <button onClick={() => setMostraAltri(v => !v)} className="text-xs text-muted-foreground uppercase tracking-wide hover:underline">
                        {mostraAltri ? 'Nascondi' : 'Mostra'} {altri.length} raccoglitori senza attività nel mese o che non raccolgono
                      </button>
                    </td>
                  </tr>
                )}
                {mostraAltri && altri.map(r => (
                  <RigaRaccoglitore key={r.chiave} riga={r} isAdmin={isAdmin} occupato={occupato === r.chiave} inRiscrittura={!!caricamentoAperto}
                    onCarica={caricaLista} onApri={setAperto} onElimina={eliminaLista} />
                ))}
              </tbody>
            </table>
          </div>

          {dati.senza_raccolta && dati.senza_raccolta.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground border rounded-lg px-4 py-3 bg-muted/20">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Ordini assegnati sul portale a soggetti che nel {anno} non hanno raccolte:{' '}
                {dati.senza_raccolta.map(s => `${s.nome} ${s.assegnati} di rete${s.aci ? ` e ${s.aci} ACI` : ''}${s.in_liste ? `, di cui ${s.in_liste} nelle liste caricate` : ''}`).join('; ')}.
                Non compaiono tra i raccoglitori: le richieste contano per chi le ha in lista.
              </span>
            </div>
          )}
        </>
      )}

      <DettaglioEvasione riga={aperto} anno={anno} mese={mese} open={!!aperto} inRiscrittura={!!caricamentoAperto} onClose={() => setAperto(null)} />
    </div>
  );
}
