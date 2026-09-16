// Segna le tabelle che scorrono davvero di lato, perche' il foglio di stile ne
// blocchi la prima colonna (vedi "Tabelle larghe e lunghe" in src/index.css).
//
// Il CSS da solo non sa se una tabella e' piu' larga del suo riquadro: lo si
// misura qui, quando la pagina cambia o la finestra si ridimensiona. Le tabelle
// strette restano come sono.

const CONTENITORI = '.overflow-x-auto, .overflow-auto';

function controlla() {
  document.querySelectorAll(CONTENITORI).forEach((el) => {
    if (!el.querySelector(':scope > table')) return;
    const scorre = el.scrollWidth > el.clientWidth + 2;
    if (scorre) {
      if (!el.hasAttribute('data-scorre-lato')) el.setAttribute('data-scorre-lato', '');
    } else if (el.hasAttribute('data-scorre-lato')) {
      el.removeAttribute('data-scorre-lato');
    }
  });
}

/** Avvia l'osservazione; restituisce la funzione che la ferma. */
export function osservaTabelle() {
  let timer = null;
  const programma = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; controlla(); }, 250);
  };
  // Si guardano solo gli elementi aggiunti o tolti: l'attributo che si mette qui
  // non fa ripartire l'osservazione.
  const osservatore = new MutationObserver(programma);
  osservatore.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', programma);
  programma();
  return () => {
    osservatore.disconnect();
    window.removeEventListener('resize', programma);
    if (timer) clearTimeout(timer);
  };
}
