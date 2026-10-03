import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Pencil, Trash2, X, Save, AlertTriangle, Copy, ClipboardList, Eraser } from 'lucide-react';
import { usePermessi, MESSAGGIO_SOLA_LETTURA } from '@/lib/permessi';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { formatNumber } from '@/lib/utils';
import { PROV_TO_REGION } from '@/lib/regioneMap';
import { modelloAmministrazione } from '@/lib/modelloPassivaAmministrazione';

// LE VOCI DEL FORMAT AMMINISTRAZIONE DELLA PASSIVA, CORRETTE DALL'UTENTE.
//
// Le voci sono il modello fisso del foglio: sotto ogni fornitore le sue righe col
// prezzo - Napoli 68, Salerno 68, Avellino 71, Caserta 72 - mostrate sempre, anche
// a zero, cosi' il foglio e' identico ogni mese e un conferimento comparso dove
// prima non ce n'erano si vede a colpo d'occhio. Il 03/10/2026 l'utente ha scelto
// che quel modello sia fisso E modificabile da lui: fino a oggi si poteva soltanto
// creare da una proposta automatica, e per cambiare un prezzo o aggiungere una riga
// come «Campania - SALERNO» non c'era nessuna pagina. Questa e' quella pagina.
//
// Le QUANTITA' non si toccano qui: quelle le mette il gestionale dai movimenti del
// mese. Qui stanno soltanto i nomi, i prezzi e il criterio con cui una voce si
// prende i chili del suo fornitore.

const CANALE_LABEL = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta' };
const BLOCCO_LABEL = { raccoglitori: 'Raccoglitori', impianti: 'Impianti e stoccaggi' };

// I quattro gruppi che il foglio dell'amministrazione ha sempre: si mostrano anche
// vuoti, perche' un blocco senza voci e' una mancanza da vedere, non da nascondere.
// L'extra raccolta per ora resta fuori dal foglio e compare solo se in archivio
// qualche voce ce l'ha.
const GRUPPI_FISSI = [
  { canale: 'RETE', blocco: 'raccoglitori' },
  { canale: 'RETE', blocco: 'impianti' },
  { canale: 'ACI', blocco: 'raccoglitori' },
  { canale: 'ACI', blocco: 'impianti' },
];

const UNITA = [
  { valore: 'euro_tonnellata', etichetta: '€/t' },
  { valore: 'euro_viaggio', etichetta: '€/viaggio' },
];

// I nomi che il calcolo della passiva scrive sulle righe del mese: il criterio si
// confronta con quelli, non con parole nostre, altrimenti non aggancia niente.
const PROVENIENZE = [
  { valore: 'primaria', etichetta: 'da primaria' },
  { valore: 'secondaria', etichetta: 'da secondaria' },
  { valore: 'extra', etichetta: 'da extra raccolta' },
];
const PRESTAZIONI = [
  { valore: 'trattamento', etichetta: 'trattamento' },
  { valore: 'stoccaggio', etichetta: 'stoccaggio' },
];

// Le due colonne di prezzo servono agli IMPIANTI dell'ACI, dove il foglio
// dell'amministrazione distingue quello che si paga per lo stoccaggio da quello che
// si paga per il trattamento. Altrove la colonna si lascia vuota.
const COLONNE_PREZZO = [
  { valore: 'stoccaggio', etichetta: 'Stoccaggio' },
  { valore: 'trattamento', etichetta: 'Trattamento' },
];

const CLASSI = ['P', 'M', 'G1', 'G2'];
const REGIONI = [...new Set(Object.values(PROV_TO_REGION))].sort((a, b) => a.localeCompare(b, 'it'));
const SIGLE_PROVINCIA = Object.keys(PROV_TO_REGION).sort();

// I menu a tendina non accettano un valore vuoto: «nessuna scelta» ha bisogno di un
// valore suo, che al salvataggio torna a essere il campo non scritto.
const VUOTO = '__nessuna__';

// L'archivio si prende al momento dell'uso e non si tiene da parte: la rete di
// sicurezza dei permessi avvolge base44.entities, e ogni lettura della proprieta'
// restituisce un involucro nuovo. Tenerlo in una costante del componente lo
// faceva sembrare cambiato a ogni disegno, e il caricamento sarebbe ripartito
// all'infinito.
const archivio = () => base44.entities.VocePassivaAmministrazione;

const testo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const euro = (v) => formatNumber(Number(v) || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Letture e scritture ravvicinate possono incontrare il limite di richieste della
// piattaforma, che si conta su un minuto per tutta l'app: si riprova dopo una pausa
// invece di lasciare il lavoro a meta'.
async function conRitentativi(fn) {
  const attese = [3000, 8000, 15000];
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const messaggio = String((e && e.data && e.data.error) || (e && e.message) || e);
      if (!/rate limit|too many requests|429/i.test(messaggio) || i >= attese.length) throw e;
      await new Promise(r => setTimeout(r, attese[i]));
    }
  }
}

function criterioDi(voce) {
  if (!voce || !voce.criterio_json) return null;
  try {
    const c = JSON.parse(voce.criterio_json);
    return c && typeof c === 'object' ? c : null;
  } catch {
    // Un criterio illeggibile non deve far sparire la riga dall'elenco: la voce si
    // vede e si corregge, ed e' proprio il motivo per cui questa pagina esiste.
    return null;
  }
}

/** Il criterio detto a parole, come lo direbbe l'amministrazione: niente JSON a video. */
function criterioAParole(voce) {
  const c = criterioDi(voce);
  if (!c) return '';
  const parti = [];
  if (c.regione) parti.push(testo(c.regione));
  if (c.provincia) parti.push(`provincia ${testo(c.provincia).toUpperCase()}`);
  if (c.destinazione) parti.push(`conferimenti su ${testo(c.destinazione)}`);
  if (Array.isArray(c.classi) && c.classi.length) parti.push(`classi ${c.classi.join('+')}`);
  if (c.provenienza) {
    const p = PROVENIENZE.find(x => x.valore === c.provenienza);
    parti.push(p ? p.etichetta : `da ${testo(c.provenienza)}`);
  }
  if (c.prestazione) parti.push(testo(c.prestazione));
  return parti.join(', ');
}

const FORM_NUOVA = {
  canale: 'RETE', blocco: 'raccoglitori', soggetto: '', voce: '', prezzo: 0,
  unita_misura: 'euro_tonnellata', colonna_prezzo: '', ordine: 10, attiva: true, note: '',
  regione: '', provincia: '', destinazione: '', provenienza: '', prestazione: '', classi: [],
};

/** La voce aperta nel riquadro di modifica: il criterio diventa campi separati. */
function formDaVoce(voce) {
  const c = criterioDi(voce) || {};
  return {
    canale: voce.canale || 'RETE',
    blocco: voce.blocco || 'raccoglitori',
    soggetto: voce.soggetto || '',
    voce: voce.voce || '',
    prezzo: Number(voce.prezzo) || 0,
    unita_misura: voce.unita_misura || 'euro_tonnellata',
    colonna_prezzo: voce.colonna_prezzo || '',
    ordine: Number(voce.ordine) || 0,
    attiva: voce.attiva !== false,
    note: voce.note || '',
    regione: c.regione || '',
    provincia: c.provincia || '',
    destinazione: c.destinazione || '',
    provenienza: c.provenienza || '',
    prestazione: c.prestazione || '',
    classi: Array.isArray(c.classi) ? c.classi.filter(x => CLASSI.includes(x)) : [],
  };
}

/** Il criterio rimesso insieme per l'archivio: vuoto quando non c'e' nessuna condizione. */
function criterioDaForm(form) {
  const c = {};
  if (testo(form.regione)) c.regione = testo(form.regione);
  if (testo(form.provincia)) c.provincia = testo(form.provincia).toUpperCase();
  if (testo(form.destinazione)) c.destinazione = testo(form.destinazione);
  if (testo(form.provenienza)) c.provenienza = testo(form.provenienza);
  if (testo(form.prestazione)) c.prestazione = testo(form.prestazione);
  if (Array.isArray(form.classi) && form.classi.length) c.classi = CLASSI.filter(x => form.classi.includes(x));
  return Object.keys(c).length ? JSON.stringify(c) : '';
}

/** I soli campi dell'archivio, da qualunque parte arrivi la voce: nient'altro passa. */
function payloadDaVoce(voce, anno) {
  return {
    anno: Number(anno),
    canale: voce.canale,
    blocco: voce.blocco,
    soggetto: testo(voce.soggetto),
    voce: testo(voce.voce),
    prezzo: Number(voce.prezzo) || 0,
    unita_misura: voce.unita_misura || 'euro_tonnellata',
    colonna_prezzo: voce.colonna_prezzo || '',
    ordine: Number(voce.ordine) || 0,
    criterio_json: voce.criterio_json || '',
    attiva: voce.attiva !== false,
    note: testo(voce.note),
  };
}

// Lo stesso ordine con cui le voci si stampano nel foglio: prima l'ordine scritto
// dall'utente, poi il nome del soggetto, poi quello della voce.
const perOrdine = (a, b) => (Number(a.ordine) || 0) - (Number(b.ordine) || 0)
  || testo(a.soggetto).localeCompare(testo(b.soggetto), 'it')
  || testo(a.voce).localeCompare(testo(b.voce), 'it');

export default function VociPassivaDialog({ aperto, chiudi, anno, onSalvato }) {
  const { isAdmin } = usePermessi();
  const { toast } = useToast();

  const [voci, setVoci] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [inModifica, setInModifica] = useState(null);
  const [form, setForm] = useState(FORM_NUOVA);
  const [daEliminare, setDaEliminare] = useState(null);
  const [puliziaAperta, setPuliziaAperta] = useState(false);
  const [proposta, setProposta] = useState(null);
  const [copia, setCopia] = useState(null);
  const [annoCopia, setAnnoCopia] = useState('');

  const annoNum = Number(anno) || new Date().getFullYear();

  const carica = useCallback(async () => {
    setCaricamento(true);
    try {
      setVoci(await fetchAllClient(archivio(), { anno: annoNum }, 'ordine'));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Voci non caricate', description: e?.message || 'Lettura non riuscita' });
    }
    setCaricamento(false);
  }, [annoNum, toast]);

  useEffect(() => {
    if (!aperto) return;
    setInModifica(null);
    setAnnoCopia(String(annoNum + 1));
    carica();
  }, [aperto, annoNum, carica]);

  const gruppi = useMemo(() => {
    const mappa = new Map();
    const chiave = (c, b) => `${c}|${b}`;
    for (const g of GRUPPI_FISSI) mappa.set(chiave(g.canale, g.blocco), { ...g, voci: [] });
    for (const v of voci) {
      const k = chiave(v.canale, v.blocco);
      if (!mappa.has(k)) mappa.set(k, { canale: v.canale, blocco: v.blocco, voci: [] });
      mappa.get(k).voci.push(v);
    }
    for (const g of mappa.values()) g.voci.sort(perOrdine);
    return [...mappa.values()];
  }, [voci]);

  // Le voci senza soggetto non appartengono a nessun fornitore e nel foglio
  // diventano righe vuote a zero. Sono nate da una proposta automatica partita su
  // dati che non avevano il nome, e si tolgono tutte insieme.
  const senzaSoggetto = useMemo(() => voci.filter(v => !testo(v.soggetto)), [voci]);
  const soggettiNoti = useMemo(
    () => [...new Set(voci.map(v => testo(v.soggetto)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it')),
    [voci],
  );
  const anniCopia = useMemo(() => [annoNum - 2, annoNum - 1, annoNum + 1, annoNum + 2].filter(a => a > 2000), [annoNum]);

  const apriNuova = () => {
    setForm({ ...FORM_NUOVA, ordine: voci.reduce((m, v) => Math.max(m, Number(v.ordine) || 0), 0) + 10 });
    setInModifica('nuova');
  };
  const apriModifica = (v) => { setForm(formDaVoce(v)); setInModifica(v.id); };

  const salva = async () => {
    if (!isAdmin) return;
    if (!testo(form.soggetto)) {
      toast({
        variant: 'destructive',
        title: 'Manca il soggetto',
        description: "Senza il fornitore o l'impianto la voce nel foglio uscirebbe come una riga vuota a zero.",
      });
      return;
    }
    setSalvataggio(true);
    try {
      const payload = payloadDaVoce({ ...form, criterio_json: criterioDaForm(form) }, annoNum);
      if (inModifica === 'nuova') await conRitentativi(() => archivio().create(payload));
      else await conRitentativi(() => archivio().update(inModifica, payload));
      setInModifica(null);
      await carica();
      onSalvato?.();
      toast({
        title: 'Voce salvata',
        description: `${payload.soggetto}${payload.voce ? ` - ${payload.voce}` : ''}, ${euro(payload.prezzo)} €.`,
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Voce non salvata', description: e?.response?.data?.error || e?.message || 'Scrittura non riuscita' });
    }
    setSalvataggio(false);
  };

  // Disattivare non e' cancellare: la voce resta in archivio con la sua storia e
  // smette soltanto di comparire nel foglio. Vale in tutto il gestionale.
  const commutaAttiva = async (v, valore) => {
    if (!isAdmin) return;
    try {
      await conRitentativi(() => archivio().update(v.id, { attiva: valore }));
      await carica();
      onSalvato?.();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Voce non aggiornata', description: e?.message || 'Scrittura non riuscita' });
    }
  };

  const elimina = async () => {
    if (!isAdmin || !daEliminare) return;
    setSalvataggio(true);
    try {
      await conRitentativi(() => archivio().delete(daEliminare.id));
      setDaEliminare(null);
      await carica();
      onSalvato?.();
      toast({ title: 'Voce eliminata' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Voce non eliminata', description: e?.message || 'Scrittura non riuscita' });
    }
    setSalvataggio(false);
  };

  // Le scritture a gruppi passano da bulkCreate quando la piattaforma lo mette a
  // disposizione, altrimenti una per una: in entrambi i casi a blocchi, per non
  // esaurire il limite di richieste del minuto.
  const creaVoci = async (nuove) => {
    const ent = archivio();
    for (let i = 0; i < nuove.length; i += 50) {
      const blocco = nuove.slice(i, i + 50);
      if (typeof ent.bulkCreate === 'function') await conRitentativi(() => ent.bulkCreate(blocco));
      else for (const v of blocco) await conRitentativi(() => ent.create(v));
    }
  };
  const eliminaVoci = async (righe) => {
    const ent = archivio();
    for (const r of righe) await conRitentativi(() => ent.delete(r.id));
  };

  const rimuoviSenzaSoggetto = async () => {
    if (!isAdmin) return;
    setSalvataggio(true);
    const quante = senzaSoggetto.length;
    try {
      await eliminaVoci(senzaSoggetto);
      setPuliziaAperta(false);
      await carica();
      onSalvato?.();
      toast({
        title: 'Righe vuote rimosse',
        description: `${quante} ${quante === 1 ? 'voce' : 'voci'} senza soggetto: nel foglio non compariranno piu'.`,
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Rimozione interrotta', description: e?.message || 'Scrittura non riuscita' });
      await carica();
    }
    setSalvataggio(false);
  };

  const chiediModello = async () => {
    if (!isAdmin) return;
    setSalvataggio(true);
    try {
      const modello = (await modelloAmministrazione(annoNum)) || [];
      if (!modello.length) {
        toast({ title: 'Modello vuoto', description: `Per il ${annoNum} il modello dell'amministrazione non ha nessuna voce.` });
      } else {
        setProposta(modello.map(v => payloadDaVoce(v, annoNum)));
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Modello non letto', description: e?.message || 'Lettura non riuscita' });
    }
    setSalvataggio(false);
  };

  const applicaModello = async (sostituisci) => {
    if (!isAdmin || !proposta) return;
    setSalvataggio(true);
    const quante = proposta.length;
    try {
      if (sostituisci) await eliminaVoci(voci);
      await creaVoci(proposta);
      setProposta(null);
      await carica();
      onSalvato?.();
      toast({
        title: 'Modello caricato',
        description: `${quante} voci nel ${annoNum}${sostituisci ? ", al posto di quelle che c'erano" : ", in aggiunta a quelle che c'erano"}.`,
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Caricamento interrotto', description: e?.message || 'Scrittura non riuscita' });
      await carica();
    }
    setSalvataggio(false);
  };

  // A inizio anno i prezzi cambiano ma l'impianto del foglio no: si copiano le voci
  // nell'anno nuovo e si correggono i prezzi, invece di rifare tutto da zero.
  const chiediCopia = async () => {
    if (!isAdmin) return;
    const destinazione = Number(annoCopia);
    if (!destinazione || destinazione === annoNum) return;
    if (!voci.length) {
      toast({ title: 'Niente da copiare', description: `Nel ${annoNum} non c'e' nessuna voce.` });
      return;
    }
    setSalvataggio(true);
    try {
      const esistenti = await fetchAllClient(archivio(), { anno: destinazione }, 'ordine');
      setCopia({ anno: destinazione, esistenti });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Anno di destinazione non letto', description: e?.message || 'Lettura non riuscita' });
    }
    setSalvataggio(false);
  };

  const applicaCopia = async (sostituisci) => {
    if (!isAdmin || !copia) return;
    setSalvataggio(true);
    const destinazione = copia.anno;
    const quante = voci.length;
    try {
      if (sostituisci && copia.esistenti.length) await eliminaVoci(copia.esistenti);
      await creaVoci(voci.map(v => payloadDaVoce(v, destinazione)));
      setCopia(null);
      onSalvato?.();
      toast({
        title: `Voci copiate nel ${destinazione}`,
        description: `${quante} voci${sostituisci ? ", al posto di quelle che c'erano" : ", in aggiunta a quelle che c'erano"}. I prezzi del nuovo anno si correggono aprendo il ${destinazione}.`,
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Copia interrotta', description: e?.message || 'Scrittura non riuscita' });
    }
    setSalvataggio(false);
  };

  // Il criterio che si sta scrivendo, detto subito a parole: e' il controllo che
  // l'utente ha in mano prima di salvare.
  const anteprimaCriterio = criterioAParole({ criterio_json: criterioDaForm(form) });

  return (
    <>
      <Dialog open={!!aperto} onOpenChange={(v) => { if (!v) chiudi?.(); }}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Voci del format amministrazione - passiva {annoNum}</DialogTitle>
            <DialogDescription>
              Sotto ogni fornitore le sue righe, che nel foglio si vedono sempre, anche a zero: cosi&apos; il foglio
              e&apos; identico ogni mese e un conferimento nuovo si vede comparire. Qui si decidono i nomi delle righe
              e come si riconoscono i movimenti di ciascuna. Le quantita&apos; le mette il gestionale dai movimenti del
              mese, e <strong>il prezzo lo dice il tariffario</strong>: sulle righe con movimenti quello che il mese ha
              applicato, sulle righe a zero la tariffa in vigore in quel mese. Il prezzo scritto qui sotto si usa
              soltanto se il tariffario non dice niente, e in quel caso il foglio lo dichiara nelle note.
            </DialogDescription>
          </DialogHeader>

          {!isAdmin && (
            <p className="text-xs text-muted-foreground border rounded-lg px-3 py-2 bg-muted/30">{MESSAGGIO_SOLA_LETTURA}</p>
          )}

          {isAdmin && senzaSoggetto.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-destructive/30 bg-destructive/5 rounded-lg px-3 py-2">
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {senzaSoggetto.length} {senzaSoggetto.length === 1 ? 'voce non ha' : 'voci non hanno'} il soggetto: nel
                foglio diventano righe vuote a zero.
              </p>
              <Button size="sm" variant="destructive" disabled={salvataggio} onClick={() => setPuliziaAperta(true)}>
                <Eraser className="w-4 h-4 mr-1.5" />
                Rimuovi {senzaSoggetto.length === 1 ? 'la voce' : `le ${senzaSoggetto.length} voci`} senza soggetto
              </Button>
            </div>
          )}

          {inModifica && isAdmin ? (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Canale</label>
                  <Select value={form.canale} onValueChange={v => setForm({ ...form, canale: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(CANALE_LABEL).map(c => <SelectItem key={c} value={c}>{CANALE_LABEL[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Blocco del foglio</label>
                  <Select value={form.blocco} onValueChange={v => setForm({ ...form, blocco: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(BLOCCO_LABEL).map(b => <SelectItem key={b} value={b}>{BLOCCO_LABEL[b]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground block mb-1">
                    Soggetto (il fornitore o l&apos;impianto, come si scrive nel foglio)
                  </label>
                  <Input list="voci-passiva-soggetti" value={form.soggetto}
                    onChange={e => setForm({ ...form, soggetto: e.target.value })} placeholder="LOGISTICA & PNEUMATICI" />
                  <datalist id="voci-passiva-soggetti">{soggettiNoti.map(s => <option key={s} value={s} />)}</datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground block mb-1">Voce (vuota se il soggetto ha una riga sola)</label>
                  <Input value={form.voce} onChange={e => setForm({ ...form, voce: e.target.value })} placeholder="Campania - SALERNO" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1" title="Il prezzo del foglio viene dal tariffario: questo si usa solo se il tariffario non dice niente per questa riga">
                    Prezzo di riserva (il foglio usa il tariffario)
                  </label>
                  <Input type="number" step="0.01" value={form.prezzo} onChange={e => setForm({ ...form, prezzo: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Unita&apos; di misura</label>
                  <Select value={form.unita_misura} onValueChange={v => setForm({ ...form, unita_misura: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITA.map(u => <SelectItem key={u.valore} value={u.valore}>{u.etichetta}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Ordine nel foglio</label>
                  <Input type="number" step="10" value={form.ordine} onChange={e => setForm({ ...form, ordine: Number(e.target.value) })} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Colonna del prezzo (impianti ACI)</label>
                  <Select value={form.colonna_prezzo || VUOTO} onValueChange={v => setForm({ ...form, colonna_prezzo: v === VUOTO ? '' : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={VUOTO}>Colonna unica</SelectItem>
                      {COLONNE_PREZZO.map(c => <SelectItem key={c.valore} value={c.valore}>{c.etichetta}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm h-9">
                  <Switch checked={form.attiva !== false} onCheckedChange={v => setForm({ ...form, attiva: v })} />
                  Attiva nel foglio
                </label>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground block mb-1">Note</label>
                  <Textarea rows={1} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
                </div>
              </div>

              {/* IL CRITERIO, a campi separati. Dice quali chili del soggetto finiscono su
                  questa riga e non su un'altra dello stesso fornitore. Lasciarlo tutto
                  vuoto vuol dire «tutto quello che resta del soggetto», che e' il caso
                  dei fornitori con una riga sola. */}
              <div className="border rounded-lg p-3 space-y-2 bg-card">
                <p className="text-xs font-semibold">Criterio: quali movimenti del soggetto finiscono su questa riga</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Regione</label>
                    <Select value={form.regione || VUOTO} onValueChange={v => setForm({ ...form, regione: v === VUOTO ? '' : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={VUOTO}>Qualunque</SelectItem>
                        {REGIONI.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Provincia (sigla, es. NA)</label>
                    <Input list="voci-passiva-province" maxLength={2} value={form.provincia}
                      onChange={e => setForm({ ...form, provincia: e.target.value.toUpperCase() })} placeholder="NA" />
                    <datalist id="voci-passiva-province">{SIGLE_PROVINCIA.map(s => <option key={s} value={s} />)}</datalist>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Destinazione dei conferimenti</label>
                    <Input value={form.destinazione} onChange={e => setForm({ ...form, destinazione: e.target.value })} placeholder="Gatim" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Provenienza</label>
                    <Select value={form.provenienza || VUOTO} onValueChange={v => setForm({ ...form, provenienza: v === VUOTO ? '' : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={VUOTO}>Qualunque</SelectItem>
                        {PROVENIENZE.map(p => <SelectItem key={p.valore} value={p.valore}>{p.etichetta}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Prestazione</label>
                    <Select value={form.prestazione || VUOTO} onValueChange={v => setForm({ ...form, prestazione: v === VUOTO ? '' : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={VUOTO}>Qualunque</SelectItem>
                        {PRESTAZIONI.map(p => <SelectItem key={p.valore} value={p.valore}>{p.etichetta}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Classi</label>
                    <div className="flex items-center gap-3 h-9">
                      {CLASSI.map(c => (
                        <label key={c} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <Checkbox
                            checked={form.classi.includes(c)}
                            onCheckedChange={v => setForm({
                              ...form,
                              classi: v ? [...form.classi, c] : form.classi.filter(x => x !== c),
                            })}
                          />
                          {c}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {anteprimaCriterio
                    ? <>Questa riga prende: <span className="font-medium text-foreground">{anteprimaCriterio}</span>.</>
                    : 'Nessuna condizione: la riga prende tutto quello che resta del soggetto.'}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={salvataggio} onClick={() => setInModifica(null)}>
                  <X className="w-4 h-4 mr-1.5" /> Annulla
                </Button>
                <Button disabled={salvataggio || !testo(form.soggetto)} onClick={salva}>
                  {salvataggio ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Salva la voce
                </Button>
              </div>
            </div>
          ) : (
            <>
              {isAdmin && (
                <div className="flex flex-wrap items-end gap-2">
                  <Button size="sm" disabled={salvataggio} onClick={apriNuova}>
                    <Plus className="w-4 h-4 mr-1.5" /> Aggiungi una voce
                  </Button>
                  <Button size="sm" variant="outline" disabled={salvataggio} onClick={chiediModello}
                    title="Il modello dell amministrazione per questo anno: dice quante voci sono prima di caricarle">
                    {salvataggio ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ClipboardList className="w-4 h-4 mr-1.5" />}
                    Carica il modello dell&apos;amministrazione
                  </Button>
                  <div className="flex items-end gap-1.5 ml-auto">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Copia queste voci nell&apos;anno</label>
                      <Select value={annoCopia} onValueChange={setAnnoCopia}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{anniCopia.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" variant="outline" disabled={salvataggio || !voci.length} onClick={chiediCopia}
                      title="A inizio anno i prezzi cambiano ma l impianto del foglio no">
                      <Copy className="w-4 h-4 mr-1.5" /> Copia
                    </Button>
                  </div>
                </div>
              )}

              {caricamento ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Caricamento delle voci...
                </div>
              ) : (
                <div className="space-y-4">
                  {gruppi.map(g => (
                    <div key={`${g.canale}|${g.blocco}`}>
                      <h3 className="text-sm font-semibold mb-1.5">
                        {CANALE_LABEL[g.canale] || g.canale} - {BLOCCO_LABEL[g.blocco] || g.blocco}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {g.voci.length} {g.voci.length === 1 ? 'voce' : 'voci'}
                        </span>
                      </h3>
                      <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left px-2 py-2 font-semibold">Soggetto</th>
                              <th className="text-left px-2 py-2 font-semibold">Voce</th>
                              <th className="text-left px-2 py-2 font-semibold">Prende</th>
                              <th className="text-right px-2 py-2 font-semibold" title="Prezzo di riserva: il foglio usa quello del tariffario, e questo solo se il tariffario non dice niente">Prezzo di riserva</th>
                              <th className="text-left px-2 py-2 font-semibold">Colonna</th>
                              <th className="text-right px-2 py-2 font-semibold">Ordine</th>
                              <th className="text-center px-2 py-2 font-semibold">Attiva</th>
                              <th className="text-left px-2 py-2 font-semibold">Note</th>
                              {isAdmin && <th className="px-2 py-2" />}
                            </tr>
                          </thead>
                          <tbody>
                            {g.voci.map(v => {
                              const parole = criterioAParole(v);
                              const manca = !testo(v.soggetto);
                              return (
                                <tr key={v.id} className={`border-b hover:bg-muted/20 ${manca ? 'bg-destructive/5' : ''} ${v.attiva === false ? 'opacity-60' : ''}`}>
                                  <td className={`px-2 py-1.5 font-medium ${manca ? 'text-destructive' : ''}`}>
                                    {manca ? (
                                      <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> senza soggetto</span>
                                    ) : testo(v.soggetto)}
                                  </td>
                                  <td className="px-2 py-1.5">{testo(v.voce) || <span className="text-muted-foreground">riga unica</span>}</td>
                                  <td className="px-2 py-1.5">{parole || <span className="text-muted-foreground">tutto il soggetto</span>}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">
                                    {euro(v.prezzo)} {v.unita_misura === 'euro_viaggio' ? '€/viaggio' : '€/t'}
                                  </td>
                                  <td className="px-2 py-1.5">
                                    {v.colonna_prezzo
                                      ? (COLONNE_PREZZO.find(c => c.valore === v.colonna_prezzo)?.etichetta || v.colonna_prezzo)
                                      : <span className="text-muted-foreground">unica</span>}
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{Number(v.ordine) || 0}</td>
                                  <td className="px-2 py-1.5 text-center">
                                    {isAdmin
                                      ? <Switch checked={v.attiva !== false} onCheckedChange={val => commutaAttiva(v, val)} />
                                      : (v.attiva === false ? 'no' : 'si')}
                                  </td>
                                  <td className="px-2 py-1.5 max-w-[180px] truncate" title={testo(v.note)}>
                                    {testo(v.note) || <span className="text-muted-foreground">&mdash;</span>}
                                  </td>
                                  {isAdmin && (
                                    <td className="px-2 py-1.5">
                                      <div className="flex gap-2">
                                        <button onClick={() => apriModifica(v)} className="text-primary hover:opacity-70"
                                          aria-label={`Modifica ${testo(v.soggetto) || 'la voce senza soggetto'}`}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => setDaEliminare(v)} className="text-destructive hover:opacity-70"
                                          aria-label={`Elimina ${testo(v.soggetto) || 'la voce senza soggetto'}`}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                            {g.voci.length === 0 && (
                              <tr>
                                <td colSpan={isAdmin ? 9 : 8} className="text-center py-3 text-muted-foreground">
                                  Nessuna voce: in questo blocco il foglio uscirebbe senza righe.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => chiudi?.()}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminare una voce si conferma: disattivarla conserva la storia, cancellarla no. */}
      <AlertDialog open={!!daEliminare} onOpenChange={(v) => { if (!v) setDaEliminare(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa voce?</AlertDialogTitle>
            <AlertDialogDescription>
              {daEliminare && (
                <>
                  {testo(daEliminare.soggetto) || 'voce senza soggetto'}
                  {testo(daEliminare.voce) ? ` - ${testo(daEliminare.voce)}` : ''}, {euro(daEliminare.prezzo)} €,
                  {' '}{CANALE_LABEL[daEliminare.canale] || daEliminare.canale} / {BLOCCO_LABEL[daEliminare.blocco] || daEliminare.blocco}.
                  {' '}Non si recupera. Se serve soltanto togliere la riga dal foglio conviene disattivarla: resta in
                  archivio con la sua storia.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={elimina}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={puliziaAperta} onOpenChange={setPuliziaAperta}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Rimuovere {senzaSoggetto.length} {senzaSoggetto.length === 1 ? 'voce' : 'voci'} senza soggetto?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sono voci che non appartengono a nessun fornitore e nel foglio diventano righe vuote a zero. Si eliminano
              tutte insieme e non si recuperano; le altre voci del {annoNum} restano come sono.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={rimuoviSenzaSoggetto}>Rimuovile</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Il modello dell'amministrazione: prima si dice quante voci sono, e se per
          quell'anno in archivio ce n'e' gia' si chiede se sostituirle o aggiungerle. */}
      <AlertDialog open={!!proposta} onOpenChange={(v) => { if (!v) setProposta(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Caricare il modello dell&apos;amministrazione nel {annoNum}?</AlertDialogTitle>
            <AlertDialogDescription>
              Il modello ha {proposta ? proposta.length : 0} voci.
              {voci.length > 0
                ? ` Nel ${annoNum} ce ne sono gia' ${voci.length}: puoi sostituirle con il modello, e allora le voci di adesso si perdono con le correzioni che hanno, oppure aggiungere le nuove e tenere le vecchie.`
                : ` Nel ${annoNum} non ce n'e' nessuna: si caricano e basta.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            {voci.length > 0 && <AlertDialogAction onClick={() => applicaModello(false)}>Aggiungile</AlertDialogAction>}
            <AlertDialogAction onClick={() => applicaModello(true)}>
              {voci.length > 0 ? 'Sostituiscile' : 'Carica'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!copia} onOpenChange={(v) => { if (!v) setCopia(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiare le voci del {annoNum} nel {copia ? copia.anno : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Si copiano {voci.length} voci con i prezzi di adesso: nell&apos;anno nuovo i prezzi cambiano,
              l&apos;impianto del foglio no, e li correggi aprendo quell&apos;anno.
              {copia && copia.esistenti.length > 0
                ? ` Nel ${copia.anno} ci sono gia' ${copia.esistenti.length} voci: puoi sostituirle o aggiungere le copie a quelle.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            {copia && copia.esistenti.length > 0 && <AlertDialogAction onClick={() => applicaCopia(false)}>Aggiungile</AlertDialogAction>}
            <AlertDialogAction onClick={() => applicaCopia(true)}>
              {copia && copia.esistenti.length > 0 ? 'Sostituiscile' : 'Copia'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
