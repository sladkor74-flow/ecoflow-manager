import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { formatIntero } from '@/lib/utils';
import { leggiElencoOmologhe, leggiRegistroOmologhe } from '@/lib/omologhe';
import { leggiDichiarazioniRentri } from '@/lib/dichiarazioniRentri';
import { dimenticaIndiceOmologhe } from '@/lib/omologheIndice';
import { dimenticaIndiceRentri } from '@/lib/rentriIndice';
import { Loader2, Upload } from 'lucide-react';

// Un solo caricamento per Omologhe e Dichiarazioni RENTRI.
//
// Il file di gestione contiene i fogli di entrambi i moduli; le omologhe vogliono
// anche il registro di carico e scarico dell'impianto, perche' le divergenze nascono
// dal confronto. Si scelgono i moduli da aggiornare e si fa tutto in un passaggio.
// I file restano sul computer: al gestionale arrivano solo produttori, date e valori.

function Esito({ titolo, righe }) {
  return (
    <div className="border rounded-lg bg-card p-4 space-y-1 text-sm">
      <div className="font-semibold">{titolo}</div>
      {righe.filter(Boolean).map((r, i) => <div key={i}>{r}</div>)}
    </div>
  );
}

export default function AggiornaGestione({ onAggiornato }) {
  const { toast } = useToast();
  const fileGestione = useRef(null);
  const fileRegistro = useRef(null);
  const [omologhe, setOmologhe] = useState(true);
  const [rentri, setRentri] = useState(true);
  const [passo, setPasso] = useState(null);
  const [esiti, setEsiti] = useState({});

  const aggiorna = async () => {
    const gestione = fileGestione.current && fileGestione.current.files[0];
    const registro = fileRegistro.current && fileRegistro.current.files[0];
    if (!gestione) {
      toast({ title: 'Manca il file di gestione', description: 'Serve il file con i fogli «Omologhe Irigom» e «Dichiarazioni Rentri».', variant: 'destructive' });
      return;
    }
    if (!omologhe && !rentri) {
      toast({ title: 'Nessun modulo scelto', description: 'Spunta almeno uno dei due moduli.', variant: 'destructive' });
      return;
    }
    if (omologhe && !registro) {
      toast({ title: 'Per le omologhe serve anche il registro', description: "Senza il registro dell'impianto non si possono trovare le divergenze. Aggiungilo, oppure togli la spunta alle omologhe.", variant: 'destructive' });
      return;
    }
    setEsiti({});
    const nuovi = {};
    try {
      if (rentri) {
        setPasso('leggo le dichiarazioni RENTRI…');
        const righe = await leggiDichiarazioniRentri(gestione);
        setPasso(`collego ${formatIntero(righe.length)} dichiarazioni ai PDR…`);
        const res = await base44.functions.invoke('importaDichiarazioniRentri', { righe });
        nuovi.rentri = res.data;
        dimenticaIndiceRentri();
        setEsiti({ ...nuovi });
      }
      if (omologhe) {
        setPasso("leggo l'elenco delle omologhe…");
        const elenco = await leggiElencoOmologhe(gestione);
        setPasso('leggo il registro di carico e scarico…');
        const { annotati, conferitori } = await leggiRegistroOmologhe(registro);
        setPasso(`confronto ${formatIntero(elenco.length)} omologhe con ${formatIntero(annotati.length)} annotazioni…`);
        const res = await base44.functions.invoke('importaOmologhe', { elenco, registro: annotati, conferitori });
        nuovi.omologhe = res.data;
        dimenticaIndiceOmologhe();
        setEsiti({ ...nuovi });
      }
      toast({ title: 'Aggiornamento eseguito', description: [nuovi.omologhe && 'omologhe', nuovi.rentri && 'dichiarazioni RENTRI'].filter(Boolean).join(' e ') });
      if (onAggiornato) await onAggiornato();
    } catch (e) {
      const msg = (e && e.data && e.data.error) || e.message || String(e);
      toast({ title: 'Aggiornamento non riuscito', description: msg, variant: 'destructive' });
    }
    setPasso(null);
  };

  const o = esiti.omologhe;
  const r = esiti.rentri;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="border rounded-lg bg-card p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Un solo caricamento aggiorna entrambi i moduli. Il file di gestione contiene i fogli «Omologhe Irigom» e «Dichiarazioni
          Rentri»; per le omologhe serve anche il registro di carico e scarico dell'impianto. I file restano sul tuo computer e le
          decisioni già prese nei moduli non si perdono. Le colonne del portale nelle dichiarazioni si aggiornano invece ricaricando
          il file PDR nel modulo PDR.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">File di gestione (Gestione Ecotyre)</label>
            <input ref={fileGestione} type="file" accept=".xlsx,.xls" className="block w-full text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Registro di carico e scarico (solo per le omologhe)</label>
            <input ref={fileRegistro} type="file" accept=".xlsx,.xls" className="block w-full text-sm mt-1" />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={omologhe} onChange={(e) => setOmologhe(e.target.checked)} /> Omologhe</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={rentri} onChange={(e) => setRentri(e.target.checked)} /> Dichiarazioni RENTRI</label>
        </div>
        <Button onClick={aggiorna} disabled={!!passo}>
          {passo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
          {passo || 'Aggiorna'}
        </Button>
        {passo && <p className="text-xs text-amber-700">I file sono grandi: la lettura può richiedere qualche secondo. Non chiudere la pagina.</p>}
      </div>

      {r && (
        <Esito titolo="Dichiarazioni RENTRI aggiornate" righe={[
          `${formatIntero(r.totale)} produttori: ${formatIntero(r.nuove)} nuovi, ${formatIntero(r.aggiornate)} aggiornati${r.scomparse ? `, ${formatIntero(r.scomparse)} non più nel foglio` : ''}${r.doppie ? `, ${formatIntero(r.doppie)} righe doppie` : ''}.`,
          `Collegati ai PDR: ${formatIntero(r.collegamenti.codice)} con il codice RENTRI, ${formatIntero(r.collegamenti.nome)} per nome, ${formatIntero(r.collegamenti.manuale)} a mano; ${formatIntero(r.collegamenti.simile)} da confermare e ${formatIntero(r.collegamenti.nessuno)} da collegare.`,
        ]} />
      )}
      {o && (
        <Esito titolo="Omologhe aggiornate" righe={[
          `${formatIntero(o.righe_elenco)} produttori nell'elenco, ${formatIntero(o.righe_registro)} annotati nel registro.`,
          `${formatIntero(o.nuovi)} nuovi, ${formatIntero(o.aggiornati)} aggiornati${o.scomparsi ? `, ${formatIntero(o.scomparsi)} non più presenti nei file` : ''}.`,
          o.collegati_pdr !== undefined ? `${formatIntero(o.collegati_pdr)} produttori collegati ai loro PDR tramite i formulari.` : null,
          `Divergenze: ${formatIntero(o.divergenze.solo_registro)} non in elenco, ${formatIntero(o.divergenze.solo_elenco)} conferiti senza annotazione, ${formatIntero(o.divergenze.data_diversa)} con date lontane, ${formatIntero(o.divergenze.nome_diverso)} con nome diverso.`,
        ]} />
      )}
    </div>
  );
}
