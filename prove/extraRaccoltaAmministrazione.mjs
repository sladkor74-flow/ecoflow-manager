// L'EXTRA RACCOLTA NEL «FORMAT AMMINISTRAZIONE»
// (src/lib/extraRaccoltaAmministrazione.js).
//
// Richiesta dell'utente, 03/10/2026: «nella fatturazione passiva tutto cio' che
// riguarda l'extra raccolta deve rientrare solo quando in quel determinato mese
// effettivamente sono stati chiusi quei movimenti e le info vanno riprese dal
// modulo 'extra raccolta', compresi i prezzi (raccolta, trattamento, eventuali
// sovraccosti, ecc...)».
//
// Le due cose che questa prova tiene ferme:
//   1. ENTRA SOLO QUELLO CHE E' CHIUSO IN QUEL MESE. Terminato, e fine trasporto
//      in quel mese col giorno italiano - la prima regola assoluta del
//      gestionale. Un assegnato non entra, un terminato di un altro mese non
//      entra, e un terminato senza fine trasporto non sta in nessun mese: si
//      dichiara, non si indovina.
//   2. IL COSTO E' QUELLO DEL MODULO, al centesimo: lo stesso numero che si legge
//      nella pagina dell'extra raccolta, perche' esce dalla stessa funzione.
// npm run prove
import { caricaLibPagine } from './dati/libPagine.mjs';

const { bloccoExtraRaccolta, interventiDelMese, prefissoMese, produttoreDi } = await caricaLibPagine('lib/extraRaccoltaAmministrazione');
// Questo si importa diretto: i suoi import sono relativi e con l'estensione,
// fatti per essere letti anche da node.
const { calcExtraRaccolta } = await import('../src/lib/extraRaccoltaCalc.js');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Un intervento come lo scrive il modulo: le date sono istanti UTC della
// mezzanotte italiana, come arrivano dagli archivi.
const intervento = (o) => ({
  stato: 'terminato',
  tipo_movimento: 'primaria',
  numero_fir: 'FIR001',
  id_ordine: 'ET26000001',
  produttore: 'COMUNE DI ESEMPIO',
  trasportatore: 'LOGISTICA & PNEUMATICI SRL',
  destinazione: 'Irigom S.r.l.',
  cer: '160103',
  trasporto_iniziato_il: '2026-09-09T22:00:00Z',
  trasporto_finito_il: '2026-09-10T22:00:00Z',
  peso_effettivo: 12400,
  costo_raccolta_t: 90,
  costo_stoccaggio_t: 0,
  costo_trattamento_t: 100,
  costo_pulizia: 0,
  costi_aggiuntivi: 0,
  ...o,
});

console.log('IL MESE SI DECIDE DALLA FINE TRASPORTO');
{
  verifica('il prefisso del mese e aaaa-mm', prefissoMese(2026, 'Settembre') === '2026-09', prefissoMese(2026, 'Settembre'));
  verifica('e un mese scritto in minuscolo va bene uguale', prefissoMese(2026, 'settembre') === '2026-09');
  const interventi = [
    intervento({ numero_fir: 'DENTRO' }),
    // Mezzanotte italiana del primo ottobre: a Greenwich e' ancora il 30
    // settembre alle 22. Col fuso sbagliato questo finirebbe in settembre.
    intervento({ numero_fir: 'OTTOBRE', trasporto_finito_il: '2026-09-30T22:00:00Z' }),
    // L'ultimo giorno di settembre, mezzanotte italiana: e' di settembre.
    intervento({ numero_fir: 'ULTIMO', trasporto_finito_il: '2026-09-29T22:00:00Z' }),
    intervento({ numero_fir: 'ASSEGNATO', stato: 'assegnato' }),
    intervento({ numero_fir: 'SENZADATA', trasporto_finito_il: null }),
  ];
  const { dentro, senza_data } = interventiDelMese(interventi, 2026, 'Settembre');
  verifica('entrano solo i terminati del mese', dentro.map(r => r.numero_fir).join() === 'DENTRO,ULTIMO',
    dentro.map(r => r.numero_fir).join());
  verifica('l assegnato resta fuori', !dentro.some(r => r.numero_fir === 'ASSEGNATO'));
  verifica('e il terminato senza fine trasporto si dichiara', senza_data.length === 1 && senza_data[0].numero_fir === 'SENZADATA',
    JSON.stringify(senza_data.map(r => r.numero_fir)));
  // L'ordine e' quello del giorno italiano: 'DENTRO' e' chiuso l'11 settembre
  // (le 22 UTC del 10 sono mezzanotte in Italia), 'ULTIMO' il 30.
  verifica('gli interventi sono in ordine di fine trasporto', dentro[0].numero_fir === 'DENTRO' && dentro[1].numero_fir === 'ULTIMO');
}

console.log('IL COSTO E QUELLO CHE DICE IL MODULO');
{
  const r = intervento({ peso_effettivo: 12400, costo_raccolta_t: 90, costo_stoccaggio_t: 10, costo_trattamento_t: 100, costo_pulizia: 150, costi_aggiuntivi: 50 });
  const b = bloccoExtraRaccolta([r], 2026, 'Settembre');
  const atteso = calcExtraRaccolta(r).costo_totale;
  // 12,4 t per (90+10+100) e' 2.480, piu' 200 di oneri fissi: 2.680.
  verifica('il totale della riga e quello del modulo', b.righe[0].totale === atteso && atteso === 2680,
    JSON.stringify([b.righe[0].totale, atteso]));
  verifica('gli oneri fissi sono pulizia piu costi aggiuntivi', b.righe[0].oneri === 200, String(b.righe[0].oneri));
  verifica('i tre prezzi si vedono uno per uno',
    b.righe[0].raccolta_t === 90 && b.righe[0].stoccaggio_t === 10 && b.righe[0].trattamento_t === 100);
  verifica('il peso c e in chili e in tonnellate', b.righe[0].kg === 12400 && b.righe[0].tonnellate === 12.4,
    JSON.stringify([b.righe[0].kg, b.righe[0].tonnellate]));
  verifica('e il totale del blocco somma le righe', b.totale_euro === 2680 && b.totale_t === 12.4 && b.totale_kg === 12400,
    JSON.stringify([b.totale_euro, b.totale_t, b.totale_kg]));
}
{
  // I TRE SOVRACOSTO NON SONO UN COSTO: si aggiungono a quello che si fattura a
  // Ecotyre, non a quello che si paga. Se finissero qui, la passiva pagherebbe
  // un ricavo.
  const r = intervento({ sovracosto_raccolta: 300, sovracosto_trasporto: 200, sovracosto_trattamento: 100 });
  const b = bloccoExtraRaccolta([r], 2026, 'Settembre');
  const soloCosti = Math.round(12.4 * (90 + 100) * 100) / 100;
  verifica('i sovracosti attivi non entrano nel costo', b.righe[0].totale === soloCosti, JSON.stringify([b.righe[0].totale, soloCosti]));
}

console.log('IL TRASPORTO SI PAGA A VIAGGIO');
{
  // Campo nato il 03/10/2026: nel foglio dell'amministrazione la colonna «PREZZO
  // (Euro/viaggio)» c'era e nel gestionale non c'era niente da scriverci, quindi
  // il trasporto di un intervento non si pagava a nessuno.
  const r = intervento({ peso_effettivo: 12400, costo_raccolta_t: 90, costo_trattamento_t: 100, costo_trasporto_viaggio: 400 });
  const b = bloccoExtraRaccolta([r], 2026, 'Settembre');
  verifica('il trasporto si vede nella sua colonna', b.righe[0].trasporto_viaggio === 400, String(b.righe[0].trasporto_viaggio));
  // 12,4 t per 190 fa 2.356, piu' 400 di viaggio: 2.756. NON si moltiplica per
  // il peso, altrimenti un viaggio da 400 euro ne costerebbe 4.960.
  verifica('entra nel totale com e, non a tonnellata', b.righe[0].totale === 2756, String(b.righe[0].totale));
  verifica('e il totale resta quello del modulo', b.righe[0].totale === calcExtraRaccolta(r).costo_totale);
}
{
  // Una secondaria di extra raccolta non ha costo di raccolta: prima del campo
  // nuovo al trasportatore non si pagava niente del tutto.
  const r = intervento({ tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD SRL', costo_raccolta_t: 0, costo_trattamento_t: 0, costo_stoccaggio_t: 0, costo_trasporto_viaggio: 350 });
  const b = bloccoExtraRaccolta([r], 2026, 'Settembre');
  verifica('una secondaria col solo trasporto si paga', b.righe[0].totale === 350, String(b.righe[0].totale));
  verifica('e non e piu un intervento senza costi', b.senza_costi.length === 0, JSON.stringify(b.senza_costi));
}

console.log('QUELLO CHE VA SISTEMATO SI DICE');
{
  const b = bloccoExtraRaccolta([
    intervento({ numero_fir: 'GRATIS', costo_raccolta_t: 0, costo_stoccaggio_t: 0, costo_trattamento_t: 0, costo_pulizia: 0, costi_aggiuntivi: 0 }),
    intervento({ numero_fir: 'PAGATO' }),
  ], 2026, 'Settembre');
  verifica('un intervento chiuso senza costi si segnala', b.senza_costi.length === 1 && b.senza_costi[0].numero_fir === 'GRATIS',
    JSON.stringify(b.senza_costi.map(x => x.numero_fir)));
  verifica('ma resta nel foglio coi suoi chili', b.righe.length === 2 && b.righe.some(x => x.numero_fir === 'GRATIS' && x.kg === 12400));
  verifica('e non si inventa un prezzo', b.righe.find(x => x.numero_fir === 'GRATIS').totale === 0);
}

console.log('CHI E IL PRODUTTORE');
{
  // In una primaria e' chi conferisce; in una secondaria e' lo stoccaggio da cui
  // il carico parte, non il raccoglitore.
  verifica('nella primaria e il produttore', produttoreDi({ produttore: 'COMUNE DI ESEMPIO' }) === 'COMUNE DI ESEMPIO');
  verifica('nella secondaria e lo stoccaggio di partenza',
    produttoreDi({ tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD SRL', produttore: 'COMUNE DI ESEMPIO' }) === 'NAPPI SUD SRL');
  verifica('e se il produttore non c e si usa il punto di raccolta',
    produttoreDi({ ragione_sociale: '', punto_di_raccolta: 'PDR 123' }) === 'PDR 123');
  const b = bloccoExtraRaccolta([intervento({ tipo_movimento: 'secondaria', stoccaggio: 'NAPPI SUD SRL' })], 2026, 'Settembre');
  verifica('e la riga si sa che e una secondaria', b.righe[0].secondaria === true && b.righe[0].produttore === 'NAPPI SUD SRL');
}

console.log('SENZA NIENTE NON SI ROMPE NIENTE');
{
  const b = bloccoExtraRaccolta(null, 2026, 'Settembre');
  verifica('senza interventi il blocco e vuoto', b.righe.length === 0 && b.totale_euro === 0 && b.senza_costi.length === 0);
  const c = bloccoExtraRaccolta([intervento({})], 2026, '');
  verifica('e senza mese non si prende niente a caso', c.righe.length === 0, String(c.righe.length));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
