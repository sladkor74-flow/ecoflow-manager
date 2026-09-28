// Utilita' per i target di Target & Status, fonte unica per tutti i moduli.

import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { formatTonnellate, formatPercentuale, dataServer } from '@/lib/utils';
import { annoCorrenteRoma } from '@/lib/annoTarget';

export const REGIONI_COMMESSA = ['Campania', 'Puglia', 'Basilicata', 'Calabria', 'Sicilia'];

// Il primo anno che si scrive in Target & Status.
export const PRIMO_ANNO_TARGET = 2025;

// Gli anni che si scelgono in Target & Status: dal 2025 fino all'anno prossimo,
// per preparare il nuovo anno prima che cominci. L'anno corrente e' quello di
// Roma: il 31 dicembre sera il 2027 non e' ancora cominciato.
export function anniTarget() {
  const ultimo = annoCorrenteRoma() + 1;
  const anni = [];
  for (let a = ultimo; a >= PRIMO_ANNO_TARGET; a--) anni.push(a);
  return anni;
}

// Tonnellate in italiano: due decimali, tre se i kg non sono tondi.
export function tonnellate(v) {
  if (v === null || v === undefined || v === '') return '—';
  return formatTonnellate(v);
}

// Percentuali con una cifra decimale.
export function percentuale(v, decimali = 1) {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return '—';
  return formatPercentuale(v, decimali);
}

// Numero scritto dall'utente, con la virgola o il punto come separatore decimale.
export function leggiNumero(testo) {
  const s = String(testo ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : NaN;
}

export function leggiStorico(json) {
  try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

// Aggiunge una modifica allo storico, con il valore di prima.
export function conModifica(json, { utente, nota, prima }) {
  const storico = leggiStorico(json);
  storico.push({ il: new Date().toISOString(), da: utente || '', nota: nota || '', prima: prima ?? null });
  return JSON.stringify(storico);
}

export function nomeUtente(user) {
  return (user && (user.full_name || user.email)) || '';
}

export const chiaveNome = (nome) => normalizzaRagioneSociale(nome || '');

export function dataOra(iso) {
  return iso ? dataServer(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}
