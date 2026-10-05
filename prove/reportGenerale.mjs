// Prova della vista Report Generale (src/lib/reportGeneraleVista.js): il target
// di un raccoglitore ripartito fra gli impianti dove ha davvero portato, mese per
// mese, e i totali dell'anno. npm run prove
import {
  calcolaReportGenerale, impiantoDiRiferimento, impiantiDelMese, impiantiDellAnno,
  valoriAnno, valoriMese, sommaRighe, DA_ASSEGNARE,
} from '../src/lib/reportGeneraleVista.js';
import { MESI } from '../src/lib/pfuConstants.js';
// la stessa normalizzazione dei nomi che usa la pagina (chiaveNome in src/lib/target.js)
import { normalizzaRagioneSociale as chiave } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const mesiRaccolto = (coppie) => Object.fromEntries(coppie.map(([m, v]) => [MESI[m], v]));
// una riga di by_raccoglitore_impianto
const conf = (raccoglitore, regione, impianto, coppie) => ({ raccoglitore, regione, impianto, mesi: mesiRaccolto(coppie) });
// un target mensile
const tm = (raccoglitore, regione, mese, target, impianto) => ({ raccoglitore, regione, mese: MESI[mese], target, impianto });

const unaRiga = (opzioni) => calcolaReportGenerale({ chiave, ...opzioni })[0];

// L'ESEMPIO DELL'UTENTE (05/10/2026).
//
// «Emmesse per due mesi ha conferito su Irigom a causa dell'incendio in Gatim, ma
// da qui a fine anno conferira' sempre su Gatim, quindi li' non c'e' un vero
// target, metti esattamente quello che ha raccolto in quei due mesi e fai tornare
// a zero il delta».
console.log("L'INCENDIO IN GATIM: DOVE IL MATERIALE E' ARRIVATO IL DELTA E' ZERO");
{
  // Maggio e Giugno su Irigom (l'incendio), Luglio e Agosto tornati su Gatim.
  const emmesse = unaRiga({
    annui: [{ raccoglitore: 'Emmesse Srls', regione: 'Calabria', target_tonnellate: 50 }],
    mensili: [tm('Emmesse Srls', 'Calabria', 4, 10), tm('Emmesse Srls', 'Calabria', 5, 10),
      tm('Emmesse Srls', 'Calabria', 6, 10), tm('Emmesse Srls', 'Calabria', 9, 10)],
    raccolto: [
      conf('EMMESSE SRLS', 'Calabria', 'Irigom S.r.l.', [[4, 10], [5, 6]]),
      conf('EMMESSE SRLS', 'Calabria', 'Gatim', [[6, 10]]),
    ],
  });

  // Maggio: target 10, raccolto 10 tutto su Irigom -> Irigom 10, delta zero, e a Gatim niente.
  const maggio = impiantiDelMese(emmesse, 4);
  verifica('il mese andato tutto a un altro impianto: li\' il target e\' quello arrivato e il delta e\' zero',
    maggio.length === 1 && maggio[0].impianto === 'Irigom S.r.l.' && maggio[0].target === 10 && maggio[0].delta === 0,
    JSON.stringify(maggio));
  verifica('e all\'impianto di riferimento non si scrive niente: non c\'e\' nessun ammanco',
    !maggio.some(v => v.impianto === 'Gatim'), JSON.stringify(maggio));

  // Giugno: target 10, raccolto 6 su Irigom -> Irigom 6 con delta zero, i 4 che
  // mancano restano a Gatim, dove avrebbe dovuto portarli.
  const giugno = impiantiDelMese(emmesse, 5);
  const gIrigom = giugno.find(v => v.impianto === 'Irigom S.r.l.');
  const gGatim = giugno.find(v => v.impianto === 'Gatim');
  verifica('un mese raccolto a meta\': l\'impianto che ha ricevuto non mostra ammanchi',
    gIrigom?.target === 6 && gIrigom?.raccolto === 6 && gIrigom?.delta === 0, JSON.stringify(giugno));
  verifica('e quello che manca resta all\'impianto di riferimento, segnato come previsione',
    gGatim?.target === 4 && gGatim?.raccolto === 0 && gGatim?.delta === 4 && gGatim?.stimato === true, JSON.stringify(giugno));
  verifica('la somma dei target degli impianti fa il target del mese del raccoglitore',
    giugno.reduce((s, v) => s + v.target, 0) === 10);

  // Ottobre: target 10, non ancora raccolto niente -> tutto a Gatim, previsione.
  const ottobre = impiantiDelMese(emmesse, 9);
  verifica('un mese ancora da fare e\' tutto dell\'impianto dove porta oggi, ed e\' una previsione',
    ottobre.length === 1 && ottobre[0].impianto === 'Gatim' && ottobre[0].target === 10 && ottobre[0].stimato === true,
    JSON.stringify(ottobre));

  // IL RIFERIMENTO E' L'ULTIMO MESE, NON IL PIU' GRANDE DELL'ANNO: nell'anno
  // Irigom ha preso 16 t e Gatim 10, ma l'ultimo conferimento e' andato a Gatim.
  verifica('l\'impianto di riferimento e\' quello dell\'ultimo mese in cui ha conferito, non il piu\' grande dell\'anno',
    impiantoDiRiferimento(emmesse) === 'Gatim', impiantoDiRiferimento(emmesse));

  // L'anno: Irigom 16 t raccolte e 16 di target (delta zero), Gatim il resto.
  const anno = impiantiDellAnno(emmesse);
  const aIrigom = anno.find(v => v.impianto === 'Irigom S.r.l.') || { mesi: MESI.map(() => ({ target: 0, raccolto: 0 })), annuo: 0 };
  verifica('nell\'anno Irigom ha target uguale al raccolto: dei due mesi dell\'incendio non resta nessun ammanco',
    valoriAnno(aIrigom).target === 16 && valoriAnno(aIrigom).raccolto === 16 && valoriAnno(aIrigom).delta === 0,
    JSON.stringify(valoriAnno(aIrigom)));
  verifica('e la somma dei target degli impianti fa il target dei mesi del raccoglitore',
    anno.reduce((s, v) => s + valoriAnno(v).target, 0) === valoriAnno(emmesse).target
    && valoriAnno(emmesse).target === 40, String(valoriAnno(emmesse).target));
  verifica('il raccolto degli impianti fa il raccolto del raccoglitore',
    anno.reduce((s, v) => s + valoriAnno(v).raccolto, 0) === valoriAnno(emmesse).raccolto);
}

console.log('CHI HA RACCOLTO PIU\' DEL TARGET');
{
  // Target 10, raccolte 20: 12 su Gatim e 8 su Irigom. Il target si divide in
  // proporzione, cosi' nessuno dei due mostra un ammanco che non c'e'.
  const r = unaRiga({
    annui: [{ raccoglitore: 'Alfa', regione: 'Puglia', target_tonnellate: 100 }],
    mensili: [tm('Alfa', 'Puglia', 0, 10)],
    raccolto: [conf('Alfa', 'Puglia', 'Gatim', [[0, 12]]), conf('Alfa', 'Puglia', 'Irigom', [[0, 8]])],
  });
  const gen = impiantiDelMese(r, 0);
  verifica('il target si divide in proporzione ai chili arrivati',
    gen.find(v => v.impianto === 'Gatim')?.target === 6 && gen.find(v => v.impianto === 'Irigom')?.target === 4,
    JSON.stringify(gen));
  verifica('nessun impianto mostra un ammanco quando il mese e\' andato oltre il target',
    gen.every(v => v.delta <= 0) && !gen.some(v => v.stimato), JSON.stringify(gen));
  verifica('e le parti fanno esattamente il target, senza perdere chili',
    gen.reduce((s, v) => s + v.target, 0) === 10);

  // Un target che non si divide: 10 t su tre impianti uguali.
  const tre = unaRiga({
    mensili: [tm('Beta', 'Puglia', 0, 10)],
    raccolto: [conf('Beta', 'Puglia', 'Uno', [[0, 5]]), conf('Beta', 'Puglia', 'Due', [[0, 5]]), conf('Beta', 'Puglia', 'Tre', [[0, 5]])],
  });
  const kg = impiantiDelMese(tre, 0).map(v => Math.round(v.target * 1000));
  verifica('tre impianti uguali: i chili tornano lo stesso',
    kg.reduce((s, v) => s + v, 0) === 10000 && kg.filter(v => v === 3334).length === 1, JSON.stringify(kg));
}

console.log('CHI DECIDE DOVE VA QUELLO CHE MANCA');
{
  // L'impianto scritto a mano in Target & Status e' una decisione dell'utente e
  // vince sullo storico: e' il modo di correggere una previsione sbagliata.
  const r = unaRiga({
    annui: [{ raccoglitore: 'Gamma', regione: 'Sicilia', target_tonnellate: 100, impianto: 'Tecnogum' }],
    mensili: [tm('Gamma', 'Sicilia', 1, 10)],
    raccolto: [conf('Gamma', 'Sicilia', 'Gatim', [[0, 20]])],
  });
  verifica('l\'impianto scritto a mano vince sull\'ultimo conferimento',
    impiantoDiRiferimento(r) === 'Tecnogum', impiantoDiRiferimento(r));
  verifica('e quello che manca ci finisce sopra',
    impiantiDelMese(r, 1).find(v => v.impianto === 'Tecnogum')?.target === 10, JSON.stringify(impiantiDelMese(r, 1)));

  // Senza niente a cui appoggiarsi la quota non si inventa un impianto: si dice
  // che e' da assegnare.
  const senza = unaRiga({
    annui: [{ raccoglitore: 'Delta', regione: 'Campania', target_tonnellate: 100 }],
    mensili: [tm('Delta', 'Campania', 0, 10)],
    raccolto: [],
  });
  verifica('chi non ha ne\' impianto scritto ne\' conferimenti ha una quota da assegnare, non un impianto inventato',
    impiantoDiRiferimento(senza) === '' && impiantiDelMese(senza, 0)[0]?.impianto === DA_ASSEGNARE,
    JSON.stringify(impiantiDelMese(senza, 0)));
}

console.log('LO STESSO IMPIANTO SCRITTO IN DUE MODI E\' UN IMPIANTO SOLO');
{
  // In Target & Status l'utente scrive «GATIM S.R.L.», il portale dice «Gatim».
  // Tenendo le voci per nome, l'ammanco finiva su una seconda riga dello stesso
  // impianto: due righe Gatim sotto lo stesso raccoglitore, una col raccolto e
  // una col target (visto in pagina il 05/10/2026).
  const r = unaRiga({
    annui: [{ raccoglitore: 'Gatim S.r.l.', regione: 'Calabria', target_tonnellate: 900, impianto: 'GATIM S.R.L.' }],
    mensili: [tm('Gatim S.r.l.', 'Calabria', 8, 75)],
    raccolto: [conf('GATIM S.R.L.', 'Calabria', 'Gatim', [[8, 74.47]])],
  });
  const set = impiantiDelMese(r, 8);
  verifica('una riga sola per l\'impianto, non due',
    set.length === 1, JSON.stringify(set));
  verifica('con il raccolto e l\'ammanco sulla stessa riga',
    set[0]?.raccolto === 74.47 && set[0]?.target === 75 && set[0]?.delta === 0.53 && set[0]?.stimato === true,
    JSON.stringify(set));
  verifica('e si mostra il nome del portale, quello dei mesi in cui il materiale e\' arrivato',
    impiantiDellAnno(r).length === 1 && impiantiDellAnno(r)[0].impianto === 'Gatim',
    JSON.stringify(impiantiDellAnno(r).map(x => x.impianto)));
}

console.log('I CONTI DELLA TABELLA');
{
  const righe = calcolaReportGenerale({
    chiave,
    annui: [
      { raccoglitore: 'Alfa', regione: 'Puglia', target_tonnellate: 120 },
      { raccoglitore: 'Beta', regione: 'Puglia', target_tonnellate: 60 },
    ],
    mensili: [tm('Alfa', 'Puglia', 0, 10), tm('Beta', 'Puglia', 0, 5)],
    raccolto: [conf('Alfa', 'Puglia', 'Gatim', [[0, 4]]), conf('Beta', 'Puglia', 'Gatim', [[0, 5]])],
  });
  const tot = sommaRighe(righe);
  verifica('il gruppo somma i mesi delle sue righe', tot.mesi[0].target === 15 && tot.mesi[0].raccolto === 9, JSON.stringify(tot.mesi[0]));
  verifica('i totali dell\'anno sommano i dodici mesi', valoriAnno(tot).target === 15 && valoriAnno(tot).raccolto === 9 && valoriAnno(tot).delta === 6);
  verifica('la percentuale si misura sul target annuo, non sulla somma dei mesi',
    Math.round(valoriAnno(righe[0]).percentualeAnnuo * 100) / 100 === Math.round((4 / 120) * 10000) / 100,
    String(valoriAnno(righe[0]).percentualeAnnuo));
  // Il mese singolo non e' cambiato: la vecchia tabella continua a dire le stesse cose.
  verifica('la vista del mese singolo resta quella di prima',
    valoriMese(righe[0], 0).target === 10 && valoriMese(righe[0], 0).raccolto === 4 && valoriMese(righe[0], 0).delta === 6);
  // Una riga senza target ma con raccolto non sparisce, e non si inventa un target.
  const soloRaccolto = unaRiga({ raccolto: [conf('Zeta', 'Sicilia', 'Gatim', [[2, 7]])] });
  verifica('chi ha raccolto senza target resta in tabella, con target zero',
    soloRaccolto.conTarget === false && valoriAnno(soloRaccolto).raccolto === 7 && valoriAnno(soloRaccolto).target === 0);
  verifica('e il suo raccolto non diventa un target dell\'impianto',
    impiantiDelMese(soloRaccolto, 2)[0]?.target === 0 && impiantiDelMese(soloRaccolto, 2)[0]?.delta === -7,
    JSON.stringify(impiantiDelMese(soloRaccolto, 2)));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
