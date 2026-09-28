import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, Edit3, AlertTriangle, Copy, ArrowRightLeft, Wrench, ChevronDown, ChevronRight, CalendarClock, CheckCircle2 } from 'lucide-react';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { formatKg } from '@/lib/utils';
import { annoDelRecord, annoCorrenteRoma, daConfermare, senzaNotaCopia } from '@/lib/annoTarget';
import { chiaveNome, conModifica, nomeUtente } from '@/lib/target';
import { ton, it, testoErrore } from '@/components/predittivita/Comuni';

// Impianti e stoccaggi dell'anno, in Target & Status (27/09/2026): l'unico
// punto in cui si scrivono. Per ogni anno gli impianti col loro target di rete,
// la fine della programmazione, lo stato e se la predittivita' li segue; per
// ognuno i raccoglitori e gli stoccaggi che lo alimentano, con plafond e
// priorita'; e, per l'anno, la fine della programmazione e i chili per viaggio
// scritti sulla commessa Ecotyre. Giacenze e Predittivita' leggono da qui.
//
// Un record senza anno vale per il 2026 (annoDelRecord in src/lib/annoTarget.js):
// per questo si legge tutto e si filtra qui, mai .filter({ anno }), che i
// record senza anno li perderebbe. Ogni nuova scrittura mette l'anno.
//
// I pesi si scrivono in tonnellate e si salvano in chili, come li legge il
// calcolo. Niente finestre di sistema: si cancella con una conferma sulla riga.

// Gli stessi valori di base44/shared/fineProgrammazione.ts e regolePredittivita.ts
// (le pagine non importano da base44/shared): se cambiano li', vanno cambiati qui.
const FINE_2026 = '2026-12-18';
const KG_PER_VIAGGIO_PREDEFINITI = 13000;
// fra piu' commesse dello stesso anno vale la modificata per ultima, come nelle funzioni
const piuRecente = (righe) => (righe || []).reduce((x, r) => (!x || String(r.updated_date || r.created_date || '') > String(x.updated_date || x.created_date || '') ? r : x), null);
const eStoccaggio = (f) => ['stoccaggio', 'doppio_ruolo', 'raccoglitore_stoccaggio'].includes(ruoloDi(f));
// raccoglie primarie nel proprio piazzale e da li' spedisce secondarie (Nappi Sud, 28/09/2026)
const STOCCA = (r) => r === 'stoccaggio' || r === 'doppio_ruolo' || r === 'raccoglitore_stoccaggio';
const ruoloDi = (f) => f.ruolo || (f.tipo === 'stoccaggio' ? 'stoccaggio' : 'raccoglitore');
const segue = (imp) => imp.segue_predittivita !== false;

const RUOLI = [
  { valore: 'raccoglitore', nome: 'Raccoglitore' },
  { valore: 'stoccaggio', nome: 'Stoccaggio' },
  { valore: 'raccoglitore_stoccaggio', nome: 'Raccoglitore e stoccaggio' },
  { valore: 'doppio_ruolo', nome: 'Impianto e stoccaggio' },
  { valore: 'impianto', nome: 'Impianto' },
];
const CLASSE_RUOLO = {
  raccoglitore: 'bg-sky-100 text-sky-700 border-sky-300',
  impianto: 'bg-blue-100 text-blue-700 border-blue-300',
  stoccaggio: 'bg-amber-100 text-amber-700 border-amber-300',
  doppio_ruolo: 'bg-violet-100 text-violet-700 border-violet-300',
  raccoglitore_stoccaggio: 'bg-orange-100 text-orange-700 border-orange-300',
};

// Come si chiamano, per chi legge, le cose che la copia dell'anno conta.
const NOMI_CONTEGGI = {
  impianti: ['impianto', 'impianti'],
  collegamenti: ['collegamento di uno stoccaggio o raccoglitore a un impianto', 'collegamenti di stoccaggi e raccoglitori agli impianti'],
  raccoglitori: ['target annuo di un raccoglitore', 'target annui dei raccoglitori'],
  mensili: ['target mensile di un raccoglitore', 'target mensili dei raccoglitori'],
  commessa: ['contratto Ecotyre', 'contratti Ecotyre'],
  siti: ['sito di Giacenze', 'siti di Giacenze'],
};
const voceConteggio = (chiave, n) => {
  if (chiave === 'commessa') return 'il contratto Ecotyre';
  const nomi = NOMI_CONTEGGI[chiave] || [chiave.replace(/_/g, ' '), chiave.replace(/_/g, ' ')];
  return `${formatKg(n)} ${Number(n) === 1 ? nomi[0] : nomi[1]}`;
};
// E quello che la copia lascia stare, e perche'.
const NOMI_SALTATI = {
  impianti_esistenti: (n, anno) => `${formatKg(n)} ${n === 1 ? 'impianto c\'era già' : 'impianti c\'erano già'} nel ${anno}`,
  impianti_non_attivi: (n) => `${formatKg(n)} ${n === 1 ? 'impianto non attivo' : 'impianti non attivi'} dell'anno prima`,
  collegamenti_esistenti: (n, anno) => `${formatKg(n)} ${n === 1 ? 'collegamento c\'era già' : 'collegamenti c\'erano già'} nel ${anno}`,
  collegamenti_non_attivi: (n) => `${formatKg(n)} ${n === 1 ? 'collegamento non attivo' : 'collegamenti non attivi'}`,
  collegamenti_orfani: (n) => `${formatKg(n)} ${n === 1 ? 'collegamento verso un impianto che non c\'è più' : 'collegamenti verso impianti che non ci sono più'}`,
  collegamenti_senza_impianto: (n) => `${formatKg(n)} ${n === 1 ? 'collegamento il cui impianto non si è potuto creare' : 'collegamenti il cui impianto non si è potuto creare'}`,
  raccoglitori_esistenti: (n, anno) => `${formatKg(n)} ${n === 1 ? 'target annuo di raccoglitore c\'era già' : 'target annui di raccoglitori c\'erano già'} nel ${anno}`,
  mensili_esistenti: (n, anno) => `${formatKg(n)} ${n === 1 ? 'target mensile c\'era già' : 'target mensili c\'erano già'} nel ${anno}`,
  commessa_esistente: (n, anno) => `il contratto Ecotyre del ${anno} c'era già`,
  siti_esistenti: (n, anno) => `${formatKg(n)} ${n === 1 ? 'sito di Giacenze c\'era già' : 'siti di Giacenze c\'erano già'} nel ${anno}`,
  impianti_gia_compilati: (n, anno) => `${formatKg(n)} ${n === 1 ? 'impianto' : 'impianti'}: gli impianti del ${anno} sono già scritti a mano, e non si mescolano con quelli dell'anno prima`,
  collegamenti_gia_compilati: (n, anno) => `${formatKg(n)} ${n === 1 ? 'collegamento' : 'collegamenti'}: i collegamenti del ${anno} sono già scritti a mano`,
  raccoglitori_gia_compilati: (n, anno) => `${formatKg(n)} ${n === 1 ? 'target annuo di raccoglitore' : 'target annui di raccoglitori'}: i target annui del ${anno} sono già scritti a mano`,
  mensili_gia_compilati: (n, anno) => `${formatKg(n)} ${n === 1 ? 'target mensile' : 'target mensili'}: i target mensili del ${anno} sono già scritti a mano`,
  siti_gia_compilati: (n, anno) => `${formatKg(n)} ${n === 1 ? 'sito di Giacenze' : 'siti di Giacenze'}: i siti del ${anno} sono già scritti a mano`,
};
const voceSaltata = (chiave, n, anno) => (NOMI_SALTATI[chiave] ? NOMI_SALTATI[chiave](n, anno) : `${chiave.replace(/_/g, ' ')}: ${formatKg(n)}`);
const numeroConteggio = (v) => (typeof v === 'boolean' ? Number(v) : Array.isArray(v) ? v.length : Number(v) || 0);

/**
 * Tonnellate scritte a mano in chili interi; vuoto vale 0, null se non e' un
 * numero. All'italiana il punto separa le migliaia e la virgola i decimali:
 * '2.295' sono 2.295 t, '1.250,5' e '1250,5' sono 1.250,5 t (27/09/2026: prima
 * '2.295' si salvava come 2,295 t, mille volte meno). Un punto che non separa
 * gruppi di tre cifre resta il separatore dei decimali: '2.5' sono 2,5 t.
 */
function daTonnellate(testo) {
  const s = String(testo ?? '').trim().replace(/\s/g, '');
  if (!s) return 0;
  let n = NaN;
  if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(s)) n = Number(s.replace(/\./g, '').replace(',', '.'));
  else if (/^\d+(,\d+)?$/.test(s)) n = Number(s.replace(',', '.'));
  else if (/^\d+\.\d+$/.test(s)) n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : null;
}
const inTonnellate = (kg) => String((Number(kg) || 0) / 1000).replace('.', ',');

/** Chili interi scritti a mano: '13.000' o '13000'. Null se non e' un intero positivo. */
function daChili(testo) {
  const s = String(testo ?? '').trim().replace(/\s/g, '').replace(/\./g, '');
  return /^[1-9]\d*$/.test(s) ? Number(s) : null;
}

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

/** Il segno di un record copiato dall'anno prima, con il pulsante per confermarlo. */
function DaConfermare({ record, entita, modificabile, scrivi }) {
  if (!daConfermare(record)) return null;
  return (
    <span className="text-[11px] px-1 rounded bg-amber-100 text-amber-800 border border-amber-300 font-normal inline-flex items-center gap-1">
      copiato dall&apos;anno prima, da confermare
      {modificabile && (
        <button type="button" className="underline hover:text-emerald-700" onClick={() => scrivi(() => base44.entities[entita].update(record.id, { note: senzaNotaCopia(record.note) }), 'Confermato')}>
          Conferma
        </button>
      )}
    </span>
  );
}

function Fornitore({ f, target, modificabile, scrivi, salvaPlafond }) {
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
                const s = STOCCA(r);
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
          {f.regione && <span className="text-[11px] font-normal text-muted-foreground">{f.regione}</span>}
          <DaConfermare record={f} entita="FornitoreSecondaria" modificabile={modificabile} scrivi={scrivi} />
        </span>
        {modificabile && <Elimina nome={f.nome} piccolo onElimina={() => scrivi(() => base44.entities.FornitoreSecondaria.delete(f.id), `${f.nome} eliminato`)} />}
      </div>
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-muted-foreground">
        {!stocc || ruolo === 'doppio_ruolo' || ruolo === 'raccoglitore_stoccaggio' ? (
          <span>Target di raccolta dell&apos;anno (scheda Target raccoglitori): <span className="font-medium text-foreground">{target ? ton(target) : 'nessuno'}</span></span>
        ) : null}
        {stocc && (
          <>
            <span className="flex items-center gap-1">Plafond:
              <Modificabile
                attivo={modificabile}
                mostra={Number(f.plafond_stoccaggio_kg) > 0 ? ton(f.plafond_stoccaggio_kg) : 'nessuno'}
                iniziale={Number(f.plafond_stoccaggio_kg) > 0 ? inTonnellate(f.plafond_stoccaggio_kg) : ''}
                onSalva={(v) => salvaPlafond(f.nome, v)}
              />
            </span>
            <span className="flex items-center gap-1">Priorità verso questo impianto:
              <Modificabile
                attivo={modificabile}
                larghezza="w-14"
                mostra={Number(f.priorita) > 0 ? String(f.priorita) : "non scritta: vale l'ordine dell'anno"}
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

/** La fine della programmazione e i chili per viaggio dell'anno, sulla commessa Ecotyre. */
function RegoleAnno({ anno, commessa, modificabile, user, scrivi }) {
  const [fine, setFine] = useState('');
  const [kg, setKg] = useState('');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    setFine(commessa && commessa.fine_programmazione ? String(commessa.fine_programmazione).slice(0, 10) : '');
    setKg(commessa && Number(commessa.kg_per_viaggio) > 0 ? String(commessa.kg_per_viaggio) : '');
  }, [commessa]);

  const fineUsata = (commessa && commessa.fine_programmazione) || (anno === 2026 ? FINE_2026 : '');
  const kgUsati = (commessa && Number(commessa.kg_per_viaggio)) || KG_PER_VIAGGIO_PREDEFINITI;

  const salva = async () => {
    if (fine && !fine.startsWith(`${anno}-`)) { await scrivi(() => Promise.reject(new Error(`La fine della programmazione deve essere un giorno del ${anno}.`))); return; }
    const chili = kg.trim() ? daChili(kg) : null;
    if (kg.trim() && chili === null) { await scrivi(() => Promise.reject(new Error('Scrivi i chili per viaggio come numero intero, per esempio 13000.'))); return; }
    setSalvando(true);
    await scrivi(() => base44.entities.CommessaEcotyre.update(commessa.id, {
      fine_programmazione: fine || null,
      kg_per_viaggio: chili,
      storico_json: conModifica(commessa.storico_json, {
        utente: nomeUtente(user),
        nota: 'fine della programmazione e chili per viaggio',
        prima: { target_annuo_t: commessa.target_annuo_t ?? null, fine_programmazione: commessa.fine_programmazione || null, kg_per_viaggio: commessa.kg_per_viaggio ?? null },
      }),
    }), `Regole del ${anno} salvate`);
    setSalvando(false);
  };

  return (
    <section className="border rounded-lg p-3 space-y-2 bg-card">
      <h3 className="font-heading font-semibold flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" />Regole del {anno} per la predittività</h3>
      {!commessa ? (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Il {anno} non ha ancora la commessa Ecotyre, dove si scrivono la fine della programmazione e i chili per viaggio: prima crea la commessa dell&apos;anno nella scheda Commessa Ecotyre.
          {' '}Intanto si usano {fineUsata ? `il ${it(fineUsata)}` : `il 31/12/${anno}`} e {formatKg(kgUsati)} kg per viaggio.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted-foreground space-y-1">Fine della programmazione dell&apos;anno
              <Input type="date" value={fine} onChange={e => setFine(e.target.value)} disabled={!modificabile} className="w-44" />
            </label>
            <label className="text-xs text-muted-foreground space-y-1">Chili per viaggio
              <Input inputMode="numeric" value={kg} onChange={e => setKg(e.target.value)} disabled={!modificabile} placeholder={formatKg(KG_PER_VIAGGIO_PREDEFINITI)} className="w-32 text-right tabular-nums" />
            </label>
            {modificabile && <Button size="sm" onClick={salva} disabled={salvando}>{salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salva</Button>}
          </div>
          <p className="text-xs text-muted-foreground">
            Ora si usano {fineUsata ? `il ${it(fineUsata)}` : `il 31/12/${anno}, perché la data non è ancora scritta`} e {formatKg(kgUsati)} kg per viaggio
            {commessa && Number(commessa.kg_per_viaggio) > 0 ? '' : ' (il valore predefinito)'}. Un impianto con una sua fine della programmazione usa la sua.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Le due azioni che scrivono tanti record insieme: prima si chiede alla funzione
 * cosa farebbe (simula), si mostra, e si scrive solo se si conferma.
 */
function DialogoAzione({ azione, anno, onChiudi, onConferma }) {
  const annoInCorso = anno === annoCorrenteRoma();
  if (!azione) return null;
  const { tipo, fase, dati, errore } = azione;
  const copia = tipo === 'copia';
  const titolo = copia ? `Copia dal ${anno - 1} al ${anno}` : `Porta in Target & Status i target scritti in Giacenze (${anno})`;
  const conteggi = (dati && dati.conteggi) || {};
  const saltati = copia && dati && dati.saltati && !Array.isArray(dati.saltati) ? dati.saltati : {};
  const voci = Object.entries(conteggi).filter(([, v]) => numeroConteggio(v) > 0);
  const vociSaltate = Object.entries(saltati).filter(([, v]) => numeroConteggio(v) > 0);
  const elenco = dati && Array.isArray(dati.creati) ? dati.creati : [];
  const aggiornati = !copia && dati && Array.isArray(dati.aggiornati) ? dati.aggiornati : [];
  const daGiacenze = copia && dati ? Number(dati.impianti_da_giacenze) || 0 : 0;
  const nonPortati = !copia && dati && Array.isArray(dati.saltati) ? dati.saltati : [];
  const fatto = fase === 'fatto';
  const niente = copia ? voci.length === 0 : elenco.length === 0 && aggiornati.length === 0;
  const kgDi = (x) => (x.target_kg != null ? Number(x.target_kg) : Number(x.target_t || 0) * 1000);

  return (
    <Dialog open onOpenChange={(v) => { if (!v && fase !== 'eseguo') onChiudi(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titolo}</DialogTitle>
          <DialogDescription>
            {copia
              ? `Porta nel ${anno} quello che c'era nel ${anno - 1}: impianti (anche quelli che avevano il target solo in Giacenze), stoccaggi collegati, target dei raccoglitori, contratto Ecotyre (solo se il ${anno} non ce l'ha) e siti di Giacenze. Ogni cosa copiata è segnata "copiato dal ${anno - 1}, da confermare" finché non la confermi, qui o nella scheda Target raccoglitori. Quello che nel ${anno} è già scritto a mano non si tocca, e niente si cancella.`
              : `Per gli impianti che in Giacenze hanno un target totale ma in Target & Status non hanno ancora il loro impianto del ${anno}, o ce l'hanno con target zero, scrive qui quel target con la predittività spenta. Così Giacenze continua a vedere il loro target. Niente si cancella.`}
          </DialogDescription>
        </DialogHeader>

        {copia && annoInCorso && (
          <div className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Il {anno} è l&apos;anno in corso: Giacenze, predittività e cruscotti lo leggono subito. Si copiano solo le parti che nel {anno} sono ancora vuote.</span>
          </div>
        )}

        {(fase === 'simulo' || fase === 'eseguo') && (
          <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />{fase === 'simulo' ? 'Controllo cosa cambierebbe…' : 'Scrivo…'}</div>
        )}

        {errore && (
          <div className="text-sm text-red-900 bg-red-50 border border-red-300 rounded px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>Non è stato possibile: {errore}</span>
          </div>
        )}

        {dati && (fase === 'conferma' || fatto) && (
          <div className="space-y-3 text-sm">
            {fatto && (
              <p className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="w-4 h-4" />Fatto.</p>
            )}
            {niente ? (
              <p>{copia ? `Non c'è niente da copiare: il ${anno} ha già tutto quello che aveva il ${anno - 1}.` : `Non c'è niente da portare: ogni impianto con un target in Giacenze ha già il suo impianto del ${anno} in Target & Status.`}</p>
            ) : copia ? (
              <>
                <p>{fatto ? 'Ho copiato:' : 'Se confermi, copio:'}</p>
                <ul className="list-disc pl-6 space-y-0.5">
                  {voci.map(([k, v]) => <li key={k}>{voceConteggio(k, numeroConteggio(v))}{k === 'impianti' && daGiacenze > 0 ? `, di cui ${formatKg(daGiacenze)} con il target preso da Giacenze e la predittività spenta` : ''}</li>)}
                </ul>
              </>
            ) : (
              <>
                {elenco.length > 0 && (
                  <>
                    <p>{fatto ? 'Ho creato questi impianti:' : 'Se confermi, creo questi impianti, con la predittività spenta:'}</p>
                    <ul className="list-disc pl-6 space-y-0.5">
                      {elenco.map((x, i) => <li key={`${x.sito || x.nome_impianto}-${i}`}>{x.sito || x.nome_impianto || ''}: {ton(kgDi(x))}</li>)}
                    </ul>
                  </>
                )}
                {aggiornati.length > 0 && (
                  <>
                    <p>{fatto ? 'Ho scritto il target su questi impianti, che l\'avevano a zero:' : 'Se confermi, scrivo il target su questi impianti, che ce l\'hanno a zero (la predittività resta spenta):'}</p>
                    <ul className="list-disc pl-6 space-y-0.5">
                      {aggiornati.map((x, i) => <li key={`${x.sito}-${i}`}>{x.sito}: {ton(kgDi(x))}</li>)}
                    </ul>
                  </>
                )}
              </>
            )}
            {copia && vociSaltate.length > 0 && (
              <div className="text-muted-foreground">
                <p>Non copiati:</p>
                <ul className="list-disc pl-6 space-y-0.5">
                  {vociSaltate.map(([k, v]) => <li key={k}>{voceSaltata(k, numeroConteggio(v), anno)}</li>)}
                </ul>
              </div>
            )}
            {nonPortati.length > 0 && (
              <div className="text-muted-foreground">
                <p>Lasciati come sono:</p>
                <ul className="list-disc pl-6 space-y-0.5">
                  {nonPortati.map((x, i) => <li key={`${x.sito}-${i}`}>{x.sito}: {x.motivo}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onChiudi} disabled={fase === 'eseguo'}>{fatto || niente || errore ? 'Chiudi' : 'Annulla'}</Button>
          {fase === 'conferma' && !niente && !errore && (
            <Button onClick={onConferma}>{copia ? `Sì, copia nel ${anno}` : 'Sì, scrivi i target'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Le vecchie migrazioni, che non servono piu' tutti i giorni: solo l'amministratore, chiuse di norma. */
function Manutenzione({ onFatto }) {
  const [aperta, setAperta] = useState(false);
  const [lavoro, setLavoro] = useState(null);
  const [esito, setEsito] = useState(null);
  const esegui = async (funzione, descrivi) => {
    setLavoro(funzione);
    setEsito(null);
    try {
      const res = await base44.functions.invoke(funzione, {});
      const d = (res && res.data) || res || {};
      if (d.error) throw new Error(d.error);
      setEsito({ ok: true, testo: descrivi(d) });
      onFatto();
    } catch (e) {
      setEsito({ ok: false, testo: testoErrore(e) });
    }
    setLavoro(null);
  };
  const pulsante = (funzione, etichetta, descrivi) => (
    <Button size="sm" variant="outline" onClick={() => esegui(funzione, descrivi)} disabled={!!lavoro}>
      {lavoro === funzione && <Loader2 className="w-4 h-4 animate-spin mr-1" />}{etichetta}
    </Button>
  );
  return (
    <Collapsible open={aperta} onOpenChange={setAperta} className="border rounded-lg">
      <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground text-left">
        {aperta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Wrench className="w-4 h-4" /> Manutenzione
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 space-y-2">
        <p className="text-xs text-muted-foreground">Sistemazioni una tantum dei dati vecchi. Servono di rado: usale solo se sai che mancano.</p>
        <div className="flex flex-wrap gap-2">
          {pulsante('migraFornitoriRuolo', 'Sistema i ruoli di raccoglitori e stoccaggi', d => `${d.migrati || 0} sistemati, ${d.gia_migrati || 0} erano già a posto.`)}
          {pulsante('migraRegioni', 'Ricava di nuovo le regioni', d => `${d.raccoglitori_aggiornati || 0} raccoglitori, ${d.stoccaggi_aggiornati || 0} stoccaggi e ${d.impianti_aggiornati || 0} impianti aggiornati; ${d.eliminati || 0} doppioni tolti.`)}
        </div>
        {esito && <p className={`text-sm ${esito.ok ? 'text-emerald-800' : 'text-red-700'}`}>{esito.testo}</p>}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ConfigurazioneImpianti({ anno, solaLettura = false, user }) {
  const { toast } = useToast();
  const [impianti, setImpianti] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [targetMap, setTargetMap] = useState({});
  const [commessa, setCommessa] = useState(null);
  const [errori, setErrori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formImpianto, setFormImpianto] = useState(null);
  const [formFornitoreDi, setFormFornitoreDi] = useState(null);
  const [formFornitore, setFormFornitore] = useState({ nome: '', ruolo: 'raccoglitore', plafond: '', priorita: '' });
  const [salvataggio, setSalvataggio] = useState(false);
  const [azione, setAzione] = useState(null);
  // Il nome nuovo di un impianto in attesa di conferma: Giacenze lo trova per nome.
  const [rinominaDa, setRinominaDa] = useState(null);
  // Ogni azione sull'anno ha un numero: se il dialogo si chiude mentre la
  // funzione lavora, la risposta non lo riapre.
  const azioneCorrente = useRef(0);
  const modificabile = !solaLettura;
  // Le letture si numerano: una superata da un'altra (l'anno e' cambiato, o una
  // scrittura ha riletto nel frattempo) non tocca niente. Senza, cambiando anno
  // in fretta poteva restare a video, modificabile, la configurazione di un
  // anno chiuso sotto il titolo di quello in corso.
  const ultimaLettura = useRef(0);

  const load = useCallback(async () => {
    const n = ++ultimaLettura.current;
    setLoading(true);
    const [imps, forns, targets, comm] = await Promise.allSettled([
      fetchAllClient(base44.entities.ImpiantoTargetSecondaria),
      fetchAllClient(base44.entities.FornitoreSecondaria),
      fetchAllClient(base44.entities.TargetRaccoglitore, { anno }),
      base44.entities.CommessaEcotyre.filter({ anno }),
    ]);
    if (n !== ultimaLettura.current) return;
    const nuovi = [];
    if (imps.status === 'fulfilled') setImpianti((imps.value || []).filter(i => annoDelRecord(i) === anno).sort((a, b) => String(a.nome_impianto || '').localeCompare(String(b.nome_impianto || ''), 'it')));
    else nuovi.push(`gli impianti (${testoErrore(imps.reason)})`);
    if (forns.status === 'fulfilled') setFornitori((forns.value || []).filter(f => annoDelRecord(f) === anno));
    else nuovi.push(`raccoglitori e stoccaggi (${testoErrore(forns.reason)})`);
    if (targets.status === 'fulfilled') {
      // Un raccoglitore diviso per regione ha piu' righe: si sommano, come fa il calcolo.
      const tm = {};
      for (const t of targets.value || []) {
        const k = chiaveNome(t.raccoglitore);
        if (k) tm[k] = (tm[k] || 0) + (Number(t.target_tonnellate) || 0) * 1000;
      }
      setTargetMap(tm);
    } else nuovi.push(`i target dei raccoglitori (${testoErrore(targets.reason)})`);
    if (comm.status === 'fulfilled') setCommessa(piuRecente(comm.value));
    else nuovi.push(`la commessa Ecotyre (${testoErrore(comm.reason)})`);
    setErrori(nuovi);
    setLoading(false);
  }, [anno]);

  useEffect(() => { load(); setFormImpianto(null); setFormFornitoreDi(null); setAzione(null); }, [load]);

  // Ogni scrittura: se riesce si rilegge, se no si dice perche'.
  const scrivi = async (fn, messaggio) => {
    try {
      await fn();
      if (messaggio) toast({ title: messaggio });
      await load();
      return true;
    } catch (e) {
      toast({ title: 'Non salvato', description: testoErrore(e), variant: 'destructive' });
      return false;
    }
  };

  // Il plafond e' dello stoccaggio: si scrive su tutti i suoi collegamenti
  // dell'anno, cosi' non ce ne sono due diversi.
  const salvaPlafond = async (nome, testo) => {
    const kg = daTonnellate(testo);
    if (kg === null) { await scrivi(() => Promise.reject(new Error('Scrivi il plafond in tonnellate, per esempio 1.250,5 oppure 1250,5.'))); return; }
    const suoi = fornitori.filter(f => eStoccaggio(f) && chiaveNome(f.nome) === chiaveNome(nome));
    await scrivi(async () => { for (const f of suoi) await base44.entities.FornitoreSecondaria.update(f.id, { plafond_stoccaggio_kg: kg }); }, 'Plafond aggiornato');
  };

  const aggiungiImpianto = async () => {
    const nome = formImpianto.nome.trim();
    const target = daTonnellate(formImpianto.target);
    if (!nome) { toast({ title: 'Manca il nome dell\'impianto', variant: 'destructive' }); return; }
    if (impianti.some(i => chiaveNome(i.nome_impianto) === chiaveNome(nome))) { toast({ title: `${nome} c'è già nel ${anno}`, description: 'Correggi quello che c\'è invece di aggiungerne un altro.', variant: 'destructive' }); return; }
    if (target === null) { toast({ title: 'Il target non è un numero', description: 'Scrivilo in tonnellate, per esempio 2.295 oppure 2295.', variant: 'destructive' }); return; }
    if (!target) { toast({ title: 'Manca il target', description: `Scrivi il target di rete del ${anno} in tonnellate, più di zero.`, variant: 'destructive' }); return; }
    if (formImpianto.data_fine && !formImpianto.data_fine.startsWith(`${anno}-`)) { toast({ title: `La fine della programmazione deve essere un giorno del ${anno}`, variant: 'destructive' }); return; }
    setSalvataggio(true);
    const ok = await scrivi(() => base44.entities.ImpiantoTargetSecondaria.create({
      nome_impianto: nome, target, stato: 'attivo', anno, segue_predittivita: !!formImpianto.segue,
      ...(formImpianto.data_fine ? { data_fine: formImpianto.data_fine } : {}),
    }), `${nome} aggiunto al ${anno}`);
    setSalvataggio(false);
    if (ok) setFormImpianto(null);
  };

  const aggiungiFornitore = async (imp) => {
    const nome = formFornitore.nome.trim();
    const stocc = STOCCA(formFornitore.ruolo);
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

  // Giacenze trova il target di un impianto e le sue primarie per nome (sito e
  // impianto dei raccoglitori): un nome che cambia davvero (non solo la grafia)
  // li scollega, e prima di farlo lo si dice.
  const rinomina = async (imp, v, confermato = false) => {
    const nome = String(v || '').trim();
    if (!nome) { await scrivi(() => Promise.reject(new Error('Il nome non può essere vuoto.'))); return; }
    if (impianti.some(i => i.id !== imp.id && chiaveNome(i.nome_impianto) === chiaveNome(nome))) { await scrivi(() => Promise.reject(new Error(`${nome} c'è già nel ${anno}.`))); return; }
    if (!confermato && chiaveNome(nome) !== chiaveNome(imp.nome_impianto)) { setRinominaDa({ imp, nome }); return; }
    setRinominaDa(null);
    const collegati = fornitori.filter(f => f.impianto_id === imp.id);
    await scrivi(async () => {
      await base44.entities.ImpiantoTargetSecondaria.update(imp.id, { nome_impianto: nome });
      for (const f of collegati) await base44.entities.FornitoreSecondaria.update(f.id, { impianto_nome: nome });
    }, 'Nome aggiornato');
  };

  // Le azioni sull'anno: prima la simulazione, poi, se si conferma, la scrittura.
  const avvia = async (tipo) => {
    const funzione = tipo === 'copia' ? 'copiaAnnoTarget' : 'portaTargetInTargetStatus';
    const n = ++azioneCorrente.current;
    setAzione({ tipo, fase: 'simulo', dati: null, errore: null });
    try {
      const res = await base44.functions.invoke(funzione, { anno, simula: true });
      const d = (res && res.data) || res || {};
      if (d.error) throw new Error(d.error);
      if (n === azioneCorrente.current) setAzione({ tipo, fase: 'conferma', dati: d, errore: null });
    } catch (e) {
      if (n === azioneCorrente.current) setAzione({ tipo, fase: 'conferma', dati: null, errore: testoErrore(e) });
    }
  };
  const chiudiAzione = () => { azioneCorrente.current++; setAzione(null); };
  const conferma = async () => {
    const { tipo } = azione;
    const funzione = tipo === 'copia' ? 'copiaAnnoTarget' : 'portaTargetInTargetStatus';
    const n = ++azioneCorrente.current;
    setAzione(a => ({ ...a, fase: 'eseguo' }));
    try {
      const res = await base44.functions.invoke(funzione, { anno, simula: false });
      const d = (res && res.data) || res || {};
      if (d.error) throw new Error(d.error);
      if (n === azioneCorrente.current) setAzione({ tipo, fase: 'fatto', dati: d, errore: null });
    } catch (e) {
      if (n === azioneCorrente.current) setAzione({ tipo, fase: 'fatto', dati: null, errore: `${testoErrore(e)}. Quello che è stato scritto resta: puoi riprovare, completa solo quello che manca.` });
    }
    await load();
  };

  if (loading) return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  const idImpianti = new Set(impianti.map(i => i.id));
  const senzaImpianto = fornitori.filter(f => !idImpianti.has(f.impianto_id));
  const fineAnno = (commessa && commessa.fine_programmazione) || (anno === 2026 ? FINE_2026 : '');
  const totaleTarget = impianti.filter(i => i.stato !== 'non_attivo').reduce((s, i) => s + (Number(i.target) || 0), 0);

  return (
    <div className="space-y-4">
      {errori.length > 0 && (
        <div className="text-sm text-red-900 bg-red-50 border border-red-300 rounded-lg px-3 py-2 flex items-start gap-2 flex-wrap">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">Non si sono potuti leggere {errori.join('; ')}.</span>
          <Button size="sm" variant="outline" onClick={load}>Riprova</Button>
        </div>
      )}

      {modificabile && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => avvia('copia')}><Copy className="w-4 h-4 mr-1" />Copia dal {anno - 1}</Button>
          <Button size="sm" variant="outline" onClick={() => avvia('porta')}><ArrowRightLeft className="w-4 h-4 mr-1" />Porta in Target &amp; Status i target scritti in Giacenze</Button>
        </div>
      )}

      <RegoleAnno anno={anno} commessa={commessa} modificabile={modificabile} user={user} scrivi={scrivi} />

      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="font-heading font-semibold">Impianti del {anno} ({impianti.length}) · target totale {ton(totaleTarget)}</h2>
        {modificabile && (
          <Button size="sm" onClick={() => setFormImpianto(formImpianto ? null : { nome: '', target: '', data_fine: '', segue: true })}>
            <Plus className="w-4 h-4 mr-1" /> Aggiungi impianto
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Il target è quello di rete, in tonnellate. Giacenze lo legge da qui; la predittività segue solo gli impianti attivi con il suo interruttore acceso.
        Il piazzale di un impianto non va registrato come suo stoccaggio: si registra solo come stoccaggio degli altri impianti a cui spedisce.
        La priorità vale per uno stoccaggio che alimenta più impianti: 1 al primo.
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
            <label className="text-xs text-muted-foreground space-y-1">Fine della programmazione (vuota: quella dell&apos;anno)
              <Input type="date" value={formImpianto.data_fine} onChange={e => setFormImpianto({ ...formImpianto, data_fine: e.target.value })} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={formImpianto.segue} onCheckedChange={v => setFormImpianto({ ...formImpianto, segue: v })} />
            Segui nella predittività
          </label>
          <Button size="sm" onClick={aggiungiImpianto} disabled={salvataggio}>{salvataggio && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salva</Button>
        </div>
      )}

      {impianti.length === 0 && (
        <p className="text-sm text-muted-foreground border rounded-lg p-4 text-center">
          Per il {anno} non c&apos;è ancora nessun impianto{modificabile ? `: aggiungili qui sopra, o copia quelli del ${anno - 1}.` : '.'}
        </p>
      )}

      {impianti.map(imp => {
        const suoi = fornitori.filter(f => f.impianto_id === imp.id);
        // Impianto e stoccaggio insieme: lo stesso nome compare fra gli stoccaggi
        // dell'anno. Target e plafond devono fare la capacita' totale.
        const comeStoccaggio = fornitori.filter(f => eStoccaggio(f) && chiaveNome(f.nome) === chiaveNome(imp.nome_impianto));
        const doppio = comeStoccaggio.length > 0 || Number(imp.totale_capacity_kg) > 0;
        const plafond = comeStoccaggio.reduce((m, f) => Math.max(m, Number(f.plafond_stoccaggio_kg) || 0), 0);
        const totale = Number(imp.totale_capacity_kg) || 0;
        const somma = (Number(imp.target) || 0) + plafond;
        const incongruente = totale > 0 && somma !== totale;
        const fineSua = imp.data_fine ? String(imp.data_fine).slice(0, 10) : '';
        const fineAltroAnno = fineSua && !fineSua.startsWith(`${anno}-`);
        return (
          <div key={imp.id} className={`border rounded-lg p-3 space-y-2 ${imp.stato === 'non_attivo' ? 'opacity-75' : ''}`}>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="space-y-1">
                <h3 className="font-heading font-semibold flex items-center gap-2 flex-wrap">
                  <Modificabile attivo={modificabile} larghezza="w-56" mostra={imp.nome_impianto} iniziale={imp.nome_impianto || ''} onSalva={v => rinomina(imp, v)} />
                  {modificabile ? (
                    <select
                      value={imp.stato === 'non_attivo' ? 'non_attivo' : 'attivo'}
                      aria-label={`Stato di ${imp.nome_impianto}`}
                      onChange={e => scrivi(() => base44.entities.ImpiantoTargetSecondaria.update(imp.id, { stato: e.target.value }), 'Stato aggiornato')}
                      className="text-[11px] border rounded px-1 py-0.5 bg-background font-normal"
                    >
                      <option value="attivo">attivo</option>
                      <option value="non_attivo">non attivo</option>
                    </select>
                  ) : (
                    imp.stato === 'non_attivo' && <span className="text-[11px] px-1 rounded bg-muted text-muted-foreground font-normal">non attivo</span>
                  )}
                  <DaConfermare record={imp} entita="ImpiantoTargetSecondaria" modificabile={modificabile} scrivi={scrivi} />
                </h3>
                {rinominaDa && rinominaDa.imp.id === imp.id && (
                  <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded px-2 py-1.5 space-y-1 max-w-xl">
                    <p>
                      Giacenze trova il target di questo impianto e le sue primarie per nome: con il nome «{rinominaDa.nome}» il sito «{imp.nome_impianto}» di Giacenze
                      non lo troverà più, e nemmeno i target dei raccoglitori scritti verso «{imp.nome_impianto}». Rinomina solo se anche lì il nome cambia.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => rinomina(imp, rinominaDa.nome, true)}>Rinomina lo stesso</Button>
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setRinominaDa(null)}>Annulla</Button>
                    </div>
                  </div>
                )}
                {(imp.regione || senzaNotaCopia(imp.note)) && (
                  <p className="text-xs text-muted-foreground">
                    {imp.regione ? `Regione: ${imp.regione}` : ''}{imp.regione && senzaNotaCopia(imp.note) ? ' · ' : ''}{senzaNotaCopia(imp.note) ? `Note: ${senzaNotaCopia(imp.note)}` : ''}
                  </p>
                )}
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  Target di rete:
                  <Modificabile
                    attivo={modificabile}
                    mostra={ton(imp.target)}
                    iniziale={inTonnellate(imp.target)}
                    onSalva={async (v) => {
                      const kg = daTonnellate(v);
                      if (kg === null) { await scrivi(() => Promise.reject(new Error('Scrivi il target in tonnellate, per esempio 2.295 oppure 2295.'))); return; }
                      if (!kg) { await scrivi(() => Promise.reject(new Error('Il target non può essere vuoto o zero: se l\'impianto quest\'anno non lavora, mettilo "non attivo".'))); return; }
                      await scrivi(() => base44.entities.ImpiantoTargetSecondaria.update(imp.id, { target: kg }), 'Target aggiornato');
                    }}
                  />
                  <span>· fine della programmazione:</span>
                  <Modificabile
                    attivo={modificabile}
                    tipo="date"
                    larghezza="w-36"
                    mostra={fineSua ? it(fineSua) : `quella dell'anno (${fineAnno ? it(fineAnno) : `31/12/${anno}, da scrivere`})`}
                    iniziale={fineSua}
                    onSalva={async (v) => {
                      if (v && !String(v).startsWith(`${anno}-`)) { await scrivi(() => Promise.reject(new Error(`La fine della programmazione deve essere un giorno del ${anno}.`))); return; }
                      await scrivi(() => base44.entities.ImpiantoTargetSecondaria.update(imp.id, { data_fine: v || null }), v ? 'Fine della programmazione aggiornata' : 'Ora vale la fine della programmazione dell\'anno');
                    }}
                  />
                </p>
                {fineAltroAnno && (
                  <p className="text-xs text-amber-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />La fine della programmazione non è del {anno}: la predittività non la usa. Correggila o cancellala.</p>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={segue(imp)}
                    disabled={!modificabile}
                    onCheckedChange={v => scrivi(() => base44.entities.ImpiantoTargetSecondaria.update(imp.id, { segue_predittivita: v }), v ? 'Ora la predittività lo segue' : 'La predittività non lo segue più')}
                  />
                  Segui nella predittività
                  {!segue(imp) && <span className="text-xs text-muted-foreground">(ha solo il target, che Giacenze legge)</span>}
                </label>
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

            {doppio && (
              <div className={`border rounded p-2 text-sm space-y-1 ${incongruente ? 'border-amber-400 bg-amber-50' : 'bg-muted/20'}`}>
                <p className="text-xs font-medium">Impianto e stoccaggio insieme: il target dell&apos;impianto più il plafond del suo stoccaggio fanno la capacità totale.</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">Capacità totale:
                    <Modificabile
                      attivo={modificabile}
                      mostra={totale > 0 ? ton(totale) : 'non scritta'}
                      iniziale={totale > 0 ? inTonnellate(totale) : ''}
                      onSalva={async (v) => {
                        const kg = daTonnellate(v);
                        if (kg === null) { await scrivi(() => Promise.reject(new Error('Scrivi la capacità totale in tonnellate.'))); return; }
                        await scrivi(() => base44.entities.ImpiantoTargetSecondaria.update(imp.id, { totale_capacity_kg: kg }), 'Capacità totale aggiornata');
                      }}
                    />
                  </span>
                  <span>Target impianto: <span className="font-medium text-foreground">{ton(imp.target)}</span></span>
                  <span className="flex items-center gap-1">Plafond dello stoccaggio:
                    {comeStoccaggio.length > 0 ? (
                      <Modificabile
                        attivo={modificabile}
                        mostra={plafond > 0 ? ton(plafond) : 'nessuno'}
                        iniziale={plafond > 0 ? inTonnellate(plafond) : ''}
                        onSalva={v => salvaPlafond(imp.nome_impianto, v)}
                      />
                    ) : <span className="font-medium text-foreground">nessuno stoccaggio con questo nome nel {anno}</span>}
                  </span>
                </div>
                {totale > 0 && (
                  <p className={`text-xs ${incongruente ? 'text-amber-800 font-medium' : 'text-emerald-700'}`}>
                    {ton(imp.target)} + {ton(plafond)} = {ton(somma)}{incongruente ? `: non fa la capacità totale di ${ton(totale)} (${somma < totale ? 'mancano' : 'avanzano'} ${ton(Math.abs(totale - somma))}).` : ': torna con la capacità totale.'}
                  </p>
                )}
              </div>
            )}

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
                {STOCCA(formFornitore.ruolo) && (
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
                  target={targetMap[chiaveNome(f.nome)] || 0}
                  modificabile={modificabile}
                  scrivi={scrivi}
                  salvaPlafond={salvaPlafond}
                />
              ))}
              {suoi.length === 0 && <p className="text-xs text-muted-foreground">Nessun raccoglitore o stoccaggio collegato.</p>}
            </div>
          </div>
        );
      })}

      {senzaImpianto.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 space-y-1">
          <p className="text-sm font-medium text-amber-900">Collegati a un impianto che nel {anno} non c&apos;è ({senzaImpianto.length})</p>
          {senzaImpianto.map(f => (
            <div key={f.id} className="flex items-center justify-between text-sm">
              <span>{f.nome} <span className="text-xs text-muted-foreground">verso {f.impianto_nome || 'impianto sconosciuto'}</span></span>
              {modificabile && <Elimina nome={f.nome} piccolo onElimina={() => scrivi(() => base44.entities.FornitoreSecondaria.delete(f.id), `${f.nome} eliminato`)} />}
            </div>
          ))}
        </div>
      )}

      {modificabile && <Manutenzione onFatto={load} />}

      <DialogoAzione azione={azione} anno={anno} onChiudi={chiudiAzione} onConferma={conferma} />
    </div>
  );
}
