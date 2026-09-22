# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Base44 References

- CLI overview: https://docs.base44.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.base44.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- Run the relevant checks from `package.json` before finishing code changes.
- **Limite di richieste della piattaforma** (22/09/2026): le richieste agli archivi
  si contano per tutta l'app insieme, su un minuto; oltre, 429 "Rate limit
  exceeded". Ogni funzione avvolge il client con
  `conLimiteRichieste(createClientFromRequest(req))` (`base44/shared/limiteRichieste.ts`,
  specchio in `src/lib`, usato anche da `src/api/base44Client.js`): una richiesta
  respinta si ripete dopo una pausa, le chiamate a funzione solo su 429. Le
  letture intere passano da `fetchAll`/`perPagina`/`fetchAllClient`, a pagine da
  5000 righe (il massimo che la piattaforma restituisce). Niente pagine che
  rileggono archivi interi a intervalli: si guarda lo stato di cio' che e' in
  corso, e si rilegge tutto solo quando cambia (`ReportSettimanali.jsx`).

## Regole della commessa

Regole di dominio che il codice deve rispettare sempre. Valgono per ogni nuovo
conto, filtro, export o assistente: se una modifica le viola, e' sbagliata anche
quando "funziona".

### Il periodo di un movimento e' la fine del trasporto

A quale giorno, settimana, mese e anno appartiene un movimento lo decide
**`trasporto_finito_il`**, mai `ordine_chiuso_il` e mai i campi `mese`, `anno` o
`settimane` memorizzati sul record. Il portale chiude l'ordine giorni dopo la
fine del trasporto, e i due non cadono nello stesso mese: contato sul 2026,
96 primarie di rete su 2.827 (272,65 t), 2 ACI su 44, una secondaria e 65
terziarie su 99 (2.198,64 t).

Usa `dataPeriodo(record)` da `base44/shared/dataEnrichment.ts`, che incapsula la
regola. I campi memorizzati possono venire da importazioni vecchie, quando la
data di riferimento era la chiusura: non fidarsene, ricalcolare.

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

Un assegnato non e' un movimento: il suo periodo e' `ordine_immesso_il`.

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
`src/lib`), usato da Dashboard, Proiezione, suggerimento del lunedi' e agente: le
primarie di rete arrivate al **sito** dell'impianto seguito, cioe' all'impianto e
al suo piazzale (`tipo_destinazione` 'stoc'), piu' le secondarie di rete da altri
stoccaggi. Le primarie del piazzale contano perche' "il residuo totale diminuisce
anche con le primarie" (utente); le secondarie dal proprio piazzale a se stesso
non si contano, sarebbero contate due volte. Il piazzale conta al netto di quello
che riparte verso altri impianti seguiti (scelta da confermare con l'utente).

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

**La prefattura del portale Ecotyre** (`base44/shared/prefattura.ts`, funzione
`prefatturaEcotyre`, scheda «Prefattura Ecotyre»). Si carica in Excel o in PDF e
si confronta ordine per ordine con le righe di `attivaCalcolo.ts`, PRIMA di
esportare: solo in prefattura (con la ragione: altro mese, cancellato,
sconosciuto), solo nel gestionale, peso diverso, stesso peso e importo diverso
(col prezzo per tonnellata ricavato). Il canale di un ordine non si chiede: e'
quello che ha nel gestionale. La prefattura non ha un tracciato garantito: le
colonne si riconoscono dai nomi e gli ordini dalla forma (`ET26084363`). Il PDF si
legge dal suo testo (vedi piu' sotto), non con un agente. Una prefattura nuova non
cancella la precedente: la segna superata.

### Il margine

`base44/shared/margine.ts`, funzione `calcolaMargine`, scheda «Margine» della
fatturazione (solo admin). Ricavo attivo meno costo passivo, mese per mese e
canale per canale, con una sola lettura degli archivi. **Non ha regole sue**: usa
`attivaCalcolo.ts` e `passivaCalcolo.ts` (il calcolo della passiva, che la
funzione `calcolaPassiva` si limita a chiamare), quindi i numeri sono gli stessi
delle due fatturazioni al centesimo. Tre canali, tre margini, mai un totale. Il
costo di un mese comprende stoccaggio, trattamento e secondarie di quel mese, che
possono riguardare tonnellate raccolte prima: il numero che conta e' l'anno.

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

### La pratica mensile di Irigom

Le dichiarazioni di Irigom le prepariamo noi, nella scheda Irigom di
Dichiarazioni Impianti (`PraticaIrigom.jsx`). Le regole stanno in
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
  trasportatori (regola dell'utente del 22/09/2026, `combinazioneVicina` in
  `src/lib/praticaIrigom.js`: tutte le somme possibili, poi si tolgono gli
  allegati di coda che non servono, cosi' restano quelli di testa). Tante
  terziarie quanti allegati; le TER in ordine crescente vanno agli allegati in
  ordine di scelta. Agosto 2026 e' stato dichiarato con la regola di prima - i
  primi dell'ordine finche' bastano - che resta come `criterio: 'ordine'` per
  rifare una pratica gia' consegnata.
- **Domanda aperta** (22/09/2026): nel foglio Dettaglio alcune celle del peso
  degli allegati VII sono gialle (6 ad agosto, fra cui il n. 30 che abbiamo
  dichiarato): non e' un marcatore di 'non nostro'. L'utente lo chiedera' a
  Irigom e vuole che glielo si ricordi: tirarlo fuori alla prossima pratica.
- **Ripartizione**: ciabattato a peso pieno dell'allegato, l'ultima terziaria il
  resto; ferro uguale per tutte alle decine, l'ultima il resto; mai oltre 38.000
  kg per dichiarazione, sul peso con cui la dichiarazione si chiude a portale.
- **Quanto** (22/09/2026): due letture del **totale da caricare a portale**,
  sempre mostrate insieme. Uscite del registro V + X + Y (extra raccolta
  compresa), oppure la giacenza: dopo la dichiarazione del mese M a portale deve
  restare **AD + AE della riga di M nel foglio Cons.** (gomma in impianto:
  cippato, SACI e interi; piu' ferro in giacenza) meno l'extra ancora in
  impianto. Totale a portale = giacenza di rete a portale a fine mese (per fine
  trasporto) - quello che deve restare. Il CSS-C in giacenza (Z) non resta: e'
  end of waste. Il ferro e' la parte che si aggiusta: totale a portale - V - Y.
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
- `docxModello.unisciRun` fonde solo run con lo stesso stile: fonderli tutti
  faceva perdere grassetti e caratteri ai documenti generati.

### Le tre regole che l'utente non vuole ripetere (21/09/2026)

1. **Fine trasporto, MAI chiusura a portale.** In ogni modulo ogni ragionamento
   - periodo, tagli a una data, confronti con una fotografia del portale,
   ripieghi quando un campo manca - si fa sulla fine del trasporto.
   `ordine_chiuso_il` / `data_chiusura` si possono mostrare, mai usare per
   decidere.
2. **Ogni caricamento aggiorna tutto.** Un modulo fermo a una fotografia vecchia
   e' un difetto, non una spiegazione. La giacenza a portale di un impianto e'
   la fotografia degli ordini non dichiarati **piu'** i carichi che il
   gestionale conosce e il file no (riconosciuti dal **numero d'ordine** negli
   ordini non dichiarati e nel report delle dichiarazioni, mai dalla data)
   **meno** le dichiarazioni caricate dopo la fotografia. Quella di uno
   stoccaggio e' la rilevazione per classe piu' i movimenti finiti dopo.
3. **Rete, ACI ed extra raccolta non si mescolano mai**: giacenze, dichiarazioni,
   totali, KPI. La rilevazione di uno stoccaggio si divide per classe (1-4 rete,
   9 ACI); `GiacenzaSito.giacenza_riferimento_t` e' la rete e
   `giacenza_riferimento_aci_t` l'ACI; l'extra raccolta a portale non c'e'.

Il 21/09/2026 gli "scarti" di Green Tyre (24,56 t), Gatim (14,95 t) e T-Cycle
(11,56 t) erano carichi caricati nel gestionale che la fotografia del 18/09 non
conteneva ancora: con la regola 2 si aggiungono da soli.

### Le date obbligatorie dei formulari (22/09/2026)

Parole dell'utente: «le date immissione, inizio e fine trasporto sono
obbligatorie nei formulari, se non ci sono vanno segnalate e questo vale sempre
dove ci sono ordini terminati non solo nei report settimanali». La regola sta in
`base44/shared/movimenti.ts` (specchio `src/lib/movimenti.js`):
`DATE_OBBLIGATORIE`, `dateMancanti`, `dateIncoerenti`, `dateDaSistemare`,
`testoDate`. Non si riscrive. Quanti sono si conta in **ordini distinti**, mai in
righe (`chiaveOrdine`, `ordiniDaSistemare`, `mancantiOrdine`, `incoerentiOrdine`,
`testoOrdine`, `ordineSenzaFine`, nello stesso file): lo stesso ordine sta in
archivio con piu' righe - una per classe o per prodotto - e contarle tutte
faceva uscire due numeri diversi per lo stesso insieme (23/09/2026).
Un terminato senza fine trasporto resta fuori da
ogni periodo, ma si segnala sempre dicendo quali date mancano; uno con la fine
trasporto ma senza un'altra data, o con date nell'ordine sbagliato, si conta e si
segnala lo stesso. Dove si vede:

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

Chi la rete non la dichiara per accordo (`dichiara_rete` falso, oggi Tecnogum)
non ha una giacenza di rete che il portale tenga per noi: i suoi carichi non si
aggiungono alla fotografia come "non ancora nel file".

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
- `canaleMovimento(r, archivio)`: rete, ACI (con `eAci`) o extra raccolta.

Anche «oggi» e' il giorno italiano (`oggiRoma()`), non `new Date()` del server.
Gli specchi in `src/lib` devono restare identici agli originali: lo controlla
`prove/specchi.mjs`. **Prima di spingere: `npm run lint` e `npm run prove`.**

### Decisioni della direzione del 20/09/2026 sulla fatturazione attiva

- Nel 2026 a Ecotyre si fattura a **202 euro la tonnellata** sulla **rete** e
  sull'**extra raccolta**; l'**ACI** ha le sue tariffe per regione. Nei report il
  prezzo si scrive a tonnellata (la prefattura del portale lo scrive al chilo,
  0,202: e' lo stesso prezzo).
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

### Il registro dei caricamenti

La preparazione di un caricamento apre una riga `in_corso` in `UploadLog` con
l'utente; la registrazione finale la chiude. Una riga rimasta `in_corso` e' la
traccia di un caricamento interrotto (archivio forse incompleto), e blocca per
dieci minuti un secondo caricamento dello stesso archivio da parte di un altro
utente. Chi legge «l'ultimo caricamento» esclude `errore` e `in_corso`.

### La dashboard e l'elenco unico delle cose da gestire

`base44/shared/cruscotto.ts`, funzione `cruscottoOperativo`, componente
`src/components/dashboard/Cruscotto.jsx`. Un solo elenco, ordinato per gravita',
di cio' che richiede attenzione, ogni voce col collegamento a dove si risolve.
Legge **solo archivi piccoli** (alert, registro dei caricamenti, ordini aperti,
documenti di fatturazione, prefatture, riepilogo della qualifica, target,
richieste del consorzio): chi aggiunge un controllo non deve farle rileggere le
primarie. Le anomalie di prezzo delle fatturazioni arrivano dal margine, che la
pagina chiede dopo e solo per l'amministratore. Un controllo nuovo si aggiunge
li', con un caso in `prove/cruscotto.mjs`.

Il target annuo dell'impianto sta sia in Giacenze sia in Target & Status perche'
servono a cose diverse, ma deve essere lo stesso numero: l'unico confronto e'
`base44/shared/targetImpianti.ts` e una divergenza si dice sempre (Giacenze,
proiezione, alert critico, dashboard).

I contratti passano da generato a inviato a controfirmato, con la data di ogni
passaggio: un contratto generato non e' un contratto fatto.

**La prefattura in PDF** non la legge un agente: con oltre quattrocento righe si
rifiuta di restituirle tutte (provato il 20/09/2026). Il browser ne estrae il testo
con pdf.js (`src/lib/pdfTesto.js`, caricata solo quando serve) e
`leggiLineePdfPrefattura` lo legge riga per riga. Il PDF porta in testa il
riepilogo stampato (ordini, chili, euro per classi 1-4 e classe 9) e il mese: se
le righe lette non sommano quel riepilogo il caricamento viene rifiutato. Sul PDF
vero di luglio 2026: 416 righe, identiche all'Excel una per una.

**Nello schema un elenco va dichiarato `"type": "array"`.** Scritto come `object`
il server rifiuta il dato con `Error in field X: Input should be a valid
dictionary` e la funzione risponde 500. E' successo per davvero: il registro delle
esportazioni (`EsportazioneFatturazione.documento_ids`) non ha registrato niente
dal giorno in cui e' nato, e nessuno se n'era accorto perche' il file veniva
comunque prodotto. Quando si aggiunge un campo che conterra' un elenco lo si
dichiara `array` con i suoi `items`, anche se per ora non ci scrive nessuno.

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

**Quando una pagina carica piu' riquadri indipendenti si usa
`Promise.allSettled`, non `Promise.all`.** Le funzioni che leggono gli archivi
grandi ogni tanto cadono: su Terminati Rete bastava `computeRaccoglitoriMix` a
500 per lasciare vuote anche la matrice per provincia, i tempi di evasione e gli
alert. Chi non ha risposto si dice per nome, con "Riprova"; il resto resta a
video.

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
