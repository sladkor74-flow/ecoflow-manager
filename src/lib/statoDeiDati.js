import { base44 } from '@/api/base44Client';

// LE DUE DOMANDE AL SERVER DEI DOCUMENTI CHE ESCONO (chiusura dell'audit,
// 11/10/2026): fino a che giorno arrivano i dati degli archivi che il documento
// legge (funzione datiFinoAl) e chi lo sta generando.
//
// Stanno in un file a parte, che fogliProfessionali.js carica solo quando si
// esporta: il client si importa in testa qui, cosi' il corredo dei fogli resta
// senza client (le prove lo caricano in node) e la build non deve importare
// pigramente un modulo che il resto dell'app importa in testa, cosa di cui Vite
// avverte («dynamic import will not move module into another chunk»).

/** La risposta della funzione datiFinoAl per gli archivi chiesti. */
export async function chiediStatoDati(entita) {
  const risposta = await base44.functions.invoke('datiFinoAl', { entita });
  return (risposta && risposta.data) || risposta || {};
}

/** Il nome di chi esporta: il nome per esteso, altrimenti l'email. */
export async function chiediUtente() {
  const u = await base44.auth.me();
  return (u && (u.full_name || u.email)) || '';
}
