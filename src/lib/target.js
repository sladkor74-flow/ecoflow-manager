// Utilita' per i target di Target & Status, fonte unica per tutti i moduli.

import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { formatTonnellate, formatPercentuale } from '@/lib/utils';

export const REGIONI_COMMESSA = ['Campania', 'Puglia', 'Basilicata', 'Calabria', 'Sicilia'];

export const ANNI_TARGET = (() => {
  const oggi = new Date().getFullYear();
  return [oggi - 1, oggi, oggi + 1];
})();

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
  return iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}
