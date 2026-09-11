import React, { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Risolve un colore dal token del tema (HSL channels) in una stringa usabile dal canvas
function getThemeColor(varName, fallback) {
  if (typeof window === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val ? `hsl(${val})` : fallback;
}

// Componente interno: usa useMap per adattare l'inquadratura ai punti
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(points, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

export default function PdrMap({ records }) {
  const [colors, setColors] = useState({ green: '#22c55e', red: '#ef4444' });

  useEffect(() => {
    setColors({
      green: getThemeColor('--success', '#22c55e'),
      red: getThemeColor('--destructive', '#ef4444'),
    });
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

  return (
    <div className="space-y-3">
      {withoutCoordsCount > 0 && (
        <div className="text-sm text-muted-foreground bg-muted/50 border rounded-md px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {withoutCoordsCount.toLocaleString('it-IT')} punti su {records.length.toLocaleString('it-IT')} non hanno coordinate e non sono mostrati sulla mappa
          </span>
        </div>
      )}
      <div className="relative">
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
          <FitBounds points={points} />
          {withCoords.map((r) => {
            const isSospeso = !!(r.sospeso && String(r.sospeso).trim() !== '');
            const fillColor = isSospeso ? colors.red : colors.green;
            return (
              <CircleMarker
                key={r.id || r.id_pdr || `${r._lat},${r._lng}`}
                center={[r._lat, r._lng]}
                radius={6}
                pathOptions={{
                  color: '#ffffff',
                  weight: 1,
                  fillColor,
                  fillOpacity: 0.85,
                }}
              >
                <Popup>
                  <div className="text-sm space-y-1 min-w-[200px]">
                    <div className="font-bold">{r.descrizione_pdr || 'PDR'}</div>
                    {r.ragione_sociale && <div>{r.ragione_sociale}</div>}
                    <div>
                      {[r.indirizzo_pdr, r.comune_pdr, r.provincia_pdr].filter(Boolean).join(', ')}
                    </div>
                    {r.tel && (
                      <div>
                        <a href={`tel:${r.tel}`} className="text-primary underline">Tel: {r.tel}</a>
                      </div>
                    )}
                    {r.email && (
                      <div>
                        <a href={`mailto:${r.email}`} className="text-primary underline">{r.email}</a>
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
          <div className="text-muted-foreground pt-1 border-t">{withCoords.length} punti mostrati</div>
        </div>
      </div>
    </div>
  );
}