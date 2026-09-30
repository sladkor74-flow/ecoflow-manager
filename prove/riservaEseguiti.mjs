// La riserva degli ordini in stato "eseguito" negli strumenti di EcoTyna.
//
// A portale un ordine "eseguito" ha tutti i dati inseriti ma nessuno ha premuto
// Chiudi. Il gestionale conta i terminati, quindi quell'ordine abbassava il
// totale in silenzio: e' accaduto il 24/09/2026, 3,62 t di differenza su un
// ordine solo. Adesso si dice a parte, e queste prove guardano le due cose che
// non devono succedere mai: che la riserva finisca nel totale, e che il totale
// sia piu' basso del vero senza che nessuno lo dica.
//
// npm run prove
const R = new URL('../base44/shared/', import.meta.url).href;
const { STRUMENTI } = await import(R + 'strumentiAssistente.ts');
const { nuovaCache } = await import(R + 'cacheLetture.ts');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const strumento = (nome) => STRUMENTI.find(s => s.nome === nome);

// Un archivio finto: filter(filtro) restituisce le righe di quello stato. Si
// registra ogni lettura, cosi' si vede quante ne costa una domanda, e si puo'
// far fallire una lettura sola per provare il guasto.
let letture = [];
const finto = (archivi, guasti = []) => ({
  asServiceRole: {
    entities: new Proxy({}, {
      get: (t, entita) => (entita in t ? t[entita] : {
        filter: async (filtro) => {
          const stato = (filtro && filtro.stato) || '';
          const etichetta = `${String(entita)}|${stato}`;
          letture.push(etichetta);
          if (guasti.includes(etichetta)) throw new Error('rate limit exceeded');
          return (archivi[entita] || []).filter(r => !stato || r.stato === stato);
        },
        list: async () => (archivi[String(entita)] || []),
      }),
    }),
  },
});

let n = 0;
const riga = (stato, trasportatore, kg, giorno, extra = {}) => {
  const id = ++n;
  return {
    id: 'r' + id, id_ordine: extra.id_ordine || 'ET' + id, numero_fir: extra.numero_fir || 'FIR' + id,
    stato, trasportatore, destinazione: 'GATIM', provincia: 'CE', classe: 'P',
    peso_effettivo: kg,
    ordine_immesso_il: giorno ? giorno + 'T08:00:00Z' : '',
    trasporto_iniziato_il: giorno ? giorno + 'T08:00:00Z' : '',
    trasporto_finito_il: giorno ? giorno + 'T10:00:00Z' : '',
    ...extra,
  };
};
const term = (trasportatore, kg, giorno, extra) => riga('terminato', trasportatore, kg, giorno, extra);
const eseg = (trasportatore, kg, giorno, extra) => riga('eseguito', trasportatore, kg, giorno, extra);

const raccolto = async (archivi, p, { guasti = [], ctx = null } = {}) => {
  letture = [];
  return (await strumento('raccolto').esegui(finto(archivi, guasti), p, ctx)).dati;
};

console.log('SENZA ORDINI NEL LIMBO NON SI DICE NIENTE');
{
  const d = await raccolto({ PrimariaRete: [term('EMMESSE', 10000, '2026-08-10')] }, { canale: 'RETE', anno: 2026, mese: 'agosto' });
  verifica('il totale e quello dei terminati', d.tonnellate === 10, 't=' + d.tonnellate);
  verifica('nessuna riserva', d.riserva_eseguiti === undefined);
}

console.log('UN ORDINE ESEGUITO SI DICE E NON SI SOMMA');
{
  const archivi = {
    PrimariaRete: [
      term('EMMESSE', 10000, '2026-08-10'),
      eseg('EMMESSE', 3620, '2026-08-18', { id_ordine: 'ET26152600' }),
    ],
  };
  const d = await raccolto(archivi, { canale: 'RETE', anno: 2026, mese: 'agosto' });
  verifica('il totale resta quello dei terminati', d.tonnellate === 10, 't=' + d.tonnellate);
  verifica('la riserva c e', !!d.riserva_eseguiti);
  verifica('un ordine in riserva', d.riserva_eseguiti.ordini === 1, JSON.stringify(d.riserva_eseguiti));
  verifica('con le sue tonnellate', d.riserva_eseguiti.tonnellate === 3.62, 't=' + d.riserva_eseguiti.tonnellate);
  verifica('un formulario', d.riserva_eseguiti.formulari === 1);
  verifica("l'ID dell'ordine si dice, cosi si sa quale chiudere", d.riserva_eseguiti.esempi[0].id_ordine === 'ET26152600', JSON.stringify(d.riserva_eseguiti.esempi));
  verifica('e la nota dice di non sommarla', /NON sommarli al totale/.test(d.riserva_eseguiti.nota));
  // La somma dei due sarebbe 13,62: il numero che non deve comparire da nessuna parte.
  verifica('nessun campo porta la somma dei due', !JSON.stringify(d).includes('13.62'));
}

console.log('LO STESSO ORDINE SU DUE RIGHE E UN ORDINE SOLO');
{
  const archivi = {
    PrimariaRete: [
      eseg('EMMESSE', 2000, '2026-08-18', { id_ordine: 'ET900', numero_fir: 'FIRX' }),
      eseg('EMMESSE', 1620, '2026-08-18', { id_ordine: 'ET900', numero_fir: 'FIRX' }),
    ],
  };
  const d = await raccolto(archivi, { canale: 'RETE', anno: 2026, mese: 'agosto' });
  verifica('un ordine, non due', d.riserva_eseguiti.ordini === 1, JSON.stringify(d.riserva_eseguiti));
  verifica('un formulario, non due', d.riserva_eseguiti.formulari === 1);
  verifica('i pesi invece si sommano', d.riserva_eseguiti.tonnellate === 3.62, 't=' + d.riserva_eseguiti.tonnellate);
}

console.log('LA RISERVA SEGUE IL PERIODO CHIESTO');
{
  const archivi = {
    PrimariaRete: [
      term('EMMESSE', 10000, '2026-08-10'),
      eseg('EMMESSE', 3620, '2026-08-18'),
      eseg('EMMESSE', 5000, '2026-03-04'),
      eseg('EMMESSE', 7000, '2025-08-18'),
    ],
  };
  const agosto = await raccolto(archivi, { canale: 'RETE', anno: 2026, mese: 'agosto' });
  verifica('solo l eseguito di agosto 2026', agosto.riserva_eseguiti.ordini === 1 && agosto.riserva_eseguiti.tonnellate === 3.62, JSON.stringify(agosto.riserva_eseguiti));
  const anno = await raccolto(archivi, { canale: 'RETE', anno: 2026 });
  verifica('su tutto l anno i due del 2026', anno.riserva_eseguiti.ordini === 2 && anno.riserva_eseguiti.tonnellate === 8.62, JSON.stringify(anno.riserva_eseguiti));
  const marzoAprile = await raccolto(archivi, { canale: 'RETE', anno: 2026, mese: 'da marzo a maggio' });
  verifica('un intervallo prende quello di marzo', marzoAprile.riserva_eseguiti.tonnellate === 5, JSON.stringify(marzoAprile.riserva_eseguiti));
}

console.log('UN ESEGUITO SENZA FINE TRASPORTO NON STA IN NESSUN MESE: SI DICE A PARTE');
{
  const archivi = {
    PrimariaRete: [
      term('EMMESSE', 10000, '2026-08-10'),
      eseg('EMMESSE', 4000, ''),
    ],
  };
  const d = await raccolto(archivi, { canale: 'RETE', anno: 2026, mese: 'agosto' });
  verifica('non e fra quelli del periodo', d.riserva_eseguiti.ordini === undefined, JSON.stringify(d.riserva_eseguiti));
  verifica('sta nella voce sua', d.riserva_eseguiti.senza_fine_trasporto.ordini === 1 && d.riserva_eseguiti.senza_fine_trasporto.tonnellate === 4, JSON.stringify(d.riserva_eseguiti));
  verifica('e il totale non lo tocca', d.tonnellate === 10);
}

console.log('LA RISERVA E DI CHI SI CHIEDE, NON DI TUTTA LA RETE');
{
  const archivi = {
    PrimariaRete: [
      term('EMMESSE', 10000, '2026-08-10'),
      term('NAPPI SUD', 20000, '2026-08-11'),
      eseg('EMMESSE', 3620, '2026-08-18'),
      eseg('NAPPI SUD', 9000, '2026-08-19'),
    ],
  };
  const d = await raccolto(archivi, { canale: 'RETE', anno: 2026, mese: 'agosto', raccoglitore: 'Emmesse' });
  verifica('il totale e solo suo', d.tonnellate === 10, 't=' + d.tonnellate);
  verifica('e la riserva anche', d.riserva_eseguiti.tonnellate === 3.62, JSON.stringify(d.riserva_eseguiti));
  const prov = await raccolto({ PrimariaRete: [...archivi.PrimariaRete, eseg('ALTRO', 1000, '2026-08-20', { provincia: 'NA' })] }, { canale: 'RETE', anno: 2026, mese: 'agosto', provincia: 'CE' });
  verifica('la provincia filtra anche la riserva', prov.riserva_eseguiti.tonnellate === 12.62, JSON.stringify(prov.riserva_eseguiti));
}

console.log('UN RACCOGLITORE CHE HA SOLO ORDINI NEL LIMBO ESISTE');
{
  const archivi = {
    PrimariaRete: [
      term('NAPPI SUD', 20000, '2026-08-11'),
      eseg('SILVANO RENATO', 3620, '2026-08-18'),
    ],
  };
  const d = await raccolto(archivi, { canale: 'RETE', anno: 2026, mese: 'agosto', raccoglitore: 'Silvano' });
  verifica('non si dice che non risulta', d.avviso_soggetto === undefined, JSON.stringify(d.avviso_soggetto));
  verifica('il nome e riconosciuto', /SILVANO RENATO/.test(d.soggetto_riconosciuto || ''), d.soggetto_riconosciuto);
  verifica('terminati zero', d.tonnellate === 0, 't=' + d.tonnellate);
  verifica('ma la riserva dice quanto e', d.riserva_eseguiti.tonnellate === 3.62, JSON.stringify(d.riserva_eseguiti));
}

console.log('UN NOME CHE NON C E RESTA NON CALCOLABILE, E SENZA RISERVA');
{
  const archivi = { PrimariaRete: [term('NAPPI SUD', 20000, '2026-08-11'), eseg('EMMESSE', 3620, '2026-08-18')] };
  const d = await raccolto(archivi, { canale: 'RETE', anno: 2026, mese: 'agosto', raccoglitore: 'Pinco Pallo' });
  verifica('nessun numero', d.tonnellate === null && d.formulari === null);
  verifica('l avviso c e', !!d.avviso_soggetto);
  verifica('e nessuna riserva di altri', d.riserva_eseguiti === undefined, JSON.stringify(d.riserva_eseguiti));
}

console.log('SE LA LETTURA DEGLI ESEGUITI FALLISCE, IL TOTALE SI DICE E IL DUBBIO ANCHE');
{
  const archivi = { PrimariaRete: [term('EMMESSE', 10000, '2026-08-10'), eseg('EMMESSE', 3620, '2026-08-18')] };
  const d = await raccolto(archivi, { canale: 'RETE', anno: 2026, mese: 'agosto' }, { guasti: ['PrimariaRete|eseguito'] });
  verifica('il raccolto si dice comunque', d.tonnellate === 10, 't=' + d.tonnellate);
  verifica('la riserva si dichiara non letta', !!d.riserva_eseguiti.lettura_non_riuscita, JSON.stringify(d.riserva_eseguiti));
  verifica('e si dice che il totale puo essere piu basso', /piu\' basso del vero/.test(d.riserva_eseguiti.lettura_non_riuscita));
  verifica('nessun numero inventato per la riserva', d.riserva_eseguiti.tonnellate === undefined);
}

console.log('SE FALLISCE LA LETTURA DEI TERMINATI, LO STRUMENTO FALLISCE');
{
  // Il raccolto sono i terminati: senza di loro non c'e' risposta, e un errore
  // vero e' meglio di un numero sbagliato.
  let esploso = false;
  try {
    await raccolto({ PrimariaRete: [term('EMMESSE', 10000, '2026-08-10')] }, { canale: 'RETE', anno: 2026 }, { guasti: ['PrimariaRete|terminato'] });
  } catch (_e) { esploso = true; }
  verifica('non si finge un raccolto di zero', esploso);
}

console.log('I CANALI RESTANO SEPARATI');
{
  const archivi = {
    PrimariaRete: [term('EMMESSE', 10000, '2026-08-10'), eseg('EMMESSE', 3620, '2026-08-18')],
    PrimariaAci: [term('TECNOGUM', 5000, '2026-08-12'), eseg('TECNOGUM', 1000, '2026-08-20')],
  };
  const rete = await raccolto(archivi, { canale: 'RETE', anno: 2026, mese: 'agosto' });
  const aci = await raccolto(archivi, { canale: 'ACI', anno: 2026, mese: 'agosto' });
  verifica('la riserva di rete e solo di rete', rete.riserva_eseguiti.tonnellate === 3.62, JSON.stringify(rete.riserva_eseguiti));
  verifica('quella ACI e solo ACI', aci.riserva_eseguiti.tonnellate === 1, JSON.stringify(aci.riserva_eseguiti));
  verifica('e si legge l archivio del canale', letture.every(l => l.startsWith('PrimariaAci')), letture.join(','));
}

console.log('NELL EXTRA RACCOLTA I TRASFERIMENTI NON SONO RACCOLTO, NEMMENO NEL LIMBO');
{
  const archivi = {
    ExtraRaccolta: [
      term('CLIENTE', 8000, '2026-08-10', { tipo_movimento: 'primaria' }),
      eseg('CLIENTE', 2000, '2026-08-18', { tipo_movimento: 'primaria' }),
      eseg('CLIENTE', 50000, '2026-08-19', { tipo_movimento: 'trasferimento' }),
    ],
  };
  const d = await raccolto(archivi, { canale: 'EXTRA_RACCOLTA', anno: 2026, mese: 'agosto' });
  verifica('solo la primaria in riserva', d.riserva_eseguiti.ordini === 1 && d.riserva_eseguiti.tonnellate === 2, JSON.stringify(d.riserva_eseguiti));
}

console.log('DUE STRUMENTI NELLA STESSA DOMANDA LEGGONO UNA VOLTA SOLA');
{
  const archivi = { PrimariaRete: [term('EMMESSE', 10000, '2026-08-10'), eseg('EMMESSE', 3620, '2026-08-18')] };
  const cache = nuovaCache();
  const base = finto(archivi);
  letture = [];
  await Promise.all([
    strumento('raccolto').esegui(base, { canale: 'RETE', anno: 2026 }, cache),
    strumento('raccolto').esegui(base, { canale: 'RETE', anno: 2026, mese: 'agosto' }, cache),
  ]);
  verifica('due letture in tutto, terminati ed eseguiti', letture.length === 2, letture.join(','));
  verifica('e due risparmiate', cache.conti().risparmiate === 2, JSON.stringify(cache.conti()));
}

console.log('LA COPERTURA DEL TARGET DICE LA RISERVA');
{
  const archivi = {
    PrimariaRete: [term('EMMESSE', 10000, '2026-08-10'), eseg('EMMESSE', 3620, '2026-08-18')],
    TargetRaccoglitore: [{ id: 't1', anno: 2026, raccoglitore: 'EMMESSE', target_tonnellate: 100 }],
  };
  letture = [];
  const d = (await strumento('target_raccoglitori').esegui(finto(archivi), { anno: 2026 })).dati;
  verifica('il fatto e quello dei terminati', d.fatto_totale_t === 10, 't=' + d.fatto_totale_t);
  verifica('la riserva e detta accanto', d.riserva_eseguiti && d.riserva_eseguiti.tonnellate === 3.62, JSON.stringify(d.riserva_eseguiti));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);
