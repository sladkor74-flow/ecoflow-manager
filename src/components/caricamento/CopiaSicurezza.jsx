import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { DatabaseBackup, HardDriveDownload, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { scaricaCopiaSicurezza, testoAvanzamento, testoErroreCopia, testoUltimaCopia, testoPeso, testoConteggi, testoNonLetti, testoAttesiMancanti } from '@/lib/copiaSicurezza';

// LA COPIA DI SICUREZZA, IN CARICAMENTO DATI (14/10/2026).
//
// Migliorie approvate dall'utente il 14/10/2026 («per me ok ... su quanto da
// creare, procedi pure»): la copia di tutti gli archivi, per esempio ogni
// settimana, scaricata dall'amministratore. La pagina la disegna solo a lui
// (src/pages/CaricamentoDati.jsx); la lettura, il file e il registro stanno in
// src/lib/copiaSicurezza.js, che chiede comunque al server chi e' collegato.
//
// La sezione dice in parole semplici a che cosa serve, dove finisce il file, come
// si conserva e che i dati non lasciano il PC: chi la apre una volta al mese non
// deve indovinare che cosa ha in mano. Un pulsante che lascia una riga nel
// registro non si preme due volte (AGENTS.md, «Lo storico delle modifiche»): si
// spegne mentre la copia va avanti, e un ref ferma il secondo clic di un doppio
// clic. Prova: prove/copiaSicurezza.mjs.

// Il pacchetto del sito che fa la copia, quando la pagina lo sa dire: e' la
// versione del codice che il browser conosce (il commit pubblicato non lo sa).
function versioneDelSito() {
  try {
    const s = typeof document !== 'undefined' && document.querySelector ? document.querySelector('script[type="module"][src]') : null;
    return s ? s.getAttribute('src') : null;
  } catch (_e) {
    return null;
  }
}

// fermo: la pagina sta caricando un file o rifacendo i ricalcoli, e gli archivi
// stanno cambiando. Il registro dei caricamenti non lo dice ancora (un ricalcolo
// scrive la sua nota solo alla fine): la copia aspetta, invece di partire e
// fermarsi a meta' lettura.
export default function CopiaSicurezza({ fermo = false }) {
  // L'ultima copia del registro: undefined finche' non si e' letta, null se non
  // ce n'e' nessuna. Una lettura non riuscita non e' «mai fatta».
  const [ultima, setUltima] = useState(undefined);
  const [ultimaNonLetta, setUltimaNonLetta] = useState(null);
  const [inCorso, setInCorso] = useState(false);
  const [avanzamento, setAvanzamento] = useState(null);
  const [annullando, setAnnullando] = useState(false);
  const [esito, setEsito] = useState(null);
  const segnale = useRef(null);
  const occupato = useRef(false);

  useEffect(() => {
    let vivo = true;
    // Una lettura sola, di una riga.
    base44.entities.CopiaSicurezza.list('-created_date', 1)
      .then((r) => { if (vivo) setUltima((r && r[0]) || null); })
      .catch((e) => { if (vivo) setUltimaNonLetta(String((e && e.message) || e)); });
    return () => { vivo = false; };
  }, []);

  const scarica = async () => {
    if (occupato.current || fermo) return;
    occupato.current = true;
    segnale.current = { annullata: false };
    setInCorso(true);
    setAnnullando(false);
    setEsito(null);
    setAvanzamento({ fase: 'controllo' });
    try {
      const e = await scaricaCopiaSicurezza({ client: base44, segnale: segnale.current, avanzamento: setAvanzamento, versione: versioneDelSito() });
      setEsito({ ok: true, ...e });
      if (e.registrata) { setUltima(e.riga); setUltimaNonLetta(null); }
    } catch (err) {
      setEsito({ ok: false, ...testoErroreCopia(err) });
    } finally {
      setInCorso(false);
      setAvanzamento(null);
      occupato.current = false;
    }
  };

  const annulla = () => {
    if (segnale.current) segnale.current.annullata = true;
    setAnnullando(true);
  };

  const quota = avanzamento && avanzamento.fase === 'lettura' && avanzamento.totale
    ? Math.round((avanzamento.indice / avanzamento.totale) * 100)
    : avanzamento && ['attesi', 'verifica', 'compressione', 'registro'].includes(avanzamento.fase) ? 100 : 0;

  return (
    <section id="copia-sicurezza" className="rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-white shadow-sm">
          <DatabaseBackup className="w-6 h-6 text-foreground" />
        </div>
        <div className="flex-1 space-y-2">
          <h2 className="font-heading font-semibold">Copia di sicurezza</h2>
          <p className="text-sm text-muted-foreground">
            Scarica in un file solo tutti gli archivi del gestionale: movimenti, anagrafiche, target, tariffe, dichiarazioni, fatturazione e registri.
            Serve a non perdere niente se un dato sparisce o viene rovinato, e a sapere com&apos;erano i numeri in un certo giorno.
          </p>
          <ul className="text-sm text-muted-foreground list-disc ml-5 space-y-1">
            <li>Il file si chiama <span className="font-mono text-xs">treadrider-copia-aaaa-mm-gg.json.gz</span> e finisce nella cartella <strong>Download</strong> del PC.</li>
            <li>Spostalo in una cartella tua (per esempio «Copie del gestionale» nei Documenti) e ogni tanto anche su un disco esterno o una chiavetta. Tieni almeno le ultime quattro.</li>
            <li>I dati non lasciano il PC: la copia si prepara qui nel browser e non viene caricata da nessuna parte. Nel gestionale resta solo una riga con il giorno, chi l&apos;ha fatta e quanto pesa.</li>
            <li>Contiene tutto, anche costi e prezzi dei fornitori: conservala come un documento riservato. I documenti allegati (PDF, scansioni, fogli caricati) non sono nel file: la copia tiene i loro riferimenti.</li>
            <li>Conviene farla una volta alla settimana, per esempio il lunedì: dopo sette giorni la dashboard te lo ricorda. Ci vogliono pochi minuti, e durante un caricamento non si può fare.</li>
          </ul>
        </div>
      </div>

      <p className="text-sm">
        <span className="font-medium">Ultima copia: </span>
        {ultimaNonLetta
          ? <span className="text-amber-700">non letta ({ultimaNonLetta})</span>
          : ultima === undefined
            ? <span className="text-muted-foreground">—</span>
            : ultima
              ? <span>{testoUltimaCopia(ultima)}</span>
              : <span className="text-amber-700">nessuna copia scaricata finora.</span>}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={scarica} disabled={inCorso || fermo}>
          {inCorso ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <HardDriveDownload className="w-4 h-4 mr-1.5" />}
          Scarica la copia di sicurezza
        </Button>
        {inCorso && (
          <Button variant="outline" onClick={annulla} disabled={annullando}>
            <X className="w-4 h-4 mr-1.5" /> {annullando ? 'Annullo…' : 'Annulla'}
          </Button>
        )}
      </div>

      {fermo && !inCorso && (
        <p className="text-xs text-amber-700">Aspetta che finiscano il caricamento e i ricalcoli in corso in questa pagina: la copia li prenderebbe a metà.</p>
      )}

      {inCorso && avanzamento && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>{testoAvanzamento(avanzamento)}</p>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${quota}%` }} />
          </div>
        </div>
      )}

      {esito && !esito.ok && <p className={`text-sm ${esito.classe}`}>{esito.testo}</p>}
      {esito && esito.ok && (
        <div className="text-sm space-y-1">
          <p className="text-green-700">
            Copia scaricata: <span className="font-mono text-xs">{esito.nomeFile}</span> ({testoPeso(esito.kb)}, {testoConteggi(esito)}).
            La trovi nella cartella Download: spostala nella cartella delle copie.
          </p>
          {/* Che cosa manca si scrive nel testo, per nome: un title al tocco e
              sul telefono non si vede (revisione del 15/10/2026). */}
          {testoNonLetti(esito.nonLetti) && (
            <p className="text-amber-700">{testoNonLetti(esito.nonLetti)}</p>
          )}
          {/* Giacenze o Dichiarazioni senza risposta: la copia vale come copia
              di sicurezza, non come copia dei dati veri dei controlli. Prima
              usciva come buona senza dirlo (revisione del 15/10/2026). */}
          {testoAttesiMancanti(esito.attesiNonRisposti) && (
            <p className="text-amber-700">{testoAttesiMancanti(esito.attesiNonRisposti)}</p>
          )}
          {!esito.registrata && (
            <p className="text-amber-700">
              Il file c&apos;è, ma la copia non è finita nel registro delle copie ({esito.motivoRegistro}): la dashboard continuerà a ricordarla.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
