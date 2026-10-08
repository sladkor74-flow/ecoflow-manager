/**
 * IL REPORT DEL PORTALE CONTA PER ANNO DEL CARICO, noi per mese di dichiarazione.
 *
 * Una dichiarazione di quest'anno che ha smaltito materiale arrivato l'anno
 * scorso il portale la mette nell'anno scorso, e la riga della quadratura sembra
 * denunciare un ammanco che non c'e'. Su Irigom erano 400,20 t - la giacenza che
 * l'impianto si portava dietro dal 31 dicembre, piu' una secondaria arrivata il
 * 9 gennaio con dentro i ritiri del 20-22 dicembre - e la riga, che diceva solo
 * «nel report risultano 2.877,48 t dichiarate», e' costata mezza giornata di
 * verifiche (08/10/2026). La giacenza intanto quadrava al chilo, perche' li' i
 * due lati usano lo stesso criterio.
 *
 * Nell'altro verso il discorso cambia del tutto: se il portale ne conta PIU' di
 * noi non e' una questione di anni, e' una dichiarazione che non abbiamo
 * registrato, e va cercata.
 *
 * @param s riga della quadratura
 * @param fmt come si scrive un numero di tonnellate
 */
/**
 * L'ESITO DI UNA RIGA DELLA QUADRATURA, detto come lo direbbe una persona.
 *
 * «Nessun dato a portale» e' vero ma suona come un vuoto, e di vuoti non ce n'e'
 * nessuno: i due casi che ci finivano dentro sono tutt'e due in ordine
 * (decisione dell'utente, 08/10/2026).
 *
 * 1) L'IMPIANTO CHE NON DICHIARA LA RETE PER ACCORDO (dichiara_rete falso in
 *    Giacenze: oggi Tecnogum). Non ci fattura il trattamento e dichiara in
 *    proprio, quindi quelle tonnellate NON SONO DA DICHIARARE: restano qui come
 *    storia di quello che e' entrato, e a portale non risultano fra le cose da
 *    fare. Finche' l'accordo e' questo non e' un ammanco, e va detto.
 * 2) L'IMPIANTO CHE HA DICHIARATO TUTTO (oggi T.R.S.). Non compare fra gli
 *    ordini non dichiarati - che e' da dove prendiamo la fotografia - proprio
 *    perche' non gli e' rimasto niente da dichiarare, e il report del portale
 *    conferma le stesse tonnellate che risultano a noi.
 *
 * @returns { stato: 'quadra'|'verifica'|'fuori'|'ignoto', testo, spiega }
 */
export function esitoQuadratura(s) {
  const muto = { stato: 'ignoto', testo: 'nessun dato a portale', spiega: 'Questo sito non compare fra gli ordini non dichiarati del portale e non ha una rilevazione di giacenza: non c\'è un valore da confrontare.' };
  if (!s) return muto;
  if (s.quadra === true) return { stato: 'quadra', testo: 'quadra', spiega: '' };
  if (s.quadra === false) return { stato: 'verifica', testo: 'da verificare', spiega: '' };
  if (s.dichiara_rete === false) {
    return {
      stato: 'fuori',
      testo: 'non da dichiarare, per accordo',
      spiega: 'Per accordo questo impianto non ci fattura il trattamento e dichiara in proprio: queste tonnellate non sono da dichiarare. Restano registrate qui come storia di quello che è entrato, e a portale non risultano fra le cose da fare.',
    };
  }
  const calcolata = Number(s.giacenza_calcolata_t) || 0;
  const nostre = Number(s.dichiarato_caricato_rete_t) || 0;
  const portale = Number(s.dichiarato_portale_t) || 0;
  if (nostre > 0 && Math.abs(calcolata) <= 0.5 && Math.abs(nostre - portale) <= 0.5) {
    return {
      stato: 'quadra',
      testo: 'quadra: dichiarato tutto, niente in giacenza',
      spiega: 'Il portale non ha una giacenza da confrontare perché non è rimasto niente da dichiarare, e il suo report conferma le stesse tonnellate che risultano a noi.',
    };
  }
  return muto;
}

export function notaDichiaratoPortale(s, fmt) {
  const nostre = Number(s && s.dichiarato_caricato_rete_t) || 0;
  const portale = Number(s && s.dichiarato_portale_t) || 0;
  const differenza = Math.round((nostre - portale) * 1000) / 1000;
  if (differenza > 0) {
    return `nel report del portale risultano ${fmt(portale)} t dichiarate: le altre ${fmt(differenza)} t hanno smaltito carichi dell'anno prima, e il portale le conta lì`;
  }
  return `nel report del portale risultano ${fmt(portale)} t dichiarate, ${fmt(-differenza)} t più di quelle che risultano a noi: controlla se manca una dichiarazione`;
}
