import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, Edit3, AlertTriangle, Info } from 'lucide-react';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { ton, it, testoErrore } from './Comuni';

// La configurazione della predittivita', anno per anno (26/09/2026): gli
// impianti seguiti col loro target di rete, e per ognuno i raccoglitori e gli
// stoccaggi che lo alimentano, con plafond e priorita'. Un record senza anno
// vale per il 2026, l'anno in cui la predittivita' e' nata (annoDelRecord in
// base44/shared/predittivitaDati.ts). Dal prossimo aggiornamento questi dati si
// scriveranno in Target & Status.
//
// I pesi si scrivono in tonnellate e si salvano in chili, come li legge il
// calcolo. Niente finestre di sistema: si cancella con una conferma sulla riga.

const annoDelRecord = (r) => Number((r && r.anno) || 2026);
const fineDefault = (anno) => (Number(anno) === 2026 ? '2026-12-18' : '');
const eStoccaggio = (f) => ['stoccaggio', 'doppio_ruolo'].includes(f.ruolo || (f.tipo === 'stoccaggio' ? 'stoccaggio' : 'raccoglitore'));
const ruoloDi = (f) => f.ruolo || (f.tipo === 'stoccaggio' ? 'stoccaggio' : 'raccoglitore');

const RUOLI = [
  { valore: 'raccoglitore', nome: 'Raccoglitore' },
  { valore: 'stoccaggio', nome: 'Stoccaggio' },
  { valore: 'doppio_ruolo', nome: 'Impianto e stoccaggio' },
  { valore: 'impianto', nome: 'Impianto' },
];
const CLASSE_RUOLO = {
  raccoglitore: 'bg-sky-100 text-sky-700 border-sky-300',
  impianto: 'bg-blue-100 text-blue-700 border-blue-300',
  stoccaggio: 'bg-amber-100 text-amber-700 border-amber-300',
  doppio_ruolo: 'bg-violet-100 text-violet-700 border-violet-300',
};

/** Tonnellate scritte a mano ('1.250,5' o '1250.5') in chili interi; null se non e' un numero. */
function daTonnellate(testo) {
  const s = String(testo ?? '').trim();
  if (!s) return 0;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : null;
}
const inTonnellate = (kg) => String((Number(kg) || 0) / 1000).replace('.', ',');

/** Un valore che si corregge cliccandoci sopra. */
function Modificabile({ mostra, iniziale, onSalva, larghezza = 'w-28', tipo = 'text', attivo = true }) {
  const [aperto, setAperto] = useState(false);
  const [val, setVal] = useState(iniziale);
  const [salva, setSalva] = useState(false);
  if (!attivo) return <span className="font-medium text-foreground">{mostra}</span>;
  if (salva) return <Loader2 className="w-3 h-3 animate-spin inline" />;
  const chiudi = async () => {
    setAperto(false);
    if (val === iniziale) return;
    setSalva(true);
    await onSalva(val);
    setSalva(false);
  };
  if (aperto) {
    return (
      <input
        autoFocus
        type={tipo}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={chiudi}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setVal(iniziale); setAperto(false); } }}
        className={`${larghezza} text-sm border border-primary rounded px-1 py-0.5 bg-background focus:outline-none`}
      />
    );
  }
  return (
    <button type="button" className="font-medium text-foreground hover:bg-primary/10 rounded px-1 inline-flex items-center" onClick={() => { setVal(iniziale); setAperto(true); }}>
      {mostra}
      <Edit3 className="w-3 h-3 ml-1 opacity-40" />
    </button>
  );
}

/** Il cestino con la conferma sulla riga, al posto di confirm(). */
function Elimina({ nome, onElimina, piccolo = false }) {
  const [chiedi, setChiedi] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  if (lavoro) return <Loader2 className="w-4 h-4 animate-spin" />;
  if (chiedi) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        Eliminare {nome}?
        <Button size="sm" variant="destructive" className="h-7 px-2" onClick={async () => { setLavoro(true); await onElimina(); setLavoro(false); setChiedi(false); }}>Sì, elimina</Button>
        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setChiedi(false)}>No</Button>
      </span>
    );
  }
  return (
    <button type="button" aria-label={`Elimina ${nome}`} onClick={() => setChiedi(true)} className="p-1.5 hover:bg-red-50 rounded">
      <Trash2 className={`${piccolo ? 'w-3 h-3' : 'w-4 h-4'} text-red-500`} />
    </button>
  );
}

function Fornitore({ f, target, modificabile, scrivi, elimina }) {
  const stocc = eStoccaggio(f);
  const ruolo = ruoloDi(f);
  return (
    <div className="border rounded px-2 py-1.5 space-y-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-medium text-sm flex items-center gap-1.5">
          {f.nome}
          {modificabile ? (
            <select
              value={ruolo}
              aria-label={`Ruolo di ${f.nome}`}
              onChange={e => {
                const r = e.target.value;
                const s = r === 'stoccaggio' || r === 'doppio_ruolo';
                scrivi(() => base44.entities.FornitoreSecondaria.update(f.id, { ruolo: r, tipo: s ? 'stoccaggio' : 'primaria_diretta' }), 'Ruolo aggiornato');
              }}
              className={`text-[11px] border rounded px-1 py-0.5 bg-background font-semibold ${CLASSE_RUOLO[ruolo] || ''}`}
            >
              {RUOLI.map(r => <option key={r.valore} value={r.valore}>{r.nome}</option>)}
            </select>
          ) : (
            <span className={`text-[11px] border rounded px-1 py-0.5 font-semibold ${CLASSE_RUOLO[ruolo] || ''}`}>{(RUOLI.find(r => r.valore === ruolo) || {}).nome}</span>
          )}
          {f.stato === 'non_attivo' && <span className="text-[11px] px-1 rounded bg-muted text-muted-foreground">non attivo</span>}
        </span>
        {modificabile && <Elimina nome={f.nome} piccolo onElimina={() => elimina(() => base44.entities.FornitoreSecondaria.delete(f.id), `${f.nome} eliminato`)} />}
      </div>
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-muted-foreground">
        {!stocc || ruolo === 'doppio_ruolo' ? (
          <span>Target di raccolta dell&apos;anno (da Target Annuali): <span className="font-medium text-foreground">{target ? ton(target) : 'nessuno'}</span></span>
        ) : null}
        {stocc && (
          <>
            <span className="flex items-center gap-1">Plafond:
              <Modificabile
                attivo={modificabile}
                mostra={Number(f.plafond_stoccaggio_kg) > 0 ? ton(f.plafond_stoccaggio_kg) : 'nessuno'}
                iniziale={Number(f.plafond_stoccaggio_kg) > 0 ? inTonnellate(f.plafond_stoccaggio_kg) : ''}
                onSalva={async (v) => {
                  const kg = daTonnellate(v);
                  if (kg === null) { await scrivi(() => Promise.reject(new Error('Scrivi il plafond in tonnellate, per esempio 1.250,5.'))); return; }
                  await scrivi(() => base44.entities.FornitoreSecondaria.update(f.id, { plafond_stoccaggio_kg: kg }), 'Plafond aggiornato');
                }}
              />
            </span>
            <span className="flex items-center gap-1">Priorità verso questo impianto:
              <Modificabile
                attivo={modificabile}
                larghezza="w-14"
                mostra={Number(f.priorita) > 0 ? String(f.priorita) : 'quella dell\'anno'}
                iniziale={Number(f.priorita) > 0 ? String(f.priorita) : ''}
                onSalva={async (v) => {
                  const s = String(v).trim();
                  if (s && !/^[1-9]\d*$/.test(s)) { await scrivi(() => Promise.reject(new Error('La priorità è un numero intero: 1 per il primo impianto, 2 per il secondo.'))); return; }
                  await scrivi(() => base44.entities.FornitoreSecondaria.update(f.id, { priorita: s ? Number(s) : null }), 'Priorità aggiornata');
                }}
              />
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default function PredittivitaImpiantiManager({ anno, solaLettura = false, onReload }) {
  const { toast } = useToast();
  const [impianti, setImpianti] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [targetMap, setTargetMap] = useState({});
  const [errori, setErrori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formImpianto, setFormImpianto] = useState(null);
  const [formFornitoreDi, setFormFornitoreDi] = useState(null);
  const [formFornitore, setFormFornitore] = useState({ nome: '', ruolo: 'raccoglitore', plafond: '', priorita: '' });
  const [salvataggio, setSalvataggio] = useState(false);
  const modificabile = !solaLettura;

  const load = useCallback(async () => {
    setLoading(true);
    const [imps, forns, targets] = await Promise.allSettled([
      base44.entities.ImpiantoTargetSecondaria.list('-created_date', 500),
      base44.entities.FornitoreSecondaria.list('-created_date', 2000),
      base44.entities.TargetRaccoglitore.filter({ anno }),
    ]);
    const nuovi = [];
    if (imps.status === 'fulfilled') setImpianti((imps.value || []).filter(i => annoDelRecord(i) === anno));
    else nuovi.push(`gli impianti seguiti (${testoErrore(imps.reason)})`);
    if (forns.status === 'fulfilled') setFornitori((forns.value || []).filter(f => annoDelRecord(f) === anno));
    else nuovi.push(`raccoglitori e stoccaggi (${testoErrore(forns.reason)})`);
    if (targets.status === 'fulfilled') {
      // Un raccoglitore diviso per regione ha piu' righe: si sommano, come fa il calcolo.
      const tm = {};
      for (const t of targets.value || []) {
        const k = normalizzaRagioneSociale(t.raccoglitore);
        if (k) tm[k] = (tm[k] || 0) + (Number(t.target_tonnellate) || 0) * 1000;
      }
      setTargetMap(tm);
    } else nuovi.push(`i target dei raccoglitori (${testoErrore(targets.reason)})`);
    setErrori(nuovi);
    setLoading(false);
  }, [anno]);

  useEffect(() => { load(); setFormImpianto(null); setFormFornitoreDi(null); }, [load]);

  // Ogni scrittura: se riesce si rilegge e si ricalcola, se no si dice perche'.
  const scrivi = async (fn, messaggio) => {
    try {
      await fn();
      if (messaggio) toast({ title: messaggio });
      await load();
      if (onReload) onReload();
      return true;
    } catch (e) {
      toast({ title: 'Non salvato', description: testoErrore(e), variant: 'destructive' });
      return false;
    }
  };

  const aggiungiImpianto = async () => {
    const nome = formImpianto.nome.trim();
    const target = daTonnellate(formImpianto.target);
    if (!nome) { toast({ title: 'Manca il nome dell\'impianto', variant: 'destructive' }); return; }
    if (target === null) { toast({ title: 'Il target non è un numero', description: 'Scrivilo in tonnellate, per esempio 2.295.', variant: 'destructive' }); return; }
    setSalvataggio(true);
    const ok = await scrivi(() => base44.entities.ImpiantoTargetSecondaria.create({
      nome_impianto: nome, target, data_fine: formImpianto.data_fine || undefined, stato: 'attivo', anno,
    }), `${nome} aggiunto al ${anno}`);
    setSalvataggio(false);
    if (ok) setFormImpianto(null);
  };

  const aggiungiFornitore = async (imp) => {
    const nome = formFornitore.nome.trim();
    const stocc = formFornitore.ruolo === 'stoccaggio' || formFornitore.ruolo === 'doppio_ruolo';
    const plafond = stocc ? daTonnellate(formFornitore.plafond) : 0;
    const prio = String(formFornitore.priorita).trim();
    if (!nome) { toast({ title: 'Manca il nome', variant: 'destructive' }); return; }
    if (plafond === null) { toast({ title: 'Il plafond non è un numero', description: 'Scrivilo in tonnellate.', variant: 'destructive' }); return; }
    if (stocc && prio && !/^[1-9]\d*$/.test(prio)) { toast({ title: 'La priorità è un numero intero', description: '1 per il primo impianto, 2 per il secondo.', variant: 'destructive' }); return; }
    setSalvataggio(true);
    const ok = await scrivi(() => base44.entities.FornitoreSecondaria.create({
      nome, impianto_id: imp.id, impianto_nome: imp.nome_impianto, ruolo: formFornitore.ruolo,
      tipo: stocc ? 'stoccaggio' : 'primaria_diretta', stato: 'attivo', anno,
      plafond_stoccaggio_kg: stocc ? plafond : 0,
      ...(stocc && prio ? { priorita: Number(prio) } : {}),
    }), `${nome} collegato a ${imp.nome_impianto}`);
    setSalvataggio(false);
    if (ok) { setFormFornitore({ nome: '', ruolo: 'raccoglitore', plafond: '', priorita: '' }); setFormFornitoreDi(null); }
  };

  if (loading) return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  const idImpianti = new Set(impianti.map(i => i.id));
  const senzaImpianto = fornitori.filter(f => !idImpianti.has(f.impianto_id));

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-primary bg-primary/5 border border-primary/20 rounded px-3 py-2 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        Dal prossimo aggiornamento questi dati si inseriscono in Target &amp; Status.
      </p>

      {errori.length > 0 && (
        <div className="text-sm text-red-900 bg-red-50 border border-red-300 rounded-lg px-3 py-2 flex items-start gap-2 flex-wrap">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">Non si sono potuti leggere {errori.join('; ')}.</span>
          <Button size="sm" variant="outline" onClick={load}>Riprova</Button>
        </div>
      )}

      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="font-heading font-semibold">Impianti seguiti nel {anno} ({impianti.length})</h2>
        {modificabile && (
          <Button size="sm" onClick={() => setFormImpianto(formImpianto ? null : { nome: '', target: '', data_fine: fineDefault(anno) })}>
            <Plus className="w-4 h-4 mr-1" /> Aggiungi impianto
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {solaLettura ? `Il ${anno} è chiuso: la configurazione si consulta e non si cambia. ` : ''}
        Il target è quello di rete. Il piazzale di un impianto non va registrato come suo stoccaggio: si registra solo come stoccaggio degli altri impianti a cui spedisce.
        La priorità vale per uno stoccaggio che alimenta più impianti: 1 al primo; vuota vale quella dell&apos;anno.
      </p>

      {formImpianto && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-xs text-muted-foreground space-y-1">Nome dell&apos;impianto
              <Input value={formImpianto.nome} onChange={e => setFormImpianto({ ...formImpianto, nome: e.target.value })} />
            </label>
            <label className="text-xs text-muted-foreground space-y-1">Target di rete del {anno} (tonnellate)
              <Input inputMode="decimal" value={formImpianto.target} onChange={e => setFormImpianto({ ...formImpianto, target: e.target.value })} />
            </label>
            <label className="text-xs text-muted-foreground space-y-1">Fine della programmazione
              <Input type="date" value={formImpianto.data_fine} onChange={e => setFormImpianto({ ...formImpianto, data_fine: e.target.value })} />
            </label>
          </div>
          <Button size="sm" onClick={aggiungiImpianto} disabled={salvataggio}>{salvataggio && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salva</Button>
        </div>
      )}

      {impianti.length === 0 && (
        <p className="text-sm text-muted-foreground border rounded-lg p-4 text-center">
          Per il {anno} non c&apos;è ancora nessun impianto seguito{modificabile ? ': aggiungili qui sopra.' : '.'}
        </p>
      )}

      {impianti.map(imp => {
        const suoi = fornitori.filter(f => f.impianto_id === imp.id);
        return (
          <div key={imp.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-heading font-semibold flex items-center gap-2">
                  {imp.nome_impianto}
                  {imp.stato === 'non_attivo' && <span className="text-[11px] px-1 rounded bg-muted text-muted-foreground font-normal">non attivo</span>}
                </h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  Target di rete:
                  <Modificabile
                    attivo={modificabile}
                    mostra={ton(imp.target)}
                    iniziale={inTonnellate(imp.target)}
                    onSalva={async (v) => {
                      const kg = daTonnellate(v);
                      if (kg === null) { await scrivi(() => Promise.reject(new Error('Scrivi il target in tonnellate, per esempio 2.295.'))); return; }
                      await scrivi(() => base44.entities.ImpiantoTargetSecondaria.update(imp.id, { target: kg }), 'Target aggiornato');
                    }}
                  />
                  <span>· fine della programmazione:</span>
                  <Modificabile
                    attivo={modificabile}
                    tipo="date"
                    larghezza="w-36"
                    mostra={imp.data_fine ? it(imp.data_fine) : (fineDefault(anno) ? it(fineDefault(anno)) : 'da scrivere')}
                    iniziale={imp.data_fine ? String(imp.data_fine).slice(0, 10) : ''}
                    onSalva={async (v) => { if (v) await scrivi(() => base44.entities.ImpiantoTargetSecondaria.update(imp.id, { data_fine: v }), 'Fine della programmazione aggiornata'); }}
                  />
                </p>
              </div>
              {modificabile && (
                <div className="flex gap-1 items-center">
                  <Button size="sm" variant="outline" onClick={() => setFormFornitoreDi(formFornitoreDi === imp.id ? null : imp.id)}>
                    <Plus className="w-4 h-4 mr-1" /> Raccoglitore o stoccaggio
                  </Button>
                  <Elimina nome={imp.nome_impianto} onElimina={() => scrivi(() => base44.entities.ImpiantoTargetSecondaria.delete(imp.id), `${imp.nome_impianto} eliminato`)} />
                </div>
              )}
            </div>

            {formFornitoreDi === imp.id && (
              <div className="border rounded p-2 bg-muted/30 flex flex-wrap gap-2 items-end">
                <label className="text-xs text-muted-foreground space-y-1 flex-1 min-w-[180px]">Nome
                  <Input value={formFornitore.nome} onChange={e => setFormFornitore({ ...formFornitore, nome: e.target.value })} />
                </label>
                <label className="text-xs text-muted-foreground space-y-1">Ruolo
                  <select value={formFornitore.ruolo} onChange={e => setFormFornitore({ ...formFornitore, ruolo: e.target.value })} className="block border rounded px-2 h-9 text-sm bg-background">
                    {RUOLI.map(r => <option key={r.valore} value={r.valore}>{r.nome}</option>)}
                  </select>
                </label>
                {(formFornitore.ruolo === 'stoccaggio' || formFornitore.ruolo === 'doppio_ruolo') && (
                  <>
                    <label className="text-xs text-muted-foreground space-y-1">Plafond (tonnellate)
                      <Input inputMode="decimal" value={formFornitore.plafond} onChange={e => setFormFornitore({ ...formFornitore, plafond: e.target.value })} className="w-36" />
                    </label>
                    <label className="text-xs text-muted-foreground space-y-1">Priorità
                      <Input inputMode="numeric" value={formFornitore.priorita} onChange={e => setFormFornitore({ ...formFornitore, priorita: e.target.value })} className="w-20" />
                    </label>
                  </>
                )}
                <Button size="sm" onClick={() => aggiungiFornitore(imp)} disabled={salvataggio}>{salvataggio && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salva</Button>
              </div>
            )}

            <div className="space-y-1">
              {suoi.map(f => (
                <Fornitore
                  key={f.id}
                  f={f}
                  target={targetMap[normalizzaRagioneSociale(f.nome)] || 0}
                  modificabile={modificabile}
                  scrivi={scrivi}
                  elimina={scrivi}
                />
              ))}
              {suoi.length === 0 && <p className="text-xs text-muted-foreground">Nessun raccoglitore o stoccaggio collegato.</p>}
            </div>
          </div>
        );
      })}

      {senzaImpianto.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 space-y-1">
          <p className="text-sm font-medium text-amber-900">Collegati a un impianto che nel {anno} non è seguito ({senzaImpianto.length})</p>
          {senzaImpianto.map(f => (
            <div key={f.id} className="flex items-center justify-between text-sm">
              <span>{f.nome} <span className="text-xs text-muted-foreground">verso {f.impianto_nome || 'impianto sconosciuto'}</span></span>
              {modificabile && <Elimina nome={f.nome} piccolo onElimina={() => scrivi(() => base44.entities.FornitoreSecondaria.delete(f.id), `${f.nome} eliminato`)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
