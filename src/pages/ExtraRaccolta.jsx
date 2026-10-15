import React, { useState, useEffect, useMemo, useRef } from 'react';
import { anniDaScegliere } from '@/lib/periodoPagine';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, Copy, FileSpreadsheet, FileText, AlertTriangle } from 'lucide-react';
import { usePermessi } from '@/lib/permessi';
import { BannerSolaLettura } from '@/components/shared/SolaLettura';
import { MESI } from '@/lib/pfuConstants';
import { calcExtraRaccolta, contestoPrezzi, conViaggi, avvisoPesoMancante, totaliExtraRaccolta, titoloSurplus, annoDelDocumento } from '@/lib/extraRaccoltaCalc';
import { formatNumber, formatTonnellate, formatKg } from '@/lib/utils';
import { euro } from '@/lib/formatoSoldi';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { leggiSurplus } from '@/lib/leggiSurplus';
import { leggiTariffe } from '@/lib/leggiTariffe';
import * as subfornitori from '@/lib/subfornitori';
import { testoEuroT, periodoSurplus, statoSurplus, surplusTocca, euroTDi, NOMI_ORIGINE, NOMI_PRESTAZIONE, aiDestinatari } from '@/lib/surplus';
import { STILE_SURPLUS } from '@/lib/surplusVista';
import { exportExtraRaccoltaExcel, exportExtraRaccoltaPDF } from '@/lib/extraRaccoltaExport';
import ExtraRaccoltaForm from '@/components/fatturazione/ExtraRaccoltaForm';
import { STATI_EXTRA, statoExtra, eTerminato, datiChiusuraCompleti, dateDaCorreggere, competenza } from '@/lib/extraRaccoltaStato';
import { giornoRoma, oggiRoma } from '@/lib/giornoItaliano';
import { giornoMovimento, giornoElenco, dateDaSistemare, testoDate, MESI_MOVIMENTI } from '@/lib/movimenti';
import { dopoCaricamento, testoRicalcoli } from '@/lib/importGrandeFile';
import AvvisoDateDaSistemare, { SegnoDate, NotaDate } from '@/components/primarie-rete/DateDaSistemare';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReportConferimenti from '@/components/report-conferimenti/ReportConferimenti';
import { useToast } from '@/components/ui/use-toast';
import { scriviConTraccia, eliminaConTraccia, avvisoTraccia } from '@/lib/scriviConTraccia';

// Dove si colloca una scheda, come in tutto il gestionale: un terminato sul giorno
// italiano della fine trasporto, e se non ce l'ha non si colloca (niente ripiego
// sulla richiesta); una richiesta ancora aperta, che non e' un movimento, sulla
// data della richiesta. E' giornoElenco (src/lib/movimenti.js), la regola di
// tutti gli elenchi. Mese e anno salvati sulla scheda non decidono: possono
// venire da una scrittura vecchia.
const giornoIt = (v) => { const g = giornoRoma(v); return g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : ''; };
// Immissione (la data della richiesta), inizio e fine trasporto sono obbligatorie
// in ogni formulario terminato (regola dell'utente, 22/09/2026). Un intervento
// terminato a cui ne manca una, o con le date nell'ordine sbagliato, ha il segno
// sulla riga e si conta nell'avviso; il filtro Date lo mostra, anche senza un
// mese: chi non ha la fine trasporto non ne ha uno. La validazione sul
// salvataggio sta nel modulo di inserimento (ExtraRaccoltaForm): qui l'elenco.
const eSecondaria = (r) => String((r && r.tipo_movimento) || 'primaria').toLowerCase().trim() === 'secondaria';

// Le schede si salvano una dopo l'altra, e ogni salvataggio lanciava tutti i
// ricalcoli: con piu' schede di fila partivano giri sovrapposti, e sotto il
// titolo restava l'esito di quello finito per ultimo, non per forza dell'ultimo
// salvataggio. Ora le modifiche si accumulano (con i loro giorni di fine
// trasporto) e i ricalcoli partono una volta sola, qualche secondo dopo l'ultima;
// se ne arrivano mentre un giro e' in corso, se ne fa un altro alla fine, e si
// mostra solo l'esito del giro che le comprende tutte.
const ATTESA_RICALCOLI_MS = 4000;
const nuovaCoda = () => ({ giorni: new Set(), pendente: false, timer: null, inCorso: false, mostra: null });
function avviaRicalcoli(c) {
  c.timer = null;
  if (c.inCorso || !c.pendente) return;
  const giorni = [...c.giorni];
  c.giorni = new Set();
  c.pendente = false;
  c.inCorso = true;
  const fine = (esiti) => {
    c.inCorso = false;
    // modifiche arrivate durante il giro: se il loro timer e' gia' scaduto si riparte subito
    if (c.pendente) { if (!c.timer) avviaRicalcoli(c); return; }
    if (c.mostra) c.mostra(esiti);
  };
  dopoCaricamento('extra_raccolta', { giorni })
    .then(fine, (e) => fine([{ nome: 'moduli collegati', ok: false, errore: e && e.message ? e.message : String(e) }]));
}

// LA FASCIA DI UN SURPLUS (13/10/2026). Una per surplus, sopra la tabella:
// sottile, con la barretta a sinistra che la segna come surplus (l'ambra qui
// vuol dire «c'e' un problema», e un surplus non lo e'). Dice chi lo ha
// deciso, quanto vale a tonnellata in attiva e in passiva, il periodo, e quanto
// fa sugli interventi dell'elenco, col centesimo del mese. La parte ai fornitori
// e' un costo: la vede solo l'amministratore. Sta fuori dalla pagina perche' un
// componente definito dentro si rimonta a ogni disegno.
// La forma e' quella del surplus nelle pagine della passiva e dell'attiva: la
// barretta indaco a sinistra, il nome in corsivo, la parola «Surplus» per chi
// non distingue il colore; chi l'ha vista una volta la riconosce ovunque.
// UN COLORE SOLO, IL TOKEN (revisione del 13/10/2026): qui c'erano le classi
// indaco di Tailwind, un tono diverso da quello delle altre pagine. Ora le
// classi vengono da STILE_SURPLUS (src/lib/surplusVista.js), col token
// --eco-surplus di src/index.css, chiaro e scuro come vuole il tema.
const RIQUADRO_SURPLUS = `${STILE_SURPLUS.riquadro} ${STILE_SURPLUS.barretta}`;
const NOME_SURPLUS = 'italic text-foreground';
const QUOTA_SURPLUS = STILE_SURPLUS.diCui;
const tIt = (kg) => formatTonnellate((Number(kg) || 0) / 1000);
// Il titolo della quota di surplus di una riga: quale surplus, a quanto, su quante
// tonnellate e a chi, e che il centesimo che fa fede e' quello del mese. Anche
// la quota da Ecotyre dice per chi e': il raccoglitore, mai il produttore
// (13/10/2026: «il fuel surcharge non riguarda i produttori ma i trasportatori
// ovvero i raccoglitori», l'utente).
const aChiVa = (v, daEcotyre) => {
  if (daEcotyre) return v.fornitore ? ` da Ecotyre, per ${v.fornitore}` : ' da Ecotyre';
  if (v.interno) return `; ${v.fornitore} è interno e non lo riceve`;
  return v.fornitore ? ` a ${v.fornitore}` : '';
};
const titoloQuota = (voci, daEcotyre = false) => [
  ...(voci || []).map(v => `${v.etichetta}: ${testoEuroT(v.euro_t)} su ${tIt(v.kg)} t${aChiVa(v, daEcotyre)}`),
  'È la quota di questo intervento: in fattura e in passiva il surplus si calcola una volta sul mese, e il centesimo del mese fa fede.',
].join('\n');
function FasciaSurplus({ p, isAdmin, filtrata }) {
  const aChi = p.a_chi === 'elenco' ? `solo ${aiDestinatari(p.prestazione, 'elenco')}` : aiDestinatari(p.prestazione, 'tutti');
  const agliChi = aiDestinatari(p.prestazione, 'elenco').replace(/ dell'elenco$/, '');
  const periodo = periodoSurplus({ data_inizio_validita: p.dal, data_fine_validita: p.al });
  const attiva = p.euro_t_attiva !== null && p.euro_t_attiva !== undefined;
  const passiva = p.euro_t_passiva !== null && p.euro_t_passiva !== undefined;
  const scarto = !p.vuota && (Math.abs((p.quote_attivo || 0) - (p.attivo || 0)) > 0.004
    || (isAdmin && Math.abs((p.quote_passivo || 0) - (p.passivo || 0)) > 0.004));
  return (
    <div className={`${RIQUADRO_SURPLUS} rounded-md px-4 py-3 text-sm space-y-1.5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p>
          <span className={`font-semibold ${NOME_SURPLUS}`}>{p.nome}</span>
          <span className="text-muted-foreground">{p.origine ? ` · ${p.origine}` : ''}{periodo ? ` · ${periodo}` : ''}</span>
        </p>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Surplus · {NOMI_PRESTAZIONE[p.prestazione] || 'prestazione'}, {aChi}</span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 tabular-nums">
        <span>
          da Ecotyre <strong>{attiva ? `+${testoEuroT(p.euro_t_attiva)}` : 'niente'}</strong>
          {!p.vuota && attiva && <> · {tIt(p.kg_attivo)} t · <strong>{euro(p.attivo)}</strong> in fattura</>}
        </span>
        {isAdmin && (
          <span>
            {agliChi} <strong>{passiva ? `+${testoEuroT(p.euro_t_passiva)}` : 'niente'}</strong>
            {!p.vuota && passiva && p.kg_passivo > 0 && <> · {tIt(p.kg_passivo)} t · <strong>{euro(p.passivo)}</strong> in passiva</>}
          </span>
        )}
      </div>
      {p.vuota ? (
        <p className="text-xs text-muted-foreground">Nessun intervento terminato dell&apos;elenco ci rientra: vale sugli interventi che finiscono il trasporto {periodo || 'nel suo periodo'}, sulle stesse tonnellate, con una riga sua {[attiva && 'in fattura', isAdmin && passiva && 'in passiva'].filter(Boolean).join(' e ') || 'nei conti del mese'}.</p>
      ) : (
        <>
          {isAdmin && (p.fornitori.length > 0 || p.interni.length > 0) && (
            <p className="text-xs text-muted-foreground">
              {p.fornitori.map(f => `${f.fornitore} ${tIt(f.kg)} t, ${euro(f.importo)}`).join(' · ')}
              {p.fornitori.length > 0 && p.interni.length > 0 ? ' · ' : ''}
              {p.interni.map(f => `${f.fornitore} è interno: sulle sue ${tIt(f.kg)} t non si paga`).join(' · ')}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Si calcola sulle stesse tonnellate degli interventi, una volta per mese, come in fattura{isAdmin ? ' e in passiva' : ''}: il centesimo che fa fede è quello del mese.
            {scarto && ` Sommate intervento per intervento, le quote nella tabella fanno ${euro(p.quote_attivo)}${isAdmin && passiva ? ` in fattura e ${euro(p.quote_passivo)} in passiva` : ''}: la differenza è l'arrotondamento.`}
            {filtrata && ` Con i filtri il conto è sui soli interventi mostrati: ${isAdmin ? 'fattura e passiva lo fanno' : 'la fattura lo fa'} su tutti gli interventi del mese.`}
          </p>
        </>
      )}
    </div>
  );
}

export default function ExtraRaccolta() {
  const { isAdmin } = usePermessi();
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ anno: '', mese: '', stato: '', trasportatore: '', destinazione: '', tipologia_trasporto: '', date: '' });
  // Gli anni si contano quando la pagina si disegna, non quando il modulo si
  // carica (prova del cambio d'anno, 15/10/2026): con la scheda aperta dal
  // 31/12, il 04/01 la lista restava ferma al 2026. Come la Dashboard.
  const oggi = oggiRoma();
  const anni = useMemo(() => anniDaScegliere({ oggi }), [oggi]);
  const [sistemando, setSistemando] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState(null);
  const [ricalcoli, setRicalcoli] = useState(null);
  // Le tariffe attive dell'extra raccolta e i fornitori che cambiano la dicitura:
  // il prezzo di un intervento senza prezzo scritto si sceglie con quelle, come
  // in fattura (chiusura dell'audit, 11/10/2026). Si leggono una volta: sono
  // poche righe, e la scheda le riceve da qui invece di rileggerle.
  const [tariffeAttive, setTariffeAttive] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [tariffeNonLette, setTariffeNonLette] = useState(false);
  // I surplus sulle tariffe (il Fuel Surcharge, 13/10/2026): tutti i record,
  // anche i disattivati, che toglie contestoPrezzi come per le tariffe.
  const [surplusAll, setSurplusAll] = useState([]);
  const [surplusNonLetti, setSurplusNonLetti] = useState(false);
  // I contratti dei trasporti (13/10/2026): una secondaria di extra raccolta si
  // paga come un trasporto di secondaria, con la tariffa della tratta nel
  // contratto del vettore (decisione dell'utente del 13/10/2026). Sono costi:
  // arrivano solo all'amministratore, e finche' non ci sono (null) il
  // costo di una secondaria e' quello scritto sull'intervento.
  const [tariffeTrasporti, setTariffeTrasporti] = useState(null);
  const [trasportiNonLetti, setTrasportiNonLetti] = useState(false);
  // Le tariffe passive dell'extra raccolta, con cui la scheda propone i costi
  // (14/10/2026): solo dell'amministratore, l'unico che apre la scheda.
  // undefined finche' si leggono, null se non si sono lette (la scheda lo dice).
  const [tariffePassiveExtra, setTariffePassiveExtra] = useState(undefined);
  const coda = useRef(null);
  if (!coda.current) coda.current = nuovaCoda();

  // Uscendo dalla pagina un ricalcolo in attesa parte subito, invece di perdersi.
  useEffect(() => {
    const c = coda.current;
    c.mostra = setRicalcoli;
    return () => {
      c.mostra = null;
      if (c.timer) { clearTimeout(c.timer); avviaRicalcoli(c); }
    };
  }, []);

  // Chiudendo la scheda del browser, invece, i ricalcoli non ancora partiti si
  // perderebbero: finche' ce ne sono, lo si chiede.
  const ricalcoliInCorso = !!(ricalcoli && ricalcoli.in_corso);
  useEffect(() => {
    if (!ricalcoliInCorso) return undefined;
    const avviso = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avviso);
    return () => window.removeEventListener('beforeunload', avviso);
  }, [ricalcoliInCorso]);

  // Una scheda di extra raccolta e' un movimento come quelli dei file del portale:
  // scriverla, correggerla o cancellarla cambia le dichiarazioni di nessuna
  // movimentazione, le verifiche dei report e le quadrature FIR della sua
  // settimana, la qualifica. Si ricalcola come dopo un caricamento (elenco unico
  // in dopoCaricamento), sui giorni italiani di fine trasporto di prima e di dopo.
  const aggiornaModuli = (record) => {
    const c = coda.current;
    for (const r of record) { const g = giornoMovimento(r); if (g) c.giorni.add(g); }
    c.pendente = true;
    setRicalcoli({ in_corso: true });
    clearTimeout(c.timer);
    c.timer = setTimeout(() => avviaRicalcoli(c), ATTESA_RICALCOLI_MS);
  };

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.ExtraRaccolta.list('-created_date', 5000);
      setRecords(all);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let vivo = true;
    // Senza le tariffe la pagina sa solo il prezzo scritto e la base
    // dell'anno, e senza i fornitori non sa la dicitura: lo dice, invece di
    // mostrare un ricavo che la fattura potrebbe non avere. Le letture sono
    // separate, perche' una che non risponde non si porti via le altre, e
    // partono insieme (14/10/2026): le tariffe ora vengono da una funzione,
    // come i surplus, e una dopo l'altra la pagina aspettava la somma dei tempi.
    (async () => {
      try {
        // Dalla funzione leggiTariffe, non dall'archivio (14/10/2026): Tariffa la
        // legge solo l'amministratore, perche' le passive sono i prezzi dei
        // fornitori, e a chi non lo e' la lettura diretta darebbe un elenco
        // vuoto, cioe' la sola base dell'anno senza un errore. La funzione da' a
        // tutti le attive e all'amministratore anche le passive: una chiamata
        // sola per tutto quello che la pagina e la scheda usano.
        // Tutte le EXTRA_RACCOLTA attive, anche non_attivo con una data di fine:
        // la fattura le considera (tariffeAttiveValide), e un filtro sullo stato
        // qui farebbe scegliere un altro prezzo.
        const { parte, tariffe } = await leggiTariffe();
        if (vivo) {
          setTariffeAttive(tariffe.filter(t => t.direzione === 'ATTIVA' && t.tipologia === 'EXTRA_RACCOLTA'));
          // Per l'amministratore (lo decide il server): i contratti dei
          // trasporti delle secondarie, tutti (il disattivato lo toglie
          // contestoPrezzi), e le passive dell'extra raccolta per la scheda.
          if (parte === 'tutto') {
            setTariffeTrasporti(tariffe.filter(t => t.prestazione === 'TRASPORTO_SECONDARIA'));
            setTariffePassiveExtra(tariffe.filter(t => t.direzione === 'PASSIVA' && t.tipologia === 'EXTRA_RACCOLTA'));
          }
        }
      } catch {
        if (vivo) { setTariffeNonLette(true); setTrasportiNonLetti(true); setTariffePassiveExtra(null); }
      }
    })();
    (async () => {
      try {
        // Tutta l'anagrafica, non solo i fornitori con la spunta della dicitura
        // (13/10/2026): per il surplus serve sapere chi e' interno (SMOCO non lo
        // riceve) e chi fattura per un subraccoglitore. La dicitura la sceglie
        // servizioEcotyre guardando la spunta, come prima.
        const f = await fetchAllClient(base44.entities.Fornitore, null, 'ragione_sociale');
        if (vivo) setFornitori(f || []);
      } catch {
        if (vivo) setTariffeNonLette(true);
      }
    })();
    (async () => {
      try {
        // Dalla funzione leggiSurplus, non dall'archivio (decisione del
        // 13/10/2026): SurplusTariffa lo legge solo l'amministratore, e a chi non
        // lo e' la funzione da' la sola parte che SMOCO fattura a Ecotyre. Una
        // chiamata, tutti i record: il disattivato lo toglie il calcolo, come per
        // le tariffe (mai un filtro sullo stato qui).
        const s = await leggiSurplus();
        if (vivo) setSurplusAll(s || []);
      } catch {
        if (vivo) setSurplusNonLetti(true);
      }
    })();
    return () => { vivo = false; };
  }, []);
  // Il contesto dei prezzi e del surplus: lo stesso della fattura e della
  // passiva, con la catena dei subfornitori (il surplus di un subraccoglitore va
  // al principale, come la tariffa) e, per l'amministratore, i contratti dei
  // trasporti, con cui la passiva paga le secondarie. Con i viaggi delle
  // secondarie (conViaggi, revisione del 14/10/2026): a viaggio lo stesso camion
  // nello stesso giorno si paga una volta, diviso fra i suoi interventi per peso,
  // e i viaggi si contano sull'elenco gia' letto, senza letture in piu'.
  const contesto = useMemo(() => conViaggi(contestoPrezzi(tariffeAttive, fornitori, surplusAll, subfornitori, tariffeTrasporti), records), [tariffeAttive, fornitori, surplusAll, tariffeTrasporti, records]);

  // I filtri si dividono in due, come negli altri elenchi: quelli di periodo
  // leggono giornoElenco, gli altri la scheda. Separati, per contare le date da
  // sistemare anche di chi un periodo non l'ha (un terminato senza fine trasporto).
  const passaAltri = (r) => {
    if (filters.stato && statoExtra(r) !== (filters.stato === 'senza' ? '' : filters.stato)) return false;
    if (filters.trasportatore && r.trasportatore !== filters.trasportatore) return false;
    if (filters.destinazione && r.destinazione !== filters.destinazione) return false;
    if (filters.tipologia_trasporto && r.tipologia_trasporto !== filters.tipologia_trasporto) return false;
    if (filters.date === 'da_sistemare' && !dateDaSistemare(r)) return false;
    return true;
  };
  const passaPeriodo = (r) => {
    if (!filters.anno && !filters.mese) return true;
    const g = giornoElenco(r);
    if (!g) return false;
    if (filters.anno && Number(g.slice(0, 4)) !== Number(filters.anno)) return false;
    if (filters.mese && MESI_MOVIMENTI[Number(g.slice(5, 7)) - 1] !== filters.mese) return false;
    return true;
  };
  const senzaPeriodo = (r) => eTerminato(r) && !giornoMovimento(r);

  // Con il filtro Date un terminato senza fine trasporto resta anche con un anno
  // o un mese scelto: e' proprio quello da correggere. passaAltri e passaPeriodo
  // leggono solo filters, che e' fra le dipendenze.
  const filtered = useMemo(() => {
    return records.filter(r => passaAltri(r) && (passaPeriodo(r) || (filters.date === 'da_sistemare' && senzaPeriodo(r)))).sort((a, b) => {
      // Prima le richieste da evadere, poi le altre dalla piu' recente.
      const aperta = (r) => Number(statoExtra(r) === 'assegnato');
      return (aperta(b) - aperta(a)) || giornoElenco(b).localeCompare(giornoElenco(a));
    });
  }, [records, filters]);
  // Le schede da guardare per le date da sistemare: quelle dell'elenco e i
  // terminati senza fine trasporto che rispondono agli altri filtri.
  const perDate = useMemo(() => records.filter(r => passaAltri(r) && (passaPeriodo(r) || senzaPeriodo(r))), [records, filters]);

  // Solo i terminati entrano nei totali e nelle esportazioni, come in fatturazione,
  // e solo con la fine trasporto: senza, non hanno un mese e fuori da qui non
  // contano da nessuna parte. Non si ripiega sulla richiesta: si contano e si dicono.
  const terminati = useMemo(() => filtered.filter(r => eTerminato(r) && giornoMovimento(r)), [filtered]);
  const senzaStato = useMemo(() => records.filter(r => !statoExtra(r)), [records]);
  const daSegnare = senzaStato.filter(datiChiusuraCompleti);

  // Le tonnellate sono la raccolta dal produttore, sul peso effettivo, come nella
  // dashboard: un trasferimento in secondaria porta lo stesso peso una seconda
  // volta, e sommarlo dava due numeri diversi per la stessa extra raccolta. Ricavi
  // e costi restano tutti: il trasferimento si paga.
  // IL SURPLUS COL CENTESIMO DEL MESE (13/10/2026): i riquadri sommano lo
  // standard intervento per intervento e il surplus come lo fanno la fattura e
  // la passiva, una volta per mese (totaliExtraRaccolta). Sugli interventi di un
  // mese dicono il ricavo della fattura e il costo della passiva al centesimo.
  const kpi = useMemo(() => totaliExtraRaccolta(terminati, contesto), [terminati, contesto]);
  const contoSurplus = kpi.surplus;
  // Il nome del blocco del surplus nei file, per la nota accanto ai pulsanti:
  // «Fuel Surcharge ai raccoglitori» (13/10/2026). Chi non e' amministratore non
  // sente nominare un surplus pagato solo ai fornitori.
  const bloccoNeiFile = useMemo(() => {
    const nomi = [...new Set(contoSurplus.per_surplus
      .filter(p => isAdmin || (p.euro_t_attiva !== null && p.euro_t_attiva !== undefined))
      .map(p => `«${titoloSurplus(p.nome, p.prestazione)}»`))];
    return nomi.length ? nomi.join(' e ') : '«del surplus»';
  }, [contoSurplus, isAdmin]);
  // Un filtro che non e' il periodo restringe gli interventi: il surplus allora
  // e' quello dei soli interventi mostrati, e la fattura del mese lo fa su tutti.
  const filtriOltreIlPeriodo = !!(filters.stato || filters.trasportatore || filters.destinazione || filters.tipologia_trasporto || filters.date);
  // Le fasce del surplus: quelli che toccano gli interventi dell'elenco e, senza
  // interventi, quelli dell'extra raccolta che valgono nel periodo scelto (o
  // oggi, senza un periodo), perche' si sappia che ci sono.
  const fasceSurplus = useMemo(() => {
    const conChili = contoSurplus.per_surplus;
    const viste = new Set(conChili.map(p => p.surplus_id).filter(Boolean));
    let dal = '', al = '';
    if (filters.anno && filters.mese) {
      const mm = String(MESI.indexOf(filters.mese) + 1).padStart(2, '0');
      dal = `${filters.anno}-${mm}-01`; al = `${filters.anno}-${mm}-31`;
    } else if (filters.anno) {
      dal = `${filters.anno}-01-01`; al = `${filters.anno}-12-31`;
    }
    const senzaChili = (contesto.surplus || [])
      .filter(s => !viste.has(String(s.id || '')))
      .filter(s => (dal ? surplusTocca(s, dal, al) : statoSurplus(s) === 'in_corso'))
      .map(s => ({
        chiave: String(s.id || s.nome), surplus_id: String(s.id || ''), nome: String(s.nome || '').trim() || 'Surplus',
        origine: NOMI_ORIGINE[String(s.origine || '').trim().toUpperCase()] || '',
        prestazione: String(s.prestazione || '').trim().toUpperCase(),
        a_chi: String(s.a_chi || 'tutti').trim().toLowerCase() === 'elenco' ? 'elenco' : 'tutti',
        dal: String(s.data_inizio_validita || '').slice(0, 10), al: String(s.data_fine_validita || '').slice(0, 10),
        euro_t_attiva: euroTDi(s, 'ATTIVA'), euro_t_passiva: euroTDi(s, 'PASSIVA'),
        kg_attivo: 0, kg_passivo: 0, attivo: 0, passivo: 0, quote_attivo: 0, quote_passivo: 0, fornitori: [], interni: [], vuota: true,
      }));
    return [...conChili, ...senzaChili];
  }, [contoSurplus, contesto, filters.anno, filters.mese]);

  // QUELLO CHE LA FATTURA SEGNALA, LA PAGINA LO DICE UGUALE (11/10/2026).
  // Un terminato senza peso effettivo non si fattura e non si valuta: prima qui
  // si prendeva la quantita' ritirata al suo posto. E un intervento senza prezzo
  // scritto che prende il prezzo di una tariffa di un altro anno, rimasta aperta,
  // in fattura esce con l'avviso «prezzo di un altro anno»: qui lo stesso.
  const senzaPeso = useMemo(() => terminati.filter(r => calcExtraRaccolta(r, contesto).senza_peso), [terminati, contesto]);
  const prezzoAltroAnno = useMemo(() => terminati.filter(r => { const c = calcExtraRaccolta(r, contesto); return c.fatturato && c.prezzo.altro_anno; }), [terminati, contesto]);

  const trasportatori = useMemo(() => [...new Set(records.map(r => r.trasportatore).filter(Boolean))].sort(), [records]);
  const destinatari = useMemo(() => [...new Set(records.map(r => r.destinazione).filter(Boolean))].sort(), [records]);
  const tipologie = useMemo(() => [...new Set(records.map(r => r.tipologia_trasporto).filter(Boolean))].sort(), [records]);

  // I costi e i prezzi scritti sull'intervento finiscono nello storico delle
  // modifiche (11/10/2026), che si apre nella scheda; se il dato e' salvato ma
  // la traccia no, lo si dice.
  const save = async (payload) => {
    try {
      const esito = formInitial?.id
        ? await scriviConTraccia('ExtraRaccolta', formInitial.id, payload, { origine: 'Extra Raccolta' })
        : await scriviConTraccia('ExtraRaccolta', null, payload, { origine: 'Extra Raccolta' });
      const avviso = avvisoTraccia(esito);
      if (avviso) toast(avviso);
      aggiornaModuli([formInitial, payload]);
      setFormOpen(false);
      setFormInitial(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const remove = async (r) => {
    if (!confirm('Eliminare questo intervento?')) return;
    const esito = await eliminaConTraccia('ExtraRaccolta', r.id, { origine: 'Extra Raccolta' });
    const avviso = avvisoTraccia(esito);
    if (avviso) toast(avviso);
    aggiornaModuli([r]);
    load();
  };

  const duplicate = (r) => {
    const { id, id_ordine, numero_fir, trasporto_iniziato_il, trasporto_finito_il, created_date, updated_date, created_by_id, ...rest } = r;
    setFormInitial({ ...rest, stato: 'assegnato', numero_fir: '', trasporto_iniziato_il: null, trasporto_finito_il: null });
    setFormOpen(true);
  };

  // Le schede inserite prima dello stato: quelle con FIR, peso e le tre date
  // si segnano terminate, riportando le date al giorno di calendario giusto.
  const segnaTerminati = async () => {
    if (!confirm(`Segnare come terminati ${daSegnare.length} interventi con FIR, peso e date di immissione, inizio e fine trasporto? Da quel momento entrano in fatturazione, giacenze, report e verifiche nel mese della loro fine trasporto.`)) return;
    setSistemando(true);
    const toccati = [];
    try {
      for (const r of daSegnare) {
        const date = dateDaCorreggere(r);
        // mese e anno scritti sulla scheda: quelli del giorno italiano della fine
        // trasporto, come li legge il resto del gestionale
        const fine = giornoRoma(date.trasporto_finito_il || r.trasporto_finito_il);
        await scriviConTraccia('ExtraRaccolta', r.id, { stato: 'terminato', ...date, ...competenza(fine) }, { origine: 'Extra Raccolta' });
        toccati.push(r, { trasporto_finito_il: date.trasporto_finito_il });
      }
    } catch (e) {
      alert(e.message);
    }
    setSistemando(false);
    if (toccati.length) aggiornaModuli(toccati);
    load();
  };

  // L'anno dei file: vedi qui sotto (15/10/2026). I file ricevono le tariffe
  // che la pagina ha letto (contesto): senza, conoscevano solo il prezzo scritto
  // e la base dell'anno, e con la tabella a un altro valore dicevano un prezzo
  // diverso da pagina e fattura (chiusura dell'audit, 11/10/2026).
  // Col surplus (13/10/2026): il contesto e' lo stesso della pagina, e i file
  // hanno la riga del Fuel Surcharge prima del Totale imponibile, col centesimo
  // del mese come in fattura. L'analisi per produttore ha costi e margine: il
  // file la porta solo all'amministratore, come la pagina (isAdmin; senza, il
  // file la toglie). Dal 13/10/2026 sera l'analisi e' lo standard e il surplus
  // ha il blocco «... ai raccoglitori», col costo solo all'amministratore.
  //
  // L'ANNO DEL FILE E' QUELLO DEI MOVIMENTI (prova del cambio d'anno,
  // 15/10/2026). Con l'anno su «Tutti», com'e' all'apertura, il file prendeva
  // l'anno di oggi: il 10/02/2027 il dicembre 2026 usciva «Dicembre 2027». Ora
  // con «Tutti» vale l'anno degli interventi esportati se e' uno solo; con
  // interventi di piu' anni e un mese scelto i pulsanti non esportano e chiedono
  // l'anno (un mese e' di un anno solo); senza mese il file dice «tutti gli
  // anni» (annoDelDocumento in extraRaccoltaCalc.js).
  const fileDa = useMemo(() => annoDelDocumento({ anno: filters.anno, mese: filters.mese, interventi: terminati, oggi }), [filters.anno, filters.mese, terminati, oggi]);
  // Con lo stesso mese in piu' anni il pulsante non esporta: chiede l'anno, e
  // la frase resta scritta accanto ai pulsanti.
  const chiediAnno = () => toast({ title: "Scegli l'anno", description: fileDa.chiedi });
  const exportExcel = async () => {
    if (fileDa.chiedi) { chiediAnno(); return; }
    const mese = filters.mese || 'Tutti';
    const anno = fileDa.anno;
    await exportExtraRaccoltaExcel(terminati, mese, anno, contesto, { isAdmin });
  };

  const exportPDF = async () => {
    if (fileDa.chiedi) { chiediAnno(); return; }
    const mese = filters.mese || 'Tutti';
    const anno = fileDa.anno;
    await exportExtraRaccoltaPDF(terminati, mese, anno, contesto, { isAdmin });
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Extra Raccolta</h1>
          <p className="text-muted-foreground mt-1">Richieste e interventi di extra raccolta: si inseriscono come assegnati e si chiudono come terminati con FIR, fine trasporto e peso. Solo i terminati vanno in fatturazione.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setFormInitial(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Aggiungi intervento
          </Button>
        )}
      </div>

      <BannerSolaLettura cosa="gli interventi di extra raccolta" />

      {(() => {
        const r = testoRicalcoli(ricalcoli);
        return r ? <p className={`text-xs ${r.classe}`}>{r.testo}</p> : null;
      })()}

      {!loading && (
        <AvvisoDateDaSistemare
          righe={perDate}
          canale="Extra Raccolta"
          nomi={['intervento terminato', 'interventi terminati']}
          nota="Chi non ha la fine trasporto non ha un mese e resta escluso da totali, esportazioni, fatturazione, giacenze, report e verifiche."
          correzione={isAdmin ? 'Aprili e correggi le date.' : "Le corregge l'amministratore, aprendo l'intervento."}
          attivo={filters.date === 'da_sistemare'}
          onFiltra={(v) => setFilters({ ...filters, date: v ? 'da_sistemare' : '' })}
        />
      )}

      {senzaPeso.length > 0 && (
        <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <p>
              <strong>{senzaPeso.length} {senzaPeso.length === 1 ? 'intervento terminato è' : 'interventi terminati sono'} senza peso effettivo</strong>:
              {senzaPeso.length === 1 ? ' non entra' : ' non entrano'} nella fattura a Ecotyre e i costi a tonnellata valgono zero, come in fattura e in passiva, finché il peso non si scrive sull&apos;intervento. La quantità ritirata non lo sostituisce.
            </p>
            <ul className="text-xs list-disc pl-4">
              {senzaPeso.slice(0, 5).map(r => <li key={r.id}>{avvisoPesoMancante(r)}</li>)}
              {senzaPeso.length > 5 && <li>e altri {senzaPeso.length - 5}.</li>}
            </ul>
          </div>
        </div>
      )}

      {prezzoAltroAnno.length > 0 && (
        <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            <strong>{prezzoAltroAnno.length} {prezzoAltroAnno.length === 1 ? 'intervento senza prezzo scritto prende' : 'interventi senza prezzo scritto prendono'} il prezzo di un altro anno</strong>,
            da una tariffa di extra raccolta rimasta aperta: in fattura {prezzoAltroAnno.length === 1 ? 'esce' : 'escono'} con lo stesso avviso. Scrivi sull&apos;intervento il prezzo concordato per la campagna.
          </p>
        </div>
      )}

      {tariffeNonLette && (
        <p className="text-xs text-amber-700">Le tariffe attive dell&apos;extra raccolta o i fornitori non si sono potuti leggere: i ricavi degli interventi senza prezzo scritto usano solo la base dell&apos;anno, e possono non essere quelli della fattura. Ricarica la pagina.</p>
      )}

      {surplusNonLetti && (
        <p className="text-xs text-amber-700">I surplus sulle tariffe (come il Fuel Surcharge) non si sono potuti leggere: ricavi e costi qui sono senza surplus, e possono non essere quelli della fattura e della passiva. Ricarica la pagina.</p>
      )}

      {isAdmin && trasportiNonLetti && (
        <p className="text-xs text-amber-700">I contratti dei trasporti non si sono potuti leggere: il costo delle secondarie qui è quello scritto sull&apos;intervento, mentre la passiva le paga con la tariffa della tratta. Ricarica la pagina.</p>
      )}

      {senzaStato.length > 0 && (
        <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <p>
              <strong>{senzaStato.length} {senzaStato.length === 1 ? 'intervento è stato salvato' : 'interventi sono stati salvati'} senza stato</strong> e
              {senzaStato.length === 1 ? ' non viene conteggiato' : ' non vengono conteggiati'} in fatturazione, giacenze, report e verifiche.
            </p>
            {daSegnare.length > 0 && <p>{daSegnare.length} {daSegnare.length === 1 ? 'ha' : 'hanno'} FIR, peso e le tre date (immissione, inizio e fine trasporto): si possono segnare come terminati.</p>}
            {senzaStato.length > daSegnare.length && <p>{senzaStato.length - daSegnare.length} {senzaStato.length - daSegnare.length === 1 ? 'è incompleto' : 'sono incompleti'} (manca il FIR, il peso o una delle tre date, o le date non tornano): aprili con il filtro Stato «Senza stato», completali e scegli lo stato.</p>}
          </div>
          {isAdmin && daSegnare.length > 0 && (
            <Button size="sm" onClick={segnaTerminati} disabled={sistemando}>
              {sistemando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Segna {daSegnare.length} come terminati
            </Button>
          )}
        </div>
      )}

      {/* Filtri */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Anno</label>
          <Select value={filters.anno ? String(filters.anno) : 'all'} onValueChange={v => setFilters({ ...filters, anno: v === 'all' ? '' : Number(v) })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {anni.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Mese</label>
          <Select value={filters.mese || 'all'} onValueChange={v => setFilters({ ...filters, mese: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {MESI.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Stato</label>
          <Select value={filters.stato || 'all'} onValueChange={v => setFilters({ ...filters, stato: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="assegnato">Assegnati</SelectItem>
              <SelectItem value="terminato">Terminati</SelectItem>
              <SelectItem value="senza">Senza stato</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Trasportatore</label>
          <Select value={filters.trasportatore || 'all'} onValueChange={v => setFilters({ ...filters, trasportatore: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {trasportatori.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Destinatario</label>
          <Select value={filters.destinazione || 'all'} onValueChange={v => setFilters({ ...filters, destinazione: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {destinatari.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Tipologia trasporto</label>
          <Select value={filters.tipologia_trasporto || 'all'} onValueChange={v => setFilters({ ...filters, tipologia_trasporto: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte</SelectItem>
              {tipologie.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Date</label>
          <Select value={filters.date || 'all'} onValueChange={v => setFilters({ ...filters, date: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9" title="Da sistemare: i terminati a cui manca l'immissione, l'inizio o la fine del trasporto, o con le date nell'ordine sbagliato"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte</SelectItem>
              <SelectItem value="da_sistemare">Da sistemare</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI. Ricavi e costi comprendono il surplus col centesimo del mese
          (totaliExtraRaccolta), e sotto il numero una riga dice quanto ne e'
          surplus; la parte dei costi solo all'amministratore. */}
      {/* Costi e margine li vede solo l'amministratore (13/10/2026): chi non lo e'
          vede tonnellate e ricavi. */}
      <div className={`grid grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : ''} gap-3`}>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">Tonnellate raccolte (senza le secondarie)</div>
          <div className="text-lg font-bold tabular-nums">{formatTonnellate(kpi.tonnellate)} t</div>
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">Ricavi</div>
          <div className="text-lg font-bold tabular-nums">€ {formatNumber(kpi.ricavi, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          {contoSurplus.totale_attivo > 0 && (
            <div className="text-[11px] text-muted-foreground tabular-nums">standard {euro(kpi.ricavi_standard)} · surplus {euro(contoSurplus.totale_attivo)}</div>
          )}
        </div>
        {isAdmin && (<>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">Costi</div>
          <div className="text-lg font-bold tabular-nums">€ {formatNumber(kpi.costi, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          {isAdmin && contoSurplus.totale_passivo > 0 && (
            <div className="text-[11px] text-muted-foreground tabular-nums">standard {euro(kpi.costi_standard)} · surplus {euro(contoSurplus.totale_passivo)}</div>
          )}
        </div>
        <div className="border rounded-lg p-3 bg-card">
          <div className="text-xs text-muted-foreground">Margine</div>
          {/* Con un intervento da fatturare senza prezzo il margine e' «—», col
              perche': un margine fatto da un ricavo che manca non e' un margine
              (prova del cambio d'anno, 15/10/2026). */}
          {kpi.margine === null ? (<>
            <div className="text-lg font-bold tabular-nums">—</div>
            <div className="text-[11px] text-amber-700">{kpi.testo_senza_prezzo}</div>
          </>) : (
            <div className={`text-lg font-bold tabular-nums ${kpi.margine >= 0 ? 'text-success' : 'text-destructive'}`}>
              € {formatNumber(kpi.margine, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal ml-1">({formatNumber(kpi.margine_perc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)</span>
            </div>
          )}
        </div>
        </>)}
      </div>

      {/* Il surplus sulle tariffe (13/10/2026): una fascia per surplus. Chi non
          e' amministratore non vede un surplus solo ai fornitori, che e' un costo. */}
      {fasceSurplus.filter(p => isAdmin || p.euro_t_attiva !== null).map(p => (
        <FasciaSurplus key={p.chiave} p={p} isAdmin={isAdmin} filtrata={filtriOltreIlPeriodo} />
      ))}

      {/* Export. Accanto ai pulsanti, quanti degli interventi che vanno nel file
          hanno le date da sistemare (regola del 22/09/2026): i terminati senza
          fine trasporto nel file non ci sono, gli altri si', e chi manda la
          fatturazione deve saperlo prima. */}
      <div className="flex flex-wrap gap-2">
        {/* SURPLUS NON LETTI, FILE FERMI (13/10/2026): senza i surplus il Totale
            imponibile del file non avrebbe il Fuel Surcharge e non tornerebbe con
            la fattura, in silenzio. Si esporta quando si sono letti. */}
        <Button variant="outline" size="sm" onClick={exportExcel} disabled={terminati.length === 0 || surplusNonLetti}>
          <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Esporta Excel
        </Button>
        <Button variant="outline" size="sm" onClick={exportPDF} disabled={terminati.length === 0 || surplusNonLetti}>
          <FileText className="w-4 h-4 mr-1.5" /> Esporta PDF
        </Button>
        {surplusNonLetti && <span className="self-center text-xs text-amber-700">I file si esportano quando i surplus sono letti: ricarica la pagina.</span>}
        {/* interventi del mese scelto di piu' anni: si chiede l'anno (15/10/2026) */}
        {fileDa.chiedi && terminati.length > 0 && <span className="self-center text-xs text-amber-700">{fileDa.chiedi}</span>}
        <span className="self-center text-xs text-muted-foreground">Totali ed esportazioni comprendono solo i terminati.</span>
        {/* Il surplus nei file (13/10/2026): fino a questa data i file avevano
            gli importi standard e la nota lo diceva; ora hanno la sua riga.
            Dal 13/10/2026 sera il surplus non sta piu' nell'analisi per
            produttore: «il fuel surcharge non riguarda i produttori ma i
            trasportatori ovvero i raccoglitori» (l'utente). Ha il suo blocco,
            col nome e chi lo riceve: «Fuel Surcharge ai raccoglitori». */}
        {contoSurplus.totale_attivo > 0 && (
          <span className="self-center text-xs text-muted-foreground">Nei file il surplus ha la sua riga prima del totale imponibile, col centesimo del mese come in fattura, e il blocco {bloccoNeiFile}: per raccoglitore le tonnellate{isAdmin ? ', il costo' : ''} e il ricavo da Ecotyre, mai per produttore.</span>
        )}
        {isAdmin && !(contoSurplus.totale_attivo > 0) && contoSurplus.totale_passivo > 0 && (
          <span className="self-center text-xs text-muted-foreground">Nei file il surplus ai fornitori ha il suo blocco {bloccoNeiFile}, fornitore per fornitore, mai per produttore.</span>
        )}
        <NotaDate righe={terminati} nomi={['intervento esportato', 'interventi esportati']} className="self-center" />
      </div>

      {/* Tabella */}
      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          Nessun intervento trovato. Clicca "Aggiungi intervento" per inserire una richiesta o un intervento.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Stato</th>
                <th className="text-left px-3 py-2 font-semibold">Nr. FIR</th>
                <th className="text-left px-3 py-2 font-semibold">Data fine trasporto</th>
                <th className="text-left px-3 py-2 font-semibold">Produttore o stoccaggio</th>
                <th className="text-left px-3 py-2 font-semibold">Trasportatore</th>
                <th className="text-left px-3 py-2 font-semibold">Destinatario</th>
                <th className="text-left px-3 py-2 font-semibold">Tipologia</th>
                <th className="text-left px-3 py-2 font-semibold">Classe</th>
                <th className="text-right px-3 py-2 font-semibold">Quantità (kg)</th>
                <th className="text-right px-3 py-2 font-semibold">Ricavo</th>
                {isAdmin && <th className="text-right px-3 py-2 font-semibold">Costo totale</th>}
                {isAdmin && <th className="text-right px-3 py-2 font-semibold">Margine</th>}
                <th className="text-center px-3 py-2 font-semibold">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const calc = calcExtraRaccolta(r, contesto);
                // Senza prezzo il margine dell'intervento non e' un numero: «—»,
                // e sotto il perche' (prova del cambio d'anno, 15/10/2026).
                const c = calc.senza_prezzo ? { ...calc, margine: null } : calc;
                const stato = statoExtra(r);
                const conta = stato === 'terminato';
                const soldi = (v) => (conta && v !== null && v !== undefined ? `€ ${formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—');
                // Il ricavo che la fattura non ha non si scrive come un incasso:
                // una secondaria non si fattura, un terminato senza peso nemmeno.
                const perche = eSecondaria(r) ? 'Una secondaria non si fattura a Ecotyre: il ricavo sta sulla raccolta.' : avvisoPesoMancante(r);
                const date = testoDate(r);
                return (
                  <tr key={r.id} className={`border-t hover:bg-muted/20 ${date ? 'bg-amber-50/60' : ''}`}>
                    <td className="px-3 py-2"><span className={`inline-block px-1.5 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${STATI_EXTRA[stato].classe}`}>{STATI_EXTRA[stato].etichetta}</span></td>
                    <td className="px-3 py-2 font-mono text-xs">{r.numero_fir || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {/* il segno delle date da sistemare, col dettaglio nel title */}
                      <SegnoDate testo={date} />
                      {giornoMovimento(r)
                        ? giornoIt(r.trasporto_finito_il)
                        : conta
                          ? <span className="text-amber-700 font-medium" title={date}>manca</span>
                          : r.ordine_immesso_il ? <span className="text-muted-foreground">richiesta il {giornoIt(r.ordine_immesso_il)}</span> : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.tipo_movimento === 'secondaria' && <span className="inline-block mr-1 px-1.5 py-0.5 rounded bg-accent/15 text-[10px] font-medium uppercase tracking-wide">Secondaria</span>}
                      {(r.tipo_movimento === 'secondaria' ? r.stoccaggio : r.produttore) || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.trasportatore || '-'}</td>
                    <td className="px-3 py-2 text-xs">{r.destinazione || '-'}</td>
                    <td className="px-3 py-2 text-xs">{r.tipologia_trasporto || '-'}</td>
                    <td className="px-3 py-2">{r.classe || '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {!c.senza_peso ? formatKg(c.kg)
                        : conta ? <span className="text-amber-700 font-medium" title={avvisoPesoMancante(r)}>manca</span> : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {conta && !c.fatturato
                        ? <span className="text-muted-foreground" title={perche}>—</span>
                        : <>
                          {conta && c.prezzo.altro_anno && <span className="text-amber-700 font-medium mr-1" title={c.prezzo.nota}>!</span>}
                          {soldi(c.ricavo)}
                          {/* la quota del surplus di questo intervento (13/10/2026) */}
                          {conta && c.surplus_ricavo > 0 && (
                            <span className={`block text-[11px] whitespace-nowrap ${QUOTA_SURPLUS}`} title={titoloQuota(c.surplus_attivo, true)}>di cui surplus {euro(c.surplus_ricavo)}</span>
                          )}
                        </>}
                    </td>
                    {isAdmin && <td className="px-3 py-2 text-right tabular-nums">
                      {soldi(c.costo_totale)}
                      {conta && isAdmin && c.surplus_costo > 0 && (
                        <span className={`block text-[11px] whitespace-nowrap ${QUOTA_SURPLUS}`} title={titoloQuota(c.surplus_passivo)}>di cui surplus {euro(c.surplus_costo)}</span>
                      )}
                      {conta && isAdmin && !(c.surplus_costo > 0) && c.surplus_passivo.some(v => v.interno) && (
                        <span className={`block text-[11px] whitespace-nowrap ${QUOTA_SURPLUS}`} title={titoloQuota(c.surplus_passivo)}>surplus: interno, non si paga</span>
                      )}
                    </td>}
                    {isAdmin && <td className={`px-3 py-2 text-right tabular-nums font-medium ${!conta || c.senza_prezzo ? 'text-muted-foreground' : c.margine >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {soldi(c.margine)}
                      {conta && c.senza_prezzo && <span className="block text-[11px] font-normal whitespace-nowrap text-amber-700">manca il prezzo</span>}
                    </td>}
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-center">
                        {isAdmin ? (<>
                          <button onClick={() => { setFormInitial(r); setFormOpen(true); }} className="p-1 hover:bg-muted rounded" title="Modifica"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => duplicate(r)} className="p-1 hover:bg-muted rounded" title="Duplica"><Copy className="w-3.5 h-3.5" /></button>
                          <button onClick={() => remove(r)} className="p-1 hover:bg-red-50 rounded" title="Elimina"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                        </>) : <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* I conferimenti di extra raccolta del mese, ripartiti sulle settimane che
          lo coprono (richiesta dell'utente, 29/09/2026). Stesso motore delle
          secondarie; qui primarie e secondarie stanno nello stesso archivio e si
          distinguono dal tipo di movimento, quindi sono due schede. */}
      <div className="bg-card border rounded-lg p-3 space-y-3">
        <div>
          <h2 className="text-lg font-heading font-semibold">Conferimenti per settimana</h2>
          <p className="text-xs text-muted-foreground">I chili di extra raccolta del mese, settimana per settimana, con origine, destinazione, trasportatore e totali. L&apos;extra raccolta è un canale a sé: non si somma mai a rete e ACI.</p>
        </div>
        <Tabs defaultValue="primarie">
          <TabsList>
            <TabsTrigger value="primarie">Primarie</TabsTrigger>
            <TabsTrigger value="secondarie">Secondarie</TabsTrigger>
          </TabsList>
          <TabsContent value="primarie" className="mt-3">
            <ReportConferimenti canale="EXTRA_RACCOLTA" tipo="primaria" titolo="Conferimenti primarie extra raccolta" />
          </TabsContent>
          <TabsContent value="secondarie" className="mt-3">
            <ReportConferimenti canale="EXTRA_RACCOLTA" tipo="secondaria" titolo="Conferimenti secondarie extra raccolta" />
          </TabsContent>
        </Tabs>
      </div>

      {/* La scheda la apre solo l'amministratore (Aggiungi, Modifica e Duplica
          sono suoi), e propone i costi con le tariffe passive: si monta solo
          per lui (14/10/2026). Montata per tutti, leggeva i prezzi dei
          fornitori anche nella pagina di chi non e' amministratore. */}
      {isAdmin && (
        <ExtraRaccoltaForm
          open={formOpen}
          contesto={contesto}
          interventi={records}
          tariffePassive={tariffePassiveExtra}
          initial={formInitial}
          onSave={save}
          onCancel={() => { setFormOpen(false); setFormInitial(null); }}
        />
      )}
    </div>
  );
}