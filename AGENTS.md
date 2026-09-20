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

L'unico uso legittimo di `ordine_chiuso_il` sono i **tempi di evasione**, che non
assegnano un periodo: misurano proprio la distanza fra immissione e chiusura.

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
sola - a tonnellata si divide per canale, a viaggio si addebita alla rete se c'e'
almeno un formulario di rete - e le tonnellate mostrate sono quelle del canale
che si sta guardando, mai la somma dei due.

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
colonne si riconoscono dai nomi e gli ordini dalla forma (`ET26084363`). Il PDF lo
legge l'agente e la lettura si controlla sui totali stampati; l'Excel e' la via
affidabile. Una prefattura nuova non cancella la precedente: la segna superata.

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

### Come si legge un movimento: un punto solo

`base44/shared/movimenti.ts` (specchio per le pagine: `src/lib/movimenti.js`).
Chi deve decidere se un movimento conta, in che mese e in che canale lo chiede
li', e non riscrive la regola:

- `eTerminato(r)`: conta solo un movimento terminato;
- `periodoMovimento(r)`: giorno, anno, mese e settimana ISO dalla **fine del
  trasporto sul giorno italiano**; `filtraMovimenti(records, { anno, mese, canale })`;
- `giornoOrdine / annoOrdine / meseOrdine`: per gli elenchi, che mostrano anche
  ordini senza trasporto (si collocano all'immissione). Mai la chiusura a portale;
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
