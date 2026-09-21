import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fineProgrammazione } from "../../shared/fineProgrammazione.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { formatoKg } from "../../shared/formato.ts";
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';
import { fetchAll } from "../../shared/fetchAll.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { eTerminato, periodoMovimento } from "../../shared/movimenti.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";

// Media reale di un viaggio di secondaria: 13,5 tonnellate.
const KG_PER_VIAGGIO = 13500;
// L'anno di lavoro e' quello in corso (giorno italiano); la fine della
// programmazione, se l'impianto non ne ha una sua, viene da
// base44/shared/fineProgrammazione.ts (il 18 dicembre vale solo per il 2026). Prima c'erano scritti "2026" e "2026-12-18": dal 19 dicembre 2026
// il modulo si sarebbe spento senza dirlo, e nel 2027 avrebbe continuato a
// leggere il 2026.
const annoRiferimento = () => Number(oggiRoma().slice(0, 4));
const dataFineDefault = () => fineProgrammazione(annoRiferimento()).data;

// Le settimane si contano sui giorni italiani 'AAAA-MM-GG', con l'aritmetica in
// UTC che non ha ora legale. getMonday lavorava con setHours/getDay nel fuso del
// server: una secondaria finita lunedi' e salvata a mezzanotte italiana (22:00Z
// della domenica) finiva nella settimana prima, e anche "oggi" poteva esserlo.
const aUtc = (g) => new Date(Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10)));
function piuGiorni(g, n) { const d = aUtc(g); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const lunediDi = (g) => piuGiorni(g, -((aUtc(g).getUTCDay() + 6) % 7));

// Funzione richiamata dal workflow del lunedì: ricalcola la pianificazione,
// analizza la settimana appena conclusa e genera un suggerimento proattivo
// salvato come Alert (modulo secondarie) consultabile dall'agente.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    // L'automazione del lunedi' gira senza utente; se invece la chiama una persona,
    // solo l'amministratore puo' scrivere il suggerimento.
    const chiamante = await base44.auth.me().catch(() => null);
    if (chiamante && !eAmministratore(chiamante)) return rispostaSolaLettura();
    const b = base44.asServiceRole;

    const impianti = await b.entities.ImpiantoTargetSecondaria.filter({ stato: 'attivo' });
    // Solo rete: il target di un impianto e' della rete e l'autodemolizione non
    // lo consuma. Le secondarie ACI stanno nello stesso archivio e si
    // riconoscono dalla classe.
    const secondarie = (await fetchAll(b.entities.Secondaria)).filter(r => !eAci(r));

    // Settimana appena conclusa = lunedì-domenica della settimana scorsa, sul
    // calendario italiano
    const anno = annoRiferimento();
    const thisMonday = lunediDi(oggiRoma());
    const lastMonday = piuGiorni(thisMonday, -7);
    const lastSunday = piuGiorni(thisMonday, -1);

    const impNormMap = {};
    for (const imp of impianti) impNormMap[normalizzaRagioneSociale(imp.nome_impianto)] = imp;

    // Terminati verso un impianto seguito, col giorno italiano della fine
    // trasporto. Chi non ce l'ha non si colloca in nessuna settimana (non si
    // ripiega sulla chiusura a portale): si conta e si dice in fondo.
    const terminati = [];
    let senzaFineTrasporto = 0;
    for (const r of secondarie) {
      if (!eTerminato(r)) continue;
      if (!impNormMap[normalizzaRagioneSociale(r.destinazione)]) continue;
      const p = periodoMovimento(r);
      if (!p) { senzaFineTrasporto++; continue; }
      terminati.push({ r, giorno: p.giorno, anno: p.anno, dest: normalizzaRagioneSociale(r.destinazione) });
    }

    const parti = [];
    for (const imp of impianti) {
      const impNorm = normalizzaRagioneSociale(imp.nome_impianto);
      const suoi = terminati.filter(t => t.dest === impNorm);
      const weekRecords = suoi.filter(t => t.giorno >= lastMonday && t.giorno <= lastSunday).map(t => t.r);
      const execSett = weekRecords.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
      const viaggiSett = weekRecords.length;

      // Il consuntivo si confronta col target dell'anno: solo le secondarie
      // finite quest'anno. Senza il filtro entravano anche quelle degli anni
      // prima, il residuo andava a zero e il suggerimento diceva "0 kg/settimana"
      // a un impianto a cui mancavano centinaia di tonnellate.
      const consuntivoTot = suoi.filter(t => t.anno === anno).reduce((s, t) => s + (t.r.peso_effettivo || 0), 0);
      const target = imp.target || 0;
      const residuo = Math.max(0, target - consuntivoTot);

      // settimane rimanenti
      const dataFine = dataFineDefault();
      let settRim = 0;
      for (let cur = thisMonday; cur <= dataFine; cur = piuGiorni(cur, 7)) settRim++;
      const kgPerSett = settRim > 0 ? Math.round(residuo / settRim) : 0;
      const viaggiPerSett = Math.ceil(kgPerSett / KG_PER_VIAGGIO);

      // PREV stimata per la settimana conclusa (costanza al momento del calcolo)
      // non avendo lo storico PREV esatto, usiamo kgPerSett come riferimento
      const prevSett = kgPerSett;
      const deltaSett = execSett - prevSett;
      const deltaViaggi = Math.round(deltaSett / KG_PER_VIAGGIO);

      let frase;
      if (viaggiSett === 0) {
        frase = `${imp.nome_impianto}: nessun trasporto registrato nella settimana ${lastMonday}→${lastSunday}. Recupero previsto: ${formatoKg(kgPerSett)} kg/settimana (${viaggiPerSett} viaggi) per le ${settRim} settimane rimanenti. Residuo: ${formatoKg(residuo)} kg.`;
      } else if (Math.abs(deltaSett) <= KG_PER_VIAGGIO) {
        frase = `${imp.nome_impianto}: settimana in linea — ${formatoKg(execSett)} kg trasportati (${viaggiSett} viaggi) vs ${formatoKg(prevSett)} kg previsti. Mantieni ${formatoKg(kgPerSett)} kg/settimana (${viaggiPerSett} viaggi) per le ${settRim} settimane rimanenti. Residuo: ${formatoKg(residuo)} kg.`;
      } else if (deltaSett > 0) {
        const nuovaPrev = Math.max(0, kgPerSett - Math.round(deltaSett / settRim));
        frase = `${imp.nome_impianto}: anticipo di ${formatoKg(deltaSett)} kg (${deltaViaggi} viaggi) — ${formatoKg(execSett)} kg vs ${formatoKg(prevSett)} kg previsti. Suggerisco di ridurre le settimane rimanenti a ~${formatoKg(nuovaPrev)} kg/settimana per mantenere la costanza. Residuo: ${formatoKg(residuo)} kg.`;
      } else {
        const nuovaPrev = kgPerSett + Math.round(Math.abs(deltaSett) / Math.max(1, settRim));
        frase = `${imp.nome_impianto}: ritardo di ${formatoKg(Math.abs(deltaSett))} kg (${Math.abs(deltaViaggi)} viaggi) — ${formatoKg(execSett)} kg vs ${formatoKg(prevSett)} kg previsti. Suggerisco di aumentare le settimane rimanenti a ~${formatoKg(nuovaPrev)} kg/settimana. Residuo: ${formatoKg(residuo)} kg.`;
      }
      parti.push(frase);
    }

    // Un terminato senza fine trasporto resta fuori dal conto, e lo si dice.
    if (senzaFineTrasporto > 0) parti.push(`${senzaFineTrasporto} ${senzaFineTrasporto === 1 ? 'secondaria terminata non ha' : 'secondarie terminate non hanno'} la data di fine trasporto: non ${senzaFineTrasporto === 1 ? 'è contata' : 'sono contate'} né nella settimana né nel consuntivo, finché la data non arriva con un nuovo caricamento.`);
    const suggestion = `Suggerimento settimanale predittività delle secondarie di rete (settimana ${lastMonday}→${lastSunday}). L'autodemolizione è un canale a parte e non entra in questo conto:\n\n` + parti.join('\n\n');

    // Salva come Alert consultabile dall'agente
    await b.entities.Alert.create({
      titolo: 'Suggerimento Predittività Settimanale · secondarie di rete',
      descrizione: suggestion,
      severita: 'info',
      modulo: 'secondarie',
      stato: 'aperto',
    });

    return Response.json({ ok: true, suggestion, data_riferimento: lastMonday });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}