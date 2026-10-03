import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, AlertTriangle, CheckCircle2, FileText, Undo2, Info } from 'lucide-react';
import { formatKg } from '@/lib/utils';
import { annotaFileDaRimuovere, voceDaRimuovere } from '@/lib/fileDaRimuovere';

// I PDF DELLE DICHIARAZIONI DEGLI IMPIANTI, LETTI E PROPOSTI.
//
// Ogni mese gli impianti che fanno recupero di materia mandano via email la
// dichiarazione ACI di ogni conferimento, e l'utente la gira al consorzio: le
// dichiarazioni ACI a portale non si gestiscono. Finora quei quattro numeri -
// quantita' di PFU lavorati, polverino/granulo, fibre tessili, metalli ferrosi -
// li trascriveva a mano, documento per documento.
//
// QUI SI PROPONE, NON SI SALVA. Un numero sbagliato ma sicuro di se' e' peggio di
// un refuso, perche' il refuso si vede. Quindi: i campi si compilano solo quando
// sulla lettura non c'e' niente da ridire, accanto si vede da quale documento
// viene ogni pezzo, il riscontro col conferito si mostra sempre, e il pulsante
// Salva resta quello che c'era - lo preme l'utente.
//
// Quando qualcosa non torna i campi restano come erano e si dice che cosa non
// torna: meglio scriverli a mano che riempirli male.

// Tanti quanti ne legge la funzione (MAX_DOCUMENTI in leggiDichiarazioneAci): il
// mese piu' affollato del 2026 ne ha tre. Si dice qui invece di far rispondere 400
// alla funzione dopo aver caricato i file per niente.
const MAX_DOCUMENTI = 6;
// Una dichiarazione e' una pagina di testo: pesa decine di kilobyte. Un file piu'
// grosso di cosi' e' un altro documento, non una dichiarazione.
const LIMITE_BYTE = 5 * 1024 * 1024;

// DA QUALE CASELLA DELLA SCHEDA VIENE OGNI NUMERO LETTO.
//
// Polverino e granulo stanno in una casella sola: Tecnogum e Green Tyre li
// scrivono su due righe, ma DichiarazioneSito ha un solo granulo_kg, e sommarli
// e' quello che l'utente faceva a mano.
//
// Lo scarto va in «Altro», che non e' la sua casa naturale - non e' un materiale
// ricavato - ma e' l'unica casella generica che c'e', e senza di quella la somma
// dei materiali non farebbe piu' la quantita' dichiarata e la scheda segnalerebbe
// una difformita' che sul documento non c'e'. Sui ventitre documenti del 2026 lo
// scarto e' sempre zero: e' una cautela, non un caso corrente.
const DAL_DOCUMENTO = [
  { letto: 'polverino_granulo_kg', casella: 'granulo_kg', nome: 'polverino e granulo di gomma' },
  { letto: 'fibre_kg', casella: 'fibre_kg', nome: 'fibre tessili' },
  { letto: 'metalli_kg', casella: 'metalli_kg', nome: 'metalli ferrosi' },
  { letto: 'scarto_kg', casella: 'altro_kg', nome: 'scarto' },
];

/**
 * Si puo' compilare la scheda con questa lettura? `motivo` e' la frase che dice
 * perche' no, in italiano, e si mostra al posto dei numeri compilati.
 *
 * Non basta che la funzione abbia risposto: una lettura si guarda, e si scrive
 * nella scheda solo quando non c'e' niente da ridire. Un documento la cui somma
 * non torna, due mesi mescolati o un mese che non e' quello della scheda sono
 * tutti casi in cui il numero sarebbe plausibile e falso.
 */
function siPuoProporre(risposta, { mese, anno, caselle }) {
  const totale = (risposta && risposta.totale) || null;
  const letture = (risposta && risposta.letture) || [];
  if (!totale || !letture.length) return { si: false, motivo: 'dalla lettura non è tornato nessun documento.', valori: null };

  if (totale.problemi && totale.problemi.length) {
    return { si: false, motivo: totale.problemi.join(' '), valori: null };
  }
  const storti = letture.filter(l => !l.verificata);
  if (storti.length) {
    const quali = storti.map(l => `«${l.file}»`).join(', ');
    return {
      si: false,
      valori: null,
      motivo: storti.length === 1
        ? `su ${quali} c'è qualcosa che non torna, e i numeri di un documento che non quadra non si scrivono in una dichiarazione.`
        : `su questi documenti c'è qualcosa che non torna: ${quali}. I numeri di un documento che non quadra non si scrivono in una dichiarazione.`,
    };
  }
  if (!(Number(totale.quantita_kg) > 0)) {
    return { si: false, motivo: 'dai documenti non risulta nessuna quantità lavorata.', valori: null };
  }
  // GLI AVVISI DELLA FUNZIONE FERMANO LA COMPILAZIONE, non la decorano.
  //
  // La funzione controlla tre cose che la pagina non rifa': che i documenti siano
  // dell'impianto della scheda, che il canale sia quello giusto, che il mese torni.
  // Mostrarli in giallo e riempire lo stesso le caselle vuol dire scrivere i numeri
  // di Tecnogum nella dichiarazione di Gatim con sopra la frase verde «campi
  // compilati»: due frasi che si contraddicono, e vince quella che ha riempito.
  const avvisi = (risposta && risposta.avvisi) || [];
  if (avvisi.length) {
    return { si: false, valori: null, motivo: avvisi.join(' ') };
  }
  // E IL RISCONTRO COL CONFERITO E' IL CONTROLLO PIU' FORTE, perche' viene da una
  // fonte che i documenti non conoscono: i movimenti che il gestionale ha gia'.
  // Due documenti su tre fanno un mese sottostimato - a giugno di Gatim 5.850 kg
  // invece di 11.340 - e dopo il salvataggio nessun controllo lo ritrova piu',
  // perche' controlliDichiarazione segnala il dichiarato OLTRE il conferito, mai
  // sotto. Si ferma qui, dove si vede ancora quale documento manca.
  const riscontro = (risposta && risposta.riscontro) || null;
  if (riscontro && riscontro.torna === false) {
    return { si: false, valori: null, motivo: `${riscontro.testo} Finché non torna, i campi non li compilo: un mese dichiarato in meno non lo segnala più nessun controllo.` };
  }
  // IL MESE DI UNA DICHIARAZIONE E' QUELLO IN CUI I PFU SONO ARRIVATI ALL'IMPIANTO,
  // cioe' la fine del trasporto. Se i documenti dicono un altro mese, i loro numeri
  // vanno in quella scheda, non in questa: compilarli qui sposterebbe una
  // dichiarazione di mese, e la stessa raccolta comparirebbe due volte.
  const altroMese = totale.mese && String(totale.mese).toLowerCase() !== String(mese || '').toLowerCase();
  const altroAnno = totale.anno && anno && Number(totale.anno) !== Number(anno);
  if (altroMese || altroAnno) {
    return {
      si: false,
      valori: null,
      motivo: `i documenti sono di ${totale.mese}${totale.anno ? ' ' + totale.anno : ''}, letto dalla data di conferimento, e questa scheda è di ${mese}${anno ? ' ' + anno : ''}: i loro numeri vanno nel mese in cui i PFU sono arrivati all'impianto.`,
    };
  }

  const valori = { quantita_kg: Math.round(Number(totale.quantita_kg) || 0) };
  const senzaCasella = [];
  for (const v of DAL_DOCUMENTO) {
    const letti = Math.round(Number(totale[v.letto]) || 0);
    // La casella si riscrive anche quando il documento dice zero: un valore di
    // prima che resta accanto a numeri nuovi e' il modo piu' facile per dichiarare
    // una somma che non torna.
    if (caselle.includes(v.casella)) valori[v.casella] = letti;
    else if (letti > 0) senzaCasella.push(v.nome);
  }
  if (senzaCasella.length) {
    return {
      si: false,
      valori: null,
      motivo: `sui documenti c'è ${senzaCasella.join(' e ')}, che in questa scheda non ha una casella: controlla l'operazione dell'impianto, perché queste dichiarazioni sono di recupero di materia (R3).`,
    };
  }
  return { si: true, motivo: '', valori };
}

const giorno = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

function Riga({ documento, lettura }) {
  const quadra = documento.quadra && lettura && lettura.verificata;
  return (
    <div className={`rounded-md border px-2 py-1.5 text-[11px] space-y-0.5 ${quadra ? '' : 'border-amber-300 bg-amber-50/60'}`}>
      <p className="flex items-start gap-1.5">
        {quadra
          ? <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0 text-emerald-600" />
          : <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0 text-amber-600" />}
        <span className="font-medium break-all">{documento.file}</span>
        <span className="ml-auto tabular-nums whitespace-nowrap font-medium">{formatKg(documento.quantita_kg)} kg</span>
      </p>
      <p className="text-muted-foreground tabular-nums">
        polverino/granulo {formatKg(documento.polverino_granulo_kg)} + fibre {formatKg(documento.fibre_kg)} + metalli {formatKg(documento.metalli_kg)}
        {documento.scarto_kg ? ` + scarto ${formatKg(documento.scarto_kg)}` : ''} = {formatKg(documento.somma_materiali_kg)} kg
      </p>
      <p className="text-muted-foreground">
        {documento.ordine ? <>ordine <strong>{documento.ordine}</strong> · </> : null}
        {documento.formulario ? <>formulario {documento.formulario} · </> : null}
        {documento.ticket_aci.length
          ? `ticket ACI ${documento.ticket_aci.join(', ')} · `
          : 'nessun ticket ACI letto · '}
        conferito il {giorno(documento.data_conferimento) || 'data non letta'}
        {documento.mese ? `, cioè ${documento.mese}` : ''}
      </p>
      {documento.doppione && (
        <p className="text-amber-900">Lo stesso conferimento di un altro documento: nel totale è contato una volta sola.</p>
      )}
      {lettura && lettura.letture > 1 && (
        <p className="text-muted-foreground">Letto due volte: la prima lettura non tornava con il documento.</p>
      )}
    </div>
  );
}

export default function LetturaAci({ sito, flusso, mese, anno, caselle, applicata, onProponi, onAnnulla }) {
  const scelta = useRef(null);
  const [lavoro, setLavoro] = useState('');
  const [caricati, setCaricati] = useState(0);
  const [quanti, setQuanti] = useState(0);
  const [errore, setErrore] = useState('');
  const [lettura, setLettura] = useState(null);
  const [esito, setEsito] = useState(null);

  const leggi = async (files) => {
    const scelti = Array.from(files || []);
    setErrore('');
    setLettura(null);
    setEsito(null);
    if (!scelti.length) return;
    if (scelti.length > MAX_DOCUMENTI) {
      setErrore(`I documenti si leggono a gruppi di ${MAX_DOCUMENTI} al massimo, e ne hai scelti ${scelti.length}: allega le dichiarazioni di un impianto e di un mese per volta.`);
      return;
    }
    const nonPdf = scelti.find(f => !/\.pdf$/i.test(f.name || ''));
    if (nonPdf) {
      setErrore(`«${nonPdf.name}» non è un PDF: le dichiarazioni degli impianti arrivano in PDF. Un documento di un altro genere va trascritto a mano.`);
      return;
    }
    const grosso = scelti.find(f => f.size > LIMITE_BYTE);
    if (grosso) {
      setErrore(`«${grosso.name}» pesa più di 5 MB: una dichiarazione è una pagina di testo e non arriva a tanto. Controlla di aver scelto il documento giusto.`);
      return;
    }

    setQuanti(scelti.length);
    setCaricati(0);
    setLavoro('carico');
    try {
      // I FILE RESTANO CARICATI, E NESSUN RECORD LI NOMINA: la piattaforma non ha
      // nessuna operazione per cancellare un file e un file non scade da solo
      // (shared/fileArchivio.ts). Qui il documento serve solo alla lettura, quindi
      // appena caricato e' gia' da far rimuovere.
      //
      // Si annota DENTRO il ciclo, uno per uno: annotandoli tutti alla fine, un
      // caricamento che fallisce a meta' lasciava quelli gia' saliti senza nessun
      // record che li nominasse - e un file di cui non si sa il nome non si puo'
      // nemmeno chiedere di rimuovere. L'annotazione non solleva mai e non deve
      // fermare la lettura.
      const uris = [];
      const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
      for (const file of scelti) {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        uris.push(file_uri);
        setCaricati(uris.length);
        await annotaFileDaRimuovere(base44.entities.FileDaRimuovere, [voceDaRimuovere({
          entita: 'DichiarazioneSito',
          record: { file_uri },
          motivo: 'letto per proporre i numeri del mese, non allegato a nessun record',
          cosa: 'dichiarazione ACI di un impianto',
          descrizione: `${sito.sito} · ${flusso.canale} · ${mese.mese} ${anno} · ${file.name}`,
          oggi,
        })].filter(Boolean));
      }

      setLavoro('leggo');
      const res = await base44.functions.invoke('leggiDichiarazioneAci', {
        file_uris: uris,
        file_nomi: scelti.map(f => f.name),
        anno,
        mese: mese.mese,
        sito: sito.sito,
        canale: flusso.canale,
        // Il conferito del mese lo sa gia' il gestionale: passandolo, il riscontro
        // lo fa la funzione e non serve che legga nessun archivio.
        conferito_kg: mese.conferito_kg === undefined ? null : mese.conferito_kg,
      });
      const r = (res && res.data) || {};
      if (!r.ok) throw new Error(r.error || 'La lettura dei documenti non è riuscita.');
      setLettura(r);
      const verdetto = siPuoProporre(r, { mese: mese.mese, anno, caselle });
      setEsito(verdetto);
      if (verdetto.si) onProponi(verdetto.valori);
    } catch (e) {
      setErrore(e?.response?.data?.error || e?.data?.error || e.message || String(e));
    }
    setLavoro('');
  };

  const occupato = lavoro !== '';
  const avvisi = (lettura && lettura.avvisi) || [];
  const riscontro = lettura && lettura.riscontro;
  const totale = lettura && lettura.totale;
  // Sommato per davvero: con documenti di mesi o impianti diversi unisciLetture
  // non somma e il totale resta a zero, e un totale a zero non si confronta.
  const sommato = !!(totale && totale.quantita_kg > 0);

  return (
    <div className="rounded-lg border px-3 py-2 space-y-2">
      <p className="text-sm font-medium">Le dichiarazioni che l&apos;impianto ha mandato</p>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Allega i PDF di questo mese: ogni dichiarazione riguarda un conferimento, e di un mese ce n&apos;è spesso più d&apos;una.
        Il gestionale le legge e <strong>propone</strong> i numeri qui sotto, dicendo da quale documento viene ogni pezzo.
        Controllali e correggili: a salvare sei tu. I PDF servono solo alla lettura e non restano allegati al mese.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={scelta} type="file" multiple accept="application/pdf,.pdf" className="hidden"
          /* I file si copiano in un array PRIMA di azzerare l'input: tenendo il
             FileList per riferimento, un motore che lo svuota lascerebbe leggi()
             senza niente da leggere e il pulsante non farebbe nulla, in silenzio.
             E' come fanno gli altri caricamenti del gestionale. */
          onChange={e => { const f = [...(e.target.files || [])]; e.target.value = ''; leggi(f); }}
        />
        <Button type="button" size="sm" variant="outline" className="gap-1 h-8 text-xs" disabled={occupato}
          onClick={() => scelta.current && scelta.current.click()}>
          {occupato ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {lettura ? 'Allega altri PDF' : 'Allega i PDF e leggili'}
        </Button>
        {lavoro === 'carico' && <span className="text-[11px] text-muted-foreground">Carico i documenti… {caricati} di {quanti}</span>}
        {lavoro === 'leggo' && <span className="text-[11px] text-muted-foreground">Leggo {quanti === 1 ? 'il documento' : `i ${quanti} documenti`}: può volerci qualche secondo.</span>}
        {applicata && !occupato && (
          <Button type="button" size="sm" variant="ghost" className="gap-1 h-8 text-xs" onClick={onAnnulla}>
            <Undo2 className="w-3.5 h-3.5" /> Rimetti i valori di prima
          </Button>
        )}
      </div>

      {errore && (
        <p className="flex items-start gap-2 text-xs rounded-md px-2 py-1.5 bg-red-50 text-red-900">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {errore} I campi sono rimasti come erano.
        </p>
      )}

      {/* CHE COSA NON TORNA SI DICE PRIMA DEI NUMERI. Sono le frasi della
          funzione: la somma dei materiali che non fa la quantità, due mesi
          mescolati, un impianto diverso da quello della scheda, le note di
          lettura. Chi guarda una proposta deve vedere prima questo. */}
      {avvisi.length > 0 && (
        <div className="space-y-1">
          {avvisi.map((a, i) => (
            <p key={i} className="flex items-start gap-2 text-xs rounded-md px-2 py-1.5 bg-amber-50 text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {a}
            </p>
          ))}
        </div>
      )}

      {esito && (
        esito.si
          ? (
            <p className="flex items-start gap-2 text-xs rounded-md px-2 py-1.5 bg-emerald-50 text-emerald-900">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Campi compilati con {lettura.letture.length === 1 ? 'questo documento' : `questi ${lettura.letture.length} documenti`}:
                {' '}{formatKg(totale.quantita_kg)} kg lavorati, polverino/granulo {formatKg(totale.polverino_granulo_kg)} kg,
                {' '}fibre tessili {formatKg(totale.fibre_kg)} kg, metalli ferrosi {formatKg(totale.metalli_kg)} kg.
                {' '}Sono una proposta: controllali, correggi quello che serve e salva tu.
              </span>
            </p>
          )
          : (
            <p className="flex items-start gap-2 text-xs rounded-md px-2 py-1.5 bg-amber-50 text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                I campi non sono stati compilati e sono rimasti come erano, perché {esito.motivo}
                {' '}I numeri letti sono qui sotto, documento per documento: scrivili a mano se li ritieni buoni.
              </span>
            </p>
          )
      )}

      {/* IL RISCONTRO COL CONFERITO SI MOSTRA SEMPRE, anche quando torna: su
          questo canale si dichiara quello che è arrivato, quindi la somma dei
          documenti deve fare il conferito del mese al chilo, e uno scarto è
          quasi sempre un documento che manca. Quando i documenti non sono stati
          sommati non c'è niente da riscontrare, e lo si dice invece di
          confrontare uno zero col conferito. */}
      {lettura && (
        sommato
          ? riscontro
            ? (
              <p className={`flex items-start gap-2 text-xs rounded-md px-2 py-1.5 ${riscontro.torna ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
                {riscontro.torna ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                {riscontro.testo}
              </p>
            )
            : (
              <p className="flex items-start gap-2 text-xs rounded-md px-2 py-1.5 bg-sky-50 text-sky-900">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Di questo mese il gestionale non conosce il conferito, quindi il riscontro con i documenti non è stato fatto.
              </p>
            )
          : (
            <p className="flex items-start gap-2 text-xs rounded-md px-2 py-1.5 bg-sky-50 text-sky-900">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Il riscontro col conferito del mese non è stato fatto: da questi documenti non è venuto un totale da confrontare.
            </p>
          )
      )}

      {totale && totale.documenti.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {totale.documenti.length === 1 ? 'Il documento letto' : `I ${totale.documenti.length} documenti letti`}
            {totale.impianto ? ` · ${totale.impianto}` : ''}
          </p>
          {totale.documenti.map((doc, i) => (
            <Riga key={i} documento={doc} lettura={lettura.letture[i]} />
          ))}
          {/* Il totale si scrive solo quando i documenti sono stati sommati per
              davvero: con due mesi o due impianti mescolati unisciLetture non
              somma, e un «Totale del mese: 0 kg» sarebbe la bugia comoda. */}
          {totale.documenti.length > 1 && totale.quantita_kg > 0 && (
            <p className="text-[11px] text-right tabular-nums font-medium">
              Totale del mese: {formatKg(totale.quantita_kg)} kg
              {totale.mese ? ` · ${totale.mese}${totale.anno ? ' ' + totale.anno : ''}` : ''}
            </p>
          )}
          {totale.ticket_aci.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Ticket ACI del mese: {totale.ticket_aci.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
