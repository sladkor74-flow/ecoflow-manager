import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Save, ChevronLeft } from 'lucide-react';
import { calcExtraRaccolta, tariffaBaseExtraRaccolta, annoIntervento } from '@/lib/extraRaccoltaCalc';
import { PROV_TO_REGION } from '@/lib/regioneMap';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { formatNumber } from '@/lib/utils';
import { giornoDaData, dataDaGiorno, competenza, datiChiusuraCompleti } from '@/lib/extraRaccoltaStato';
import { oggiRoma } from '@/lib/giornoItaliano';
import { DATE_OBBLIGATORIE, dateMancanti, dateIncoerenti, testoDate } from '@/lib/movimenti';

const CLASSI = ['P', 'M', 'G1', 'G2'];

// Il campo del costo di ogni prestazione passiva, sull'intervento.
const CAMPO_COSTO = { RACCOLTA: 'costo_raccolta_t', TRATTAMENTO: 'costo_trattamento_t', CONFERIMENTO_STOCCAGGIO: 'costo_stoccaggio_t' };
const CAMPI_COSTO = Object.values(CAMPO_COSTO);

const EMPTY = {
  stato: 'assegnato', ordine_immesso_il: '',
  numero_fir: '', tipologia_trasporto: '', tipo_movimento: 'primaria', stoccaggio: '',
  trasporto_iniziato_il: '', trasporto_finito_il: '',
  produttore: '', trasportatore: '', destinazione: '', tipo_destinazione: 'imp',
  provincia: '', automezzo: '',
  cer: '160103', classe: '', peso_effettivo: '',
  prezzo_attivo_t: 0, sovracosto_raccolta: 0, sovracosto_trasporto: 0, sovracosto_trattamento: 0,
  costo_raccolta_t: 0, costo_stoccaggio_t: 0, costo_trattamento_t: 0,
  costo_pulizia: 0, costi_aggiuntivi: 0, note_costi: '', note: '',
};


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

export default function ExtraRaccoltaForm({ open, initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [fornitori, setFornitori] = useState([]);
  const [tariffe, setTariffe] = useState([]);
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
      try {
        // solo le tariffe passive dell'extra raccolta: la rete non si usa mai al loro posto
        const t = await base44.entities.Tariffa.filter({ direzione: 'PASSIVA', tipologia: 'EXTRA_RACCOLTA', stato: 'attivo' }, '-created_date', 2000);
        setTariffe(t);
      } catch {}
      // Tutte le province italiane: leggerle dalle primarie ne caricava solo una parte.
      setProvince(Object.keys(PROV_TO_REGION).sort());
      try {
        const r = await base44.entities.ExtraRaccolta.list('-created_date', 5000);
        setTipologie([...new Set(r.map(r => r.tipologia_trasporto).filter(Boolean))].sort());
      } catch {}
    })();
  }, []);

  // La tariffa base del prezzo attivo (202 €/t nel 2026, regola dell'utente del
  // 22/09/2026) si propone quando il prezzo e' vuoto, o si riallinea quando era
  // stata proposta e cambiano le date o il movimento. Un prezzo scritto
  // dall'utente non si tocca. Le secondarie non si fatturano: niente base.
  // Restituisce { prezzo, anno } da scrivere, oppure null se non si tocca niente.
  const propostaPrezzo = (f, propostoPrima) => {
    const vuoto = !(Number(f.prezzo_attivo_t) > 0);
    if (!vuoto && !propostoPrima) return null;
    const anno = annoProposta(f);
    const base = f.tipo_movimento === 'secondaria' ? null : tariffaBaseExtraRaccolta(anno);
    if (base) return { prezzo: base, anno };
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
    // La validita' si guarda sul giorno di fine trasporto; per un intervento
    // ancora assegnato, che non ce l'ha, su oggi in Italia (non sul giorno UTC).
    const data = f.trasporto_finito_il || oggiRoma();
    const valida = (t) => {
      const suo = t.fornitore_id === forn.id || normalizzaRagioneSociale(t.fornitore_nome) === normalizzaRagioneSociale(forn.ragione_sociale);
      if (!suo || t.prestazione !== prestazione || t.direzione !== 'PASSIVA' || t.stato !== 'attivo') return false;
      if (t.tipologia !== 'EXTRA_RACCOLTA') return false;
      const inizio = String(t.data_inizio_validita || '').slice(0, 10);
      const fine = String(t.data_fine_validita || '').slice(0, 10);
      if (inizio && data < inizio) return false;
      if (fine && data > fine) return false;
      if (t.classe_materiale && t.classe_materiale !== f.classe) return false;
      return true;
    };
    const vuoto = (s) => !String(s || '').trim();
    const maiuscolo = (s) => String(s || '').trim().toUpperCase();
    const perClasse = (c) => c.find(t => t.classe_materiale) || c[0] || null;
    // La scelta di passivaCalcolo: per la raccolta la cascata di
    // findTariffaRaccolta - destinazione, provincia, regione, generica. Prendere
    // la prima tariffa del fornitore precompilava, per Emmesse, i 72 euro di
    // Gatim su un ritiro scaricato a Irigom, che ne costa 90. Per impianti e
    // stoccaggi, come findTariffaImpianto, conta solo la classe. A parita' di
    // livello vince quella per classe sulla generica.
    const scegli = () => {
      const c = tariffe.filter(valida);
      if (prestazione !== 'RACCOLTA') return perClasse(c);
      const dest = vuoto(f.destinazione) ? '' : normalizzaRagioneSociale(f.destinazione);
      const prov = maiuscolo(f.provincia);
      const reg = maiuscolo(PROV_TO_REGION[prov]);
      const livelli = [
        dest ? c.filter(t => !vuoto(t.destinazione) && normalizzaRagioneSociale(t.destinazione) === dest) : [],
        prov ? c.filter(t => vuoto(t.destinazione) && maiuscolo(t.provincia) === prov) : [],
        reg ? c.filter(t => vuoto(t.destinazione) && vuoto(t.provincia) && maiuscolo(t.regione) === reg) : [],
        c.filter(t => vuoto(t.destinazione) && vuoto(t.provincia) && vuoto(t.regione)),
      ];
      for (const l of livelli) { const m = perClasse(l); if (m) return m; }
      return null;
    };
    const candidate = scegli();
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
    if ((Number(form.costo_pulizia) > 0 || Number(form.costi_aggiuntivi) > 0) && !form.note_costi)
      e.note_costi = 'Obbligatorio quando costo pulizia o costi aggiuntivi > 0';
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
    const p = { ...form, stato };
    ['peso_effettivo', 'prezzo_attivo_t', 'sovracosto_raccolta', 'sovracosto_trasporto', 'sovracosto_trattamento',
     'costo_raccolta_t', 'costo_stoccaggio_t', 'costo_trattamento_t', 'costo_pulizia', 'costi_aggiuntivi'].forEach(k => {
      p[k] = Number(p[k]) || 0;
    });
    p.ordine_immesso_il = dataDaGiorno(form.ordine_immesso_il);
    p.trasporto_iniziato_il = dataDaGiorno(form.trasporto_iniziato_il);
    p.trasporto_finito_il = dataDaGiorno(form.trasporto_finito_il);
    // Competenza dalla fine trasporto; per una richiesta ancora aperta dalla data della richiesta.
    Object.assign(p, competenza(form.trasporto_finito_il || form.ordine_immesso_il));
    if (!p.id_ordine) p.id_ordine = p.numero_fir || `ER-${Date.now()}`;
    // In una secondaria il soggetto da cui parte il carico e' lo stoccaggio.
    if (p.tipo_movimento === 'secondaria') p.produttore = p.stoccaggio;
    else p.stoccaggio = '';
    onSave(p);
  };

  // Sotto un costo: da dove viene. Il modulo propone solo tariffe di extra raccolta.
  const daDove = (campo) => (origine[campo] === 'contratto'
    ? <p className="text-xs text-success">dalla tariffa di extra raccolta del fornitore</p>
    : null);

  const calc = calcExtraRaccolta(form);

  // Sotto il prezzo attivo: da dove viene, lo stesso che dira' la fattura.
  const annoPrezzo = annoProposta(form);
  const baseAnno = secondaria ? null : tariffaBaseExtraRaccolta(annoPrezzo);
  let testoPrezzo = null;
  if (prezzoBase !== null) testoPrezzo = <p className="text-xs text-success">tariffa base Ecotyre {prezzoBase}: {formatNumber(Number(form.prezzo_attivo_t) || 0)} €/t</p>;
  else if (secondaria) testoPrezzo = <p className="text-xs text-muted-foreground">una secondaria non si fattura a Ecotyre: il ricavo sta sulla raccolta</p>;
  else if (!(Number(form.prezzo_attivo_t) > 0)) {
    testoPrezzo = baseAnno
      ? <p className="text-xs text-muted-foreground">vuoto: in fattura vale la tariffa base Ecotyre {annoPrezzo} ({formatNumber(baseAnno)} €/t)</p>
      : <p className="text-xs text-amber-700">per il {annoPrezzo} non c&apos;è una tariffa base Ecotyre: scrivi il prezzo</p>;
  }

  const NumField = ({ label, k }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" className="h-9 text-sm" value={form[k]} onChange={e => set(k, e.target.value)} />
    </div>
  );

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prezzo attivo (€/t)</Label>
                <Input type="number" className="h-9 text-sm" value={form.prezzo_attivo_t} onChange={e => { set('prezzo_attivo_t', e.target.value); setPrezzoBase(null); }} />
                {testoPrezzo}
              </div>
              <NumField label="Sovracosto raccolta (€)" k="sovracosto_raccolta" />
              <NumField label="Sovracosto trasporto (€)" k="sovracosto_trasporto" />
              <NumField label="Sovracosto trattamento (€)" k="sovracosto_trattamento" />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Costo raccolta (€/t)</Label>
                <Input type="number" className="h-9 text-sm" value={form.costo_raccolta_t} onChange={e => scriviCosto('costo_raccolta_t', e.target.value)} />
                {daDove('costo_raccolta_t')}
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
              <p className="md:col-span-4 text-xs text-muted-foreground">
                I costi di raccolta, stoccaggio e trattamento sono quelli scritti qui, e la fatturazione passiva paga questi. Il modulo li propone solo dalle tariffe di extra raccolta del fornitore e solo nei campi vuoti; va scritto tutto prima di passare l'intervento a terminato.
              </p>
              <NumField label="Costo pulizia (€)" k="costo_pulizia" />
              <NumField label="Costi aggiuntivi (€)" k="costi_aggiuntivi" />
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-muted-foreground">Note costi {(Number(form.costo_pulizia) > 0 || Number(form.costi_aggiuntivi) > 0) ? '*' : ''}</Label>
                <Input className="h-9 text-sm" value={form.note_costi} onChange={e => set('note_costi', e.target.value)} />
                {errors.note_costi && <p className="text-xs text-destructive">{errors.note_costi}</p>}
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-muted-foreground">Note</Label>
                <Input className="h-9 text-sm" value={form.note} onChange={e => set('note', e.target.value)} />
              </div>
            </div>
          </fieldset>

          {/* Riepilogo in tempo reale */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 border-2 rounded-lg bg-muted/30">
            <div>
              <div className="text-xs text-muted-foreground">Ricavo</div>
              <div className="text-base font-bold tabular-nums">€ {formatNumber(calc.ricavo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Costo totale</div>
              <div className="text-base font-bold tabular-nums">€ {formatNumber(calc.costo_totale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Annulla</Button>
          <Button onClick={save}><Save className="w-4 h-4 mr-1.5" /> Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}