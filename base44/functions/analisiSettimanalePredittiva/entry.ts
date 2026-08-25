import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const KG_PER_VIAGGIO = 14000;
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
    const b = base44.asServiceRole;

    const impianti = await b.entities.ImpiantoTargetSecondaria.filter({ stato: 'attivo' });
    const secondarie = await b.entities.Secondaria.list('-created_date', 10000);

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
        frase = `${imp.nome_impianto}: nessun trasporto registrato nella settimana ${dateStr(lastMonday)}→${dateStr(lastSunday)}. Recupero previsto: ${kgPerSett.toLocaleString('it-IT')} kg/settimana (${viaggiPerSett} viaggi) per le ${settRim} settimane rimanenti. Residuo: ${residuo.toLocaleString('it-IT')} kg.`;
      } else if (Math.abs(deltaSett) <= KG_PER_VIAGGIO) {
        frase = `${imp.nome_impianto}: settimana in linea — ${execSett.toLocaleString('it-IT')} kg trasportati (${viaggiSett} viaggi) vs ${prevSett.toLocaleString('it-IT')} kg previsti. Mantieni ${kgPerSett.toLocaleString('it-IT')} kg/settimana (${viaggiPerSett} viaggi) per le ${settRim} settimane rimanenti. Residuo: ${residuo.toLocaleString('it-IT')} kg.`;
      } else if (deltaSett > 0) {
        const nuovaPrev = Math.max(0, kgPerSett - Math.round(deltaSett / settRim));
        frase = `${imp.nome_impianto}: anticipo di ${deltaSett.toLocaleString('it-IT')} kg (${deltaViaggi} viaggi) — ${execSett.toLocaleString('it-IT')} kg vs ${prevSett.toLocaleString('it-IT')} kg previsti. Suggerisco di ridurre le settimane rimanenti a ~${nuovaPrev.toLocaleString('it-IT')} kg/settimana per mantenere la costanza. Residuo: ${residuo.toLocaleString('it-IT')} kg.`;
      } else {
        const nuovaPrev = kgPerSett + Math.round(Math.abs(deltaSett) / Math.max(1, settRim));
        frase = `${imp.nome_impianto}: ritardo di ${Math.abs(deltaSett).toLocaleString('it-IT')} kg (${Math.abs(deltaViaggi)} viaggi) — ${execSett.toLocaleString('it-IT')} kg vs ${prevSett.toLocaleString('it-IT')} kg previsti. Suggerisco di aumentare le settimane rimanenti a ~${nuovaPrev.toLocaleString('it-IT')} kg/settimana. Residuo: ${residuo.toLocaleString('it-IT')} kg.`;
      }
      parti.push(frase);
    }

    const suggestion = `Suggerimento settimanale predittività (settimana ${dateStr(lastMonday)}→${dateStr(lastSunday)}):\n\n` + parti.join('\n\n');

    // Salva come Alert consultabile dall'agente
    await b.entities.Alert.create({
      titolo: 'Suggerimento Predittività Settimanale',
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