import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePermessi } from '@/lib/permessi';
import { fetchAllClient } from '@/lib/fetchAllClient';
import {
  leggiElencoOmologhe, leggiRegistroOmologhe, giorniAllaScadenza, fasciaScadenza,
  FASCE, STATI, NOME_DIVERGENZA, SPIEGA_DIVERGENZA, PESO_DIVERGENZA,
} from '@/lib/omologhe';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { BannerSolaLettura } from '@/components/shared/SolaLettura';
import { dimenticaIndiceOmologhe } from '@/lib/omologheIndice';
import { formatIntero } from '@/lib/utils';
import { Loader2, FileCheck2, Search, Upload, FileSpreadsheet, Check, PauseCircle, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';

// Modulo Omologhe.
//
// L'omologa e' il documento che il punto di raccolta consegna quando si programma
// il ritiro: dice che cosa conferisce e vale un anno. Qui si tiene l'elenco, si
// vede a colpo d'occhio quali stanno per scadere e si guarda dove i due fogli --
// il nostro elenco e il registro di carico e scarico dell'impianto -- non dicono
// la stessa cosa.
//
// Le divergenze non si risolvono da sole: la verifica la fa l'operatore in
// ufficio, con i documenti davanti, e qui registra la sua decisione.

// La ricerca confronta le parole, non la scrittura: "PIUGOMME DISTRIBUZIONI S.R.L."
// arrivato da un ordine trova "Piugomme Distribuzioni srl" nell'elenco. Basta che
// ogni parola significativa cercata compaia nel nome.
const FORME = new Set(['srl', 'srls', 'spa', 'sas', 'snc', 'sc', 'ss', 'soc', 'societa', 'unipersonale', 'ditta', 'di', 'del', 'della', 'dei', 'e', 'c']);
const parole = (v) => String(v || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()
  .replace(/\b(?:[a-z] )+[a-z]\b/g, (m) => m.replace(/ /g, ''))
  .split(' ').filter(p => p && !FORME.has(p));
const corrisponde = (r, cercate) => {
  if (!cercate.length) return true;
  const nome = parole(`${r.produttore} ${r.registro_nome || ''}`).join(' ');
  return cercate.every(p => nome.includes(p));
};

const dataIt = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');

const scadenzaTesto = (giorni) => {
  if (giorni === null) return '—';
  if (giorni < 0) return `scaduta da ${Math.abs(giorni)} ${Math.abs(giorni) === 1 ? 'giorno' : 'giorni'}`;
  if (giorni === 0) return 'scade oggi';
  return `fra ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`;
};

function Riquadro({ titolo, valore, dettaglio, classe }) {
  return (
    <div className={`border rounded-lg bg-card p-3 ${classe || ''}`}>
      <div className="text-xs text-muted-foreground">{titolo}</div>
      <div className="text-2xl font-semibold tabular-nums">{valore}</div>
      {dettaglio && <div className="text-xs text-muted-foreground">{dettaglio}</div>}
    </div>
  );
}

export default function Omologhe() {
  const { user, isAdmin } = usePermessi();
  const { toast } = useToast();
  const [righe, setRighe] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(null);
  const [params] = useSearchParams();
  const [cerca, setCerca] = useState(() => params.get('cerca') || '');
  const [canale, setCanale] = useState('tutti');
  const [scadenza, setScadenza] = useState('tutte');
  const [statoFiltro, setStatoFiltro] = useState('tutti');
  const [inCorso, setInCorso] = useState(null);
  const [note, setNote] = useState({});
  const [aggiornando, setAggiornando] = useState(null);
  const [esito, setEsito] = useState(null);
  const [tipoDiv, setTipoDiv] = useState('tutte');
  const [statoDiv, setStatoDiv] = useState('aperte');
  const [selezionate, setSelezionate] = useState(new Set());
  const [inBlocco, setInBlocco] = useState(null);
  const fileElenco = useRef(null);
  const fileRegistro = useRef(null);

  const carica = useCallback(async () => {
    setCaricamento(true); setErrore(null);
    try {
      setRighe(await fetchAllClient(base44.entities.Omologa, null, 'produttore'));
    } catch (e) {
      setErrore(e.message || 'Non riesco a leggere le omologhe.');
    }
    setCaricamento(false);
  }, []);

  useEffect(() => { carica(); }, [carica]);

  const oggi = new Date().toISOString().slice(0, 10);
  const conGiorni = useMemo(() => righe.map(r => {
    const giorni = giorniAllaScadenza(r.scadenza_effettiva || r.omologa_a, oggi);
    return { ...r, giorni, fascia: fasciaScadenza(giorni) };
  }), [righe, oggi]);

  const filtrate = useMemo(() => {
    const cercate = parole(cerca);
    return conGiorni.filter(r => {
      if (!corrisponde(r, cercate)) return false;
      if (canale !== 'tutti' && (r.canale || 'RETE') !== canale) return false;
      if (statoFiltro !== 'tutti' && (r.stato || 'da_verificare') !== statoFiltro) return false;
      if (scadenza === 'scadute' && r.fascia !== 'scaduta') return false;
      if (scadenza === 'entro30' && !['scaduta', 'critica', 'vicina'].includes(r.fascia)) return false;
      if (scadenza === 'da_richiedere' && (r.giorni === null || r.giorni > 60 || r.stato === 'annullata')) return false;
      if (scadenza === 'entro90' && ['valida', 'senza_data'].includes(r.fascia)) return false;
      if (scadenza === 'senza_data' && r.fascia !== 'senza_data') return false;
      return true;
    }).sort((a, b) => {
      const ga = a.giorni === null ? 99999 : a.giorni;
      const gb = b.giorni === null ? 99999 : b.giorni;
      return ga - gb || String(a.produttore).localeCompare(String(b.produttore), 'it');
    });
  }, [conGiorni, cerca, canale, scadenza, statoFiltro]);

  const divergenti = useMemo(() => {
    const cercate = parole(cerca);
    return conGiorni
      .filter(r => (r.tipo_divergenza || 'nessuna') !== 'nessuna')
      .filter(r => corrisponde(r, cercate))
      .filter(r => tipoDiv === 'tutte' || r.tipo_divergenza === tipoDiv)
      .filter(r => {
        const s = r.stato || 'da_verificare';
        if (statoDiv === 'aperte') return s === 'da_verificare' || s === 'in_sospeso';
        return statoDiv === 'tutte' || s === statoDiv;
      })
      .sort((a, b) => (PESO_DIVERGENZA[a.tipo_divergenza] || 9) - (PESO_DIVERGENZA[b.tipo_divergenza] || 9)
        || String(a.produttore).localeCompare(String(b.produttore), 'it'));
  }, [conGiorni, cerca, tipoDiv, statoDiv]);

  const daVerificare = conGiorni.filter(r => (r.tipo_divergenza || 'nessuna') !== 'nessuna' && (r.stato || 'da_verificare') === 'da_verificare');
  const conta = (f) => conGiorni.filter(f).length;

  const decidi = async (r, stato) => {
    setInCorso(r.id + stato);
    try {
      await base44.entities.Omologa.update(r.id, {
        stato,
        nota: (note[r.id] !== undefined ? note[r.id] : r.nota || '').trim(),
        deciso_da: (user && (user.full_name || user.email)) || '',
        deciso_il: new Date().toISOString(),
      });
      await carica();
    } catch (e) {
      toast({ title: 'Non riesco a salvare la decisione', description: e.message, variant: 'destructive' });
    }
    setInCorso(null);
  };

  // La stessa decisione su piu' divergenze, dopo averle controllate in ufficio.
  // Una alla volta e con una pausa, per non sovraccaricare il gestionale.
  const decidiSelezionate = async (stato) => {
    const lista = divergenti.filter(r => selezionate.has(r.id));
    if (!lista.length) return;
    const quante = lista.length === 1 ? 'divergenza' : 'divergenze';
    if (!window.confirm(`Segnare ${lista.length} ${quante} come «${STATI[stato].nome}»? Fallo solo dopo averle controllate.`)) return;
    const chi = (user && (user.full_name || user.email)) || '';
    let fatte = 0, errori = 0;
    for (const r of lista) {
      setInBlocco(`${fatte + errori + 1} di ${lista.length}`);
      try {
        await base44.entities.Omologa.update(r.id, { stato, deciso_da: chi, deciso_il: new Date().toISOString() });
        fatte++;
      } catch (_e) { errori++; }
      await new Promise(fine => setTimeout(fine, 150));
    }
    setInBlocco(null);
    setSelezionate(new Set());
    toast({
      title: `${fatte} ${fatte === 1 ? 'divergenza segnata' : 'divergenze segnate'}: ${STATI[stato].nome.toLowerCase()}`,
      description: errori ? `${errori} non salvate: riprova su quelle.` : undefined,
      variant: errori ? 'destructive' : undefined,
    });
    await carica();
  };

  const scegli = (id) => setSelezionate(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const aggiorna = async () => {
    const f1 = fileElenco.current && fileElenco.current.files[0];
    const f2 = fileRegistro.current && fileRegistro.current.files[0];
    if (!f1 || !f2) {
      toast({ title: 'Servono tutti e due i file', description: "Senza il registro non si può dire dove i due fogli non vanno d'accordo.", variant: 'destructive' });
      return;
    }
    setEsito(null);
    try {
      setAggiornando("leggo l'elenco delle omologhe…");
      const elenco = await leggiElencoOmologhe(f1);
      setAggiornando('leggo il registro di carico e scarico…');
      const { annotati, conferitori } = await leggiRegistroOmologhe(f2);
      setAggiornando(`confronto ${formatIntero(elenco.length)} omologhe con ${formatIntero(annotati.length)} annotazioni…`);
      const res = await base44.functions.invoke('importaOmologhe', { elenco, registro: annotati, conferitori });
      setEsito(res.data);
      dimenticaIndiceOmologhe();
      toast({ title: 'Elenco aggiornato', description: `${formatIntero(res.data.totale)} produttori, ${formatIntero(res.data.nuovi)} nuovi.` });
      await carica();
    } catch (e) {
      const msg = (e && e.data && e.data.error) || e.message || String(e);
      toast({ title: 'Aggiornamento non riuscito', description: msg, variant: 'destructive' });
    }
    setAggiornando(null);
  };

  // Collegare a mano un'omologa a uno o piu' PDR, quando i formulari non bastano.
  // Si decide caso per caso: il nome da solo non e' una prova.
  const collegaPdr = async (r) => {
    const attuali = (r.pdr_manuali || []).join(', ');
    const testo = window.prompt(
      `PDR da collegare a mano all'omologa di ${r.produttore}.\nScrivi gli ID PDR separati da virgola; lascia vuoto per togliere il collegamento a mano.`,
      attuali,
    );
    if (testo === null) return;
    const pdr = [...new Set(testo.split(/[\s,;]+/).map(s => s.trim()).filter(s => /^\d+$/.test(s)))];
    setInCorso(r.id + 'pdr');
    try {
      await base44.entities.Omologa.update(r.id, { pdr_manuali: pdr });
      dimenticaIndiceOmologhe();
      await carica();
    } catch (e) {
      toast({ title: 'Non riesco a salvare il collegamento', description: e.message, variant: 'destructive' });
    }
    setInCorso(null);
  };

  const esporta = async () => {
    const XLSX = await import('xlsx');
    const dati = filtrate.map(r => ({
      Produttore: r.produttore,
      Canale: r.canale || 'RETE',
      'Omologa dal': dataIt(r.omologa_da),
      'Omologa al': dataIt(r.omologa_a),
      'Scadenza contata': dataIt(r.scadenza_effettiva || r.omologa_a),
      'Validità da': r.validita_da_registro ? 'prima annotazione nel registro' : 'elenco',
      'Carichi nel registro': r.registro_carichi || 0,
      'PDR collegati': (r.pdr_collegati || []).join(', '),
      'PDR collegati a mano': (r.pdr_manuali || []).join(', '),
      'Rinnovi precedenti': (() => { try { return JSON.parse(r.storico_json || '[]').map(s => `${dataIt(s.da)}–${dataIt(s.a)}`).join('; '); } catch (_e) { return ''; } })(),
      'Giorni alla scadenza': r.giorni === null ? '' : r.giorni,
      Scadenza: FASCE[r.fascia].etichetta,
      'Nel registro': r.nel_registro ? dataIt(r.registro_data) : 'no',
      'Nome nel registro': r.registro_nome || '',
      Divergenza: NOME_DIVERGENZA[r.tipo_divergenza || 'nessuna'],
      Stato: STATI[r.stato || 'da_verificare'].nome,
      Nota: r.nota || '',
      'N. autorizzazione': r.n_autorizzazione || '',
      'Autorizzazione al': dataIt(r.autorizzazione_a),
      'RdP al': dataIt(r.rdp_a),
    }));
    const ws = XLSX.utils.json_to_sheet(dati);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Omologhe');
    XLSX.writeFile(wb, `Omologhe_${oggi}.xlsx`);
  };

  const Azioni = ({ r }) => (
    <div className="flex flex-wrap gap-1">
      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!!inCorso} onClick={() => decidi(r, 'recepita')}>
        {inCorso === r.id + 'recepita' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />} Recepita
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!!inCorso} onClick={() => decidi(r, 'in_sospeso')}>
        {inCorso === r.id + 'in_sospeso' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <PauseCircle className="w-3 h-3 mr-1" />} In sospeso
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" disabled={!!inCorso} onClick={() => decidi(r, 'annullata')}>
        {inCorso === r.id + 'annullata' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />} Annulla
      </Button>
      {(r.stato || 'da_verificare') !== 'da_verificare' && (
        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={!!inCorso} onClick={() => decidi(r, 'da_verificare')}>
          <RotateCcw className="w-3 h-3 mr-1" /> Riapri
        </Button>
      )}
    </div>
  );

  return (
    <div className="p-4 lg:p-8 max-w-[1500px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
          <FileCheck2 className="w-7 h-7 text-primary" /> Omologhe
        </h1>
        <p className="text-muted-foreground mt-1 max-w-4xl">
          Le schede di omologa dei produttori: valgono un anno e si chiedono al punto di raccolta quando si programma il ritiro.
          Basta recepirle una volta, al primo ritiro: da lì parte l'anno di validità, e i ritiri successivi dallo stesso punto
          non devono riportare l'annotazione. Il colore si scalda man mano che la scadenza si avvicina. Le divergenze fra il
          nostro elenco e il registro dell'impianto restano in attesa finché non le verifica una persona.
        </p>
      </div>

      <BannerSolaLettura cosa="le omologhe" />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Riquadro titolo="Omologhe in elenco" valore={formatIntero(righe.length)} dettaglio={`${formatIntero(conta(r => (r.canale || 'RETE') === 'RETE'))} rete · ${formatIntero(conta(r => r.canale === 'ACI'))} ACI`} />
        <Riquadro titolo="Valide" valore={formatIntero(conta(r => ['valida', 'lontana'].includes(r.fascia)))} dettaglio="oltre due mesi" />
        <Riquadro titolo="In scadenza" valore={formatIntero(conta(r => ['critica', 'vicina', 'avviso'].includes(r.fascia)))} dettaglio="entro due mesi" classe="border-amber-300" />
        <Riquadro titolo="Scadute" valore={formatIntero(conta(r => r.fascia === 'scaduta'))} dettaglio="da rinnovare" classe="border-red-300" />
        <Riquadro titolo="Da verificare" valore={formatIntero(daVerificare.length)} dettaglio="divergenze fra i due fogli" classe={daVerificare.length ? 'border-amber-300' : ''} />
      </div>

      {errore && <div className="border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">{errore}</div>}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Cerca un produttore…" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        </div>
        <Select value={canale} onValueChange={setCanale}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti i canali</SelectItem>
            <SelectItem value="RETE">Rete</SelectItem>
            <SelectItem value="ACI">ACI</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scadenza} onValueChange={setScadenza}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutte le scadenze</SelectItem>
            <SelectItem value="da_richiedere">Da richiedere: scadono entro 60 giorni</SelectItem>
            <SelectItem value="scadute">Solo scadute</SelectItem>
            <SelectItem value="entro30">Entro un mese</SelectItem>
            <SelectItem value="entro90">Entro tre mesi</SelectItem>
            <SelectItem value="senza_data">Senza data</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statoFiltro} onValueChange={setStatoFiltro}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {Object.entries(STATI).map(([k, s]) => <SelectItem key={k} value={k}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={esporta} disabled={!filtrate.length}>
          <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
        </Button>
      </div>

      <Tabs defaultValue="elenco">
        <TabsList>
          <TabsTrigger value="elenco">Elenco ({formatIntero(filtrate.length)})</TabsTrigger>
          <TabsTrigger value="divergenze">
            Divergenze{daVerificare.length ? ` (${formatIntero(daVerificare.length)})` : ''}
          </TabsTrigger>
          {isAdmin && <TabsTrigger value="aggiorna">Aggiorna dai file</TabsTrigger>}
        </TabsList>

        <TabsContent value="elenco" className="mt-4">
          {caricamento ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Leggo le omologhe…</div>
          ) : !filtrate.length ? (
            <div className="border rounded-lg bg-card px-4 py-10 text-center text-muted-foreground text-sm">
              {righe.length ? 'Nessun produttore con questi filtri.' : 'Ancora nessuna omologa: aggiorna il modulo dai due file.'}
            </div>
          ) : (
            <div className="border rounded-lg bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Produttore</th>
                    <th className="text-left px-2 py-2">Canale</th>
                    <th className="text-left px-2 py-2">PDR</th>
                    <th className="text-left px-2 py-2">Omologa</th>
                    <th className="text-left px-2 py-2">Scadenza</th>
                    <th className="text-left px-2 py-2">Registro</th>
                    <th className="text-left px-2 py-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrate.map(r => {
                    const f = FASCE[r.fascia];
                    const st = STATI[r.stato || 'da_verificare'];
                    return (
                      <tr key={r.id} className={`border-t ${f.riga}`}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${f.punto}`} title={f.etichetta} />
                            <span className={f.testo}>{r.produttore}</span>
                          </div>
                          {(() => {
                            try {
                              const s = JSON.parse(r.storico_json || '[]');
                              return s.length ? <div className="text-xs text-muted-foreground">rinnovata · prima: {s.map(x => `${dataIt(x.da)}–${dataIt(x.a)}`).join(', ')}</div> : null;
                            } catch (_e) { return null; }
                          })()}
                          {r.canale === 'ACI' && r.esito === false && (
                            <div className="text-xs text-red-700">
                              esito dell'omologa negativo nell'elenco{r.registro_carichi ? ` · ${formatIntero(r.registro_carichi)} carichi all'impianto` : ''}
                            </div>
                          )}
                          {r.nell_elenco === false && r.nel_registro === false && (
                            <div className="text-xs text-muted-foreground">non compare più nei due fogli</div>
                          )}
                        </td>
                        <td className="px-2 py-2">{r.canale || 'RETE'}</td>
                        <td className="px-2 py-2 text-xs tabular-nums">
                          {(r.pdr_collegati || []).length > 0 && <div title="Trovati con i numeri di formulario dei carichi">{r.pdr_collegati.join(', ')}</div>}
                          {(r.pdr_manuali || []).length > 0 && <div title="Collegati a mano">{r.pdr_manuali.join(', ')} <span className="text-muted-foreground">a mano</span></div>}
                          {!(r.pdr_collegati || []).length && !(r.pdr_manuali || []).length && <span className="text-muted-foreground">—</span>}
                          {isAdmin && (
                            <button type="button" className="block text-primary underline-offset-2 hover:underline" disabled={!!inCorso} onClick={() => collegaPdr(r)}>
                              {inCorso === r.id + 'pdr' ? 'salvo…' : (r.pdr_manuali || []).length ? 'modifica' : 'collega'}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-2 tabular-nums whitespace-nowrap">
                          {dataIt(r.omologa_da)} → {dataIt(r.omologa_a)}
                          {r.validita_da_registro && <div className="text-xs text-muted-foreground">dalla prima annotazione nel registro</div>}
                          {!r.validita_da_registro && r.scadenza_effettiva && r.omologa_a && r.scadenza_effettiva < r.omologa_a && (
                            <div className="text-xs text-amber-700">contata fino al {dataIt(r.scadenza_effettiva)}</div>
                          )}
                        </td>
                        <td className={`px-2 py-2 whitespace-nowrap ${f.testo}`}>{scadenzaTesto(r.giorni)}</td>
                        <td className="px-2 py-2 text-xs">
                          {r.nel_registro
                            ? <>recepita il {dataIt(r.registro_data)}{r.registro_carichi > 1 ? ` · ${formatIntero(r.registro_carichi)} carichi` : ''}</>
                            : r.registro_carichi > 0
                              ? <span className="text-amber-700">{formatIntero(r.registro_carichi)} {r.registro_carichi === 1 ? 'carico' : 'carichi'} senza annotazione</span>
                              : <span className="text-muted-foreground">nessun carico all'impianto</span>}
                        </td>
                        <td className="px-2 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-xs ${st.classe}`}>{st.nome}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
            {['scaduta', 'critica', 'vicina', 'avviso', 'lontana', 'valida'].map(k => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${FASCE[k].punto}`} /> {FASCE[k].etichetta}
              </span>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="divergenze" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={tipoDiv} onValueChange={(v) => { setTipoDiv(v); setSelezionate(new Set()); }}>
              <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutte">Tutte le divergenze</SelectItem>
                {['solo_registro', 'solo_elenco', 'data_diversa', 'nome_diverso'].map(t => (
                  <SelectItem key={t} value={t}>{NOME_DIVERGENZA[t]} ({formatIntero(conGiorni.filter(r => r.tipo_divergenza === t).length)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statoDiv} onValueChange={(v) => { setStatoDiv(v); setSelezionate(new Set()); }}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aperte">Da verificare e in sospeso</SelectItem>
                {Object.entries(STATI).map(([k, s]) => <SelectItem key={k} value={k}>{s.nome}</SelectItem>)}
                <SelectItem value="tutte">Tutti gli stati</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!divergenti.length ? (
            <div className="border rounded-lg bg-card px-4 py-10 text-center text-muted-foreground text-sm">
              {conGiorni.some(r => (r.tipo_divergenza || 'nessuna') !== 'nessuna')
                ? 'Nessuna divergenza con questi filtri.'
                : 'I due fogli dicono la stessa cosa su tutti i produttori.'}
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-3 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  {formatIntero(daVerificare.length)} {daVerificare.length === 1 ? 'divergenza aspetta' : 'divergenze aspettano'} un controllo.
                  Nessuna viene decisa dal gestionale: si guardano i documenti in ufficio e si segna qui l'esito —
                  <strong> Recepita</strong> se il documento c'è, <strong>In sospeso</strong> finché non si sa,
                  <strong> Annulla</strong> se il produttore non va più seguito.
                </div>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2 border rounded-lg bg-card px-3 py-2 sticky top-0 z-10">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={divergenti.length > 0 && divergenti.every(r => selezionate.has(r.id))}
                      onChange={(e) => setSelezionate(e.target.checked ? new Set(divergenti.map(r => r.id)) : new Set())}
                    />
                    Seleziona le {formatIntero(divergenti.length)} mostrate
                  </label>
                  <span className="text-sm text-muted-foreground">· {formatIntero(selezionate.size)} selezionate</span>
                  <div className="flex-1" />
                  {inBlocco ? (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> salvo {inBlocco}…</span>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" className="h-8" disabled={!selezionate.size || !!inCorso} onClick={() => decidiSelezionate('recepita')}><Check className="w-3.5 h-3.5 mr-1" /> Recepite</Button>
                      <Button size="sm" variant="outline" className="h-8" disabled={!selezionate.size || !!inCorso} onClick={() => decidiSelezionate('in_sospeso')}><PauseCircle className="w-3.5 h-3.5 mr-1" /> In sospeso</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-red-600" disabled={!selezionate.size || !!inCorso} onClick={() => decidiSelezionate('annullata')}><XCircle className="w-3.5 h-3.5 mr-1" /> Annulla</Button>
                    </>
                  )}
                </div>
              )}
              {divergenti.map(r => {
                const st = STATI[r.stato || 'da_verificare'];
                return (
                  <div key={r.id} className={`border rounded-lg bg-card p-4 space-y-2 ${selezionate.has(r.id) ? 'ring-2 ring-primary/40' : ''}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold flex items-center gap-2">
                        {isAdmin && <input type="checkbox" checked={selezionate.has(r.id)} onChange={() => scegli(r.id)} aria-label={`Seleziona ${r.produttore}`} />}
                        {r.produttore}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-muted">{NOME_DIVERGENZA[r.tipo_divergenza]}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${st.classe}`}>{st.nome}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{SPIEGA_DIVERGENZA[r.tipo_divergenza]}</p>
                    <div className="grid gap-2 sm:grid-cols-2 text-sm">
                      <div className="border rounded p-2">
                        <div className="text-xs text-muted-foreground">Nel nostro elenco</div>
                        {r.nell_elenco
                          ? <div>{r.produttore} · {r.canale || 'RETE'} · omologa {dataIt(r.omologa_da)} → {dataIt(r.omologa_a)}</div>
                          : <div className="text-muted-foreground">non c'è</div>}
                      </div>
                      <div className="border rounded p-2">
                        <div className="text-xs text-muted-foreground">Nel registro dell'impianto</div>
                        {r.nel_registro
                          ? <div>{r.registro_nome} · recepita il {dataIt(r.registro_data)}{r.registro_riga ? ` · riga ${formatIntero(r.registro_riga)}` : ''}</div>
                          : <div className="text-muted-foreground">nessuna annotazione</div>}
                        {r.registro_carichi > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {formatIntero(r.registro_carichi)} {r.registro_carichi === 1 ? 'carico' : 'carichi'} in tutto, il primo il {dataIt(r.registro_primo_carico)}
                          </div>
                        )}
                      </div>
                    </div>
                    {r.nota && (
                      <div className="text-sm border-l-2 border-primary/40 pl-3">
                        <span className="text-xs text-muted-foreground">Nota{r.deciso_da ? ` di ${r.deciso_da}` : ''}:</span> {r.nota}
                      </div>
                    )}
                    {isAdmin && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Nota della verifica (facoltativa)"
                          value={note[r.id] !== undefined ? note[r.id] : (r.nota || '')}
                          onChange={(e) => setNote({ ...note, [r.id]: e.target.value })}
                        />
                        <Azioni r={r} />
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="aggiorna" className="mt-4 space-y-4">
            <div className="border rounded-lg bg-card p-4 space-y-3 max-w-3xl">
              <p className="text-sm text-muted-foreground">
                Servono tutti e due i file, perché le divergenze nascono dal confronto: l'elenco delle omologhe e il registro
                di carico e scarico dell'impianto. Restano sul tuo computer: al gestionale arrivano solo i produttori e le date.
                Le decisioni già prese qui non si perdono.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Elenco delle omologhe (foglio «Omologhe Irigom»)</label>
                  <input ref={fileElenco} type="file" accept=".xlsx,.xls" className="block w-full text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Registro di carico e scarico (foglio «Dettaglio»)</label>
                  <input ref={fileRegistro} type="file" accept=".xlsx,.xls" className="block w-full text-sm mt-1" />
                </div>
              </div>
              <Button onClick={aggiorna} disabled={!!aggiornando}>
                {aggiornando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                {aggiornando || "Aggiorna l'elenco"}
              </Button>
              {aggiornando && <p className="text-xs text-amber-700">Il registro è grande: la lettura può richiedere qualche secondo. Non chiudere la pagina.</p>}
            </div>

            {esito && (
              <div className="border rounded-lg bg-card p-4 space-y-1 text-sm max-w-3xl">
                <div className="font-semibold">Aggiornamento eseguito</div>
                <div>{formatIntero(esito.righe_elenco)} produttori nell'elenco, {formatIntero(esito.righe_registro)} annotati nel registro.</div>
                <div>{formatIntero(esito.nuovi)} nuovi, {formatIntero(esito.aggiornati)} aggiornati{esito.scomparsi ? `, ${formatIntero(esito.scomparsi)} non più presenti nei file` : ''}.</div>
                {esito.collegati_pdr !== undefined && <div>{formatIntero(esito.collegati_pdr)} produttori collegati ai loro PDR tramite i formulari.</div>}
                <div className="pt-1">
                  Divergenze: {formatIntero(esito.divergenze.solo_registro)} non in elenco, {formatIntero(esito.divergenze.solo_elenco)} conferiti senza annotazione,
                  {' '}{formatIntero(esito.divergenze.data_diversa)} con date lontane, {formatIntero(esito.divergenze.nome_diverso)} con nome diverso.
                </div>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
