import React, { useState, useMemo } from 'react';
import { anniDaScegliere } from '@/lib/periodoPagine';
import { oggiRoma } from '@/lib/giornoItaliano';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { fetchAllClient } from '@/lib/fetchAllClient';
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
import { DiCuiSurplus, FasceSurplus, nomeSurplusDelMese } from './PassivaSurplus';
import { exportFatturazionePassiva, exportFatturazionePassivaPdf } from '@/lib/passivaExport';
import { cartellaPassivaUnFoglio, cartellaPassivaPerCanale } from '@/lib/passivaAmministrazioneExcel';
import { esportaPassivaAmministrazionePdf } from '@/lib/passivaAmministrazionePdf';
import { fogliDa, nomeFilePassiva } from '@/lib/passivaAmministrazione';
import { modelloAmministrazione, quanteVociModello, ANNO_PREZZI_MODELLO } from '@/lib/modelloPassivaAmministrazione';
import { bloccoExtraRaccolta } from '@/lib/extraRaccoltaAmministrazione';
import { contestoPrezzi } from '@/lib/extraRaccoltaCalc';
import * as subfornitori from '@/lib/subfornitori';
import { scarica } from '@/lib/docxModello';
import { creaMoltiConTraccia, avvisoTraccia } from '@/lib/scriviConTraccia';
import VociPassivaDialog from './VociPassivaDialog';
import AvvisoCaricamenti from '@/components/shared/AvvisoCaricamenti';
import { TIPI_PASSIVA, tipiDeiCanali } from '@/lib/registroCaricamenti';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const TIPOLABEL = { 'RETE': 'Rete', 'ACI': 'ACI', 'EXTRA_RACCOLTA': 'Extra Raccolta' };

export default function PassivaModulo({ tipologia, periodo, setPeriodo }) {
  // Gli anni si contano quando la pagina si disegna, non quando il modulo si
  // carica (prova del cambio d'anno, 15/10/2026): con la scheda aperta dal
  // 31/12, il 04/01 la lista restava ferma al 2026. Come la Dashboard.
  const oggi = oggiRoma();
  const anni = useMemo(() => anniDaScegliere({ oggi }), [oggi]);
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
  const [notaStorico, setNotaStorico] = useState('');
  // IL FOGLIO DELL'AMMINISTRAZIONE CON PREZZI CHE MANCANO (prova del cambio
  // d'anno, 15/10/2026). A gennaio 2027, senza le tariffe 2027, il foglio
  // prezzava i movimenti coi prezzi delle voci del 2026 senza dirlo. Ora quelle
  // righe restano «—» e fuori dal totale (D5, decisione dell'utente del
  // 15/10/2026), e la pagina lo dice sopra, canale per canale, appena il foglio
  // e' fatto: chi lo manda all'amministrazione sa che il totale e' parziale.
  const [avvisoFoglio, setAvvisoFoglio] = useState('');
  // L'EXTRA RACCOLTA C'E', e ha un blocco tutto suo. L'utente, 03/10/2026: «nella
  // fatturazione passiva tutto cio' che riguarda l'extra raccolta deve rientrare
  // solo quando in quel determinato mese effettivamente sono stati chiusi quei
  // movimenti e le info vanno riprese dal modulo 'extra raccolta', compresi i
  // prezzi». Percio' per questo canale non si chiede niente al calcolo della
  // passiva: le righe sono gli interventi del modulo, coi loro prezzi. E dal
  // modulo viene anche il surplus sulle tariffe (13/10/2026): il blocco lo conta
  // col contesto della pagina dell'extra raccolta (i surplus, l'anagrafica, la
  // catena dei subfornitori), una riga per fornitore col centesimo del mese.
  const CANALI_AMM = ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const esportaAmministrazione = async (come) => {
    setAmmLoading(true);
    setError('');
    setAvvisoFoglio('');
    try {
      // TUTTO, CON LA STESSA REGOLA DEL CALCOLO (chiusura dell'audit,
      // 11/10/2026). Qui si leggevano le voci fino a 1000, le tariffe 'attivo'
      // fino a 2000 e gli interventi fino a 5000, e un errore di lettura diventava
      // un elenco vuoto: oltre le soglie i record piu' vecchi sparivano senza
      // dirlo, e con le voci lette vuote per un errore si proponeva di ricaricare
      // il modello - doppio. Ora si legge tutto (fetchAllClient) e un errore si
      // dice. Le tariffe sono quelle che legge calcolaPassiva (direzione PASSIVA,
      // nessun filtro sullo stato): quale vale in un giorno lo decide la regola
      // unica di validitaTariffa, dove 'non_attivo' non vale mai.
      const voci = await fetchAllClient(base44.entities.VocePassivaAmministrazione, { anno: periodo.anno }, 'ordine');
      // IL PREZZO VIENE DAL TARIFFARIO, non da quello che e' scritto sulla voce:
      // «gli altri prezzi li dovresti gia' avere nel tariffario 2026 anche perche'
      // hai letto tutti i loro contratti» (utente, 03/10/2026). Sulle righe con
      // movimenti il prezzo e' quello che il calcolo ha applicato; sulle righe a
      // zero si legge la tariffa in vigore quel mese, e quella sta qui.
      const tariffe = await fetchAllClient(base44.entities.Tariffa, { direzione: 'PASSIVA' }, '-created_date');
      const per = {};
      for (const canale of CANALI_AMM) {
        if (canale === 'EXTRA_RACCOLTA') {
          // Il canale c'e' nel foglio, ma il suo contenuto non viene dal calcolo:
          // viene dagli interventi. Un oggetto vuoto basta a tenerlo nell'elenco.
          per[canale] = {};
          continue;
        }
        const res = await base44.functions.invoke('calcolaPassiva', { anno: periodo.anno, mese: periodo.mese, tipologia: canale });
        per[canale] = res.data || res;
      }
      // Gli interventi: tutti, e il blocco si prende quelli terminati con la fine
      // trasporto nel mese, col giorno italiano. Il surplus sulle tariffe degli
      // interventi (13/10/2026) lo conta il blocco col contesto della pagina
      // dell'extra raccolta: i surplus letti tutti (il disattivato lo toglie il
      // conto, come per le tariffe), l'anagrafica intera (chi e' interno, chi
      // fattura per chi) e la catena dei subfornitori. Due letture per foglio,
      // non per intervento ne' per fornitore.
      // LE SECONDARIE DI EXTRA RACCOLTA SONO TRASPORTI DI SECONDARIA (decisione
      // dell'utente del 13/10/2026): il prezzo e' il contratto della tratta del
      // vettore, cioe' le tariffe passive gia' lette qui sopra, quinto argomento
      // di contestoPrezzi. Senza, il blocco pagava una secondaria col prezzo
      // scritto sull'intervento (o zero, «contratto della tratta non letto»),
      // mentre la passiva usa il contratto: 0 + 40 nel foglio contro 600 + 40
      // nella passiva (chiusura del giro, 14/10/2026). Nessuna lettura in piu'.
      const interventi = await fetchAllClient(base44.entities.ExtraRaccolta, null, '-created_date');
      const surplusAll = await fetchAllClient(base44.entities.SurplusTariffa, null, '-created_date');
      const fornitori = await fetchAllClient(base44.entities.Fornitore, null, 'ragione_sociale');
      const extra = bloccoExtraRaccolta(interventi, periodo.anno, periodo.mese, contestoPrezzi([], fornitori, surplusAll, subfornitori, tariffe));
      // Senza voci il foglio uscirebbe vuoto. Si propone il modello
      // dell'amministrazione - le sue righe e i suoi prezzi, quelli con cui
      // settembre 2026 torna al centesimo - e poi l'utente lo corregge dal
      // pulsante «Voci del foglio».
      //
      // Si contano le voci CON UN SOGGETTO, non tutte: in archivio sono rimaste
      // quattro righe senza nome, nate da una proposta automatica sbagliata, e
      // quelle non agganciano nessun movimento. Contandole, il gestionale
      // avrebbe creduto di avere un modello e avrebbe scritto un foglio vuoto
      // senza dire niente.
      const utili = voci.filter(v => v && String(v.soggetto || '').trim());
      if (!utili.length) {
        if (!window.confirm(`Il modello delle voci di ${periodo.anno} e' vuoto: il foglio uscirebbe senza righe.

Carico adesso il modello dell'amministrazione? Sono ${quanteVociModello()} voci - i fornitori, le loro righe e i prezzi del foglio di settembre ${ANNO_PREZZI_MODELLO} - e restano tutte modificabili dal pulsante «Voci del foglio».${Number(periodo.anno) > ANNO_PREZZI_MODELLO ? `

I prezzi sono dei contratti ${ANNO_PREZZI_MODELLO}, scaduti: nel foglio del ${periodo.anno} le righe con movimenti senza la tariffa ${periodo.anno} restano senza prezzo, e la nota dice il prezzo della voce e il suo anno.` : ''}`)) {
          setAmmLoading(false);
          return;
        }
        // Le voci del modello nascono nello storico delle modifiche: sono prezzi
        // che fanno la passiva, e chi li cambia dopo deve vedere da dove partivano.
        const proposta = modelloAmministrazione(periodo.anno);
        const esito = await creaMoltiConTraccia('VocePassivaAmministrazione', proposta, { origine: 'Fatturazione passiva', motivo: `modello del foglio dell'amministrazione per il ${periodo.anno}` });
        const avviso = avvisoTraccia(esito);
        if (avviso) setNotaStorico(`${avviso.title}: ${avviso.description}`);
        voci.push(...proposta);
      }
      const fogli = fogliDa(voci, per, periodo.mese, periodo.anno, tariffe, extra);
      const parziali = fogli.filter(f => f && f.senza_prezzo && f.senza_prezzo.testo);
      // Il rimedio secondo la ragione (revisione del 15/10/2026): una tariffa
      // che manca si scrive, una copiata dall'anno prima si conferma (D4).
      const copiate = parziali.some(f => f.senza_prezzo.da_confermare && Number(f.senza_prezzo.da_confermare.voci) > 0);
      const mancanti = parziali.some(f => !f.senza_prezzo.da_confermare || !(Number(f.senza_prezzo.da_confermare.voci) > 0)
        || Number(f.senza_prezzo.voci) > Number(f.senza_prezzo.da_confermare.voci) || (f.senza_prezzo.tratte || []).length > 0);
      const rimedio = [
        mancanti ? `scrivi le tariffe ${periodo.anno} che mancano nel tariffario` : '',
        copiate ? `conferma quelle copiate in Target & Status › Nuovo anno` : '',
      ].filter(Boolean).join(' e ');
      setAvvisoFoglio(parziali.length
        ? `Foglio dell'amministrazione di ${periodo.mese} ${periodo.anno}, totale parziale. ${parziali.map(f => `${TIPOLABEL[f.canale] || f.canale}: ${f.senza_prezzo.testo}.`).join(' ')} ${rimedio.charAt(0).toUpperCase()}${rimedio.slice(1)}, poi rifai il foglio.`
        : '');
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
      // Il motivo del server, non «Request failed with status code 500».
      setError(e?.response?.data?.error || e?.data?.error || e.message || 'Errore durante il calcolo');
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
            <SelectContent>{anni.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
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
          onClick={async () => { try { await exportFatturazionePassiva(result); } catch (e) { setError(e.message || 'Esportazione non riuscita'); } }}>
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

      {/* La passiva legge primarie e secondarie: mentre si riscrivono, o dopo
          una riscrittura non riuscita, il calcolo e i fogli escono a meta'. Lo
          si dice sopra i totali (11/10/2026). */}
      <AvvisoCaricamenti tipi={tipiDeiCanali(TIPI_PASSIVA, [tipologia])} aggiorna={`${periodo.anno}|${periodo.mese}|${tipologia}|${result ? 'calcolato' : ''}|${loading}`} />

      {/* Regole dell'utente del 22/09/2026: i costi di un intervento li scrive lui
          prima di passarlo a terminato, e la passiva paga quelli */}
      {tipologia === 'EXTRA_RACCOLTA' && (
        <p className="text-xs text-muted-foreground">
          Si pagano i costi di raccolta, stoccaggio e trattamento scritti su ciascun intervento, mai le tariffe di rete. Entrano solo gli interventi terminati, nel mese della fine trasporto; un terminato a cui manca una delle tre date obbligatorie (immissione, inizio e fine trasporto) si segnala fra le anomalie.
        </p>
      )}

      {error && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded">{error}</div>}
      {notaStorico && <div className="text-sm text-amber-800 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/40 px-4 py-2 rounded">{notaStorico}</div>}
      {/* Il foglio dell'amministrazione con voci senza la tariffa dell'anno: il
          totale e' parziale, e si dice prima di mandarlo (D5, 15/10/2026). */}
      {avvisoFoglio && <div className="text-sm text-amber-800 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/40 px-4 py-2 rounded">{avvisoFoglio}</div>}

      {result && (
        <>
          {/* Riepilogo totali + quadratura. Il surplus sulle tariffe (13/10/2026)
              e' dentro i totali, che sono quello che si deve ai fornitori: sotto il
              numero si legge quanto ne e' surplus, e nel totale come si compone. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground">Raccoglitori</div>
              <div className="text-lg font-bold tabular-nums">€ {formatNumber(result.totali.raccoglitori, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <DiCuiSurplus valore={result.totali.surplus?.raccoglitori} nome={nomeSurplusDelMese(result)} />
            </div>
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground">Impianti e stoccaggi</div>
              <div className="text-lg font-bold tabular-nums">€ {formatNumber(result.totali.impianti_stoccaggi, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <DiCuiSurplus valore={result.totali.surplus?.impianti_stoccaggi} nome={nomeSurplusDelMese(result)} />
            </div>
            <div className="border rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground">Trasporti secondaria</div>
              <div className="text-lg font-bold tabular-nums">€ {formatNumber(result.totali.trasporti_secondaria, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <DiCuiSurplus valore={result.totali.surplus?.trasporti_secondaria} nome={nomeSurplusDelMese(result)} />
            </div>
            <div className="border-2 rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground">Totale complessivo</div>
              <div className="text-lg font-bold tabular-nums">€ {formatNumber(result.totali.totale_complessivo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              {result.totali.surplus?.totale > 0 && (
                <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                  standard {formatNumber(result.totali.standard?.totale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · surplus {formatNumber(result.totali.surplus.totale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
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

          {/* I surplus sulle tariffe in corso nel mese su questo canale (il Fuel
              Surcharge): che cosa vale, a chi, su quante tonnellate e quanto fa */}
          <FasceSurplus surplus={result.surplus_del_mese} />

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