// SUPERATA il 20/09/2026 (audit generale, B5). Non e' piu' chiamata da nessuna
// pagina: la usava la pagina Terziarie per una "giacenza in tempo reale" fatta di
// ingressi meno uscite. Era un secondo motore di giacenza, con regole sue:
// sommava rete e ACI nello stesso totale, non filtrava lo stato dei movimenti e
// toglieva alle tonnellate di PFU entrate le uscite di PRODOTTI (granulo, ferro).
// Due schermate dicevano due giacenze per lo stesso impianto.
//
// Il motore delle giacenze e' uno solo: calcolaGiacenze, che parte dal saldo del
// portale. La funzione resta qui, spenta, perche' chi la cercasse trovi il motivo.
export default async function() {
  return Response.json({
    error: 'Funzione superata: la giacenza si legge da calcolaGiacenze (modulo Giacenze).',
    superata: true, usa: 'calcolaGiacenze',
  }, { status: 410 });
}
