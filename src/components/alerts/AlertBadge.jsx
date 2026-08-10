import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

// Badge compatto per dashboard e moduli: mostra conteggio alert aperti
export default function AlertBadge({ count, modulo, compact }) {
  if (!count || count === 0) return null;

  const label = compact
    ? `${count}`
    : `${count} alert${count > 1 ? ' (critici)' : ''}`;

  return (
    <Link
      to="/alert-engine"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-colors ${compact ? '' : 'animate-pulse'}`}
      title={modulo ? `Alert nel modulo: ${modulo}` : 'Alert operativi'}
    >
      <AlertTriangle className="w-3.5 h-3.5" />
      {label}
    </Link>
  );
}