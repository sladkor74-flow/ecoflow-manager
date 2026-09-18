import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { formatoKg } from "../../shared/formato.ts";
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';
import { fetchAll } from "../../shared/fetchAll.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
// Media reale di un viaggio di secondaria: 13,5 tonnellate.
const KG_PER_VIAGGIO = 13500;
const DATA_FINE_DEFAULT = '2026-12-18';

function getMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function dateStr(d) { return d.toISOString().split('T')[0]; }

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

    const oggi = new Date();
    // Settimana appena conclusa = lunedì-domenica della settimana scorsa
    const thisMonday = getMonday(oggi);
    const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday); lastSunday.setDate(lastSunday.getDate() - 1);

    const impNormMap = {};
    for (const imp of impianti) impNormMap[normalizzaRagioneSociale(imp.nome_impianto)] = imp;

    const terminati = secondarie.filter(r => {
      const stato = String(r.stato || '').toLowerCase().trim();
      if (stato !== 'terminato') return false;
      if (!r.trasporto_finito_il) return false;
      const dest = normalizzaRagioneSociale(r.destinazione);
      return !!impNormMap[dest];
    });

    const parti = [];
    for (const imp of impianti) {
      const impNorm = normalizzaRagioneSociale(imp.nome_impianto);
      const weekRecords = terminati.filter(r => {
        if (normalizzaRagioneSociale(r.destinazione) !== impNorm) return false;
        const d = new Date(r.trasporto_finito_il);
        return d >= lastMonday && d <= new Date(lastSunday.getTime() + 86399999);
      });
      const execSett = weekRecords.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
      const viaggiSett = weekRecords.length;

      const consuntivoTot = terminati.filter(r => normalizzaRagioneSociale(r.destinazione) === impNorm)
        .reduce((s, r) => s + (r.peso_effettivo || 0), 0);
      const target = imp.target || 0;
      const residuo = Math.max(0, target - consuntivoTot);

      // settimane rimanenti
      const dataFine = new Date(DATA_FINE_DEFAULT + 'T00:00:00');
      let cur = new Date(thisMonday);
      let settRim = 0;
      while (cur <= dataFine) { settRim++; cur.setDate(cur.getDate() + 7); }
      const kgPerSett = settRim > 0 ? Math.round(residuo / settRim) : 0;
      const viaggiPerSett = Math.ceil(kgPerSett / KG_PER_VIAGGIO);

      // PREV stimata per la settimana conclusa (costanza al momento del calcolo)
      // non avendo lo storico PREV esatto, usiamo kgPerSett come riferimento
      const prevSett = kgPerSett;
      const deltaSett = execSett - prevSett;
      const deltaViaggi = Math.round(deltaSett / KG_PER_VIAGGIO);

      let frase;
      if (viaggiSett === 0) {
        frase = `${imp.nome_impianto}: nessun trasporto registrato nella settimana ${dateStr(lastMonday)}→${dateStr(lastSunday)}. Recupero previsto: ${formatoKg(kgPerSett)} kg/settimana (${viaggiPerSett} viaggi) per le ${settRim} settimane rimanenti. Residuo: ${formatoKg(residuo)} kg.`;
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

    const suggestion = `Suggerimento settimanale predittività delle secondarie di rete (settimana ${dateStr(lastMonday)}→${dateStr(lastSunday)}). L'autodemolizione è un canale a parte e non entra in questo conto:\n\n` + parti.join('\n\n');

    // Salva come Alert consultabile dall'agente
    await b.entities.Alert.create({
      titolo: 'Suggerimento Predittività Settimanale · secondarie di rete',
      descrizione: suggestion,
      severita: 'info',
      modulo: 'secondarie',
      stato: 'aperto',
    });

    return Response.json({ ok: true, suggestion, data_riferimento: dateStr(lastMonday) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}