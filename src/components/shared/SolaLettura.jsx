import React from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { usePermessi } from '@/lib/permessi';

// Avviso per chi consulta il gestionale senza poterlo modificare: dice cosa
// puo' fare comunque (guardare ed esportare) e dove chiedere il resto.
export function BannerSolaLettura({ cosa, className = '' }) {
  const { soloLettura } = usePermessi();
  if (!soloLettura) return null;
  return (
    <div className={`flex items-start gap-2 border border-slate-300 bg-slate-50 text-slate-700 rounded-lg px-4 py-3 text-sm ${className}`}>
      <Eye className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        Stai consultando {cosa || 'questo modulo'} in sola lettura: puoi guardare ed esportare tutto, ma i caricamenti e le modifiche
        li fa l'amministratore. <Link to="/richieste" className="font-medium underline underline-offset-2">Apri una richiesta</Link> se
        serve un caricamento o una correzione.
      </div>
    </div>
  );
}

/** Mostra i comandi che modificano i dati solo all'amministratore. */
export function SoloAdmin({ children }) {
  const { isAdmin } = usePermessi();
  return isAdmin ? <>{children}</> : null;
}

export default BannerSolaLettura;
