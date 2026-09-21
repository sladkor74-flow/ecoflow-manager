import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ChevronLeft, ChevronRight, Upload, Loader2, Eye, Trash2, AlertTriangle, Info, RefreshCw, Bell, CheckCircle2 } from 'lucide-react';
import DettaglioEvasione from '@/components/verifiche/DettaglioEvasione';
import { MESI, GRAVITA, tonnellate, dataIt, dataOraIt, leggiFogliLista } from '@/lib/evasioneAssegnati';
import { formatTonnellate, dataServer } from '@/lib/utils';
import { eliminaParti } from '@/lib/testoLungo';
import { oggiRoma } from '@/lib/giornoItaliano';

// Sezione 2 del modulo Verifiche: evasione delle liste di assegnati inviate ai
// raccoglitori a inizio mese. A ogni caricamento delle primarie il gestionale
// controlla cronologia, priorita', ordini fuori lista e fattibilita' rispetto al
// target. Liste e controlli di un raccoglitore si cancellano quando si carica la
// sua lista del mese successivo.
//
// Rete, ACI ed extra raccolta restano separati: lista, target e previsione
// riguardano la rete; di ACI ed extra si vedono raccolto e richieste aperte.

// Oltre questo tempo un caricamento ancora aperto si e' interrotto (la soglia del
// registro dei caricamenti).
const FINESTRA_IN_CORSO_MS = 10 * 60 * 1000;

// Il caricamento delle primarie rimasto aperto dopo l'ultimo riuscito, se c'e'.
// Finche' resta aperto le liste non si ricontrollano, perche' l'archivio puo'
// essere a meta' (stessa regola di evasioneAssegnatiDati.ts): la pagina lo dice,
// invece di mostrare in silenzio i controlli del caricamento precedente.
async function primarieInCaricamento() {
  const log = await base44.entities.UploadLog.filter({ tipo_file: 'primarie' }, '-created_date', 20);
  for (const l of log || []) {
    if (l.esito === 'in_corso') return l;
    if (l.esito !== 'errore') return null;
  }
  return null;
}

function testoCaricamentoAperto(l) {
  const inizio = dataServer(l.created_date);
  const chi = [l.utente, l.nome_file].filter(Boolean).join(', ');
  const cosa = `Il caricamento delle primarie del ${dataOraIt(l.created_date)}${chi ? ` (${chi})` : ''}`;
  if (inizio && Date.now() - inizio.getTime() > FINESTRA_IN_CORSO_MS) {
    return `${cosa} risulta interrotto: l'archivio può essere incompleto e il caricamento va ripetuto. Fino ad allora le liste non si ricontrollano e restano i controlli del caricamento precedente.`;
  }
  return `${cosa} non è ancora concluso: le liste si ricontrollano da sole quando si conclude. Intanto restano i controlli del caricamento precedente.`;
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
const attivitaCanali = (riga) => ['aci', 'extra'].some(k => riga.canali && (riga.canali[k].evasi > 0 || riga.canali[k].aperte.length > 0))
  || ['rete', 'aci', 'extra'].some(k => riga.canali && senzaFine(riga.canali[k]) > 0);

function AlertBadge({ riga }) {
  const alert = alertDellaRiga(riga);
  if (!riga.controllo && !alert.length) return <span className="text-muted-foreground">—</span>;
  const alte = alert.filter(a => a.gravita === 'alta').length;
  const medie = alert.filter(a => a.gravita === 'media').length;
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
  if (!canale || (!canale.evasi && !canale.aperte.length && !nSenzaFine)) return <div className="text-xs text-muted-foreground">{etichetta} —</div>;
  return (
    <div className="text-xs tabular-nums">
      <span className="text-muted-foreground">{etichetta}</span> {tonnellate(canale.kg)} t · {canale.evasi} {canale.evasi === 1 ? 'evaso' : 'evasi'}
      {canale.aperte.length > 0 && <span className={`ml-1 font-semibold ${tono}`}>· {canale.aperte.length} {canale.aperte.length === 1 ? 'aperta' : 'aperte'}</span>}
      {nSenzaFine > 0 && <span className="ml-1 font-semibold text-red-600" title="Terminati senza data di fine trasporto: esclusi dal raccolto">· {nSenzaFine} senza fine trasporto</span>}
    </div>
  );
}

// Primo giorno feriale del mese: la data proposta per l'invio delle liste.
function primoFeriale(anno, mese) {
  const d = new Date(Date.UTC(anno, mese - 1, 1));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function RigaRaccoglitore({ riga, isAdmin, occupato, onCarica, onApri, onElimina }) {
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
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <CanaleBreve etichetta="ACI" canale={riga.canali && riga.canali.aci} tono="text-red-600" />
        <CanaleBreve etichetta="Extra" canale={riga.canali && riga.canali.extra} tono="text-amber-700" />
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
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState(null);
  const [occupato, setOccupato] = useState(null);
  const [aperto, setAperto] = useState(null);
  const [inControllo, setInControllo] = useState(false);
  const [tuttiAlert, setTuttiAlert] = useState(false);
  const [mostraAltri, setMostraAltri] = useState(false);
  const [inviataIl, setInviataIl] = useState(primoFeriale(annoOggi, meseOggi));
  const [caricamentoAperto, setCaricamentoAperto] = useState(null);

  const carica = useCallback(async (silenzioso = false) => {
    if (!silenzioso) setCaricando(true);
    setErrore(null);
    try {
      const [res, primarieAperte] = await Promise.all([
        base44.functions.invoke('evasioneAssegnati', { anno, mese }),
        // Se il registro non si legge la pagina resta com'era: e' solo un avviso.
        primarieInCaricamento().catch(() => null),
      ]);
      setDati(res.data || res);
      setCaricamentoAperto(primarieAperte);
    } catch (e) {
      setErrore(messaggioErrore(e) || 'Errore nel caricamento');
    }
    if (!silenzioso) setCaricando(false);
  }, [anno, mese]);

  useEffect(() => { setDati(null); carica(); }, [carica]);
  useEffect(() => { setInviataIl(primoFeriale(anno, mese)); }, [anno, mese]);

  const sposta = (passo) => {
    let m = mese + passo, a = anno;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setMese(m);
    setAnno(a);
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
      if (d.liste_ricontrollate) dettagli.push(`Ricontrollate anche ${d.liste_ricontrollate === 1 ? "un'altra lista" : `${d.liste_ricontrollate} altre liste`} degli altri raccoglitori, nei mesi toccati dal caricamento.`);
      if (senzaColori) dettagli.push('Il file non è in formato xlsx: le righe evidenziate non si possono riconoscere.');
      dettagli.push(...(d.avvisi || []));
      toast({ title: `Lista di ${riga.nome} caricata, inviata il ${dataIt(d.inviata_il || inviataIl)}`, description: dettagli.join(' ') });
    } catch (e) {
      toast({ title: rinviato(e) ? 'Caricamento rinviato' : 'Caricamento non riuscito', description: messaggioErrore(e), variant: 'destructive' });
    }
    // Anche dopo un errore: la lista puo' essere stata salvata senza controllo.
    await carica(true);
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
      await carica(true);
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
    await carica(true);
  };

  const controllaOra = async () => {
    setInControllo(true);
    try {
      await base44.functions.invoke('controllaEvasioneAssegnati', { forza: true });
      await carica(true);
      toast({ title: 'Controllo aggiornato sulle ultime primarie caricate' });
    } catch (e) {
      toast({ title: rinviato(e) ? 'Controllo rinviato' : 'Controllo non riuscito', description: messaggioErrore(e), variant: 'destructive' });
    }
    setInControllo(false);
  };

  const righe = dati ? dati.raccoglitori : [];
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
          Target e "non raccoglie questo mese" si scrivono in Target & Status, scheda Target raccoglitori: se cambiano, il controllo si aggiorna da solo. Caricando la lista del mese successivo, quella precedente e i suoi controlli si cancellano.
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

      {errore && (
        <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errore}</span>
        </div>
      )}

      {caricando && !dati ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Controllo liste e primarie del mese…</div>
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
                  <RigaRaccoglitore key={r.chiave} riga={r} isAdmin={isAdmin} occupato={occupato === r.chiave}
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
                  <RigaRaccoglitore key={r.chiave} riga={r} isAdmin={isAdmin} occupato={occupato === r.chiave}
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

      <DettaglioEvasione riga={aperto} anno={anno} mese={mese} open={!!aperto} onClose={() => setAperto(null)} />
    </div>
  );
}
