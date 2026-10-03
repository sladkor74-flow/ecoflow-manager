import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calculator, CheckCircle2, XCircle, ExternalLink, FileSpreadsheet, FileDown, ClipboardList, ListPlus } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import PassivaRaccoglitoriTable from './PassivaRaccoglitoriTable';
import PassivaImpiantiTable from './PassivaImpiantiTable';
import PassivaSecondariaTable from './PassivaSecondariaTable';
import PassivaAnomalie from './PassivaAnomalie';
import PassivaFormulariRipartiti from './PassivaFormulariRipartiti';
import PassivaQualifica from './PassivaQualifica';
import { exportFatturazionePassiva, exportFatturazionePassivaPdf } from '@/lib/passivaExport';
import { cartellaPassivaUnFoglio, cartellaPassivaPerCanale } from '@/lib/passivaAmministrazioneExcel';
import { esportaPassivaAmministrazionePdf } from '@/lib/passivaAmministrazionePdf';
import { fogliDa, nomeFilePassiva } from '@/lib/passivaAmministrazione';
import { modelloAmministrazione, quanteVociModello } from '@/lib/modelloPassivaAmministrazione';
import { scarica } from '@/lib/docxModello';
import VociPassivaDialog from './VociPassivaDialog';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const ANNI = [2024, 2025, 2026];

const TIPOLABEL = { 'RETE': 'Rete', 'ACI': 'ACI', 'EXTRA_RACCOLTA': 'Extra Raccolta' };

export default function PassivaModulo({ tipologia, periodo, setPeriodo }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // IL «FORMAT AMMINISTRAZIONE» DELLA PASSIVA.
  //
  // Il foglio dell'amministrazione tiene i canali INSIEME, uno sotto l'altro,
  // mentre questo modulo ne calcola uno per volta: qui si calcolano i canali che
  // servono e si compone il foglio. L'extra raccolta resta fuori per ora, come ha
  // detto l'utente il 03/10/2026.
  //
  // Le VOCI sono il modello fisso che l'utente corregge: se non ce n'e' nessuna
  // non si esporta un foglio vuoto - si propone di crearlo dal mese appena
  // calcolato, cosi' non si comincia da zero.
  const [ammLoading, setAmmLoading] = useState(false);
  const [vociAperte, setVociAperte] = useState(false);
  const CANALI_AMM = ['RETE', 'ACI'];
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const esportaAmministrazione = async (come) => {
    setAmmLoading(true);
    setError('');
    try {
      const voci = await base44.entities.VocePassivaAmministrazione.filter({ anno: periodo.anno }, 'ordine', 1000).catch(() => []);
      const per = {};
      for (const canale of CANALI_AMM) {
        const res = await base44.functions.invoke('calcolaPassiva', { anno: periodo.anno, mese: periodo.mese, tipologia: canale });
        per[canale] = res.data || res;
      }
      // Senza voci il foglio uscirebbe vuoto. Si propone il modello
      // dell'amministrazione - le sue righe e i suoi prezzi, quelli con cui
      // settembre 2026 torna al centesimo - e poi l'utente lo corregge dal
      // pulsante «Voci del foglio».
      if (!voci.length) {
        if (!window.confirm(`Il modello delle voci di ${periodo.anno} e' vuoto: il foglio uscirebbe senza righe.

Carico adesso il modello dell'amministrazione? Sono ${quanteVociModello()} voci - i fornitori, le loro righe e i prezzi del foglio di settembre 2026 - e restano tutte modificabili dal pulsante «Voci del foglio».`)) {
          setAmmLoading(false);
          return;
        }
        const proposta = modelloAmministrazione(periodo.anno);
        for (const v of proposta) await base44.entities.VocePassivaAmministrazione.create(v);
        voci.push(...proposta);
      }
      const fogli = fogliDa(voci, per, periodo.mese, periodo.anno);
      if (come === 'pdf') {
        await esportaPassivaAmministrazionePdf(fogli, { anno: periodo.anno, mese: periodo.mese });
      } else {
        const bytes = come === 'canali' ? await cartellaPassivaPerCanale(fogli) : await cartellaPassivaUnFoglio(fogli);
        scarica(new Blob([bytes], { type: XLSX_MIME }), nomeFilePassiva(periodo.anno, periodo.mese, come === 'canali' ? 'canali' : 'unico', 'xlsx'));
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Esportazione non riuscita');
    }
    setAmmLoading(false);
  };

  const calcola = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('calcolaPassiva', {
        anno: periodo.anno, mese: periodo.mese, tipologia,
      });
      setResult(res.data || res);
    } catch (e) {
      setError(e.message || 'Errore durante il calcolo');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Selettori e pulsante */}
      <div className="flex flex-wrap items-end gap-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Anno</label>
          <Select value={String(periodo.anno)} onValueChange={v => setPeriodo({ ...periodo, anno: Number(v) })}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{ANNI.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Mese</label>
          <Select value={periodo.mese} onValueChange={v => setPeriodo({ ...periodo, mese: v })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{MESI.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={calcola} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Calculator className="w-4 h-4 mr-1.5" />}
          Calcola
        </Button>
        {/* Un file per canale, come nell'attiva: rete, ACI ed extra raccolta non si sommano */}
        <Button variant="outline" disabled={!result || loading} title={!result ? 'Prima calcola il mese' : ''}
          onClick={() => { try { exportFatturazionePassiva(result); } catch (e) { setError(e.message || 'Esportazione non riuscita'); } }}>
          <FileSpreadsheet className="w-4 h-4 mr-1.5" /> {TIPOLABEL[tipologia]} in Excel
        </Button>
        <Button variant="outline" disabled={!result || loading} title={!result ? 'Prima calcola il mese' : ''}
          onClick={async () => { try { await exportFatturazionePassivaPdf(result); } catch (e) { setError(e.message || 'Esportazione non riuscita'); } }}>
          <FileDown className="w-4 h-4 mr-1.5" /> {TIPOLABEL[tipologia]} in PDF
        </Button>
        {/* IL FORMAT AMMINISTRAZIONE, in aggiunta ai due report di sopra. Calcola da
            se' i canali che gli servono, perche' il foglio li tiene insieme. */}
        <Button variant="outline" disabled={ammLoading || loading} title="Il foglio come lo vuole l amministrazione: i canali uno sotto l altro, in un foglio solo"
          onClick={() => esportaAmministrazione('unico')}>
          {ammLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ClipboardList className="w-4 h-4 mr-1.5" />} Format amm. (un foglio)
        </Button>
        <Button variant="outline" disabled={ammLoading || loading} title="Lo stesso contenuto, un foglio per canale nella stessa cartella di lavoro"
          onClick={() => esportaAmministrazione('canali')}>
          <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Format amm. (per canale)
        </Button>
        <Button variant="outline" disabled={ammLoading || loading} title="Lo stesso foglio in PDF"
          onClick={() => esportaAmministrazione('pdf')}>
          <FileDown className="w-4 h-4 mr-1.5" /> Format amm. PDF
        </Button>
        {/* Le voci sono il modello fisso del foglio: i fornitori, le loro righe e i
            prezzi. Si correggono qui, senza passare dal codice. */}
        <Button variant="ghost" disabled={ammLoading || loading} title="I fornitori, le loro righe e i prezzi con cui si compone il foglio dell amministrazione"
          onClick={() => setVociAperte(true)}>
          <ListPlus className="w-4 h-4 mr-1.5" /> Voci del foglio
        </Button>
        {tipologia === 'EXTRA_RACCOLTA' && (
          <Link to="/extra-raccolta" className="ml-auto text-sm text-primary hover:underline inline-flex items-center gap-1">
            <ExternalLink className="w-3.5 h-3.5" /> Inserisci o modifica gli interventi
          </Link>
        )}
      </div>

      {/* Regole dell'utente del 22/09/2026: i costi di un intervento li scrive lui
          prima di passarlo a terminato, e la passiva paga quelli */}
      {tipologia === 'EXTRA_RACCOLTA' && (
        <p className="text-xs text-muted-foreground">
          Si pagano i costi di raccolta, stoccaggio e trattamento scritti su ciascun intervento, mai le tariffe di rete. Entrano solo gli interventi terminati, nel mese della fine trasporto; un terminato a cui manca una delle tre date obbligatorie (immissione, inizio e fine trasporto) si segnala fra le anomalie.
        </p>
      )}

      {error && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded">{error}</div>}

      {result && (
        <>
          {/* Riepilogo totali + quadratura */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground">Raccoglitori</div>
              <div className="text-lg font-bold tabular-nums">€ {formatNumber(result.totali.raccoglitori, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground">Impianti e stoccaggi</div>
              <div className="text-lg font-bold tabular-nums">€ {formatNumber(result.totali.impianti_stoccaggi, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground">Trasporti secondaria</div>
              <div className="text-lg font-bold tabular-nums">€ {formatNumber(result.totali.trasporti_secondaria, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="border-2 rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground">Totale complessivo</div>
              <div className="text-lg font-bold tabular-nums">€ {formatNumber(result.totali.totale_complessivo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          {/* Quadratura tonnellate */}
          <div className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg border-2 ${result.quadratura.coincidente ? 'text-success border-success/30 bg-success/5' : 'text-destructive border-destructive/30 bg-destructive/5'}`}>
            {result.quadratura.coincidente
              ? <><CheckCircle2 className="w-4 h-4" /> Quadratura OK: {formatNumber(result.quadratura.tonnellate_totali)} t</>
              : <><XCircle className="w-4 h-4" /> Quadratura: {formatNumber(result.quadratura.tonnellate_totali)} t contro {formatNumber(result.quadratura.tonnellate_raccoglitori)} t</>}
          </div>

          {/* Fornitori del mese con documenti di qualifica scaduti o non conformi */}
          <PassivaQualifica result={result} anno={result.anno} />

          {/* Anomalie */}
          <PassivaAnomalie anomalie={result.anomalie} />

          {/* Formulari il cui peso e' stato ripartito su piu' ordini */}
          <PassivaFormulariRipartiti formulari={result.formulari_ripartiti} />

          {/* Tabelle */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Raccoglitori (RACCOLTA)</h3>
              <PassivaRaccoglitoriTable data={result.raccoglitori} />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Impianti e stoccaggi (TRATTAMENTO / CONFERIMENTO_STOCCAGGIO)</h3>
              <PassivaImpiantiTable data={result.impianti_stoccaggi} />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Trasporti secondaria (TRASPORTO_SECONDARIA)</h3>
              <PassivaSecondariaTable data={result.trasporti_secondaria} tipologia={tipologia} />
            </div>
          </div>
        </>
      )}

      {/* Le voci del format amministrazione: il modello fisso del foglio */}
      <VociPassivaDialog aperto={vociAperte} chiudi={() => setVociAperte(false)} anno={periodo.anno} />
    </div>
  );
}