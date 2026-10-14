import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, History, FileSpreadsheet } from 'lucide-react';
import { MESI } from '@/lib/pfuConstants';
import { tonnellate, percentuale, leggiNumero, leggiStorico, conModifica, nomeUtente, dataOra, REGIONI_COMMESSA } from '@/lib/target';
import { leggiFileTargetContratto } from '@/lib/targetContratto';
import { RiepilogoDate } from '@/components/primarie-rete/DateDaSistemare';
import { scriviConTraccia, avvisoTraccia } from '@/lib/scriviConTraccia';
import StoricoModifiche from '@/components/shared/StoricoModifiche';
import VariazioneContratto, { ElencoVariazioni, avvisoVariazioniChiuse } from '@/components/target-status/VariazioneContratto';
import { variazioniDelContratto, variazioniCheSiChiudono } from '@/lib/attesoContratto';
import { annunciaTarget, useTargetCambiati, useOrigine } from '@/lib/eventiDati';

// Commessa Ecotyre dell'anno, cioe' quanto richiede il contratto: target annuo e
// per regione, ripartizione per classe, target mensile iniziale e rivisto, budget
// mensile rete e ACI, quantita' per destinazione e target con prezzo per regione.
// Si scrive una volta, o si importa dal foglio del contratto, e si aggiorna se
// Ecotyre lo rivede. L'Andamento confronta il raccolto per regione con questi dati.
// isAdmin arriva gia' falso per chi non e' amministratore e per un anno chiuso:
// allora la commessa si legge soltanto.
//
// Si salva con scriviConTraccia (11/10/2026): ogni tabella che cambia finisce
// nello storico delle modifiche col valore di prima e di dopo, mese per mese e
// regione per regione, e col motivo scritto accanto al pulsante. Lo storico
// delle modifiche si legge in fondo alla scheda; quello di prima (storico_json,
// che diceva solo il target annuo di prima) resta sotto.
//
// LE VARIAZIONI DEL CONSORZIO IN CORSO D'ANNO (richiesta dell'utente del
// 14/10/2026: 100 t in piu' a ottobre in Puglia, scritte solo nel target di
// SMOCO, e la dashboard restava a 11.550 t). Non si riscrive la tabella a mano:
// «Registra una variazione» (VariazioneContratto.jsx) cambia con una scrittura
// sola target annuo, regione, target mensile rivisto del mese e, se si dice, la
// destinazione, e lascia la voce nello storico col motivo e il giorno della
// comunicazione. Qui si vede l'elenco delle variazioni dell'anno.
// Se un salvataggio della tabella (a mano o da un foglio importato) cambia la
// regione o il mese che una variazione aveva scritto, la variazione esce dai
// numeri e resta in elenco barrata (revisione del 14/10/2026): la scheda lo
// dice prima di salvare (variazioniCheSiChiudono), non dopo.
//
// LE ALTRE SCHEDE APERTE (14/10/2026, richiesta dell'utente: «fai in modo che
// quando si faccia una tale variazione i moduli collegati come la dashboard si
// aggiornino di conseguenza»). Un salvataggio si annuncia alle pagine gia'
// aperte (annunciaTarget, src/lib/eventiDati.js), che rileggono il contratto.
// E questa scheda, aperta in un'altra scheda del browser mentre di qua si
// registra una variazione, rilegge il contratto: senza modifiche a video lo
// rimette com'e'; con modifiche non salvate le tiene e rimette come salvate le
// parti che non erano state toccate (riallineaAlContratto), cosi' l'avviso
// «esce dai numeri» confronta il contratto di adesso e lo storico scrive il
// «prima» vero. Prima restava il contratto letto all'apertura, e salvarla
// avrebbe tolto la variazione senza dire niente.
//
// L'ANNUNCIO NON ARRIVA DAPPERTUTTO (revisione del 14/10/2026): da un altro
// computer, o da un browser senza il canale fra le schede, non arriva niente.
// Per questo il salvataggio rilegge il contratto subito prima di scrivere (una
// lettura per salvataggio, come la variazione): se nel frattempo e' cambiato,
// le parti non toccate a video prendono i numeri salvati e si scrive l'unione;
// se una parte e' cambiata qui e li', non si scrive niente e la scheda lo dice,
// con l'avviso «esce dai numeri» se una variazione ne uscirebbe: si salva
// premendo di nuovo. Lo storico e il «prima» si scrivono da quello riletto.

const ORIGINE = 'Target & Status, commessa Ecotyre';
const testo = (v) => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','));
const leggiJson = (json, riserva) => { try { const v = JSON.parse(json || 'null'); return v ?? riserva; } catch { return riserva; } };
const numero = (v) => { const n = leggiNumero(v); return n === null || Number.isNaN(n) ? null : n; };
const somma = (valori) => valori.reduce((s, v) => s + (numero(v) || 0), 0);
const dodici = (arr) => [...(arr || []).map(testo), ...Array(12).fill('')].slice(0, 12);

function statoDaRecord(r) {
  return {
    target_annuo_t: testo(r && r.target_annuo_t),
    regioni: r ? leggiJson(r.regioni_json, []).map(x => ({ regione: x.regione || '', province: x.province || '', target: testo(x.target_t) })) : REGIONI_COMMESSA.map(x => ({ regione: x, province: '', target: '' })),
    classi: r ? leggiJson(r.classi_json, []).map(x => ({ classe: x.classe || '', descrizione: x.descrizione || '', peso: x.peso || '', percentuale: testo(x.percentuale != null ? Math.round(x.percentuale * 10000) / 100 : '') })) : [],
    mensile_iniziale: dodici(r && leggiJson(r.target_mensile_iniziale_json, [])),
    mensile: dodici(r && leggiJson(r.target_mensile_json, [])),
    rete: dodici(r && leggiJson(r.budget_rete_json, [])),
    aci: dodici(r && leggiJson(r.budget_aci_json, [])),
    destinazioni: r ? leggiJson(r.destinazioni_json, []).map(x => ({ destinazione: x.destinazione || '', target: testo(x.target_t), trattamento: x.trattamento || '' })) : [],
    prezzo_regioni: r ? leggiJson(r.target_prezzo_regioni_json, []).map(x => ({ regione: x.regione || '', target: testo(x.target_t), prezzo: testo(x.prezzo) })) : [],
  };
}

function statoDaContratto(c) {
  return {
    target_annuo_t: testo(c.target_annuo_t),
    regioni: c.regioni.map(x => ({ regione: x.regione, province: x.province, target: testo(x.target_t) })),
    classi: c.classi.map(x => ({ classe: x.classe, descrizione: x.descrizione, peso: x.peso, percentuale: testo(x.percentuale != null ? Math.round(x.percentuale * 10000) / 100 : '') })),
    mensile_iniziale: dodici(c.target_mensile_iniziale),
    mensile: dodici(c.target_mensile),
    rete: dodici(c.budget_rete),
    aci: dodici(c.budget_aci),
    destinazioni: c.destinazioni.map(x => ({ destinazione: x.destinazione, target: testo(x.target_t), trattamento: x.trattamento })),
    prezzo_regioni: c.target_prezzo_regioni.map(x => ({ regione: x.regione, target: testo(x.target_t), prezzo: testo(x.prezzo) })),
  };
}

// I campi che il salvataggio scrive, dai dati a video (o da un foglio letto).
function valoriDa(dati, anno) {
  return {
    anno,
    target_annuo_t: numero(dati.target_annuo_t),
    regioni_json: JSON.stringify(dati.regioni.filter(r => r.regione.trim()).map(r => ({ regione: r.regione.trim(), province: r.province.trim(), target_t: numero(r.target) }))),
    classi_json: JSON.stringify(dati.classi.filter(c => c.classe.trim()).map(c => ({ classe: c.classe.trim(), descrizione: c.descrizione.trim(), peso: c.peso.trim(), percentuale: numero(c.percentuale) === null ? null : numero(c.percentuale) / 100 }))),
    target_mensile_iniziale_json: JSON.stringify(dati.mensile_iniziale.map(numero)),
    target_mensile_json: JSON.stringify(dati.mensile.map(numero)),
    budget_rete_json: JSON.stringify(dati.rete.map(numero)),
    budget_aci_json: JSON.stringify(dati.aci.map(numero)),
    destinazioni_json: JSON.stringify(dati.destinazioni.filter(d => d.destinazione.trim()).map(d => ({ destinazione: d.destinazione.trim(), target_t: numero(d.target), trattamento: d.trattamento.trim() }))),
    target_prezzo_regioni_json: JSON.stringify(dati.prezzo_regioni.filter(p => p.regione.trim()).map(p => ({ regione: p.regione.trim(), target_t: numero(p.target), prezzo: numero(p.prezzo) }))),
  };
}

// I campi che il salvataggio scrive: per ognuno la sua parte a video e come si chiama.
const CAMPI = [
  ['target_annuo_t', 'target_annuo_t', 'il target annuo'],
  ['regioni_json', 'regioni', 'le regioni'],
  ['classi_json', 'classi', 'la ripartizione per classe'],
  ['target_mensile_iniziale_json', 'mensile_iniziale', 'il target mensile iniziale'],
  ['target_mensile_json', 'mensile', 'il target mensile rivisto'],
  ['budget_rete_json', 'rete', 'il budget RETE'],
  ['budget_aci_json', 'aci', 'il budget ACI'],
  ['destinazioni_json', 'destinazioni', 'le quantità per destinazione'],
  ['target_prezzo_regioni_json', 'prezzo_regioni', 'la previsione ACI per regione'],
];
const elenco = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);

/**
 * I numeri a video quando il contratto, sotto, e' cambiato (revisione del
 * 14/10/2026). base: il record da cui vengono i numeri a video (null se non
 * c'era); fresca: il contratto riletto adesso; dati: quello che c'e' a video.
 * Campo per campo, coi valori ripuliti come li scrive il salvataggio:
 * - cambiato solo li': a video va il valore salvato (aggiornati);
 * - cambiato qui e li' in modo diverso: resta quello a video (conflitti);
 * - cambiato solo qui, o in nessuno dei due: resta quello a video.
 * Restituisce { dati, aggiornati, conflitti }, coi nomi delle parti.
 */
export function riallineaAlContratto({ base, fresca, dati, anno }) {
  const prima = valoriDa(statoDaRecord(base), anno);
  const adesso = valoriDa(statoDaRecord(fresca), anno);
  const qui = valoriDa(dati, anno);
  const salvati = statoDaRecord(fresca);
  const nuovi = { ...dati };
  const aggiornati = [];
  const conflitti = [];
  for (const [campo, parte, nome] of CAMPI) {
    if (adesso[campo] === prima[campo]) continue;
    if (qui[campo] === prima[campo]) { nuovi[parte] = salvati[parte]; aggiornati.push(nome); } else if (qui[campo] !== adesso[campo]) conflitti.push(nome);
  }
  return { dati: nuovi, aggiornati, conflitti };
}

/** Che cosa dice la scheda quando ha rimesso a video le parti salvate altrove. */
export function avvisoRiallineo({ anno, dove, aggiornati = [], conflitti = [], fermato = false }) {
  const pezzi = [`Mentre modificavi, il contratto del ${anno} è stato salvato ${dove}${aggiornati.length ? `: per ${elenco(aggiornati)} ora a video c'è quello salvato, che non avevi toccato` : ''}.`];
  if (conflitti.length) pezzi.push(`Avevi cambiato anche tu ${elenco(conflitti)}: lì a video restano i tuoi numeri, e salvando prendono il posto di quelli salvati; per ripartire dal contratto salvato ricarica la pagina.`);
  else pezzi.push('Le tue modifiche restano.');
  if (fermato) pezzi.push(`Non ho salvato niente: controlla e premi di nuovo «Salva commessa ${anno}».`);
  return pezzi.join(' ');
}

// Tabella con righe modificabili: colonne [{ chiave, etichetta, numero, classe }].
function Tabella({ colonne, righe, onChange, isAdmin, nuovaRiga, totale }) {
  const cambia = (i, chiave, v) => onChange(righe.map((r, j) => (j === i ? { ...r, [chiave]: v } : r)));
  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr className="text-muted-foreground">
            {colonne.map(c => <th key={c.chiave} className={`py-1 px-1 ${c.numero ? 'text-right' : 'text-left'}`}>{c.etichetta}</th>)}
            {isAdmin && <th className="w-6" />}
          </tr>
        </thead>
        <tbody>
          {righe.map((r, i) => (
            <tr key={i}>
              {colonne.map(c => (
                <td key={c.chiave} className={`py-0.5 px-1 ${c.classe || ''}`}>
                  <Input value={r[c.chiave]} onChange={e => cambia(i, c.chiave, e.target.value)} disabled={!isAdmin}
                    inputMode={c.numero ? 'decimal' : undefined} className={`h-8 ${c.numero ? 'text-right tabular-nums' : ''}`} />
                </td>
              ))}
              {isAdmin && <td><button onClick={() => onChange(righe.filter((_, j) => j !== i))} className="p-1 hover:bg-red-50 rounded" title="Togli riga"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button></td>}
            </tr>
          ))}
          {totale && (
            <tr className="border-t font-semibold">
              {colonne.map((c, i) => <td key={c.chiave} className={`py-1 px-1 ${c.numero ? 'text-right tabular-nums' : ''}`}>{i === 0 ? 'Totale' : (totale[c.chiave] ?? '')}</td>)}
              {isAdmin && <td />}
            </tr>
          )}
        </tbody>
      </table>
      {isAdmin && nuovaRiga && <button onClick={() => onChange([...righe, nuovaRiga])} className="mt-1 text-xs text-primary hover:underline inline-flex items-center gap-1"><Plus className="w-3 h-3" />Aggiungi riga</button>}
    </div>
  );
}

function Riquadro({ titolo, children, nota, classe = '' }) {
  return (
    <section className={`border rounded-lg p-4 bg-card space-y-2 ${classe}`}>
      <h3 className="font-heading font-semibold">{titolo}</h3>
      {children}
      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
    </section>
  );
}

// fra piu' commesse dello stesso anno vale la modificata per ultima, come nelle funzioni
const piuRecente = (righe) => (righe || []).reduce((x, r) => (!x || String(r.updated_date || r.created_date || '') > String(x.updated_date || x.created_date || '') ? r : x), null);

export default function CommessaEcotyreForm({ anno, isAdmin, user, onModificato }) {
  const { toast } = useToast();
  const inputFile = useRef(null);
  const [record, setRecord] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [dati, setDati] = useState(statoDaRecord(null));
  const [modificato, setModificato] = useState(false);
  const [nota, setNota] = useState('');
  const [variazioneAperta, setVariazioneAperta] = useState(false);
  // Il contratto salvato in un'altra scheda mentre qui c'erano modifiche (14/10/2026).
  const [cambiatoAltrove, setCambiatoAltrove] = useState('');

  // Le letture si numerano: una superata da un'altra non tocca niente. Senza,
  // cambiando anno in fretta poteva restare a video la commessa di un altro anno,
  // e salvarla l'avrebbe spostata sull'anno mostrato.
  const ultimaLettura = useRef(0);
  const carica = useCallback(async () => {
    const n = ++ultimaLettura.current;
    setCaricando(true);
    try {
      const r = piuRecente(await base44.entities.CommessaEcotyre.filter({ anno }));
      if (n !== ultimaLettura.current) return;
      if (r && Number(r.anno) !== Number(anno)) throw new Error(`la commessa letta non è del ${anno}`);
      setRecord(r);
      setDati(statoDaRecord(r));
      setModificato(false);
      setNota('');
      setCambiatoAltrove('');
    } catch (e) {
      if (n !== ultimaLettura.current) return;
      toast({ title: 'Caricamento non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
    setCaricando(false);
  }, [anno, toast]);

  // La prima lettura in volo: una rilettura la aspetta, perche' potrebbe essere
  // partita prima del cambio e arrivare dopo.
  const primaLettura = useRef(null);
  useEffect(() => { primaLettura.current = carica(); }, [carica]);

  // Il contratto cambiato in un'altra scheda (vedi in testa): una lettura sola,
  // del contratto dell'anno; il consuntivo non si rilegge, non e' cambiato.
  const origine = useOrigine('commessa');
  // Quello che c'e' a video adesso, anche se la lettura e' partita qualche disegno fa.
  const modificatoOra = useRef(false);
  modificatoOra.current = modificato;
  const datiOra = useRef(dati);
  datiOra.current = dati;
  const recordOra = useRef(record);
  recordOra.current = record;
  useTargetCambiati(
    (m) => (m.anno === Number(anno) && m.origine !== origine && m.parti.includes('contratto') ? [`contratto|${m.anno}`] : []),
    async (cosa) => {
      if (!cosa.includes(`contratto|${Number(anno)}`)) return;
      if (primaLettura.current) await primaLettura.current.catch(() => {});
      const n = ++ultimaLettura.current;
      try {
        const r = piuRecente(await base44.entities.CommessaEcotyre.filter({ anno }));
        if (n !== ultimaLettura.current) return;
        // questa lettura ha superato quelle in volo: tocca a lei chiudere l'attesa
        setCaricando(false);
        if (r && Number(r.anno) !== Number(anno)) return;
        if (modificatoOra.current) {
          // le modifiche a video restano; le parti non toccate prendono i numeri salvati
          const allineati = r ? riallineaAlContratto({ base: recordOra.current, fresca: r, dati: datiOra.current, anno }) : null;
          setRecord(r);
          if (allineati) setDati(allineati.dati);
          if (allineati && (allineati.aggiornati.length || allineati.conflitti.length)) {
            setCambiatoAltrove(avvisoRiallineo({ anno, dove: 'in un\'altra scheda', aggiornati: allineati.aggiornati, conflitti: allineati.conflitti }));
          }
        } else {
          setRecord(r);
          setDati(statoDaRecord(r));
          setCambiatoAltrove('');
        }
      } catch (e) {
        if (n !== ultimaLettura.current) return;
        setCaricando(false);
        setCambiatoAltrove(`Il contratto del ${anno} è cambiato in un'altra scheda, ma non si è riletto (${e.message || String(e)}): ricarica la pagina prima di salvare.`);
      }
    },
  );

  // La pagina sa se ci sono modifiche non salvate, per chiedere prima di cambiare anno o scheda.
  useEffect(() => { if (onModificato) onModificato(isAdmin && modificato); }, [onModificato, isAdmin, modificato]);
  useEffect(() => () => { if (onModificato) onModificato(false); }, [onModificato]);

  // Chi chiude o ricarica la pagina con modifiche non salvate riceve un avviso.
  useEffect(() => {
    if (!modificato) return undefined;
    const avvisa = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avvisa);
    return () => window.removeEventListener('beforeunload', avvisa);
  }, [modificato]);

  // Consuntivo mese per mese, letto dai formulari terminati per data di fine
  // trasporto. RETE e ACI restano separati: il target del contratto riguarda la
  // RETE, l'ACI si confronta solo con il suo budget.
  // Con il consuntivo arrivano le date obbligatorie da sistemare di ciascun
  // canale (regola dell'utente del 22/09/2026): chi non ha la fine trasporto non
  // e' nel consuntivo, e sotto la tabella si dice, una riga per canale.
  const [consuntivo, setConsuntivo] = useState({ rete: null, aci: null, date_rete: null, date_aci: null });
  useEffect(() => {
    let attivo = true;
    const dati = (res) => res && (res.data || res);
    const perMese = (res) => {
      const d = dati(res);
      if (!d || !Array.isArray(d.by_regione)) return null;
      return MESI.map(m => d.by_regione.reduce((s, r) => s + ((r.mesi && r.mesi[m]) || 0), 0));
    };
    setConsuntivo({ rete: null, aci: null, date_rete: null, date_aci: null });
    Promise.all([
      base44.functions.invoke('computeRaccolto', { filters: { anno: [anno], canale: 'rete' } }).catch(() => null),
      base44.functions.invoke('computeRaccolto', { filters: { anno: [anno], canale: 'aci' } }).catch(() => null),
    ]).then(([rete, aci]) => {
      if (attivo) setConsuntivo({ rete: perMese(rete), aci: perMese(aci), date_rete: dati(rete)?.date_da_sistemare || null, date_aci: dati(aci)?.date_da_sistemare || null });
    });
    return () => { attivo = false; };
  }, [anno]);
  const oggi = new Date();
  // Indice dell'ultimo mese con consuntivo: -1 per un anno futuro, 11 per uno passato.
  const ultimoMese = anno < oggi.getFullYear() ? 11 : anno > oggi.getFullYear() ? -1 : oggi.getMonth();
  const valoreConsuntivo = (canale, i) => (consuntivo[canale] && i <= ultimoMese ? consuntivo[canale][i] : null);
  const scarto = (fatto, atteso) => {
    const a = numero(atteso);
    if (fatto === null || fatto === undefined || a === null || !Number.isFinite(a)) return <span className="text-muted-foreground">—</span>;
    const d = fatto - a;
    return <span className={d < 0 ? 'text-red-600' : 'text-emerald-700'}>{d > 0 ? '+' : ''}{tonnellate(d)}</span>;
  };
  const cellaConsuntivo = (v, i) => (
    <td className={`py-0.5 px-2 text-right tabular-nums ${i === ultimoMese && anno === oggi.getFullYear() ? 'italic' : ''}`}>
      {v === null ? <span className="text-muted-foreground">—</span> : tonnellate(v)}
    </td>
  );
  const totaleConsuntivo = (canale) => (consuntivo[canale] ? consuntivo[canale].slice(0, ultimoMese + 1).reduce((s, v) => s + v, 0) : null);
  const totaleAtteso = (chiave) => dati[chiave].slice(0, ultimoMese + 1).reduce((s, v) => s + (numero(v) || 0), 0);

  const imposta = (chiave, valore) => { setDati(prev => ({ ...prev, [chiave]: valore })); setModificato(true); };

  const importa = async (file) => {
    setImportando(true);
    try {
      const contratto = await leggiFileTargetContratto(file);
      setDati(statoDaContratto(contratto));
      setModificato(true);
      setNota(`importato da ${file.name}`);
      // Il foglio puo' non conoscere le variazioni registrate nel gestionale
      // (14/10/2026): se riscrive la regione o il mese di una variazione, si
      // dice quale esce dai numeri salvandolo.
      const chiuse = avvisoVariazioniChiuse(variazioniCheSiChiudono(record, valoriDa(statoDaContratto(contratto), anno)));
      toast({ title: 'Dati del contratto letti dal file', description: `Controlla i valori e premi "Salva commessa ${anno}". ${contratto.avvisi.join(' ')}${chiuse ? ` Attenzione: ${chiuse}` : ''}` });
    } catch (e) {
      toast({ title: 'Lettura non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
    setImportando(false);
  };

  // Scrive i numeri sul contratto riletto (fresca), o ne crea uno se l'anno non
  // l'ha: quelli a video o, se nel frattempo il contratto e' cambiato altrove,
  // la loro unione con quello salvato. Storico e «prima» vengono da fresca.
  const scriviContratto = async (dati, fresca) => {
    const valori = valoriDa(dati, anno);
    if (!fresca) return scriviConTraccia('CommessaEcotyre', null, { ...valori, storico_json: conModifica('[]', { utente: nomeUtente(user), nota, prima: null }) }, { origine: ORIGINE, motivo: nota });
    const prima = Object.fromEntries(Object.keys(valori).filter(k => k !== 'anno').map(k => [k, fresca[k] ?? null]));
    return scriviConTraccia('CommessaEcotyre', fresca.id, { ...valori, storico_json: conModifica(fresca.storico_json, { utente: nomeUtente(user), nota, prima }) }, { origine: ORIGINE, motivo: nota });
  };

  const salva = async () => {
    const tuttiNumeri =[dati.target_annuo_t, ...dati.regioni.map(r => r.target), ...dati.classi.map(c => c.percentuale), ...dati.mensile_iniziale, ...dati.mensile, ...dati.rete, ...dati.aci,
      ...dati.destinazioni.map(d => d.target), ...dati.prezzo_regioni.flatMap(p => [p.target, p.prezzo])];
    if (tuttiNumeri.some(v => Number.isNaN(leggiNumero(v)) || (leggiNumero(v) ?? 0) < 0)) {
      toast({ title: 'Valori non validi', description: 'Nei campi numerici scrivi solo numeri, per esempio 11550 o 851,29.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    let esito = null;
    try {
      if (record && Number(record.anno) !== Number(anno)) throw new Error(`a video c'è la commessa del ${record.anno}, non del ${anno}: ricarica la pagina`);
      // Il contratto com'e' adesso, non quello letto all'apertura (vedi in testa).
      const fresca = piuRecente(await base44.entities.CommessaEcotyre.filter({ anno }));
      if (fresca && Number(fresca.anno) !== Number(anno)) throw new Error(`la commessa letta non è del ${anno}: ricarica la pagina`);
      if (record && !fresca) throw new Error(`il contratto del ${anno} non si trova più: ricarica la pagina`);
      let daScrivere = dati;
      let presiDalSalvato = [];
      if (fresca) {
        const allineati = riallineaAlContratto({ base: record, fresca, dati, anno });
        if (allineati.conflitti.length) {
          // Cambiato qui e li': non si scrive, si mostra e si chiede di confermare.
          setRecord(fresca);
          setDati(allineati.dati);
          setCambiatoAltrove(avvisoRiallineo({ anno, dove: 'altrove (in un\'altra scheda o su un altro computer)', aggiornati: allineati.aggiornati, conflitti: allineati.conflitti, fermato: true }));
          setSalvando(false);
          return;
        }
        daScrivere = allineati.dati;
        presiDalSalvato = allineati.aggiornati;
      }
      esito = await scriviContratto(daScrivere, fresca);
      // Il contratto e' scritto: le pagine aperte (dashboard, Andamento, le altre schede) lo rileggono.
      annunciaTarget({ anno, parti: ['contratto'], origine });
      const avviso = avvisoTraccia(esito);
      const unione = presiDalSalvato.length
        ? `Nel frattempo il contratto era stato salvato altrove: per ${elenco(presiDalSalvato)} vale quello salvato, che non avevi toccato; le tue modifiche sono scritte.`
        : '';
      toast(avviso
        ? { ...avviso, title: `Commessa ${anno} salvata, ma fuori dallo storico`, description: [avviso.description, unione].filter(Boolean).join(' ') }
        : { title: `Commessa ${anno} salvata`, ...(unione ? { description: unione } : {}) });
      await carica();
    } catch (e) {
      toast({ title: 'Salvataggio non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
    setSalvando(false);
  };

  if (caricando) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Caricamento…</div>;

  const annuo = numero(dati.target_annuo_t) || 0;
  const confronto = (valore) => (annuo ? (Math.abs(valore - annuo) < 0.5 ? <span className="text-emerald-700">coincide con il target annuo</span> : <span className="text-amber-700">{valore < annuo ? 'mancano' : 'eccedono'} {tonnellate(Math.abs(valore - annuo))} t rispetto al target annuo</span>) : null);
  const cambiaMese = (chiave, i, v) => imposta(chiave, dati[chiave].map((x, j) => (j === i ? v : x)));
  const sommaClassi = somma(dati.classi.map(c => c.percentuale));
  const variazioni = variazioniDelContratto(record);
  // Le variazioni che il salvataggio di quello che c'e' a video toglierebbe dai numeri.
  const escono = isAdmin && modificato && record ? avvisoVariazioniChiuse(variazioniCheSiChiudono(record, valoriDa(dati, anno))) : '';

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-3xl">
          Quanto richiede il contratto Ecotyre per il {anno}. Si importa dal foglio del contratto del file di gestione o si scrive a mano, e si aggiorna se Ecotyre
          lo rivede: ogni salvataggio resta nello storico. L'Andamento confronta il raccolto per regione con questi valori. La fine della programmazione e i
          chili per viaggio dell'anno, che stanno anch'essi sulla commessa, si scrivono nella scheda Impianti e stoccaggi.
        </p>
        {isAdmin && (
          <>
            <input ref={inputFile} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) importa(f); }} />
            <Button size="sm" variant="outline" onClick={() => inputFile.current && inputFile.current.click()} disabled={importando}>
              {importando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1" />}Importa dal foglio del contratto
            </Button>
          </>
        )}
      </div>

      {!record && !modificato && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">La commessa {anno} non è ancora stata inserita.</p>}
      {cambiatoAltrove && <p role="status" className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">{cambiatoAltrove}</p>}
      {isAdmin && modificato && (
        <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
          <span>
            I dati non sono ancora salvati: se esci, ricarichi la pagina o cambi anno o scheda senza salvare, si perdono.
            {escono && <strong className="block font-medium mt-0.5">{escono}</strong>}
          </span>
          <Button size="sm" onClick={salva} disabled={salvando}>{salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salva ora</Button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <Riquadro titolo="Target annuo e per regione" nota={<>Somma regioni {tonnellate(somma(dati.regioni.map(r => r.target)))} t: {confronto(somma(dati.regioni.map(r => r.target)))}</>}>
          <div className="flex items-center gap-2 max-w-[240px]">
            <Input value={dati.target_annuo_t} onChange={e => imposta('target_annuo_t', e.target.value)} disabled={!isAdmin} inputMode="decimal" className="h-9 text-right text-base font-semibold tabular-nums" placeholder="0" />
            <span className="text-sm text-muted-foreground">t annue</span>
          </div>
          <Tabella isAdmin={isAdmin} righe={dati.regioni} onChange={v => imposta('regioni', v)} nuovaRiga={{ regione: '', province: '', target: '' }}
            colonne={[{ chiave: 'regione', etichetta: 'Regione' }, { chiave: 'province', etichetta: 'Province' }, { chiave: 'target', etichetta: 't', numero: true, classe: 'w-28' }]} />
        </Riquadro>

        {/* Le variazioni del consorzio in corso d'anno (14/10/2026): si
            registrano qui, una per volta e col motivo, e non si riscrivono le
            tabelle a mano. Si scrivono sul contratto salvato: con modifiche a
            video non ancora salvate il pulsante aspetta. */}
        <Riquadro titolo={`Variazioni del contratto ${anno}`}>
          <p className="text-xs text-muted-foreground">
            Le tonnellate in più o in meno che il consorzio decide in corso d&apos;anno, per esempio un&apos;assegnazione in più per un mese in una regione.
            Ognuna cambia il target annuo, quello della regione e il target mensile rivisto del mese, e resta qui col suo motivo.
          </p>
          <ElencoVariazioni variazioni={variazioni} anno={anno} targetAnnuo={record ? record.target_annuo_t : null} />
          {isAdmin && record && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button size="sm" variant="outline" onClick={() => setVariazioneAperta(true)} disabled={modificato}>Registra una variazione</Button>
              {modificato && <span className="text-xs text-amber-700">Salva prima le modifiche a video: la variazione si scrive sul contratto salvato.</span>}
            </div>
          )}
        </Riquadro>

        <Riquadro
          classe="lg:col-span-2"
          titolo="Target, budget e consuntivo mensili"
          nota={<>
            Target rivisto {tonnellate(somma(dati.mensile))} t{confronto(somma(dati.mensile)) ? <>: {confronto(somma(dati.mensile))}</> : ''}. Budget RETE {tonnellate(somma(dati.rete))} t; budget ACI {tonnellate(somma(dati.aci))} t, canale separato.
            {' '}Il consuntivo è il raccolto dei formulari terminati, per data di fine trasporto; il mese in corso, in corsivo, è parziale. Lo scarto è consuntivo meno atteso, in rosso quando manca raccolta. Nei totali consuntivo e scarti arrivano fino al mese in corso.
          </>}
        >
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="text-muted-foreground">
                  <th />
                  <th colSpan={6} className="text-center py-1 px-1 border-b">Canale RETE</th>
                  <th colSpan={3} className="text-center py-1 px-1 border-b border-l">Canale ACI</th>
                </tr>
                <tr className="text-muted-foreground">
                  <th className="text-left py-1 pr-2" />
                  <th className="text-right py-1 px-1">Target iniziale</th>
                  <th className="text-right py-1 px-1">Target rivisto</th>
                  <th className="text-right py-1 px-1">Budget</th>
                  <th className="text-right py-1 px-2">Consuntivo</th>
                  <th className="text-right py-1 px-2">Scarto sul rivisto</th>
                  <th className="text-right py-1 px-2">Scarto sul budget</th>
                  <th className="text-right py-1 px-1 border-l">Budget</th>
                  <th className="text-right py-1 px-2">Consuntivo</th>
                  <th className="text-right py-1 px-2">Scarto sul budget</th>
                </tr>
              </thead>
              <tbody>
                {MESI.map((m, i) => {
                  const rete = valoreConsuntivo('rete', i);
                  const aci = valoreConsuntivo('aci', i);
                  const campo = (k) => (
                    <td key={k} className={`py-0.5 px-1 ${k === 'aci' ? 'border-l' : ''}`}>
                      <Input value={dati[k][i]} onChange={e => cambiaMese(k, i, e.target.value)} disabled={!isAdmin} inputMode="decimal" className="h-8 text-right tabular-nums min-w-[80px]" />
                    </td>
                  );
                  return (
                    <tr key={m}>
                      <td className="py-0.5 pr-2 font-medium">{m}</td>
                      {campo('mensile_iniziale')}
                      {campo('mensile')}
                      {campo('rete')}
                      {cellaConsuntivo(rete, i)}
                      <td className="py-0.5 px-2 text-right tabular-nums">{scarto(rete, dati.mensile[i])}</td>
                      <td className="py-0.5 px-2 text-right tabular-nums">{scarto(rete, dati.rete[i])}</td>
                      {campo('aci')}
                      {cellaConsuntivo(aci, i)}
                      <td className="py-0.5 px-2 text-right tabular-nums">{scarto(aci, dati.aci[i])}</td>
                    </tr>
                  );
                })}
                <tr className="border-t font-semibold">
                  <td className="py-1 pr-2">Totale</td>
                  <td className="py-1 px-1 text-right tabular-nums">{tonnellate(somma(dati.mensile_iniziale))}</td>
                  <td className="py-1 px-1 text-right tabular-nums">{tonnellate(somma(dati.mensile))}</td>
                  <td className="py-1 px-1 text-right tabular-nums">{tonnellate(somma(dati.rete))}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{totaleConsuntivo('rete') === null ? '—' : tonnellate(totaleConsuntivo('rete'))}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{ultimoMese >= 0 ? scarto(totaleConsuntivo('rete'), totaleAtteso('mensile')) : '—'}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{ultimoMese >= 0 ? scarto(totaleConsuntivo('rete'), totaleAtteso('rete')) : '—'}</td>
                  <td className="py-1 px-1 text-right tabular-nums border-l">{tonnellate(somma(dati.aci))}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{totaleConsuntivo('aci') === null ? '—' : tonnellate(totaleConsuntivo('aci'))}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{ultimoMese >= 0 ? scarto(totaleConsuntivo('aci'), totaleAtteso('aci')) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <RiepilogoDate canale="Rete" riepilogo={consuntivo.date_rete} esempi />
          <RiepilogoDate canale="ACI" riepilogo={consuntivo.date_aci} esempi />
        </Riquadro>

        <Riquadro titolo="Ripartizione per classe" nota={dati.classi.length ? <>Somma {percentuale(sommaClassi, 2)}%{Math.abs(sommaClassi - 100) > 0.01 ? <span className="text-amber-700"> (dovrebbe fare 100%)</span> : ''}</> : null}>
          <Tabella isAdmin={isAdmin} righe={dati.classi} onChange={v => imposta('classi', v)} nuovaRiga={{ classe: '', descrizione: '', peso: '', percentuale: '' }}
            colonne={[{ chiave: 'classe', etichetta: 'Classe', classe: 'w-16' }, { chiave: 'descrizione', etichetta: 'Veicoli' }, { chiave: 'peso', etichetta: 'Peso', classe: 'w-24' }, { chiave: 'percentuale', etichetta: '%', numero: true, classe: 'w-20' }]} />
        </Riquadro>

        <Riquadro titolo="Quantità per destinazione" nota={dati.destinazioni.length ? <>Totale {tonnellate(somma(dati.destinazioni.map(d => d.target)))} t: {confronto(somma(dati.destinazioni.map(d => d.target)))}</> : null}>
          <Tabella isAdmin={isAdmin} righe={dati.destinazioni} onChange={v => imposta('destinazioni', v)} nuovaRiga={{ destinazione: '', target: '', trattamento: '' }}
            colonne={[{ chiave: 'destinazione', etichetta: 'Destinazione' }, { chiave: 'target', etichetta: 't', numero: true, classe: 'w-28' }, { chiave: 'trattamento', etichetta: 'Trattamento' }]} />
        </Riquadro>

        <Riquadro titolo="Previsione ACI per regione (contratto ACI Ecotyre)" nota={<>{dati.prezzo_regioni.length ? <>Totale {tonnellate(somma(dati.prezzo_regioni.map(p => p.target)))} t, indicativo: il canale ACI è indipendente e non entra nel target RETE. </> : null}Il prezzo è il corrispettivo per tonnellata della regione.</>}>
          <Tabella isAdmin={isAdmin} righe={dati.prezzo_regioni} onChange={v => imposta('prezzo_regioni', v)} nuovaRiga={{ regione: '', target: '', prezzo: '' }}
            colonne={[{ chiave: 'regione', etichetta: 'Regione' }, { chiave: 'target', etichetta: 't', numero: true, classe: 'w-28' }, { chiave: 'prezzo', etichetta: '€/t', numero: true, classe: 'w-24' }]} />
        </Riquadro>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 flex-wrap sticky bottom-0 bg-background/95 py-3 border-t">
          <Input value={nota} onChange={e => setNota(e.target.value)} placeholder="Motivo della modifica, per esempio revisione Ecotyre di giugno (facoltativo)" className="h-9 max-w-md" />
          <Button onClick={salva} disabled={salvando || (!modificato && !!record)}>{salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salva commessa {anno}</Button>
          {modificato && <span className="text-xs text-amber-700">Modifiche non ancora salvate</span>}
        </div>
      )}

      {record && <StoricoModifiche entita="CommessaEcotyre" recordId={record.id} aggiornato={record.updated_date || ''} aperto />}

      {record && leggiStorico(record.storico_json).length > 0 && (
        <section className="text-xs text-muted-foreground space-y-1">
          <div className="font-medium flex items-center gap-1"><History className="w-3.5 h-3.5" />Modifiche</div>
          {[...leggiStorico(record.storico_json)].reverse().map((v, i) => (
            <div key={i}>{dataOra(v.il)}{v.da ? ` · ${v.da}` : ''}: {v.variazione
              ? `variazione di ${String(MESI[v.variazione.mese_idx] || '').toLowerCase()}, ${v.variazione.regione} ${Number(v.variazione.t) > 0 ? '+' : ''}${tonnellate(v.variazione.t)} t (target annuo prima ${tonnellate(v.prima && v.prima.target_annuo_t)} t)`
              : v.prima ? `target annuo prima ${tonnellate(v.prima.target_annuo_t)} t` : 'primo inserimento'}{v.nota ? ` — ${v.nota}` : ''}</div>
          ))}
        </section>
      )}

      {isAdmin && record && (
        <VariazioneContratto anno={anno} commessa={record} user={user} aperta={variazioneAperta} onChiudi={() => setVariazioneAperta(false)} onSalvata={carica} origine={origine} />
      )}
    </div>
  );
}
