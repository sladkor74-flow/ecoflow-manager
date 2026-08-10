import React, { useState } from 'react';
import { FileSpreadsheet, FileText, Presentation, Loader2 } from 'lucide-react';

export default function ExportButtons({ onExcel, onPDF, onPPT }) {
  const [loading, setLoading] = useState(null);

  const handle = async (type, fn) => {
    setLoading(type);
    try { await fn(); } catch (e) { console.error(e); }
    setLoading(null);
  };

  const btn = (type, icon, label, fn) => (
    <button
      onClick={() => handle(type, fn)}
      disabled={loading === type}
      className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent disabled:opacity-50"
    >
      {loading === type ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {btn('excel', <FileSpreadsheet className="w-4 h-4" />, 'Excel', onExcel)}
      {btn('pdf', <FileText className="w-4 h-4" />, 'PDF', onPDF)}
      {btn('ppt', <Presentation className="w-4 h-4" />, 'PPT', onPPT)}
    </div>
  );
}