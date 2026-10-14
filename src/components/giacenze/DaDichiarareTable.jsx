import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportDaDichiarareExcel } from '@/lib/giacenzeDaDichiarareExport';
import { formatKg, formatIntero } from '@/lib/utils';
import { giornoRoma } from '@/lib/giornoItaliano';
import { annoDiOggi } from '@/lib/periodoPagine';
import { creaSequenza } from '@/lib/ultimaRichiesta';
import EsportaPdf from '@/components/shared/EsportaPdf';
import { daDichiararePdf } from '@/lib/giacenzePdf';

// I pesi di questa lista sono chilogrammi: sempre interi. Si scrivevano con
// formatTonnellate, e un peso in kg usciva con i decimali delle tonnellate.
const kg = (n) => (n == null || n === '' || isNaN(n) ? '—' : formatKg(n));

// Il formulario nel gestionale (regola dell'utente, 22/09/2026): immissione,
// inizio e fine trasporto sono obbligatorie. Se al movimento che ha portato il
// carico all'impianto manca la fine trasporto, il portale lo conta nella sua
// giacenza e il gestionale non lo colloca in nessun mese.
function Formulario({ r }) {
  const date = r.date_da_sistemare || [];
  if (!date.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-amber-700">
      {date.map(d => <span key={`${d.tipo}-${d.id_ordine}`} className="block">{d.tipo} {d.id_ordine}: {d.testo}</span>)}
      {r.fuori_dai_mesi && <span className="block text-[11px]">il portale lo conta nella giacenza, il gestionale non lo colloca in nessun mese</span>}
      {r.fine_a_portale && <span className="block text-[11px]">il portale scrive la fine trasporto ({fmtData(r.fine_a_portale)}): va riportata nella primaria</span>}
    </span>
  );
}

// Il giorno italiano, GG/MM/AAAA. Con toLocaleDateString una data 'AAAA-MM-GG'
// (mezzanotte UTC) si leggeva nel fuso del computer, e fuori dall'Italia usciva
// il giorno prima.
function fmtData(v) {
  const g = giornoRoma(v);
  return g ? g.split('-').reverse().join('/') : '—';
}

const PAGE_SIZE = 100;

// LA RICERCA PARTE QUANDO SI SMETTE DI SCRIVERE (segnalazione alta A49 del 20/09,
// corretta il 12/10/2026). Ogni tasto nel campo «Cerca FIR / ordine» chiamava
// getOrdiniDaDichiarare, che legge primarie, secondarie e il file del portale:
// scrivere un numero FIR di dodici cifre erano dodici chiamate pesanti, sul
// limite di richieste al minuto che vale per tutta l'app. Le risposte superate
// si scartavano gia' (creaSequenza), ma partivano lo stesso. Ora il testo scritto
// diventa la ricerca 400 ms dopo l'ultimo tasto, o subito con Invio, e la pagina
// riparte dalla prima insieme alla ricerca, in una lettura sola. Finche' una
// ricerca scritta non e' partita, Excel e PDF aspettano: devono portare le righe
// che si hanno davanti, non quelle di prima.
const ATTESA_RICERCA_MS = 400;

// Il mese di un gruppo, come lo scrive il portale: 'AAAA-MM' -> 'Gen 2026'.
// Senza fine trasporto il carico non si colloca in nessun mese, e si dice.
const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const nomeMese = (m) => {
  if (!m) return 'senza data';
  const i = Number(String(m).slice(5, 7)) - 1;
  return `${MESI_BREVI[i] || m} ${String(m).slice(0, 4)}`;
};

// LA RIGA CHE TIENE INSIEME PULSANTE, ELENCO E GIACENZA (11/10/2026). Il pulsante
// della scheda Situazione conta anche i carichi che il file del portale non ha
// ancora, l'elenco qui sopra ha solo le righe del file: questa riga dice quanti
// e quali sono, toglie le dichiarazioni caricate dopo la fotografia e arriva alla
// giacenza delle Giacenze. Se qualcosa non torna, lo si vede qui e non a occhio.
function Riconciliazione({ r, sito }) {
  const [aperto, setAperto] = useState(false);
  if (!r) return null;
  if (r.errore) return <p className="text-xs text-amber-800">La riconciliazione con la giacenza non si è potuta calcolare: {r.errore}</p>;
  if (r.senza_fotografia) return <p className="text-xs text-muted-foreground">Il file degli ordini non dichiarati non è caricato: la riconciliazione con la giacenza non si fa.</p>;
  if (r.non_dovuta) return <p className="text-xs text-muted-foreground">Per accordo {sito} non ci dichiara la rete: il portale non tiene per noi una giacenza di rete, e non c&apos;è niente da riconciliare.</p>;
  return (
    <div className="text-xs border rounded-lg bg-card px-3 py-2 space-y-1">
      <p>
        <strong>Riconciliazione con la giacenza:</strong>{' '}
        file del portale{r.foto_del ? ` del ${fmtData(r.foto_del)}` : ''} {formatIntero(r.file_ordini)} {r.file_ordini === 1 ? 'ordine' : 'ordini'}, {kg(r.file_kg)} kg
        {' '}+ {formatIntero(r.aggiunti_n)} {r.aggiunti_n === 1 ? 'carico' : 'carichi'} non ancora nel file, {kg(r.aggiunti_kg)} kg
        {' '}− dichiarato a portale dopo la fotografia, {kg(r.dichiarato_dopo_kg)} kg
        {' '}= <strong className="tabular-nums">giacenza a portale {kg(r.giacenza_kg)} kg</strong>, lo stesso numero delle Giacenze.
      </p>
      <p className="text-muted-foreground">
        Ordini: {formatIntero(r.file_ordini)} nel file + {formatIntero(r.aggiunti_n)} non ancora nel file = {formatIntero(r.ordini_pulsante)}, il numero del pulsante della scheda Situazione.
        {r.aggiunti_n > 0 && <>{' '}<button type="button" className="text-primary underline" onClick={() => setAperto(v => !v)}>{aperto ? 'nascondi' : 'quali sono'}</button></>}
      </p>
      {aperto && r.aggiunti_n > 0 && (
        <table className="text-[11px]">
          <tbody>
            {r.aggiunti.map(o => (
              <tr key={`${o.tipo}-${o.id_ordine}-${o.numero_fir}`}>
                <td className="pr-2 font-mono">{o.id_ordine}</td>
                <td className="pr-2">{o.tipo === 'secondaria' ? `secondaria da ${o.da}` : o.da}</td>
                <td className="pr-2">fine trasporto {fmtData(o.fine_trasporto)}</td>
                <td className="text-right tabular-nums">{kg(o.kg)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// GLI ORDINI DI UN'ATTESA CHE PER NOI E' CHIUSA (decisioni dell'utente del
// 13/10/2026, giro del 14/10/2026). Il file degli ordini non dichiarati
// attribuisce ancora allo stoccaggio di T-Cycle 72 ordini, 181,299 t, partiti
// tutti verso Tecnogum, che sulla rete non dichiara a SMOCO. La riga della
// Situazione lo dice; aperto dal pulsante, l'elenco li presentava come carichi
// «gia' ripartiti in secondaria» che «li dichiara» l'impianto che li ha
// ricevuti, cioe' come un'attesa da risolvere. Ora si intesta «per noi chiusi»,
// col perche' della riga. Nessuna lettura in piu': la riga e' quella che la
// pagina delle Giacenze ha gia' (righeGiacenze), e senza la riga l'elenco resta
// quello di prima. Tutta l'attesa chiusa, non una parte: con una parte gli
// ordini dell'elenco restano un'attesa, e quali siano chiusi il file non lo dice.
const motivoChiusi = (perche) => String(perche || '').replace(/^.*per noi chiuse:\s*/, '');
export function attesaTuttaChiusa(righeGiacenze, sito, ruolo) {
  if (ruolo !== 'stoc' || !sito) return null;
  const r = (righeGiacenze || []).find(x => x.tipo_destinazione === 'stoc' && x.sito === sito);
  if (!r || !(Number(r.in_attesa_chiusa_t) > 0) || !r.in_attesa_chiusa_perche) return null;
  if (Number(r.in_attesa_chiusa_t) < (Number(r.in_attesa_dichiarazione_t) || 0) - 0.0005) return null;
  return { t: Number(r.in_attesa_chiusa_t), perche: r.in_attesa_chiusa_perche, motivo: motivoChiusi(r.in_attesa_chiusa_perche) };
}

export default function DaDichiarareTable({ filtroSitoEsterno, filtroRuoloEsterno, onPulisciFiltroSito, righeGiacenze = null }) {
  // Si nasce gia' col filtro che ci hanno passato: arrivando dal pulsante di un
  // impianto nella scheda Situazione, la prima lettura deve essere la sua e non
  // quella di tutti gli ordini.
  const [sito, setSito] = useState(filtroSitoEsterno || '');
  // 'imp' o 'stoc': arrivando dal pulsante di un sito si guarda un ruolo solo.
  const [ruolo, setRuolo] = useState(filtroRuoloEsterno || '');
  const [provincia, setProvincia] = useState('');
  const [annoChiusura, setAnnoChiusura] = useState('');
  // testoRicerca e' quello che si sta scrivendo, ricerca quella che vale per
  // l'elenco, l'Excel e il PDF.
  const [testoRicerca, setTestoRicerca] = useState('');
  const [ricerca, setRicerca] = useState('');
  const [soloDate, setSoloDate] = useState(false);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  // La riga di riconciliazione con la giacenza: si chiede solo arrivando dal
  // pulsante di un impianto, senza altri filtri, e non cambia sfogliando le pagine.
  const [riconciliazione, setRiconciliazione] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ siti_distinti: [], province_distinte: [], anni_distinti: [] });
  const sequenza = useRef(creaSequenza()).current;

  // Sincronizza filtro esterno (dal pulsante nella scheda Situazione)
  useEffect(() => {
    if (filtroSitoEsterno) {
      setSito(filtroSitoEsterno);
      setRuolo(filtroRuoloEsterno || '');
      setOffset(0);
    }
  }, [filtroSitoEsterno, filtroRuoloEsterno]);

  const load = useCallback(async () => {
    // Due letture possono essere in volo insieme - una senza filtro e una col
    // filtro - e quella senza, piu' lenta perche' porta tutti gli ordini, torna
    // per ultima e si prende lo schermo: il filtro resta scritto e sotto ci sono
    // gli ordini di tutti gli impianti. Succedeva davvero (08/10/2026).
    const mia = sequenza.inizia();
    setLoading(true);
    try {
      const payload = { limite: PAGE_SIZE, offset };
      if (sito) payload.sito = sito;
      if (provincia) payload.provincia = provincia;
      if (annoChiusura) payload.anno = Number(annoChiusura);
      if (ricerca) payload.ricerca = ricerca;
      if (soloDate) payload.solo_date_da_sistemare = true;
      if (ruolo) payload.ruolo = ruolo;
      // Il pulsante di un impianto e nessun altro filtro: l'elenco e' tutto quello
      // che il portale aspetta da lui, e si chiede anche la riconciliazione con la
      // giacenza (11/10/2026). Sfogliando le pagine si tiene quella che c'e'.
      const daRiconciliare = !!sito && ruolo === 'imp' && !provincia && !annoChiusura && !ricerca && !soloDate;
      if (daRiconciliare && offset === 0) payload.riconcilia = true;
      const res = await base44.functions.invoke('getOrdiniDaDichiarare', payload);
      if (!sequenza.valida(mia)) return;
      setData(res.data);
      if (!daRiconciliare) setRiconciliazione(null);
      else if (offset === 0) setRiconciliazione(res.data.riconciliazione || null);
      if (res.data.siti_distinti) setFilterOptions(res.data);
    } catch (e) {
      console.error(e);
    }
    if (sequenza.valida(mia)) setLoading(false);
  }, [sito, provincia, annoChiusura, ricerca, soloDate, ruolo, offset, sequenza]);

  useEffect(() => { load(); }, [load]);

  // Reset offset quando cambiano i filtri
  useEffect(() => { setOffset(0); }, [sito, provincia, annoChiusura, ricerca, soloDate, ruolo]);

  // La ricerca scritta vale dopo ATTESA_RICERCA_MS dall'ultimo tasto. Ricerca e
  // prima pagina cambiano insieme: una lettura sola, non una con la pagina
  // vecchia e una con la prima.
  const applicaRicerca = useCallback((testo) => { setRicerca(testo); setOffset(0); }, []);
  useEffect(() => {
    if (testoRicerca === ricerca) return undefined;
    const attesa = setTimeout(() => applicaRicerca(testoRicerca), ATTESA_RICERCA_MS);
    return () => clearTimeout(attesa);
  }, [testoRicerca, ricerca, applicaRicerca]);
  const ricercaInSospeso = testoRicerca !== ricerca;

  const handlePulisciSito = () => {
    setSito('');
    setRuolo('');
    onPulisciFiltroSito();
  };

  // I filtri che si hanno davanti, come li vuole la funzione. Uno solo, perche'
  // l'Excel e il PDF devono portare esattamente le stesse righe: se si guardano
  // i carichi da dichiarare di un impianto, nel file non finiscono quelli
  // passati dal suo piazzale e gia' ripartiti (utente, 08/10/2026).
  const payloadFiltrato = useCallback((extra = {}) => {
    const payload = { tutte: true, offset: 0, ...extra };
    if (sito) payload.sito = sito;
    if (provincia) payload.provincia = provincia;
    if (annoChiusura) payload.anno = Number(annoChiusura);
    if (ricerca) payload.ricerca = ricerca;
    if (soloDate) payload.solo_date_da_sistemare = true;
    if (ruolo) payload.ruolo = ruolo;
    return payload;
  }, [sito, provincia, annoChiusura, ricerca, soloDate, ruolo]);

  const handleExport = async () => {
    // Scarica tutto l'elenco filtrato (senza limite) per l'export
    try {
      // tutte: le righe non si tagliano a mille, come il totale.
      const res = await base44.functions.invoke('getOrdiniDaDichiarare', payloadFiltrato());
      await exportDaDichiarareExcel(res.data.righe, res.data.totale_righe, res.data.totale_kg);
    } catch (e) {
      alert('Errore nell\'export: ' + e.message);
    }
  };

  // IL PDF DELLA SCHEDA (09/10/2026). Nel PDF vanno TUTTE le righe del filtro,
  // non le cento della pagina: un totale sotto una tabella parziale e' la
  // lettura che ha fatto credere che ottobre non fosse contato. Si vanno a
  // prendere al clic, come fa l'Excel.
  // Senza un anno scelto, l'anno del PDF e' quello di oggi in Italia, non
  // quello dell'orologio del dispositivo: un dispositivo con un altro fuso, a
  // cavallo della mezzanotte del 31/12, scriveva un altro anno (revisione della
  // chiusura dell'audit, 11/10/2026, la regola di src/lib/periodoPagine.js).
  const chiusi = attesaTuttaChiusa(righeGiacenze, sito, ruolo);
  const sezioniPdf = async () => {
    const res = await base44.functions.invoke('getOrdiniDaDichiarare', payloadFiltrato());
    return daDichiararePdf(annoChiusura || annoDiOggi(), res.data, {
      sito, ruolo, provincia, anno: annoChiusura, ricerca, solo_date: soloDate,
      ...(chiusi ? { per_noi_chiusi: chiusi.motivo } : {}),
    });
  };

  const righe = data?.righe || [];
  const totaleRighe = data?.totale_righe || 0;
  const totaleKg = data?.totale_kg || 0;
  const perMese = data?.per_mese || [];
  const dateInfo = data?.date_da_sistemare || { n: 0 };
  const senzaFineAPortale = data?.senza_fine_a_portale || 0;
  const senzaFineDalGestionale = data?.senza_fine_dal_gestionale || 0;
  const hasPrev = offset > 0;
  const hasNext = righe.length === PAGE_SIZE && offset + PAGE_SIZE < totaleRighe;

  return (
    <div className="space-y-3">
      {/* Filtri */}
      <div className="bg-card border rounded-lg p-3 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sito</label>
          <Select value={sito} onValueChange={v => { setSito(v === '__all__' ? '' : v); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tutti i siti" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti i siti</SelectItem>
              {filterOptions.siti_distinti?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Provincia</label>
          <Select value={provincia} onValueChange={v => { setProvincia(v === '__all__' ? '' : v); }}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tutte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutte</SelectItem>
              {filterOptions.province_distinte?.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" title="L'anno della fine del trasporto">Anno (fine trasporto)</label>
          <Select value={annoChiusura} onValueChange={v => { setAnnoChiusura(v === '__all__' ? '' : v); }}>
            <SelectTrigger className="w-[100px]"><SelectValue placeholder="Tutti" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti</SelectItem>
              {filterOptions.anni_distinti?.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Cerca FIR / ordine</label>
          <Input
            placeholder="Numero FIR o ordine..."
            value={testoRicerca}
            onChange={e => setTestoRicerca(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && ricercaInSospeso) applicaRicerca(testoRicerca); }}
            className="h-9"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs h-9" title="Nel gestionale ogni formulario deve avere tre date: immissione, inizio e fine trasporto, in quest'ordine. Dove ne manca una, o sono incoerenti, il carico non si colloca in nessun mese e non entra in nessuna dichiarazione, mentre il portale lo conta nella sua giacenza. Questa spunta mostra solo quelli, per andarli a correggere.">
          <input type="checkbox" checked={soloDate} onChange={e => setSoloDate(e.target.checked)} />
          Solo quelli col formulario da correggere
        </label>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || ricercaInSospeso}>
          <Download className="w-4 h-4 mr-1" /> Esporta Excel
        </Button>
        <EsportaPdf sezioni={sezioniPdf} disabilitato={loading || ricercaInSospeso} />
        {sito && (
          <Button variant="ghost" size="sm" onClick={handlePulisciSito} title="Torna a vedere tutti i siti. Non cancella niente.">
            Mostra tutti i siti
          </Button>
        )}
      </div>
      {/* Da dove si arriva conta: col ruolo scelto si vedono solo i carichi di quel
          titolo. Il numero del pulsante nella scheda Situazione conta anche i
          carichi che il file del portale non ha ancora: il pulsante e l'elenco
          dicono lo stesso attraverso la riga di riconciliazione sotto la tabella,
          che li mette insieme e arriva alla giacenza (11/10/2026). Prima questo
          commento lo affermava e basta, ed era falso appena un carico arrivava
          dopo l'ultimo file, cioe' quasi ogni settimana. */}
      {chiusi && (
        <p className="text-sm border rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground cursor-help" title={chiusi.perche}>
          <strong className="text-foreground">Per noi chiusi: {chiusi.motivo}.</strong>{' '}
          Il portale li attribuisce ancora allo stoccaggio, ma nessuna dichiarazione li chiuderà e non c&apos;è niente da fare:
          il numero resta quello del portale, e serve alla quadratura.
        </p>
      )}
      {ruolo && (
        <div className="text-xs text-muted-foreground">
          {ruolo === 'imp'
            ? <>Si vedono solo i carichi che <strong className="text-foreground">{sito}</strong> deve ancora dichiarare come impianto.</>
            : chiusi
              ? <>Si vedono solo i carichi passati dal piazzale di <strong className="text-foreground">{sito}</strong> e già ripartiti in secondaria.</>
              : <>Si vedono solo i carichi passati dal piazzale di <strong className="text-foreground">{sito}</strong> e già ripartiti in secondaria: stanno come giacenza sull&apos;impianto che li ha ricevuti, e li dichiara lui.</>}
          {' '}
          <button type="button" className="text-primary underline" onClick={() => setRuolo('')}>mostra tutti e due</button>
        </div>
      )}

      {/* Conteggio e peso totale */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{formatIntero(totaleRighe)}</strong> ordini</span>
        <span><strong className="text-foreground">{kg(totaleKg)}</strong> kg totali</span>
        {totaleRighe > righe.length && (
          <span className="text-xs">
            in tabella {righe.length === 0 ? 0 : offset + 1}–{offset + righe.length}: l&apos;elenco parte dal carico arrivato da più tempo, i mesi più recenti sono nelle pagine dopo
          </span>
        )}
        {(loading || ricercaInSospeso) && <RefreshCw className="w-4 h-4 animate-spin" />}
      </div>
      {/* DI QUALI MESI SONO, SU TUTTO L'ELENCO (09/10/2026).
          Chiesto dall'utente dopo aver guardato gli ordini da dichiarare di
          T-Cycle: «non compaiono poi in elenco gli ingressi di ottobre e mi
          chiedo: come fai a trovarti con la giacenza attuale se non consideri
          anche quelli?». C'erano - 12 ordini, 29.060 kg - ma in fondo, dopo le
          prime cento righe, e il totale sotto la tabella li contava senza che si
          vedessero. Questa riga dice i mesi di TUTTO l'elenco filtrato: si legge
          in un colpo d'occhio e fa da riscontro alla giacenza dell'impianto. */}
      {perMese.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Di quali mesi:</span>
          {perMese.map(m => (
            <span key={m.mese || 'senza'} className="rounded-md border bg-card px-2 py-0.5 tabular-nums"
              title={`${m.ordini} ${m.ordini === 1 ? 'ordine' : 'ordini'} per ${kg(m.kg)} kg${m.mese ? '' : ' senza fine trasporto: non si collocano in nessun mese'}`}>
              <span className="font-medium">{nomeMese(m.mese)}</span>{' '}
              <span className="text-muted-foreground">{formatIntero(m.ordini)} · {kg(m.kg)} kg</span>
            </span>
          ))}
        </div>
      )}
      {(dateInfo.n > 0 || senzaFineAPortale > 0) && (
        <div className="text-xs border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 space-y-0.5">
          {dateInfo.n > 0 && (
            <p>
              <strong>{formatIntero(dateInfo.n)}</strong> {dateInfo.n === 1 ? 'ordine ha' : 'ordini hanno'}, nel gestionale, un formulario terminato senza tutte le date obbligatorie ({kg(dateInfo.kg)} kg da dichiarare): immissione, inizio e fine trasporto vanno completate.
              {dateInfo.fuori_dai_mesi > 0 && ` A ${formatIntero(dateInfo.fuori_dai_mesi)} (${kg(dateInfo.fuori_dai_mesi_kg)} kg) manca la fine trasporto dell'arrivo all'impianto: il portale li conta nella giacenza, il gestionale non li colloca in nessun mese finche' la data non arriva.`}
            </p>
          )}
          {senzaFineAPortale > 0 && (
            <p>
              {formatIntero(senzaFineAPortale)} {senzaFineAPortale === 1 ? 'riga' : 'righe'} del file del portale senza fine trasporto
              {senzaFineDalGestionale > 0 ? `: ${formatIntero(senzaFineDalGestionale)} la ${senzaFineDalGestionale === 1 ? 'prende' : 'prendono'} dal formulario del gestionale` : ''}
              {senzaFineAPortale - senzaFineDalGestionale > 0 ? `${senzaFineDalGestionale > 0 ? ', le altre' : ':'} in fondo alla lista, fuori dal filtro per anno` : ''}.
            </p>
          )}
        </div>
      )}

      {/* Tabella */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-2 py-2 font-semibold">Ordine</th>
                <th className="px-2 py-2 font-semibold">FIR</th>
                <th className="px-2 py-2 font-semibold">Fine trasporto</th>
                <th className="px-2 py-2 font-semibold">Punto di raccolta</th>
                <th className="px-2 py-2 font-semibold">Comune</th>
                <th className="px-2 py-2 font-semibold">Prov.</th>
                <th className="px-2 py-2 font-semibold">Prodotto</th>
                <th className="px-2 py-2 font-semibold text-right">Peso da dichiarare</th>
                <th className="px-2 py-2 font-semibold">Destinazione</th>
                <th className="px-2 py-2 font-semibold">Trasferito a</th>
                <th className="px-2 py-2 font-semibold" title="Il formulario nel gestionale: le date obbligatorie che mancano o non tornano">Formulario nel gestionale</th>
              </tr>
            </thead>
            <tbody>
              {righe.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">Nessun ordine da dichiarare</td></tr>
              )}
              {righe.map((r, i) => {
                const giorni = r.giorni_attesa;
                let rowClass = 'border-t hover:bg-muted/30';
                if (giorni != null && giorni > 180) rowClass = 'border-t bg-red-50 hover:bg-red-100';
                else if (giorni != null && giorni > 90) rowClass = 'border-t bg-amber-50 hover:bg-amber-100';
                return (
                  <tr key={i} className={rowClass}>
                    <td className="px-2 py-1.5 font-mono text-xs">{r.ordine_primaria}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{r.numero_fir || '—'}</td>
                    <td className="px-2 py-1.5" title={r.data_chiusura ? `chiuso a portale il ${fmtData(r.data_chiusura)}` : ''}>{fmtData(r.fine_trasporto)}{r.fine_dal_gestionale && <span className="block text-[10px] text-muted-foreground" title="Il file del portale non la scrive: e' quella del formulario nel gestionale">dal gestionale</span>}</td>
                    <td className="px-2 py-1.5">{r.punto_di_raccolta || '—'}</td>
                    <td className="px-2 py-1.5">{r.comune || '—'}</td>
                    <td className="px-2 py-1.5">{r.provincia || '—'}</td>
                    <td className="px-2 py-1.5">{r.prodotto || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{kg(r.peso_non_dichiarato_kg)} kg</td>
                    <td className="px-2 py-1.5">{r.destinazione || '—'}</td>
                    <td className="px-2 py-1.5">{r.destinazione_secondaria || '—'}</td>
                    <td className="px-2 py-1.5 text-xs"><Formulario r={r} /></td>
                  </tr>
                );
              })}
            </tbody>
            {righe.length > 0 && (
              /* IL TOTALE SOTTO LE RIGHE E' DI TUTTO L'ELENCO, NON DI QUESTA
                 PAGINA, e finche' non lo diceva sembrava il totale delle cento
                 righe davanti: e' la lettura che ha fatto pensare che ottobre non
                 fosse contato (09/10/2026). Dove l'elenco non sta in una pagina
                 si scrivono entrambi i numeri. */
              <tfoot className="bg-muted/50 font-bold border-t-2">
                {totaleRighe > righe.length && (
                  <tr className="font-normal text-muted-foreground">
                    <td className="px-2 py-1.5" colSpan={7}>In questa pagina ({formatIntero(righe.length)} {righe.length === 1 ? 'ordine' : 'ordini'})</td>
                    <td className="px-2 py-1.5 text-right">{kg(righe.reduce((s, r) => s + (r.peso_non_dichiarato_kg || 0), 0))} kg</td>
                    <td className="px-2 py-1.5" colSpan={3}></td>
                  </tr>
                )}
                <tr>
                  <td className="px-2 py-2" colSpan={7}>TOTALE DELL&apos;ELENCO ({formatIntero(totaleRighe)} ordini)</td>
                  <td className="px-2 py-2 text-right">{kg(totaleKg)} kg</td>
                  <td className="px-2 py-2" colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* LA RIGA DI RICONCILIAZIONE (chiusura dell'audit, 11/10/2026).
          Righe del file + carichi che il file non ha ancora - dichiarato dopo la
          fotografia = la giacenza a portale, lo stesso numero delle Giacenze; e
          righe + carichi = il numero del pulsante. Le regole sono quelle delle
          Giacenze (base44/shared/riconciliazioneDaDichiarare.ts). */}
      <Riconciliazione r={riconciliazione} sito={sito} />

      {/* Paginazione */}
      {totaleRighe > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + righe.length, totaleRighe)} di {totaleRighe}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!hasPrev} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              <ChevronLeft className="w-4 h-4" /> Precedenti
            </Button>
            <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Successivi <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}