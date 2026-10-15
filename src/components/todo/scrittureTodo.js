import { createContext } from 'react';

// CHI SCRIVE LE ANNOTAZIONI E LA NOTA INTERNA (15/10/2026).
//
// Le righe della to-do list non scrivono niente da se': scrive la pagina
// (ElencoAttivita.jsx, AttivitaCancellate.jsx). Per le annotazioni e la nota
// interna, che stanno su ogni riga delle attivita' e delle richieste ECT, la
// pagina To-Do List mette qui chi scrive - una sola volta, per tutte e due le
// schede - invece di passarlo di componente in componente:
//   annota(archivio, id, cambia)   rilegge il record e scrive l'elenco nuovo
//                                  (scriviAnnotazioni, src/lib/annotazioni.js),
//                                  con l'email di chi e' collegato;
//   notaInterna(id, testo)         scrive note_interne di una richiesta ECT.
// Senza la pagina intorno (null) le annotazioni si leggono e basta: nessun
// pulsante che non saprebbe dove scrivere. Questo file non importa il client
// del gestionale apposta: i componenti che lo usano si disegnano anche nelle
// prove, senza collegamento.
export const ScrittureTodo = createContext(null);
