# AGENTS.md — TreadRider

Le istruzioni del gestionale **TreadRider** di SMOCO, sulla piattaforma Base44.
Qui dentro ci sono due cose, e conviene distinguerle: le **regole di dominio**,
che il codice deve rispettare sempre, e il **fatto vero** da cui ciascuna nasce,
con la data. Il fatto non e' un contorno: una regola senza il motivo diventa un
ordine, e la volta dopo qualcuno la discute, o la ricava da zero e la scrive al
contrario.

Si legge cosi': **se una modifica viola una regola di questo file e' sbagliata
anche quando "funziona"**. Prima di riderivare una regola da zero, cercala qui.

## Indice

- **Come si lavora in questo repository**
  - I quattro controlli, prima di ogni commit
  - Lo stile dei commenti
  - Commit e push
  - Gli specchi: `base44/shared` e `src/lib`
  - I fine-riga
  - Le librerie pesanti si caricano quando servono (10/10/2026)
  - Le pagine si scaricano quando si aprono (10/10/2026)
  - Il limite di richieste della piattaforma (22/09/2026)
  - Base44: comandi, file e riferimenti
  - Regole tecniche della piattaforma e delle pagine
  - Quando la piattaforma modifica il codice da sola
  - Il nome: TreadRider
- **Le tre regole assolute**
  - Le tre regole che l'utente non vuole ripetere (21/09/2026)
  - Il periodo di un movimento e' la fine del trasporto
  - Il guardiano notturno e la memoria dei numeri (10/10/2026)
  - Il dichiarato e' di chi tratta, non di chi stocca (10/10/2026)
  - Una dichiarazione per mese, e un avviso non grida a zero (10/10/2026)
  - Giacenze e Dichiarazioni: lo stesso numero, controllato da una prova (10/10/2026)
  - Canali indipendenti
  - Pesi
  - Come si legge un movimento: un punto solo
- **Regole della commessa**
  - Chi conferisce dove
  - Gli impianti che svuotano la giacenza dell'anno prima
  - Su quali tonnellate si paga ciascuna prestazione
  - Le due regole del portale sull'ACI
  - Il target annuo di un impianto si scrive solo in Target & Status
  - Le date obbligatorie dei formulari (22/09/2026)
  - Una riga di un altro periodo si verifica sempre (01/10/2026)
  - Un numero sbagliato di una lettera non e' due difformita' (01/10/2026)
  - Le dichiarazioni e il mese di competenza
  - Decisioni della direzione del 20/09/2026 sulla fatturazione attiva
- **I moduli e i loro conti**
  - La predittivita' delle secondarie: un anno, un motore (26/09/2026)
  - La fatturazione attiva verso Ecotyre
  - La prefattura del portale in PDF si legge dal suo testo
  - Il margine
  - La pratica mensile di Irigom
  - La Quadratura FIR: il flusso non si indovina dal titolo (30/09/2026)
    - La parola "gestionale" sulla stampa non siamo noi
  - La dashboard e l'elenco unico delle cose da gestire
  - Le attivita' della to-do list che si chiudono da sole (28/09/2026)
  - EcoTyna: le domande sui dati non sono domande di norma (29/09/2026)
- **I caricamenti, lo storico e il registro**
  - Lo storico: si carica solo cio' che serve all'operativita' (25/09/2026)
  - Il caricamento delle primarie: che cosa si crede e che cosa si ripara (28/09/2026)
  - Il registro dei caricamenti
  - I file del Caricamento Dati si sostituiscono (29/09/2026)
- **I file, la privacy e i permessi**
  - I documenti aziendali non salgono mai in area pubblica (30/09/2026)
    - Il `file_uri` e' la chiave del documento: non si manda al browser (05/10/2026)
    - La piattaforma non cancella i file, e non si prova nemmeno piu'
    - I link pubblici non restano scritti nei record
  - La conservazione dei documenti dei fornitori (29/09/2026)
  - La qualifica dei fornitori

## Come si lavora in questo repository

### I quattro controlli, prima di ogni commit

Devono passare tutti:

```bash
npm run lint          # eslint . --quiet
npm run prove         # node prove/esegui.mjs: tutte le prove, specchi compresi
node prove/specchi.mjs
npx vite build
```

C'e' anche `npm run typecheck` (`tsc -p ./jsconfig.json`), che non e' fra i
quattro obbligatori. Le prove non sono di cortesia: molte leggono il **sorgente**
e cadono se una regola scritta in un commento o in questo file se ne va - per
esempio `prove/fileRiservato.mjs` verifica che AGENTS.md riporti ancora la
precisazione dell'assistenza sul `file_uri`. Chi cambia una regola aggiunge un
caso alla prova che la copre.

### Lo stile dei commenti

Commenti e messaggi in **italiano senza lettere accentate**: si scrive `e'` al
posto di «è», `piu'` al posto di «più», `percio'` al posto di «perciò». Un
commento dice **perche'** una cosa e' fatta cosi' e **il fatto vero da cui nasce
la regola, con la data**, non che cosa fa la riga sotto: quello si legge dal
codice. I testi che l'utente **vede a video** sono invece in italiano normale,
con gli accenti.

All'utente si da' del **tu**.

### Commit e push

Si lavora su `main`, si committa e si pusha; **la pubblicazione la fa l'utente**
dalla piattaforma. Ogni commit finisce con la riga
`Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

### Gli specchi: `base44/shared` e `src/lib`

Alcune regole servono sia alle funzioni di server sia alle pagine, e le pagine
non possono importare da `base44/shared`: di quei moduli esiste uno **specchio**
in `src/lib`. Le due copie devono restare identiche a meno dell'intestazione di
commento e delle righe di `import`, e lo controlla `prove/specchi.mjs`. **Una
modifica si fa uguale in tutti e due i file.**

**Un gemello che la prova non conosce non e' uno specchio, e' una copia che
aspetta di divergere.** Fino al 10/10/2026 quattro coppie erano fuori
dall'elenco: i nomi (`normalizzaRagioneSociale.ts` e
`normalizzaRagioneSocialeClient.js`, che era una copia a parte senza commenti),
le regioni, il formato dei fogli e i subfornitori. Uguali per caso, quel giorno;
e i nomi sono la chiave con cui pagine e funzioni riconoscono lo stesso
fornitore. Ora sono nell'elenco. Chi crea un file in `src/lib` che ripete
uno di `base44/shared` lo aggiunge a `SPECCHI` nello stesso commit.

**Gli import in `src/lib` vanno bene in tutte due le forme.** La convenzione e'
l'alias `@/` (39 dei 92 file; 12 usano un relativo, fra cui i cinque che prendono
`./prodotto.js`), e nessuna delle due rompe le prove: il caricatore
`prove/dati/libPagine.mjs` carica il modulo da un indirizzo `data:` e **riscrive
entrambe**. Fino all'08/10/2026 qui c'era scritto che gli import `src/lib` sono
relativi «non con l'alias», che era falso e costava riscritture inutili: chi lo
prendeva alla lettera doveva toccare 39 file per niente. Dentro i componenti
l'alias va bene comunque, perche' li' ci pensa Vite.

### I fine-riga

Questo file e i sorgenti stanno a **LF**. Modificare un file con uno strumento
che converte a CRLF rompe le prove che cercano un passaggio esatto nel sorgente:
una prova che cerca `\n` dice che manca un controllo che invece c'e'.

### Le librerie pesanti si caricano quando servono (10/10/2026)

`xlsx` (430 kB) e `jspdf` (384 kB) **non si importano mai in testa a un file**:
si prendono dentro la funzione che li usa, `const XLSX = await import('xlsx')` o
`const { jsPDF } = await import('jspdf')`. Vale anche per `lib/esportaTabella.js`,
che se li porta dietro tutti e due.

**Basta un solo import statico per disfare il lavoro di tutti gli altri.** Il
pacchetto e' uno: se un file qualsiasi importa `xlsx` in testa, `xlsx` entra nel
chunk principale e i venti `await import` degli altri non servono piu' a niente.
Fino al 10/10/2026 era cosi': venti file pigri e dodici statici, e tutto il peso
si apriva con la prima pagina. Vite lo diceva a ogni build - «dynamic import will
not move module into another chunk» - e quelle tre righe erano la cosa vera che
aveva da dire.

Il guadagno misurato: chunk principale da **4.100 a 3.268 kB**, cioe' da 1.213 a
**940 kB gzip** alla prima apertura, con `xlsx` e `jspdf` in due chunk a parte che
si scaricano solo quando si esporta.

**Chi lo rende pigro deve guardare i chiamanti.** Una funzione che diventa
asincrona rompe in silenzio un `try/catch` sincrono: l'errore non viene piu'
preso e l'esportazione fallisce senza dire niente. Due chiamanti erano cosi'
(`PassivaModulo`, `ReportSettimanale`: `onClick={() => { try { esporta(); } catch
{...} }}`) e sono diventati `async` con l'`await` dentro. E dove il valore di
ritorno serviva subito - `AttivaEsportazioni` registra nello storico il nome del
file appena scritto - senza `await` la registrazione partiva prima del file.

### Le pagine si scaricano quando si aprono (10/10/2026)

In `src/App.jsx` una pagina **non si importa in testa**: si dichiara pigra,
`const Giacenze = lazy(() => import('@/pages/Giacenze'));`. Prima erano
ventisette import statici e tutte le pagine finivano nello stesso pacchetto:
chi apriva la dashboard scaricava anche la fatturazione, le omologhe e la
qualifica fornitori.

Il guadagno, misurato: pacchetto d'avvio da **3.268 a 454 kB**, e la prima
apertura (avvio + dashboard) da **1.151 a 472 kB gzip, cioe' il 59% in meno**.

**L'attesa sta attorno all'Outlet, dentro `Layout`, non attorno alle `Routes`.**
Un Suspense attorno alle Routes farebbe sparire barra laterale e intestazione a
ogni cambio di pagina: peggio che aspettare. Cosi' invece il guscio resta a
video e cambia solo il contenuto. Il cerchio che gira e' lo stesso dell'avvio,
perche' chi guarda non deve imparare due attese.

Il guscio - `Layout`, `ProtectedRoute`, `PageErrorBoundary`, `PageNotFound` -
resta eager: serve subito, e scaricarlo a parte vorrebbe dire due viaggi invece
di uno.

**Resta un avviso di build**, e resta per un motivo: tre chunk superano i 500 kB
(`pdf.worker` 1.326, `exceljs` 940, la pagina `TargetStatus` 560) e sono tutti
scaricati su richiesta, non all'avvio. Alzare `chunkSizeWarningLimit` per farlo
tacere no: un presidio vale quanto la fiducia che gli si da', e un avviso
addomesticato non avverte piu' di niente. Prove in `prove/paginePigre.mjs`.

### Il limite di richieste della piattaforma (22/09/2026)

Le richieste agli archivi si contano **per tutta l'app insieme**, su un minuto;
oltre, 429 "Rate limit exceeded". Ogni funzione che crea un client lo avvolge con
`conLimiteRichieste(createClientFromRequest(req))`
(`base44/shared/limiteRichieste.ts`, specchio in `src/lib`, usato anche da
`src/api/base44Client.js`). Lo fanno 91 cartelle di `base44/functions` su 94; le
tre fuori sono superate - `seedTargetSiti2026` crea il client nudo e risponde 410,
`computeGiacenze` e `pulisciVerificheReport` non ne creano nessuno - e non sono il
modello da copiare. Una richiesta respinta si ripete dopo una pausa, le
chiamate a funzione solo su 429. Le letture intere passano da
`fetchAll`/`perPagina`/`fetchAllClient`, a pagine da 5000 righe (il massimo che
la piattaforma restituisce). Niente pagine che rileggono archivi interi a
intervalli: si guarda lo stato di cio' che e' in corso, e si rilegge tutto solo
quando cambia (`ReportSettimanali.jsx`).

**Le pagine di un archivio si leggono in ordine di `id` e si deduplicano**
(regola di `base44/shared/fetchAll.ts`): `id_ordine` non e' unico, quindi non e'
stabile fra una pagina e l'altra, e oltre le mille righe i conti escono sbagliati
senza dirlo.

### Base44: comandi, file e riferimenti

Questo e' un repository di un'app Base44: codice dell'utente, modifiche aderenti
alla richiesta, convenzioni del progetto rispettate. `README.md` ha
l'installazione locale, le variabili d'ambiente e il flusso di pubblicazione.

- `base44 dev` e' il comando di sviluppo quando serve il backend Base44 locale:
  manda su backend e frontend insieme. Quando documentazione o codice dicono che
  il frontend parte da solo, di solito vuol dire che la configurazione del
  progetto ha `site.serveCommand`, per esempio `"serveCommand": "npm run dev"` in
  `base44/config.jsonc`.
- `npm run dev` **solo** per lavorare sul frontend contro il backend ospitato.
- `src/`: il frontend. `src/api/base44Client.js`: il client dell'SDK.
  `vite.config.js`: Vite e il plugin Base44. `.env.local`: valori locali, i
  segreti non si committano mai.
- Per un lavoro specifico su Base44 si preferisce il flusso della CLI esistente
  all'aggiunta di script npm nuovi, e si riusano il client dell'SDK e i modelli
  del plugin Vite che ci sono gia', invece di aprire una strada nuova.
- Riferimenti: [CLI](https://docs.base44.com/developers/references/cli/get-started/overview.md),
  [Agent skills](https://docs.base44.com/developers/backend/overview/skills.md).
  Se l'agente supporta le Agent Skills, prima di un lavoro specifico su Base44:
  `npx skills add base44/skills`.

### Regole tecniche della piattaforma e delle pagine

Quattro cose che sono costate ciascuna un guasto vero.

**Nello schema di un'entita' un elenco va dichiarato `"type": "array"`.** Scritto
come `object` il server rifiuta il dato con `Error in field X: Input should be a
valid dictionary` e la funzione risponde 500. E' successo per davvero: il
registro delle esportazioni (`EsportazioneFatturazione.documento_ids`) non ha
registrato niente dal giorno in cui e' nato, e nessuno se n'era accorto perche'
il file veniva comunque prodotto. Quando si aggiunge un campo che conterra' un
elenco lo si dichiara `array` con i suoi `items`, anche se per ora non ci scrive
nessuno.

**Produrre un file e registrarlo sono due passi distinti.** Il file e' gia' sul
computer di chi esporta: se la registrazione non riesce non si dice
"esportazione fallita", si dice che il file c'e' ma non e' finito nello storico.
E non si usano le finestre di sistema (`alert`, `confirm`) per raccontarlo:
bloccano la pagina, non si copiano e fanno sembrare rotto cio' che ha funzionato.

**Nei PDF le intestazioni vanno a capo su due righe e le celle fino a tre.**
Tagliare alla prima riga faceva sparire l'unita' di misura: "Prezzo Unitario
(Euro/TON)" arrivava come "Prezzo Unitario" mentre nell'Excel c'era tutto. Vale
per `esportaTabellaPdf` e per `esportaSezioniPdf`; la prova `prove/pdfTabella.mjs`
rende il PDF in memoria e rilegge le scritte, cosi' il taglio non puo' tornare.

**Ogni sottosezione di Giacenze e di Target & Status ha il suo pulsante PDF**
(regola dell'utente, 06/10/2026: «in tutte le loro sotto sezioni dovrebbe
esserci un pulsante per esportare in pdf la situazione presente in ogni
momento»). Il pulsante (`src/components/shared/EsportaPdf.jsx`) sta DENTRO la
scheda, non in testa alla pagina, cosi' quello che esce e' quello che si ha
davanti, coi filtri e l'anno di quel momento; le sezioni le costruisce
`src/lib/giacenzePdf.js` e le disegna `esportaSezioniPdf`. Le sei schede di
Giacenze sono tutte coperte dal 09/10/2026 (`prove/esportaPdfSchede.mjs` lo
verifica scheda per scheda, cosi' una scheda nuova non nasce muta). Tre cose
imparate quel giorno: la funzione delle sezioni **puo' essere asincrona** (quella
di «Da dichiarare» va a prendersi TUTTE le righe del filtro, perche' un totale
sotto una tabella di cento righe e' proprio l'inganno corretto in quei giorni);
il titolo delle note in coda e' il parametro `titoloNote`, perche' il default
nasce dalla fatturazione («Anomalie da guardare prima di pagare») e nelle
giacenze diceva un'altra cosa; e una regola che serve a due esportazioni - com'e'
finita una voce di dicembre - si scrive in un posto solo (`decisioneDiVoce`),
altrimenti l'Excel e il PDF raccontano la stessa riga in due modi.

**Quando una pagina carica piu' riquadri indipendenti si usa
`Promise.allSettled`, non `Promise.all`.** Le funzioni che leggono gli archivi
grandi ogni tanto cadono: su Terminati Rete bastava `computeRaccoglitoriMix` a
500 per lasciare vuote anche la matrice per provincia, i tempi di evasione e gli
alert. Chi non ha risposto si dice per nome, con "Riprova"; il resto resta a
video.

**Le tabelle larghe** tengono la barra di scorrimento orizzontale sempre a
portata, l'intestazione e la prima colonna ferme; la regola e' globale, in
`src/index.css`.

### Quando la piattaforma modifica il codice da sola

La scansione di sicurezza della piattaforma apre commit sul repo da sola, come
`base44-builder[bot]`. **Vanno letti prima di pubblicare**, perche' tocca le
regole RLS, cioe' il modello dei permessi, e un errore la' non si vede provando
col proprio account di amministratore.

Il 01/10/2026 (commit `35f1b3d`, «Apply RLS security recommendations») ha fatto
tre cose su `RichiestaUtente` ed `EsercitazioneRT`, e solo due erano giuste:

- **Giusta, tenuta:** il filtro in lettura. Con `read: true` il server mandava a
  ogni utente i record di tutti, e il «vedo solo i miei» era soltanto un filtro
  nel browser. Tenuto, con due correzioni: la chiave e' `created_by_id`, che
  riempie la piattaforma, non `richiedente_email`, che scrive il browser e
  ripiega sulla stringa vuota; e senza il prefisso `data.`, che in tutte le
  entita' compariva solo la' - lo stesso commit ha scritto `created_by_id` nudo
  su un'altra entita'.
- **Sbagliata, respinta:** `"create": null` su `RichiestaUtente`. Aprire una
  richiesta e' **l'unica scrittura di un utente non amministratore**: il form si
  disegna solo quando non e' amministratore, l'amministratore non ha nessun
  pulsante per creare una richiesta, e il gestionale dice a chi non puo'
  scrivere «per un caricamento o una correzione apri una richiesta dal modulo
  Richieste». Con la create chiusa quella frase e' un vicolo chiuso. `null` e'
  anche l'unico in tutte le entita': qui un divieto si scrive
  `user_condition role admin`.
- **Inutile e rischiosa, respinta:** la condizione su `create` legata a
  `created_by_id`. Non aggiunge difese - quel campo lo mette la piattaforma, non
  il browser, quindi nessuno puo' intestare un record a un altro - e se il
  motore la valuta sul payload, dove `created_by_id` non c'e' ancora, ogni
  creazione fallisce. Su `EsercitazioneRT` voleva dire perdere la prova appena
  svolta con un «Risultato non salvato».

`prove/scrittureDegliUtenti.mjs` e' la guardia: fallisce se una scansione futura
richiude quelle `create`, riapre le letture, scrive una regola come `null` o
reintroduce il prefisso `data.`. **Qual e' la sintassi giusta del campo nelle
condizioni RLS l'ha detta l'assistenza il 02/10/2026, e non va piu' chiesta: sono
valide tutte e due, perche' indicano due generi di campo diversi.** «A platform
field such as created_by_id stays unprefixed, while a field you defined in the
entity needs the data. prefix»: le nostre due condizioni sono su `created_by_id`,
che e' un campo della piattaforma, quindi vanno senza prefisso e stanno gia'
cosi'. Il controllo in `prove/scrittureDegliUtenti.mjs` resta, ma ha cambiato
significato: non e' piu' un dubbio, e' il confine. Un `data.` li' dentro vuol dire
che qualcuno ha messo una condizione su un campo **nostro**, e allora va guardata
una per una. **E non si toglie un `data.` legittimo**: su un campo nostro quel
prefisso serve, e senza, una condizione sbagliata rende invisibili i propri record
al loro proprietario senza che si veda dall'account dell'amministratore.

### Il nome: TreadRider

Il gestionale si chiama **TreadRider** (una parola, T e R maiuscole), scelto
dall'utente il 02/10/2026. Prima si chiamava "EcoFlow Manager". Battistrada
(*tread*) piu' *Outrider*: chi corre sul battistrada. **Non** "TyreTreader", che
era la prima idea: in inglese *treader* e' «chi calpesta», mentre «ricostruttore
di pneumatici» e' *retreader* - e la ricostruzione e' l'altro capo della vita di
una gomma, non il mestiere di SMOCO, che le manda a recupero.

**Due cose da non confondere mai col nome del prodotto:** *EcoTyna* e'
l'assistente dentro il gestionale, e *Ecotyre* e' il consorzio cliente.

**Dove vive il nome.** In un posto solo: `src/lib/prodotto.js` (`PRODOTTO`,
`MARCHIO` - il simbolo del marchio accanto al nome dal 03/10/2026, non quello del
marchio registrato finche' non lo e' -, `SOTTOTITOLO`, `COMMESSA`, `AUTORE_FILE`). Da li' lo prendono l'intestazione del
menu, le schermate di accesso e il metadato Autore dei sei fogli fatti con exceljs
(`wb.creator = AUTORE_FILE`). Restano fuori il `<title>` e
l'`apple-mobile-web-app-title` di `index.html`, perche' l'HTML non importa moduli,
e i tredici export fatti con SheetJS (`XLSX.writeFile`), che non scrive il metadato
Autore: su 19 fogli che si scaricano il nome ne porta 6.

Fino al 03/10/2026 il nome stava scritto a mano in nove punti e **le pagine non lo
scrivevano affatto**: si vedeva solo nella linguetta del browser, l'autore di un
Excel diceva ancora il nome vecchio, e l'utente ha detto «in pratica e' come se non
ci fosse». Se serve cambiarlo, o aggiungerci un marchio, si cambia li'.

**Quello che dal repo NON si cambia.** Il nome con cui l'applicazione si installa
su Android e su desktop, la sua descrizione e la sua icona vengono dal manifest
che **la piattaforma genera dalle impostazioni dell'app** e serve su
`/manifest.json` (che redirige a `/api/apps/manifests/<appId>/manifest.json`).
Quel manifest non sta nel repo: `public/` non esiste. Il 02/10/2026 diceva
ancora `"name": "EcoFlow Manager"`, con `theme_color` nero (il nostro verde e'
`#059669`) e l'icona ospitata su un dominio della piattaforma. Si cambia nelle
impostazioni dell'applicazione, non qui.

**Una stringa interna che resta "ecoflow":** `Symbol.for('ecoflow.limiteRichieste')`
in `base44/shared/limiteRichieste.ts` e nel suo specchio `src/lib/limiteRichieste.js`.
Nessuno la legge, e due `Symbol.for` con chiavi diverse sono simboli diversi: se
si cambiasse in un file solo tornerebbe il doppio avvolgimento del limite di
richieste (una richiesta respinta ripartirebbe 36 volte invece di 6). Si cambiano
insieme o non si toccano: non toccarle e' a rischio zero.

## Le tre regole assolute

### Le tre regole che l'utente non vuole ripetere (21/09/2026)

1. **Fine trasporto, MAI chiusura a portale.** In ogni modulo ogni ragionamento
   - periodo, tagli a una data, confronti con una fotografia del portale,
   ripieghi quando un campo manca - si fa sulla fine del trasporto.
   `ordine_chiuso_il` e la `data_chiusura` **del portale** (OrdineNonDichiarato,
   DichiarazioneTrattamento) si possono mostrare, mai usare per decidere. Non
   c'entra `DocumentoFatturazione.data_chiusura`, che e' la chiusura di un nostro
   periodo di fatturazione: quella il gestionale la scrive e la rilegge
   (`cambiaStatoFatturazione`).
2. **Ogni caricamento aggiorna tutto.** Un modulo fermo a una fotografia vecchia
   e' un difetto, non una spiegazione. La giacenza a portale di un impianto e'
   la fotografia degli ordini non dichiarati **piu'** i carichi che il
   gestionale conosce e il file no (riconosciuti dal **numero d'ordine** negli
   ordini non dichiarati e nel report delle dichiarazioni, mai dalla data)
   **meno** le dichiarazioni caricate dopo la fotografia. Quella di uno
   stoccaggio e' l'**ancora dell'anno** per classe piu' i movimenti finiti
   dopo; le letture successive sono il riscontro (`puntoDiPartenza` in
   `base44/shared/giacenzaStoccaggi.ts`, usato da Giacenze, riconciliazione e
   riepilogo delle dichiarazioni). La Predittivita' no: chiama `ancoraDellAnno`
   dell'anno chiesto e, senza ancora, rinuncia al numero (avviso
   `ancora_mancante`) invece di ripiegare sull'ultima lettura. E' voluto: non
   va "allineata" a puntoDiPartenza.
3. **Rete, ACI ed extra raccolta non si mescolano mai**: giacenze, dichiarazioni,
   totali, KPI. La rilevazione di uno stoccaggio si divide per classe (1-4 rete,
   9 ACI); `GiacenzaSito.giacenza_riferimento_t` e' la rete e
   `giacenza_riferimento_aci_t` l'ACI; l'extra raccolta a portale non c'e'.

Il 21/09/2026 gli "scarti" di Green Tyre (24,56 t), Gatim (14,95 t) e T-Cycle
(11,56 t) erano carichi caricati nel gestionale che la fotografia del 18/09 non
conteneva ancora: con la regola 2 si aggiungono da soli.

**Dove la regola 1 e' saltata tre volte, e come si e' chiusa.** Il 28/09/2026 una
ricognizione su tutto il gestionale ha cercato ogni confronto che usasse l'inizio
trasporto o la chiusura a portale al posto della fine. Il cuore condiviso era a
posto (`movimenti.ts`, `filtroPeriodo.ts`, `raccoltoCalculator.ts`, le giacenze, la
predittivita', la fatturazione): quello che sbagliava era **la lettura dei file
esterni**, dove il nome della colonna non e' il nostro.

- **Report settimanali.** Per un impianto o uno stoccaggio "data carico" e "data
  ingresso" sono la FINE del trasporto - "carico" e' quello che entra nel loro
  registro di carico e scarico - ma l'agente che mappa le colonne le classificava
  come inizio trasporto, e nascevano anomalie su date che nel report non esistono.
  Regola: **una tabella con una sola colonna di data ha la data del movimento**,
  in qualunque casella sia arrivata (`riparaColonneData`, `riparaDateRighe` in
  `base44/shared/reportSettimanali.ts`). A decidere e' la **colonna**, non le
  righe: con due colonne vere e la casella dell'arrivo vuota, guardare le righe
  faceva diventare la partenza la data del movimento. Al riconfronto le colonne si
  leggono dalla lettura salvata (`colonneDateDellaLettura`), e quando una data si
  legge diversamente si scrive (`nota_date` dell'esito, mostrata nella scheda e
  nell'Excel).
- **Prefattura Ecotyre.** La colonna della data si cercava con `/data|trasporto/` e
  vinceva la prima da sinistra: una "Data chiusura" aggiunta dal portale avrebbe
  fatto rifiutare la prefattura giusta («e' la prefattura di Agosto», sul file di
  luglio). Ora si cerca la fine trasporto e si escludono chiusura, immissione, inizio,
  partenza, emissione, documento, fattura e scadenza (`INTESTAZIONI` in
  `base44/shared/prefattura.ts`): nemmeno una "Data documento" o una "Data
  fattura" puo' vincere, il controllo c'e' gia'.
- **Campi `mese`, `anno`, `settimane` dei record.** Li scrive `getDataRiferimento`:
  `dataPeriodo` per i movimenti, `ordine_immesso_il` per gli **Assegnati**, che non
  hanno un trasporto ma una data di immissione. E
  **non si rileggono mai** per decidere un periodo: si ricalcolano. L'unico punto
  che preferiva il campo memorizzato (`mese_immissione` in `pivotCalculator.ts`) e'
  stato tolto.

### Il periodo di un movimento e' la fine del trasporto

A quale giorno, settimana, mese e anno appartiene un movimento lo decide
**`trasporto_finito_il`**, mai `ordine_chiuso_il` e mai i campi `mese`, `anno` o
`settimane` memorizzati sul record. Il portale chiude l'ordine giorni dopo la
fine del trasporto, e i due non cadono nello stesso mese: contato sul 2026,
96 primarie di rete su 2.827 (272,65 t), 2 ACI su 44, una secondaria e 65
terziarie su 99 (2.198,64 t).

La regola vive in **due punti, che devono restare d'accordo** (verificato il
08/10/2026):

- **chi legge** la chiede a `base44/shared/movimenti.ts` (`giornoMovimento`,
  `periodoMovimento`, sul giorno italiano; specchio in `src/lib/movimenti.js`):
  vedi "Come si legge un movimento";
- **chi scrive** passa da `dataPeriodo` di `base44/shared/dataEnrichment.ts`, che
  nessuno importa per nome ma che e' chiamata la' dentro da `getDataRiferimento`
  dentro `enrichRecord`/`enrichRecords`: e' il codice che riempie i campi `mese`,
  `settimane` e `anno` sul record a ogni importazione (`importaBlocco` per le
  primarie, `importEcotyreFile` per secondarie e terziarie).

Percio' **se la regola cambia si cambiano tutti e due**: toccando solo
`movimenti.ts` l'importazione continuerebbe a scrivere i periodi con la regola
vecchia, e i due punti si separerebbero in silenzio. I campi memorizzati, dal
loro lato, non decidono niente: possono venire da importazioni vecchie, quando la
data di riferimento era la chiusura, quindi non ci si fida e si ricalcola.

Non ci sono eccezioni, nemmeno per le giacenze. Il portale aggiorna il suo saldo
quando chiude l'ordine, giorni dopo il trasporto, ma quella e' una sua abitudine
amministrativa: la giacenza vera di un piazzale cambia quando il camion arriva o
parte, non quando qualcuno chiude una pratica. Regola della direzione,
19/09/2026: vale la fine del trasporto per la fatturazione, per le registrazioni
e per le giacenze, in tutto.

`ordine_chiuso_il` non decide niente, **nemmeno i tempi di evasione** (regola
dell'utente del 21/09/2026, "mai, dico mai"): nr_giorni, raccolta_nei_tempi e
gli SLA si misurano dall'immissione alla fine del trasporto con `tempiRaccolta()`
di `base44/shared/movimenti.ts`. La chiusura si puo' solo mostrare.

**E da dove parte, allora, un numero?** Questa domanda e' il punto in cui la
regola si perde, perche' scritta come divieto non la risponde, e chi la
riderivasse tornerebbe a guardare il portale. La forma positiva, decisa dalla
direzione il 24/09/2026:

> La giacenza di un piazzale e' una **somma algebrica**: l'ancora dell'anno - la
> giacenza dichiarata al 31/12 precedente, o la prima lettura dell'anno - piu'
> **tutti i movimenti con fine trasporto successiva**, classe per classe e canale
> per canale. **La lettura del portale e' un riscontro, non la fonte del numero.**

Quando una lettura si scosta, lo scarto si spiega - e li' `ordine_chiuso_il` si
puo' nominare, perche' il portale chiude gli ordini qualche giorno dopo - ma il
numero mostrato resta quello dei nostri movimenti. Cosi' ogni caricamento
riallinea tutto da solo, che e' la seconda regola assoluta. Vale lo stesso
ovunque ci sia una fotografia esterna da confrontare: la fotografia dice che cosa
sapeva chi l'ha scattata, non che cosa e' successo.

**Uno scarto spiegato dagli ISTANTI non e' uno scarto da inseguire**
(08-09/10/2026, `spiegazione: 'tempi'` in `shared/giacenzaStoccaggi.ts`). NAPPI
SUD, lettura del 05/10: otto carichi arrivati quel giorno che il portale ha
chiuso il giorno dopo fanno lo scarto **esatto** (9.580 kg di P, 11.480 di M).
Nessuno dei otto, da solo, lo faceva, e la rilevazione restava «da controllare»
per sempre: si guarda la **somma** per classe e per verso, e solo se torna al
chilo. I carichi sono giusti e la lettura e' giusta - il piazzale e' stato letto
prima che scaricassero - quindi **l'anomalia non si alza, l'ancora conferma la
lettura (`solo_tempi`) e la spiegazione resta scritta**. Le tre voci devono dire
la stessa cosa: il 09/10 l'avviso in cima taceva mentre la scheda Stoccaggi
scriveva «non torna nemmeno con l'ancora», ed e' il difetto che si continua a
pagare. Diverso e' lo scarto spiegato da un **peso che torna esatto**: quasi
sempre e' un formulario finito nella classe sbagliata (NAPPI SUD 16/09, P +6.160
e M -6.160), e li' c'e' qualcosa da correggere - l'anomalia **resta**.

**LA CHIUSURA D'ANNO (scheda Giacenze > Chiusura anno,
`shared/chiusuraAnno.ts`).** La fotografia del 31/12 e' il punto da cui ripartono
le giacenze dell'anno dopo: si legge a portale il saldo per classe di ogni
piazzale, lo si corregge con i movimenti di dicembre che il portale non aveva
ancora chiuso, e si salva. Due regole, dal 09/10/2026 (il giorno in cui l'utente
ha chiesto che al 31/12/2026 «tutto fili come un orologio»):

- **Entra solo chi ha fatto qualcosa nell'anno che si chiude** (10/10/2026,
  `sitiDellaChiusura`): un movimento, una rilevazione o una riga di
  GiacenzaSito dell'anno; oppure, fermo, un piazzale che all'ultima rilevazione
  aveva ancora PFU. Gli archivi tengono anche il 2023-2025 e i movimenti si
  prendevano «fino al 31/12» senza un inizio: la chiusura del 2026 chiedeva la
  lettura a Ecorecuperi, Rpn, New Deal, Corgom, A.L.F., MAJESTIQUE e AKCANSA,
  nessuno con un movimento SMOCO nel 2026, e un piazzale senza lettura blocca il
  salvataggio. INNOREC resta: niente contratto, ma terziarie nel 2026. I
  movimenti vecchi restano al saldo atteso, che parte dall'ultima rilevazione.

- **La rettifica di dicembre la decide il gestionale, non si chiede di
  confermarla.** Nell'elenco di dicembre ci finisce **solo** chi il portale non
  aveva ancora chiuso alla fotografia (`elencoDicembre` scarta chi ha
  `chiuso_il <= foto`): se il portale non l'aveva chiuso, nel saldo di quel
  giorno non c'e', e va rettificato. Chiedere conferma voce per voce era chiedere
  all'utente di ripetere quello che il portale ha gia' detto, e intanto la
  fotografia restava bloccata - sulla chiusura 2025, quattro movimenti di Nappi
  Sud chiusi tutti il 07/01/2026. La rettifica si applica, la riga dice
  «decisa dal gestionale» con il motivo, e l'ultima parola resta all'utente
  («gia' nella lettura», o la classe in cui il portale l'ha messo). Una decisione
  che non si riconosce blocca ancora: non si tira a indovinare.
- **In cima alla pagina sale solo quello che chiede qualcosa.** Terziarie
  (una classe non ce l'hanno), movimenti di un impianto (del portale si sa il
  totale, non la ripartizione per classe) ed extra raccolta (a portale non c'e')
  **non possono cambiare** la fotografia dei piazzali: si elencano nella scheda,
  accanto alle righe che raccontano, e non diventano un avviso. Erano tre
  riquadri ambra ripetuti identici piu' sotto, e sulla chiusura 2025 erano 40
  voci su 44: un avviso che non si puo' chiudere insegna a non guardare gli
  avvisi. Gli avvisi portano un `livello` (`attenzione` o `informazione`).

Per il 2025 manca l'anno prima: niente ancora del 31/12/2024 e niente movimenti
2024, quindi i piazzali non hanno un punto di partenza e l'attesa non si calcola.
Non e' un difetto, e si dice: dal 2026 l'ancora c'e' (la fotografia del
31/12/2025) e il confronto torna intero.

### Il guardiano notturno e la memoria dei numeri (10/10/2026)

Ogni notte alle 5 (`base44/workflows/GuardianoNotturno.jsonc`) la quadratura di
tutti gli impianti si rifa' da se' e lascia scritta una riga: l'entita'
`IndicatoreGiorno`, **una per giorno**. Serve a due cose, e tutt'e due contano.

- **Il guardiano.** Se un impianto si scosta dal portale lo si trova la mattina
  in cima all'elenco delle cose da gestire, col nome e il numero - «T-CYCLE
  INDUSTRIES SRL +1,20 t» - senza aprire nessuna pagina. Prima lo scopriva
  l'utente aprendo un modulo, o non lo scopriva nessuno.
- **La memoria.** Il gestionale sa rispondere a «come siamo adesso» e non sa
  rispondere a «com'era a giugno»: ogni numero si ricalcola sul presente e non
  resta niente. Dentro la stessa riga restano i numeri del giorno, per sito e
  per canale. **Il valore di questa cosa e' il tempo che accumula**: si comincia
  a scrivere molto prima di quando servira' leggere.

La regola sta in `base44/shared/indicatoriGiorno.ts` (prove in
`prove/guardianoNotturno.mjs`); a scrivere e' `riepilogoDichiarazioni` con
`registra: true`, perche' la quadratura la calcola gia' lui e **un terzo posto
che la rifa' darebbe una terza risposta**. Quattro prudenze:

1. **Una riga per giorno, non una per apertura di pagina**: scrive solo con
   `registra`, e lo stesso giorno si riscrive invece di aggiungersi.
2. **Nessun anno cablato nello scheduler.** Il workflow non passa l'anno: con
   `registra` vale quello corrente. Un anno scritto in uno scheduler e' la
   trappola che scatta il 1° gennaio, quando il guardiano continua a
   controllare l'anno vecchio senza dirlo.
3. **Si guarda solo chi ha un confronto col portale**: gli impianti della rete.
   Un piazzale ha la sua rilevazione, che e' un'altra cosa, e chi non ha
   fotografia (Tecnogum) non si scosta da niente. I loro numeri si scrivono lo
   stesso, ma non entrano nel verdetto.
4. **Un guardiano che dorme e uno che non trova niente si assomigliano troppo**:
   se la fotografia piu' recente ha piu' di due giorni la dashboard lo dice.

La tolleranza e' quella della quadratura (`TOLLERANZA_QUADRATURA_T`), una sola
per tutto il gestionale, e le tonnellate si scrivono con `formatoTonnellate`:
un secondo formato qui dentro scriveva «1,200 t» dove tutto il resto dice
«1,20 t», e l'ha trovato una prova.

Un assegnato non e' un movimento: il suo periodo e' `ordine_immesso_il`.

### Il dichiarato e' di chi tratta, non di chi stocca (10/10/2026)

Una dichiarazione di trattamento e' del **soggetto**, e la mappa che la tiene
ha per chiave `soggetto|canale`: il ruolo non c'entra. Ma nelle giacenze un
soggetto che e' insieme impianto e piazzale - Gatim, Green Tyre, Irigom - ha
**due righe**, e letta senza guardare il ruolo quella mappa rispondeva a tutt'e
due. Risultato: «ACI dichiarato 115,54 t» sulla riga dello stoccaggio GATIM, che
non dichiara niente, e nel totale quelle tonnellate contate due volte - ACI
275,08 invece di 154,22, extra raccolta 1,72 invece di 0,86.

**Chi tratta dichiara; chi stocca custodisce.** Il materiale che sta a terra in un
piazzale finira' nella dichiarazione dell'impianto che lo lavorera', e li' deve
comparire. Sulla riga del piazzale il dichiarato e' `null`, non zero: zero si
leggerebbe «non ha ancora dichiarato», che e' un'attesa, e il trattino ha la sua
spiegazione (`SENZA_DICHIARATO_PIAZZALE`).

Due cose da portarsi via, piu' grandi di questo difetto.

1. **Una mappa per soggetto letta su una riga per ruolo e' una trappola.** Qui il
   calcolo della giacenza era protetto (`if (td === 'imp')`) e il campo accanto
   no: la stessa mappa, due letture, una giusta e una sbagliata. Quando una
   chiave e' piu' grossa della riga che la legge, va ristretta a ogni lettura.
2. **Un numero sbagliato accanto a uno giusto e' il piu' difficile da vedere.**
   La giacenza era esatta, quindi niente diventava negativo e nessun avviso
   scattava; il conto a occhio - apertura + entrato - dichiarato - non tornava, e
   chi guardava dava la colpa al conto invece che al numero. L'ha trovato il
   **confronto fra due moduli** che devono dire la stessa cosa (regola
   dell'utente, 03/10/2026): la fotografia del guardiano diceva 154,22 e la
   Situazione delle giacenze 275,08. Prove in `prove/dichiaratoDiChiTratta.mjs`,
   che fa girare la funzione vera e poi la rifa' girare con la protezione
   togliendola, per vedere il doppio ricomparire.

Vale la pena dirlo perche' e' il primo difetto trovato dal guardiano notturno, e
non da una pagina aperta: e' esattamente il mestiere per cui e' stato scritto.

### Una dichiarazione per mese, e un avviso non grida a zero (10/10/2026)

**LA CHIAVE DI UNA DICHIARAZIONE MENSILE**: anno + sito normalizzato + canale +
provenienza + mese. Cinque campi, e **l'operazione non c'entra** - R1 o R3 e' una
proprieta' del sito (Irigom e T-Cycle fanno R1, gli altri R3), non un modo di
distinguere due dichiarazioni dello stesso mese. La chiave non e' un'opinione:
e' quella con cui il riepilogo aggancia le righe ai mesi, cioe' quella che decide
che cosa l'utente vede. La regola sta in `shared/dichiarazioniImpianti.ts`
(`chiaveDichiarazione`, `esitoScrittura`, `doppioniDichiarazioni`,
`unisciDichiarazioni`), prove in `prove/unaDichiarazionePerMese.mjs`.

**La piattaforma non ha vincoli di unicita' ne' indici**: l'unico presidio e' il
codice. Quindi **chi scrive passa dalla regola, sempre** - il dialogo del mese, la
griglia, la pratica di Irigom, il seme - e chi scrive rilegge prima di scrivere,
perche' fidarsi di quello che la pagina aveva in mano quando l'hanno aperta e'
bastato a generare gemelle: due schede aperte, un secondo clic, un allineamento
girato nel frattempo.

**COSA FA UNA GEMELLA, e perche' era invisibile.** I due moduli rispondono in modo
opposto: il riepilogo ne tiene **una sola** (una Map per chiave) e quelle tonnellate
spariscono dai conti; le giacenze le **sommano** e si contano due volte, con la
giacenza decurtata il doppio. Lo stesso errore, un dato in meno da una parte e uno
in piu' dall'altra. E siccome la gemella non compare nel riepilogo, **non era
correggibile da nessuna casella**: la volta dopo il mese sembrava vuoto e si
creava la terza riga.

**L'EXTRA RACCOLTA E' L'ECCEZIONE** (utente, 10/10/2026): a portale non e' gestita,
sono campagne occasionali e nello stesso mese ce ne possono stare due, quindi
ripetersi e' legittimo. Ma allora chi legge le **deve sommare**: permettere la
seconda riga senza sommarla vorrebbe dire perderla, e un dato perso e' peggio di un
doppione perche' non lascia traccia. E **caricato vuol dire caricato**: sommare due
campagne di cui una sola e' a portale e chiamare caricato il totale farebbe
decurtare la giacenza di qualcosa che il portale non ha ancora visto, percio' i
chili caricati si tengono a parte (`caricato_kg`, `kgCaricatiDi`).

**UN DOPPIONE SI PRESENTA COME DOPPIONE.** Altrove si traveste: nel confronto col
portale la gemella non pareggia nessun caricamento e finisce fra «i mesi che il
portale non conosce», che manda a cercare un problema dove non e'. Il guardiano
notturno li cerca ogni notte (`doppioni_json` nella fotografia del giorno), la
dashboard li mette fra le cose da gestire col mese e il canale, e la pagina delle
dichiarazioni li scrive sopra a tutto il resto.

**E UN AVVISO NON GRIDA AL LUPO A ZERO.** Due casi trovati lo stesso giorno:

- l'avviso dei file non rimossi veniva **riscritto a zero** da ogni pulizia che non
  trovava niente da togliere, e diceva «0 file caricati restano sulla piattaforma:
  cancellarli non si puo'» - una frase che si contraddice da sola, in cima agli
  avvisi per settimane. Una pulizia senza niente da fare non vuol dire che i file
  di prima se ne siano andati: il conto lo abbassa solo chi li ha visti andarsene.
- la voce della dashboard del guardiano copriva due cause con una frase sola, e un
  doppione senza scostamenti avrebbe scritto «**0 impianti** non quadrano col
  portale» accanto a «tutti gli impianti quadrano (2)». Due cose diverse, due voci
  diverse.

**Il presidio vale quanto la fiducia che gli si da'**: un avviso che si accende a
zero e' il modo piu' sicuro di far ignorare quelli veri, ed e' peggio di un avviso
che non c'e', perche' costa attenzione ogni giorno senza dire niente.

### Giacenze e Dichiarazioni: lo stesso numero, controllato da una prova (10/10/2026)

La regola dell'utente del 03/10/2026 - i due moduli dicono gli stessi numeri su
tutti e tre i canali - era scritta nei commenti e controllata a occhio. L'audit
del 10/10/2026 la ha misurata sui dati veri (53 confronti su 54 uguali al
centesimo) e ha trovato quattro modi in cui si rompeva senza che nessuna prova
se ne accorgesse. Da oggi c'e' `prove/dueModuliStessiNumeri.mjs`, che fa
**girare le due funzioni vere** (`calcolaGiacenze` e `riepilogoDichiarazioni`)
sugli stessi archivi e le confronta canale per canale. Un cambiamento che fa
dire a uno dei due un numero diverso dall'altro rompe quella prova.

1. **La rete di chi non la dichiara non ha una giacenza** (decisione
   dell'utente). Tecnogum: Giacenze diceva 0 («vuoto»), Dichiarazioni 1.833,43 t
   (tutto quello che e' arrivato). Ora **«—» con il perche' in tutti e due**: il
   trattamento non e' a nostro carico, il portale non tiene per noi una giacenza
   di rete. Quello che e' arrivato si vede nel conferito. Ogni mese di rete di
   un sito con `dichiara_rete` falso e' non dovuto, non solo quelli segnati a
   mano (prima lo era solo gennaio). Lo storico del guardiano la tiene fuori: il
   primo giorno era il 53% della giacenza di rete. E attenzione a `r2(null)`:
   arrotonda a 0, e uno zero dice «vuoto» - la prova l'ha trovato nella
   correzione stessa.
2. **Piu' campagne di extra raccolta nello stesso mese**: `dichiarazioneDi` nel
   riepilogo ricostruiva la dichiarazione campo per campo e perdeva `caricato_kg`,
   `altre` e `ripetizioni`. Con una campagna caricata e una no, qui faceva 0
   caricato e nelle giacenze il peso giusto.
3. **Le dichiarazioni caricate dopo la fotografia si leggono di tutti gli anni**,
   in tutti e due i moduli: una dichiarazione di due anni fa caricata oggi scala
   la giacenza a portale di oggi. Il riepilogo leggeva solo l'anno e l'anno
   prima: a gennaio, guardando il 2026 per chiuderlo, i due moduli avrebbero
   detto numeri diversi.
4. **Il filtro SMOCO sta in `caricamentiPortale`**, l'unico punto da cui passano
   tutte le righe del report delle dichiarazioni. L'allineamento automatico -
   l'unico che SCRIVE «caricata» sulle nostre righe - lo saltava: 1.605 righe
   di Baucina hanno come destinazione secondaria Irigom, e una loro riga poteva
   pareggiare al chilo un nostro mese. La controprova lo fa vedere: un nostro
   luglio da 4.100 kg agganciato a un caricamento di Baucina.
5. **Il conferito della riga TOTALE conta ogni carico una volta.** Sulla riga
   di un impianto il conferito comprende le secondarie arrivate dai piazzali, ed
   e' giusto: il suo target le comprende. Sommato sulle righe contava due volte
   ogni PFU passato da un piazzale (10.744,79 t contro 8.818,55 raccolte): la
   riga TOTALE delle Giacenze diceva «residuo 800,21 t» invece di circa 2.730, e
   il PDF «Conferito RETE 10.744,79 t». Il totale del conferito e' quello delle
   primarie, come nel modulo Dichiarazioni. La prova ha un piazzale apposta.

### Canali indipendenti

RETE, ACI ed EXTRA RACCOLTA sono commesse separate: non si sommano mai, in
nessun modulo, nemmeno come totale di controllo o come conteggio di formulari, e
anche quando un viaggio di secondaria porta formulari di piu' canali. I target
esistono solo per la rete.

**Un movimento si fattura in un canale solo.** Un record dell'extra raccolta non
deve comparire fra gli impianti del giro RETE: ci compariva, e la stessa riga di
trattamento si pagava due volte, una per scheda. Quando un viaggio di secondaria
porta insieme formulari di rete e formulari ACI, l'importo si paga una volta
sola: a tonnellata ogni canale paga i suoi chili; **a viaggio l'importo si divide
fra i canali in proporzione ai chili effettivi di ciascuno su quel viaggio**
(regola dell'utente del 22/09/2026, `quoteViaggioMisto` in
`base44/shared/passivaCalcolo.ts`: la quota della rete si arrotonda al centesimo,
l'ACI prende il resto, cosi' le parti fanno sempre l'importo). Il viaggio misto
non e' un'anomalia. Le tonnellate mostrate sono quelle del canale che si sta
guardando, mai la somma dei due.

**Extra raccolta in fatturazione** (22/09/2026). In attiva vale il prezzo scritto
sull'intervento; se e' zero o vuoto, la tariffa base: la Tariffa ATTIVA
EXTRA_RACCOLTA della data, e senza quella **202 euro/t nel 2026**. In passiva i
costi (raccolta, stoccaggio, trattamento) sono quelli che l'utente scrive a mano
sull'intervento prima di passarlo da assegnato a terminato: **mai il ripiego sulle
tariffe di rete**, ne' nel calcolo ne' nel modulo. In fatturazione entrano solo gli
interventi terminati, nel mese della fine trasporto. Una scheda si chiude
(terminato) solo con FIR, peso effettivo e le tre date obbligatorie.

### Pesi

Le valutazioni si fanno sul peso effettivo (`peso_effettivo`), mai sullo stimato.
Tonnellate con due decimali, tre se i kg non sono tondi; kg sempre interi;
ovunque, export compresi.

### Come si legge un movimento: un punto solo

`base44/shared/movimenti.ts` (specchio per le pagine: `src/lib/movimenti.js`).
Chi deve decidere se un movimento conta, in che mese e in che canale lo chiede
li', e non riscrive la regola:

- `eTerminato(r)`: conta solo un movimento terminato;
- `periodoMovimento(r)`: giorno, anno, mese e settimana ISO dalla **fine del
  trasporto sul giorno italiano**; `filtraMovimenti(records, { anno, mese, canale })`;
- `giornoElenco / annoElenco / meseElenco`: per gli elenchi e i loro filtri di
  giorno, mese e anno, che mostrano anche ordini senza trasporto. Un terminato
  si colloca solo sulla fine trasporto; un ordine non terminato all'immissione.
  Un **terminato senza fine trasporto** non ha giorno, mese ne' anno: nessun
  filtro di periodo lo prende, e la pagina lo conta e lo segnala a parte. Mai la
  chiusura a portale;
- `giornoOrdine / annoOrdine / meseOrdine`: ripiegano sull'immissione anche per
  un terminato senza fine trasporto. **Non** servono agli elenchi: restano solo
  per chi attribuisce apposta all'anno di immissione il conteggio dei senza fine
  (per esempio esportazioni, giacenze e qualifica: `grep annoOrdine` dice chi);
- `canaleMovimento(r, archivio)`: rete, ACI (con `eAci`) o extra raccolta;
- `eEseguito(r)`: il limbo del portale, dati tutti inseriti e Chiudi non premuto.
  Non si somma ai terminati, si conta a parte e **si segnala**;
- `eCancellato(r)` e `motivoCancellazione(r)`: lo stato si confronta per intero, e
  il motivo si legge in un modo solo ("altro: pdr doppio" diventa "Pdr doppio"),
  cosi' Evasione Assegnati e la to-do list non lo scrivono in due modi.

Per la **classe e il canale insieme** c'e' `canaleEClasse(r, { aci })` in
`base44/shared/giacenzaStoccaggi.ts`, con l'invariante **canale ACI se e solo se
classe ACI**: usa lo stesso `eAci`, cosi' il canale resta quello canonico. Il canale
lo decide il **materiale**, non l'archivio in cui la riga sta (decisione
dell'utente, 28/09/2026): una primaria di classe 9 e' ACI anche se si trovasse nei
Terminati Rete. Oggi non capita - `importaBlocco` rifiuta il blocco il cui archivio
non torna con `archivioPrimaria` - quindi e' una **rete di sicurezza**, non la
provenienza normale: non va raccontata a video come se lo fosse. E dove la regola
vale, vale in **tutte** le colonne della stessa pagina: giacenza, conferito,
residuo, percentuale del target e segnalazioni sulle date. La stessa riga che e' ACI
in una colonna e rete in quella accanto e' un difetto, anche se i numeri sembrano
plausibili.

Anche «oggi» e' il giorno italiano (`oggiRoma()`), non `new Date()` del server.
E nessun modulo si fa una correzione sua del giorno: il report settimanale ne
aveva una che riportava al giorno italiano solo le ore 22:00 e 23:00 tonde, e un
trasporto finito alle 23:30 UTC del 30 giugno restava a giugno li' e andava a
luglio altrove (audit del 10/10/2026). Si usa `giornoRoma`. Nella stessa prova
(`prove/indicatoriVeri.mjs`) due avvisi che dicevano il falso: la matrice delle
province contava **il mese in corso come un mese vuoto** (il primo del mese,
due mesi senza raccolte per un mese cominciato da un giorno), e la regex dei
nomi dei raccoglitori era `/s+/` e toglieva le lettere «s» invece degli spazi.
Gli specchi in `src/lib` devono restare identici agli originali: lo controlla
`prove/specchi.mjs`. **Prima di spingere: `npm run lint` e `npm run prove`.**

## Regole della commessa

Regole di dominio che il codice deve rispettare sempre. Valgono per ogni nuovo
conto, filtro, export o assistente: se una modifica le viola, e' sbagliata anche
quando "funziona".

### Chi conferisce dove

Un movimento non va da chiunque a chiunque, e ci sono due livelli.

**Chi ha un sito proprio conferisce in primaria solo li'.** Green Tyre Project a
Green Tyre Project, Nappi Sud a Nappi Sud, Gatim a Gatim. Una primaria di Nappi
Sud verso Tecnogum non esistera' mai: agli altri impianti ci arriva in
secondaria, dove non e' piu' un raccoglitore ma il produttore. Una rotta del
genere va segnalata anche se fossero cento viaggi - non e' rara, e' impossibile.

**Chi non ha un sito proprio stocca presso terzi** e puo' avere piu' di una rotta
buona: C.L. Service stocca sia a Nappi Sud (59 viaggi) sia a T-Cycle (33),
Emmesse conferisce a Irigom (24) e a Gatim (6). Per costoro vale una soglia: una
destinazione sotto il 5% dei loro viaggi e sotto i cinque viaggi e' sospetta.

Il controllo sta in `base44/shared/rotteConferimenti.ts`, legge le rotte dalla
storia dell'anno e non ha bisogno che nessuno le scriva a mano.

### Gli impianti che svuotano la giacenza dell'anno prima

Un impianto puo' non essere piu' contrattualizzato nell'anno in corso e avere
lo stesso movimentazioni e dichiarazioni: deve svuotare la giacenza dell'anno
precedente, e lo fa con secondarie e terziarie (regola dell'utente, 23/09/2026).
Nessun modulo che parla di giacenze, dichiarazioni, verifiche o fatturazione puo'
escludere un sito perche' non ha un contratto quest'anno: si escludono solo dai
target e dalla predittivita', che sono cose dell'anno in corso.

**La regola vale per chi ha movimenti NOSTRI**, cioe' con SMOCO partner
operativo (utente, 10/10/2026: «considera sempre come partner operativo Smoco e
non altri»). Il 23/09 qui si citavano INNOREC e PRT come esempi: PRT invece non
compariva per dei movimenti, ma per una rilevazione del piazzale tutta a zero
entrata col caricamento iniziale del 13/09 (`seedGiacenzeStoccaggio`), preso dal
file del portale senza guardare il partner. Non e' contrattualizzato nel 2026 e da
anni non ha movimenti con SMOCO: dal 10/10/2026 e' fuori. Un piazzale si toglie da
Giacenze > Stoccaggi, «Elimina unita' locale», che cancella tutte le sue
rilevazioni: e' da quelle che lo leggono le Giacenze, la chiusura d'anno (che
altrimenti chiederebbe la sua lettura del 31/12 e gli creerebbe una riga
dell'anno dopo) e la lista dell'anno nuovo.

### Su quali tonnellate si paga ciascuna prestazione

**La raccolta si paga a chi ha raccolto.** La base sono le tonnellate dei
formulari di quel raccoglitore, nel canale giusto, nel mese in cui e' finito il
trasporto.

**Stoccaggio e trattamento si pagano su tutto cio' che arriva al sito**, anche
quando l'ha portato un altro. Se Nappi Sud raccoglie 100 t e sul suo piazzale
conferiscono altri raccoglitori per 30 t, a Nappi Sud si pagano 100 t di raccolta
e 130 t di stoccaggio. Su Gatim conferisce anche Emmesse, e il conferito di
Emmesse si somma in fattura a quello che Gatim ha raccolto e trattato. Il "di
cui" sotto ogni riga di impianto o stoccaggio dice chi ha portato cosa, cosi' la
differenza resta visibile invece di sparire in un totale.

I canali restano separati anche quando il prezzo e' lo stesso: lo stoccaggio di
Nappi Sud costa 16 euro la tonnellata sia sulla rete sia sull'ACI, e sono due
righe, non una.

**Il prezzo unico.** Di regola raccolta e trattamento sono due prestazioni con
due prezzi. L'eccezione si dichiara sulla tariffa di raccolta col flag
`comprensiva_trattamento`: allora il trattamento presso l'impianto dello stesso
fornitore non si fattura a parte e in fatturazione compare come «compreso nel
prezzo unico». Nel 2026 riguarda solo Green Tyre Project sull'ACI, 225 euro la
tonnellata. Se per lo stesso fornitore e canale esistono sia il prezzo unico sia
una tariffa di trattamento, il gestionale lo segnala: si pagherebbe due volte.

**Il prezzo puo' dipendere dalla zona o dalla destinazione.** La cascata e'
destinazione, provincia, regione, generica. La raccolta ACI di Nappi Sud costa 82
euro in Basilicata e 92 in Campania, e la regione si legge dalla provincia del
demolitore a cui afferisce il formulario; la raccolta di Emmesse costa 72 euro se
scarica a Gatim e 90 se scarica a Irigom. In fatturazione la destinazione sta in
colonna e la riga porta il criterio con cui la tariffa e' stata scelta.

### Le due regole del portale sull'ACI

Una richiesta ACI non si stima sotto i **1.500 kg**, e un formulario ACI non si
chiude a piu' del **10% del peso stimato del suo ticket**. Il ticket e' il
`numero_ordine_interno` (colonna AL, Numero_Ordine_Interno, nei file delle
primarie e degli assegnati); il peso stimato e' `peso_stimato` (colonna U), letto
sullo stesso ID ordine (colonna A).

Da qui una conseguenza che sembra un errore e non lo e': **lo stesso formulario
puo' comparire su due ID ordine diversi.** Succede quando il carico supera la
soglia del primo ticket e il peso effettivo viene ripartito su un secondo ordine,
col suo ticket e il suo stimato. Il 9 giugno 2026 il formulario RGYTR022620TW sta
su ET26091175 (ticket 162684-15, stimato 2.800, effettivo 1.960) e su ET26102183
(ticket 163142-85, stimato 1.500, effettivo 1.500): tutti i 3.460 kg sul primo
ticket avrebbero sforato i 3.080 ammessi.

In fattura conta **solo la somma dei pesi effettivi**. La scomposizione - un rigo
per ID con ticket, stimato ed effettivo - si mostra lo stesso, perche' rende
leggibile da dove viene il totale. E' un'anomalia vera, invece, lo stesso
formulario due volte sullo **stesso** ordine: quello e' un ritiro caricato due
volte e si pagherebbe due volte.

Da qui due regole che valgono **in ogni modulo**, non solo nella fatturazione:

- **i pesi si sommano**: ogni quota e' peso vero;
- **i formulari si contano una volta sola, per numero**. Chi conta formulari usa
  `contaFormulari()` da `base44/shared/formulari.ts`, mai `righe.length`: due
  quote dello stesso documento contate come due formulari fanno sballare la
  quadratura contro la stampa del portale, che quel formulario lo elenca una
  volta. Chi confronta il gestionale con un elenco esterno - la quadratura FIR, i
  report settimanali degli impianti - fonde prima le quote con `unisciQuote()`,
  altrimenti una riga del report col peso intero si abbina a una quota sola e
  risultano insieme una differenza di peso e un movimento mancante.

A distinguere le quote e' il **ticket**: si mostra sempre accanto al peso
effettivo, ed e' quello che rende il conto leggibile invece che sospetto.

**Tariffa zero non e' un dato mancante.** Il trattamento della rete su Tecnogum
e' davvero a zero, perche' nessun contratto lo prevede. Eco Faso e' una
autodemolizione dove SMOCO va a raccogliere, non un trasportatore: e' giusto che
non abbia un prezzo. Nel 2026 non sono coinvolti MGM, Barone Trasporti,
Minervini ed Eco Faso.

**Nappi Sud e' raccoglitore e stoccaggio insieme**, ed e' la distinzione che fa
sbagliare i moduli:

- come **raccoglitore** ritira dai punti di raccolta con un target suo e porta
  in primaria al proprio piazzale (`Nappi Sud -> NAPPI SUD`). Altri raccoglitori
  possono stoccare li', per esempio C.L. Service;
- come **stoccaggio** e' il **produttore** delle secondarie che partono dal suo
  piazzale verso Irigom e Tecnogum. In quei viaggi non e' un raccoglitore: e'
  l'origine del rifiuto.

Ne discendono due cose. Il suo consuntivo verso un impianto sono le **secondarie**
che gli spedisce, non le primarie, che porta a se stesso. E il suo target di
raccolta e' uno solo: fra gli impianti si divide **in proporzione alle secondarie
che ciascuno riceve da lui**, altrimenti compare intero sotto entrambi e il
residuo risulta il doppio di quello vero.

**Il gia' arrivato della predittivita'** (solo rete, 22/09/2026) ha un conto solo,
`giaArrivatoDiRete` in `base44/shared/proiezioneSecondarie.ts` (specchio in
`src/lib`), usato dal motore della predittivita' (e quindi da ogni scheda, dal
programma del mercoledi' e dagli assistenti): le
primarie di rete arrivate al **sito** dell'impianto seguito, cioe' all'impianto e
al suo piazzale (`tipo_destinazione` 'stoc'), piu' le secondarie di rete da altri
stoccaggi. Le primarie del piazzale contano perche' "il residuo totale diminuisce
anche con le primarie" (utente); le secondarie dal proprio piazzale a se stesso
non si contano, sarebbero contate due volte. Il piazzale conta al netto di quello
che riparte verso altri impianti seguiti (scelta confermata dall'utente il
25/09/2026), in ordine di arrivo (27/09/2026): esce prima la giacenza del
piazzale al 31/12 dell'anno prima, che non si toglie perche' non era nel gia'
arrivato dell'anno, e solo dopo le primarie dell'anno, in ordine cronologico.

### Il target annuo di un impianto si scrive solo in Target & Status

Il target annuo dell'impianto si scrive **solo in Target & Status**
(`ImpiantoTargetSecondaria.target`, in kg, per anno) e le Giacenze lo leggono da
li' (`targetImpiantoDellAnno`: il record attivo di esattamente quell'anno, nessun
ripiego sugli anni prima). Il target delle primarie di un sito non si scrive: e' la
somma dei target annui dei raccoglitori di quell'anno legati a quel sito
(`TargetRaccoglitore.impianto`), **piu' la quota che a quel sito arriva dalla
ripartizione sullo storico dei conferimenti** (`ripartisciTargetPrimarie`). Le
righe di target **senza ruolo** non dicono se portano all'impianto o allo
stoccaggio: la loro somma va su una riga sola del sito, di norma quella
dell'impianto, perche' il totale non lo conti due volte. Le righe che **il ruolo
ce l'hanno** vanno sulla riga di quel ruolo (`TargetRaccoglitore.ruolo`,
`targetPrimariePerRuolo` in `annoTarget.ts`): «T-cycle va gestito come impianto
per le 1050 t e come stoccaggio per le 250 t» (utente, 04/10/2026), e le quote
ripartite il ruolo ce l'hanno sempre, perche' lo dice il viaggio. Il conto sta in
`targetImpianti.ts`; `targetPrimarieDelSito`, che questo file citava, in
produzione non la chiama piu' nessuno (resta nello specchio e nelle prove).
I vecchi `GiacenzaSito.target_totale_t` e `target_primarie_t` restano nel database
e non si scrivono piu' (in Giacenze si vedono in sola lettura): servono solo di
**ripiego di transizione**, quando Target & Status non da' niente, con l'anomalia
`target_da_portare`. Il pulsante "Porta in Target & Status i target scritti in
Giacenze" (`portaTargetInTargetStatus`) crea i record che mancano, con
`segue_predittivita: false`. Il vecchio confronto fra i due (divergenze, alert
`target_impianto_divergente`, voce della dashboard) non c'e' piu':
`checkTargetAlerts` chiude soltanto gli alert rimasti aperti. Tutto in
`base44/shared/targetImpianti.ts` (`targetRigaGiacenze`).

### Le date obbligatorie dei formulari (22/09/2026)

Parole dell'utente: «le date immissione, inizio e fine trasporto sono
obbligatorie nei formulari, se non ci sono vanno segnalate e questo vale sempre
dove ci sono ordini terminati non solo nei report settimanali». La regola sta in
`base44/shared/movimenti.ts` (specchio `src/lib/movimenti.js`):
`DATE_OBBLIGATORIE`, `dateMancanti`, `dateIncoerenti`, `dateDaSistemare`,
`testoDate`. Non si riscrive. Il «sempre» si ferma all'anno scorso
(`dateDaControllare` e `primoAnnoControllato`: utente 25/09/2026, «tieni il 2024 e
toglilo dagli avvisi»); senza fine trasporto non c'e' anno e si segnala sempre.
Quanti sono si conta in **ordini distinti**, mai in
righe (`chiaveOrdine`, `ordiniDaSistemare`, `mancantiOrdine`, `incoerentiOrdine`,
`testoOrdine`, `ordineSenzaFine`, nello stesso file): lo stesso ordine sta in
archivio con piu' righe - una per classe o per prodotto - e contarle tutte
faceva uscire due numeri diversi per lo stesso insieme (23/09/2026).
Un terminato senza fine trasporto resta fuori da
ogni periodo, ma si segnala sempre dicendo quali date mancano; uno con la fine
trasporto ma senza un'altra data, o con la fine prima dell'inizio, si conta e si
segnala lo stesso. Quella e' l'unica incoerenza: un trasporto cominciato prima
dell'immissione e' la regola a portale, dove l'immissione e' il giorno della
registrazione, e segnalarlo voleva dire 941 avvisi incorreggibili (misurato il
22/09/2026). Dove si vede:

- **elenchi** (Terminati Rete e ACI, Secondarie, Terziarie, Extra Raccolta): segno
  sulla riga, avviso per canale, filtro "date da sistemare", colonna negli Excel
  (componenti in `src/components/primarie-rete/DateDaSistemare.jsx`);
- **conti**: le funzioni restituiscono `date_da_sistemare` per canale
  (`riepilogoDate` e `riepilogoDateVista` in
  `base44/shared/raccoltoCalculator.ts`: `{ totale, senza_fine_trasporto,
  mancanti, incoerenti, esempi, testo }`), mostrato in Dashboard, matrice
  province, report mensile, SLA e Target & Status. I report settimanali, le
  rotte, gli alert ed EcoTyna usano `riepilogoVociDate` di
  `base44/shared/reportSettimanali.ts`, che conta gli stessi ordini ma risponde
  `{ ordini, senza_fine, esempi }`: due nomi diversi perche' chi le mostra ne
  legge una sola forma;
- **report settimanali**: un formulario registrato senza una data obbligatoria o
  con date incoerenti e' un'**anomalia** del suo canale e conta nel verdetto
  (`conformitaPerCanale`), non una rettifica a nostra cura;
- **alert**: la regola "date obbligatorie" del motore degli alert, per modulo e
  canale, si apre e si chiude da sola a ogni caricamento (anche delle schede di
  extra raccolta) e compare nel cruscotto;
- **giacenze e dichiarazioni**: per soggetto e canale (`formulariDaSistemare` in
  `base44/shared/giacenzaPortale.ts`); senza fine trasporto un ordine non entra
  nella giacenza calcolata, e se il portale lo conosce la differenza si dice;
- **fatturazione** (anomalie per canale), **qualifica**, **richieste ECT**,
  **evasione assegnati**, **prefattura** ed **EcoTyna**.

Chi la rete non la dichiara per accordo (`dichiara_rete` falso in
`GiacenzaSito`, oggi Tecnogum) non ha una giacenza di rete che il portale tenga
per noi: i suoi carichi non si aggiungono alla fotografia come "non ancora nel
file". Il taglio e' `nonDichiaraRete` in `calcolaGiacenze` e in
`riepilogoDichiarazioni`, con la variante per le dichiarazioni in
`base44/shared/dichiarazioniImpianti.ts`; in `giacenzaPortale.ts` non c'e'.

### Una riga di un altro periodo si verifica sempre (01/10/2026)

Il fatto: Nappi Sud non aveva messo nel report della sua settimana una richiesta
terminata del 14 settembre — non ce l'aveva mandata e non l'aveva annotata nel
suo Excel — e il confronto di quella settimana usciva **perfetto**. La riga e'
comparsa nel report della settimana dopo, dove il gestionale la scartava come
«fuori dalla settimana verificata» senza dire niente, in grigio, in fondo, fra
le righe non considerate. Quando se n'e' accorto l'ufficio registrazioni il
**termine di dieci giorni dalla data di partenza** era passato, e l'utente si e'
preso un richiamo per non averlo segnalato.

Parole dell'utente: «tutte le volte che io carico una verifica settimanale ma
compaiono nell'elenco anche formulari afferenti a settimane precedenti, tu debba
verificare anch'esse pur se non appartenenti alla specifica settimana in esame e
rilevare tutte queste anomalie».

La regola vale **in ogni confronto**, settimanale e mensile:

- una riga di un altro periodo **non si scarta mai**. Si confronta, e porta
  `fuori_settimana { anno, settimana, arretrata }` nei report settimanali
  (`verificaReport` in `base44/shared/reportSettimanali.ts`), o finisce negli
  `arretrati` del consuntivo (`confrontaConsuntivo` in
  `base44/shared/consuntivoFornitore.ts`). Resta fuori solo una riga **senza
  formulario**, su cui non c'e' niente da registrare;
- la settimana di una riga abbinata e' quella del **movimento registrato**, non
  quella che il report scrive: se il report sbaglia la data ma il carico e' della
  settimana verificata, la riga resta nella quadratura;
- resta **fuori dalla quadratura** del periodo verificato, dove il gestionale non
  la colloca (regola 1). Se report e gestionale dicono la stessa settimana e'
  soltanto un carico vecchio, quindi un'**osservazione** — altrimenti ogni report
  cumulativo del mese uscirebbe «parziale» per le sue righe a posto. Se le due
  settimane non coincidono, una delle due date e' sbagliata: **anomalia**;
- un formulario si cerca su **tutti** i movimenti, non solo nei ventuno giorni
  intorno alla settimana: di un carico registrato a luglio il gestionale diceva
  «non presente nel gestionale», che e' una bugia facile da credere;
- **il termine di registrazione** sta in `base44/shared/termineRegistrazione.ts`
  (specchio `src/lib/termineRegistrazione.js`): dieci giorni dalla data di
  partenza, **domeniche escluse**, il giorno della partenza non si conta. Ogni
  formulario che nel gestionale non risulta porta la sua `scadenza`, in qualunque
  settimana. Nell'esito salvato non si scrive **niente che dipenda da oggi**:
  «scaduto da quanto» lo calcolano la scheda e il PDF con `statoTermine`, o ogni
  verifica risulterebbe cambiata ogni giorno e si riscriverebbe da sola;
- si vede: alert nel modulo Verifiche (`REGOLA_ARRETRATI` in
  `esitoVerifica.ts`, si chiude da solo quando risultano registrati),
  **critico** se almeno un termine e' scaduto o almeno un carico e' di una
  settimana precedente, altrimenti **warning**, in testa
  alla scheda, in una sezione del PDF prima della quadratura, nel foglio Excel
  «Settimane precedenti», con una pastiglia rossa nell'elenco delle settimane
  (`arretrati_da_registrare`, `settimane_arretrate`), e nella **storia scritta**,
  formulario per formulario, perche' al quarantesimo giorno il dettaglio se ne va;
- dai **registri di carico e scarico** si leggono anche i trenta giorni prima
  della settimana (`GIORNI_ARRETRATI_DAL_REGISTRO` in `src/lib/verifiche.js`):
  col filtro alla settimana esatta un carico rimasto indietro non arrivava
  nemmeno al confronto.

### Un numero sbagliato di una lettera non e' due difformita' (01/10/2026)

Parole dell'utente: «verifica tutte le informazioni contenute in ogni rigo e poi
confrontale con il nostro gestionale; le cose importanti su cui decidere sono il
numero del formulario, l'id ordine, ma chi ci invia il report puo' anche
sbagliare, ad esempio scambiando una lettera o una cifra, pertanto tu fai i
paragoni con piu' informazioni della stessa riga».

Un identificativo sbagliato di un carattere, confrontato da solo, non produce un
errore ma **due**: «questo ce lo fattura e noi non l'abbiamo» e «questo l'abbiamo
noi e lui non lo riporta». Due accuse al posto di una frase, su un documento che
autorizza una fattura.

- Un numero quasi uguale **non basta**, e un peso uguale **non basta**: si abbina
  quando il numero e' quasi uguale (formulario entro 2 caratteri, ID ordine entro
  1) **e almeno un'altra informazione della riga lo conferma** - peso, data,
  classe, produttore, destinatario, trasportatore. Senza conferme la riga resta
  una difformita': meglio una difformita' da guardare che un abbinamento
  inventato. Si dice sempre da che cosa lo si e' riconosciuto.
- Anche una riga abbinata dal numero **esatto** si controlla in tutto: l'ID
  ordine e la data sbagliati si dicono comunque.
- **I nomi non fanno difformita'**: la stessa ditta si scrive in dieci modi, e un
  elenco di grafie seppellirebbe le differenze vere. Servono a riconoscere e a
  spiegare. La **classe** si segnala solo se cambia canale (9 = ACI), perche' e'
  quella che cambia il prezzo.
- `base44/shared/numeroFir.ts`: `normalizzaFir`, `FORMATO_FIR`, `distanzaFir` e
  `descriviDifferenzaFir`, che spiega l'errore in italiano dicendo sempre quali
  caratteri e in che posizione («"B" al posto di "P" in posizione 13»,
  «caratteri "PB" invertiti in posizione 12»), con la coda «, probabile scambio
  fra caratteri simili» quando i due caratteri si somigliano. Lo usano le verifiche settimanali (`verificaReport`) e i consuntivi
  (`confrontaConsuntivo`): una regola sola, in un posto solo.
- I chili tornano, quindi la quadratura delle quantita' resta buona, **ma il
  verdetto non e' verde**: il riquadro non puo' dirsi a posto mentre sotto c'e'
  scritto che due numeri sono sbagliati.

### Le dichiarazioni e il mese di competenza

Le dichiarazioni si fanno a consuntivo: i PFU raccolti a luglio, lavorati e usciti
dall'impianto ad agosto, si dichiarano a settembre. **Il rigo dell'extra raccolta
sta sul mese del formulario** (fine trasporto), non su quello in cui la
dichiarazione arriva: altrimenti la stessa raccolta compare due volte, un mese col
conferito senza dichiarazione e un altro con la dichiarazione senza conferito.
Quando e con quale dichiarazione e' stata fatta si scrive nella nota.

**Gli stoccaggi non dichiarano** (regola dell'utente, 21/09/2026). Non trattano:
ricevono i PFU e li rimandano in secondaria, e in quel viaggio sono il
produttore. La dichiarazione si chiede all'impianto che li riceve, solo dopo il
secondo viaggio, per rete, ACI ed extra raccolta. Nel modulo Dichiarazioni
Impianti le secondarie stanno quindi sulla riga dell'impianto di destinazione,
nel mese in cui arrivano e con scritto da quale stoccaggio; uno stoccaggio ha
solo entrate, partenze e piazzale (scheda Stoccaggi). Chi e' insieme impianto e
stoccaggio (Irigom, T-Cycle) si tiene diviso per `tipo_destinazione` del
movimento: quello che arriva al suo stoccaggio non e' suo da dichiarare.

**Un mese senza dichiarazione puo' essere a posto** (22/09/2026): si segna in
`DichiarazioneSito.motivo_assenza`, con quantita' a zero. `non_dovuta` quando il
trattamento di quel canale non e' a nostro carico (la rete di Tecnogum: vale
anche senza segnarla, con `dichiara_rete` falso in Giacenze); `solo_metalli`
quando dall'impianto sono usciti solo metalli ferrosi e nessuna gomma (Irigom,
rete di aprile 2026): a portale non si carica nulla e il ferro si dichiara con
la prossima uscita di gomma. Nessuno dei due e' un mancante.

### Decisioni della direzione del 20/09/2026 sulla fatturazione attiva

- Nel 2026 a Ecotyre si fattura a **202 euro la tonnellata** sulla **rete** e
  sull'**extra raccolta**; l'**ACI** ha le sue tariffe per regione. Nei report il
  prezzo si scrive a tonnellata (la prefattura del portale lo scrive al chilo,
  0,202: e' lo stesso prezzo). **Non e' una costante del gestionale**: per rete e
  ACI la tariffa deve stare in tabella `Tariffa`, e senza quella la riga va a zero
  euro in `errore` (`daTariffa` e `senzaTariffa` in `attivaCalcolo.ts`). I 202
  scritti nel codice (`TARIFFA_BASE_EXTRA_RACCOLTA` in `ecotyreTariffe.ts`) sono
  solo la base dell'extra raccolta 2026, e valgono solo per gli interventi senza
  prezzo proprio. Le tariffe seminate da `seedTariffeAttive2026` chiudono il
  **31/12/2026** - contratto annuale senza tacito rinnovo (06/10/2026) - tranne
  l'extra raccolta, che resta aperta perche' sono campagne occasionali.
- **L'ANNO NUOVO VA PREPARATO, E LE TARIFFE SONO LA VOCE CHE MORDE PER PRIMA**
  (10/10/2026, `base44/shared/inizializzazioneAnno.ts`, funzione `preparaAnno`,
  scheda Target & Status > **Nuovo anno**, prove in
  `prove/inizializzazioneAnno.mjs`). Il contratto e' annuale senza tacito
  rinnovo: il 31 dicembre scade tutto. Dal 1° gennaio una riga senza tariffa
  vale **zero euro** e nasce con `stato_validazione: 'errore'`, sulla attiva
  come sulla passiva: al primo formulario di gennaio la fatturazione e'
  inservibile. `copiaAnnoTarget` portava avanti impianti, target, collegamenti,
  contratto ed elenco siti; **le tariffe no, e nessuno lo diceva**.
  La scheda e' una lista di controllo di sette voci - tariffe attive, tariffe
  passive, contratto Ecotyre, target e siti, fotografia dei piazzali al 31/12,
  aperture degli impianti al 31/12 (dal 10/10/2026),
  contratti ai subfornitori - ognuna con il suo stato, il motivo per cui serve e
  dove si rimedia. **Si misura sui fatti**, non su una scadenza scritta nel
  codice: una tariffa «da rinnovare» e' una che copre il 31 dicembre e non copre
  il 1° gennaio dopo, e la regola resta vera anche fra tre anni.
  L'unica cosa che il gestionale fa da se' e' **preparare le tariffe**: stessa
  riga, validita' sull'anno nuovo, **prezzo dell'anno prima** e la nota «copiato
  dal {anno-1}, da confermare» (`conNotaCopia`, la stessa convenzione di
  `copiaAnnoTarget`). Due prudenze che non si tolgono: non sovrascrive niente e
  si puo' ripetere (chi ha gia' il suo seguito esce dall'elenco), e finche'
  nessuno conferma **la voce resta gialla** - un prezzo vecchio che passa per
  nuovo e' peggio di un prezzo che manca, perche' nessuno lo guarda piu'.
  La fotografia dei piazzali al 31/12 si legge a portale **quel giorno**: la
  pagina Unita' Locali mostra il saldo di adesso, non lo storico. Chi la chiede a
  gennaio legge un numero sbagliato e non se ne accorge - e' successo su sei
  piazzali del 2025, e quella lettura non torna piu'.

  **LE APERTURE DEGLI IMPIANTI (audit del 10/10/2026).** La lista aveva sei voci
  e nessuna guardava il punto da cui ogni IMPIANTO riparte: il peso non
  dichiarato del 31 dicembre, rete e ACI. Non lo scriveva nessuno - la chiusura
  chiedeva le due letture, le confrontava con la lettera di Ecotyre e le
  buttava; la copia d'anno crea le righe senza apertura, apposta; restava un
  campo a mano. Il 2 gennaio ogni impianto sarebbe ripartito da zero mentre il
  portale si porta dietro la giacenza vera: con i numeri del 10/10, circa 1.617 t
  di scarto su quattro impianti. Ora:
  - **la chiusura, salvando, scrive le aperture** dell'anno dopo dalle letture
    (`apertureDegliImpianti` in `shared/chiusuraAnno.ts`), con il giorno in
    `GiacenzaSito.apertura_del`: uno zero letto e uno zero mai scritto hanno lo
    stesso numero e conseguenze opposte, e la data li distingue. Si scrive solo
    quello che e' stato letto, e un'apertura gia' scritta non si cambia senza
    `sostituisci`;
  - **l'apertura si LEGGE al netto di quello che si dichiara dopo** (revisione
    del 10/10/2026, `aperturaNetta` in `shared/giacenzaPortale.ts`). La lettura
    del 31/12 contiene novembre e dicembre non ancora dichiarati; quelle
    dichiarazioni si caricano a gennaio ma sono dell'anno chiuso, e l'anno nuovo
    sottrae solo le sue. Senza questo, la giacenza restava gonfiata tutto l'anno
    (Dichiarazioni 8 t, portale 0) e l'ACI, che a portale non ha riscontro, in
    tutti e due i moduli. La lettura resta scritta com'e'; Giacenze e
    Dichiarazioni la usano al netto, e la scheda dell'impianto dice «letta X, di
    cui dichiarate dopo Y». Un'apertura senza `apertura_del` (scritta a mano)
    non e' una lettura e resta quella. Prova: `prove/aperturaNetta.mjs`;
  - **se la riga dell'anno dopo non c'e', la crea come la copia d'anno**, con la
    nota «copiato dal …, da confermare». Senza quella nota la copia d'anno la
    scambia per un elenco gia' compilato a mano e salta TUTTI gli altri siti: i
    piazzali resterebbero senza riga. La prova lo fa vedere (`prove/aperture2027.mjs`):
    chiusura e copia funzionano in tutti e due gli ordini;
  - **la lista ha la settima voce**, «Aperture degli impianti al 31/12».

  Due voci della lista, scritte lo stesso giorno, mentivano. **«Target e siti»**
  contava `ImpiantoTarget`, un archivio che non ha mai avuto una riga e che la
  copia non scrive: sarebbe rimasta rossa per sempre. Ora conta i target annui
  dei raccoglitori (`TargetRaccoglitore`), quelli che la copia scrive e la griglia
  mostra. **«Contratto Ecotyre»** dava per pronto un contratto solo copiato, mentre
  una tariffa nello stesso stato era gialla: ora e' «parziale» anche lui. E le
  tariffe copiate **si confermano con un pulsante** (`preparaAnno`, azione
  `conferma_tariffe`): prima la lista chiedeva di confermarle e l'unico modo era
  cancellare la nota a mano, tariffa per tariffa. Sulla tariffa resta scritto chi
  l'ha confermata e quando.
- I report per l'amministrazione sono **tre, separati**: rete, ACI, extra
  raccolta. Le loro colonne non si toccano senza l'assenso dell'amministrazione.
- La prefattura del portale copre **solo rete e ACI**. L'extra raccolta non e'
  gestita a portale: il suo report nasce da quello che si scrive a mano nel modulo
  Extra Raccolta (formulario, prezzo, eventuali sovracosti di raccolta e di
  lavorazione).
- Le **terziarie** che il portale paga in prefattura (ordini TER, 8 euro/t con
  allegato VII, 10 col formulario) restano **fuori** dalla fatturazione attiva:
  nel confronto stanno in una sezione a parte, pronta per quando servira', e non
  contano come differenza.
- Il mese di una prefattura si ricava dal file (date di fine trasporto): caricata
  sul mese sbagliato viene rifiutata.
- La fine della programmazione delle secondarie al **18 dicembre vale solo per il
  2026** (`base44/shared/fineProgrammazione.ts`): per gli altri anni va comunicata.

## I moduli e i loro conti

### La predittivita' delle secondarie: un anno, un motore (26/09/2026)

Rifondata dopo un'analisi che aveva trovato tre conti diversi per "quanti viaggi
servono" (Dashboard, Proiezione e suggerimento del lunedi' davano 97 e 54 viaggi
per lo stesso impianto). Ora c'e' **un motore solo**, `base44/shared/predittivita.ts`,
che legge da `predittivitaDati.ts` e risponde con `predittivitaRisposta.ts`; le
funzioni (`calcolaPianificazioneSecondaria`, `proiezioneSecondarie`,
`analisiSettimanalePredittiva`) e gli assistenti passano tutti di li'. Le regole
che l'utente ha dato, da non riderivare:

- **Un anno alla volta.** Parte dall'ancora delle giacenze al 31/12 dell'anno
  prima, guarda solo i movimenti dell'anno, sola rete, per fine trasporto. Al 31/12
  l'anno si chiude: il 1 gennaio il modulo mostra l'anno nuovo, con le logiche del
  nuovo contratto; gli anni chiusi si riaprono in sola lettura. Le regole che
  non sono input stanno in `base44/shared/regolePredittivita.ts` (un anno nuovo
  si aggiunge col contratto).
- **La configurazione si scrive in Target & Status** (utente, 27/09/2026: "mettiamo
  tutto in 'Target & Status' e gli altri moduli leggono da li'"), scheda Impianti
  e stoccaggi (`src/components/target-status/ConfigurazioneImpianti.jsx`), anno per
  anno col selettore dell'anno (`?anno=` nell'indirizzo). La vecchia scheda
  Configurazione della predittivita' e la pagina Target annuali non ci sono piu'
  (i loro indirizzi portano li'). E' per anno (`ImpiantoTargetSecondaria.anno`,
  `FornitoreSecondaria.anno`): l'anno di un record e' `annoDelRecord(r)`, cioe'
  il suo o il 2026 se non lo dice (`base44/shared/annoTarget.ts`, specchio in
  `src/lib/annoTarget.js`). Percio' questi due archivi **non** si leggono mai con
  `.filter({ anno })` (perderebbe i record senza anno): si leggono interi con
  `fetchAll` e si tengono per anno in memoria; ogni record nuovo porta `anno`.
- **Un anno nuovo nasce come copia del precedente**: pulsante "Copia dal
  {anno-1}" in Target & Status, funzione `copiaAnnoTarget` (`{ anno, simula }`,
  prima sempre con `simula: true` e la conferma dell'utente). Copia impianti e
  loro target, collegamenti degli stoccaggi (con la priorita' scritta per
  esteso), target dei raccoglitori annui e mensili, contratto Ecotyre (solo se
  l'anno non ne ha uno) ed elenco dei siti delle giacenze; tutto "copiato dal
  {anno-1}, da confermare". Salta quello che l'anno ha gia': si puo' ripetere e
  completa una copia interrotta. Il piano e' puro (`pianoCopiaAnno`, provato in
  `prove/annoTarget.mjs` e `prove/copiaAnnoTarget.mjs`).
- **Gli anni chiusi** (prima dell'anno in corso, ora italiana: `annoChiuso`) si
  leggono soltanto: la pagina non lascia scrivere e le funzioni che scrivono li
  rifiutano. Scrive solo l'amministratore (`soloAmministratore`).
- **Chi la predittivita' segue**: solo gli impianti con un target e
  `segue_predittivita !== false` (se manca vale vero). Green Tyre Project, T.R.S.
  e Gatim hanno solo il target, che le Giacenze leggono, e la predittivita' non li
  segue (interruttore "Segui nella predittivita'"); con loro non si seguono neanche
  i loro stoccaggi. Il discriminante e' solo `segue_predittivita === false`
  (`base44/shared/predittivitaDati.ts`), non l'operazione R3: 'R3' lo dichiarano
  anche Tecnogum sull'ACI e Irigom sull'extra raccolta.
- **Fine della programmazione e chili a viaggio** stanno sul contratto Ecotyre
  dell'anno (`CommessaEcotyre.fine_programmazione`, `kg_per_viaggio`, scritti in
  Impianti e stoccaggi). `fineProgrammazione(anno, commessa)` e
  `regolePredittivita(anno, commessa)` li usano quando ci sono (la data solo se e'
  dentro quell'anno); senza, vale quello di prima: per il 2026 il 18/12/2026 e 13 t.
  Un anno senza contratto e senza riga in `fineProgrammazione.ts` ripiega sul 31
  dicembre e lo dice all'utente con un avviso (`avvisoFineProgrammazione`, avviso
  `fine_non_definita`): meglio un avviso che una data inventata.
  La data propria di un impianto (`data_fine`) vince su quella dell'anno.
- **Tecnogum e Irigom (2026).** Tecnogum 2.295 t: primarie di Ecorecuperi (800 t),
  250 t da T-Cycle, il resto da Nappi Sud. Irigom 4.445 t: primarie di Smoco e
  Pneuservice (nel 2026 anche Emmesse, dopo l'incendio di Gatim di giugno), il
  resto da Nappi Sud. Nappi Sud non basta per tutti e due.
- **La priorita'** degli impianti di uno stoccaggio (`FornitoreSecondaria.priorita`,
  o le regole dell'anno; 2026: Nappi Sud prima Tecnogum, poi Irigom) **non** vuol
  dire servirne uno e poi l'altro: ogni settimana lo stoccaggio li serve tutti, al
  primo va il numero di viaggi che gli fa raggiungere il target entro la fine della
  programmazione (18/12/2026, o quella del contratto dell'anno), agli altri quello che avanza, fino alla loro parte
  e mai piu' della loro media settimanale arrotondata per eccesso (niente parte
  dell'anno concentrata in una settimana). Un impianto a fine programmazione non
  riceve piu' niente; il tetto e' il materiale del piazzale (giacenza + entrate al
  ritmo), al netto del plafond gia' usato.
- **Si programma sul target** (utente, 27/09/2026; la terza proiezione, il piu' basso
  dei due flusso per flusso, non c'e' piu'): la proiezione usa quello che resta
  del target di raccolta di ogni raccoglitore che porta agli impianti, e la
  divisione fra gli impianti si fa su quello che ci sara' davvero negli stoccaggi:
  le entrate di uno stoccaggio sono sempre quelle al ritmo reale, in tutti e due
  i conti (`entrate_se_rispettano_il_target_kg` e' solo un'informazione; con il
  target dei suoi raccoglitori Nappi Sud risultava avere 713 t invece di 441, e a
  Irigom si promettevano 24 viaggi) (`SCENARI = ['target', 'ritmo']`,
  `SCENARIO_PROGRAMMA = 'target'`). Accanto
  resta il **ritmo** reale delle ultime 12 settimane (anche a cavallo d'anno), per
  vedere se i raccoglitori ci stanno arrivando. Un flusso senza target (Emmesse
  su Irigom) vale il ritmo in tutte e due. I target si cambiano durante l'anno in
  Target & Status e tutto si rifa' dai numeri di adesso e da quello che e' gia'
  stato fatto.
- **Il gia' arrivato e il piazzale** (27/09/2026): dal piazzale di un impianto
  esce per prima la giacenza vecchia, quella al 31/12 dell'anno prima, poi in
  ordine cronologico quello arrivato dopo (FIFO): finche' esce la giacenza
  vecchia non si toglie niente dal gia' arrivato. Le partenze verso impianti
  **senza target** non si tolgono: non sono oggetto della predittivita' e stanno
  nel modulo Secondarie (consumano pero' il piazzale nell'ordine di arrivo).
  Quelle ACI, come Irigom verso Gatim, restano fuori comunque, perche' conta
  solo la rete.
- **13 t a viaggio** nel 2026, o `CommessaEcotyre.kg_per_viaggio` dell'anno (piu' formulari divisi per classe fanno lo stesso
  viaggio). Un viaggio **fatto** e' un camion in un giorno sullo stesso percorso
  (`chiaveViaggio`).
- **Il programma della settimana dopo** si fissa il **mercoledi' alle 8**, con un
  secondo giro alle 14 (`analisiSettimanalePredittiva`, `PianificazioneSettimanale`
  con `origine` 'programma'): il lunedi' si registrano i formulari della settimana
  prima, e l'utente guarda il martedi'/mercoledi'. La funzione e' solo per
  l'amministratore (il workflow gira come amministratore); scrive solo i percorsi
  non ancora fissati, quindi il giro delle 14 non cambia quello delle 8. Con un
  caricamento in corso rinvia (409), a meno che la settimana sia gia' fissata; se
  il programma gia' fissato non si legge, non scrive niente. L'amministratore lo
  corregge a mano (`origine` 'manuale', che il mercoledi' non tocca). Il
  programmato non si sovrascrive mai con il fatto: accanto si vede se si e' in
  anticipo o in ritardo. Le righe senza `origine` sono del piano di prima e non si
  leggono piu'.
- **La simulazione** (utente, 27/09/2026: "permettere a me una simulazione se
  io variassi quanto dice la predittivita'", per accontentare il piu' possibile
  tutti e due gli impianti): scheda Simulazione, conto in
  `base44/shared/simulazioneViaggi.ts` (specchio in `src/lib`). Chi programma
  prova i viaggi a settimana di ogni percorso fino alla fine della
  programmazione e vede, accanto alla proposta, se e quando ogni impianto
  arriva al target e quanto manca; se chiede a uno stoccaggio piu' del suo
  materiale, i viaggi possibili si dividono in proporzione e si dice. Non scrive
  niente: il programma resta quello della scheda Programma.
- **Niente email**: il modulo ha il pulsante "Esporta la situazione", la
  fotografia a ogni aggiornamento. La pagina dice sempre fin dove arrivano i dati
  caricati.
- **Si legge solo quello che serve**: la finestra dell'anno e del ritmo con
  `$gte` sulla fine trasporto, piu' i terminati senza fine trasporto; mai gli
  archivi interi, che conservano ormai gli anni passati.

### La fatturazione attiva verso Ecotyre

Le righe si calcolano in un punto solo, `base44/shared/attivaCalcolo.ts`:
l'anteprima (`getRiepilogoEcotyre`) e il documento (`elaboraFatturazioneAttiva`)
passano entrambi di li', cosi' non possono dire due ricavi per lo stesso mese.
Chi aggiunge una regola la aggiunge li', e aggiunge un caso a
`prove/attivaCalcolo.mjs` (`npm run prove`).

- **Rete e ACI** prendono il prezzo dalla tabella delle tariffe attive; la
  validita' si confronta sul giorno italiano, come nella passiva.
- **L'extra raccolta prende prezzo e sovracosti dall'intervento**
  (`prezzo_attivo_t` e i tre `sovracosto_*`), gli stessi che usa la pagina Extra
  Raccolta: pagina e fattura devono dire lo stesso ricavo. Ogni sovracosto e' una
  riga a corpo, senza chili. Le **secondarie di extra raccolta non si fatturano**:
  il ricavo sta sulla raccolta.
- **Una riga senza prezzo e' un errore**, non una riga verificata: il documento
  non si puo' verificare finche' la tariffa manca.
- **I tre canali non si sommano mai**, nemmeno nel riepilogo per tipo di servizio.

**La riconciliazione.** Il portale chiude gli ordini giorni dopo il trasporto: un
ritiro del 30 giugno chiuso il 4 luglio entra negli archivi dopo che giugno e'
stato elaborato. A ogni apertura del mese il documento salvato si confronta con i
dati di oggi (`riconciliaAttiva`, chiave ordine + formulario: gli id dei record
cambiano a ogni importazione) e le differenze si mostrano: arrivati dopo,
cambiati, non piu' nel mese.

**Gli stati.** elaborata, verificata, approvata, (esportata), chiusa. Ogni azione
parte solo dallo stato giusto; un periodo chiuso si riapre solo con «riapri», che
lascia scritto nelle note del documento chi, quando e da che stato. Una
rielaborazione scrive prima i documenti nuovi e ritira i vecchi solo alla fine;
cio' che era gia' approvato o esportato non si cancella, resta come superato col
motivo.

**La chiusura del mese attivo** non e' un passaggio interno: un mese si chiude
quando l'amministrazione conferma che la fattura al cliente e' stata emessa ed e'
andata a buon fine. Il giorno della conferma (e il numero di fattura, se c'e')
restano sul documento. L'esportazione fa avanzare lo stato solo da «approvata».

**La prefattura del portale Ecotyre** (`base44/shared/prefattura.ts`,
`confrontaPrefattura`; la function di piattaforma invocata dal browser e'
`prefatturaEcotyre`, scheda «Prefattura Ecotyre»). Si carica in Excel o in PDF e
si confronta ordine per ordine con le righe di `attivaCalcolo.ts`, PRIMA di
esportare: solo in prefattura (con la ragione: altro mese, cancellato,
sconosciuto), solo nel gestionale, peso diverso, stesso peso e importo diverso
(col prezzo per tonnellata ricavato). Il canale di un ordine non si chiede: e'
quello che ha nel gestionale. La prefattura non ha un tracciato garantito: le
colonne si riconoscono dai nomi e gli ordini dalla forma (`ET26084363`). Il PDF si
legge dal suo testo (vedi piu' sotto), non con un agente. Una prefattura nuova non
cancella la precedente: la segna superata.

### La prefattura del portale in PDF si legge dal suo testo

**La prefattura in PDF** non la legge un agente: con oltre quattrocento righe si
rifiuta di restituirle tutte (provato il 20/09/2026). Il browser ne estrae il testo
con pdf.js (`src/lib/pdfTesto.js`, caricata solo quando serve) e
`leggiLineePdfPrefattura` lo legge riga per riga. Il PDF porta in testa il
riepilogo stampato (ordini, chili, euro per classi 1-4 e classe 9) e il mese: se
le righe lette non sommano quel riepilogo il caricamento viene rifiutato. Sul PDF
vero di luglio 2026: 416 righe, identiche all'Excel una per una.

### Il margine

`base44/shared/margine.ts`, funzione `calcolaMargineAnno` (la chiama la function
di piattaforma `calcolaMargine`), scheda «Margine» della
fatturazione (solo admin). Ricavo attivo meno costo passivo, mese per mese e
canale per canale, con una sola lettura degli archivi. **Non ha regole sue**: usa
`attivaCalcolo.ts` e `passivaCalcolo.ts` (il calcolo della passiva, che la
funzione `calcolaPassiva` si limita a chiamare), quindi i numeri sono gli stessi
delle due fatturazioni al centesimo. Tre canali, tre margini, mai un totale. Il
costo di un mese comprende stoccaggio, trattamento e secondarie di quel mese, che
possono riguardare tonnellate raccolte prima: il numero che conta e' l'anno.

### La pratica mensile di Irigom

Le dichiarazioni di Irigom le prepariamo noi, nella scheda Irigom di
Dichiarazioni Impianti (`PraticaIrigom.jsx`). Il registro di carico e scarico lo
legge `src/lib/registroIrigom.js` (`leggiRegistroIrigom`): le lettere di colonna
dei fogli Dettaglio e Cons., i colori e le note stanno la', non in
praticaIrigom.js. Le regole stanno in
`src/lib/praticaIrigom.js` e sono provate sul caso vero di agosto 2026
(`prove/praticaIrigom.mjs`, dati in `prove/dati/`): toccarle vuol dire rifare
quella prova.

- **Ferro**: formulari del foglio Dettaglio, colonna AH. Destinatario MMF mai;
  cella arancione FFC000 per intero; altrimenti conta la **nota** di Excel
  ("ECT: 6,62" in tonnellate, anche "27,5 ECP 1,06 ECT"), non il colore, che
  cambia nell'anno. La somma deve fare la colonna X del foglio Cons.
- **Allegati VII** (J numero, AL peso): si cerca la **combinazione con la somma
  piu' vicina al ciabattato uscito** (V), mai sotto se si puo', prima fra i soli
  **SMOCO**; se non bastano si aggiungono i **TRANSAR** e per ultimi gli altri
  trasportatori (regola dell'utente del 22/09/2026, `scegliAllegati` in
  `src/lib/praticaIrigom.js`: la cascata dei tre bacini e' sua, e per ciascuno
  chiama `combinazioneVicina`, che prova tutte le somme possibili e poi toglie
  gli allegati di coda che non servono, cosi' restano quelli di testa). Tante
  terziarie quanti allegati; le TER in ordine crescente vanno agli allegati in
  ordine di scelta. Agosto 2026 e' stato dichiarato con la regola di prima - i
  primi dell'ordine finche' bastano - che resta come `criterio: 'ordine'` per
  rifare una pratica gia' consegnata.
- **Le celle gialle** del peso degli allegati VII nel foglio Dettaglio (6 ad
  agosto 2026, fra cui il n. 30 che abbiamo dichiarato) non contano nei nostri
  ragionamenti (utente, 25/09/2026): non sono un marcatore di 'non nostro', non
  cambiano la scelta degli allegati e non vanno segnalate.
- **Ripartizione**: ciabattato a peso pieno dell'allegato, l'ultima terziaria il
  resto; ferro uguale per tutte alle decine, l'ultima il resto; mai oltre 38.000
  kg per dichiarazione, sul peso con cui la dichiarazione si chiude a portale.
- **Quanto** (22/09/2026, terza lettura aggiunta il 03/10/2026): **tre** letture
  del **totale da caricare a portale**, sempre mostrate insieme
  (`src/lib/praticaIrigom.js`). **Uscite**: V + X + Y del foglio Cons., tutto
  cio' che e' uscito nel mese, extra raccolta compresa. **Registro**: le uscite
  del mese **piu' il ferro che i mesi senza nave hanno lasciato indietro** e che a
  portale non e' ancora stato dichiarato (regola dell'utente del 03/10/2026,
  `ferroArretrato`, parametro `arretrato` di `componiMese`, prove in
  `prove/ferroArretratoIrigom.mjs`). **Giacenza**: dopo la dichiarazione del mese M a portale deve
  restare **AD + AE della riga di M nel foglio Cons.** (gomma in impianto:
  cippato, SACI e interi; piu' ferro in giacenza) meno l'extra ancora in
  impianto. Totale a portale = giacenza di rete a portale a fine mese (per fine
  trasporto) - quello che deve restare. Il CSS-C in giacenza (Z) non resta: e'
  end of waste. Il ferro e' la parte che si aggiusta: totale a portale - V - Y.
  Registro e giacenza sono due strade indipendenti per lo stesso numero, e **lo
  scarto che la pagina mostra e' giacenza contro REGISTRO**, non contro le uscite:
  il confronto con le sole uscite resta accanto (`scartoUscite`) ed e' un'altra
  cosa. Se le due strade non danno lo stesso totale c'e' qualcosa da capire prima
  di caricare.
- **L'extra raccolta partita con la nave sta dentro l'ultima terziaria**
  (utente, 22/09/2026): a portale quella terziaria si chiude col peso intero,
  rete + extra (agosto 2026: 19.880 + 460 = 20.340, totale a portale 534.600).
  Il rigo dell'extra resta, con la stessa terziaria, e dice che quella parte e'
  extra raccolta. Nel riepilogo Excel e nel file di gestione rete ed extra
  restano **separati** (IRIGOM 534.140, EXTRA RACCOLTA 460): l'utente chiude la
  terziaria a mano, e dal report del portale il gestionale vede solo il totale.
  La DichiarazioneSito RETE del mese vale il **totale a portale** (534.600): e'
  quello che il portale decurta e che `agganciaDichiarazioni` riconosce con 2 kg
  di tolleranza; nella nota c'e' `[extra compresa: N kg]`. L'extra ha la sua
  DichiarazioneSito sul mese del formulario.
- **Il portale puo' avere una dichiarazione che il gestionale non ha**
  (01/10/2026). L'aggancio parte dalle NOSTRE righe mensili e cerca il peso nel
  report del portale: se la nostra riga non c'e' - l'utente ha dichiarato a
  portale senza prima scriverla qui - non c'e' niente da agganciare, e quel
  caricamento finiva fra l'«arretrato dell'anno prima», che era falso, e la
  pagina non mostrava l'arretrato affatto. E' costato un «questo lo trovo molto
  strano» sul quantitativo di agosto di Green Tyre Project. Adesso
  `caricamentiPortale` tiene **di che mese sono gli ordini che il caricamento
  chiude** (fine trasporto), `confrontaConIlPortale` separa le **dichiarazioni da
  inserire** (ordini dell'anno verificato) dall'arretrato vero (anni
  precedenti), e `riepilogoDichiarazioni` le calcola a ogni apertura della
  pagina, dove stanno in testa in rosso. Il mese e' un'inferenza, quindi si
  **propone**: i valori li scrive l'utente.
- **Quanto resta da dichiarare di un mese sono gli INGRESSI del mese in quell'
  impianto** (regola dell'utente, 01/10/2026), meno **quello che di quei carichi
  e' uscito**: `da_dichiarare_kg` nei flussi di `riepilogoDichiarazioni`. Prima lo
  diceva solo la fotografia del portale (`non_dichiarato_kg`), che e' di un giorno
  preciso e puo' essere vecchia di settimane: un mese appena conferito usciva a
  zero e la riga dell'impianto **spariva** dal riepilogo. La fotografia resta un
  riscontro.
- **Una dichiarazione non appartiene al suo mese: svuota i mesi di prima**
  (regola dell'utente, 09/10/2026, `base44/shared/usciteDichiarate.ts`, prove in
  `prove/usciteDichiarate.mjs`). Il portale aggancia le quantita' agli **ordini
  piu' vecchi ancora aperti**, quindi la dichiarazione di marzo porta via gennaio,
  febbraio e parte di marzo. Il dichiarato **di quel mese** quindi non e' quello
  che di quel mese e' uscito, e sottraendolo li' le caselle contraddicevano la
  colonna del totale: su T-Cycle 532,68 t contro 352,94. Parole sue: «tenerlo in
  giallo potrebbe confondere... marcando in verde i quantitativi effettivamente
  usciti e lasciando in basso la parte restante in giacenza oltre agli ingressi
  del mese e colorare diversamente le celle in cui avviene il caricamento a
  portale».
  **Non si deduce, si legge**: il report delle dichiarazioni di trattamento ha una
  riga per ORDINE (`peso_associato_kg`, `data_dichiarazione`) e dice quanto di ogni
  mese di arrivo e' uscito e con quale caricamento. Due accortezze: solo le righe
  con partner operativo SMOCO, e il mese di un carico passato da uno stoccaggio e'
  quello in cui la **secondaria** e' arrivata all'impianto (senza, su Irigom tre
  mesi uscivano negativi e il totale diceva 652,28 t invece di 637,44). Il conto si
  chiude sulla **giacenza del canale**, che e' il numero certo: quello che il report
  non ha ancora - una dichiarazione caricata dopo l'ultimo export - si ripartisce
  dai mesi piu' vecchi e la casella lo segna come stimato (`~`). Dove invece il
  portale ha agganciato piu' delle nostre dichiarazioni non si aggiusta niente: si
  scrive (`uscito_oltre_kg`). **Il canale e' solo la rete**: per ACI ed extra
  raccolta il portale non pubblica nessun aggancio.
  Nel riepilogo ogni riga ha tre linee - uscito (verde pieno se tutto, chiaro se in
  parte; **indaco** il mese in cui si e' caricato a portale), conferito nel mese,
  resta in giacenza - e la somma della terza E' la colonna «Da dichiarare»: 352,94
  su T-Cycle, 637,44 su Irigom, 321,70 su Green Tyre, 251,72 su Gatim, gli stessi
  numeri del portale mese per mese.
- **L'elenco degli ordini da dichiarare dice di quali mesi e'** (regola
  dell'utente, 09/10/2026, `per_mese` in `getOrdiniDaDichiarare`, prove in
  `prove/ordiniPerMese.mjs`). Il conto era giusto - su T-Cycle 114 ordini per
  352.940 kg, esattamente la giacenza - ma l'elenco parte dal carico piu' vecchio
  e mostra cento righe per pagina: la prima pagina finiva a settembre (318.460 kg)
  e sotto c'era il totale di tutte (352.940). «Non compaiono poi in elenco gli
  ingressi di ottobre e mi chiedo: come fai a trovarti con la giacenza attuale?».
  I mesi si contano su **tutto l'elenco filtrato**, non sulla pagina, stanno sopra
  la tabella e fanno da riscontro alla giacenza; il totale sotto le righe dice di
  essere dell'elenco, e dove la pagina non basta si scrive anche il suo.
- **Ogni mese** (procedura dell'utente, 22/09/2026). L'utente aggiorna il
  registro di Irigom e lo dice; **l'agente lo legge e riferisce**: quanti e quali
  formulari di ferro valgono (colore della cella e nota, con il motivo di ognuno),
  quanti e quali DDT di CSS-C, quali allegati VII della nave coprono il mese e
  **quante terziarie aprire a portale**. Per leggere il registro da fuori dal
  browser c'e' `C:\Users\HOME\Desktop\BASE44\strumenti\irigom\leggi_registro.mjs`
  (stesse regole del gestionale). Ricevuti i numeri TER e i PDF, si fanno Word ed
  Excel, si scrive il blocco del mese nel foglio DICHIARAZIONI del file di
  gestione e gli allegati scelti prendono il numero della terziaria nel nome e
  **scritto in alto a destra sulla prima pagina** (`src/lib/timbraPdf.js`); la
  cartella del mese scaricata li porta gia' cosi' in `EXPORT/TERZIARIE`. Il
  blocco del mese si scarica dal gestionale, pronto da incollare nel foglio
  DICHIARAZIONI (`src/lib/bloccoGestione.js`, pulsante e file nella cartella del
  mese): serve da qualunque computer, perche' il file di gestione sta solo su
  quello di casa. Quando quel computer e' acceso lo stesso blocco lo scrive, con
  Excel e coi formati dei mesi gia' presenti,
  `C:\Users\HOME\Desktop\BASE44\strumenti\irigom\scrivi_blocco_mese.ps1` dal file
  `Dati per il file di gestione.json` della cartella (`datiFileGestione` in
  `src/lib/documentiIrigom.js`); istruzioni in `LEGGIMI.md` accanto.
- I Word nascono dai modelli in `ModelloDocumento` (docx con segnaposto; le
  tabelle con `tabellaWord`, lo stile di agosto). Il registro e i PDF si leggono
  nel browser e non si conservano: resta la `PraticaIrigom` con i numeri.
- `unisciRun` (interna a `src/lib/docxModello.js`, la chiama `leggiModello`)
  fonde solo i run con lo stesso stile: fonderli tutti faceva perdere grassetti
  e caratteri ai documenti generati. Dove un paragrafo resta con un segnaposto
  spezzato, e solo li', `unisciRunTutti` li fonde tutti.

### La Quadratura FIR: il flusso non si indovina dal titolo (30/09/2026)

Segnalazione dell'utente sulla settimana 39: *"mi hai restituito l'ok per le
primarie ma non per le secondarie ne' rete ne' aci, inoltre mi parli di extra
raccolta che non esiste... tutto e' caricato correttamente nel gestionale e se
faccio i calcoli sul mio vecchio file excel tutto corrisponde"*. Aveva ragione su
tutta la linea: i numeri erano giusti in ogni passaggio.

**SONO QUATTRO FLUSSI, NON SEI.** Regola sua, testuale: *"le verifiche sono solo
di questo tipo che ti elenco, sempre in riferimento alla specifica settimana,
solo negli stati terminati: a) primarie rete b) primarie aci c) secondarie rete
d) secondarie aci"*. `FLUSSI` e `ORDINE_FLUSSI` in `quadraturaFir.ts` sono quei
quattro. L'extra raccolta non si quadra con WINSINFO: e' **solo rete, mai ACI**,
e c'e' solo se in quella settimana il modulo Extra Raccolta ha movimenti
terminati. Si legge come flusso `informativo` in `FLUSSI_DATI`, non entra in
nessun confronto a tre fonti, non tocca la conformita' e si dice in una riga
(`osservazioneExtraRaccolta`) **solo quando c'e' davvero**.

**LE INTESTAZIONI LE RICEVE, NON LE SCRIVE.** Parole sue: *"non le faccio io, a
me tocca riceverle e controllarle"*. Quindi il flusso **non si deduce dal testo**:
si propone e si fa confermare. Nella pagina ogni tabella letta ha due menu, fonte
e flusso, sempre visibili e gia' compilati (scelta sua), e un pulsante che rifa'
il confronto. `normalizzaLettura` accetta un `flusso` esplicito che vince su
tutto; sotto viene quello che l'agente ha **letto** (`canale` + `tipo`, due
domande semplici invece di un indovinello sul titolo), e solo per ultimo
`flussoDaTitolo`. Il flusso scelto si conserva in `righe_json`, cosi' rifare il
confronto non torna a indovinare.

**I due difetti che hanno rotto la settimana 39:**

1. **La secondarieta' si decide PRIMA del canale.** Il canale veniva letto per
   primo e `"WINSINFO ECT SEC-ACI"` - le secondarie ACI - finiva fra le
   **primarie ACI**, dove si scontrava con le primarie ACI vere.
2. **Il vocabolario cercava `SECOND`.** La stampa scrive `SEC`: `"WIN SEC"` e
   `"PORTALE ECT SEC"` non erano niente, e le secondarie di rete restavano fuori
   dal confronto. Ora `\bSEC\b` e `\bSEC[-\s]` valgono secondarie, e
   `fuoriPerimetro` esce per primo perche' "EXTRA RACCOLTA" contiene RACCOLTA e
   finirebbe fra le primarie di rete.

**NIENTE SPARISCE IN SILENZIO.** `confronta` prendeva le tabelle con un `find`:
due tabelle sullo stesso flusso e sulla stessa fonte e la seconda spariva senza
una riga. Ora si contano, si marcano `doppia`, il flusso **non si confronta** e lo
si dice: sommarle o tenerne una a caso darebbe un numero sbagliato senza dirlo.
Le tabelle **senza** flusso portano i loro numeri nelle osservazioni ("«WIN
SINFO»: 85 formulari per 263.780 kg letti e quadranti, ma non ancora
attribuiti"), invece di
sparire mentre il flusso corrispondente dichiarava "Manca nel file": erano due
affermazioni opposte sugli stessi formulari.

**TRE ESITI, TRE FRASI.** `lettura.verificata` era un flag solo e la pagina
scriveva sempre *"la somma delle righe lette non torna con i totali stampati"*,
anche quando le somme tornavano al chilo e il motivo era un titolo non
riconosciuto: si accusava una trascrizione esatta. Ora viaggiano separati
`totali_quadrano`, `fonti_riconosciute`, `flussi_riconosciuti`, e
`motivoLetturaNonConfermata` sceglie la frase giusta.

**UN FLUSSO CHE LA STAMPA NON COPRE NON E' "DA SISTEMARE".** Le sue celle
finivano fra gli `incongruenti` e il canale diceva "N righe da sistemare" per un
confronto che non era mai stato fatto. Ora il flusso porta `fuori_stampa` e le sue
righe si contano a parte.

**IL LETTORE EXCEL** sta in `src/lib/pivotQuadratura.js`, senza dipendenze dal
browser perche' le prove lo possano chiamare. Due cose che non fa piu': prendere
ogni pivot che trova (sul file vero dell'utente ne leggeva **undici** su sei
fogli - giacenze, terziarie, richieste da evadere - e una pivot di chili per
classe usciva come "12920 formulari"; ora una pivot della quadratura deve avere
due misure, un **conteggio** e un **peso**), e rubare il titolo alla pivot del
vicino (le pivot settimanali non hanno titolo, hanno "Nr. Settimana | 39": il
lettore pescava `RACCOLTA` da un'altra colonna e lo stesso titolo finiva sulle
primarie **e** sulle secondarie, che poi si scontravano). Sul file vero: da 11
tabelle a 2, quelle giuste.

**LA SETTIMANA LA SCEGLIE L'UTENTE.** *"Anche se il numero della settimana non
c'e' nel foglio poco importa, saro' io a caricartelo nella settimana giusta"*:
se sul file non c'e', non si dice niente. Resta il controllo che conta, cioe' il
file che dichiara una settimana **diversa** da quella aperta.

Prove in `prove/quadraturaFirFlussi.mjs`.

#### La parola "gestionale" sulla stampa non siamo noi

Precisato dall'utente il 30/09/2026: quando una pivot della stampa e' intitolata
**"GESTIONALE ECT ACI"**, quel "gestionale" e' il **file Excel** di chi manda il
foglio (`Gestione Ecotyre 2026`), lo strumento su cui loro confrontano il portale
con quello che estraggono da WINSINFO. Non e' questo gestionale.

Quindi `"GESTIONALE ECT ACI"` e `"PORTALE ECT SEC"` sono **la stessa fonte**: il
portale Ecotyre. Le fonti restano tre - WINSINFO, il portale, noi - e la terza
non compare mai fra le intestazioni della stampa, perche' la calcoliamo qui.

Scrivendo testi che l'utente legge, non chiamare mai "il gestionale" una fonte
esterna: si dice "il portale", "WINSINFO", oppure "il file Excel di chi manda la
stampa".

### La dashboard e l'elenco unico delle cose da gestire

`base44/shared/cruscotto.ts`, funzione `cruscottoOperativo`, componente
`src/components/dashboard/Cruscotto.jsx`. Un solo elenco, ordinato per gravita',
di cio' che richiede attenzione, ogni voce col collegamento a dove si risolve.
Legge **solo archivi piccoli** (alert, registro dei caricamenti, ordini aperti,
documenti di fatturazione, prefatture, riepilogo della qualifica,
richieste del consorzio, controlli delle sedi operative dei PDR
`VerificaSedePdr`): chi aggiunge un controllo non deve farle rileggere le
primarie. Le anomalie di prezzo delle fatturazioni arrivano dal margine, che la
pagina chiede dopo e solo per l'amministratore. Un controllo nuovo si aggiunge
li', con un caso in `prove/cruscotto.mjs`.

### Le attivita' della to-do list che si chiudono da sole (28/09/2026)

`base44/shared/todoOrdini.ts` (specchio `src/lib/todoOrdini.js`), la function
`controllaTodoOrdini`, TERZO dei cinque ricalcoli dopo le primarie
(`RICALCOLI` in `src/lib/importGrandeFile.js`: `evasioneAssegnati`, `ritiriEct`,
`todoOrdini`, `verifiche`, `qualifica`, eseguiti in quest'ordine).

Sull'attivita' si scrive l'ID dell'ordine da completare. Parole dell'utente:
«verifica quando essi passano dallo stato assegnato a quello di terminato e **solo
allora** indicarli come completati».

- **Il passaggio si deve VEDERE, non basta lo stato di adesso.** Il primo controllo
  di un'attivita' scrive che cosa sta guardando (`ordini_attesi`) e quali di quegli
  ordini sono ancora aperti (`ordini_da_attendere`), e **non chiude niente**. Si
  chiude quando quegli ordini risultano terminati. Se l'ordine era **gia' terminato**
  quando l'attivita' e' comparsa, nessun passaggio e' avvenuto: non si chiude mai da
  sola, e `notaOrdini` lo dice in testo neutro. Serve perche' `riferimento_ordine`
  esisteva da prima col significato di "ordine correlato": senza il passaggio, al
  primo giro si sarebbero chiuse in blocco decine di attivita' vecchie - uscendo
  dalla vista, che parte dalle aperte - con accanto un motivo vero in se' e falso
  come spiegazione.
- Il passaggio si **consuma** anche quando non porta a una chiusura (attivita' gia'
  spuntata a mano): cosi' una riapertura a mano resta aperta. E chi e' stato chiuso
  dal gestionale una volta non si richiude (`chiusa_dal_gestionale`): a decidere e'
  chi lavora.
- Un ordine **cancellato** non chiude niente e si segnala col motivo; un
  **"eseguito"** si segnala sempre; un terminato **senza fine trasporto** non conta
  (regola 1); una fine trasporto **nel futuro** non chiude niente.
- Un ID che non si trova si dice con tutte le sue cause possibili (scritto male,
  ordine non ancora caricato, codice che non e' un ordine): mandare a ricaricare un
  file che c'e' gia' e' una bugia comoda. E se la domanda per numero d'ordine non
  torna **niente** mentre gli ID ci sono, la function **rinvia** invece di scrivere
  "non si trova" su ogni attivita'.
- Il campo `riferimento_ordine` si riscrive solo se l'utente lo ha davvero
  modificato: confrontare col testo normalizzato faceva diventare "da chiedere a
  Ecotyre" in "DA, CHIEDERE, A, ECOTYRE" appena si apriva e si chiudeva la casella,
  e di quel campo non c'e' storico.

### EcoTyna: le domande sui dati non sono domande di norma (29/09/2026)

L'utente si era lamentato: *"ogni volta che chiedo qualcosa ad Ecotyna riguardo la
commessa non mi risponde in maniera puntuale ... ma e' generica e mi invia link
presi online"*. Le cause erano quattro, tutte nel modo in cui l'assistente era
istruita, e sono state misurate sul codice:

1. **La ricerca online non si decide a parole chiave.** `PAROLE_NORMA`
   (`base44/shared/assistente.ts`) contiene il vocabolario del mestiere
   (*formulari, classe, trasporto, registro, serve, posso*) e frammenti che si
   incastrano dentro altre parole (*cer* in "cerca", *adr* in "quadratura"), e la
   regola `norma: norma || !dati` accendeva la ricerca ogni volta che non
   riconosceva una parola-dati. Adesso decide il pianificatore con
   **`serve_normativa`** (`base44/shared/pianoAssistente.ts`): se ha preso i
   numeri dagli strumenti e dice che la norma non c'entra, non si cerca online e
   non si caricano le schede del corso RT. Il campo **non e' obbligatorio e la
   mancanza vale "serve"**: si sbaglia dal lato delle fonti, perche' una risposta
   normativa senza fonti e' un danno e un link di troppo su un numero e' un
   fastidio.
2. **Lo schema senza fonti.** Su una domanda sui dati si usa
   `SCHEMA_RISPOSTA_DATI`, che non ha i campi `fonti` e `novita_normative`: un
   campo che c'e' il modello lo riempie, e riempirlo lo porta nel registro del
   consulente che cita invece che del responsabile tecnico che risponde. E' l'unico
   modo di spegnere i link alla radice.
3. **Il prompt a due voci.** Con `soloDati` escono `REGOLE_FONTI`, la regola del
   controllo online, quella su Normattiva e quella sul corso RT, ed entrano sei
   righe (l'inquadramento e le cinque regole da D a D-quinquies) su come si
   risponde a un numero: il numero
   nella prima riga con la sua etichetta (soggetto, canale, periodo), niente
   premesse, niente consigli non chiesti. **Le regole che tengono onesti i numeri
   restano tutte**: i canali che non si sommano, il periodo attaccato
   all'etichetta, gli elenchi che non si contano a occhio, le date obbligatorie.
4. **Il nome del fornitore.** `risolviNome`
   (`base44/shared/normalizzaRagioneSociale.ts`) riconosce il nome scritto come
   capita: uguale, abbreviazione, contenimento, e il confronto senza spazi perche'
   togliendo i punti "ECO.GEA" diventa "ecogea". Prima il filtro dentro
   `movimenti()` pretendeva il nome identico e "Silvano" contro "SILVANO RENATO"
   dava **zero righe, che uscivano come "ha raccolto 0,00 t"**. Se i nomi che
   corrispondono sono piu' d'uno **non si sceglie**: si dichiara l'ambiguita' e si
   chiede il nome per esteso, perche' in archivio ci sono davvero SILVANO RENATO e
   SILVANO TRASPORTI SRL, e sommarli darebbe un numero che sembra giusto.

**Due regole da non perdere:**

- **Zero non e' "non lo so".** Quando uno strumento non risolve un soggetto,
  `tonnellate` e `formulari` sono `null`, arriva `avviso_soggetto` e il prompt
  vieta di scrivere un numero per quel soggetto. Lo stesso vale per il riepilogo:
  `provaA` registra le letture non riuscite in `guasti`, che finiscono **in cima**
  al testo, e dove il dato manca si scrive `n/d`, non `0,00 t`.
- **Un intervallo di mesi si apre tutto.** `mesiChiesti`
  (`base44/shared/strumentiAssistente.ts`) legge elenchi e intervalli: "da marzo a
  maggio" sono tre mesi, non due. Un intervallo a cavallo del capodanno non si
  indovina - invertirlo darebbe undici mesi al posto di tre - e si dice che non si
  e' capito. Prima "nei mesi di luglio e agosto" diventava in silenzio tutto
  l'anno.
- **La riserva degli "eseguito" si dice sempre.** `movimenti()` legge i terminati
  e, con una lettura sua, gli ordini in stato "eseguito" dello stesso canale,
  luogo e periodo: `riservaEseguiti` li restituisce in `riserva_eseguiti` e la
  regola **D-quinquies** del prompt obbliga a dirli in una riga dopo il numero.
  **Non si sommano al totale** (il raccolto sono i terminati) **e non si
  tacciono**: un ordine nel limbo e' materiale davvero ritirato, e il 24/09/2026
  ne bastava uno per far dire 8.164,18 t dove il file diceva 8.167,80. Se quella
  seconda lettura non riesce, il totale si dice comunque e la riserva si dichiara
  `lettura_non_riuscita`: e' il totale che non deve mai mentire. I nomi dei
  raccoglitori si riconoscono sui terminati **e** sugli "eseguito", altrimenti a
  chi ha solo ordini nel limbo si risponderebbe "non risulta fra i raccoglitori".
  Vale anche per `target_raccoglitori`, dove la riserva fa sembrare un
  raccoglitore piu' indietro di quanto sia. Prove in `prove/riservaEseguiti.mjs`.
- **La fatturazione si calcola, non si legge** (audit del 10/10/2026). Lo
  strumento `fatturazione` fa lo stesso conto del modulo sui movimenti di oggi,
  attiva e passiva, col mese o senza: senza mese, mese per mese fino a quello in
  corso, con gli archivi letti una volta (`passivaSuiDatiDiOggi`). Le voci dei
  documenti salvati della passiva non esistono - il modulo calcola e non salva -
  e leggendo quelle, a «quanto abbiamo pagato a Green Tyre quest'anno», EcoTyna
  rispondeva «nessun importo». Il numero dell'anno e' lo stesso dei mesi del
  modulo sommati e del costo del margine: `prove/passivaDiEcotyna.mjs`.
  Accetta anche **piu' mesi** (`mesi`, letti con `mesiChiesti` come nel
  raccolto), e il pianificatore legge **«da gennaio a oggi»** come l'anno fino a
  oggi: nominava un mese, e la regola che toglie il mese alle domande sull'anno
  non scattava. Visto in produzione il 10/10/2026, subito dopo la correzione:
  ottobre al posto dell'anno, e «il cumulativo non e' disponibile».

## I caricamenti, lo storico e il registro

### Lo storico: si carica solo cio' che serve all'operativita' (25/09/2026)

Il portale si ancora al 31/12 di ogni anno: quando un anno e' dichiarato e le
sue giacenze svuotate, ricaricarne i movimenti non serve piu'. L'utente carica
quindi i file di primarie, secondarie e terziarie dal 1 gennaio dell'anno
scorso (nel 2026 dal 2025, nel 2027 dal 2026), ma gli anni prima devono restare
nella memoria storica del gestionale. Due regole, entrambe sulla **fine del
trasporto** (l'immissione conta solo per gli assegnati, la chiusura mai):

- **Il caricamento conserva lo storico** (`base44/shared/storicoConservato.ts`).
  Il portale filtra l'export per data di **immissione**, che per l'utente conta
  solo per gli ordini aperti: per i terminati comanda la fine del trasporto.
  Quindi un **terminato** assente dal file resta in archivio com'e', qualunque
  sia la sua fine, e conta nel suo anno: non e' un "ordine mancante". Nei file
  del 25/09/2026 (dal 1/1/2025) mancavano 3.254 terminati finiti nel 2024 e 909
  finiti nel 2025-2026 ma immessi nel 2024, fino a febbraio 2024: restano tutti.
  Un terminato fuori dal file resta com'era all'ultimo caricamento che lo
  conteneva, e va bene cosi': a portale si puo' correggere al massimo un ordine
  del mese precedente, e l'export parte dal 1 gennaio dell'anno scorso, quindi
  nessun ordine ancora correggibile puo' restare fuori (utente, 25/09/2026). Un **assegnato** assente dal file e' un vero mancante e si
  segnala. I **cancellati** immessi prima dell'anno scorso, assenti dal file,
  non servono piu' (utente, 25/09/2026) e si lasciano andare
  (`cancellatiDaLasciare`); non avendo fine trasporto, per loro vale
  l'immissione. Quelli piu' recenti restano nel controllo, perche' servono come
  statistica: un cancellato resta cancellato e inevaso, e puo' tornare
  assegnato con lo stesso ID ordine solo se viene riaperto perche' e' stato
  cancellato per errore. Si cancella per ID a blocchi, dopo una prova in sola
  lettura del filtro; senza niente da conservare resta il `deleteMany({})` di
  sempre. Esportare sempre dal 1/1 dell'anno scorso tiene piccoli i file.
  Dal 28/09/2026 si conserva come un terminato anche un ordine in stato
  **"eseguito"** assente dal file, e si segnala: e' una regola dell'utente,
  spiegata nella sezione sul caricamento delle primarie. Vale per tutti gli
  archivi che conservano lo storico, secondarie e terziarie comprese, perche'
  `ordiniDaConservare` e' una sola. E lo
  svuotamento selettivo smette prima dei dodici secondi dell'invocazione dicendo
  dove e' arrivato, cosi' il caricamento lo riprende; quando il filtro per ID non
  regge, all'azione `svuota` delle primarie risponde con un motivo invece di
  lanciare, cosi' la frase "serve un caricamento completo, dal primo anno" arriva
  intera a chi carica. Per secondarie e terziarie (`importEcotyreFile`) resta il
  comportamento di prima: si ferma con un errore, che e' cio' che quel percorso
  deve fare per non scrivere il file sopra un archivio non svuotato.
- **Le date obbligatorie si controllano dall'anno scorso** (`dateDaControllare`
  e `primoAnnoControllato` in `base44/shared/movimenti.ts`): un terminato con la
  fine trasporto prima non si segnala piu', ovunque. Senza fine trasporto non ha
  anno, e si segnala sempre.

### Il caricamento delle primarie: che cosa si crede e che cosa si ripara (28/09/2026)

`src/lib/importGrandeFile.js` (il browser) con `base44/functions/importaBlocco/entry.ts`
(il server). Le prove: `prove/caricamentoPrimarie.mjs`, che impacchetta la
function vera e il modulo del browser con un SDK finto e i guasti in mezzo.

- **Il verdetto si regge su cio' che la piattaforma ha CONFERMATO di aver
  scritto, non su cio' che una lettura racconta.** Leggere di piu' non si vince
  mai: una piattaforma indietro di qualche secondo da' due, tre, sei letture
  uguali e tutte sbagliate, e "le righe non ci sono" e "la lettura e' indietro"
  sono lo stesso numero. Una lettura serve a due cose sole: accorgersi che
  qualcosa non torna e raccontare che cosa. Non decide.
- **Si parte dalla BASE NOTA, non da zero.** L'archivio si porta allo storico
  conservato - un numero e un elenco di ordini che la preparazione ha gia'
  calcolato (`storicoConservato.ts`) - e si verifica che sia esattamente
  quello; poi ogni blocco del file si scrive **al massimo una volta** e non si
  riscrive mai. Quindi l'archivio non puo' avere piu' righe di **base + file**,
  ne' in totale ne' per singolo ordine: dopo lo svuotamento in archivio ci sono
  solo righe di ordini conservati, le scritture aggiungono solo righe del file, e
  i due insiemi sono disgiunti per costruzione, perche' un ordine si conserva
  soltanto se il file non lo contiene. Senza niente da conservare la base e'
  zero e tutto torna alla frase di prima: "si svuota e si verifica a zero".
- **Il confronto e' ordine per ordine, col dettaglio.** Il solo totale non basta:
  un blocco entrato due volte (+200 righe) e uno mai arrivato (-200) si
  compensano. Non si pretende un id_ordine per riga: lo stesso ordine sta in
  archivio con piu' righe, una per classe. Il metro e' "quante righe deve avere
  questo ordine", cioe' quelle del file **piu'** quelle dello storico.
- **La riparazione e' idempotente**: per ogni ordine che non torna si TOLGONO le
  sue righe e si RISCRIVONO quelle del file, cosi' comunque fosse messo
  l'archivio quell'ordine finisce esatto e doppioni non se ne creano. Non esiste
  una scrittura "aggiungi" cieca. Fra perdere righe e duplicarle si sceglie
  sempre la prima: perdere e' rumoroso e si rimedia ricaricando, duplicare e'
  silenzioso e i ricalcoli partono sopra i pesi doppi.
- **Due regole che la riparazione non puo' violare.** (1) Si toccano **solo gli
  ordini presenti nel file**: la riparazione si regge sul poter riscrivere cio'
  che toglie, e di un ordine che il file non porta non c'e' niente da
  riscrivere - togliere lo storico conservato vorrebbe dire perderlo per sempre.
  Il freno e' nel browser e, come ultima rete, nell'azione `cancella_ordini`,
  che non filtra gli ID buoni: se ne arriva uno a cui il browser non dichiara
  nessuna riga nel file rifiuta la richiesta per intero, non tocca niente e
  risponde 200 con `non_fatta` (senza il campo `nel_file` il controllo non si fa
  affatto, per chi chiamava prima di questa rete). Il
  prezzo: una riga rimasta in archivio di un ordine che il file non contiene non
  si toglie da sola, si dice, e si rimedia ricaricando lo stesso file. (2) Se un
  ordine **conservato** risultasse con meno righe di quante la preparazione ne
  aveva contate non si ripara: **si dice** (`avviso_storico_non_torna`), perche'
  il file non le contiene e l'unico rimedio e' ricaricare l'export completo dal
  primo anno. Quella frase si costruisce **dopo** che la lettura e' stata
  giudicata, cioe' solo su una lettura buona: una lettura incoerente dice per
  definizione meno righe di quante ne sono state confermate, ed e' proprio
  quella che fa sembrare corti gli ordini conservati - la si usava per mandare a
  esportare l'intero storico dal portale per un guasto che non esisteva. E
  quell'ordine **non e' un "ordine mancante"**: esce una volta sola, col suo
  rimedio, e l'archivio non si dichiara "non allineato col file" (`storico_perso`
  si sottrae). Il caricamento resta **parziale** lo stesso e i ricalcoli non
  partono.
- **Lo svuotamento si riprende solo se sta andando avanti davvero.** Quando
  l'invocazione finisce i dodici secondi la function dice dove e' arrivata e il
  browser richiama, e una ripresa non consuma i tentativi. Ma
  `cancellati_ordini` sono gli ID **passati** a `deleteMany`, non le righe
  uscite: una piattaforma che accetta il filtro senza eseguirlo risponde bene lo
  stesso, e con quel numero come prova il ciclo non finiva mai - la barra
  scriveva "200 ordini tolti, si continua" all'infinito e l'unica via d'uscita
  era chiudere la scheda, cioe' il gesto che lascia l'archivio svuotato a meta'.
  Si pretende che le righe rimaste **scendano**, e le riprese hanno comunque un
  tetto (`MAX_RIPRESE_SVUOTAMENTO`).
- **"Nessun dato modificato" si dice del CARICAMENTO, non dell'invocazione.**
  Gli archivi si svuotano e si riscrivono uno per volta: se il filtro per ID non
  regge sul secondo, il primo e' gia' riscritto col file nuovo. Il server puo'
  solo dire "io non ho toccato niente"; il browser tiene la bandierina del
  caricamento intero e la finestra dice il verde solo quando e' vera. La
  bandierina va guardata su **tutte** le porte da cui un errore puo' uscire, non
  su una: per questo vive in `importaPrimarie`, che avvolge tutto il caricamento
  e abbassa `dati_intatti` su qualunque errore esca da li'. Chiusa su una porta
  sola restavano aperte le altre - lo svuotamento che non si ritenta, una
  scrittura rifiutata, e soprattutto la **registrazione finale**, che si guasta a
  caricamento completato e ad archivio interamente riscritto: un 401 (la sessione
  scade, un caricamento dura minuti) bastava a far uscire il verde.
- **Gli ID del file allo svuotamento si mandano SEMPRE, sugli archivi che hanno
  uno storico** (`storico: true` in `ARCHIVI_PRIMARIE`, `ARCHIVI_CON_STORICO` di
  la'). Senza ID la `svuota` fa il `deleteMany` di tutto: se la preparazione non
  rispondesse i conservati - campo assente, oppure a zero - lo storico degli anni
  prima sparirebbe, il caricamento chiuderebbe "successo" e nessuna frase lo
  direbbe. Mandandoli sempre, la `svuota` **ricalcola per conto suo** che cosa
  conservare (la seconda lettura di sicurezza voluta dall'utente) e una
  preparazione muta diventa un guasto rumoroso. E un archivio con storico che
  dopo lo svuotamento resta **senza nessuna riga** si dichiara: non si chiude
  come riuscito e non si ritenta alla cieca, perche' quelle righe il file non le
  contiene e l'unico rimedio e' un caricamento completo dal primo anno.
- **Le pagine dell'archivio si leggono in ordine di `id` e si deduplicano**
  (`pagineArchivio` in `importaBlocco/entry.ts`, regola di `shared/fetchAll.ts`):
  `id_ordine` non e' unico, quindi non e' stabile fra una pagina e l'altra. Da
  quella lettura esce il conto delle righe di ciascun ordine conservato, che fa
  da metro a tutto il confronto finale.
- **Lo stato "eseguito" e' un limbo, e si segnala** (`eEseguito` e
  `riepilogoEseguiti` in `movimenti.ts`, `src/components/primarie-rete/AvvisoEseguiti.jsx`):
  dati completi ma Chiudi non premuto a portale, quindi quell'ordine non entra in
  nessun conto - raccolto, giacenze, report, target, fatturazione - e sparirebbe
  in silenzio. Non si somma ai terminati: si conta a parte, un canale per volta.
  **Un "eseguito" assente dal file si CONSERVA come un terminato, e si segnala**
  (regola dell'utente, 28/09/2026: *"un ordine in stato eseguito va segnalato e
  mantenuto, cosi' che al prossimo caricamento abbia un altro stato, terminato o
  cancellato"*). E' uno stato **di passaggio** e si risolve da solo: al
  caricamento dopo, se l'ordine rientra nell'export, il portale gli ha dato lo
  stato definitivo e il file lo riscrive com'e' diventato; se e' immesso prima
  dell'anno scorso l'export non lo porta, la riga resta "eseguito" e l'avviso
  continua a farlo vedere - che e' il "mantenuto e segnalato" chiesto.
  Trattarlo come un ordine mancante, invece, faceva
  chiedere la forzatura e, forzando, CANCELLAVA proprio l'ordine che l'avviso
  sugli eseguiti serve a far vedere. Conservarlo non basta: `ordiniDaConservare`
  restituisce anche quanti sono (`eseguiti`), il numero arriva a
  `storico_conservato` e al registro, e le frasi dicono "ordini terminati o
  eseguiti" invece di chiamarli terminati. Senza quel conto un eseguito immesso
  prima dell'anno scorso non comparirebbe da nessuna parte, perche'
  `avviso_eseguiti` guarda il FILE. **La regola vale anche per secondarie e
  terziarie**, e fino all'08/10/2026 valeva solo a meta': `importEcotyreFile`
  chiamava la stessa funzione ma prendeva solo ordini e righe, buttando via
  `c.eseguiti`. Si conservavano e non li segnalava nessuno - il contrario di
  "segnalato E mantenuto". Adesso il conto arriva fino alla finestra del
  caricamento, e **l'avviso sta anche sulle pagine**: Secondarie (un canale per
  volta, che e' la scheda aperta) e Terziarie (due avvisi, perche' li' il canale
  lo decide il materiale e rete e ACI non si sommano mai). Senza quell'avviso una
  secondaria nel limbo non si vedeva da nessuna parte. Guardia in
  `prove/storicoConservato.mjs`.
- **Un caricamento aggiorna i moduli solo se e' riuscito** (`moduliDaRicalcolare`),
  e quando non partono si dice quali restano indietro (`ricalcoliFermi`). I
  ricalcoli (`RICALCOLI` in `src/lib/importGrandeFile.js`) sono **cinque** per le
  primarie - evasione degli assegnati, ritiri delle richieste del consorzio,
  ordini da completare della to-do list, verifiche e quadrature, qualifica
  fornitori - **due** per le secondarie e **due** per l'extra raccolta (verifiche
  e qualifica, piu' `alertExtra` - l'alert delle date obbligatorie - quando la
  riga di registro non si e' potuta scrivere: quel terzo non compare in
  `ricalcoliFermi`, che legge solo `RICALCOLI`), e **uno** per il report delle dichiarazioni di trattamento, che
  allinea le dichiarazioni caricate a portale: l'utente l'ha chiesto il
  02/10/2026, «dovrebbe farlo in automatico quando carico quei due file». La
  predittivita' non ha piu' un ricalcolo qui dal 26/09/2026: la pagina si
  ricalcola da sola a ogni apertura e il programma della settimana dopo si fissa
  il mercoledi' alle 8 (`analisiSettimanalePredittiva`); il modulo c'e', vedi la
  sua sezione. Erano quattro
  per le primarie finche' non si e' aggiunta la to-do list (28/09/2026): il
  numero scritto qui era rimasto indietro, verificato il 08/10/2026.
- **Le due conferme sono separate** (`CONFERMA_ORDINI_MANCANTI` e
  `CONFERMA_ARCHIVIO_RIMPICCIOLITO`) e si accumulano: possono scattare insieme, e
  mandandone una sola il pulsante "Forza caricamento" girava in tondo. Un collega
  che sta caricando adesso non e' un tentativo morto: glielo si dice subito,
  senza offrirgli niente da forzare.

### Il registro dei caricamenti

La preparazione di un caricamento apre una riga `in_corso` in `UploadLog` con
l'utente; la registrazione finale la chiude. Una riga rimasta `in_corso` e' la
traccia di un caricamento interrotto (archivio forse incompleto), e blocca per
dieci minuti un secondo caricamento dello stesso archivio da parte di un altro
utente. **Fa eccezione** la riga il cui messaggio comincia con «Caricamento non
riuscito» (`NON_RIUSCITO`): resta `in_corso` per non perdere la traccia, ma non
blocca nessuno, perche' li' non sta scrivendo piu' nessuno (`apriCaricamento` in
`importaBlocco` e in `importEcotyreFile`). Chi legge «l'ultimo caricamento» non
usa un criterio solo: `statoCaricamenti` (`base44/shared/cruscotto.ts`) tiene solo
l'esito `successo`, e scarta anche `parziale`; `reportSettimanali.ts` accetta un
`parziale` che non sia una riscrittura e scarta quello che lo e'; `caricamentoAperto`
(`src/lib/importGrandeFile.js`) prende la prima riga che non sia in `errore`.

### I file del Caricamento Dati si sostituiscono (29/09/2026)

Regola dell'utente: *"i file excel che carico nel modulo 'caricamento dati' si
devono sostituire ogni volta che carico il successivo, sempre che sia stato
caricato al 100%. non ha senso mantenere un file precedente che dice le stesse
cose di quello successivo a cui aggiunge di volta in volta poche righe"*.

Sono gli export del portale Ecotyre: ogni volta ripetono tutto e aggiungono le
righe nuove. Finivano in area **pubblica** (`UploadFile`, non
`UploadPrivateFile`) e il loro indirizzo restava per sempre in
`UploadLog.file_url`, senza che nessuno li cancellasse mai: erano i file piu'
grossi del gestionale.

La regola sta in `base44/shared/fileArchivio.ts` (`fileDaSostituire`,
`sostituisciFilePrecedenti`, `arretratiDaSostituire`,
`sostituisciFileArretrati`):

- **Al caricamento**, se l'esito e' `successo` (nessuna riga fallita), i
  caricamenti precedenti dello stesso `tipo_file` perdono il file. Un esito
  `parziale`, `errore` o `in_corso` non tocca niente: uno dei file di prima
  potrebbe essere ancora l'unico completo. Agganciato in `importEcotyreFile` e
  `importPdrFile`, con un tetto di 10 per caricamento. **Oggi non trova nessun
  candidato**, e non per la cancellazione: `fileDaSostituire` e
  `arretratiDaSostituire` cercano i precedenti fra i record che hanno `file_url`
  scritto, e dal passaggio all'area privata del 30/09/2026 quel campo resta
  **sempre vuoto** (`riferimentoDaSalvare` scrive `file_url: ''` e salva
  `file_uri`; lo dice anche la descrizione del campo in `UploadLog.jsonc`).
  Riabilitare la cancellazione quindi non basterebbe: andrebbe esteso il filtro a
  `file_uri`. Verificato l'08/10/2026.
- **Ogni notte** (`alleggerisciDocumenti`) l'arretrato: per ogni tipo si tiene il
  file del caricamento riuscito piu' recente e si tolgono gli altri, fino a 40
  per giro. Serve perche' ci sono tipi che si caricano una volta al mese o meno, e
  il loro file resterebbe ad aspettare il caricamento dopo.

**Il record del registro non si tocca**: righe importate, righe in archivio
prima, forzature, foglio riconosciuto e messaggio sono il controllo
anti-regressione e la storia dei caricamenti. Se ne va solo `file_url`, e al
messaggio si aggiunge la riga che dice quando e perche'.

**La trappola**: un caricamento **forzato** riusa il file del tentativo che non
era riuscito (`pendingFileUriRef` in `src/pages/CaricamentoDati.jsx`), quindi due
record del registro puntano allo stesso indirizzo. Cancellarlo perche' "e' del
caricamento di prima" cancellerebbe il file del caricamento buono: per questo si
decide prima quali indirizzi si TENGONO e solo dopo si toglie il resto, e lo
stesso indirizzo non si cancella due volte.

Primarie, dichiarazioni di trattamento e ordini non dichiarati non hanno questo
problema: si leggono nel browser a blocchi e il file non sale mai
(`TIPI_LETTURA_BROWSER` in `src/lib/importGrandeFile.js`). Il file delle
richieste ECT invece sale e il suo indirizzo non lo conserva nessun record:
`importaRichiesteEct` non prova piu' a cancellarlo - la piattaforma non cancella -
e lo ANNOTA nel registro `FileDaRimuovere` (audit del 03/10/2026), altrimenti
nessuno saprebbe piu' che esiste.

## I file, la privacy e i permessi

### I documenti aziendali non salgono mai in area pubblica (30/09/2026)

Regola dell'utente, testuale: *"fai in modo che documenti aziendali non girino per
il web, questa cosa della sicurezza e della privacy e' molto importante, anzi
stringente"*.

**Il fatto tecnico, confermato dall'assistenza della piattaforma.** Le uniche
integrazioni sui file sono `UploadFile`, `UploadPrivateFile`, `CreateFileSignedUrl`
e `ExtractDataFromUploadedFile`: **nessuna cancella**, ne' dall'SDK ne' dal
pannello. `DeleteFile`, `DeletePrivateFile` e `RemoveFile` **non sono endpoint**:
`integrations.Core` accetta qualunque nome di metodo, per questo `typeof
core.DeleteFile === 'function'` era vero e ogni chiamata tornava "Method Not
Allowed". Non c'e' nessun limite di spazio per app; i limiti sono solo sul singolo
file (50MB documenti, 100MB video).

Quindi **un file pubblico e' una porta che si apre una volta e non si richiude
piu'**: il suo `file_url` funziona per chiunque abbia il link, per sempre.

**La regola.** Si carica solo con `UploadPrivateFile`. Un file privato non ha un
indirizzo suo: si apre con un link firmato da `CreateFileSignedUrl` che scade (60
– 3600 secondi). Chi deve leggerlo se lo fa firmare, legge, e il link muore da
solo: non serve cancellare niente, ed e' per questo che e' la difesa giusta su una
piattaforma che non sa cancellare.

`base44/shared/fileScaricabile.ts` e' il passaggio obbligato: `urlScaricabile`
firma un `file_uri` e lascia passare un `file_url` storico; `riferimentoDaSalvare`
decide che cosa si scrive sul record. Le funzioni che scaricano - `importPdrFile`,
`importEcotyreFile`, `importaRichiesteEct` - accettano `file_uri` e, solo per i
caricamenti vecchi, `file_url`.

#### Il `file_uri` e' la chiave del documento: non si manda al browser (05/10/2026)

**Precisazione dell'assistenza della piattaforma**, che corregge una cosa scritta
come vera in tre posti di questo repository:

> *«A file_uri works as a capability within your app. Any signed-in user of your
> app who holds a private file_uri can call CreateFileSignedUrl with it and get a
> working signed URL. Signing isn't checked against that user, or against the RLS
> of the record that holds the reference. There's currently no setting that limits
> CreateFileSignedUrl to asServiceRole calls from a backend function. Signed file
> URLs keep working from the browser even with core integration protection turned
> on.»*

Quindi «privato» vuol dire **irraggiungibile da fuori**, non «al sicuro da tutti».
Dentro l'applicazione un file vale quanto l'archivio che ne tiene il riferimento:
chi legge il `file_uri` apre il file, e **nascondere il pulsante non e' un
permesso**. La difesa verso l'esterno (nessun indirizzo, nulla da indovinare)
resta intera ed e' la ragione per cui si carica solo con `UploadPrivateFile`.

**Il danno che questo apriva, misurato sul codice.** La funzione
`qualificaFornitori`, che la pagina chiama a ogni apertura e che risponde a
qualunque utente collegato, mandava nel riepilogo il `file_uri` di ogni documento
di qualifica. Nella pagina il pulsante «Apri» si disegna solo per
l'amministratore, quindi l'intenzione era scritta - ma sono **DURC, polizze,
visure, patenti degli autisti e CQC**, documenti di terzi con dati personali di
dipendenti di altre aziende, e con quel valore in mano li apriva chiunque fosse
collegato.

**Come si fa adesso**, le prime due delle tre strade che l'assistenza indica:

1. **Il riferimento non esce dal server.** `qualificaFornitori` manda `ha_file`
   (c'e' / non c'e'), non il `file_uri`; `DocumentoQualifica` ha la **lettura
   riservata all'amministratore** (chi non e' amministratore vede il riepilogo
   della funzione, che gira con `asServiceRole`; le uniche letture dirette dal
   browser stanno nel percorso di caricamento e in quello del catalogo, che sono
   gia' dell'amministratore).
2. **Si apre dalla funzione `apriFile`**, che prende `{ entita, id }`, legge il
   record con `asServiceRole`, controlla chi sta chiedendo e firma con scadenza
   **300 secondi**. Non accetta ne' indirizzi ne' `file_uri` dal corpo
   (`controllaRichiesta`, `base44/shared/fileRiservato.ts:113`): il server non va
   dove gli si dice di andare. Non e' la regola di `riferimentoDalCorpo`
   (`base44/shared/fileScaricabile.ts:106-110`), che il `file_uri` dal corpo lo
   ACCETTA - e' la sola strada dei caricamenti - e rifiuta solo l'indirizzo.
   Il permesso di ogni archivio sta in un posto solo,
   `base44/shared/fileRiservato.ts` (`ARCHIVI_APRIBILI`), ed e' un **elenco**:
   un archivio che nessun pulsante apre non ci sta, perche' una funzione che firma
   qualunque campo di qualunque entita' sarebbe peggio del buco che chiude. Nel
   browser si passa da `src/lib/apriFile.js`. Prove: `prove/fileRiservato.mjs`.

**Quello che resta da decidere.** `UploadLog`, `VerificaReport`, `QuadraturaFir`,
`ContrattoFornitore`, `ModelloContratto` e `ModelloDocumento` (per quest'ultimo
l'apertura a tutti e' voluta, `chi: 'tutti'`) tengono ancora il `file_uri` su record
con `read: true`, quindi i loro file restano apribili da qualunque utente
collegato. Per `UploadLog` la lettura aperta **serve** (otto pagine la usano per
accorgersi di un caricamento nuovo), quindi la sola strada e' la terza
dell'assistenza: spostare il riferimento in un archivio che solo
l'amministratore legge, con la migrazione dei record che ce l'hanno adesso. E' una
decisione sull'accesso, non una correzione: va chiesta prima di farla.

**Convertiti il 30/09/2026** (erano gli ultimi quattro pubblici): `PdrUpload`,
`SecondarieUpload`, `RichiesteEct`, `CaricamentoDati`. `prove/fileSemprePrivati.mjs`
e' la guardia: fallisce se qualcuno rimette `UploadFile` da qualunque parte.

**I file caricati PRIMA restano pubblici e non si possono richiamare.** L'unico
rimedio e' farli rimuovere a mano dal team della piattaforma, e per chiederlo
servono i loro identificativi: li produce la funzione `inventarioFile`
(`base44/shared/inventarioFile.ts`), scaricabile in CSV dal pulsante "Elenco dei
file caricati" in Caricamento Dati, solo amministratore. I pubblici escono per
primi perche' sono quelli che scottano.

**UNA RIGA DI QUELL'ELENCO PUO' ESSERE UN FILE CHE UN RECORD STA USANDO**, e va
letta prima di chiederne la rimozione. Dal 02/10/2026 l'inventario ha **due
sorgenti**: i record, e il registro `FileDaRimuovere` dei file che nessun record
usa piu' (`in_uso: false`). Il 02/10/2026 e' mancato poco che costasse caro:
l'elenco e' stato mandato all'assistenza chiedendo la rimozione dei file, e
dentro c'erano anche i **144 documenti di qualifica** dei fornitori (DURC,
contratti, polizze, visure), i **4 modelli** con cui si generano le lettere e una
stampa di quadratura. Li ha fermati l'assistenza, controllando lei: *«if we delete
them, those records will stay in your app but their documents will no longer
open»*. Da allora ogni riga del CSV porta la colonna **`azione`** - «DA FAR
RIMUOVERE: indirizzo pubblico. Prima togli il riferimento dal gestionale», «NON
RIMUOVERE: e' il documento che questo record sta usando» e, dal 02/10/2026, «DA
FAR RIMUOVERE: nessun record lo usa» (`AZIONE_PUBBLICO`, `AZIONE_PRIVATO`,
`AZIONE_ORFANO`: sono **tre**, non due) - e la funzione
restituisce `richiesta`, la frase coi conti da scrivere insieme al file
(`testoRichiesta`). Un elenco di file mandato senza dire che cosa farne si legge
come una lista di cancellazioni.

**Fatto il 02/10/2026.** L'assistenza ha rimosso dallo storage i **52 file
pubblici** (compresi i due `GESTIONEECOTYRE2026.xlsx`) e svuotato la cache CDN: i
loro indirizzi non caricano piu'. I riferimenti nei record erano gia' stati tolti
prima con `scollegaFilePubblici` (72 riferimenti), che e' l'ordine giusto. I 149
privati **non sono stati toccati, e non vanno toccati**.

**Niente password sui file.** Valutata e scartata: una password che l'app conosce
non e' un segreto dall'app, e una che deve digitare una persona rompe ogni lettura
automatica (pulizia notturna, riconfronto di una quadratura, allegati
dell'assistente). La difesa vera e' il link firmato che scade, **piu' il
riferimento che non arriva a chi non deve aprire quel documento**: il permesso di
chi puo' far firmare la piattaforma non lo controlla (vedi sopra, 05/10/2026), lo
controlla `apriFile`.

#### La piattaforma non cancella i file, e non si prova nemmeno piu'

Verificato il 30/09/2026 nell'alert del gestionale (Alert & Engine →
`archivio-file`): le tre operazioni esistono nell'SDK e **ognuna risponde
`Method Not Allowed`**. 59 file sono rimasti.

`cancellaFile` percio' **non chiama piu' niente** e restituisce **sempre**
`riuscita: false`. Non e' pigrizia: ogni tentativo costava **tre richieste a
vuoto per file** contro il limite al minuto di tutta l'app - nove a ogni domanda
con allegati fatta a EcoTyna, sei a ogni caricamento, tre a ogni quadratura - e
non poteva riuscire. Il vecchio tentativo resta come `provaACancellare`, che non
chiama nessuno, per il giorno in cui la piattaforma aggiungesse davvero
l'operazione; li' dentro vive ancora la distinzione fra **il rifiuto
dell'operazione e il fallimento di un file**: `negata` quando **tutte** le
operazioni disponibili sono state rifiutate in quanto operazioni (`Method Not
Allowed`, `501`, `not supported`), mentre basta **un** fallimento di altro genere
perche' si resti prudenti e si riprovi. Smettere per sbaglio vorrebbe dire non
cancellare mai piu'. E quando il rifiuto e' dell'operazione si smette al primo
tentativo, nei quattro punti che passano da `cancellaFile` (i documenti a 40
giorni, l'alleggerimento della qualifica, la sostituzione al caricamento,
l'arretrato notturno): ripeterlo su ogni file, con
59 file, erano 177 richieste contro il limite di **tutta** l'app, e l'esito non
cambiava.

**Il punto da non toccare mai**: sette punti del gestionale decidono su quel
`riuscita` se svuotare il riferimento al file sul record. Se `cancellaFile`
dicesse "riuscita" senza che il file sia sparito, il record perderebbe
l'indirizzo di un file che resta vivo e raggiungibile da chiunque abbia il link:
quel file non si potrebbe piu' nemmeno **far rimuovere**, perche' non sapremmo
piu' quale chiedere. E' il danno peggiore possibile in questa storia, e si evita
in un punto solo.

`supportoCancellazione` e' stato tolto. Decideva con `typeof core.DeleteFile ===
'function'`, che e' **sempre vero**: il modulo `integrations` dell'SDK e' un
Proxy che per qualunque nome restituisce una funzione che fa una POST a
`/integration-endpoints/Core/<nome>`. Non era un rilevamento, era una costante
travestita da rilevamento, e da li' nasceva un alert che diceva all'utente "le
funzioni ci sono ma vengono rifiutate" e gli consigliava di **farsele abilitare**.
Al suo posto c'e' `STATO_CANCELLAZIONE`, che e' un fatto scritto.

**L'alert ha un testo solo, e vero.** Niente ritentativo notturno promesso,
niente cancellazione da farsi abilitare, niente pulsante da cercare in un
pannello che non ce l'ha, niente spazio che cresce verso un limite che non
esiste. Dice: la piattaforma non sa cancellare, i dati e la storia scritta sono
al loro posto, **i file pubblici vanno fatti rimuovere per primi**, l'elenco si
scarica da Caricamento Dati, e l'avviso **non si chiude da solo** perche' solo
una persona sa quando il team li ha rimossi. *(Fino al 02/10/2026 le frasi erano
tre - operazioni assenti, operazioni rifiutate, fallimenti di passaggio - e il
numero nel titolo erano i file che restano, `bloccati`, non i tentativi fatti.
Prima ancora il caso vero cadeva nel terzo e l'avviso prometteva un ritentativo
che non puo' riuscire - "il gestionale riprova da solo alla prossima pulizia
notturna" - e quella era la bugia peggiore, perche' faceva aspettare. Tutto
superato da quando non si tenta piu'.)*

**C'era un QUARTO punto che ci provava, e non passava da `cancellaFile`**
(trovato e chiuso l'08/10/2026): `prefatturaEcotyre/entry.ts`, a ogni prefattura
caricata, girava a mano sui tre nomi `DeleteFile`, `DeletePrivateFile` e
`RemoveFile` con la guardia `typeof core[n] !== 'function'`, che **e' sempre
vera** per il Proxy dell'SDK - lo stesso falso rilevamento per cui
`supportoCancellazione` e' stato tolto. Erano tre richieste a vuoto per
caricamento, cioe' esattamente il costo che questa sezione dichiara eliminato. E
c'era di peggio: quel file non veniva annotato in `FileDaRimuovere`, e
`PrefatturaEcotyre` non tiene campi file, quindi **non compariva nell'inventario e
non si sarebbe potuto far rimuovere** - il danno che il paragrafo qui sopra dice
di aver chiuso in un punto solo. Adesso il giro a mano non c'e' piu' e il foglio
letto si annota nel registro (`annotaFileDaRimuovere`, come in
`importaRichiesteEct`), quindi esce nell'inventario con «DA FAR RIMUOVERE: nessun
record lo usa». **Due guardie in `prove/fileDaRimuovere.mjs`**: i tre nomi nel
CODICE possono stare solo in `shared/fileArchivio.ts` (nei commenti dappertutto,
o questa storia non si potrebbe scrivere), e le due funzioni che leggono un foglio
e non ne conservano l'indirizzo devono annotarlo.

**La sostituzione dei file percio' non puo' funzionare** finche' la piattaforma
non abilita la cancellazione. Il record del registro perde `file_url` solo se il
file se ne va davvero, quindi non si e' creata nessuna bugia: l'archivio dice il
vero, e' lo spazio che non si libera.

**L'alleggerimento a 40 giorni continua a funzionare**, perche' li' se ne va il
TESTO (i campi pesanti e le parti in `ContenutoEsteso`), non il file: verificato a
video il 30/09/2026, la colonna "Dettaglio fino al" delle Verifiche dice 07/11 e
08/11 e le pagine Verifiche e Verifiche Fornitori funzionano. Il peso vero erano
quei testi e gli Excel del portale; i file allegati sono un extra che non dipende
da noi. Da chiedere all'assistenza della piattaforma.

#### I link pubblici non restano scritti nei record

`UploadLog` ha `rls.read: true` - serve, otto pagine ci si agganciano per
accorgersi di un caricamento nuovo - quindi **qualunque utente collegato** poteva
leggere il registro e trovarci l'indirizzo pubblico di `GESTIONEECOTYRE2026.xlsx`
e di ogni export del portale. Restringere la lettura avrebbe rotto
l'aggiornamento automatico di quelle pagine; la via chirurgica e' svuotare il
campo, che e' il rimedio che descrive l'assistenza ("removing it from your
records hides it in your app").

Lo fa `scollegaFilePubblici`, pulsante "Togli i link pubblici dai record" in
Caricamento Dati, solo amministratore. **Non e' reversibile**: il campo svuotato
non torna. Gli indirizzi, invece, non si perdono: dall'audit del 03/10/2026 la
funzione li annota nel registro `FileDaRimuovere` prima di svuotarli, e
l'inventario li rilegge da li' come orfani, quindi l'elenco per il team della
piattaforma si scarica anche dopo. Per questo la
funzione senza `conferma: true` si limita a contare, e se un archivio non si
riesce a leggere non tocca niente: svuotarne una parte lascerebbe gli altri link
in giro senza dirlo.

### La conservazione dei documenti dei fornitori (29/09/2026)

Richiesta dell'utente, testuale: *"quando carico i documenti dei fornitori, che
siano report settimanali o mensili a consuntivo o gli ordini assegnati ad inizio
mese, al fine di non appesantire il dominio, devono automaticamente cancellarsi
dopo i famosi 40 giorni, ma deve restare il contenuto ovvero la storia scritta
per poterne fruire in futuro"*.

**I file non sono il problema.** Un Excel o un CSV si legge nel browser e sulla
piattaforma non sale niente; solo un PDF o un'immagine vengono caricati perche'
l'agente li legga, e si cancellano subito dopo la lettura. Quello che pesa e' il
CONTENUTO: righe lette ed esiti riga per riga finiscono in `ContenutoEsteso` a
pezzi da ottomila caratteri (`base44/shared/testoLungo.ts`).

**La regola, una sola** (`base44/shared/conservazione.ts`): al quarantesimo
giorno **dal caricamento** — non dalla competenza, o un consuntivo di settembre
che arriva a novembre nascerebbe scaduto — di un documento se ne vanno le righe
lette e il confronto riga per riga. **Il record non si cancella**: restano i suoi
contatori, il verdetto per canale e una **storia scritta** in italiano di
circa mille caratteri, al massimo 4300: `tagliaStoria` taglia a 4000 e `conNota`
aggiunge in coda la nota (altri 300). Prima di questa data le verifiche dei report settimanali
si cancellavano per intero e le liste degli assegnati dopo due mesi: se ne andava
proprio la storia che l'utente vuole tenere.

- **A giorni** (`daAlleggerire` di `shared/conservazione.ts` - l'omonima di
  `shared/fileArchivio.ts` e' quella dei tre anni della qualifica - piu'
  `alleggerisciDocumenti`, workflow notturno alle 3:15): `VerificaReport`,
  `QuadraturaFir`, `ConsuntivoFornitore`.
- **A mesi** (`alleggerisciVecchi` in `base44/shared/evasioneAssegnatiDati.ts`):
  `ListaAssegnati` e `ControlloEvasione`, perche' il controllo dell'evasione
  lavora ancora sulle liste del mese in corso e di quello prima. Due padroni
  della stessa cancellazione sarebbero un bug: qui i quaranta giorni non si
  aggiungono, si coordinano.
- **Subito**, senza aspettare i quaranta giorni
  (`alleggerisciControlliSuperati`): i `ControlloEvasione` **superati**. Ogni
  caricamento delle primarie ne deposita uno nuovo per ogni lista, col dettaglio
  di ogni richiesta: era la voce piu' pesante di tutto l'archivio. Di ogni lista
  resta per esteso l'ultimo. Vale la regola generale del gestionale: vale il piu'
  recente, il superato resta nello storico.

**La storia sta in un campo normale** (`storia`), mai scritto con `valoreCampo`:
sopra gli ottomila caratteri tornerebbe in `ContenutoEsteso`, cioe' il peso che
si e' appena tolto. Per questo `tagliaStoria` taglia a 4000 e lo dice. La storia
**non contiene i NOSTRI costi**: il record lo legge chiunque (`rls read: true`) e
la fatturazione passiva e' riservata all'amministratore, quindi `storiaConsuntivo`
riporta chili e formulari ma non l'importo previsto ne' gli scarti in euro. L'unico
euro che la storia dice e' `importo_consuntivo`, l'importo che il fornitore ha
scritto sul proprio documento (`conservazione.ts`): e' un suo dato, non un nostro
costo, ed e' voluto.
Le storie non sommano mai i canali (regola 3) e i pesi seguono `formatoKg`.

**Tre cose da non rompere:**

1. **L'ordine di `togliIlDettaglio`**: prima si svuotano i campi e si scrive la
   storia, poi si cancellano le parti in `ContenutoEsteso`, e il giorno
   (`alleggerito_il`) si segna per ULTIMO. Al contrario, nel campo resterebbe il
   segnaposto `@parti:N` senza le parti e `leggiCampo` lancerebbe: non un campo
   vuoto, un campo rotto. Un alleggerimento interrotto si riconosce dai campi
   vuoti con la storia scritta e senza il giorno, e `daAlleggerire` lo riprende:
   senza quella ripresa le parti pesanti resterebbero in archivio per sempre,
   perche' si cancellano per record e il record non le nomina piu'. Al secondo
   passaggio la storia **non si riscrive**, o diventerebbe povera.
2. **Un documento senza dettaglio non si riconfronta e non si esporta.**
   `daRiconfrontare` esclude gli alleggeriti (una dichiarazione di nessuna
   movimentazione non ha righe per definizione e senza quella esclusione si
   rigonfierebbe), `senzaRighe` esclude le liste senza righe da `eseguiControlli`
   e da `altreListe`, e i pulsanti PDF/Excel si spengono con una guardia anche
   dentro `scarica`: un PDF che va all'impianto col verdetto giusto e zero
   formulari dentro e' una bugia coerente, il peggio.
3. **Il motivo si scrive vero.** `nota(oggi, motivo)`: quaranta giorni, mese
   chiuso, lista piu' recente, superato dal controllo del giorno X. Scrivere
   "caricato da oltre quaranta giorni" su un controllo superato in giornata
   sarebbe una bugia che resta in archivio per sempre.

Ricaricare il file azzera `alleggerito_il` e `storia`: il documento torna intero.

### La qualifica dei fornitori

**Un documento della qualifica si chiede per ruolo oppure a fornitori indicati
per nome, mai in tutti e due i modi.** Il catalogo nasceva solo per ruolo
(raccolta, trasporto secondarie, impianto, stoccaggio, cliente): un documento che
riguarda un fornitore solo — le patenti degli autisti, la CQC, un'autorizzazione
particolare — andava messo su un ruolo intero e risultava mancante a tutti gli
altri, sporcando gli alert. Ora `TipoDocumentoQualifica.solo_per_soggetti` porta
l'elenco `[{ chiave, nome }]`: quando c'e', il documento vale SOLTANTO per quei
fornitori e i ruoli non contano (`richiestoA` in `base44/shared/qualificaFornitori.ts`).
La chiave e' la ragione sociale normalizzata, la stessa delle movimentazioni.
Scadenze, mancanze e non conformita' passano dalla valutazione di sempre, quindi
gli alert e l'email giornaliera li coprono senza modifiche.

**Una voce intestata a un fornitore che nell'anno non risulta e' un errore
silenzioso**: nessuno la chiederebbe mai e sembrerebbe tutto a posto.
`anomalieCatalogo` la segnala, e la segnalazione arriva in tre posti: il riquadro
rosso in cima al modulo, la dashboard (dal campo `anomalie_catalogo` del
RiepilogoQualifica, senza rifare la valutazione) e l'email del controllo
giornaliero, che parte anche quando non c'e' nessun'altra novita'.

**Un DURC non e' una visura e non e' una White List.** Caricare un documento
valido nella casella sbagliata e' l'errore piu' facile da fare e il piu' difficile
da vedere. L'agente lo controlla gia', ma il suo e' un giudizio:
`base44/shared/tipiDocumento.ts` e' la rete di sicurezza che non dipende dal
modello. Riconosce la famiglia del documento dal nome della casella e dal tipo
letto nel file, e segnala solo quando riconosce con certezza tutti e due e sono
diversi. Se anche solo uno dei due non si riconosce non dice niente: meglio un
controllo in meno che dichiarare sbagliato un documento giusto. Il confronto si
rifa' anche dentro `statoRequisito`, cosi' vale per i documenti analizzati prima
che il controllo esistesse, senza doverli rileggere con l'agente.

**Quando il file non si legge si dice, e si dice cosa fare.** `problemiLettura`
distingue tre casi: il modello dichiara il file illeggibile; il modello dice di
averlo letto ma non ne ha tirato fuori un solo dato (scansione senza testo, file
protetto, pagina bianca); il tipo non e' dichiarato. I primi due sono bloccanti,
quindi il requisito diventa "non conforme" e finisce negli alert, nell'email
giornaliera e nei conteggi della dashboard. Se invece e' l'analisi a fallire, il
motivo viaggia insieme allo stato "da verificare" e arriva anche nell'email.

**I 97 documenti caricati dall'archivio nel settembre 2026 non hanno
`analisi_json`**: furono letti con l'OCR di Windows e scritti a mano, non
dall'agente. Il controllo sul tipo quindi non li tocca (non c'e' una lettura da
confrontare) e non produce falsi allarmi. Non si usa `sintesi` come ripiego a
questo livello: quelle sintesi dicono "trovato nell'archivio contratti" e
farebbero scattare la famiglia "contratto" su mezzo catalogo.

**Il controllo giornaliero della qualifica non legge i documenti: li valuta.**
E' la distinzione che ha tenuto nascosto per mesi un quadro falso. Il workflow
`ControlloQualificaFornitori` (7:30, giorni feriali) ricalcola stati e scadenze e
manda il promemoria, ma chi legge davvero i file e' l'agente, e l'agente lo
chiama solo chi carica un documento. I novantasette documenti caricati
dall'archivio risultavano "analizzati" senza che nessuno li avesse mai letti: il
report li dava per buoni. Il presidio (`presidioQualifica`, workflow
`PresidioDocumentiQualifica`, 6:40 dei giorni feriali, cinquanta minuti prima del
promemoria) chiude il buco: prende fino a sei documenti per giro, nell'ordine in
cui conviene guardarli - mai letti, letture fallite, letture interrotte da piu'
di un quarto d'ora, documenti senza scadenza ricavata, letture piu' vecchie di
sei mesi (`daAnalizzare` in `base44/shared/analisiDocumento.ts`). Non rilegge
tutto ogni volta: un file non cambia, cambiano le norme e il tempo.

**L'analisi di un documento sta in `base44/shared/analisiDocumento.ts`**, non
dentro la sua funzione, perche' la usano in due: il pulsante del modulo e il
presidio. Un documento si controlla allo stesso modo comunque lo si guardi. Chi
analizza piu' documenti di fila passa `conoscenza` (le voci approvate lette una
volta sola) invece di rileggerle a ogni giro.

**La rianalisi dei 97 documenti, 21/09/2026**: 5 minuti a blocco di 48, due
richieste in parallelo, zero errori, circa 194 chiamate al modello. Il piano
builder ne rinnova 10.000 al mese: il costo di un controllo completo e' un giorno
di consumo normale. Il quadro vero che ne e' uscito: nessun fornitore
qualificato, 41 documenti scaduti, 56 mai ricevuti, 29 non conformi, e trentaquattro
conferme manuali revocate perche' la lettura ha trovato problemi bloccanti.

**Lo spazio dell'archivio: nel gestionale va solo cio' che scade e va
controllato.** Il contratto firmato si', gli allegati no: standard operativi,
disciplinari e descrizioni dei servizi non scadono e nessuno li verifica, quindi
restano nel repository sul computer, dove si leggono quando servono. Per
riferimento, il 21/09/2026 la cartella `CONTRATTI SUBFORNITORI` pesava 1,4 GB
mentre i documenti caricati nel gestionale erano 99. Due presidi: al caricamento
un file oltre 5 MB fa comparire un avviso (quasi sempre e' una scansione a colori
ad alta risoluzione, che in scala di grigi a 200 dpi pesa un decimo e si legge
uguale); e `alleggerisciQualifica` toglie il file ai documenti **sostituiti** da
oltre tre anni, lasciando la scheda - sintesi, scadenza, problemi, motivo della
sostituzione - che e' la storia del fornitore. Non e' automatico apposta:
cancellare file e' una decisione, l'amministratore guarda prima l'elenco. Se la
piattaforma non espone una cancellazione, la funzione si ferma al primo tentativo
e lo dice, invece di svuotare `file_uri` lasciando i file dov'erano.

**I contratti** passano da generato a inviato a controfirmato, con la data di ogni
passaggio: un contratto generato non e' un contratto fatto.
