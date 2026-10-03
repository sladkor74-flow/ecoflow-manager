// IL NOME DEL PRODOTTO, IN UN POSTO SOLO.
//
// Il gestionale si chiama TreadRider dal 02/10/2026. Il nome stava scritto a mano
// in nove punti - il titolo della pagina, l'autore di sei file Excel, due
// intestazioni - e il 03/10/2026 si e' visto il risultato: l'autore di un Excel
// diceva ancora il nome vecchio e le pagine non lo scrivevano affatto, tanto che
// l'utente ha chiesto «in pratica e' come se non ci fosse».
//
// Da qui in avanti il nome si cambia qui e cambia ovunque. Resta fuori solo il
// `<title>` di index.html, perche' l'HTML non importa moduli, e quello che non sta
// nel repository: il nome con cui l'applicazione si installa, la sua descrizione e
// la sua icona vengono dalle impostazioni dell'applicazione, non da qui.

/** Il nome del prodotto, da solo: intestazioni, schermate di accesso. */
export const PRODOTTO = 'TreadRider';

/**
 * Il simbolo del marchio accanto al nome, chiesto dall'utente il 03/10/2026.
 *
 * E' ™ e non ®: il ® indica un marchio REGISTRATO, e usarlo su un marchio che non
 * lo e' ancora e' un'indicazione ingannevole che il codice della proprieta'
 * industriale sanziona. Il ™ si puo' usare da subito, anche durante il deposito.
 * Quando la registrazione ci sara', qui si scrive '®' e cambia dove si vede.
 *
 * Sta qui e non dentro PRODOTTO perche' il nome serve anche dove un simbolo non ci
 * va: il metadato Autore di un file Excel, il titolo della linguetta, una frase in
 * mezzo a un testo.
 */
export const MARCHIO = '™';

/** Che cosa fa, per chi: la riga sotto il nome. */
export const SOTTOTITOLO = 'Gestionale PFU';

/** Di chi e' la commessa: completa il sottotitolo dove c'e' spazio. */
export const COMMESSA = 'Smoco · Ecotyre';

/**
 * Il metadato Autore dei file che escono dal gestionale. Chi riceve un foglio per
 * email lo apre e legge da dove viene: e' l'unico posto in cui il nome viaggia
 * fuori di qui, quindi porta anche che cosa fa il programma.
 */
export const AUTORE_FILE = `${PRODOTTO} — ${SOTTOTITOLO}`;
