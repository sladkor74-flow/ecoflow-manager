import React, { useState, useEffect, useCallback, useRef } from 'react';
import { meseDiLavoro, MESI_PAGINE } from '@/lib/periodoPagine';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Download, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Snowflake } from 'lucide-react';
import Storia from '@/components/shared/Storia';
import { formatKg, formatTonnellate } from '@/lib/utils';
import { euro } from '@/lib/formatoSoldi';
import { giornoRoma } from '@/lib/giornoItaliano';
import { tabelleDalFile, scaricaExcelConsuntivo } from '@/lib/consuntivoFornitoreFile';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import AvvisoCaricamenti from '@/components/shared/AvvisoCaricamenti';
import { TIPI_PASSIVA } from '@/lib/registroCaricamenti';

// IL MOTIVO DEL SERVER, NON IL CODICE DI STATO (chiusura dell'audit,
// 11/10/2026). Il client delle funzioni lancia un errore per ogni risposta non
// 2xx, e il suo message e' «Request failed with status code 409»: il congelamento
// rinviato perche' le primarie si stanno riscrivendo arrivava a video cosi', in
// inglese e senza dire quale caricamento ripetere. Il motivo sta nel corpo della
// risposta, come in PrefatturaEcotyre.jsx.
const motivoErrore = (e) => e?.response?.data?.error || e?.data?.error || (e && e.message ? e.message : String(e));

// Il giorno italiano di un istante, gg/mm/aaaa: il congelamento delle 00:30 del
// 6 febbraio e' del 06/02, non del 05/02 come diceva il taglio della data UTC.
const giornoIt = (v) => { const g = giornoRoma(v); return g ? g.split('-').reverse().join('/') : ''; };

// UNA VOCE DELLE TARIFFE CHE MANCANO NEL CONTO DA CONGELARE (prova del cambio
// d'anno, 15/10/2026): «GATIM S.R.L., raccolta: 6,00 t».
const voceTariffa = (g) => `${g.fornitore}, ${g.prestazione_parole || String(g.prestazione || '').toLowerCase()}${g.tratta ? ` (${g.tratta})` : ''}: ${formatTonnellate(g.tonnellate)} t`;

/**
 * Perche' il conto congelato e quello di oggi non dicono lo stesso numero.
 * Prima era sempre «di solito sono ordini chiusi dopo la chiusura del mese»;
 * gennaio 2027, congelato il 05/02 senza le tariffe nuove e ricalcolato il 10/02
 * dopo aver scritto la tariffa di GATIM, faceva 0 € allora e 432 oggi, e la
 * frase era falsa (prova del cambio d'anno, 15/10/2026). Quando nel congelato
 * mancava una tariffa che oggi c'e', si dice quello e il rimedio: rifare il
 * congelamento. Gli ordini chiusi dopo restano la frase di sempre.
 */
export function fraseCongelato(congelato, sospeso) {
  if (!congelato) return ' Non si è mosso.';
  // Anche una tariffa copiata dall'anno prima e non confermata allora, e
  // confermata oggi (D4, decisione dell'utente del 15/10/2026; revisione dello
  // stesso giorno): il conto si e' mosso per quella, non per ordini chiusi dopo.
  // Confermata allo stesso prezzo il conto non si muove, ma va rifatto lo stesso:
  // il congelato porta una tariffa che allora non valeva, e il testo del
  // confronto lo dice (elaboraConsuntivo); la pagina non puo' dire solo «Non si
  // e' mosso».
  if (congelato.mancava_la_tariffa || congelato.era_da_confermare) {
    const chi = sospeso && sospeso.fornitore ? ` di ${sospeso.fornitore}` : '';
    const t = Number(congelato.senza_tariffa_allora_t) || 0;
    const tc = Number(congelato.da_confermare_allora_t) || 0;
    const daAnno = Number(congelato.anno_copia) > 0 ? `dal ${congelato.anno_copia}` : "dall'anno prima";
    const allora = [
      congelato.mancava_la_tariffa ? `mancava la tariffa${chi} (${formatTonnellate(t)} t senza prezzo)` : '',
      congelato.era_da_confermare ? `la tariffa${congelato.mancava_la_tariffa ? '' : chi} era copiata ${daAnno} e non confermata (${formatTonnellate(tc)} t)` : '',
    ].filter(Boolean).join(' e ');
    return ` ${congelato.cambiato ? 'Si è mosso perché' : 'Non si è mosso, ma'} nel conto congelato il ${giornoIt(congelato.congelato_il)} ${allora}, che oggi ${congelato.mancava_la_tariffa ? "c'è" : 'è confermata'}: rifai il congelamento, poi il confronto.`;
  }
  if (!congelato.cambiato) return ' Non si è mosso.';
  return ' Si è mosso: prima di pagare va capito perché — di solito sono ordini chiusi dopo la chiusura del mese.';
}

/**
 * L'ESITO PER IL FILE DELLA VERIFICA (revisione del 15/10/2026). Il file Excel
 * (scaricaExcelConsuntivo, in src/lib/consuntivoFornitoreFile.js) scrive il
 * previsto dal costo della passiva: con l'importo in sospeso, cioe' con una
 * nostra tariffa che manca o e' copiata e non confermata, scriveva «0,00 €»
 * mentre la pagina dice «—». Un valore mancante non e' zero: al file si passa il
 * costo come non utilizzabile, col perche' al posto del numero. Il resto
 * dell'esito resta com'e'.
 */
export function esitoPerIlFile(esito) {
  const sospeso = esito && esito.esito && esito.esito.importo_sospeso;
  if (!sospeso || !esito.costo) return esito;
  const perche = String(sospeso.voce || '').replace(/^l'importo, perché /, '');
  return { ...esito, costo: { ...esito.costo, trovato: false, motivo: `— ${perche}` } };
}

/**
 * La domanda prima di congelare un conto con tariffe mancanti: l'elenco che la
 * funzione manda col 409 (congelaPassivaMese), una riga per fornitore e
 * prestazione. Il 05/02/2027 gennaio si congelava senza le tariffe 2027 a 0,00 €
 * senza una domanda, e i consuntivi arrivati dopo si confrontavano con quello zero.
 */
export function domandaTariffeMancanti(dati, periodo) {
  const righe = [];
  const mancanti = (dati && dati.tariffe_mancanti) || [];
  const daConfermare = (dati && dati.tariffe_da_confermare) || [];
  righe.push(`Nel conto della passiva di ${periodo} ci sono tonnellate senza un prezzo valido.`);
  if (mancanti.length) righe.push('', 'Manca la tariffa del mese per:', ...mancanti.map(g => `- ${voceTariffa(g)}`));
  if (daConfermare.length) righe.push('', "Hanno una tariffa copiata dall'anno prima e non ancora confermata:", ...daConfermare.map(g => `- ${voceTariffa(g)}`));
  righe.push('', "Congelato così, quelle righe restano senza il loro prezzo e i consuntivi di quei fornitori non si potranno controllare: meglio scrivere prima le tariffe e poi congelare.",
    '', 'Lo congelo lo stesso?');
  return righe.join('\n');
}

// I CONSUNTIVI DI CHIUSURA MESE DEI FORNITORI (richiesta dell'utente, 29/09/2026).
//
// Si carica il report definitivo con cui un fornitore chiude il mese, si verifica
// riga per riga contro i nostri movimenti, e accanto si mette l'importo che la
// fatturazione passiva gli riconosce. E' un report SUO, non una fattura: niente
// IVA, niente imponibile.
//
// Il file non si conserva: si legge nel browser e al server arrivano solo le celle.
//
// Tre ruoli, tre basi diverse, perche' tre sono le prestazioni che un fornitore ci
// fattura. Lo stesso soggetto che raccoglie e ha il piazzale manda due consuntivi.

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const CANALI = [['RETE', 'Rete'], ['ACI', 'ACI'], ['EXTRA_RACCOLTA', 'Extra raccolta']];
const RUOLI = [
  ['raccoglitore', 'Raccoglitore', 'le primarie che ha raccolto'],
  ['impianto', 'Impianto o stoccaggio', 'tutto quello che gli è arrivato, primarie e secondarie'],
  ['trasportatore', 'Trasportatore di secondarie', 'le secondarie che ha portato'],
];

export default function Consuntivi({ isAdmin, periodoIniziale = null, canaleIniziale = null }) {
  const oggi = new Date();
  // Il mese finito per ultimo, sul calendario italiano: a gennaio e' il dicembre
  // dell'anno prima, non il dicembre dell'anno nuovo (chiusura dell'audit, 11/10/2026).
  // Il mese e il canale del collegamento, se la pagina e' stata aperta da li'.
  const [anno, setAnno] = useState(() => (periodoIniziale || meseDiLavoro()).anno);
  const [mese, setMese] = useState(() => MESI_PAGINE.indexOf((periodoIniziale || meseDiLavoro()).mese) + 1);
  const [canale, setCanale] = useState(canaleIniziale || 'RETE');
  const [fornitore, setFornitore] = useState('');
  const [ruolo, setRuolo] = useState('raccoglitore');
  const [importo, setImporto] = useState('');
  const [elenco, setElenco] = useState([]);
  const [aperto, setAperto] = useState(null);
  const [esito, setEsito] = useState(null);
  const [occupato, setOccupato] = useState('');
  const [errore, setErrore] = useState('');
  const fileRef = useRef(null);

  const carica = useCallback(async () => {
    setErrore('');
    try {
      const r = await base44.entities.ConsuntivoFornitore.filter({ anno, mese, canale }, 'fornitore', 200);
      setElenco(r || []);
    } catch (e) { setErrore(motivoErrore(e)); }
  }, [anno, mese, canale]);

  useEffect(() => { setAperto(null); setEsito(null); carica(); }, [carica]);

  const chiama = async (corpo, etichetta) => {
    setOccupato(etichetta);
    setErrore('');
    try {
      const r = await base44.functions.invoke('elaboraConsuntivo', corpo);
      const d = (r && r.data) || r;
      if (!d || d.error) throw new Error((d && d.error) || 'Il confronto non è arrivato.');
      setEsito(d);
      setAperto(d.consuntivo || null);
      await carica();
      return d;
    } catch (e) {
      // Il messaggio del server, quando c'e' (per esempio il consuntivo gia'
      // caricato da qualcun altro nel frattempo), invece del codice di stato.
      const dati = e && e.response && e.response.data;
      setErrore((dati && dati.error) || (e && e.message ? e.message : String(e)));
      if (dati && dati.da_confermare) await carica();
      return null;
    } finally { setOccupato(''); }
  };

  // UN CONSUNTIVO SOLO PER FORNITORE, RUOLO, MESE E CANALE (chiusura
  // dell'audit, 11/10/2026). Ricaricare il file di un fornitore gia' caricato ne
  // creava un secondo, e l'elenco mostrava due esiti per la stessa cosa. Ora il
  // nuovo sostituisce il vecchio, dopo una conferma: il nome si confronta
  // normalizzato, come fa il conto («Gatim» e «GATIM S.R.L.» sono lo stesso).
  const giaCaricato = (nome, r) => elenco.find(x => x && x.ruolo === r
    && normalizzaRagioneSociale(x.fornitore || '') === normalizzaRagioneSociale(nome || ''));

  const scegliFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    if (!fornitore.trim()) { setErrore('Scrivi prima di chi è il consuntivo.'); return; }
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) { setErrore('Il consuntivo si carica in Excel o CSV.'); return; }
    const prima = giaCaricato(fornitore.trim(), ruolo);
    if (prima) {
      const quando = prima.caricato_il ? new Date(prima.caricato_il).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
      const testoPrima = `${prima.fornitore}${quando ? `, caricato il ${quando}` : ''}${prima.file_nome ? ` dal file «${prima.file_nome}»` : ''}`;
      if (!window.confirm(`C'è già il consuntivo di ${testoPrima} per ${MESI[mese - 1]} ${anno}. Lo sostituisco con «${file.name}»? Quello di prima resta scritto nelle note.`)) return;
    }
    setOccupato('carica');
    try {
      const { tabelle, note } = await tabelleDalFile(file);
      await chiama({
        azione: 'carica', fornitore: fornitore.trim(), ruolo, anno, mese, canale,
        file_nome: file.name, tabelle, note_file: note,
        // la conferma chiesta qui sopra: senza, il server non sostituisce niente
        sostituisci: !!prima,
        importo_consuntivo: importo.trim() === '' ? null : Number(String(importo).replace(',', '.')),
      }, 'carica');
    } catch (e) {
      setErrore(motivoErrore(e));
      setOccupato('');
    }
  };

  const apri = async (c) => { setAperto(c); await chiama({ azione: 'confronta', id: c.id }, 'confronta'); };
  const elimina = async (c) => {
    if (!window.confirm(`Elimino il consuntivo di ${c.fornitore} per ${MESI[c.mese - 1]} ${c.anno}? Le righe lette si perdono e il file va ricaricato.`)) return;
    await chiama({ azione: 'elimina', id: c.id }, 'elimina');
    setAperto(null); setEsito(null);
    await carica();
  };

  // IL CONGELAMENTO CHIEDE CONFERMA SE MANCANO DELLE TARIFFE, E POI DICE CHE COSA
  // HA FISSATO (prova del cambio d'anno, 15/10/2026). La funzione risponde 409
  // con l'elenco delle tariffe che mancano: si mostra e si chiede, e solo con la
  // conferma si congela lo stesso. Prima il riepilogo che la funzione manda -
  // quanto, quanti fornitori, quante anomalie - si buttava via, e chi aveva
  // congelato gennaio a 0,00 € non lo sapeva.
  const [congelamento, setCongelamento] = useState(null);
  useEffect(() => { setCongelamento(null); }, [anno, mese, canale]);
  const congela = async () => {
    const periodo = `${MESI[mese - 1]} ${anno} (${CANALI.find(x => x[0] === canale)?.[1] || canale})`;
    if (!window.confirm(`Congelo il conto della fatturazione passiva di ${periodo}? Serve a confrontare i consuntivi che arriveranno con il conto di oggi, non con quello ricalcolato allora.`)) return;
    setOccupato('congela');
    setErrore('');
    setCongelamento(null);
    try {
      const chiedi = (conferma) => base44.functions.invoke('congelaPassivaMese', { anno, mese, canale, nota: 'chiusura del mese', ...(conferma ? { conferma: true } : {}) });
      let r;
      try {
        r = await chiedi(false);
      } catch (e) {
        const dati = e?.response?.data || e?.data;
        if (!dati || !dati.da_confermare || !(Array.isArray(dati.tariffe_mancanti) || Array.isArray(dati.tariffe_da_confermare))) throw e;
        if (!window.confirm(domandaTariffeMancanti(dati, periodo))) return;
        r = await chiedi(true);
      }
      const d = (r && r.data) || r;
      if (!d || d.error) throw new Error((d && d.error) || 'Il congelamento non è riuscito.');
      setCongelamento({ ...(d.riepilogo || {}), congelato_il: d.congelato && d.congelato.congelato_il, periodo });
      if (aperto) await chiama({ azione: 'confronta', id: aperto.id }, 'confronta');
    } catch (e) { setErrore(motivoErrore(e)); }
    finally { setOccupato(''); }
  };

  const c = esito && esito.confronto;
  const v = esito && esito.esito;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium mb-1">Anno</label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={anno} onChange={e => setAnno(Number(e.target.value))}>
            {[oggi.getFullYear(), oggi.getFullYear() - 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Mese di competenza</label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={mese} onChange={e => setMese(Number(e.target.value))}>
            {MESI.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Canale</label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={canale} onChange={e => setCanale(e.target.value)}>
            {CANALI.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={congela} disabled={!!occupato}
            title="Fissa il conto della passiva di questo mese e canale: i consuntivi che arriveranno si confronteranno con questo, e non con il ricalcolo di allora">
            {occupato === 'congela' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Snowflake className="w-4 h-4 mr-1.5" />} Congela il conto della passiva
          </Button>
        )}
      </div>

      {/* Il confronto e il congelamento leggono primarie e secondarie: se una
          loro riscrittura e' in corso o non e' riuscita lo si dice qui, prima
          che il congelamento torni rinviato (11/10/2026). */}
      <AvvisoCaricamenti tipi={TIPI_PASSIVA} aggiorna={`${anno}|${mese}|${canale}|${occupato}`} />

      {isAdmin && (
        <div className="bg-card border rounded-lg p-3 space-y-2">
          <div className="text-sm font-semibold">Carica un consuntivo</div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium mb-1">Di chi è</label>
              <input value={fornitore} onChange={e => setFornitore(e.target.value)} placeholder="Ragione sociale, come la conosciamo"
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Con che cosa ci fattura</label>
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={ruolo} onChange={e => setRuolo(e.target.value)}>
                {RUOLI.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Importo sul consuntivo (facoltativo)</label>
              <input value={importo} onChange={e => setImporto(e.target.value)} placeholder="€" className="border rounded-md px-3 py-2 text-sm w-32" />
            </div>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={!!occupato}>
              {occupato === 'carica' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />} Scegli il file
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls,.csv" className="hidden" onChange={scegliFile} />
          </div>
          <p className="text-xs text-muted-foreground">
            {RUOLI.find(r => r[0] === ruolo)?.[2]}. Il file si legge qui nel browser e non viene conservato: al gestionale arrivano solo le righe.
            Lo stesso soggetto che raccoglie e ha il piazzale manda <strong>due</strong> consuntivi, uno per prestazione.
          </p>
        </div>
      )}

      {errore && (
        <div className="flex items-start gap-2 text-sm border border-destructive/30 bg-destructive/10 text-destructive rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{errore}</span>
        </div>
      )}

      {/* Che cosa ha fissato il congelamento: quanto, quanti fornitori, e le
          tariffe che mancavano se si e' congelato lo stesso (15/10/2026). */}
      {congelamento && (
        <div className={`text-sm border rounded-lg px-3 py-2 ${(congelamento.tariffe_mancanti || []).length || (congelamento.tariffe_da_confermare || []).length ? 'border-amber-300 bg-amber-50 text-amber-900' : 'bg-card'}`}>
          <p>
            <Snowflake className="w-4 h-4 inline mr-1.5 -mt-0.5" aria-hidden="true" />
            Conto della passiva di {congelamento.periodo} congelato{congelamento.congelato_il ? ` il ${giornoIt(congelamento.congelato_il)}` : ''}: {euro(congelamento.totale_euro)}
            {Number(congelamento.totale_surplus) > 0 ? `, di cui surplus ${euro(congelamento.totale_surplus)}` : ''} — {congelamento.raccoglitori ?? 0} raccoglitori, {congelamento.impianti_stoccaggi ?? 0} impianti e stoccaggi, {congelamento.trasporti_secondaria ?? 0} trasporti di secondaria; {congelamento.anomalie ?? 0} {congelamento.anomalie === 1 ? 'anomalia' : 'anomalie'}.
          </p>
          {(congelamento.tariffe_mancanti || []).length > 0 && (
            <p className="mt-1 text-xs">Congelato senza le tariffe del mese di {congelamento.tariffe_mancanti.map(voceTariffa).join('; ')}: quelle righe nel conto valgono zero. Scritte le tariffe, rifai il congelamento.</p>
          )}
          {(congelamento.tariffe_da_confermare || []).length > 0 && (
            <p className="mt-1 text-xs">Congelato con tariffe copiate dall&apos;anno prima e non confermate per {congelamento.tariffe_da_confermare.map(voceTariffa).join('; ')}: confermate le tariffe, rifai il congelamento.</p>
          )}
        </div>
      )}

      {elenco.length === 0 && <p className="text-sm text-muted-foreground">Nessun consuntivo caricato per {MESI[mese - 1]} {anno} su {CANALI.find(x => x[0] === canale)?.[1]}.</p>}

      {elenco.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                {['Fornitore', 'Ruolo', 'File', 'Esito', ''].map(h => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {elenco.map(x => (
                <tr key={x.id} className={`border-t ${aperto && aperto.id === x.id ? 'bg-muted/40' : ''}`}>
                  <td className="px-2 py-1.5 font-medium">{x.fornitore}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{RUOLI.find(r => r[0] === x.ruolo)?.[1] || x.ruolo}</td>
                  <td className="px-2 py-1.5 text-xs font-mono text-muted-foreground">{x.file_nome || '—'}</td>
                  <td className="px-2 py-1.5">
                    {x.quadra === true
                      ? <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> quadra</span>
                      : x.quadra === false
                        ? <span className="text-amber-800 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> da guardare</span>
                        // Confrontato ma senza verdetto: i movimenti tornano e
                        // l'importo e' in sospeso perche' nel conto manca una
                        // nostra tariffa (15/10/2026). Non e' una difformita'.
                        : x.confrontato_il
                          ? <span className="text-amber-800 inline-flex items-center gap-1" title="I movimenti tornano; l'importo non si è potuto controllare perché nella passiva manca una nostra tariffa, o è copiata dall'anno prima e non ancora confermata. Scritta o confermata la tariffa, rifai il confronto."><AlertTriangle className="w-3.5 h-3.5" /> importo in sospeso</span>
                          : <span className="text-muted-foreground">non ancora confrontato</span>}
                    {/* Senza questo un consuntivo alleggerito si vedeva in elenco
                        identico a uno fresco. */}
                    {x.alleggerito_il && <span className="ml-2 text-xs text-muted-foreground">· solo storia</span>}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right">
                    <Button size="sm" variant="outline" className="h-7 px-2 mr-1" onClick={() => apri(x)} disabled={!!occupato}
                      title={x.alleggerito_il ? 'Di questo consuntivo resta la storia scritta: il confronto non si può rifare senza ricaricare il file' : undefined}>
                      {x.alleggerito_il ? 'Storia' : <><RefreshCw className="w-3.5 h-3.5 mr-1" /> Confronta</>}
                    </Button>
                    {isAdmin && (
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => elimina(x)} disabled={!!occupato}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Al quarantesimo giorno il consuntivo perde le righe lette e il confronto:
          resta la storia scritta. Senza questo riquadro il clic su una riga vecchia
          mostrava solo una fascia rossa d'errore. */}
      {esito && esito.alleggerito && (
        <Storia testo={esito.storia} alleggeritoIl={esito.consuntivo && esito.consuntivo.alleggerito_il} cosa="consuntivo" />
      )}

      {esito && c && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className={`px-3 py-2 text-sm font-semibold flex items-center justify-between gap-2 ${v.quadra_tutto ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
            <span className="flex items-center gap-2">
              {c.quadra && v.quadra_con_passiva !== false ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {esito.testo}
            </span>
            {aperto && (
              <Button size="sm" variant="outline" className="h-7" onClick={async () => { try { await scaricaExcelConsuntivo(aperto, esitoPerIlFile(esito)); } catch (e) { setErrore(motivoErrore(e)); } }}>
                <Download className="w-3.5 h-3.5 mr-1" /> Esporta
              </Button>
            )}
          </div>

          <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-b">
            <div><div className="text-xs text-muted-foreground">Chili del consuntivo</div><div className="tabular-nums font-medium">{formatKg(c.totale_consuntivo_kg)}</div></div>
            <div><div className="text-xs text-muted-foreground">Chili dei nostri movimenti</div><div className="tabular-nums font-medium">{formatKg(c.totale_gestionale_kg)}</div></div>
            <div>
              <div className="text-xs text-muted-foreground">Importo previsto</div>
              <div className="tabular-nums font-medium">{v.importo_previsto === null || v.importo_previsto === undefined ? '—' : euro(v.importo_previsto)}</div>
              {/* Un previsto fatto con tariffe che mancano non e' un numero
                  (15/10/2026): «—», col perche' */}
              {v.importo_sospeso && Number(v.importo_sospeso.tonnellate) > 0 && <div className="text-[11px] text-amber-800">manca la nostra tariffa: {formatTonnellate(v.importo_sospeso.tonnellate)} t senza prezzo</div>}
              {/* la tariffa copiata e non confermata (D4, 15/10/2026) */}
              {v.importo_sospeso && Number(v.importo_sospeso.da_confermare_t) > 0 && <div className="text-[11px] text-amber-800">tariffa copiata {Number(v.importo_sospeso.anno_copia) > 0 ? `dal ${v.importo_sospeso.anno_copia}` : "dall'anno prima"}, da confermare: {formatTonnellate(v.importo_sospeso.da_confermare_t)} t</div>}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Sul consuntivo</div>
              <div className="tabular-nums font-medium">{v.importo_consuntivo === null ? 'non indicato' : euro(v.importo_consuntivo)}</div>
            </div>
          </div>

          {/* LE NOTE DELLA LETTURA, CHE PRIMA NON SI VEDEVANO.
              Quali colonne si sono usate, quali fogli non si sono potuti
              leggere e perche', le righe che paiono totali, il sospetto sul mese
              sbagliato, e in testa i carichi di altri mesi che nel gestionale
              non risultano. Erano tutte calcolate e finivano solo
              nell'esito_json: una spiegazione che resta in un JSON non ha
              spiegato niente a nessuno. Col rosso quando c'e' qualcosa da
              registrare, perche' quello non e' una nota, e' una scadenza. */}
          {esito.note_lettura && esito.note_lettura.length > 0 && (
            <ul className={`px-3 py-2 text-xs border-b space-y-1 ${(c.arretrati_da_registrare || c.date_sbagliate_quante) ? 'bg-red-100 text-red-900' : 'bg-amber-50 text-amber-900'}`}>
              {esito.note_lettura.map((n, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className={(c.arretrati_da_registrare || c.date_sbagliate_quante) && i === 0 ? 'font-semibold' : ''}>{n}</span>
                </li>
              ))}
            </ul>
          )}
          {v.non_controllato && v.non_controllato.length > 0 && (
            <p className="px-3 py-2 text-xs text-amber-900 bg-amber-50 border-b">Non si e&apos; potuto controllare: {v.non_controllato.join('; ')}. Un controllo mancato non e&apos; un controllo passato.</p>
          )}
          {esito.costo && !esito.costo.trovato && (
            <p className="px-3 py-2 text-xs text-amber-900 bg-amber-50 border-b">{esito.costo.motivo}</p>
          )}
          {esito.congelato && (
            <p className="px-3 py-2 text-xs text-muted-foreground border-b">
              Il confronto usa il conto della passiva <strong>congelato</strong> il {giornoIt(esito.congelato.congelato_il)}
              {esito.congelato.congelato_da ? ` da ${esito.congelato.congelato_da}` : ''}: allora erano {esito.congelato.importo_allora === null ? '—' : euro(esito.congelato.importo_allora)},
              ricalcolandolo oggi sono {esito.congelato.importo_oggi === null ? '—' : euro(esito.congelato.importo_oggi)}.
              {fraseCongelato(esito.congelato, v && v.importo_sospeso)}
            </p>
          )}

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  {['Formulario o ordine', 'Esito', 'kg consuntivo', 'kg nostri', 'Scarto', 'ID ordine'].map(h => (
                    <th key={h} className="px-2 py-1.5 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.voci.map((x, i) => (
                  <tr key={i} className={`border-t ${x.esito === 'uguale' ? ((x.differenze || []).length ? 'bg-amber-50/60' : '') : 'bg-amber-50'}`}>
                    <td className="px-2 py-1 font-mono">{String(x.chiave).replace(/^(FIR|ORD):/, '')}</td>
                    <td className="px-2 py-1">
                      {x.esito === 'uguale' ? 'torna' : x.esito === 'peso_diverso' ? 'peso diverso' : x.esito === 'solo_consuntivo' ? 'ce lo fattura e noi non l\'abbiamo' : 'l\'abbiamo noi e non lo riporta'}
                      {/* In che cosa consiste l'errore, quando il carico si è
                          riconosciuto nonostante un numero scritto male: è
                          quello che si comunica al fornitore (01/10/2026). */}
                      {(x.differenze || []).map((d, k) => (
                        <span key={k} className="block text-[11px] text-amber-800">{d.testo}</span>
                      ))}
                      {(x.riconosciuto_da || []).length > 0 && (
                        <span className="block text-[11px] text-muted-foreground">riconosciuto da: {x.riconosciuto_da.join(', ')}</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{x.kg_consuntivo === null ? '—' : formatKg(x.kg_consuntivo)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{x.kg_gestionale === null ? '—' : formatKg(x.kg_gestionale)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{x.scarto_kg === null ? '—' : `${x.scarto_kg > 0 ? '+' : ''}${formatKg(x.scarto_kg)}`}</td>
                    <td className="px-2 py-1 text-muted-foreground">{x.id_ordine || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-xs text-muted-foreground border-t">
            È un report del fornitore, non una fattura: non c&apos;è IVA e non c&apos;è imponibile. Dal conto della fatturazione passiva restano
            fuori <strong>per costruzione</strong> le terziarie — che la passiva non legge affatto — e gli oneri fissi dell&apos;extra raccolta
            (pulizia e costi aggiuntivi), che escono solo come segnalazione: una differenza su quelle voci non è una difformità.
            {' '}Le <strong>secondarie di extra raccolta</strong> invece <em>sono</em> nel conto, pagate come raccolta a chi le trasporta,
            e qui sono contate come tali: la nota di prima diceva il contrario, ed era falsa.
          </p>
        </div>
      )}
    </div>
  );
}
