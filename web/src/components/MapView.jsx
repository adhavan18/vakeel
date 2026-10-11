import { useEffect, useRef } from "react";
import L from "leaflet";

const COLORS = { ember: "#ff5a1f", amber: "#f5b83d", sky: "#7cc4ff", signal: "#3ddc97", muted: "#9a968e" };

export default function MapView({ points = [], rings = [], height = 380, className = "" }) {
  const el = useRef(null);
  useEffect(() => {
    const valid = points.filter((p) => p.lat && p.lng);
    if (!el.current) return;
    const map = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    const esri = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
    L.tileLayer(`${esri}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
      attribution: "Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
      maxZoom: 16,
    }).addTo(map);
    L.tileLayer(`${esri}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, opacity: 0.9 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    if (!valid.length) {
      map.setView([22.5, 82.5], 5);
    } else {
      const center = valid[0];
      rings
        .slice()
        .sort((a, b) => b.radiusKm - a.radiusKm)
        .forEach((r) => {
          L.circle([center.lat, center.lng], {
            radius: r.radiusKm * 1000,
            color: COLORS[r.tone] || COLORS.muted,
            weight: 1,
            opacity: 0.7,
            dashArray: "3 5",
            fillOpacity: 0.03,
          })
            .bindTooltip(r.label, { className: "vk-tip", direction: "top", permanent: false })
            .addTo(map);
        });
      valid.forEach((p) => {
        const color = COLORS[p.tone] || COLORS.ember;
        L.circleMarker([p.lat, p.lng], { radius: 14, color, weight: 0, fillOpacity: 0.18 }).addTo(map);
        const m = L.circleMarker([p.lat, p.lng], { radius: 6, color: "#0b0b0c", weight: 2, fillColor: color, fillOpacity: 1 })
          .bindTooltip(p.label, { className: "vk-tip", direction: "top", offset: [0, -8] })
          .addTo(map);
        if (p.href) m.on("click", () => (window.location.hash = p.href));
      });
      if (valid.length === 1) {
        const maxRing = Math.max(0, ...rings.map((r) => r.radiusKm));
        map.setView([center.lat, center.lng], maxRing > 8 ? 10 : maxRing > 3 ? 11 : 12);
      } else {
        map.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng])).pad(0.35));
      }
    }
    return () => map.remove();
  }, [JSON.stringify(points), JSON.stringify(rings)]);

  return <div ref={el} style={{ height }} className={`overflow-hidden rounded-2xl border hairline ${className}`} />;
}
