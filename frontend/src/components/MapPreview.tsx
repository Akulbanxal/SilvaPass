import React, { useEffect, useRef } from "react";
import L from "leaflet";

export interface MapFeature {
  geojson: Record<string, any>;
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  weight?: number;
  dashArray?: string;
  label?: string;
}

interface Props {
  geojson?: Record<string, any>;
  comparisonGeojson?: Record<string, any>;
  features?: MapFeature[];
  height?: string;
  zoom?: number;
  center?: [number, number];
  interactive?: boolean;
}

export const MapPreview: React.FC<Props> = ({
  geojson,
  comparisonGeojson,
  features,
  height = "380px",
  center = [-12.5, -54.5],
  zoom = 14,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Add a compact attribution
      L.control
        .attribution({ position: "bottomright", prefix: false })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>')
        .addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    if (layerGroup) {
      layerGroup.clearLayers();
    }

    const bounds = L.latLngBounds([]);

    // 1. Multiple features (e.g. Overview Cadastre)
    if (features && features.length > 0 && layerGroup) {
      features.forEach((feat) => {
        try {
          const layer = L.geoJSON(feat.geojson as any, {
            style: {
              color: feat.color || "#237A57",
              weight: feat.weight || 2.5,
              fillColor: feat.fillColor || "#237A57",
              fillOpacity: feat.fillOpacity !== undefined ? feat.fillOpacity : 0.35,
              dashArray: feat.dashArray,
            },
          });
          if (feat.label) {
            layer.bindTooltip(feat.label, {
              permanent: false,
              direction: "center",
              className: "font-mono text-xs font-semibold px-2 py-1 bg-[#09231B] text-white rounded border border-[#237A57]",
            });
          }
          layer.addTo(layerGroup);
          bounds.extend(layer.getBounds());
        } catch (e) {
          console.error("Leaflet feature parse error:", e);
        }
      });
    }

    // 2. Primary geometry (Emerald Green #237A57)
    if (geojson && layerGroup) {
      try {
        const primaryLayer = L.geoJSON(geojson as any, {
          style: {
            color: "#16805D",
            weight: 3,
            fillColor: "#237A57",
            fillOpacity: 0.35,
          },
        });
        primaryLayer.addTo(layerGroup);
        bounds.extend(primaryLayer.getBounds());
      } catch (e) {
        console.error("Leaflet primary geojson parse error:", e);
      }
    }

    // 3. Comparison geometry (Warning Amber #B7791F dashed)
    if (comparisonGeojson && layerGroup) {
      try {
        const compLayer = L.geoJSON(comparisonGeojson as any, {
          style: {
            color: "#B7791F",
            weight: 2.5,
            dashArray: "5, 5",
            fillColor: "#B7791F",
            fillOpacity: 0.25,
          },
        });
        compLayer.addTo(layerGroup);
        bounds.extend(compLayer.getBounds());
      } catch (e) {
        console.error("Leaflet comparison geojson parse error:", e);
      }
    }

    if (map) {
      setTimeout(() => {
        map.invalidateSize();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [32, 32] });
        }
      }, 50);
    }
  }, [geojson, comparisonGeojson, features, center, zoom]);

  return (
    <div className="relative w-full overflow-hidden rounded-md border border-[#DCE5DE] bg-[#F5F7F4]">
      <div ref={mapContainerRef} style={{ height }} className="w-full" />
    </div>
  );
};
