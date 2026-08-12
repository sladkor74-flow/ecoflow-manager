import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

export default function MultiSelect({ label, allLabel, options, selected, onChange, className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const displayLabel = selected.length === 0
    ? allLabel
    : selected.length <= 2
      ? selected.join(', ')
      : `${selected.length} selezionati`;

  return (
    <div className={`relative ${className || ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full border-2 rounded-md px-3 py-2 text-sm text-left flex items-center justify-between bg-background hover:bg-muted/30 transition-colors ${selected.length > 0 ? 'border-primary' : 'border-input'}`}
      >
        <span className={`truncate ${selected.length > 0 ? 'text-primary font-medium' : ''}`}>{displayLabel}</span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-muted"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] max-h-60 overflow-y-auto border rounded-md bg-popover shadow-lg">
          <div className="p-1">
            <button
              type="button"
              onClick={() => { onChange([]); }}
              className={`w-full text-left px-3 py-1.5 text-xs rounded hover:bg-muted ${selected.length === 0 ? 'font-semibold text-primary' : 'text-muted-foreground'}`}
            >
              {allLabel}
            </button>
            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Nessuna opzione</div>
            )}
            {options.map((opt) => {
              const val = typeof opt === 'object' ? opt.value : opt;
              const lbl = typeof opt === 'object' ? opt.label : opt;
              const isSel = selected.includes(val);
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => toggle(val)}
                  className={`w-full text-left px-3 py-1.5 text-sm rounded flex items-center gap-2 transition-colors ${isSel ? 'bg-primary/15 font-medium' : 'hover:bg-muted'}`}
                >
                  <span className={`w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSel ? 'bg-primary border-primary shadow-sm' : 'border-input bg-background'}`}>
                    {isSel && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                  </span>
                  <span className="truncate">{lbl}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}