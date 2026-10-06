import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, AlertTriangle, CheckCircle2, ExternalLink, Pencil, X } from 'lucide-react';
import { useIndiceSedi, dimenticaIndiceSedi } from '@/lib/sediIndice';
import { oggiRoma } from '@/lib/giornoItaliano';

// LE SEDI OPERATIVE DEI PUNTI DI RACCOLTA, CONTROLLATE IN RETE.
//
// Sul formulario va la sede operativa, non la sede legale: il 06/10/2026 un
// formulario e' stato preparato su una vecchia sede legale rimasta in anagrafica.
// Qui si vedono, uno accanto all'altro, quello che dice il portale e quello che
// si trova in rete, con le fonti. La decisione la prende l'amministratore: il
// gestionale propone e non cambia niente da se'.

const ESITI = {
  diverso: { testo: 'Sede diversa', classe: 'bg-red-50 text-red-800 border-red-300', ordine: 0 },
  incerto: { testo: 'Da guardare', classe: 'bg-amber-50 text-amber-800 border-amber-300', ordine: 1 },
  non_trovato: { testo: 'Non trovata', classe: 'bg-slate-50 text-slate-700 border-slate-200', ordine: 2 },
  errore: { testo: 'Ricerca non riuscita', classe: 'bg-slate-50 text-slate-700 border-slate-200', ordine: 3 },
  coincide: { testo: 'La rete conferma', classe: 'bg-emerald-50 text-emerald-800 border-emerald-200', ordine: 4 },
};

const STATI = {
  da_decidere: 'da decidere',
  confermato_portale: 'confermato il portale',
  corretto: 'sede corretta',
  ignorato: 'ignorato',
};

const unaRiga = (...parti) => parti.filter(p => String(p || '').trim()).join(', ');

export default function SediOperative({ records, cercaIniziale = '' }) {
  const [versione, setVersione] = useState(0);
  const indice = useIndiceSedi(versione);
  const [inCorso, setInCorso] = useState(null);
  const [errore, setErrore] = useState('');
  const [soloDaGuardare, setSoloDaGuardare] = useState(true);
  const [cerca, setCerca] = useState(cercaIniziale);
  // Arrivando da un ordine si cerca quel punto di raccolta, e si guardano tutti:
  // anche quelli gia' decisi, altrimenti chi arriva dal link non trova niente.
  useEffect(() => {
    if (!cercaIniziale) return;
    setCerca(cercaIniziale);
    setSoloDaGuardare(false);
  }, [cercaIniziale]);
  const [modifica, setModifica] = useState(null);
  const fermaRef = useRef(false);

  const ricarica = useCallback(() => { dimenticaIndiceSedi(); setVersione(v => v + 1); }, []);

  const perId = useMemo(() => {
    const m = new Map();
    for (const r of records || []) if (r && r.id_pdr != null) m.set(Number(r.id_pdr), r);
    return m;
  }, [records]);

  const righe = useMemo(() => {
    if (!indice || indice.errore) return [];
    const testo = cerca.trim().toLowerCase();
    const tutte = [...indice.perPdr.values()].map(v => ({ v, pdr: perId.get(Number(v.id_pdr)) || null }));
    return tutte
      .filter(({ v }) => (!soloDaGuardare || (['diverso', 'incerto'].includes(v.esito) && v.stato === 'da_decidere')))
      .filter(({ v }) => !testo || `${v.ragione_sociale} ${v.descrizione_pdr} ${v.comune_portale}`.toLowerCase().includes(testo))
      .sort((a, b) => (ESITI[a.v.esito]?.ordine ?? 9) - (ESITI[b.v.esito]?.ordine ?? 9)
        || String(a.v.ragione_sociale || '').localeCompare(String(b.v.ragione_sociale || '')));
  }, [indice, perId, soloDaGuardare, cerca]);

  const conti = useMemo(() => {
    if (!indice || indice.errore) return null;
    const v = [...indice.perPdr.values()];
    return {
      controllati: v.length,
      daDecidere: v.filter(x => ['diverso', 'incerto'].includes(x.esito) && x.stato === 'da_decidere').length,
      corretti: v.filter(x => x.stato === 'corretto').length,
    };
  }, [indice]);

  const avvia = async () => {
    setErrore(''); fermaRef.current = false;
    setInCorso({ fatti: 0, restanti: null });
    try {
      for (let giro = 0; giro < 200; giro++) {
        if (fermaRef.current) break;
        const res = await base44.functions.invoke('verificaSediPdr', { limite: 4 });
        const d = (res && res.data) || {};
        setInCorso(p => ({ fatti: (p ? p.fatti : 0) + (d.controllati || 0), restanti: d.restanti }));
        ricarica();
        if (!d.controllati || !d.restanti) break;
      }
    } catch (e) {
      setErrore(e?.response?.data?.error || e?.message || 'Controllo non riuscito');
    }
    setInCorso(null);
  };

  const decidi = async (v, stato, extra = {}) => {
    setErrore('');
    try {
      await base44.entities.VerificaSedePdr.update(v.id, {
        stato, deciso_il: oggiRoma(), deciso_da: (await base44.auth.me())?.email || '', ...extra,
      });
      setModifica(null);
      ricarica();
    } catch (e) {
      setErrore(e?.response?.data?.error || e?.message || 'Non sono riuscito a salvare la decisione');
    }
  };

  const usaTrovato = (v) => decidi(v, 'corretto', {
    indirizzo_per_formulario: v.indirizzo_trovato || '',
    cap_per_formulario: v.cap_trovato || '',
    comune_per_formulario: v.comune_trovato || '',
    provincia_per_formulario: v.provincia_trovato || '',
  });

  const salvaScritto = () => decidi({ id: modifica.id }, 'corretto', {
    indirizzo_per_formulario: modifica.indirizzo || '',
    cap_per_formulario: modifica.cap || '',
    comune_per_formulario: modifica.comune || '',
    provincia_per_formulario: modifica.provincia || '',
  });

  if (!indice) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 bg-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h3 className="font-heading font-semibold">Sedi operative dei punti di raccolta</h3>
            <p className="text-sm text-muted-foreground">
              Sul formulario deve comparire la sede operativa — l&apos;unità locale dove si va davvero a ritirare — non la sede legale.
              Il controllo cerca in rete la sede di ogni punto di raccolta che ha ordini assegnati e la confronta con l&apos;anagrafica del portale, citando le fonti.
              Quale indirizzo vale lo decidi tu: qui non cambia niente da solo, e l&apos;anagrafica non viene toccata.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {inCorso ? (
              <>
                <span className="text-sm text-muted-foreground">
                  Controllati {inCorso.fatti}{inCorso.restanti != null ? `, ne restano ${inCorso.restanti}` : ''}…
                </span>
                <Button variant="outline" onClick={() => { fermaRef.current = true; }}>Ferma</Button>
              </>
            ) : (
              <Button onClick={avvia}><Search className="w-4 h-4 mr-1.5" /> Controlla in rete</Button>
            )}
          </div>
        </div>
        {conti && (
          <div className="flex flex-wrap gap-4 text-sm">
            <span><span className="font-medium">{conti.controllati}</span> punti controllati</span>
            <span className={conti.daDecidere ? 'text-red-800 font-medium' : ''}>{conti.daDecidere} da decidere</span>
            <span>{conti.corretti} con la sede corretta a mano</span>
          </div>
        )}
        {errore && <p className="text-sm text-destructive">{errore}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soloDaGuardare} onChange={e => setSoloDaGuardare(e.target.checked)} />
          Solo quelli da decidere
        </label>
        <Input className="h-9 max-w-xs" placeholder="Cerca per nome o comune" value={cerca} onChange={e => setCerca(e.target.value)} />
      </div>

      {!righe.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {conti && conti.controllati === 0
            ? 'Nessun punto di raccolta è stato ancora controllato. Premi «Controlla in rete».'
            : 'Niente da decidere: le sedi controllate coincidono con il portale o sono già state decise.'}
        </p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium">Punto di raccolta</th>
                <th className="text-left px-3 py-2.5 font-medium">A portale</th>
                <th className="text-left px-3 py-2.5 font-medium">Trovato in rete</th>
                <th className="text-left px-2 py-2.5 font-medium">Esito</th>
                <th className="text-left px-2 py-2.5 font-medium">Decisione</th>
              </tr>
            </thead>
            <tbody>
              {righe.map(({ v, pdr }, i) => {
                const esito = ESITI[v.esito] || ESITI.errore;
                const inModifica = modifica && modifica.id === v.id;
                return (
                  <tr key={v.id} className={`border-b align-top ${i % 2 ? 'bg-muted/30' : ''}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{v.ragione_sociale || v.descrizione_pdr || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {v.descrizione_pdr && v.descrizione_pdr !== v.ragione_sociale ? v.descrizione_pdr + ' · ' : ''}ID PDR {v.id_pdr}
                      </div>
                      <div className="text-xs text-muted-foreground">controllato il {String(v.verificato_il || '').slice(0, 10)} — {v.motivo_controllo || ''}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{unaRiga(v.indirizzo_portale, v.cap_portale, v.comune_portale, v.provincia_portale)}</div>
                      {pdr && String(pdr.indirizzo_pdr || '') !== String(v.indirizzo_portale || '') && (
                        <div className="text-xs text-amber-700">a portale adesso: {unaRiga(pdr.indirizzo_pdr, pdr.cap_pdr, pdr.comune_pdr, pdr.provincia_pdr)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div>{unaRiga(v.indirizzo_trovato, v.cap_trovato, v.comune_trovato, v.provincia_trovato) || <span className="text-muted-foreground">—</span>}</div>
                      {v.altre_sedi && <div className="text-xs text-muted-foreground whitespace-pre-line">altre sedi: {v.altre_sedi}</div>}
                      {v.spiegazione && <div className="text-xs text-muted-foreground">{v.spiegazione}</div>}
                      {!!(v.fonti || []).length && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(v.fonti || []).map((f, k) => (
                            <a key={k} href={f} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline">
                              <ExternalLink className="w-3 h-3" /> fonte {k + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-xs ${esito.classe}`}>{esito.testo}</span>
                      <div className="text-xs text-muted-foreground mt-1">confidenza {v.confidenza || 'media'}</div>
                    </td>
                    <td className="px-2 py-2">
                      {v.stato !== 'da_decidere' && !inModifica ? (
                        <div className="space-y-1">
                          <div className="text-xs font-medium">{STATI[v.stato] || v.stato}</div>
                          {v.stato === 'corretto' && <div className="text-xs">{unaRiga(v.indirizzo_per_formulario, v.cap_per_formulario, v.comune_per_formulario, v.provincia_per_formulario)}</div>}
                          <div className="text-xs text-muted-foreground">{String(v.deciso_il || '').slice(0, 10)} {v.deciso_da || ''}</div>
                          <button className="text-xs text-primary underline" onClick={() => decidi(v, 'da_decidere', { indirizzo_per_formulario: '', cap_per_formulario: '', comune_per_formulario: '', provincia_per_formulario: '' })}>torna da decidere</button>
                        </div>
                      ) : inModifica ? (
                        <div className="space-y-1 min-w-[16rem]">
                          <Input className="h-8 text-xs" placeholder="Indirizzo" value={modifica.indirizzo} onChange={e => setModifica({ ...modifica, indirizzo: e.target.value })} />
                          <div className="flex gap-1">
                            <Input className="h-8 text-xs w-20" placeholder="CAP" value={modifica.cap} onChange={e => setModifica({ ...modifica, cap: e.target.value })} />
                            <Input className="h-8 text-xs" placeholder="Comune" value={modifica.comune} onChange={e => setModifica({ ...modifica, comune: e.target.value })} />
                            <Input className="h-8 text-xs w-14" placeholder="Prov." value={modifica.provincia} onChange={e => setModifica({ ...modifica, provincia: e.target.value })} />
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs" onClick={salvaScritto}>Salva</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModifica(null)}><X className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-start">
                          <button className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-muted" onClick={() => decidi(v, 'confermato_portale')}>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> va bene quello a portale
                          </button>
                          {!!v.indirizzo_trovato && (
                            <button className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-muted" onClick={() => usaTrovato(v)}>
                              <AlertTriangle className="w-3 h-3 text-amber-600" /> usa questo per i formulari
                            </button>
                          )}
                          <button className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-muted"
                            onClick={() => setModifica({ id: v.id, indirizzo: v.indirizzo_trovato || v.indirizzo_portale || '', cap: v.cap_trovato || v.cap_portale || '', comune: v.comune_trovato || v.comune_portale || '', provincia: v.provincia_trovato || v.provincia_portale || '' })}>
                            <Pencil className="w-3 h-3" /> scrivilo tu
                          </button>
                          <button className="text-xs text-muted-foreground underline" onClick={() => decidi(v, 'ignorato')}>ignora</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
