// LA PROVINCIA DI ECOTYNA, PER SIGLA E PER NOME (segnalazione alta A74 del
// 20/09/2026, corretta il 12/10/2026).
//
// Gli archivi scrivono la provincia con la sigla (BA) e lo strumento raccolto la
// confrontava alla lettera: «Bari» dava zero tonnellate, senza un avviso. Il
// pianificatore ricopia la domanda, quindi il nome arriva davvero. Si controlla:
//   1. che la sigla si riconosca dal nome e dalle forme dette in ufficio, e che
//      una forma ambigua o sbagliata resti non riconosciuta;
//   2. che le sigle siano almeno quelle della mappa delle regioni;
//   3. che il raccolto filtri per «Bari» come per «BA», che una provincia non
//      riconosciuta non faccia zero (numero non calcolabile) e che un filtro che
//      non trova niente lo dica, distinguendo la provincia vuota dalla
//      combinazione con gli altri filtri;
//   4. lo stesso nell'anagrafica dei punti di raccolta.
// npm run prove
import { provinciaChiesta, PROVINCE } from '../base44/shared/province.ts';
import { PROV_TO_REGION } from '../base44/shared/regioneMap.ts';
import { STRUMENTI } from '../base44/shared/strumentiAssistente.ts';
import { SCHEMA_PIANO } from '../base44/shared/pianoAssistente.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (v) => String(JSON.stringify(v)).slice(0, 500);

console.log('1. LA SIGLA DAL NOME');
{
  const sigla = (t) => (provinciaChiesta(t) || {}).sigla;
  const casi = [
    ['BA', 'BA'], ['ba', 'BA'], [' Ba ', 'BA'], ['Bari', 'BA'], ['BARI', 'BA'], ['provincia di Bari', 'BA'], ['Prov. BA', 'BA'],
    ['Reggio Calabria', 'RC'], ['Reggio di Calabria', 'RC'], ['Reggio Emilia', 'RE'], ["L'Aquila", 'AQ'], ['La Spezia', 'SP'],
    ['Forlì-Cesena', 'FC'], ['forli', 'FC'], ['Barletta', 'BT'], ['Barletta-Andria-Trani', 'BT'], ['Monza e Brianza', 'MB'],
    ['Vibo Valentia', 'VV'], ['Sud Sardegna', 'SU'], ['Napoli', 'NA'], ['Cosenza', 'CS'],
  ];
  for (const [chiesta, attesa] of casi) verifica(`«${chiesta}» e' ${attesa}`, sigla(chiesta) === attesa, J(provinciaChiesta(chiesta)));
  const bari = provinciaChiesta('Bari');
  verifica('dal nome: come = nome, col nome giusto', bari.come === 'nome' && bari.nome === 'Bari' && bari.chiesta === 'Bari');
  verifica('dalla sigla: come = sigla', provinciaChiesta('ba').come === 'sigla');
  for (const t of ['Reggio', 'Barri', 'XX', 'Bari e Taranto', 'Puglia']) {
    const p = provinciaChiesta(t);
    verifica(`«${t}» non si riconosce, e non diventa una sigla inventata`, p && p.come === 'non_riconosciuta' && p.sigla === '' && p.chiesta === t, J(p));
  }
  verifica('una richiesta vuota non e\' un filtro', provinciaChiesta('') === null && provinciaChiesta(undefined) === null && provinciaChiesta('  ') === null);
}

console.log('2. LE SIGLE');
{
  const mancanti = Object.keys(PROV_TO_REGION).filter(s => !PROVINCE[s]);
  verifica('ogni sigla della mappa delle regioni ha il suo nome', !mancanti.length, J(mancanti));
  verifica('tutte le sigle sono di due lettere maiuscole', Object.keys(PROVINCE).every(s => /^[A-Z]{2}$/.test(s)));
  const prov = SCHEMA_PIANO.properties.strumenti.items.properties.parametri.properties.provincia;
  verifica('il pianificatore sa che vale anche il nome', prov && /se la domanda dice il nome \(Bari\) va bene anche il nome/.test(prov.description || ''), J(prov));
  const racc = STRUMENTI.find(s => s.nome === 'raccolto');
  verifica('e lo dice anche il catalogo dello strumento', /sigla \(BA\) o nome per esteso \(Bari\)/.test(racc.parametri.provincia));
}

// Un archivio finto: filter per stato, list per tutto.
const finto = (archivi) => ({
  asServiceRole: {
    entities: new Proxy({}, {
      get: (_t, entita) => ({
        filter: async (f) => (archivi[String(entita)] || []).filter(r => !f || !f.stato || r.stato === f.stato),
        list: async () => (archivi[String(entita)] || []),
      }),
    }),
  },
});
let n = 0;
const term = (provincia, kg, giorno) => {
  const id = ++n;
  return {
    id: 'r' + id, id_ordine: 'ET' + id, numero_fir: 'FIR' + id, stato: 'terminato', trasportatore: 'EMMESSE SRL', destinazione: 'GATIM',
    provincia, classe: 'P', peso_effettivo: kg,
    ordine_immesso_il: giorno + 'T08:00:00Z', trasporto_iniziato_il: giorno + 'T08:00:00Z', trasporto_finito_il: giorno + 'T10:00:00Z',
  };
};
const RETE = [term('BA', 4000, '2026-08-05'), term('BA', 3500, '2026-08-20'), term('BA', 2000, '2026-09-02'), term('NA', 5000, '2026-08-10'), term('NA', 1000, '2026-08-11')];
const raccolto = async (p) => (await STRUMENTI.find(s => s.nome === 'raccolto').esegui(finto({ PrimariaRete: RETE }), { canale: 'RETE', anno: 2026, ...p }, null)).dati;

console.log('3. IL RACCOLTO PER PROVINCIA');
{
  const sigla = await raccolto({ provincia: 'BA' });
  verifica('con la sigla: 9,5 t in tre formulari', sigla.tonnellate === 9.5 && sigla.formulari === 3, J(sigla));
  const nome = await raccolto({ provincia: 'Bari' });
  verifica('«Bari» trova le stesse righe di «BA», non zero', nome.tonnellate === 9.5 && nome.formulari === 3, J({ tonnellate: nome.tonnellate, formulari: nome.formulari }));
  verifica('...e dice come ha letto la provincia', nome.provincia_riconosciuta === 'provincia di Bari (BA), scritta "Bari"', J(nome.provincia_riconosciuta));
  verifica('...senza avvisi: ha trovato', !nome.avviso_provincia && !nome.numero_non_calcolabile);
  const agosto = await raccolto({ provincia: 'provincia di Bari', mese: 'Agosto' });
  verifica('con il mese: 7,5 t ad agosto', agosto.tonnellate === 7.5 && agosto.formulari === 2, J({ t: agosto.tonnellate }));

  const ignota = await raccolto({ provincia: 'Barri' });
  verifica('una provincia che non si riconosce non fa zero: numero non calcolabile', ignota.tonnellate === null && ignota.formulari === null && !!ignota.numero_non_calcolabile, J(ignota));
  verifica('...e lo dice, con l\'esempio giusto', /"Barri" non e' una provincia che riconosco: scrivi la sigla \(per esempio BA\) o il nome per esteso \(Bari\)/.test(ignota.avviso_provincia || ''), J(ignota.avviso_provincia));
  verifica('...senza un dettaglio che sembra un elenco vuoto vero', ignota.dettaglio && ignota.dettaglio.quanti === 0);

  const vuota = await raccolto({ provincia: 'Lecce' });
  verifica('una provincia senza formulari: lo zero e\' vero, ma si dice', vuota.tonnellate === 0 && /Nel canale RETE non c'e' nessun formulario terminato della provincia di Lecce \(LE\) in tutto il 2026/.test(vuota.avviso_provincia || ''), J(vuota));
  const marzo = await raccolto({ provincia: 'Bari', mese: 'Marzo' });
  verifica('la provincia ne ha, ma non nel periodo: si dice che e\' la combinazione', marzo.tonnellate === 0
    && /Con la provincia di Bari \(BA\) il filtro non trova nessun formulario terminato del canale RETE: nel 2026 la provincia ne ha 3, ma nessuno con il periodo \(Marzo\)/.test(marzo.avviso_provincia || ''), J(marzo.avviso_provincia));
  const altro = await raccolto({ provincia: 'NA', raccoglitore: 'Emmesse', mese: 'Settembre' });
  verifica('...anche col raccoglitore', /nessuno con il periodo \(Settembre\), il raccoglitore "Emmesse"/.test(altro.avviso_provincia || ''), J(altro.avviso_provincia));
  // Una provincia non riconosciuta non deve prendere le righe senza provincia.
  const senza = await (async () => (await STRUMENTI.find(s => s.nome === 'raccolto').esegui(finto({ PrimariaRete: [...RETE, term('', 9000, '2026-08-01')] }), { canale: 'RETE', anno: 2026, provincia: 'Xyz' }, null)).dati)();
  verifica('una provincia ignota non prende le righe senza provincia', senza.tonnellate === null && senza.dettaglio.quanti === 0, J(senza));
  const tutte = await raccolto({});
  verifica('senza provincia nessun avviso e il totale di tutte', tutte.tonnellate === 15.5 && !tutte.avviso_provincia && !tutte.provincia_riconosciuta, J({ t: tutte.tonnellate }));

  // Revisione del 13/10/2026: l'avviso parla di formulari, e «ne ha N» contava le
  // righe. Un formulario ripartito su due ordini e' due righe e un formulario
  // solo: sui dati veri l'ACI di Salerno 2026 diceva 8, lo strumento ne conta 6.
  const ripartito = [term('TA', 3000, '2026-08-05'), { ...term('TA', 1000, '2026-08-05'), numero_fir: 'FIR-TA-1' }, { ...term('TA', 500, '2026-08-05'), numero_fir: 'FIR-TA-1' }];
  const conRipartito = async (p) => (await STRUMENTI.find(s => s.nome === 'raccolto').esegui(finto({ PrimariaRete: ripartito }), { canale: 'RETE', anno: 2026, ...p }, null)).dati;
  const anno = await conRipartito({ provincia: 'Taranto' });
  const dicembre = await conRipartito({ provincia: 'Taranto', mese: 'Dicembre' });
  verifica('il formulario ripartito su due ordini conta uno: due formulari nell\'anno', anno.formulari === 2, J({ formulari: anno.formulari }));
  verifica('l\'avviso dice i formulari, come lo strumento: «ne ha 2», non le 3 righe', /nel 2026 la provincia ne ha 2, ma nessuno con il periodo \(Dicembre\)/.test(dicembre.avviso_provincia || ''), J(dicembre.avviso_provincia));
}

console.log('4. L\'ANAGRAFICA DEI PUNTI DI RACCOLTA');
{
  const PDR = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: 'b' + i, ragione_sociale: `GOMMISTA ${i}`, provincia_pdr: 'BA' })),
    { id: 'n1', ragione_sociale: 'RICAMBI', provincia: 'NA' },
  ];
  const pdr = async (p) => (await STRUMENTI.find(s => s.nome === 'punti_di_raccolta').esegui(finto({ Pdr: PDR }), p)).dati;
  const bari = await pdr({ provincia: 'Bari' });
  verifica('«Bari» trova i cinque punti di raccolta di BA', bari.pdr.quanti === 5 && /provincia di Bari \(BA\)/.test(bari.provincia_riconosciuta || ''), J(bari));
  const ignota = await pdr({ provincia: 'Barri' });
  verifica('una provincia ignota lo dice e non dice quanti', ignota.pdr.quanti === 0 && /non e' una provincia che riconosco/.test(ignota.avviso_provincia || '') && !!ignota.numero_non_calcolabile, J(ignota));
  const vuota = await pdr({ provincia: 'Lecce', cerca: 'gommista' });
  verifica('una provincia senza punti di raccolta lo dice', vuota.pdr.quanti === 0 && /nessun punto di raccolta della provincia di Lecce \(LE\) che corrisponda a "gommista"/.test(vuota.avviso_provincia || ''), J(vuota));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
