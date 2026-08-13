import React, { useState, useEffect } from 'react';
import { formatNumber } from '@/lib/utils';

export default function EditableCell({ value, onSave, disabled, suffix = '' }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? 0);

  useEffect(() => setVal(value ?? 0), [value]);

  const handleSave = () => {
    setEditing(false);
    const num = parseFloat(val);
    if (!isNaN(num) && num !== value) onSave(num);
  };

  if (editing) {
    return (
      <input
        type="number"
        step="0.1"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') { setEditing(false); setVal(value); }
        }}
        autoFocus
        className="w-16 px-1 py-0.5 text-right text-xs border border-primary rounded bg-background"
      />
    );
  }

  return (
    <span
      onClick={() => !disabled && setEditing(true)}
      className={`inline-block min-w-[36px] px-1.5 py-0.5 rounded text-xs tabular-nums ${
        disabled ? 'opacity-60 cursor-default' : 'cursor-pointer hover:bg-accent hover:ring-1 hover:ring-primary/30'
      }`}
    >
      {value != null ? formatNumber(value) : '—'}{suffix}
    </span>
  );
}