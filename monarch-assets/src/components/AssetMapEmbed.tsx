import { useEffect, useState } from "react";
import { ExternalLink, Loader2, MapPin } from "lucide-react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import icon from "leaflet/dist/images/marker-icon.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

/** Esri World Street Map — free to use in many web apps; attribution required. */
const ESRI_WORLD_STREET = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION =
  '&copy; <a href="https://www.esri.com/">Esri</a> — sources: Esri, Garmin, FAO, NOAA, USGS, and others.';

type Props = {
  location: string;
  className?: string;
};

const externalMapsUrl = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

/** Open-Meteo geocoding — free, no API key (non-commercial / fair use per their terms). */
async function geocodeLocation(query: string, signal: AbortSignal): Promise<{ lon: number; lat: number } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: Array<{ latitude: number; longitude: number }> };
  const r = data.results?.[0];
  if (!r || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return null;
  return { lat: r.latitude, lon: r.longitude };
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    fix();
    const t = window.setTimeout(fix, 100);
    const id = requestAnimationFrame(fix);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(id);
    };
  }, [map]);
  return null;
}

type LeafletMapProps = { lat: number; lon: number; label: string };

function AssetLeafletMap({ lat, lon, label }: LeafletMapProps) {
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={13}
      className="z-0 h-full min-h-[220px] w-full [&_.leaflet-control-zoom]:overflow-hidden [&_.leaflet-control-zoom_a]:border-border [&_.leaflet-control-zoom_a]:bg-card [&_.leaflet-control-zoom_a]:text-foreground"
      scrollWheelZoom={false}
      aria-label={label}
    >
      <MapResizeFix />
      <TileLayer attribution={ESRI_ATTRIBUTION} url={ESRI_WORLD_STREET} maxZoom={19} />
      <Marker position={[lat, lon]} />
    </MapContainer>
  );
}

export function AssetMapEmbed({ location, className = "" }: Props) {
  const trimmed = location.trim();
  const [state, setState] = useState<
    { status: "idle" | "loading" } | { status: "ready"; lon: number; lat: number } | { status: "unavailable" }
  >({ status: trimmed ? "loading" : "idle" });

  useEffect(() => {
    if (!trimmed) {
      setState({ status: "idle" });
      return;
    }
    const ac = new AbortController();
    setState({ status: "loading" });
    void (async () => {
      try {
        const coords = await geocodeLocation(trimmed, ac.signal);
        if (ac.signal.aborted) return;
        if (coords) setState({ status: "ready", ...coords });
        else setState({ status: "unavailable" });
      } catch {
        if (!ac.signal.aborted) setState({ status: "unavailable" });
      }
    })();
    return () => ac.abort();
  }, [trimmed]);

  const showMap = state.status === "ready";

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-border bg-card/40 ${className}`}
      aria-label="Asset location"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Location</h2>
            <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{trimmed || "—"}</p>
          </div>
        </div>
        {trimmed ? (
          <a
            href={externalMapsUrl(trimmed)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Open in Google Maps
            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </a>
        ) : null}
      </div>
      <div className="relative isolate aspect-[16/9] min-h-[220px] w-full bg-muted/30">
        {state.status === "loading" && trimmed ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin opacity-60" aria-hidden />
            <p className="text-sm">Loading map…</p>
          </div>
        ) : null}
        {showMap ? (
          <div className="absolute inset-0 h-full w-full">
            <AssetLeafletMap lat={state.lat} lon={state.lon} label={`Map: ${trimmed}`} />
          </div>
        ) : null}
        {state.status === "unavailable" && trimmed ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              Could not find coordinates for this place automatically. Try opening it in maps.
            </p>
            <a
              href={externalMapsUrl(trimmed)}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-foreground underline underline-offset-2"
            >
              Search in Google Maps
            </a>
          </div>
        ) : null}
        {!trimmed ? (
          <div className="flex h-full min-h-[220px] items-center justify-center p-6 text-sm text-muted-foreground">
            No location on file.
          </div>
        ) : null}
      </div>
      {trimmed ? (
        <p className="border-t border-border bg-secondary/20 px-4 py-2 text-[10px] leading-relaxed text-muted-foreground">
          Basemap: Esri World Street Map · Geocoding:{" "}
          <a
            href="https://open-meteo.com/en/docs/geocoding-api"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Open-Meteo
          </a>
        </p>
      ) : null}
    </section>
  );
}
