import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";
import { MESI } from "../../shared/dichiarazioniImpianti.ts";
import {
  SCHEMA_LETTURA, controllaLettura, unisciLetture, riscontroConferito, stessoImpianto,
} from "../../shared/dichiarazioneAci.ts";

// Legge le dichiarazioni ACI che gli impianti mandano ogni mese e PROPONE i numeri
// della scheda del mese. Non ne salva nessuno.
//
// Payload: { file_uris: [...], file_nomi: [...], anno, mese, sito, canale, conferito_kg }
// Risposta: { ok, letture, totale, riscontro, avvisi }
//
// QUESTA FUNZIONE NON SCRIVE IN NESSUN ARCHIVIO, e non e' una dimenticanza: i
// quattro numeri di una dichiarazione finiscono in una DichiarazioneSito, che
// decurta la giacenza e che il consorzio vede. Un numero sbagliato ma sicuro di
// se' e' peggio di un refuso, perche' il refuso si vede. Quindi qui si legge, si
// controlla e si risponde; a salvare e' l'utente, dalla scheda del mese, dopo aver
// guardato.
//
// COME SI CONTROLLA UNA LETTURA. Non le si crede sulla parola: il documento porta
// con se' la sua prova, perche' i tre materiali fanno sempre la quantita' lavorata
// al chilo. Se non la fanno, si RILEGGE lo stesso documento dicendo al modello che
// cosa non tornava - e' quello che farebbe una persona a riguardare il foglio
// sapendo dove cercare - e si rilegge UNA volta sola: la stessa strada di
// elaboraQuadraturaFir. Se nemmeno la seconda lettura torna, valgono i numeri
// della prima e lo si dice negli avvisi, invece di nascondere il dubbio.
//
// Il secondo controllo e' il mese: i documenti di un impianto in un mese si
// sommano, e il totale deve tornare col conferito che il gestionale gia' conosce.
// Il conferito lo passa chi chiama, cosi' questa funzione non legge archivi.
//
// I FILE RESTANO CARICATI. La piattaforma non ha nessuna operazione per cancellare
// un file (shared/fileArchivio.ts) e un file non scade da solo. Qui non si prova
// nemmeno, perche' sarebbero richieste a vuoto contro il limite al minuto di tutta
// l'app; e non si scrive nel registro FileDaRimuovere, perche' questa funzione non
// scrive. Ad annotarli tocca a chi li ha caricati, con
// annotaFileDaRimuovere di shared/fileDaRimuovere.ts.

// Un documento costa una lettura del modello, due se la prima non torna. Il mese
// piu' affollato del 2026 ne ha tre (Gatim e Tecnogum, giugno): sei e' il doppio
// del caso vero e tiene l'invocazione dentro il suo tempo. Una selezione piu'
// grande si legge a gruppi, un impianto e un mese per volta, che e' comunque il
// modo in cui le dichiarazioni si guardano.
const MAX_DOCUMENTI = 6;

const PROMPT = [
  'Il documento allegato e\' una DICHIARAZIONE ACI di un impianto di recupero di pneumatici fuori uso (PFU).',
  'L\'impianto attesta di aver ricevuto i PFU raccolti presso le autodemolizioni per conto del consorzio, di averli trattati con recupero di materia (codice R3) e dichiara che cosa ne ha ricavato. Ogni documento riguarda UN conferimento, cioe\' un formulario; dello stesso mese ce n\'e\' piu\' d\'uno, e a sommarli pensa il gestionale. E\' di una pagina e il testo si legge: non e\' una scansione.',
  '',
  'Ne esistono tre impaginazioni, e sono queste.',
  '',
  '1) GATIM e T.R.S. usano lo stesso modello, intitolato "Attestazione di avvenuto Recupero". In alto una tabella con una riga per conferimento: Ordine/Ticket, Reg. Soc. Produttore, Peso FIR Kg., C.E.R., Data Serv., Nr.Formulario, Data Conf., Q.ta Tratt.Kg, data Avv.Rec. In basso, sotto "Dati processo riciclo", le voci "Quantita\' di PFU riciclati" (a volte stampato "ricilati"), "Dimensioni granulo gomma prodotti", "Peso polverino/granulo gomma", "Peso fibre tessili", "Peso metalli ferrosi", con i numeri in colonna dopo la sigla KG. In T.R.S. ogni numero sta accanto alla sua etichetta; in GATIM i quattro numeri in basso possono risultare allineati in sequenza, e l\'ordine e\' sempre questo: quantita\' di PFU riciclati, polverino/granulo, fibre tessili, metalli ferrosi.',
  '',
  '2) TECNOGUM, "CERTIFICAZIONE DI AVVENUTO RECUPERO". La quantita\' lavorata e\' il peso riscontrato in ingresso, nella frase "riscontrato con peso di kg ... registrato nel registro di carico e scarico". NON prendere "Totale MPS prodotte", che e\' la sola gomma e non comprende metalli e tessili. I materiali stanno sotto "Dettaglio lavorazione/i effettuata/e", a trattini: "- granulato di gomma con granulometria variabile da 0,1 a 4mm [kg]: 1.260 - metalli ferrosi [kg]: 70 - prodotti tessili [kg]: 70", e si ritrovano nelle caselle "Quota Granulo 0,8-4mm [kg]", "Quota Polverino <0,8mm [kg]", "Peso Metalli Ferrosi [kg]", "Peso ProdottiTessili [kg]". Polverino e granulo si sommano in polverino_granulo_kg, e il polverino e\' spesso zero; "prodotti tessili" sono le fibre tessili. L\'ordine e\' scritto come "con ordine n. SEC26093023", i ticket come "relative al/ai ticket di riferimento del Comitato ACI: 162399-21". La data di conferimento e\' quella del formulario "accettato in ingresso il": non la "Data Trattamento" e non la data in fondo ("Pontinia li, ...").',
  '',
  '3) GREEN TYRE PROJECT scrive una lettera. Dice "dettaglio quantita\' ricevute nel mese di LUGLIO 2026 per Kg. 2640", poi una tabella con ORDINE, PRODUTTORE, CLASSE PFU, PESO DA FIR, CER, DATA SERVIZIO, N.FIR, DATA CONFERIMENTO, e sotto "delle quali sono state avviate a recupero le seguenti quantita\'" un elenco: PFU Lavorato, Granulato, Polverino, Fibre Tessili, Metalli, Scarto, Recupero Energia, Riutilizzo. La quantita\' lavorata e\' "PFU Lavorato"; Granulato e Polverino si sommano in polverino_granulo_kg; le voci lasciate in bianco sono zero. Il ticket e\' sotto l\'ordine, scritto come "ACI: 163676-37".',
  '',
  'Che cosa tornare, campo per campo:',
  '- quantita_kg: i chili di PFU lavorati.',
  '- polverino_granulo_kg, fibre_kg, metalli_kg: i tre materiali ricavati. scarto_kg solo se il documento lo scrive, altrimenti zero.',
  '- peso_fir_kg: il peso scritto sul formulario (Peso FIR, PESO DA FIR, il peso riscontrato in ingresso).',
  '- ordine, formulario, produttore, cer: copiati come sono stampati.',
  '- ticket_aci: un ticket per voce, nella forma 162529-54, senza spazi. Un documento ne puo\' avere uno, due o quattro, separati da punto e virgola, da virgola o da trattini: "158765 - 73;159165 - 85; 159325 - 51;159349 - 75;" sono quattro ticket.',
  '- data_conferimento: il giorno in cui i PFU sono arrivati all\'impianto (Data Conf., "accettato in ingresso il", DATA CONFERIMENTO). Da quella data il gestionale ricava di che mese e\' la dichiarazione, quindi dopo i pesi e\' il dato piu\' importante. data_servizio e data_trattamento come sono scritte. Tutte le date in AAAA-MM-GG.',
  '- mese e anno: SOLO se il documento scrive il mese a parole, come fa Green Tyre ("nel mese di LUGLIO 2026"). Negli altri modelli non c\'e\': lascia mese vuoto e non dedurlo dalle date, al mese ci pensa il gestionale.',
  '- impianto: la ragione sociale di chi firma la dichiarazione.',
  '',
  'Regole:',
  '- I pesi sono chilogrammi e il punto separa le migliaia: "13.640" sono 13640, "1.260" sono 1260, "2640" sono 2640. Scrivi i numeri senza separatori.',
  '- I TRE MATERIALI DEVONO FARE LA QUANTITA\' LAVORATA, al chilo: 1.970 + 590 + 1.370 = 3.930 (Gatim), 9.548 + 1.364 + 2.728 = 13.640 (T.R.S.), 2.140 + 200 + 300 = 2.640 (Green Tyre), 1.260 + 70 + 70 = 1.400 (Tecnogum). Prima di rispondere fai la somma: se non torna RILEGGI il documento invece di tirare a indovinare, perche\' su queste dichiarazioni torna sempre.',
  '- Non aggiustare un numero per far tornare il conto, non sommare quello che il documento non somma, non arrotondare e non convertire niente: i numeri si copiano come sono stampati. Se dopo aver riletto la somma non torna, scrivili come li vedi e spiega in note che cosa non torna.',
  '- Non inventare: un campo che sul documento non c\'e\' torna stringa vuota, o zero se e\' un peso. Non riempirlo con un valore ricavato da un altro campo.',
  '- Se il documento e\' illeggibile, metti i pesi a zero e spiegalo in note.',
  '',
  'Rispondi solo con un oggetto JSON cosi\' fatto:',
  '{"impianto": "GATIM SRL", "mese": "", "anno": null, "quantita_kg": 3930, "polverino_granulo_kg": 1970, "fibre_kg": 590, "metalli_kg": 1370, "scarto_kg": 0, "peso_fir_kg": 3930, "ordine": "", "formulario": "HTQKS000856WL", "ticket_aci": ["162529-54"], "produttore": "AUTOSERVICE DI F. CATALDO", "cer": "160103", "data_servizio": "2026-06-01", "data_conferimento": "2026-06-01", "data_trattamento": "2026-06-26", "granulometria": "da 0,0 a 4,0", "note": ""}',
].join('\n');

function comeOggetto(v) {
  if (v && typeof v === 'object') return v;
  const s = String(v || '');
  const inizio = s.indexOf('{');
  const fine = s.lastIndexOf('}');
  if (inizio < 0 || fine <= inizio) throw new Error('La lettura del documento non e\' tornata leggibile.');
  return JSON.parse(s.slice(inizio, fine + 1));
}

// Legge un documento dall'archivio privato con un link firmato che vale un quarto
// d'ora. Con `problemi` si rilegge lo stesso documento dicendo che cosa non
// tornava: la stessa strada di elaboraQuadraturaFir.
async function leggiDocumento(base44, fileUri, problemi = null) {
  const core = base44.asServiceRole.integrations.Core;
  const { signed_url } = await core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 900 });
  const prompt = problemi && problemi.length
    ? [
      PROMPT, '',
      'ATTENZIONE: una prima lettura di questo stesso documento non torna con quello che c\'e\' scritto sul file.',
      ...problemi.map(p => '- ' + p),
      '',
      'Rileggi il documento da capo e con calma. Guarda una cifra per volta, confrontando i numeri in basso (i dati del processo di riciclo) con quelli della tabella in alto, che dicono la stessa quantita\'. La somma dei tre materiali deve fare la quantita\' lavorata al chilo. Non cambiare un numero per far tornare il conto: se non torna, scrivi quello che vedi e spiegalo in note.',
    ].join('\n')
    : PROMPT;
  const risposta = await core.InvokeLLM({ prompt, file_urls: [signed_url], response_json_schema: SCHEMA_LETTURA });
  return comeOggetto(risposta);
}

export default async function(req) {
  const base44 = conLimiteRichieste(createClientFromRequest(req));
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!eAmministratore(user)) return rispostaSolaLettura();

    const corpo = await req.json();
    const uris = (Array.isArray(corpo.file_uris) ? corpo.file_uris : []).map(u => String(u || '').trim()).filter(Boolean);
    const nomi = Array.isArray(corpo.file_nomi) ? corpo.file_nomi : [];
    if (!uris.length) return Response.json({ error: 'Serve almeno un documento da leggere (file_uris).' }, { status: 400 });
    if (uris.length > MAX_DOCUMENTI) {
      return Response.json({
        error: `I documenti si leggono a gruppi di ${MAX_DOCUMENTI} al massimo, e questi sono ${uris.length}. Scegli le dichiarazioni di un impianto e di un mese per volta.`,
      }, { status: 400 });
    }

    // Il periodo, il sito e il canale della scheda da cui si parte: non decidono
    // niente, servono a dire se i documenti allegati sono quelli giusti.
    const anno = Number(corpo.anno) || null;
    const meseChiesto = String(corpo.mese || '').trim();
    const mese = MESI.find(m => m.toLowerCase() === meseChiesto.toLowerCase()) || meseChiesto;
    const sito = String(corpo.sito || '').trim();
    const canale = String(corpo.canale || '').trim().toUpperCase();
    // Un conferito che non e' un numero vale come non passato: letto come zero
    // direbbe «sui documenti ci sono 11.340 kg in piu' del conferito», che e' un
    // allarme inventato.
    const chiesto = Number(corpo.conferito_kg);
    const conferito = Number.isFinite(chiesto) && corpo.conferito_kg !== null && corpo.conferito_kg !== '' ? chiesto : null;

    const letture = [];
    for (let i = 0; i < uris.length; i++) {
      const nome = String(nomi[i] || '').trim() || `documento ${i + 1}`;
      // UN DOCUMENTO CHE NON SI LEGGE NON BUTTA VIA GLI ALTRI: la prima lettura
      // stava fuori dal try, quindi una risposta vuota sul terzo PDF faceva
      // rispondere 500 a tutto il gruppo e si perdevano - e si ripagavano - anche
      // le letture dei due documenti buoni.
      let lettura = null;
      let problemi = [];
      try {
        lettura = await leggiDocumento(base44, uris[i]);
        problemi = controllaLettura(lettura).problemi;
      } catch (e) {
        letture.push({ file: nome, file_uri: uris[i], letture: 1, verificata: false, problemi: ['La lettura del documento non è riuscita: ' + (e && e.message ? e.message : e) + '. Gli altri documenti sono stati letti lo stesso.'] });
        continue;
      }
      let quante = 1;
      if (problemi.length) {
        try {
          const secondo = await leggiDocumento(base44, uris[i], problemi);
          quante = 2;
          const controllo = controllaLettura(secondo);
          if (controllo.ok) {
            lettura = secondo;
            problemi = [];
          } else {
            // Quale delle due letture sia quella buona non si sa, e indovinarlo
            // sarebbe la bugia comoda: restano i numeri della prima e si dice che
            // vanno guardati sull'originale.
            problemi = [...problemi, 'Il documento è stato letto due volte e nessuna delle due torna: valgono i numeri della prima lettura, da controllare sull\'originale.'];
          }
        } catch (e) {
          problemi = [...problemi, 'La rilettura non è riuscita: ' + (e && e.message ? e.message : e)];
        }
      }
      letture.push({ ...lettura, file: nome, file_uri: uris[i], letture: quante, problemi, verificata: problemi.length === 0 });
    }

    const totale = unisciLetture(letture);
    // Il riscontro si fa solo su un totale che vale qualcosa: con documenti di mesi
    // o impianti diversi il totale e' zero per scelta, e il riscontro direbbe che
    // mancano chili che invece sono li', allegati e quadrati.
    const riscontro = conferito === null || !totale.sommato ? null : riscontroConferito(totale.quantita_kg, conferito);

    // GLI AVVISI SONO IL MOTIVO PER CUI QUESTA LETTURA SI PUO' GUARDARE: tutto
    // quello che non torna sta qui, in italiano, in un elenco solo. Chi mostra la
    // proposta mostra prima questi.
    const avvisi = [];
    for (const l of letture) {
      if (l.problemi.length) avvisi.push(`${l.file}: ${l.problemi.join(' ')}`);
      const nota = String(l.note || '').trim();
      if (nota) avvisi.push(`${l.file}, nota di lettura: ${nota}`);
    }
    for (const p of totale.problemi) avvisi.push(p);
    // Il canale non sta scritto sul documento: lo sa la scheda. Rete, ACI ed extra
    // raccolta non si mescolano mai, nemmeno per sbaglio di una scheda aperta.
    if (canale && canale !== 'ACI') {
      avvisi.push(`Questa lettura è fatta per le dichiarazioni ACI degli impianti di recupero, ma la scheda è del canale ${canale}: i canali non si mescolano, controlla di essere sulla scheda giusta.`);
    }
    if (!totale.ticket_aci.length) {
      avvisi.push('Su nessuno di questi documenti si leggono i ticket del Comitato ACI: controlla che siano dichiarazioni ACI e non di un altro canale.');
    }
    if (mese && totale.mese && (totale.mese.toLowerCase() !== mese.toLowerCase() || (anno && totale.anno && anno !== totale.anno))) {
      avvisi.push(`I documenti risultano di ${totale.mese}${totale.anno ? ' ' + totale.anno : ''}, letto dalla data di conferimento, mentre la scheda è di ${mese}${anno ? ' ' + anno : ''}. Il mese di una dichiarazione ACI è quello in cui i PFU sono arrivati all'impianto, cioè la fine del trasporto: se i documenti sono questi, va compilato quel mese.`);
    }
    if (sito && totale.impianto && !stessoImpianto(sito, totale.impianto)) {
      avvisi.push(`I documenti sono firmati da «${totale.impianto}» e la scheda è di «${sito}»: controlla di aver allegato le dichiarazioni dell'impianto giusto. Lo stesso impianto si scrive anche in modi diversi, quindi può non essere un errore.`);
    }

    return Response.json({ ok: true, letture, totale, riscontro, avvisi });
  } catch (error) {
    const messaggio = error && error.message ? error.message : String(error);
    return Response.json({ error: messaggio }, { status: 500 });
  }
}
