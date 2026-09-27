// Le regole della predittivita' delle secondarie, anno per anno.
//
// Ogni anno la predittivita' riparte dall'ancora delle giacenze al 31/12
// dell'anno prima e segue le logiche del contratto di quell'anno (utente,
// 26/09/2026): al 31 dicembre l'anno si chiude, resta consultabile in sola
// lettura, e il nuovo comincia con le sue regole. Qui ci sono quelle che non
// stanno negli input di Target & Status; un anno nuovo si aggiunge quando
// l'utente porta il contratto.
//
// - kg_per_viaggio: quanto vale un viaggio di secondaria per i conti. Per il
//   2026 13 t (utente, 26/09/2026): la media dei formulari e' piu' bassa perche'
//   un viaggio porta spesso piu' formulari divisi per classe, e 13 t e' la stima
//   prudente di un camion.
// - priorita: quando uno stoccaggio alimenta piu' impianti, in che ordine. Non
//   vuol dire "prima uno, poi l'altro": ogni settimana lo stoccaggio serve tutti,
//   e la priorita' decide solo come si dividono i viaggi. Al primo va il numero
//   di viaggi che gli fa raggiungere il target entro la fine della
//   programmazione, agli altri quello che resta (utente, 26/09/2026: Nappi Sud
//   prima Tecnogum, poi Irigom). Una priorita' scritta nella configurazione
//   (FornitoreSecondaria.priorita) vale piu' di questa.
// - settimane_ritmo: su quante settimane si misura il ritmo reale di un flusso.
//
// La fine della programmazione sta in fineProgrammazione.ts.

const PREDEFINITE = { kg_per_viaggio: 13000, settimane_ritmo: 12, priorita: {} };

const PER_ANNO = {
  2026: {
    kg_per_viaggio: 13000,
    priorita: { 'nappi sud': ['tecnogum', 'irigom'] },
  },
};

/** Le regole dell'anno, con quelle predefinite dove l'anno non dice niente, e se l'anno e' stato definito. */
export function regolePredittivita(anno) {
  const a = PER_ANNO[Number(anno)] || null;
  return { ...PREDEFINITE, ...(a || {}), definite: !!a, anno: Number(anno) };
}
