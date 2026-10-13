import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Info, Upload, Download, RefreshCw, ExternalLink, FileSignature } from 'lucide-react';
import { formatTonnellate } from '@/lib/utils';
import { TIPI_CONTRATTO, STATI_CONTRATTO, nomeTipo, nomeCanale, nomeFileContratto, dataIt } from '@/lib/contrattiFornitori';
import { leggiModello, scarica } from '@/lib/docxModello';
import { compilaContratto, puntiDelModello } from '@/lib/modelliContratto';
import { puntoDi, valoriDiPartenza, valoreNelDocumento, leggiNumeroItaliano, scriviPrezzo, campoDellaQuantita } from '@/lib/segnapostiContratto';
import { linkFile, motivoApertura } from '@/lib/apriFile';
import ModelliContratti from '@/components/qualifica/ModelliContratti';

// I contratti dell'anno ai fornitori: chi va contrattualizzato, per quale
// prestazione, su quale canale, e a che punto e' ciascun contratto.
//
// GIRO K3 DELLE SEGNALAZIONI DEL 20/09, corretto il 12/10/2026:
// - tutti i contratti, rete e ACI (decisione dell'utente dell'11/10/2026: «si deve
//   generare tutti i contratti sia rete che aci come raccolta, trattamento e
//   stoccaggio»). Ogni prestazione ha una riga per canale, col suo modello e i
//   suoi valori: rete e ACI non si sommano mai. La situazione la fa la funzione
//   contrattiAnno (regole in base44/shared/contrattiDellAnno.ts);
// - riaprendo un contratto gia' generato si riparte dai SUOI valori, non dalla
//   proposta dell'anno prima (valoriDiPartenza): prima i due rami erano uguali e
//   rigenerando il Word usciva coi corrispettivi dell'anno prima;
// - rigenerare un contratto inviato o controfirmato chiede una conferma esplicita
//   e la versione di prima resta nello storico del contratto; il controfirmato si
//   carica (file e data), e se il catalogo della qualifica ha la voce «contratto»
//   diventa anche il documento di qualifica. Le due scritture passano dalla
//   funzione salvaContrattoFornitore, che sola vede i riferimenti ai file;
// - i valori vengono dai dati del gestionale e non s'inventano: il prezzo dalla
//   tariffa passiva valida nell'anno, la quantita' dal target, i dati del
//   fornitore dall'anagrafica. Un valore che manca resta da scrivere a mano, e
//   nel Word il segnaposto si vede: mai uno zero al posto di un numero che non c'e'.
//
// I modelli si caricano nella sezione «Modelli dei contratti» (ModelliContratti.jsx).

function Pastiglia({ stato }) {
  const s = STATI_CONTRATTO[stato] || (stato === 'non_dovuto'
    ? { nome: 'Non dovuto', classe: 'border-muted bg-muted/20 text-muted-foreground line-through' }
    : STATI_CONTRATTO.mancante);
  return <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] whitespace-nowrap ${s.classe}`}>{s.nome}</span>;
}

const erroreDi = (e) => e?.response?.data?.error || e?.data?.error || e?.message || String(e);
const datiErrore = (e) => e?.response?.data || e?.data || {};
const oggiRoma = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
const nomeCanaleRiga = (r) => (r.tipo === 'trasporto_secondaria' ? 'rete e ACI' : nomeCanale(r.canale));

export default function ContrattiAnno({ anno, isAdmin }) {
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState('');
  const [apri, setApri] = useState(null);       // { soggetto, riga }
  const [firmato, setFirmato] = useState(null); // { soggetto, riga }
  const [occupato, setOccupato] = useState(false);

  const carica = useCallback(async () => {
    setCaricando(true);
    setErrore('');
    try {
      const res = await base44.functions.invoke('contrattiAnno', { anno });
      setDati(res.data || res);
    } catch (e) {
      setErrore(erroreDi(e) || 'Errore nel caricamento');
    }
    setCaricando(false);
  }, [anno]);

  useEffect(() => { carica(); }, [carica]);

  // Un contratto generato non e' un contratto fatto: va inviato al fornitore e
  // deve tornare controfirmato. Il controfirmato si segna anche senza file (la
  // copia firmata puo' arrivare dopo, e si carica con «carica il controfirmato»).
  const avanza = async (riga, nome) => {
    const passo = riga.stato === 'generato' ? { stato: 'inviato', campo: 'inviato_il', testo: 'inviato al fornitore' }
      : riga.stato === 'inviato' ? { stato: 'controfirmato', campo: 'controfirmato_il', testo: 'tornato controfirmato' } : null;
    if (!passo || !riga.contratto_id) return;
    const oggi = oggiRoma();
    const g = window.prompt(`${nome}: in che giorno il contratto è ${passo.testo}? (AAAA-MM-GG)`, oggi);
    if (g === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.trim()) || g.trim() > oggi) { setErrore('La data va scritta come AAAA-MM-GG e non può essere futura.'); return; }
    setOccupato(true);
    try {
      await base44.entities.ContrattoFornitore.update(riga.contratto_id, { stato: passo.stato, [passo.campo]: g.trim() });
      await carica();
    } catch (e) { setErrore(erroreDi(e) || 'Il passaggio non è stato salvato'); }
    setOccupato(false);
  };

  const apriDocumento = async (riga) => {
    setErrore('');
    try { window.open(await linkFile('ContrattoFornitore', riga.contratto_id), '_blank', 'noopener'); } catch (e) { setErrore(motivoApertura(e)); }
  };

  if (caricando && !dati) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Leggo la situazione contrattuale…</div>;
  }

  const daDecidere = dati ? dati.da_decidere || 0 : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          I fornitori da contrattualizzare sono gli stessi della qualifica, con il ruolo e il canale che hanno nei movimenti: chi raccoglie sulla rete
          vuole un contratto di raccolta di rete, chi raccoglie anche sull&apos;ACI ne vuole un secondo, distinto, col suo modello e i suoi valori. Rete e
          ACI non si sommano mai; l&apos;extra raccolta non ha contratti annuali. Il contratto si genera dal modello cambiando solo i punti che variano:
          dati del fornitore dall&apos;anagrafica, quantità dal target, prezzo dalla tariffa passiva valida nell&apos;anno, date di validità. Quello che il
          gestionale non ha resta da scrivere, mai uno zero.
          {dati && dati.anno_prima && (dati.anno_prima_atteso
            ? ` Il ${dati.anno} non è ancora cominciato: chi ha lavorato nel ${dati.anno_prima} è atteso anche nel ${dati.anno}.`
            : dati.anno_prima_ultimo_trimestre
              // Da gennaio a marzo (revisione del 13/10/2026): i contratti chiudono al
              // 31/12 senza tacito rinnovo, e chi lavorava a fine anno va rifatto.
              ? ` Fino al 31/03/${dati.anno} chi ha lavorato nell'ultimo trimestre del ${dati.anno_prima}, per quella prestazione e su quel canale, è atteso anche nel ${dati.anno}: i contratti chiudono al 31/12 senza tacito rinnovo. Gli altri fornitori del ${dati.anno_prima}, senza movimenti né un contratto nel ${dati.anno}, sono «da decidere» e non si contano.`
              : ` Ci sono anche i fornitori del ${dati.anno_prima}: chi nel ${dati.anno} non ha ancora movimenti né un contratto è «da decidere» e non si conta.`)}
        </span>
      </div>

      {errore && (
        <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errore}</span>
        </div>
      )}

      {dati && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {[
                { n: dati.totali.attesi, l: 'contratti attesi' },
                { n: dati.totali.controfirmati, l: 'controfirmati' },
                { n: dati.totali.da_fare, l: 'ancora da fare' },
                ...(daDecidere ? [{ n: daDecidere, l: 'da decidere, non contati' }] : []),
              ].map(k => (
                <div key={k.l} className="px-3 py-2 rounded-md border bg-card min-w-[130px]">
                  <div className="text-lg font-heading font-bold tabular-nums">{k.n}</div>
                  <div className="text-[11px] text-muted-foreground">{k.l}</div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={carica} disabled={occupato || caricando}><RefreshCw className={`w-4 h-4 mr-1.5 ${caricando ? 'animate-spin' : ''}`} />Ricarica</Button>
          </div>

          {isAdmin && <ModelliContratti modelli={dati.modelli} onCambiati={carica} />}

          <div className="border rounded-lg bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Fornitore</th>
                  {TIPI_CONTRATTO.map(t => <th key={t.chiave} className="px-3 py-2.5 font-semibold whitespace-nowrap">{t.nome}</th>)}
                </tr>
              </thead>
              <tbody>
                {dati.soggetti.map(s => (
                  <tr key={s.chiave} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{s.nome}</div>
                      <div className="text-[11px] text-muted-foreground">{s.piva ? `P.IVA ${s.piva}` : 'partita IVA non in anagrafica'}</div>
                      {s.origine === 'anno_prima' && <div className="text-[11px] text-muted-foreground">dai movimenti del {dati.anno_prima}</div>}
                      {s.origine === 'contratto' && <div className="text-[11px] text-muted-foreground">ha un contratto del {dati.anno}, non movimenti</div>}
                      {s.origine === 'manuale' && <div className="text-[11px] text-muted-foreground">incluso a mano nella qualifica</div>}
                    </td>
                    {TIPI_CONTRATTO.map(t => {
                      const righe = s.contratti.filter(c => c.tipo === t.chiave);
                      if (!righe.length) return <td key={t.chiave} className="px-3 py-2 text-muted-foreground">—</td>;
                      return (
                        <td key={t.chiave} className="px-3 py-2 space-y-2">
                          {righe.map(r => (
                            <div key={r.canale} className={r.da_decidere ? 'opacity-70' : ''}>
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{nomeCanaleRiga(r)}</div>
                              <button type="button" disabled={!isAdmin || r.non_dovuto} onClick={() => setApri({ soggetto: s, riga: r })}
                                title={r.motivo_non_dovuto || undefined}
                                className={`text-left ${isAdmin && !r.non_dovuto ? 'hover:underline' : 'cursor-default'}`}>
                                <Pastiglia stato={r.stato} />
                                {r.da_decidere && <span className="ml-1 text-[10px] px-1 rounded bg-amber-100 text-amber-800">da decidere</span>}
                              </button>
                              {r.non_dovuto && <div className="text-[11px] text-muted-foreground">{r.motivo_non_dovuto}</div>}
                              {r.contratto && r.contratto.data_fine && <div className="text-[11px] text-muted-foreground">fino al {dataIt(r.contratto.data_fine)}</div>}
                              {!r.contratto && r.precedente && <div className="text-[11px] text-muted-foreground">c&apos;è il {r.precedente.anno}</div>}
                              {r.contratto && r.contratto.inviato_il && <div className="text-[11px] text-muted-foreground">inviato il {dataIt(r.contratto.inviato_il)}</div>}
                              {r.contratto && r.contratto.controfirmato_il && <div className="text-[11px] text-emerald-700">controfirmato il {dataIt(r.contratto.controfirmato_il)}{r.contratto.documento_firmato ? ', firmato caricato' : ''}</div>}
                              {r.contratto && r.contratto.versioni > 0 && <div className="text-[11px] text-muted-foreground">{r.contratto.versioni} {r.contratto.versioni === 1 ? 'versione precedente' : 'versioni precedenti'} nello storico</div>}
                              {isAdmin && r.contratto && (
                                <div className="flex flex-wrap gap-x-2 text-[11px] mt-0.5">
                                  {r.contratto.ha_file && <button type="button" onClick={() => apriDocumento(r)} className="text-primary hover:underline inline-flex items-center gap-0.5"><ExternalLink className="w-3 h-3" />apri</button>}
                                  {(r.stato === 'generato' || r.stato === 'inviato') && (
                                    <button type="button" disabled={occupato} onClick={() => avanza(r, s.nome)} className="text-primary hover:underline">
                                      {r.stato === 'generato' ? 'segna inviato' : 'segna controfirmato'}
                                    </button>
                                  )}
                                  {(r.stato === 'generato' || r.stato === 'inviato' || (r.stato === 'controfirmato' && !r.contratto.documento_firmato)) && (
                                    <button type="button" disabled={occupato} onClick={() => setFirmato({ soggetto: s, riga: r })} className="text-primary hover:underline">carica il controfirmato</button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {dati.soggetti.length === 0 && (
                  <tr><td colSpan={TIPI_CONTRATTO.length + 1} className="px-3 py-8 text-center text-muted-foreground">Nessun fornitore da contrattualizzare.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {apri && (
        <ProceduraContratto
          anno={dati.anno}
          soggetto={apri.soggetto}
          riga={apri.riga}
          modelli={dati.modelli}
          onChiudi={() => setApri(null)}
          onSalvato={() => { setApri(null); carica(); }}
          setOccupato={setOccupato}
        />
      )}

      {firmato && (
        <CaricaControfirmato
          soggetto={firmato.soggetto}
          riga={firmato.riga}
          anno={dati.anno}
          onChiudi={() => setFirmato(null)}
          onSalvato={() => { setFirmato(null); carica(); }}
        />
      )}
    </div>
  );
}

// ─── la procedura per un singolo contratto ───

// I segnaposto che un modello vecchio aveva in piu' forme: si scrivono da soli
// dalla data (valoriPerIlDocumento) e non si chiedono.
const DERIVATO = /_(IT|LUNGA)$/;

const FONTI = {
  contratto: 'il contratto già generato',
  precedente: 'il contratto dell\'anno prima',
  anagrafica: 'l\'anagrafica',
  calendario: 'il calendario',
  target: 'Target & Status',
  target_copiato: 'Target & Status, copiato e da confermare',
  tariffa: 'la tariffa passiva',
  // una copia di «Prepara l'anno» riscritta col prezzo nuovo e non ancora
  // confermata (revisione del 13/10/2026)
  tariffa_da_confermare: 'la tariffa passiva, ancora da confermare',
};

function ProceduraContratto({ anno, soggetto, riga, modelli, onChiudi, onSalvato, setOccupato }) {
  const canaleModello = riga.canale || 'RETE';
  const modelliBuoni = modelli.filter(m => m.tipo_contratto === riga.tipo && (m.canale || 'RETE') === canaleModello);
  const [modelloId, setModelloId] = useState((riga.contratto && riga.contratto.modello_id && modelliBuoni.some(m => m.id === riga.contratto.modello_id) && riga.contratto.modello_id)
    || riga.modello_id || (modelliBuoni[0] && modelliBuoni[0].id) || '');
  const proposta = riga.proposta || { valori: {}, fonti: {}, avvisi: [], tariffe: [], tariffe_anno_prima: [] };
  // Riaprendo un contratto si riparte dai SUOI valori (segnalazione del 20/09,
  // corretta il 12/10/2026); un contratto nuovo parte dalla proposta.
  const partenza = valoriDiPartenza(riga);
  const [valori, setValori] = useState(partenza.valori);
  const [errore, setErrore] = useState('');
  const [lavoro, setLavoro] = useState(false);
  const giaFuori = riga.stato === 'inviato' || riga.stato === 'controfirmato';
  const [confermo, setConfermo] = useState(false);
  const [chiedeConferma, setChiedeConferma] = useState('');

  const modello = modelli.find(m => m.id === modelloId) || null;
  const punti = modello ? puntiDelModello(modello) : [];
  // I campi da chiedere: i punti del modello; per un modello di prima i suoi
  // segnaposto; senza modello quello che il gestionale propone.
  const segnaposti = (() => {
    if (punti.length) return punti.map(p => p.segnaposto);
    if (modello && modello.segnaposti_json) { try { return JSON.parse(modello.segnaposti_json).filter(s => !DERIVATO.test(s)); } catch { /* sotto */ } }
    return Object.keys({ ...proposta.valori, ...valori });
  })().filter(s => s !== 'ANNO');
  const puntoDelModello = (s) => punti.find(p => p.segnaposto === s) || puntoDi(s);
  const vecchi = (riga.precedente && riga.precedente.valori) || {};
  const vuoti = segnaposti.filter(s => valori[s] === undefined || valori[s] === null || String(valori[s]).trim() === '');

  const cambia = (k, v) => setValori(p => ({ ...p, [k]: v }));
  const leggibile = (k, v) => valoreNelDocumento(k, v, puntoDelModello(k)) || '—';

  const genera = async (conferma = false) => {
    setErrore('');
    if (!modello) { setErrore('Scegli il modello da cui partire.'); return; }
    if (giaFuori && !confermo && !conferma) { setErrore(`Questo contratto è già ${riga.stato}: spunta la conferma per rigenerarlo.`); return; }
    setLavoro(true);
    setOccupato(true);
    try {
      // Il modello si scarica con un link temporaneo che chiede il server: il
      // riferimento al file non arriva nel browser (05/10/2026, src/lib/apriFile.js).
      const risposta = await fetch(await linkFile('ModelloContratto', modello.id));
      if (!risposta.ok) throw new Error('Non riesco a scaricare il modello (' + risposta.status + ').');
      const letto = await leggiModello(await risposta.blob());

      const completi = { ...valori, ANNO: String(anno) };
      const { blob, segnaposti_vuoti } = compilaContratto(letto, completi, punti);
      const nomeFile = nomeFileContratto({ anno, soggetto: soggetto.nome, tipo: riga.tipo, canale: riga.tipo === 'trasporto_secondaria' ? 'RETE' : riga.canale });
      const file = new File([blob], nomeFile, { type: blob.type });
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });

      // La quantita' annua salvata sul contratto (la legge EcoTyna) e' quella
      // scritta nel Word: il punto che il modello ha, TARGET_TON nella raccolta e
      // QUOTA_TON negli altri. Non la prima scritta fra i due: la proposta li
      // riempie tutti e due, e correggendo QUOTA_TON nel trattamento restava
      // salvato il target nascosto in TARGET_TON (revisione del 13/10/2026).
      // Nessuna quantita' scritta e' null, non zero.
      const campoQuantita = campoDellaQuantita(riga.tipo, segnaposti);
      const quantita = campoQuantita ? leggiNumeroItaliano(valori[campoQuantita]) : null;
      const dati = {
        anno,
        soggetto_chiave: soggetto.chiave,
        soggetto_nome: soggetto.nome,
        tipo_contratto: riga.tipo,
        canale: canaleModello,
        modello_id: modello.id,
        modello_nome: modello.nome,
        contratto_precedente_id: riga.precedente_id || undefined,
        data_inizio: valori.DATA_INIZIO || undefined,
        data_fine: valori.DATA_FINE || undefined,
        quantitativo_previsto_t: quantita === null ? undefined : quantita,
        condizioni_pagamento: valori.PAGAMENTO || undefined,
        valori_json: JSON.stringify(valori),
        note: segnaposti_vuoti.length ? `Segnaposto senza valore, rimasti nel documento: ${segnaposti_vuoti.join(', ')}` : '',
      };
      try {
        await base44.functions.invoke('salvaContrattoFornitore', {
          azione: 'genera', contratto_id: riga.contratto_id || undefined, dati, file_uri, file_nome: nomeFile,
          // La conferma vale se spuntata qui, o se data dopo la risposta della
          // funzione (il contratto era diventato «inviato» a pagina aperta).
          conferma_rigenera: (giaFuori && confermo) || conferma ? true : undefined,
        });
      } catch (e) {
        // Il contratto e' diventato inviato o controfirmato mentre la pagina era
        // aperta: la funzione non lo sostituisce senza conferma.
        if (datiErrore(e).serve_conferma) { setChiedeConferma(datiErrore(e).error || 'Il contratto è già fuori: conferma per rigenerarlo.'); setLavoro(false); setOccupato(false); return; }
        throw e;
      }
      scarica(blob, nomeFile);

      if (segnaposti_vuoti.length) {
        setErrore(`Documento generato e salvato, ma ${segnaposti_vuoti.length} segnaposto sono rimasti senza valore e nel Word si vedono ancora: ${segnaposti_vuoti.join(', ')}. Compilali a mano o rigenera dopo averli scritti qui.`);
        setLavoro(false);
        setOccupato(false);
        return;
      }
      onSalvato();
    } catch (e) {
      setErrore(erroreDi(e));
    }
    setLavoro(false);
    setOccupato(false);
  };

  const tariffeTesto = (elenco) => (elenco || []).map(t => `${scriviPrezzo(t.valore)} ${t.unita_misura}${t.dove ? ` (${t.dove})` : ''}${t.da_confermare ? ', ancora da confermare' : ''}`).join('; ');

  return (
    <Dialog open onOpenChange={(x) => { if (!x) onChiudi(); }}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{nomeTipo(riga.tipo)} {nomeCanaleRiga(riga)} {anno} · {soggetto.nome}</DialogTitle>
          <DialogDescription>
            {partenza.da === 'contratto'
              ? 'Il contratto è già stato generato: i valori sono quelli salvati con lui.'
              : riga.precedente
                ? ` C'è il contratto ${riga.precedente.anno}: i dati del fornitore che l'anagrafica non ha, il pagamento e la polizza partono da lì; date, quantità e prezzi si ricalcolano.`
                : ' Non c\'è un contratto dell\'anno prima nel gestionale: i valori vengono dall\'anagrafica, dal target e dalle tariffe.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {riga.da_decidere && (
            <div className="text-xs text-amber-800">Nel {anno} questo fornitore non ha ancora movimenti per questa prestazione su questo canale: c&apos;era nel {riga.precedente ? riga.precedente.anno : anno - 1}. Decidi tu se il contratto serve.</div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Modello</label>
            <select value={modelloId} onChange={e => setModelloId(e.target.value)} className="w-full px-2 py-1.5 rounded-md border bg-card text-sm">
              <option value="">— scegli —</option>
              {modelliBuoni.map(m => <option key={m.id} value={m.id}>{m.nome} ({m.file_nome})</option>)}
            </select>
            {modelliBuoni.length === 0 && (
              <p className="text-xs text-amber-800">Per {nomeTipo(riga.tipo).toLowerCase()} {nomeCanaleRiga(riga)} non c&apos;è ancora un modello: caricalo in «Modelli dei contratti».</p>
            )}
          </div>

          {proposta.avvisi && proposta.avvisi.length > 0 && (
            <ul className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 space-y-0.5 list-disc pl-6">
              {proposta.avvisi.map(a => <li key={a}>{a}</li>)}
            </ul>
          )}
          {(proposta.tariffe || []).length > 0 && <p className="text-xs text-muted-foreground">Tariffe passive valide nel {anno}: {tariffeTesto(proposta.tariffe)}.</p>}
          {/* Le copie di «Prepara l'anno» ancora da confermare sono un riferimento, non
              il prezzo: si confermano proprio sul contratto (revisione del 13/10/2026). */}
          {(proposta.tariffe_copiate || []).length > 0 && (
            <p className="text-xs text-amber-800">Copiate dal {anno - 1} con «Prepara l&apos;anno», da confermare, solo come riferimento: {tariffeTesto(proposta.tariffe_copiate)}. Il prezzo lo decide il contratto.</p>
          )}
          {(proposta.tariffe_anno_prima || []).length > 0 && (
            <p className="text-xs text-muted-foreground">Nel {anno - 1}, solo come riferimento: {tariffeTesto(proposta.tariffe_anno_prima)}. Il prezzo del {anno} lo decide il contratto nuovo.</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {segnaposti.map(k => {
              const p = puntoDelModello(k);
              const fonte = partenza.salvati.includes(k) ? 'contratto' : proposta.fonti && proposta.fonti[k];
              const proposto = proposta.valori ? proposta.valori[k] : undefined;
              const diverso = proposto !== undefined && String(proposto) !== String(valori[k] ?? '');
              const lungo = k === 'PAGAMENTO' || k === 'FORNITORE_SEDE_LEGALE' || k === 'FORNITORE_SEDE_OPERATIVA';
              const vuoto = vuoti.includes(k);
              return (
                <div key={k} className={lungo ? 'md:col-span-2 space-y-1' : 'space-y-1'}>
                  <label className="text-xs font-medium flex items-center gap-1.5 flex-wrap">
                    {p.nome}
                    {fonte && FONTI[fonte] && <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">da {FONTI[fonte]}</span>}
                    {vuoto && <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-800">da scrivere</span>}
                  </label>
                  {lungo ? (
                    <textarea rows={2} value={valori[k] ?? ''} onChange={e => cambia(k, e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
                  ) : (
                    <input type={p.tipo === 'data' ? 'date' : 'text'} value={valori[k] ?? ''} onChange={e => cambia(k, e.target.value)}
                      inputMode={p.tipo === 'prezzo' || p.tipo === 'quantita' ? 'decimal' : undefined}
                      className="w-full border rounded px-2 py-1 text-sm" />
                  )}
                  {(p.tipo === 'prezzo' || p.tipo === 'quantita' || p.tipo === 'data') && valori[k] !== undefined && String(valori[k]).trim() !== '' && (
                    <p className="text-[11px] text-muted-foreground">nel documento: {leggibile(k, valori[k])}</p>
                  )}
                  {riga.precedente && vecchi[k] !== undefined && String(vecchi[k]) !== String(valori[k] ?? '') && (
                    <p className="text-[11px] text-muted-foreground">nel {riga.precedente.anno}: {leggibile(k, vecchi[k])}</p>
                  )}
                  {partenza.da === 'contratto' && diverso && (
                    <p className="text-[11px] text-blue-800">
                      oggi il gestionale proporrebbe {leggibile(k, proposto)}{' '}
                      <button type="button" className="underline" onClick={() => cambia(k, proposto)}>usa questo</button>
                    </p>
                  )}
                  {(k === 'TARGET_TON' || k === 'QUOTA_TON') && riga.target_t != null && (
                    <p className="text-[11px] text-muted-foreground">
                      da Target &amp; Status: {formatTonnellate(riga.target_t)} t
                      {riga.target_anno && Number(riga.target_anno) !== Number(anno) && (
                        <span className="text-amber-700"> — è il target del {riga.target_anno}: quello del {anno} non è ancora scritto in Target &amp; Status.</span>
                      )}
                      {riga.target_copiato && (
                        <span className="text-amber-700"> — copiato dal {Number(riga.target_anno || anno) - 1} con «Prepara l&apos;anno», da confermare: la quantità la decide il contratto.</span>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {vuoti.length > 0 && modello && (
            <p className="text-xs text-amber-800">
              {vuoti.length === 1 ? 'Un punto è' : `${vuoti.length} punti sono`} ancora da scrivere ({vuoti.map(k => puntoDelModello(k).nome).join(', ')}): generando ora, nel Word resta il segnaposto da compilare a mano.
            </p>
          )}

          {giaFuori && (
            <div className="border border-red-300 bg-red-50 text-red-900 rounded-lg px-3 py-2 text-sm space-y-1.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Questo contratto è già <b>{riga.stato}</b>
                  {riga.stato === 'controfirmato' && riga.contratto && riga.contratto.controfirmato_il ? ` il ${dataIt(riga.contratto.controfirmato_il)}` : ''}
                  {riga.stato === 'inviato' && riga.contratto && riga.contratto.inviato_il ? ` il ${dataIt(riga.contratto.inviato_il)}` : ''}.
                  Rigenerandolo torna «generato» e il documento nuovo prende il posto di quello {riga.stato === 'controfirmato' ? 'firmato' : 'mandato al fornitore'}.
                  La versione di prima non si perde: resta nello storico del contratto, col suo file e le sue date.
                </span>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input type="checkbox" checked={confermo} onChange={e => setConfermo(e.target.checked)} />
                Lo so: rigeneralo lo stesso, e tieni la versione di prima nello storico.
              </label>
            </div>
          )}

          {chiedeConferma && (
            <div className="border border-red-300 bg-red-50 text-red-900 rounded-lg px-3 py-2 text-sm space-y-2">
              <div>{chiedeConferma}</div>
              <Button size="sm" variant="destructive" disabled={lavoro} onClick={() => { setChiedeConferma(''); genera(true); }}>Rigenera e tieni la versione di prima</Button>
            </div>
          )}

          {errore && (
            <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errore}</span>
            </div>
          )}

          {riga.contratto && riga.contratto.file_nome && !giaFuori && (
            <p className="text-xs text-muted-foreground">Già generato: {riga.contratto.file_nome}. Rigenerando, il documento nuovo prende il suo posto e quello di adesso resta nello storico.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onChiudi}>Chiudi</Button>
          <Button onClick={() => genera(false)} disabled={lavoro || !modelloId || (giaFuori && !confermo)}>
            {lavoro ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {riga.contratto ? 'Rigenera e scarica' : 'Genera e scarica'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── il contratto controfirmato ───

function CaricaControfirmato({ soggetto, riga, anno, onChiudi, onSalvato }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [giorno, setGiorno] = useState(oggiRoma());
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState('');
  const [esito, setEsito] = useState(null);
  // La lettura del documento di qualifica: '' (nessuna), 'in_corso', 'fatta', o il motivo per cui non e' riuscita.
  const [lettura, setLettura] = useState('');

  // Il firmato diventato documento di qualifica nasce «in_attesa» e qualcuno lo
  // deve leggere: il caricamento a mano nella scheda del fornitore chiama subito
  // analizzaDocumentoQualifica, da qui non lo chiamava nessuno, e dopo dieci
  // minuti la qualifica lo mostrava «da verificare» per un'analisi «interrotta»
  // mai partita, fino al presidio del mattino dopo (revisione del 13/10/2026).
  // Stessa chiamata e stesso contesto di SoggettoDettaglio. La lettura puo'
  // durare un minuto: se il browser smette di aspettare la funzione continua.
  const leggiDocumento = async (documentoId) => {
    setLettura('in_corso');
    try {
      await base44.functions.invoke('analizzaDocumentoQualifica', {
        documento_id: documentoId,
        contesto: { nome: soggetto.nome, piva: soggetto.piva, codice_fiscale: soggetto.fornitore ? soggetto.fornitore.codice_fiscale : undefined },
      });
      setLettura('fatta');
    } catch (e) {
      setLettura(erroreDi(e) || 'la lettura non è riuscita');
    }
  };

  const salva = async () => {
    setErrore('');
    if (!file) { setErrore('Scegli il file del contratto firmato.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno) || giorno > oggiRoma()) { setErrore('La data della firma non può essere futura.'); return; }
    setLavoro(true);
    try {
      // Area privata: il contratto firmato e' un documento aziendale.
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const res = await base44.functions.invoke('salvaContrattoFornitore', {
        azione: 'controfirmato', contratto_id: riga.contratto_id, file_uri, file_nome: file.name, giorno,
      });
      const fatto = res.data || res;
      setEsito(fatto);
      if (fatto && fatto.documento_qualifica_id) leggiDocumento(fatto.documento_qualifica_id);
    } catch (e) {
      setErrore(erroreDi(e));
    }
    setLavoro(false);
  };

  return (
    <Dialog open onOpenChange={(x) => { if (!x) { if (esito) onSalvato(); else onChiudi(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Contratto controfirmato · {soggetto.nome}</DialogTitle>
          <DialogDescription>
            {nomeTipo(riga.tipo)} {nomeCanaleRiga(riga)} {anno}. Il firmato diventa il documento del contratto; quello generato resta nello storico.
            Se il catalogo della qualifica ha la voce del contratto per questo ruolo, il firmato diventa anche il documento di qualifica del fornitore.
          </DialogDescription>
        </DialogHeader>
        {!esito ? (
          <div className="space-y-3">
            <input ref={input} type="file" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) setFile(f); }} />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => input.current && input.current.click()}><Upload className="w-4 h-4 mr-1.5" />{file ? 'Cambia file' : 'Scegli il file firmato'}</Button>
              {file && <span className="text-xs text-muted-foreground truncate">{file.name}</span>}
            </div>
            <label className="block space-y-1"><span className="text-xs text-muted-foreground">Giorno della firma</span>
              <input type="date" value={giorno} max={oggiRoma()} onChange={e => setGiorno(e.target.value)} className="border rounded px-2 py-1 text-sm" /></label>
            {errore && <div className="text-sm text-red-700">{errore}</div>}
          </div>
        ) : (
          <div className="text-sm space-y-1">
            <div className="text-emerald-800">Contratto segnato controfirmato il {dataIt(giorno)}, col file firmato.</div>
            {esito.documento_qualifica_id
              ? <div>Caricato anche nella qualifica come «{esito.tipo_documento_nome}».</div>
              : esito.motivo_senza_qualifica && <div className="text-amber-800">{esito.motivo_senza_qualifica}</div>}
            {lettura === 'in_corso' && (
              <div className="text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Leggo il documento per la qualifica: puoi chiudere, la lettura va avanti da sola.</div>
            )}
            {lettura === 'fatta' && <div className="text-emerald-800">Documento letto: l&apos;esito è nella qualifica del fornitore.</div>}
            {lettura && lettura !== 'in_corso' && lettura !== 'fatta' && (
              <div className="text-amber-800">La lettura automatica non è riuscita ({lettura}): rilanciala dalla qualifica del fornitore, o verifica il documento a mano.</div>
            )}
          </div>
        )}
        <DialogFooter>
          {!esito ? (
            <>
              <Button variant="outline" onClick={onChiudi}>Annulla</Button>
              <Button onClick={salva} disabled={lavoro || !file}>
                {lavoro ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSignature className="w-4 h-4 mr-2" />}Carica il controfirmato
              </Button>
            </>
          ) : <Button onClick={onSalvato}>Fatto</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
