// QUANDO UNA FUNZIONE NON RISPONDE, LA PAGINA LO DICE E SI PUO' RIPROVARE.
//
// Il fatto, 09/10/2026. Subito dopo una pubblicazione l'utente apre Giacenze e
// trova «Errore nel caricamento.» e basta: nessun motivo, niente da premere,
// l'unica via d'uscita e' ricaricare il browser. Il calcolo stava benissimo -
// chiamato un minuto dopo rispondeva - ma la piattaforma stava rimettendo su le
// funzioni e quella chiamata e' caduta.
//
// E' la regola della casa, scritta il 25/09/2026 per le pagine a piu' riquadri:
// «chi non ha risposto si dice per nome, con Riprova; il resto resta a video».
// Vale anche dove la funzione e' una sola.
//
// Qui si controlla il sorgente, perche' e' li' che la regola si perde: una
// `catch` che inghiotte l'errore e' una riga sola, e non si vede piu'.
// npm run prove
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

console.log('GIACENZE: IL MOTIVO, E UN PULSANTE PER RIPROVARE');
{
  const g = sorgente('src/pages/Giacenze.jsx');
  verifica('l errore non si inghiotte: si tiene', g.includes('const [errore, setErrore]'));
  verifica('e si prende il messaggio vero, non una frase fissa',
    g.includes('setErrore(e?.response?.data?.error || e?.message || String(e))'));
  verifica('una lettura riuscita lo cancella', g.includes("setErrore('')"));
  verifica('la vecchia frase muta non c e piu', !g.includes('>Errore nel caricamento.<'));
  verifica('al suo posto si dice che cosa non ha risposto', g.includes('Il calcolo delle giacenze non ha risposto'));
  verifica('e si dice che capita dopo una pubblicazione, cosi non sembra un dato perso',
    g.includes('subito dopo una pubblicazione'));
  // Due pulsanti «Riprova»: quello della pagina vuota e quello della striscia
  // che compare quando un RICALCOLO cade sopra dei numeri gia' a video.
  verifica('si puo riprovare senza ricaricare il browser', (g.match(/Riprova/g) || []).length >= 2, String((g.match(/Riprova/g) || []).length));
  verifica('e un ricalcolo caduto non cancella i numeri che si hanno davanti',
    g.includes('a video ci sono i numeri di prima'));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
