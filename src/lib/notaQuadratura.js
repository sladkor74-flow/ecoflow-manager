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
export function notaDichiaratoPortale(s, fmt) {
  const nostre = Number(s && s.dichiarato_caricato_rete_t) || 0;
  const portale = Number(s && s.dichiarato_portale_t) || 0;
  const differenza = Math.round((nostre - portale) * 1000) / 1000;
  if (differenza > 0) {
    return `nel report del portale risultano ${fmt(portale)} t dichiarate: le altre ${fmt(differenza)} t hanno smaltito carichi dell'anno prima, e il portale le conta lì`;
  }
  return `nel report del portale risultano ${fmt(portale)} t dichiarate, ${fmt(-differenza)} t più di quelle che risultano a noi: controlla se manca una dichiarazione`;
}
