// Togliere un file dall'archivio privato.
//
// La piattaforma non documenta un nome unico per questa operazione: si provano
// quelli noti e si dice com'e' andata, invece di dare per scontato che sia
// riuscita. Se nessuno esiste il file resta dov'e' e chi chiama lo scrive: e'
// meglio saperlo che credere di aver liberato spazio senza averlo fatto.

/**
 * Prova a cancellare un file. Restituisce { riuscita, come }:
 * come e' il nome dell'operazione che ha funzionato, oppure il motivo.
 */
export async function cancellaFile(base44, fileUri) {
  if (!fileUri) return { riuscita: false, come: 'nessun file' };
  const core = base44.asServiceRole.integrations.Core;
  const nomi = ['DeleteFile', 'DeletePrivateFile', 'RemoveFile'];
  const disponibili = nomi.filter(n => typeof core[n] === 'function');
  if (disponibili.length === 0) return { riuscita: false, come: 'la piattaforma non consente di cancellare i file' };
  for (const nome of disponibili) {
    try {
      await core[nome]({ file_uri: fileUri });
      return { riuscita: true, come: nome };
    } catch (e) {
      return { riuscita: false, come: `${nome} non riuscita: ${e && e.message ? e.message : e}` };
    }
  }
  return { riuscita: false, come: 'non supportata' };
}

/** Quanti giorni sono passati da una data ISO. */
export function giorniDa(iso, adessoMs) {
  const t = iso ? new Date(iso).getTime() : 0;
  return t > 0 ? Math.floor(((adessoMs || Date.now()) - t) / 86400000) : null;
}

/**
 * I documenti sostituiti abbastanza vecchi da poter perdere il file allegato.
 * Il record resta: sintesi, scadenza, problemi e motivo della sostituzione sono
 * la storia del fornitore e non si toccano. Se ne va solo il file, che nel
 * frattempo e' stato rimpiazzato da uno piu' recente ed esiste comunque nella
 * cartella dei contratti.
 *
 * Funzione pura: le prove la chiamano senza toccare la piattaforma.
 */
export function daAlleggerire(documenti, opzioni) {
  const o = opzioni || {};
  const anni = o.anni == null ? 3 : Number(o.anni);
  const adessoMs = o.adessoMs || Date.now();
  const soglia = anni * 365;
  const scelti = [];
  for (const d of documenti || []) {
    if (!d || d.stato !== 'sostituito' || !d.file_uri) continue;
    // si guarda quando il documento e' stato messo da parte, non quando e' nato
    const eta = giorniDa(d.updated_date || d.created_date, adessoMs);
    if (eta === null || eta < soglia) continue;
    scelti.push({
      id: d.id, soggetto_nome: d.soggetto_nome, tipo_documento_nome: d.tipo_documento_nome,
      file_nome: d.file_nome, giorni: eta, anni: Math.floor(eta / 365),
    });
  }
  return scelti.sort((a, b) => b.giorni - a.giorni);
}
