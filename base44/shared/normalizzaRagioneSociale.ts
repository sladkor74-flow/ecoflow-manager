// Normalizza una ragione sociale rimuovendo il tipo società (SRL, S.R.L., SPA, ecc.),
// la dicitura "A Socio Unico" / "A S.U.", punti e normalizzando spazi/case.
// Es. "IRIGOM S.R.L." -> "irigom", "Irigom Srl" -> "irigom", "NAPPI SUD SRL" -> "nappi sud"
// "Nappi Sud Srl A Socio Unico" -> "nappi sud", "T.R.S. SRL" -> "trs", "TECNOGUM SRL" -> "tecnogum"
//
// Tabella alias esplicita: varianti di denominazione (già normalizzate) → chiave canonica.
// Permette di riconoscere come unico impianto forme diverse es. "T-CYCLE INDUSTRIES SRL" = "T-CYCLE SRL".
// Chiavi canoniche: tecnogum, irigom, t-cycle, nappi sud, smoco, ecorecuperi,
//                  pneuservice conversano, emmesse, gatim, trs
const ALIAS_TO_CANONICAL = {
  // TECNOGUM
  'tecnogum': 'tecnogum',
  // IRIGOM
  'irigom': 'irigom',
  // T-CYCLE (varianti con/senza "INDUSTRIES" e con/senza trattino)
  't-cycle': 't-cycle',
  't-cycle industries': 't-cycle',
  'tcycle': 't-cycle',
  // NAPPI SUD
  'nappi sud': 'nappi sud',
  // SMOCO
  'smoco': 'smoco',
  // ECORECUPERI
  'ecorecuperi': 'ecorecuperi',
  // PNEUSERVICE CONVERSANO
  'pneuservice conversano': 'pneuservice conversano',
  // EMMESSE
  'emmesse': 'emmesse',
  // GATIM
  'gatim': 'gatim',
  // TRS
  'trs': 'trs',
};

export function normalizzaRagioneSociale(nome) {
  if (!nome) return '';
  let s = String(nome).trim().toUpperCase();
  // Rimuovi "A SOCIO UNICO" / "A S.U." in coda (prima della sigla società)
  s = s.replace(/\s*A\s+SOCIO\s+UNICO$/g, '');
  s = s.replace(/\s*A\s+S\.?\s*U\.?$/g, '');
  // Rimuovi sigle tipo società in coda (con o senza punti): SRL, S.R.L., SRLS, SPA, S.P.A., SNC, SAS, SAPA
  s = s.replace(/[\s,]*S\.?\s*R\.?\s*L\.?\s*S?\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*P\.?\s*A\.?\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*N\.?\s*C\.?\.?$/g, '');
  s = s.replace(/[\s,]*S\.?\s*A\.?\s*S\.?\.?$/g, '');
  s = s.replace(/[\s,]*SAPA\.?$/g, '');
  s = s.replace(/[\s,]*SRLS\.?$/g, '');
  // Rimuovi punti e virgole, normalizza spazi
  s = s.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  s = s.toLowerCase();
  // Applica tabella alias esplicita
  return ALIAS_TO_CANONICAL[s] || s;
}
/**
 * A quale nome dell'archivio si riferisce il nome scritto nella domanda.
 *
 * Serve a EcoTyna: l'utente scrive "Silvano", "Gatim", "eco gea", e in archivio
 * ci sono "SILVANO RENATO", "GA.TIM. S.R.L.", "ECO.GEA SRL". Fino al 29/09/2026
 * il filtro degli strumenti pretendeva il nome IDENTICO dopo la normalizzazione:
 * fuori dalle dieci voci della tabella alias qui sopra, un nome abbreviato dava
 * zero righe, e lo zero usciva come "ha raccolto 0,00 t" invece di "questo nome
 * non lo trovo". Un numero sbagliato, non solo una risposta generica.
 *
 * Tre passi, dal piu' stretto al piu' largo, e ci si ferma al primo che trova
 * qualcosa: nome uguale, abbreviazione (tutte le parole di peso di cio' che e'
 * stato chiesto stanno nel nome d'archivio), contenimento.
 *
 * Se i nomi che corrispondono sono PIU' D'UNO non si sceglie: si dice che sono
 * ambigui e si lascia decidere a chi ha fatto la domanda. Sommare due fornitori
 * diversi in un numero solo e' il modo peggiore di sbagliare, perche' il numero
 * sembra giusto.
 *
 * Restituisce { trovato, chiavi, nomi, alternative, come }.
 * Funzione pura: le prove la chiamano senza toccare la piattaforma.
 */
export function risolviNome(nomiArchivio, chiesto) {
  const cercato = normalizzaRagioneSociale(chiesto);
  const vuoto = { trovato: false, chiavi: [], nomi: [], alternative: [], come: 'niente_da_cercare' };
  if (!cercato) return vuoto;

  // Un nome per chiave normalizzata: "EMMESSE SRL" e "Emmesse S.r.l." sono lo
  // stesso fornitore, non due candidati.
  const perChiave = new Map();
  for (const n of nomiArchivio || []) {
    const k = normalizzaRagioneSociale(n);
    if (!k) continue;
    if (!perChiave.has(k)) perChiave.set(k, String(n).trim());
  }
  const chiavi = [...perChiave.keys()];

  const esito = (trovate, come) => ({
    trovato: trovate.length === 1,
    chiavi: trovate,
    nomi: trovate.map(k => perChiave.get(k)),
    alternative: trovate.length > 1 ? trovate.map(k => perChiave.get(k)) : [],
    come: trovate.length === 1 ? come : 'ambiguo',
  });

  const uguali = chiavi.filter(k => k === cercato);
  if (uguali.length) return esito(uguali, 'esatto');

  // Sotto i tre caratteri non si cerca per somiglianza: "trs" starebbe dentro
  // mezzo archivio e il risultato sarebbe un'ambiguita' inutile.
  if (cercato.length < 3) return { ...vuoto, come: 'troppo corto', alternative: [] };

  const parole = cercato.split(' ').filter(p => p.length > 2);
  if (parole.length) {
    const abbreviati = chiavi.filter(k => {
      const suo = new Set(k.split(' '));
      return parole.every(p => suo.has(p));
    });
    if (abbreviati.length) return esito(abbreviati, 'abbreviazione');
  }

  const contenuti = chiavi.filter(k => k.includes(cercato) || cercato.includes(k));
  if (contenuti.length) return esito(contenuti, 'contenuto');

  // Gli spazi non contano: la normalizzazione toglie i punti, e "ECO.GEA SRL"
  // diventa "ecogea" mentre chi scrive batte "eco gea". Sono lo stesso nome.
  const senzaSpazi = (v) => v.replace(/\s+/g, '');
  const attaccato = senzaSpazi(cercato);
  const uniti = chiavi.filter(k => senzaSpazi(k).includes(attaccato) || attaccato.includes(senzaSpazi(k)));
  if (uniti.length) return esito(uniti, 'contenuto');

  // Niente: si offre qualche nome che comincia uguale, per aiutare a riscrivere.
  const inizio = cercato.slice(0, 3);
  return {
    trovato: false, chiavi: [], nomi: [],
    alternative: chiavi.filter(k => k.startsWith(inizio)).slice(0, 8).map(k => perChiave.get(k)),
    come: 'nessuno',
  };
}
