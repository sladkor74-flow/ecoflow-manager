import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Save, ChevronLeft } from 'lucide-react';
import StoricoModifiche from '@/components/shared/StoricoModifiche';
import { calcExtraRaccolta, prezzoAttivoExtra, annoIntervento, avvisoPesoMancante, tariffaPassivaProposta, trasportoIntervento } from '@/lib/extraRaccoltaCalc';
import { PROV_TO_REGION } from '@/lib/regioneMap';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { formatNumber, formatTonnellate } from '@/lib/utils';
import { euro } from '@/lib/formatoSoldi';
import { testoEuroT, periodoSurplus, statoSurplus, DESTINATARI } from '@/lib/surplus';
import { STILE_SURPLUS } from '@/lib/surplusVista';
import { giornoDaData, dataDaGiorno, competenza, datiChiusuraCompleti } from '@/lib/extraRaccoltaStato';
import { oggiRoma } from '@/lib/giornoItaliano';
import { DATE_OBBLIGATORIE, dateMancanti, dateIncoerenti, testoDate } from '@/lib/movimenti';
import { interventiConStessoFir, domandaFirGiaPresente } from '@/lib/formularioGiaPresente';

const CLASSI = ['P', 'M', 'G1', 'G2'];

// Il campo del costo di ogni prestazione passiva, sull'intervento.
const CAMPO_COSTO = { RACCOLTA: 'costo_raccolta_t', TRATTAMENTO: 'costo_trattamento_t', CONFERIMENTO_STOCCAGGIO: 'costo_stoccaggio_t' };
const CAMPI_COSTO = Object.values(CAMPO_COSTO);

// I costi che non si spiegano da soli e pretendono le note. Gli oneri senza
// padrone, che la fatturazione passiva non sa a chi fatturare, e i due
// sovracosti pagati, che nascono sempre da un imprevisto: l'utente, 03/10/2026,
// dice che il raccoglitore «ha dovuto sostenere costi imprevisti nella raccolta
// per diverse ragioni» e che l'impianto ha «costi non previsti sostenuti per la
// pulizia di pfu sporchi prima del trattamento». Quelle ragioni e quei motivi
// finiscono nelle note del foglio dell'amministrazione, percio' vanno scritti
// qui: un costo imprevisto che si fattura a un fornitore deve dire perche'. Il
// costo del trasporto a viaggio non entra in questo elenco, perche' e' una voce
// normale dell'intervento e non un imprevisto.
const CAMPI_DA_SPIEGARE = ['costo_pulizia', 'costi_aggiuntivi', 'sovracosto_pagato_raccoglitore', 'sovracosto_pagato_impianto'];
const serveNoteCosti = (f) => CAMPI_DA_SPIEGARE.some(k => Number(f[k]) > 0);

const EMPTY = {
  stato: 'assegnato', ordine_immesso_il: '',
  numero_fir: '', tipologia_trasporto: '', tipo_movimento: 'primaria', stoccaggio: '',
  trasporto_iniziato_il: '', trasporto_finito_il: '',
  produttore: '', trasportatore: '', destinazione: '', tipo_destinazione: 'imp',
  provincia: '', automezzo: '',
  cer: '160103', classe: '', peso_effettivo: '',
  prezzo_attivo_t: 0, sovracosto_raccolta: 0, sovracosto_trasporto: 0, sovracosto_trattamento: 0,
  costo_raccolta_t: 0, costo_trasporto_viaggio: 0, costo_stoccaggio_t: 0, costo_trattamento_t: 0,
  sovracosto_pagato_raccoglitore: 0, sovracosto_pagato_impianto: 0,
  costo_pulizia: 0, costi_aggiuntivi: 0, note_costi: '', note: '',
};


// UN CAMPO NUMERICO STA FUORI DAL MODULO (audit del 20/09, alta A39; corretta il
// 12/10/2026). Era definito dentro ExtraRaccoltaForm: a ogni carattere scritto il
// modulo si ridisegna, React vedeva un componente nuovo, buttava via l'input e
// ne montava un altro, e il cursore usciva dal campo dopo ogni cifra - nei
// sovracosti, nella pulizia e nei costi aggiuntivi. Definito qui, il tipo resta
// lo stesso fra un disegno e l'altro e il campo tiene il cursore.
function NumField({ label, value, onChange }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" className="h-9 text-sm" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// IL SURPLUS NELLA SCHEDA (13/10/2026). Il Fuel Surcharge del consorzio e ogni
// altro surplus dell'extra raccolta: SMOCO lo fattura a Ecotyre e lo paga a chi
// lo riceve - il Fuel Surcharge ai raccoglitori, mai al produttore (l'utente, il
// 13/10/2026 sera: «il fuel surcharge non riguarda i produttori ma i
// trasportatori ovvero i raccoglitori») - sulle stesse tonnellate. Qui si vede
// la quota di questo intervento, con la barretta che segna il surplus in tutte
// le pagine. Fuori dal modulo per la stessa ragione di NumField.
const A_CHI = { RACCOLTA: 'al raccoglitore', TRATTAMENTO: "all'impianto", CONFERIMENTO_STOCCAGGIO: 'allo stoccaggio', TRASPORTO_SECONDARIA: 'al trasportatore' };
// La quota da Ecotyre dice per chi e': il raccoglitore per la raccolta (e per
// un surplus senza prestazione), la destinazione per trattamento e stoccaggio.
const PER_CHI = { RACCOLTA: 'per il raccoglitore', TRATTAMENTO: "per l'impianto", CONFERIMENTO_STOCCAGGIO: 'per lo stoccaggio' };
const tonn = (kg) => formatTonnellate((Number(kg) || 0) / 1000);
const giornoIt = (v) => { const g = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(g) ? g.split('-').reverse().join('/') : ''; };
// «fra il 01/10/2026 e il 31/12/2026»: il periodo in cui deve finire il trasporto.
const fraIl = (s) => {
  const dal = giornoIt(s && s.data_inizio_validita);
  const al = giornoIt(s && s.data_fine_validita);
  return dal && al ? `fra il ${dal} e il ${al}` : periodoSurplus(s) || 'nel suo periodo';
};
// La riga del surplus nella scheda: la forma e il colore delle altre pagine,
// dal token --eco-surplus (STILE_SURPLUS, revisione del 13/10/2026).
function RigaSurplus({ children }) {
  return (
    <p className={`mt-2 rounded-sm px-2 py-1 text-xs tabular-nums ${STILE_SURPLUS.barretta} ${STILE_SURPLUS.fondo}`}>
      <span className={`mr-1.5 ${STILE_SURPLUS.etichetta}`}>Surplus</span>
      {children}
    </p>
  );
}

// Select con opzioni + "Altro..." che rivela un input di testo libero
function ComboSelect({ value, onChange, options, placeholder }) {
  const isCustomInit = !!value && !options.some(o => o.value === value);
  const [custom, setCustom] = useState(isCustomInit);

  // Rivaluta quando le opzioni vengono caricate (async)
  useEffect(() => {
    if (options.length > 0) {
      setCustom(!!value && !options.some(o => o.value === value));
    }
  }, [options]);

  if (custom) {
    return (
      <div className="flex gap-1">
        <Input
          className="h-9 text-sm"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Inserisci nome..."
        />
        <Button size="sm" variant="outline" type="button" className="px-2 shrink-0" onClick={() => { setCustom(false); onChange(''); }}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <Select value={value || undefined} onValueChange={v => {
      if (v === '__altro__') { setCustom(true); onChange(''); }
      else onChange(v);
    }}>
      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        <SelectItem value="__altro__">Altro...</SelectItem>
      </SelectContent>
    </Select>
  );
}

// L'anno su cui si propone la tariffa base del prezzo attivo: la fine del
// trasporto, poi la data della richiesta; per una scheda nuova ancora senza date,
// l'anno di oggi in Italia.
const annoProposta = (f) => annoIntervento(f) || Number(oggiRoma().slice(0, 4));

// La data su cui si guarda la validita' di una tariffa: la fine del trasporto,
// poi la richiesta, poi oggi in Italia (una scheda nuova non ha ancora date).
const giornoProposta = (f) => f.trasporto_finito_il || f.ordine_immesso_il || oggiRoma();

// `contesto` sono le tariffe attive e i fornitori che la pagina ha letto
// (contestoPrezzi): il prezzo proposto e l'avviso sotto il campo vengono dalla
// stessa funzione della fattura (chiusura dell'audit, 11/10/2026).
// `tariffePassive` sono le tariffe passive dell'extra raccolta, con cui la scheda
// propone i costi (14/10/2026): le legge la pagina, nella stessa chiamata a
// leggiTariffe delle attive, invece di rileggerle qui. Tariffa la legge solo
// l'amministratore, e la scheda la monta solo per lui. null vuol dire che non si
// sono lette: la scheda lo dice, invece di non proporre niente in silenzio;
// finche' la pagina le sta leggendo arriva undefined, cioe' nessuna.
export default function ExtraRaccoltaForm({ open, initial, onSave, onCancel, contesto, interventi = [], tariffePassive = [] }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [fornitori, setFornitori] = useState([]);
  // solo le tariffe passive dell'extra raccolta: la rete non si usa mai al loro
  // posto. Tutte, senza filtro sullo stato (11/10/2026): il filtro
  // { stato: 'attivo' } perdeva le tariffe con lo stato vuoto, che per la
  // passiva valgono; le disattivate le scarta tariffaValeIl.
  const tariffe = tariffePassive || [];
  const tariffeNonLette = tariffePassive === null;
  const [province, setProvince] = useState([]);
  const [tipologie, setTipologie] = useState([]);
  // Da dove viene ciascun costo passivo: 'mano' se l'ha scritto l'utente (o era
  // gia' salvato sulla scheda), 'contratto' se l'ha proposto il modulo da una
  // tariffa di extra raccolta; niente se il campo e' vuoto. Regola dell'utente
  // del 22/09/2026: i costi dell'extra raccolta li scrive lui prima di passare
  // l'intervento a terminato, e il modulo non deve mai sovrascriverli.
  const [origine, setOrigine] = useState({});
  // L'anno della tariffa base proposta nel prezzo attivo, finche' l'utente non lo
  // cambia; null se il prezzo e' suo o se una base non c'e'.
  const [prezzoBase, setPrezzoBase] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const f = await base44.entities.Fornitore.filter({ stato: 'attivo' }, 'ragione_sociale', 500);
        setFornitori(f);
      } catch {}
      // Tutte le province italiane: leggerle dalle primarie ne caricava solo una parte.
      setProvince(Object.keys(PROV_TO_REGION).sort());
      try {
        const r = await base44.entities.ExtraRaccolta.list('-created_date', 5000);
        setTipologie([...new Set(r.map(r => r.tipologia_trasporto).filter(Boolean))].sort());
      } catch {}
    })();
  }, []);

  // Il prezzo che la fattura applicherebbe se sulla scheda non ci fosse un prezzo
  // scritto: prezzoAttivoExtra, la stessa funzione, con le tariffe della pagina.
  const prezzoSenzaScritto = (f) => prezzoAttivoExtra({ ...f, prezzo_attivo_t: 0 }, contesto, giornoProposta(f), annoProposta(f));

  // La tariffa base del prezzo attivo (202 €/t nel 2026, regola dell'utente del
  // 22/09/2026; dall'11/10/2026 prima quella della tabella delle tariffe attive,
  // come in fattura) si propone quando il prezzo e' vuoto, o si riallinea quando
  // era stata proposta e cambiano le date o il movimento. Un prezzo scritto
  // dall'utente non si tocca. Le secondarie non si fatturano: niente base.
  // Non si propone il prezzo di un ALTRO anno, da una tariffa rimasta aperta:
  // scritto sulla scheda diventerebbe un prezzo concordato e l'avviso della
  // fattura sparirebbe; lo si dice sotto il campo. Ne' un prezzo in un'altra
  // unita', che in un campo a tonnellata sarebbe sbagliato.
  // Restituisce { prezzo, anno } da scrivere, oppure null se non si tocca niente.
  const propostaPrezzo = (f, propostoPrima) => {
    const vuoto = !(Number(f.prezzo_attivo_t) > 0);
    if (!vuoto && !propostoPrima) return null;
    const p = prezzoSenzaScritto(f);
    if (p.base && !p.altro_anno && p.fattore === 1000) return { prezzo: p.valore, anno: p.anno_tariffa || p.anno };
    return propostoPrima ? { prezzo: 0, anno: null } : null;
  };
  const rivediPrezzo = (nuovi) => {
    const p = propostaPrezzo({ ...form, ...nuovi }, prezzoBase !== null);
    if (!p) return;
    set('prezzo_attivo_t', p.prezzo);
    setPrezzoBase(p.anno);
  };

  useEffect(() => {
    if (open) {
      const d = { ...EMPTY, ...(initial || {}) };
      // Una scheda gia' salvata senza stato resta senza: lo stato va scelto.
      if (initial?.id) d.stato = String(initial.stato || '').toLowerCase().trim();
      d.ordine_immesso_il = giornoDaData(initial?.ordine_immesso_il);
      d.trasporto_iniziato_il = giornoDaData(initial?.trasporto_iniziato_il);
      d.trasporto_finito_il = giornoDaData(initial?.trasporto_finito_il);
      // I costi gia' salvati sulla scheda sono dell'utente: nessuna proposta li tocca.
      const o = {};
      for (const k of CAMPI_COSTO) if (Number(d[k]) > 0) o[k] = 'mano';
      const p = propostaPrezzo(d, false);
      if (p) d.prezzo_attivo_t = p.prezzo;
      setForm(d);
      setOrigine(o);
      setPrezzoBase(p ? p.anno : null);
      setErrors({});
    }
  }, [open, initial]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Un costo scritto a mano: da qui in poi e' dell'utente. Svuotato, il campo
  // torna libero e una tariffa di extra raccolta puo' riproporlo.
  const scriviCosto = (campo, v) => {
    set(campo, v);
    setOrigine(o => {
      const n = { ...o };
      if (v === '' || v === null) delete n[campo]; else n[campo] = 'mano';
      return n;
    });
  };

  // SMOCO raccoglie anche con i suoi mezzi: va indicata come trasportatore per
  // chiarezza e completezza, anche se non puo' fatturare a se stessa. Nella
  // passiva compare a zero con questa motivazione; qui lo si dice gia' nella
  // scelta, cosi' nessuno si aspetta una fattura.
  const trasportatori = useMemo(
    () => fornitori.filter(f => f.ruolo_raccolta).map(f => ({
      value: f.ragione_sociale,
      label: f.interno ? `${f.ragione_sociale} — interno, non fatturato` : f.ragione_sociale,
    })),
    [fornitori]
  );
  const destinatari = useMemo(
    () => fornitori.filter(f => f.ruolo_trattamento || f.ruolo_stoccaggio).map(f => ({ value: f.ragione_sociale, label: f.ragione_sociale })),
    [fornitori]
  );
  const stoccaggi = useMemo(
    () => fornitori.filter(f => f.ruolo_stoccaggio).map(f => ({ value: f.ragione_sociale, label: f.ragione_sociale })),
    [fornitori]
  );
  const secondaria = form.tipo_movimento === 'secondaria';
  const terminato = form.stato === 'terminato';
  // Vero quando il trasportatore scelto e' interno: la raccolta non si paga.
  // Si ricava dal trasportatore, non si tiene a parte: cosi' e' giusto anche
  // aprendo un ritiro gia' salvato.
  const raccoltaInterna = useMemo(() => {
    if (secondaria || !form.trasportatore) return false;
    const f = fornitori.find(x => normalizzaRagioneSociale(x.ragione_sociale) === normalizzaRagioneSociale(form.trasportatore));
    return !!(f && f.interno);
  }, [fornitori, form.trasportatore, secondaria]);

  // Propone il costo di una prestazione dalla tariffa PASSIVA di EXTRA_RACCOLTA
  // del fornitore, e solo in un campo ancora vuoto o proposto da qui prima: un
  // costo scritto dall'utente non si sovrascrive mai, e la tariffa di RETE non si
  // usa mai (regola dell'utente del 22/09/2026; prima, senza una tariffa di extra
  // raccolta, il modulo ripiegava sulla rete). Un costo proposto per un fornitore
  // che poi si cambia torna vuoto se il nuovo non ha una tariffa.
  // `nuovi` sono i valori appena scelti: set() non ha ancora aggiornato `form`,
  // e leggerli da li' faceva cercare la tariffa con la classe, la data o la
  // destinazione di prima.
  const precompila = (nome, prestazione, nuovi = {}) => {
    const campo = CAMPO_COSTO[prestazione];
    if (!campo) return;
    if (origine[campo] === 'mano') return;
    if (!origine[campo] && Number(form[campo]) > 0) return;
    const scrivi = (valore, da) => {
      set(campo, valore);
      setOrigine(o => { const n = { ...o }; if (da) n[campo] = da; else delete n[campo]; return n; });
    };
    const libera = () => { if (origine[campo] === 'contratto') scrivi(0, null); };
    const f = { ...form, ...nuovi };
    if (!nome || (prestazione === 'RACCOLTA' && f.tipo_movimento === 'secondaria')) { libera(); return; }
    const forn = fornitori.find(x => normalizzaRagioneSociale(x.ragione_sociale) === normalizzaRagioneSociale(nome));
    if (!forn) { libera(); return; }
    // Un trasportatore interno non fattura a SMOCO: il costo di raccolta e' zero.
    // Va scritto esplicitamente, altrimenti resterebbe il costo proposto per il
    // trasportatore scelto prima e la passiva lo conterebbe.
    if (prestazione === 'RACCOLTA' && forn.interno) { scrivi(0, null); return; }
    // La tariffa si sceglie come la sceglie la passiva, e vale come in
    // fatturazione: sul giorno italiano di fine trasporto, o di oggi per un
    // intervento ancora assegnato, e una tariffa con lo stato vuoto conta come
    // attiva (tariffaPassivaProposta di extraRaccoltaCalc.js, 11/10/2026).
    const candidate = tariffaPassivaProposta(tariffe, forn, prestazione, f, oggiRoma());
    if (candidate) scrivi(candidate.valore, 'contratto');
    else libera();
  };

  const prestazioneDestinazione = (tipoDest) => (tipoDest === 'stoc' ? 'CONFERIMENTO_STOCCAGGIO' : 'TRATTAMENTO');

  const onTrasportatoreChange = (v) => {
    set('trasportatore', v);
    precompila(v, 'RACCOLTA', { trasportatore: v });
  };

  // La destinazione decide anche il prezzo della raccolta: si rifanno tutti e due.
  const onDestinatarioChange = (v) => {
    set('destinazione', v);
    if (form.trasportatore) precompila(form.trasportatore, 'RACCOLTA', { destinazione: v });
    precompila(v, prestazioneDestinazione(form.tipo_destinazione), { destinazione: v });
  };

  // Da impianto a stoccaggio (o viceversa) il costo proposto per l'altra
  // prestazione non vale piu': si libera, se non l'ha scritto l'utente.
  const onTipoDestChange = (v) => {
    set('tipo_destinazione', v);
    const prima = CAMPO_COSTO[prestazioneDestinazione(form.tipo_destinazione)];
    if (prima !== CAMPO_COSTO[prestazioneDestinazione(v)] && origine[prima] === 'contratto') {
      set(prima, 0);
      setOrigine(o => { const n = { ...o }; delete n[prima]; return n; });
    }
    if (form.destinazione) precompila(form.destinazione, prestazioneDestinazione(v), { tipo_destinazione: v });
  };

  // Anche la provincia puo' decidere il prezzo della raccolta (cascata per zona).
  const onProvinciaChange = (v) => {
    set('provincia', v);
    if (form.trasportatore) precompila(form.trasportatore, 'RACCOLTA', { provincia: v });
  };

  const onClasseChange = (v) => {
    set('classe', v);
    if (form.trasportatore) precompila(form.trasportatore, 'RACCOLTA', { classe: v });
    if (form.destinazione) precompila(form.destinazione, prestazioneDestinazione(form.tipo_destinazione), { classe: v });
  };

  const onDataFineChange = (v) => {
    set('trasporto_finito_il', v);
    if (form.trasportatore) precompila(form.trasportatore, 'RACCOLTA', { trasporto_finito_il: v });
    if (form.destinazione) precompila(form.destinazione, prestazioneDestinazione(form.tipo_destinazione), { trasporto_finito_il: v });
    rivediPrezzo({ trasporto_finito_il: v });
  };

  const onDataRichiestaChange = (v) => {
    set('ordine_immesso_il', v);
    rivediPrezzo({ ordine_immesso_il: v });
  };

  const onMovimentoChange = (v) => {
    set('tipo_movimento', v);
    if (v === 'secondaria') {
      set('tipo_destinazione', 'imp');
      // una secondaria non ha raccolta: il costo proposto si libera
      if (origine.costo_raccolta_t === 'contratto') {
        set('costo_raccolta_t', 0);
        setOrigine(o => { const n = { ...o }; delete n.costo_raccolta_t; return n; });
      }
    }
    rivediPrezzo({ tipo_movimento: v });
  };

  // Assegnato: la richiesta, con chi la deve evadere e da quando. Terminato: in
  // piu' FIR, peso effettivo e le tre date obbligatorie - immissione (la data
  // della richiesta), inizio e fine trasporto, in quest'ordine - perche' va in
  // fatturazione (regola dell'utente del 22/09/2026: le date di un formulario
  // sono obbligatorie, e si controllano con le regole di movimenti.js).
  const validate = (stato) => {
    const e = {};
    const chiuso = stato === 'terminato';
    if (!stato) e.stato = 'Scegli lo stato';
    if (form.tipo_movimento === 'secondaria') {
      if (!form.stoccaggio) e.stoccaggio = 'Obbligatorio';
      if (chiuso && !form.destinazione) e.destinazione = 'Obbligatorio';
    } else if (!form.produttore) {
      e.produttore = 'Obbligatorio';
    }
    if (!form.classe) e.classe = 'Obbligatorio';
    if (stato === 'assegnato') {
      if (!form.ordine_immesso_il) e.ordine_immesso_il = 'Obbligatoria';
      if (!form.trasportatore) e.trasportatore = 'Obbligatorio';
    }
    if (chiuso) {
      if (!form.numero_fir) e.numero_fir = 'Obbligatorio';
      if (!form.peso_effettivo || Number(form.peso_effettivo) <= 0) e.peso_effettivo = 'Maggiore di zero';
      const conDate = {
        stato: 'terminato',
        ordine_immesso_il: dataDaGiorno(form.ordine_immesso_il),
        trasporto_iniziato_il: dataDaGiorno(form.trasporto_iniziato_il),
        trasporto_finito_il: dataDaGiorno(form.trasporto_finito_il),
      };
      const mancanti = dateMancanti(conDate);
      for (const d of DATE_OBBLIGATORIE) {
        if (mancanti.includes(d.nome)) e[d.campo] = `Obbligatoria per un terminato: manca la data di ${d.nome}`;
      }
      if (mancanti.length || dateIncoerenti(conDate).length) {
        e.date = `Un intervento terminato ha bisogno delle date di immissione (la data della richiesta), inizio e fine trasporto, in quest'ordine: ${testoDate(conDate)}.`;
      }
    } else if (form.peso_effettivo !== '' && form.peso_effettivo !== null && Number(form.peso_effettivo) < 0) {
      e.peso_effettivo = 'Non negativo';
    }
    if (serveNoteCosti(form) && !form.note_costi)
      e.note_costi = 'Obbligatorio quando c\'è un sovracosto pagato al raccoglitore o all\'impianto, un costo di pulizia o costi aggiuntivi: scrivi perché quel costo c\'è';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = () => {
    if (!validate(form.stato)) return;
    let stato = form.stato;
    if (stato === 'assegnato' && datiChiusuraCompleti(form)
      && window.confirm('Hai inserito FIR, peso effettivo e le date di immissione, inizio e fine trasporto. Segnare l\'intervento come terminato? Solo i terminati vanno in fatturazione.')) {
      stato = 'terminato';
      // Da terminato servono anche le date: se ne manca una la scheda resta
      // aperta, gia' su terminato, con l'errore sotto il campo.
      if (!validate(stato)) { set('stato', stato); return; }
    }
    // Lo stesso formulario gia' su un altro intervento (A40, 12/10/2026): si
    // chiede prima di salvare, dicendo dove. `interventi` e' l'elenco che la
    // pagina ha letto e rilegge dopo ogni salvataggio.
    const stessoFir = interventiConStessoFir(interventi, form.numero_fir, initial?.id);
    if (stessoFir.length && !window.confirm(domandaFirGiaPresente(form.numero_fir, stessoFir))) return;
    const p = { ...form, stato };
    ['peso_effettivo', 'prezzo_attivo_t', 'sovracosto_raccolta', 'sovracosto_trasporto', 'sovracosto_trattamento',
     'costo_raccolta_t', 'costo_trasporto_viaggio', 'costo_stoccaggio_t', 'costo_trattamento_t',
     'sovracosto_pagato_raccoglitore', 'sovracosto_pagato_impianto',
     'costo_pulizia', 'costi_aggiuntivi'].forEach(k => {
      p[k] = Number(p[k]) || 0;
    });
    p.ordine_immesso_il = dataDaGiorno(form.ordine_immesso_il);
    p.trasporto_iniziato_il = dataDaGiorno(form.trasporto_iniziato_il);
    p.trasporto_finito_il = dataDaGiorno(form.trasporto_finito_il);
    // Competenza dalla fine trasporto; per una richiesta ancora aperta dalla data della richiesta.
    Object.assign(p, competenza(form.trasporto_finito_il || form.ordine_immesso_il));
    if (!p.id_ordine) p.id_ordine = p.numero_fir || `ER-${Date.now()}`;
    // In una secondaria il soggetto da cui parte il carico e' lo stoccaggio, e
    // un costo di raccolta non c'e': una secondaria non e' una raccolta, si paga
    // come trasporto di secondaria (decisione dell'utente del 13/10/2026).
    if (p.tipo_movimento === 'secondaria') { p.produttore = p.stoccaggio; p.costo_raccolta_t = 0; }
    else p.stoccaggio = '';
    onSave(p);
  };

  // Sotto un costo: da dove viene. Il modulo propone solo tariffe di extra raccolta.
  const daDove = (campo) => (origine[campo] === 'contratto'
    ? <p className="text-xs text-success">dalla tariffa di extra raccolta del fornitore</p>
    : null);

  const calc = calcExtraRaccolta(form, contesto);

  // IL TRASPORTO DI UNA SECONDARIA (13/10/2026). E' un trasporto di secondaria
  // come gli altri: si paga con la tariffa della tratta nel contratto del
  // vettore, a tonnellata o a viaggio, e il prezzo scritto qui vale solo per una
  // tratta senza contratto (decisione dell'utente del 13/10/2026). Sotto il
  // campo si dice quale dei due la passiva paga. Senza la fine del trasporto si
  // guarda il contratto in vigore oggi: vale quello del giorno in cui finira'.
  const trasportoQui = form.trasporto_finito_il ? calc.trasporto : trasportoIntervento({ ...form, trasporto_finito_il: oggiRoma() }, contesto);
  // A viaggio, lo stesso camion nello stesso giorno sulla stessa tratta si paga
  // una volta (revisione del 14/10/2026): se porta anche altri interventi, la
  // scheda dice quali e la quota di questo, divisa per peso come in passiva.
  const viaggioQui = trasportoQui.viaggio;
  const tratta = `${form.stoccaggio || '—'} → ${form.destinazione || '—'}`;
  let testoTrasporto = null;
  if (secondaria) {
    if (trasportoQui.interno) {
      testoTrasporto = <p className="text-xs text-muted-foreground">trasportatore interno: il trasporto non si fattura</p>;
    } else if (trasportoQui.origine === 'contratto') {
      const t = trasportoQui.tariffa;
      testoTrasporto = (
        <p className="text-xs text-success">
          {form.trasporto_finito_il ? '' : 'oggi '}dal contratto di {trasportoQui.fornitore} per la tratta {tratta}{t && t.tipologia === 'TUTTE' ? ' (tariffa TUTTE)' : ''}: {formatNumber(trasportoQui.valore)} {trasportoQui.unita_misura}{trasportoQui.unita_misura !== '€/viaggio' ? ` = ${euro(trasportoQui.importo)}` : ''}
          {viaggioQui ? `. Lo stesso viaggio (${viaggioQui.targa ? `camion ${viaggioQui.targa}` : 'senza targa'}, ${giornoIt(viaggioQui.giorno)}) porta anche ${viaggioQui.altri.join(', ')}: il viaggio si paga una volta, diviso per peso, qui ${tonn(viaggioQui.kg)} t delle ${tonn(viaggioQui.kg_viaggio)} = ${euro(trasportoQui.importo)}` : ''}
          {trasportoQui.scritto > 0 ? `. Il prezzo scritto qui (${euro(trasportoQui.scritto)}) non si paga: vale il contratto` : ''}
        </p>
      );
    } else if (trasportoQui.non_letto) {
      testoTrasporto = <p className="text-xs text-amber-700">i contratti dei trasporti non sono stati letti: la passiva paga la tariffa della tratta, se c&apos;è, e il prezzo scritto qui solo senza contratto</p>;
    } else if (trasportoQui.origine === 'intervento') {
      testoTrasporto = <p className="text-xs text-muted-foreground">la tratta {tratta} non ha un contratto di trasporto: si paga il prezzo scritto qui, una volta per il viaggio</p>;
    } else {
      testoTrasporto = <p className="text-xs text-amber-700">la tratta {tratta} non ha un contratto di trasporto: scrivi il prezzo del viaggio, altrimenti il trasferimento non si paga a nessuno</p>;
    }
  }

  // Sotto il prezzo attivo: da dove viene, lo stesso che dira' la fattura, con lo
  // stesso avviso quando il prezzo e' di un altro anno.
  const annoPrezzo = annoProposta(form);
  const senzaScritto = prezzoSenzaScritto(form);
  let testoPrezzo = null;
  if (prezzoBase !== null) testoPrezzo = <p className="text-xs text-success">tariffa base Ecotyre {prezzoBase}: {formatNumber(Number(form.prezzo_attivo_t) || 0)} €/t</p>;
  else if (secondaria) testoPrezzo = <p className="text-xs text-muted-foreground">una secondaria non si fattura a Ecotyre: il ricavo sta sulla raccolta</p>;
  else if (!(Number(form.prezzo_attivo_t) > 0)) {
    if (senzaScritto.altro_anno) {
      testoPrezzo = <p className="text-xs text-amber-700" title={senzaScritto.nota}>vuoto: in fattura vale la tariffa del {senzaScritto.anno_tariffa} ({formatNumber(senzaScritto.valore)} {senzaScritto.unita}), rimasta aperta: è il prezzo del {senzaScritto.anno_tariffa}, non del {annoPrezzo}. Scrivi il prezzo concordato per questa campagna.</p>;
    } else if (senzaScritto.valore) {
      testoPrezzo = <p className="text-xs text-muted-foreground" title={senzaScritto.nota}>vuoto: in fattura vale la tariffa base Ecotyre {senzaScritto.anno_tariffa || annoPrezzo} ({formatNumber(senzaScritto.valore)} {senzaScritto.unita})</p>;
    } else {
      testoPrezzo = <p className="text-xs text-amber-700">per il {annoPrezzo} non c&apos;è una tariffa base Ecotyre: scrivi il prezzo</p>;
    }
  }
  // Il ricavo del riepilogo e' quello della fattura: una secondaria e un
  // intervento senza peso effettivo non si fatturano, e lo si dice invece di
  // scrivere zero euro.
  const ricavoNonFatturato = !calc.fatturato
    ? (secondaria ? 'una secondaria non si fattura a Ecotyre' : 'manca il peso effettivo: senza, non si fattura')
    : '';

  // Il surplus (13/10/2026): la quota di questo intervento, con le regole della
  // fattura e della passiva (calcExtraRaccolta). Se la fine del trasporto non
  // c'e' ancora, si dice quali surplus dell'extra raccolta varrebbero e quando:
  // il periodo lo decide il giorno di fine trasporto, non la richiesta.
  const conSurplus = calc.surplus_attivo.length > 0 || calc.surplus_passivo.length > 0;
  // Una secondaria non e' una raccolta e non si fattura a Ecotyre: per lei
  // valgono solo i surplus di trattamento, stoccaggio e trasporto, e solo la
  // parte ai fornitori.
  const daEcotyre = (s) => !secondaria && Number(s.euro_t_attiva) > 0;
  const surplusPossibili = !form.trasporto_finito_il
    ? ((contesto && contesto.surplus) || []).filter(s => statoSurplus(s) !== 'concluso'
      && !(secondaria && String(s.prestazione || '').toUpperCase() === 'RACCOLTA')
      && (daEcotyre(s) || Number(s.euro_t_passiva) > 0))
    : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Modifica intervento' : 'Nuovo intervento Extra Raccolta'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* GRUPPO Intervento */}
          <fieldset className="border rounded-lg p-3">
            <legend className="text-sm font-semibold px-1">Intervento</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stato *</Label>
                <Select value={form.stato || undefined} onValueChange={v => set('stato', v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Scegli..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assegnato">Assegnato: da evadere</SelectItem>
                    <SelectItem value="terminato">Terminato: evaso</SelectItem>
                  </SelectContent>
                </Select>
                {errors.stato && <p className="text-xs text-destructive">{errors.stato}</p>}
                <p className="text-xs text-muted-foreground">Solo i terminati vanno in fatturazione</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data richiesta{form.stato === 'assegnato' || terminato ? ' *' : ''}</Label>
                <Input type="date" className="h-9 text-sm" value={form.ordine_immesso_il} onChange={e => onDataRichiestaChange(e.target.value)} />
                {errors.ordine_immesso_il && <p className="text-xs text-destructive">{errors.ordine_immesso_il}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nr. FIR{terminato ? ' *' : ''}</Label>
                <Input className="h-9 text-sm" value={form.numero_fir} onChange={e => set('numero_fir', e.target.value)} />
                {errors.numero_fir && <p className="text-xs text-destructive">{errors.numero_fir}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Movimento *</Label>
                <Select value={form.tipo_movimento || 'primaria'} onValueChange={onMovimentoChange}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primaria">Primaria: raccolta</SelectItem>
                    <SelectItem value="secondaria">Secondaria: da stoccaggio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipologia trasporto</Label>
                <Input className="h-9 text-sm" list="tipologie-list" value={form.tipologia_trasporto} onChange={e => set('tipologia_trasporto', e.target.value)} placeholder="es. PFU ZERO - MAREVIVO" />
                <datalist id="tipologie-list">{tipologie.map(t => <option key={t} value={t} />)}</datalist>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data inizio trasporto{terminato ? ' *' : ''}</Label>
                <Input type="date" className="h-9 text-sm" value={form.trasporto_iniziato_il} onChange={e => set('trasporto_iniziato_il', e.target.value)} />
                {errors.trasporto_iniziato_il && <p className="text-xs text-destructive">{errors.trasporto_iniziato_il}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data fine trasporto{terminato ? ' *' : ''}</Label>
                <Input type="date" className="h-9 text-sm" value={form.trasporto_finito_il} onChange={e => onDataFineChange(e.target.value)} />
                {errors.trasporto_finito_il && <p className="text-xs text-destructive">{errors.trasporto_finito_il}</p>}
                <p className="text-xs text-muted-foreground">Determina il mese di competenza</p>
              </div>
            </div>
            {/* Le tre date di un terminato, dette tutte insieme: quali mancano e quali sono fuori ordine */}
            {errors.date && <p className="mt-2 text-xs text-destructive">{errors.date}</p>}
          </fieldset>

          {/* GRUPPO Soggetti */}
          <fieldset className="border rounded-lg p-3">
            <legend className="text-sm font-semibold px-1">Soggetti</legend>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              {secondaria ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Stoccaggio di partenza *</Label>
                  <ComboSelect value={form.stoccaggio} onChange={v => set('stoccaggio', v)} options={stoccaggi} placeholder="Seleziona..." />
                  {errors.stoccaggio && <p className="text-xs text-destructive">{errors.stoccaggio}</p>}
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Produttore *</Label>
                  <Input className="h-9 text-sm" value={form.produttore} onChange={e => set('produttore', e.target.value)} placeholder="Ente esterno" />
                  {errors.produttore && <p className="text-xs text-destructive">{errors.produttore}</p>}
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Trasportatore{form.stato === 'assegnato' ? ' *' : ''}</Label>
                <ComboSelect value={form.trasportatore} onChange={onTrasportatoreChange} options={trasportatori} placeholder="Seleziona..." />
                {errors.trasportatore && <p className="text-xs text-destructive">{errors.trasportatore}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Destinatario{secondaria && terminato ? ' *' : ''}</Label>
                <ComboSelect value={form.destinazione} onChange={onDestinatarioChange} options={destinatari} placeholder="Seleziona..." />
                {errors.destinazione && <p className="text-xs text-destructive">{errors.destinazione}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo destinazione</Label>
                <Select value={form.tipo_destinazione} onValueChange={onTipoDestChange}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imp">Impianto (trattamento)</SelectItem>
                    <SelectItem value="stoc">Stoccaggio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Provincia</Label>
                <Select value={form.provincia || undefined} onValueChange={onProvinciaChange}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {province.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Automezzo</Label>
                <Input className="h-9 text-sm" value={form.automezzo} onChange={e => set('automezzo', e.target.value)} />
                <p className="text-xs text-muted-foreground">Serve al conteggio viaggi se tariffa a viaggio</p>
              </div>
            </div>
          </fieldset>

          {/* GRUPPO Merce */}
          <fieldset className="border rounded-lg p-3">
            <legend className="text-sm font-semibold px-1">Merce</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">CER</Label>
                <Input className="h-9 text-sm" value={form.cer} onChange={e => set('cer', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Classe *</Label>
                <Select value={form.classe || undefined} onValueChange={onClasseChange}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {CLASSI.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.classe && <p className="text-xs text-destructive">{errors.classe}</p>}
                <p className="text-xs text-muted-foreground">Solo RETE: PFU Autodemolizione non ammessa</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-muted-foreground">Peso effettivo in kg{terminato ? ' *' : ''}</Label>
                <Input type="number" className="h-9 text-sm" value={form.peso_effettivo} onChange={e => set('peso_effettivo', e.target.value)} />
                {errors.peso_effettivo && <p className="text-xs text-destructive">{errors.peso_effettivo}</p>}
              </div>
            </div>
          </fieldset>

          {/* GRUPPO Prezzi e costi */}
          <fieldset className="border rounded-lg p-3">
            <legend className="text-sm font-semibold px-1">Prezzi e costi</legend>

            {/* I DUE INSIEMI DI SOVRACOSTI VANNO TENUTI SEPARATI A VISTA. Nella
                scheda ci sono tre sovracosti che si aggiungono a quello che SMOCO
                FATTURA a Ecotyre (sono ricavo) e due sovracosti che SMOCO PAGA a
                un fornitore (sono costo, e sono nati con la precisazione
                dell'utente del 03/10/2026). I nomi si somigliano troppo: scritto
                nel posto sbagliato, lo stesso importo sposta il margine del doppio
                e nella direzione opposta. Percio' il gruppo e' diviso in tre
                blocchi con un titolino - entrate, uscite, oneri senza padrone - e
                ogni sovracosto dice sotto a chi si paga. La regola per
                riconoscerli: i sovracosti del ricavo portano il nome della
                PRESTAZIONE (raccolta, trasporto, trattamento), quelli pagati il
                nome di CHI LI INCASSA (il raccoglitore, l'impianto). */}
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-success">Entrate: quello che SMOCO fattura a Ecotyre</p>
            <p className="text-xs text-muted-foreground">
              I tre sovracosti di questo blocco portano il nome della prestazione e si aggiungono al ricavo della fattura attiva: non si pagano a nessun fornitore.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prezzo attivo (€/t)</Label>
                <Input type="number" className="h-9 text-sm" value={form.prezzo_attivo_t} onChange={e => { set('prezzo_attivo_t', e.target.value); setPrezzoBase(null); }} />
                {testoPrezzo}
              </div>
              <NumField label="Sovracosto raccolta (€)" value={form.sovracosto_raccolta} onChange={v => set('sovracosto_raccolta', v)} />
              <NumField label="Sovracosto trasporto (€)" value={form.sovracosto_trasporto} onChange={v => set('sovracosto_trasporto', v)} />
              <NumField label="Sovracosto trattamento (€)" value={form.sovracosto_trattamento} onChange={v => set('sovracosto_trattamento', v)} />
            </div>
            {/* Il surplus che SMOCO fattura a Ecotyre su questo intervento: una
                riga sua in fattura, sulle stesse tonnellate. */}
            {calc.surplus_attivo.map(v => (
              <RigaSurplus key={`a-${v.chiave}`}>
                <strong className="italic text-foreground">{v.nome}</strong>{v.origine ? ` · ${v.origine}` : ''} · <strong>+{testoEuroT(v.euro_t)}</strong> da Ecotyre, {periodoSurplus({ data_inizio_validita: v.dal, data_fine_validita: v.al })}: <strong>{euro(v.importo)}</strong> su {tonn(v.kg)} t{v.fornitore ? `, ${PER_CHI[v.prestazione] || 'per il raccoglitore'} ${v.fornitore}` : ''}
              </RigaSurplus>
            ))}
            {surplusPossibili.map(s => (
              <p key={`p-${s.id || s.nome}`} className="mt-2 text-xs text-muted-foreground">
                Se il trasporto finisce {fraIl(s)} vale anche {String(s.nome || '').trim() || 'un surplus'}:
                {daEcotyre(s) ? ` +${testoEuroT(s.euro_t_attiva)} da Ecotyre` : ''}
                {daEcotyre(s) && Number(s.euro_t_passiva) > 0 ? ' e' : ''}
                {Number(s.euro_t_passiva) > 0 ? ` +${testoEuroT(s.euro_t_passiva)} ai ${DESTINATARI[String(s.prestazione || '').toUpperCase()] || 'fornitori'}` : ''}, sulle stesse tonnellate.
              </p>
            ))}

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-destructive">Uscite: quello che SMOCO paga ai fornitori</p>
            <p className="text-xs text-muted-foreground">
              I due sovracosti di questo blocco portano il nome di chi li incassa — il raccoglitore o l&apos;impianto — e la fatturazione passiva li paga a quel fornitore: sono costo, non ricavo.
            </p>
            {/* Prima riga le tre voci del trasportatore, seconda riga le due della
                destinazione: ogni sovracosto pagato sta accanto alle voci dello
                stesso fornitore, cosi' si vede subito chi lo incassa. */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              {/* Una secondaria non e' una raccolta (decisione dell'utente del
                  13/10/2026): il campo si chiude e al salvataggio vale zero; la
                  passiva il costo di raccolta di una secondaria non lo paga. */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Costo raccolta (€/t)</Label>
                <Input type="number" className="h-9 text-sm" disabled={secondaria} value={secondaria ? '' : form.costo_raccolta_t} onChange={e => scriviCosto('costo_raccolta_t', e.target.value)} />
                {secondaria
                  ? <p className="text-xs text-muted-foreground">una secondaria non è una raccolta: si paga il trasporto</p>
                  : daDove('costo_raccolta_t')}
                {raccoltaInterna && <p className="text-xs text-muted-foreground">trasportatore interno: non fatturato</p>}
              </div>
              {/* L'altro costo del trasportatore, accanto a quello di raccolta: il
                  viaggio di questo intervento. E' un importo fisso in euro, non un
                  prezzo a tonnellata, perche' un intervento di extra raccolta e' un
                  viaggio solo e si paga una volta - come la colonna «PREZZO
                  (Euro/viaggio)» del foglio dell'amministrazione, che prima nel
                  gestionale non aveva nessun campo. Nessuna tariffa lo propone:
                  non c'e' un listino a viaggio per l'extra raccolta, lo scrive
                  l'amministratore insieme agli altri costi. */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Costo trasporto (€/viaggio)</Label>
                <Input type="number" className="h-9 text-sm" value={form.costo_trasporto_viaggio} onChange={e => set('costo_trasporto_viaggio', e.target.value)} />
                {secondaria ? testoTrasporto : <p className="text-xs text-muted-foreground">Importo fisso per il viaggio, non a tonnellata</p>}
                {raccoltaInterna && <p className="text-xs text-muted-foreground">trasportatore interno: non fatturato</p>}
              </div>
              {/* Il sovracosto che si paga al RACCOGLITORE, cioe' al trasportatore
                  dell'intervento: i costi imprevisti che ha sostenuto nella
                  raccolta. L'utente, 03/10/2026: «quando ad esempio ha dovuto
                  sostenere costi imprevisti nella raccolta per diverse ragioni».
                  Nessuna tariffa lo propone - un imprevisto non sta in nessun
                  listino - e la nota sotto dice a chi si paga, perche' il nome da
                  solo si confonde con «Sovracosto raccolta» del blocco delle
                  entrate. */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sovracosto raccoglitore (€)</Label>
                <Input type="number" className="h-9 text-sm" value={form.sovracosto_pagato_raccoglitore} onChange={e => set('sovracosto_pagato_raccoglitore', e.target.value)} />
                <p className="text-xs text-muted-foreground">Si paga al raccoglitore, cioè al trasportatore: importo fisso, non a tonnellata</p>
                {raccoltaInterna && <p className="text-xs text-muted-foreground">trasportatore interno: non fatturato</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Costo stoccaggio (€/t)</Label>
                <Input type="number" className="h-9 text-sm" value={form.costo_stoccaggio_t} onChange={e => scriviCosto('costo_stoccaggio_t', e.target.value)} />
                {daDove('costo_stoccaggio_t')}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Costo trattamento (€/t)</Label>
                <Input type="number" className="h-9 text-sm" value={form.costo_trattamento_t} onChange={e => scriviCosto('costo_trattamento_t', e.target.value)} />
                {daDove('costo_trattamento_t')}
              </div>
              {/* Il sovracosto che si paga all'IMPIANTO di destinazione, quello che
                  deve lavorare i PFU. L'utente, 03/10/2026: «per l'impianto di
                  conferimento che li deve lavorare (trattare\triturare) per
                  diversi motivi (ad esempio costi non previsti sostenuti per la
                  pulizia di pfu sporchi prima del trattamento)». Sta accanto al
                  costo di trattamento perche' lo incassa lo stesso fornitore, e la
                  nota lo distingue da «Sovracosto trattamento» del blocco delle
                  entrate. */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sovracosto impianto (€)</Label>
                <Input type="number" className="h-9 text-sm" value={form.sovracosto_pagato_impianto} onChange={e => set('sovracosto_pagato_impianto', e.target.value)} />
                <p className="text-xs text-muted-foreground">Si paga all&apos;impianto di destinazione, che deve trattare o triturare: importo fisso, non a tonnellata</p>
              </div>
            </div>
            {/* Il surplus che SMOCO paga al fornitore su questo intervento: una
                riga sua nella passiva del mese. Un fornitore interno non lo
                riceve, e si dice. */}
            {calc.surplus_passivo.map(v => (
              <RigaSurplus key={`p-${v.chiave}-${v.prestazione}-${v.fornitore_chiave}`}>
                <strong className="italic text-foreground">{v.nome}</strong> · <strong>+{testoEuroT(v.euro_t)}</strong> {A_CHI[v.prestazione] || 'al fornitore'}
                {v.interno
                  ? `: niente, ${v.fornitore} è interno e a se stessa SMOCO non fattura`
                  : <> {v.fornitore}: <strong>{euro(v.importo)}</strong> su {tonn(v.kg)} t</>}
              </RigaSurplus>
            ))}
            <p className="mt-2 text-xs text-muted-foreground">
              I costi di raccolta, trasporto, stoccaggio e trattamento sono quelli scritti qui, e la fatturazione passiva paga questi. Il modulo propone solo i costi a tonnellata, dalle tariffe di extra raccolta del fornitore e solo nei campi vuoti; il costo del trasporto a viaggio e i due sovracosti si scrivono sempre a mano, perché un listino a viaggio per l&apos;extra raccolta non c&apos;è e un imprevisto non sta in nessuna tariffa. Una secondaria fa eccezione: è un trasporto di secondaria come gli altri e si paga con la tariffa della tratta nel contratto del vettore, a tonnellata o a viaggio; il prezzo scritto qui vale solo per una tratta senza contratto. Va scritto tutto prima di passare l&apos;intervento a terminato.
            </p>
            {tariffeNonLette && (
              <p className="mt-1 text-xs text-amber-700">Le tariffe passive dell&apos;extra raccolta non si sono potute leggere: il modulo non propone i costi, scrivili a mano o ricarica la pagina.</p>
            )}

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Oneri senza un fornitore a cui fatturarli</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <NumField label="Costo pulizia (€)" value={form.costo_pulizia} onChange={v => set('costo_pulizia', v)} />
              <NumField label="Costi aggiuntivi (€)" value={form.costi_aggiuntivi} onChange={v => set('costi_aggiuntivi', v)} />
            </div>
            {/* Questi due campi restano come erano: sono i dati degli interventi
                passati e non si toccano. Non hanno un padrone, e la fatturazione
                passiva continua a dichiararli senza pagarli a nessuno. Dal
                03/10/2026 un onere che spetta al raccoglitore o all'impianto ha il
                suo posto nel sovracosto giusto, e allora la passiva lo paga. */}
            <p className="mt-2 text-xs text-muted-foreground">
              Sono oneri che non si attribuiscono a nessun fornitore: la fatturazione passiva non sa a chi fatturarli e lo segnala senza pagarli. Se quell&apos;onere spetta al raccoglitore o all&apos;impianto, va scritto nel sovracosto giusto del blocco delle uscite, e allora la passiva lo paga al fornitore.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Note costi {serveNoteCosti(form) ? '*' : ''}</Label>
                <Input className="h-9 text-sm" value={form.note_costi} onChange={e => set('note_costi', e.target.value)} />
                {errors.note_costi && <p className="text-xs text-destructive">{errors.note_costi}</p>}
                <p className="text-xs text-muted-foreground">Perché quel costo c&apos;è: obbligatorio per i due sovracosti pagati, la pulizia e i costi aggiuntivi. Finisce nelle note del foglio dell&apos;amministrazione</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Note</Label>
                <Input className="h-9 text-sm" value={form.note} onChange={e => set('note', e.target.value)} />
              </div>
            </div>
          </fieldset>

          {/* Riepilogo in tempo reale */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 border-2 rounded-lg bg-muted/30">
            <div>
              <div className="text-xs text-muted-foreground">Ricavo</div>
              {ricavoNonFatturato
                ? <div className="text-base font-bold tabular-nums text-muted-foreground" title={secondaria ? '' : avvisoPesoMancante(form)}>—<span className="block text-[11px] font-normal">{ricavoNonFatturato}</span></div>
                : <div className="text-base font-bold tabular-nums">€ {formatNumber(calc.ricavo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
              {calc.surplus_ricavo > 0 && <div className="text-[11px] text-muted-foreground tabular-nums">di cui surplus {euro(calc.surplus_ricavo)}</div>}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Costo totale</div>
              <div className="text-base font-bold tabular-nums">€ {formatNumber(calc.costo_totale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              {calc.surplus_costo > 0 && <div className="text-[11px] text-muted-foreground tabular-nums">di cui surplus {euro(calc.surplus_costo)}</div>}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Margine</div>
              <div className={`text-base font-bold tabular-nums ${calc.margine >= 0 ? 'text-success' : 'text-destructive'}`}>
                € {formatNumber(calc.margine, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Margine %</div>
              <div className={`text-base font-bold tabular-nums ${calc.margine >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatNumber(calc.margine_perc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
              </div>
            </div>
          </div>
          {/* Il centesimo del surplus e' quello del mese (13/10/2026): fattura e
              passiva lo arrotondano una volta sulle tonnellate del mese, qui c'e'
              la quota dell'intervento, e si dice. */}
          {conSurplus && (
            <p className="-mt-3 text-xs text-muted-foreground">
              Il surplus qui è la quota di questo intervento. In fattura e in passiva si calcola una volta sul mese, sulle tonnellate di tutti gli interventi del mese: il centesimo che fa fede è quello del mese.
            </p>
          )}
        </div>

        {/* Chi ha cambiato un costo o un prezzo di questo intervento, quando e
            da quanto a quanto (11/10/2026). I costi li vede solo l'amministratore. */}
        {initial?.id && <StoricoModifiche entita="ExtraRaccolta" recordId={initial.id} />}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Annulla</Button>
          <Button onClick={save}><Save className="w-4 h-4 mr-1.5" /> Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}