import { useEffect } from 'react';
import L, { type LatLngTuple } from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { MapPoint } from '@workspace/api-client-react';

type Props = {
  route: MapPoint[];
  pickup: MapPoint;
  destination: MapPoint & { name: string };
  progress: number;
  className?: string;
};
const xy = (point:MapPoint): LatLngTuple => [point.lat,point.lng];
const icon = (color:string,size:number,content='') => L.divIcon({
  className:'', iconSize:[size,size], iconAnchor:[size/2,size/2],
  html:`<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:50%;background:${color};color:white;border:2px solid white;box-shadow:0 2px 8px #280a4059">${content}</span>`,
});
const pickupIcon = icon('#b9321e',18);
const hospitalIcon = icon('#28614b',18);
const ambulanceIcon = icon('#732469',34,'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17H2v-6a2 2 0 0 1 2-2h11v8H8m7 0h2m4 0h1v-5l-3-4h-4m4 4h-4M7 4v4M5 6h4"/><circle cx="6" cy="17" r="2"/><circle cx="19" cy="17" r="2"/></svg>');

function pointAt(route: MapPoint[], t:number): LatLngTuple {
  const segments = route.slice(1).map((p,i)=>Math.hypot((p.lat-route[i]!.lat)*111,(p.lng-route[i]!.lng)*97));
  const total = segments.reduce((a,b)=>a+b,0);
  let remaining = Math.min(1,Math.max(0,t))*total;
  for (const [i,length] of segments.entries()) {
    if (remaining <= length && length > 0) {
      const a = route[i]!, b = route[i+1]!, f = remaining/length;
      return [a.lat+(b.lat-a.lat)*f, a.lng+(b.lng-a.lng)*f];
    }
    remaining -= length;
  }
  return xy(route.at(-1)!);
}

function Fit({ pickup, destination }: { pickup:MapPoint; destination:MapPoint }) {
  const map = useMap();
  const { lat, lng } = pickup;
  const destLat = destination.lat, destLng = destination.lng;
  useEffect(() => {
    map.fitBounds([[lat,lng],[destLat,destLng]], {padding:[45,45],maxZoom:15});
  }, [map,lat,lng,destLat,destLng]);
  return null;
}

/** Uses only server-provided demo coordinates, not the device's location. */
export function VillageMap({ route, pickup, destination, progress, className }: Props) {
  const path = route.length>1 ? route : [destination,pickup];
  return <div className={className} data-testid="map-tracking" aria-label="Simulated ambulance route">
    <MapContainer center={xy(pickup)} zoom={12} zoomControl={false} style={{height:'100%',minHeight:300,width:'100%'}}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      <Polyline positions={path.map(xy)} pathOptions={{color:'#732469',weight:5,opacity:.85,dashArray:'2 9',lineCap:'round'}} />
      <Marker position={xy(pickup)} icon={pickupIcon} title="Demo pickup"><Tooltip>Pickup (demo village)</Tooltip></Marker>
      <Marker position={xy(destination)} icon={hospitalIcon} title={destination.name}><Tooltip>{destination.name}</Tooltip></Marker>
      <Marker position={pointAt(path,progress)} icon={ambulanceIcon} title="Simulated ambulance" zIndexOffset={200}><Tooltip>Simulated ambulance</Tooltip></Marker>
      <Fit pickup={pickup} destination={destination} />
    </MapContainer>
  </div>;
}
