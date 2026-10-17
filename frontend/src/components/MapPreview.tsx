import React, { useEffect, useRef } from "react";
import L from "leaflet";

interface Props {
  geojson?: Record<string, any>;
  comparisonGeojson?: Record<string, any>;
  height?: string;
  zoom?: number;
}

export const MapPreview: React.FC<Props> = ({
  geojson,
  comparisonGeojson,
  height = "320px",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center around central Brazil agricultural hub
      const map = L.map(mapContainerRef.current, {
        center: [-12.5, -54.5],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    if (layerGroup) {
      layerGroup.clearLayers();
    }

    const bounds = L.latLngBounds([]);

    // Primary geometry (Forest green)
    if (geojson && layerGroup) {
      try {
        const primaryLayer = L.geoJSON(geojson as any, {
          style: {
            color: "#1b4332",
            weight: 3,
            fillColor: "#2d6a4f",
            fillOpacity: 0.35,
          },
        });
        primaryLayer.addTo(layerGroup);
        bounds.extend(primaryLayer.getBounds());
      } catch (e) {
        console.error("Leaflet primary geojson parse error:", e);
      }
    }

    // Comparison geometry (Amber/orange)
    if (comparisonGeojson && layerGroup) {
      try {
        const compLayer = L.geoJSON(comparisonGeojson as any, {
          style: {
            color: "#d97706",
            weight: 2,
            dashArray: "4, 4",
            fillColor: "#f59e0b",
            fillOpacity: 0.25,
          },
        });
        compLayer.addTo(layerGroup);
        bounds.extend(compLayer.getBounds());
      } catch (e) {
        console.error("Leaflet comparison geojson parse error:", e);
      }
    }

    if (bounds.isValid() && map) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [geojson, comparisonGeojson]);

  return (
    <div
      ref={mapContainerRef}
      style={{ height }}
      className="w-full rounded-md border border-[#e2e8e0] overflow-hidden bg-[#f1f5f3]"
    />
  );
};
