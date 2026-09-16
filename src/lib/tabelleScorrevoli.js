// Tabelle che scorrono di lato: barra di scorrimento anche in alto e prima
// colonna ferma (vedi "Tabelle larghe e lunghe" in src/index.css).
//
// Il browser mette la barra orizzontale solo in fondo al riquadro, e il CSS non
// puo' spostarla. Qui se ne aggiunge una sopra la tabella, collegata a quella in
// basso: si puo' trascinare l'una o l'altra e la tabella scorre. Le tabelle
// strette restano come sono: la misura si ripete quando la pagina cambia o la
// finestra si ridimensiona.

const CONTENITORI = '.overflow-x-auto, .overflow-auto';
const CLASSE_BARRA = 'barra-scorrimento-alta';

const barraDi = new WeakMap(); // contenitore -> barra in alto
const contenitoreDi = new WeakMap(); // barra in alto -> contenitore

function creaBarra(contenitore) {
  const barra = document.createElement('div');
  barra.className = CLASSE_BARRA;
  barra.setAttribute('aria-hidden', 'true');
  barra.title = 'Scorri la tabella a destra e a sinistra';
  barra.appendChild(document.createElement('div'));
  // Le due barre si inseguono. Quella che si sta muovendo guida per un attimo e
  // gli eventi dell'altra, che sono solo l'eco della copia, si ignorano; senza
  // questo, con lo zoom del browser le posizioni si arrotondano in modo diverso e
  // le due barre si rincorrono all'infinito. Sotto il pixel non si copia nulla.
  let guida = null;
  let finoA = 0;
  const segui = (da, a, chi) => {
    const ora = performance.now();
    if (guida && guida !== chi && ora < finoA) return;
    guida = chi;
    finoA = ora + 100;
    if (Math.abs(a.scrollLeft - da.scrollLeft) > 1) a.scrollLeft = da.scrollLeft;
  };
  barra.addEventListener('scroll', () => segui(barra, contenitore, 'barra'), { passive: true });
  contenitore.addEventListener('scroll', () => segui(contenitore, barra, 'tabella'), { passive: true });
  barraDi.set(contenitore, barra);
  contenitoreDi.set(barra, contenitore);
  return barra;
}

function sistemaBarra(contenitore) {
  const barra = barraDi.get(contenitore) || creaBarra(contenitore);
  // La barra sta subito sopra la tabella, anche se la pagina ha inserito
  // qualcos'altro nel frattempo.
  if (barra.nextElementSibling !== contenitore && contenitore.parentNode) {
    contenitore.parentNode.insertBefore(barra, contenitore);
  }
  // Stessa corsa della barra in basso: larga quanto la parte visibile della
  // tabella, con dentro un elemento largo quanto la tabella intera.
  const larghezza = `${contenitore.clientWidth}px`;
  if (barra.style.width !== larghezza) barra.style.width = larghezza;
  const margine = `${contenitore.clientLeft}px`;
  if (barra.style.marginLeft !== margine) barra.style.marginLeft = margine;
  const interno = `${contenitore.scrollWidth}px`;
  if (barra.firstChild.style.width !== interno) barra.firstChild.style.width = interno;
  if (Math.abs(barra.scrollLeft - contenitore.scrollLeft) > 1) barra.scrollLeft = contenitore.scrollLeft;
}

function togliBarra(contenitore) {
  const barra = barraDi.get(contenitore);
  if (barra && barra.parentNode) barra.parentNode.removeChild(barra);
}

function controlla() {
  document.querySelectorAll(CONTENITORI).forEach((el) => {
    if (!el.querySelector(':scope > table')) return;
    const scorre = el.scrollWidth > el.clientWidth + 2;
    if (scorre) {
      if (!el.hasAttribute('data-scorre-lato')) el.setAttribute('data-scorre-lato', '');
      sistemaBarra(el);
    } else {
      if (el.hasAttribute('data-scorre-lato')) el.removeAttribute('data-scorre-lato');
      togliBarra(el);
    }
  });
  // Barre rimaste senza tabella, perche' la pagina l'ha tolta.
  document.querySelectorAll(`.${CLASSE_BARRA}`).forEach((barra) => {
    const contenitore = contenitoreDi.get(barra);
    if (!contenitore || !contenitore.isConnected || !contenitore.hasAttribute('data-scorre-lato')) barra.remove();
  });
}

/** Avvia l'osservazione; restituisce la funzione che la ferma. */
export function osservaTabelle() {
  let timer = null;
  const programma = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; controlla(); }, 250);
  };
  // Si guardano solo gli elementi aggiunti o tolti. Le barre che si aggiungono qui
  // fanno ripartire un controllo, che pero' non trova nulla da cambiare e si ferma.
  const osservatore = new MutationObserver((mutazioni) => {
    const soloBarre = mutazioni.every(m => [...m.addedNodes, ...m.removedNodes].every(n => n.classList && n.classList.contains(CLASSE_BARRA)));
    if (!soloBarre) programma();
  });
  osservatore.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', programma);
  programma();
  return () => {
    osservatore.disconnect();
    window.removeEventListener('resize', programma);
    if (timer) clearTimeout(timer);
    document.querySelectorAll(`.${CLASSE_BARRA}`).forEach((b) => b.remove());
  };
}
