import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, Check, Trash2, Bug } from 'lucide-react';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { oggiRoma } from '@/lib/giornoItaliano';
import { formatIntero } from '@/lib/utils';
import {
  NOMI_TIPI, GIORNI_DI_CONSERVAZIONE,
  raggruppaErrori, righeDaTogliere, giorniDaTogliere, primoGiornoTenuto, dataOraItaliana,
  emailPerId, idSenzaEmail,
} from '@/lib/registroErrori';

// GLI ERRORI DEL SITO, LA SCHEDA DELL'AMMINISTRATORE (migliorie del 14/10/2026).
//
// Le pagine annotano da se' gli errori che incontrano (src/lib/registroErrori.js,
// archivio ErroreSito, che legge solo l'amministratore). Qui si guardano gli
// ultimi 7 o 30 giorni, raggruppati per errore uguale (messaggio, pagina,
// chiamata), con chi li ha incontrati e quante volte, e si segnano visti: la voce
// di «Da gestire» dice solo quelli non visti.
//
// Le letture: una all'apertura della scheda (l'archivio intero, a pagine da 5000
// in ordine di id: e' piccolo, venti righe al giorno per sessione al piu', e le
// righe piu' vecchie di 40 giorni si tolgono), e una dopo la pulizia, per
// mostrare quello che e' rimasto davvero. Segnare visti non rilegge: le righe
// cambiano qui.
//
// CHI (revisione del 15/10/2026). La riga porta chi l'ha scritta come
// created_by_id; l'email (created_by) la lettura non la restituisce. Se ci sono
// righe senza email, gli utenti si leggono UNA volta (User.list, come la pagina
// Utenti) e l'email si prende da li'; una seconda lettura solo se compare un id
// che non si conosceva. Se la lettura degli utenti non riesce, gli errori si
// vedono lo stesso, con «utente non riconosciuto».
//
// Le scritture sono dell'amministratore: «Segna visti» con bulkUpdate a blocchi
// di 100 (non e' un numero che fa i conti, quindi niente storico delle
// modifiche: chi e quando stanno nella riga, visto_da e visto_il); «Togli quelli
// più vecchi di 40 giorni» un giorno per volta, con un filtro di uguaglianza sul
// giorno, dopo una conferma sulla pagina. Nessuna cancellazione automatica.
const BLOCCO = 100;
const PERIODI = [7, 30];

const motivo = (e) => (e && (e?.response?.data?.error || e?.data?.error || e.message)) || 'errore sconosciuto';
const gg = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '—');

export default function ErroriSito({ isAdmin, utente }) {
  const [righe, setRighe] = useState(null);
  const [utenti, setUtenti] = useState(null);
  // Gli id gia' cercati fra gli utenti: un id che non c'e' (un utente tolto) non fa rileggere.
  const cercati = useRef(null);
  const [errore, setErrore] = useState(null);
  const [leggendo, setLeggendo] = useState(false);
  const [periodo, setPeriodo] = useState(7);
  const [lavoro, setLavoro] = useState(null);
  const [esito, setEsito] = useState(null);
  const [confermaPulizia, setConfermaPulizia] = useState(false);
  const oggi = oggiRoma();

  // Una lettura che non riesce non riparte da sola: lo dice e offre «Riprova».
  const leggi = useCallback(async () => {
    if (!isAdmin) return;
    setLeggendo(true);
    setErrore(null);
    let lette = null;
    try {
      lette = await fetchAllClient(base44.entities.ErroreSito, null, '-created_date');
      setRighe(lette);
    } catch (e) {
      setErrore(motivo(e));
    }
    setLeggendo(false);
    // Le email di chi: una lettura degli utenti, solo se serve.
    const mancano = idSenzaEmail(lette || []);
    if (mancano.length && mancano.some(id => !(cercati.current && cercati.current.has(id)))) {
      try {
        const m = emailPerId(await base44.entities.User.list('-created_date', 500));
        cercati.current = new Set([...mancano, ...m.keys()]);
        setUtenti(m);
      } catch (_e) { /* restano «utente non riconosciuto» */ }
    }
  }, [isAdmin]);

  useEffect(() => { leggi(); }, [leggi]);

  const gruppi = useMemo(() => raggruppaErrori(righe || [], { oggi, giorni: periodo, utenti }), [righe, oggi, periodo, utenti]);
  const vecchie = useMemo(() => righeDaTogliere(righe || [], oggi), [righe, oggi]);
  const totali = useMemo(() => ({
    volte: gruppi.reduce((s, g) => s + g.volte, 0),
    daVedere: gruppi.filter(g => g.da_vedere.length).length,
    idDaVedere: gruppi.flatMap(g => g.da_vedere),
    // Gli utenti per email, o per id quando l'email non si conosce.
    utenti: new Set(gruppi.flatMap(g => g.chi.map(c => (c.email ? c.email.toLowerCase() : c.id))).filter(Boolean)).size,
  }), [gruppi]);

  if (!isAdmin) return null;

  const segnaVisti = async (ids, chiave) => {
    if (!ids.length || lavoro) return;
    setLavoro(chiave);
    setEsito(null);
    const il = new Date().toISOString();
    const da = (utente && (utente.email || utente.full_name)) || 'amministratore';
    const fatti = new Set();
    try {
      for (let i = 0; i < ids.length; i += BLOCCO) {
        const blocco = ids.slice(i, i + BLOCCO);
        await base44.entities.ErroreSito.bulkUpdate(blocco.map(id => ({ id, visto: true, visto_da: da, visto_il: il })));
        for (const id of blocco) fatti.add(id);
      }
      setEsito({ ok: true, testo: `${fatti.size === 1 ? 'Una riga segnata vista' : `${formatIntero(fatti.size)} righe segnate viste`}.` });
    } catch (e) {
      setEsito({ ok: false, testo: `Non sono riuscito a segnarle viste${fatti.size ? ` (fatte ${formatIntero(fatti.size)} su ${formatIntero(ids.length)})` : ''}: ${motivo(e)}` });
    }
    if (fatti.size) setRighe(prima => (prima || []).map(r => (fatti.has(r.id) ? { ...r, visto: true, visto_da: da, visto_il: il } : r)));
    setLavoro(null);
  };

  const togliVecchie = async () => {
    if (lavoro) return;
    setConfermaPulizia(false);
    setLavoro('pulizia');
    setEsito(null);
    const limite = primoGiornoTenuto(oggi);
    const giorni = giorniDaTogliere(righe || [], oggi).filter(g => g < limite);
    let fatti = 0;
    let caduta = null;
    for (const g of giorni) {
      try {
        await base44.entities.ErroreSito.deleteMany({ giorno: g });
        fatti++;
      } catch (e) {
        caduta = motivo(e);
        break;
      }
    }
    setEsito(caduta
      ? { ok: false, testo: `Tolte le righe di ${formatIntero(fatti)} giorni su ${formatIntero(giorni.length)}, poi si è fermato: ${caduta}. Si può riprovare.` }
      : { ok: true, testo: `Tolte le righe di ${giorni.length === 1 ? 'un giorno' : `${formatIntero(giorni.length)} giorni`}, fino al ${gg(giorni[giorni.length - 1])}.` });
    setLavoro(null);
    await leggi();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-heading font-semibold flex items-center gap-2"><Bug className="w-5 h-5" /> Errori del sito</h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Gli errori che le pagine hanno incontrato: una pagina che si rompe, un errore non preso, una chiamata a una funzione o a un archivio che non riesce.
            Di ogni pagina c'è solo il percorso, e i messaggi sono ripuliti da indirizzi, email e codici. Li vede solo l'amministratore.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PERIODI.map(p => (
            <button key={p} data-periodo={p} onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 text-sm rounded-md border ${periodo === p ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}>
              Ultimi {p} giorni
            </button>
          ))}
          <button data-azione="rileggi" onClick={leggi} disabled={leggendo || !!lavoro} className="px-3 py-1.5 text-sm btn-secondario inline-flex items-center gap-1.5 disabled:opacity-50">
            {leggendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Rileggi
          </button>
        </div>
      </div>

      {errore && (
        <div className="border border-red-200 bg-red-50 rounded-md p-3 text-sm text-red-700 flex flex-wrap items-center gap-2">
          <span>{righe ? 'Gli errori non si sono riletti: quelli a video sono della lettura di prima' : 'Gli errori del sito non si sono letti'} ({errore}).</span>
          <button data-azione="riprova" onClick={leggi} disabled={leggendo} className="px-2 py-1 text-xs border border-red-300 rounded-md hover:bg-red-100">Riprova</button>
        </div>
      )}

      {esito && <div data-esito={esito.ok ? 'ok' : 'errore'} className={`rounded-md p-3 text-sm border ${esito.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{esito.testo}</div>}

      {righe === null && !errore ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Lettura degli errori...</div>
      ) : righe !== null && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p data-riepilogo="periodo">
              {gruppi.length
                ? <>Negli ultimi {periodo} giorni: {totali.volte === 1 ? 'un errore' : `${formatIntero(totali.volte)} errori`} di {gruppi.length === 1 ? 'un genere' : `${formatIntero(gruppi.length)} generi`}{totali.utenti ? `, da ${totali.utenti === 1 ? 'un utente' : `${formatIntero(totali.utenti)} utenti`}` : ''}; {totali.daVedere ? `${formatIntero(totali.daVedere)} da vedere` : 'tutti già visti'}.</>
                : <>Nessun errore negli ultimi {periodo} giorni.</>}
            </p>
            {totali.idDaVedere.length > 0 && (
              <button data-azione="segna-tutti" onClick={() => segnaVisti(totali.idDaVedere, 'tutti')} disabled={!!lavoro}
                className="px-3 py-1.5 text-sm btn-secondario inline-flex items-center gap-1.5 disabled:opacity-50">
                {lavoro === 'tutti' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Segna visti tutti
              </button>
            )}
          </div>

          <div className="space-y-2">
            {gruppi.map(g => (
              <div key={g.chiave} data-gruppo={g.chiave} className={`border rounded-lg p-3 space-y-1.5 ${g.da_vedere.length ? 'border-amber-300 bg-amber-50/40' : 'opacity-75'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-xs px-2 py-0.5 rounded border bg-background">{NOMI_TIPI[g.tipo] || g.tipo || '—'}</span>
                      {g.stato_http ? <span className="text-xs px-2 py-0.5 rounded bg-muted">{g.stato_http}</span> : null}
                      {g.coinvolto ? <span className="text-xs px-2 py-0.5 rounded bg-muted">{g.coinvolto_tipo === 'funzione' ? 'funzione ' : g.coinvolto_tipo === 'archivio' ? 'archivio ' : ''}{g.coinvolto}</span> : null}
                      <span className="text-xs text-muted-foreground">pagina {g.pagina || '—'}</span>
                    </div>
                    <p className="text-sm font-medium break-words" data-messaggio="">{g.messaggio || 'Senza messaggio'}</p>
                    {g.dove ? <p className="text-xs text-muted-foreground break-words">Dove: {g.dove}</p> : null}
                  </div>
                  <div className="text-right text-sm shrink-0">
                    <div className="font-semibold" data-volte={g.volte}>{g.volte === 1 ? 'una volta' : `${formatIntero(g.volte)} volte`}</div>
                    <div className="text-xs text-muted-foreground">ultima il {dataOraItaliana(g.ultimo)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span data-chi="">
                    {g.chi.map(c => `${c.email || 'utente non riconosciuto'} (${formatIntero(c.volte)})`).join(' · ')}
                    {g.sessioni > 1 ? ` · in ${formatIntero(g.sessioni)} sessioni` : ''}
                    {g.primo && g.primo !== g.ultimo ? ` · la prima il ${dataOraItaliana(g.primo)}` : ''}
                  </span>
                  {g.da_vedere.length ? (
                    <button data-azione="segna-visti" data-per={g.chiave} onClick={() => segnaVisti(g.da_vedere, g.chiave)} disabled={!!lavoro}
                      className="px-2 py-1 text-xs btn-secondario inline-flex items-center gap-1 disabled:opacity-50">
                      {lavoro === g.chiave ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Segna visto
                    </button>
                  ) : <span>visto</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="border rounded-lg p-3 bg-muted/20 text-sm space-y-2">
            <p className="font-medium">Conservazione</p>
            <p className="text-xs text-muted-foreground">
              Le righe più vecchie di {GIORNI_DI_CONSERVAZIONE} giorni non servono più: si tolgono da qui, quando vuoi, e non si recuperano. Niente si cancella da solo.
            </p>
            {vecchie.length ? (
              confermaPulizia ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span data-conferma="">Togliere {vecchie.length === 1 ? 'una riga' : `${formatIntero(vecchie.length)} righe`}, fino al {gg(giorniDaTogliere(righe || [], oggi).slice(-1)[0])}?</span>
                  <button data-azione="conferma-pulizia" onClick={togliVecchie} disabled={!!lavoro} className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white inline-flex items-center gap-1.5 disabled:opacity-50">
                    <Trash2 className="w-4 h-4" /> Sì, togli
                  </button>
                  <button data-azione="annulla-pulizia" onClick={() => setConfermaPulizia(false)} className="px-3 py-1.5 text-sm btn-secondario">Annulla</button>
                </div>
              ) : (
                <button data-azione="togli-vecchie" onClick={() => setConfermaPulizia(true)} disabled={!!lavoro}
                  className="px-3 py-1.5 text-sm btn-secondario inline-flex items-center gap-1.5 disabled:opacity-50">
                  {lavoro === 'pulizia' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Togli quelli più vecchi di {GIORNI_DI_CONSERVAZIONE} giorni ({formatIntero(vecchie.length)})
                </button>
              )
            ) : (
              <p className="text-xs text-muted-foreground" data-vecchie="0">Nessuna riga più vecchia di {GIORNI_DI_CONSERVAZIONE} giorni.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
