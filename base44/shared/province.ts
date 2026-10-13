// LE PROVINCE PER SIGLA E PER NOME (segnalazione alta A74 del 20/09/2026,
// corretta il 12/10/2026).
//
// Gli archivi dei movimenti e l'anagrafica dei punti di raccolta scrivono la
// provincia con la sigla (BA, NA, CS: lo dice la copia dei dati veri dell'11/10),
// e gli strumenti di EcoTyna la confrontavano alla lettera. Il pianificatore pero'
// ricopia la domanda, e la domanda dice «Bari»: «Bari» contro «BA» non e' uguale,
// il filtro non trovava niente e la risposta era «0 t», senza un avviso. E' lo
// stesso errore dei nomi dei fornitori chiuso il 29/09 (risolviNome): un nome
// scritto come lo dice una persona non deve fare zero.
//
// Qui la sigla si riconosce anche dal nome per esteso e dalle forme che si dicono
// in ufficio («provincia di Bari», «Reggio Calabria», «Barletta»). Quello che non
// si riconosce resta non riconosciuto: chi chiama lo dice, non filtra per un
// valore inventato. Le sigle sono le stesse di PROV_TO_REGION (regioneMap.ts), piu'
// le province nate dopo; lo controlla prove/ecotynaProvince.mjs.

/** Sigla -> nome della provincia, come si scrive. */
export const PROVINCE: Record<string, string> = {
  AG: 'Agrigento', AL: 'Alessandria', AN: 'Ancona', AO: 'Aosta', AP: 'Ascoli Piceno', AQ: "L'Aquila",
  AR: 'Arezzo', AT: 'Asti', AV: 'Avellino', BA: 'Bari', BG: 'Bergamo', BI: 'Biella', BL: 'Belluno',
  BN: 'Benevento', BO: 'Bologna', BR: 'Brindisi', BS: 'Brescia', BT: 'Barletta-Andria-Trani', BZ: 'Bolzano',
  CA: 'Cagliari', CB: 'Campobasso', CE: 'Caserta', CH: 'Chieti', CL: 'Caltanissetta', CN: 'Cuneo',
  CO: 'Como', CR: 'Cremona', CS: 'Cosenza', CT: 'Catania', CZ: 'Catanzaro', EN: 'Enna',
  FC: 'Forlì-Cesena', FE: 'Ferrara', FG: 'Foggia', FI: 'Firenze', FM: 'Fermo', FR: 'Frosinone',
  GE: 'Genova', GO: 'Gorizia', GR: 'Grosseto', IM: 'Imperia', IS: 'Isernia', KR: 'Crotone',
  LC: 'Lecco', LE: 'Lecce', LI: 'Livorno', LO: 'Lodi', LT: 'Latina', LU: 'Lucca',
  MB: 'Monza e Brianza', MC: 'Macerata', ME: 'Messina', MI: 'Milano', MN: 'Mantova', MO: 'Modena',
  MS: 'Massa-Carrara', MT: 'Matera', NA: 'Napoli', NO: 'Novara', NU: 'Nuoro', OR: 'Oristano',
  PA: 'Palermo', PC: 'Piacenza', PD: 'Padova', PE: 'Pescara', PG: 'Perugia', PI: 'Pisa',
  PN: 'Pordenone', PO: 'Prato', PR: 'Parma', PT: 'Pistoia', PU: 'Pesaro e Urbino', PV: 'Pavia',
  PZ: 'Potenza', RA: 'Ravenna', RC: 'Reggio Calabria', RE: 'Reggio Emilia', RG: 'Ragusa', RI: 'Rieti',
  RM: 'Roma', RN: 'Rimini', RO: 'Rovigo', SA: 'Salerno', SI: 'Siena', SO: 'Sondrio',
  SP: 'La Spezia', SR: 'Siracusa', SS: 'Sassari', SU: 'Sud Sardegna', SV: 'Savona', TA: 'Taranto',
  TE: 'Teramo', TN: 'Trento', TO: 'Torino', TP: 'Trapani', TR: 'Terni', TS: 'Trieste',
  TV: 'Treviso', UD: 'Udine', VA: 'Varese', VB: 'Verbano-Cusio-Ossola', VC: 'Vercelli', VE: 'Venezia',
  VI: 'Vicenza', VR: 'Verona', VS: 'Medio Campidano', VT: 'Viterbo', VV: 'Vibo Valentia',
};

// Le altre forme in cui una provincia si dice: i capoluoghi di una provincia con
// due o tre nomi, e i nomi ufficiali lunghi.
const ALTRI_NOMI: Record<string, string> = {
  'reggio di calabria': 'RC', 'reggio nell emilia': 'RE', aquila: 'AQ', spezia: 'SP', 'valle d aosta': 'AO',
  barletta: 'BT', andria: 'BT', trani: 'BT', 'barletta andria trani': 'BT', monza: 'MB', 'monza brianza': 'MB',
  pesaro: 'PU', urbino: 'PU', massa: 'MS', carrara: 'MS', 'massa carrara': 'MS', forli: 'FC', cesena: 'FC',
  'forli cesena': 'FC', verbania: 'VB', vibo: 'VV', ascoli: 'AP', 'bolzano bozen': 'BZ', 'alto adige': 'BZ',
  'sud sardegna': 'SU', 'medio campidano': 'VS',
};

const forma = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()
  .replace(/^(?:la\s+)?(?:provincia|prov)\s+(?:di\s+|della\s+|del\s+|dell\s+)?/, '')
  .trim();

const PER_NOME = (() => {
  const m = new Map();
  for (const [sigla, nome] of Object.entries(PROVINCE)) m.set(forma(nome), sigla);
  for (const [nome, sigla] of Object.entries(ALTRI_NOMI)) m.set(forma(nome), sigla);
  return m;
})();

/**
 * La provincia chiesta: { chiesta, sigla, nome, come }. come e' 'sigla' se era
 * gia' una sigla, 'nome' se si e' riconosciuta dal nome, 'non_riconosciuta'
 * altrimenti (sigla e nome vuoti). Una richiesta vuota da' null.
 */
export function provinciaChiesta(testo) {
  const chiesta = String(testo ?? '').trim();
  if (!chiesta) return null;
  const f = forma(chiesta);
  const siglaScritta = f.toUpperCase();
  if (/^[A-Z]{2}$/.test(siglaScritta) && PROVINCE[siglaScritta]) return { chiesta, sigla: siglaScritta, nome: PROVINCE[siglaScritta], come: 'sigla' };
  const sigla = PER_NOME.get(f) || '';
  return sigla
    ? { chiesta, sigla, nome: PROVINCE[sigla], come: 'nome' }
    : { chiesta, sigla: '', nome: '', come: 'non_riconosciuta' };
}
