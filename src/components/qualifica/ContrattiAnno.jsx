import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Info, FileText, Upload, Download, RefreshCw, FilePlus2 } from 'lucide-react';
import { formatTonnellate } from '@/lib/utils';
import {
  TIPI_CONTRATTO, STATI_CONTRATTO, nomeTipo, nomeCanale, campiDi,
  valoriProposti, completaDate, nomeFileContratto, dataIt,
} from '@/lib/contrattiFornitori';
import { leggiModello, generaDocx, scarica } from '@/lib/docxModello';

// I contratti dell'anno: chi va contrattualizzato, per cosa, e a che punto e'
// ciascun contratto.
//
// Il contratto nuovo nasce dal modello - il documento Word dell'anno prima con i
// valori sostituiti da segnaposto - e dai valori dell'anno precedente, che si
// confermano o si cambiano. Quello che il gestionale sa gia' lo propone da solo:
// le date, i dati del fornitore dall'anagrafica, il quantitativo previsto dal
// target. Il documento che esce e' un Word vero, con la sua impaginazione.

function Pastiglia({ stato }) {
  const s = STATI_CONTRATTO[stato] || STATI_CONTRATTO.mancante;
  return <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] whitespace-nowrap ${s.classe}`}>{s.nome}</span>;
}

export default function ContrattiAnno({ anno, isAdmin }) {
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState('');
  const [apri, setApri] = useState(null);       // { soggetto, riga }
  const [modelli, setModelli] = useState(false); // dialogo modelli
  const [occupato, setOccupato] = useState(false);

  const carica = useCallback(async () => {
    setCaricando(true);
    setErrore('');
    try {
      const res = await base44.functions.invoke('contrattiAnno', { anno });
      setDati(res.data || res);
    } catch (e) {
      setErrore((e && e.data && e.data.error) || e.message || 'Errore nel caricamento');
    }
    setCaricando(false);
  }, [anno]);

  useEffect(() => { carica(); }, [carica]);

  if (caricando && !dati) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Leggo la situazione contrattuale…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          I fornitori da contrattualizzare sono gli stessi della qualifica, con il ruolo che hanno nei movimenti: chi raccoglie vuole un contratto
          di raccolta, chi stocca uno di stoccaggio, e così via. Il contratto dell&apos;anno nuovo si genera dal modello Word e dai valori dell&apos;anno
          precedente, cambiando date, importi, condizioni di pagamento e quantitativo previsto. Rete, ACI ed extra raccolta restano contratti distinti.
          {dati && dati.anno_soggetti !== dati.anno && ` I soggetti sono quelli dei movimenti del ${dati.anno_soggetti}, perché nel ${dati.anno} non ce ne sono ancora.`}
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
              ].map(k => (
                <div key={k.l} className="px-3 py-2 rounded-md border bg-card min-w-[130px]">
                  <div className="text-lg font-heading font-bold tabular-nums">{k.n}</div>
                  <div className="text-[11px] text-muted-foreground">{k.l}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {isAdmin && <Button variant="outline" size="sm" onClick={() => setModelli(true)}><FileText className="w-4 h-4 mr-1.5" />Modelli di contratto</Button>}
              <Button variant="ghost" size="sm" onClick={carica} disabled={occupato}><RefreshCw className="w-4 h-4 mr-1.5" />Ricarica</Button>
            </div>
          </div>

          {dati.modelli.length === 0 && (
            <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Non c&apos;è ancora nessun modello di contratto. Un modello è il contratto Word di un anno con i valori che cambiano sostituiti
                da segnaposto fra doppie graffe, per esempio <code>{'{{TARGET_TON}}'}</code> al posto del quantitativo. Caricane uno per tipo con
                «Modelli di contratto» e da lì in poi i contratti si generano da soli.
              </span>
            </div>
          )}

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
                  <tr key={s.chiave} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{s.nome}</div>
                      <div className="text-[11px] text-muted-foreground">{s.piva ? `P.IVA ${s.piva}` : 'partita IVA non in anagrafica'}</div>
                    </td>
                    {TIPI_CONTRATTO.map(t => {
                      const r = s.contratti.find(c => c.tipo === t.chiave);
                      if (!r) return <td key={t.chiave} className="px-3 py-2 text-muted-foreground">—</td>;
                      return (
                        <td key={t.chiave} className="px-3 py-2">
                          <button type="button" disabled={!isAdmin} onClick={() => setApri({ soggetto: s, riga: r })}
                            className={`text-left ${isAdmin ? 'hover:underline' : 'cursor-default'}`}>
                            <Pastiglia stato={r.stato} />
                            {r.contratto && r.contratto.data_fine && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">fino al {dataIt(r.contratto.data_fine)}</div>
                            )}
                            {!r.contratto && r.precedente && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">c&apos;è il {r.precedente.anno}</div>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {dati.soggetti.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nessun fornitore da contrattualizzare.</td></tr>
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

      {modelli && <GestioneModelli modelli={dati ? dati.modelli : []} onChiudi={() => setModelli(false)} onSalvato={() => { setModelli(false); carica(); }} />}
    </div>
  );
}

// ─── la procedura per un singolo contratto ───

function ProceduraContratto({ anno, soggetto, riga, modelli, onChiudi, onSalvato, setOccupato }) {
  const modelliBuoni = modelli.filter(m => m.tipo_contratto === riga.tipo && (m.canale || 'RETE') === (riga.canale || 'RETE'));
  const [modelloId, setModelloId] = useState(riga.modello_id || (modelliBuoni[0] && modelliBuoni[0].id) || '');
  const proposta = valoriProposti({
    anno,
    precedente: riga.precedente,
    fornitore: soggetto.fornitore,
    targetT: riga.target_t,
  });
  const partenza = riga.contratto && riga.contratto.id && riga.precedente === null ? proposta.valori : proposta.valori;
  const [valori, setValori] = useState(partenza);
  const [errore, setErrore] = useState('');
  const [lavoro, setLavoro] = useState(false);
  const campi = campiDi(riga.tipo);

  const cambia = (k, v) => setValori(p => ({ ...p, [k]: v }));

  const genera = async () => {
    setErrore('');
    const modello = modelli.find(m => m.id === modelloId);
    if (!modello) { setErrore('Scegli il modello da cui partire.'); return; }
    setLavoro(true);
    setOccupato(true);
    try {
      // Il modello si scarica dall'archivio privato con un link temporaneo.
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: modello.file_uri, expires_in: 600 });
      const risposta = await fetch(signed_url);
      if (!risposta.ok) throw new Error('Non riesco a scaricare il modello (' + risposta.status + ').');
      const blobModello = await risposta.blob();
      const letto = await leggiModello(blobModello);

      const completi = completaDate({ ...valori, ANNO: String(anno) });
      const { blob, segnaposti_vuoti } = generaDocx(letto, completi);
      const nomeFile = nomeFileContratto({ anno, soggetto: soggetto.nome, tipo: riga.tipo, canale: riga.canale });
      scarica(blob, nomeFile);

      // Il documento generato si conserva insieme al contratto.
      const file = new File([blob], nomeFile, { type: blob.type });
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });

      const dati = {
        anno,
        soggetto_chiave: soggetto.chiave,
        soggetto_nome: soggetto.nome,
        tipo_contratto: riga.tipo,
        canale: riga.canale || 'RETE',
        modello_id: modello.id,
        modello_nome: modello.nome,
        contratto_precedente_id: riga.precedente_id || undefined,
        data_inizio: valori.DATA_INIZIO || undefined,
        data_fine: valori.DATA_FINE || undefined,
        quantitativo_previsto_t: Number(String(valori.TARGET_TON || valori.QUOTA_TON || '').replace(',', '.')) || undefined,
        condizioni_pagamento: valori.PAGAMENTO || undefined,
        valori_json: JSON.stringify(valori),
        stato: 'generato',
        file_uri,
        file_nome: nomeFile,
        generato_il: new Date().toISOString(),
        note: segnaposti_vuoti.length ? `Segnaposto senza valore, rimasti nel documento: ${segnaposti_vuoti.join(', ')}` : '',
      };
      if (riga.contratto_id) await base44.entities.ContrattoFornitore.update(riga.contratto_id, dati);
      else await base44.entities.ContrattoFornitore.create(dati);

      if (segnaposti_vuoti.length) {
        setErrore(`Documento generato, ma ${segnaposti_vuoti.length} segnaposto sono rimasti senza valore e nel Word si vedono ancora: ${segnaposti_vuoti.join(', ')}.`);
        setLavoro(false);
        setOccupato(false);
        return;
      }
      onSalvato();
    } catch (e) {
      setErrore((e && e.data && e.data.error) || e.message || String(e));
    }
    setLavoro(false);
    setOccupato(false);
  };

  return (
    <Dialog open onOpenChange={(x) => { if (!x) onChiudi(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{nomeTipo(riga.tipo)} {anno} · {soggetto.nome}</DialogTitle>
          <DialogDescription>
            Canale {nomeCanale(riga.canale)}.
            {riga.precedente
              ? ` I valori partono dal contratto ${riga.precedente.anno}: quello che cambia è segnato.`
              : ' Non c\'è un contratto dell\'anno prima: i valori si scrivono da zero.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Modello</label>
            <select value={modelloId} onChange={e => setModelloId(e.target.value)} className="w-full px-2 py-1.5 rounded-md border bg-card text-sm">
              <option value="">— scegli —</option>
              {modelliBuoni.map(m => <option key={m.id} value={m.id}>{m.nome} ({m.file_nome})</option>)}
            </select>
            {modelliBuoni.length === 0 && (
              <p className="text-xs text-amber-800">Per questo tipo di contratto non c&apos;è ancora un modello: caricalo da «Modelli di contratto».</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {campi.map(c => {
              const cambiato = proposta.cambiati.includes(c.chiave) && riga.precedente;
              return (
                <div key={c.chiave} className={c.tipo === 'testo_lungo' ? 'md:col-span-2 space-y-1' : 'space-y-1'}>
                  <label className="text-xs font-medium flex items-center gap-1.5">
                    {c.nome}
                    {cambiato && <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-800">cambia</span>}
                  </label>
                  {c.tipo === 'testo_lungo' ? (
                    <textarea rows={2} value={valori[c.chiave] || ''} onChange={e => cambia(c.chiave, e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm" />
                  ) : (
                    <input type={c.tipo === 'data' ? 'date' : 'text'} value={valori[c.chiave] || ''}
                      onChange={e => cambia(c.chiave, e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm" />
                  )}
                  {riga.precedente && proposta.vecchi[c.chiave] && String(proposta.vecchi[c.chiave]) !== String(valori[c.chiave] || '') && (
                    <p className="text-[11px] text-muted-foreground">nel {riga.precedente.anno}: {String(proposta.vecchi[c.chiave])}</p>
                  )}
                  {c.chiave === 'TARGET_TON' && riga.target_t != null && (
                    <p className="text-[11px] text-muted-foreground">da Target &amp; Status: {formatTonnellate(riga.target_t)} t</p>
                  )}
                </div>
              );
            })}
          </div>

          {errore && (
            <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errore}</span>
            </div>
          )}

          {riga.contratto && riga.contratto.file_nome && (
            <p className="text-xs text-muted-foreground">Già generato: {riga.contratto.file_nome}. Rigenerando, il documento viene sostituito.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onChiudi}>Chiudi</Button>
          <Button onClick={genera} disabled={lavoro || !modelloId}>
            {lavoro ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Genera e scarica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── i modelli ───

function GestioneModelli({ modelli, onChiudi, onSalvato }) {
  const [file, setFile] = useState(null);
  const [letto, setLetto] = useState(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('raccolta');
  const [canale, setCanale] = useState('RETE');
  const [annoRif, setAnnoRif] = useState(new Date().getFullYear());
  const [errore, setErrore] = useState('');
  const [lavoro, setLavoro] = useState(false);

  const scegli = async (f) => {
    setErrore('');
    setFile(f);
    setLetto(null);
    try {
      const r = await leggiModello(f);
      setLetto(r);
      if (!nome) setNome(f.name.replace(/\.docx$/i, ''));
    } catch (e) {
      setErrore(e.message || String(e));
    }
  };

  const salva = async () => {
    if (!file || !letto) { setErrore('Carica prima il documento.'); return; }
    if (!letto.segnaposti.length) { setErrore('Nel documento non c\'è nessun segnaposto fra doppie graffe: così non c\'è niente da sostituire.'); return; }
    setLavoro(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const vecchio = modelli.find(m => m.tipo_contratto === tipo && (m.canale || 'RETE') === canale);
      await base44.entities.ModelloContratto.create({
        nome: nome || file.name, tipo_contratto: tipo, canale, anno_riferimento: Number(annoRif) || undefined,
        file_uri, file_nome: file.name, segnaposti_json: JSON.stringify(letto.segnaposti),
        stato: 'attivo', sostituisce_id: vecchio ? vecchio.id : undefined,
      });
      if (vecchio) {
        await base44.entities.ModelloContratto.update(vecchio.id, {
          stato: 'sostituito',
          motivo_sostituzione: `Sostituito il ${new Date().toISOString().slice(0, 10)} dal modello "${nome || file.name}"`,
        });
      }
      onSalvato();
    } catch (e) {
      setErrore((e && e.data && e.data.error) || e.message || String(e));
    }
    setLavoro(false);
  };

  return (
    <Dialog open onOpenChange={(x) => { if (!x) onChiudi(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modelli di contratto</DialogTitle>
          <DialogDescription>
            Un modello è il contratto Word di un anno in cui i valori che cambiano sono stati sostituiti da segnaposto fra doppie graffe,
            per esempio <code>{'{{TARGET_TON}}'}</code> o <code>{'{{CORRISPETTIVO_RACCOLTA}}'}</code>. Il resto del documento resta com&apos;è.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {modelli.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr><th className="px-3 py-2 font-semibold">Modello</th><th className="px-3 py-2 font-semibold">Tipo</th><th className="px-3 py-2 font-semibold">Canale</th><th className="px-3 py-2 font-semibold">Segnaposto</th></tr>
                </thead>
                <tbody>
                  {modelli.map(m => (
                    <tr key={m.id} className="border-t">
                      <td className="px-3 py-2">{m.nome}<div className="text-[11px] text-muted-foreground">{m.file_nome}</div></td>
                      <td className="px-3 py-2">{nomeTipo(m.tipo_contratto)}</td>
                      <td className="px-3 py-2">{nomeCanale(m.canale)}</td>
                      <td className="px-3 py-2 tabular-nums">{m.segnaposti_json ? JSON.parse(m.segnaposti_json).length : 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border rounded-lg p-3 space-y-3">
            <div className="text-sm font-medium flex items-center gap-1.5"><FilePlus2 className="w-4 h-4" />Carica un modello</div>
            <input type="file" accept=".docx" onChange={e => { const f = e.target.files && e.target.files[0]; if (f) scegli(f); }}
              className="text-sm" />
            {letto && (
              <div className="text-xs space-y-1">
                <div className="text-emerald-800">
                  Trovati {letto.segnaposti.length} segnaposto: {letto.segnaposti.join(', ')}
                </div>
                <details>
                  <summary className="cursor-pointer text-muted-foreground">prime righe del documento</summary>
                  <pre className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground max-h-40 overflow-y-auto">{letto.testo.split('\n').slice(0, 12).join('\n')}</pre>
                </details>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Nome</span>
                <input value={nome} onChange={e => setNome(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Anno del contratto di partenza</span>
                <input value={annoRif} onChange={e => setAnnoRif(e.target.value)} className="w-full border rounded px-2 py-1 text-sm tabular-nums" /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Tipo</span>
                <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
                  {TIPI_CONTRATTO.map(t => <option key={t.chiave} value={t.chiave}>{t.nome}</option>)}
                </select></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Canale</span>
                <select value={canale} onChange={e => setCanale(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
                  <option value="RETE">Rete</option><option value="ACI">ACI</option><option value="EXTRA_RACCOLTA">Extra raccolta</option>
                </select></label>
            </div>
          </div>

          {errore && (
            <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errore}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onChiudi}>Chiudi</Button>
          <Button onClick={salva} disabled={lavoro || !letto}>
            {lavoro ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}Salva il modello
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
