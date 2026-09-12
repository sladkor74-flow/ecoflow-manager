// Costruisce URL di Google Maps a partire dalle coordinate o dall'indirizzo di un PDR.

export function streetViewUrl(lat, lng) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

export function satelliteUrl(lat, lng) {
  return `https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lng}&zoom=19&basemap=satellite`;
}

export function addressSearchUrl(record) {
  const indirizzo = [record.indirizzo_pdr, record.cap_pdr, record.comune_pdr, record.provincia_pdr]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(indirizzo)}`;
}

const PRECISIONE_MAP = {
  'ROOFTOP': { etichetta: 'Posizione precisa (edificio)', livello: 'ok' },
  'RANGE_INTERPOLATED': { etichetta: 'Posizione stimata sul civico', livello: 'medio' },
  'GEOMETRIC_CENTER': { etichetta: "Centro della via o dell'area", livello: 'medio' },
  'APPROXIMATE': { etichetta: "Posizione approssimativa (solo località)", livello: 'basso' },
};

export function precisioneCoordinata(valore) {
  const v = String(valore || '').trim().toUpperCase();
  return PRECISIONE_MAP[v] || { etichetta: 'Precisione non nota', livello: 'ignoto' };
}