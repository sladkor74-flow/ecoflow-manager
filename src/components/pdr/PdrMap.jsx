import React, { useMemo, useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { AlertTriangle, X, Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import PdrDetailCard from '@/components/pdr/PdrDetailCard';

function getThemeColor(varName, fallback) {
  if (typeof window === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val ? `hsl(${val})` : fallback;
}

// Componente interno: adatta l'inquadratura ai punti o centra sul selezionato
function FitBounds({ points, selectedPoint }) {
  const map = useMap();
  useEffect(() => {
    if (selectedPoint) {
      map.setView(selectedPoint, 15);
      return;
    }
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(points, { padding: [40, 40] });
  }, [points, map, selectedPoint]);
  return null;
}

export default function PdrMap({ records, selectedPdrId, onSelect }) {
  const [colors, setColors] = useState({ green: '#22c55e', red: '#ef4444' });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const searchContainerRef = useRef(null);

  useEffect(() => {
    setColors({
      green: getThemeColor('--success', '#22c55e'),
      red: getThemeColor('--destructive', '#ef4444'),
    });
  }, []);

  // Chiude la tendina cliccando fuori
  useEffect(() => {
    const handler = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { withCoords, withoutCoordsCount } = useMemo(() => {
    const valid = [];
    let without = 0;
    for (const r of records) {
      const lat = parseFloat(r.latitudine);
      const lng = parseFloat(r.longitudine);
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
        without++;
        continue;
      }
      valid.push({ ...r, _lat: lat, _lng: lng });
    }
    return { withCoords: valid, withoutCoordsCount: without };
  }, [records]);

  const points = useMemo(() => withCoords.map(r => [r._lat, r._lng]), [withCoords]);

  const selectedRecord = useMemo(() => {
    if (!selectedPdrId) return null;
    return withCoords.find(r => r.id === selectedPdrId) || null;
  }, [withCoords, selectedPdrId]);

  const selectedPoint = useMemo(() => {
    if (!selectedRecord) return null;
    return [selectedRecord._lat, selectedRecord._lng];
  }, [selectedRecord]);

  // Ricerca: min 2 caratteri, cerca in descrizione_pdr, ragione_sociale, comune_pdr
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      setActiveSearchIndex(-1);
      return;
    }
    const t = searchTerm.toLowerCase().trim();
    const results = withCoords.filter(r => {
      const hay = [r.descrizione_pdr, r.ragione_sociale, r.comune_pdr].map(v => (v || '').toLowerCase());
      return hay.some(v => v.includes(t));
    }).slice(0, 8);
    setSearchResults(results);
    setSearchOpen(results.length > 0);
    setActiveSearchIndex(-1);
  }, [searchTerm, withCoords]);

  // Ferma la propagazione degli eventi verso Leaflet
  const stopProp = (e) => { e.stopPropagation(); };

  const handleSearchKey = (e) => {
    if (e.key === 'ArrowDown' && searchOpen && searchResults.length > 0) {
      e.preventDefault();
      setActiveSearchIndex(i => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp' && searchOpen && searchResults.length > 0) {
      e.preventDefault();
      setActiveSearchIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && searchOpen && searchResults.length > 0) {
      e.preventDefault();
      const idx = activeSearchIndex >= 0 ? activeSearchIndex : 0;
      pickResult(searchResults[idx]);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  const pickResult = (r) => {
    onSelect(r.id);
    setSearchTerm('');
    setSearchOpen(false);
  };

  if (withCoords.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] md:h-[600px] border rounded-lg bg-muted/30 text-muted-foreground text-center px-4">
        <p className="max-w-md">
          Nessun punto di raccolta con coordinate disponibili.<br />
          Ricarica il file PDR per popolare latitudine e longitudine.
        </p>
      </div>
    );
  }

  const activeCount = withCoords.filter(r => !r.sospeso || String(r.sospeso).trim() === '').length;
  const sospesoCount = withCoords.length - activeCount;
  const visibleMarkers = selectedPdrId && selectedRecord ? [selectedRecord] : withCoords;
  const popupTel = (r) => r.tel_pdr || r.tel || null;
  const popupEmail = (r) => r.email_pdr || r.email || null;

  return (
    <div className="space-y-3">
      {withoutCoordsCount > 0 && !selectedPdrId && (
        <div className="text-sm text-muted-foreground bg-muted/50 border rounded-md px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {withoutCoordsCount.toLocaleString('it-IT')} punti su {records.length.toLocaleString('it-IT')} non hanno coordinate e non sono mostrati sulla mappa
          </span>
        </div>
      )}
      {selectedPdrId && selectedRecord && (
        <div className="text-sm bg-primary/10 border border-primary/30 rounded-md px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="font-bold">{selectedRecord.descrizione_pdr || 'PDR'}</span>
            {selectedRecord.ragione_sociale && <span className="font-bold"> — {selectedRecord.ragione_sociale}</span>}
          </div>
          <button
            onClick={() => onSelect(null)}
            className="inline-flex items-center gap-1 text-xs font-medium border rounded-md px-2.5 py-1 hover:bg-background shrink-0"
          >
            <X className="w-3.5 h-3.5" /> Mostra tutti i punti
          </button>
        </div>
      )}
      <div className="relative">
        {/* Campo di ricerca sovrapposto */}
        <div
          ref={searchContainerRef}
          onMouseDown={stopProp}
          onDoubleClick={stopProp}
          onWheel={stopProp}
          className="absolute top-3 left-3 z-[1100] w-64 max-w-[70%]"
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKey}
              onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
              placeholder="Cerca un punto di raccolta..."
              className="w-full border rounded-md pl-8 pr-3 py-1.5 text-sm bg-background shadow-sm"
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-lg overflow-hidden">
                {searchResults.map((r, i) => (
                  <button
                    key={r.id || r.id_pdr}
                    type="button"
                    onMouseDown={stopProp}
                    onClick={() => pickResult(r)}
                    onMouseEnter={() => setActiveSearchIndex(i)}
                    className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition-colors ${i === activeSearchIndex ? 'bg-accent' : 'hover:bg-muted'}`}
                  >
                    <div className="font-medium truncate">{r.descrizione_pdr || 'PDR'}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[r.comune_pdr, r.provincia_pdr].filter(Boolean).join(', ') || r.ragione_sociale || ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <MapContainer
          preferCanvas
          center={[41.9, 12.5]}
          zoom={6}
          className="w-full h-[400px] md:h-[600px] rounded-lg border z-0"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <FitBounds points={points} selectedPoint={selectedPoint} />
          {visibleMarkers.map((r) => {
            const isSospeso = !!(r.sospeso && String(r.sospeso).trim() !== '');
            const fillColor = isSospeso ? colors.red : colors.green;
            const isSelected = selectedPdrId === r.id;
            return (
              <CircleMarker
                key={r.id || r.id_pdr || `${r._lat},${r._lng}`}
                center={[r._lat, r._lng]}
                radius={isSelected ? 11 : 6}
                pathOptions={{
                  color: '#ffffff',
                  weight: isSelected ? 2 : 1,
                  fillColor,
                  fillOpacity: 0.85,
                }}
                eventHandlers={{ click: () => onSelect(r.id) }}
              >
                <Popup>
                  <div className="text-sm space-y-1 min-w-[200px]">
                    <div className="font-bold">{r.descrizione_pdr || 'PDR'}</div>
                    {r.ragione_sociale && <div>{r.ragione_sociale}</div>}
                    <div>
                      {[r.indirizzo_pdr, r.comune_pdr, r.provincia_pdr].filter(Boolean).join(', ')}
                    </div>
                    {r.riferimento_pdr && (
                      <div className="text-muted-foreground">Rif.: {r.riferimento_pdr}</div>
                    )}
                    {popupTel(r) && (
                      <div>
                        <a href={`tel:${popupTel(r)}`} className="text-primary underline">Tel: {popupTel(r)}</a>
                      </div>
                    )}
                    {popupEmail(r) && (
                      <div>
                        <a href={`mailto:${popupEmail(r)}`} className="text-primary underline">{popupEmail(r)}</a>
                      </div>
                    )}
                    {r.trasportatore_principale && (
                      <div className="text-muted-foreground">Trasportatore: {r.trasportatore_principale}</div>
                    )}
                    {isSospeso && <div className="text-destructive font-bold">SOSPESO</div>}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
        {/* Legenda */}
        <div className="absolute bottom-3 right-3 bg-background/95 border rounded-md shadow px-3 py-2 text-xs space-y-1 z-[1000]">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: colors.green }} />
            Attivo ({activeCount})
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: colors.red }} />
            Sospeso ({sospesoCount})
          </div>
          <div className="text-muted-foreground pt-1 border-t">{selectedPdrId ? '1 punto isolato' : `${withCoords.length} punti mostrati`}</div>
        </div>
      </div>
      {selectedRecord && <PdrDetailCard r={selectedRecord} />}
    </div>
  );
}