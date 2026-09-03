"use client";

/* eslint-disable @typescript-eslint/no-require-imports */
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

import type { Lead } from "@/domain/repositories/ILeadRepository";

function markerColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#94a3b8";
}

interface LeadsMapProps {
  leads: Lead[];
  center?: [number, number];
  zoom?: number;
  height?: number | string;
  onSelect?: (lead: Lead) => void;
}

export default function LeadsMap({ leads, center, zoom = 13, height = 520, onSelect }: LeadsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const mapCenter: [number, number] = center ?? (leads[0] ? [leads[0].latitude, leads[0].longitude] : [-27.5954, -48.548]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const L = require("leaflet");

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });

    const map = L.map(containerRef.current).setView(mapCenter, zoom);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    leads.forEach((lead) => {
      const color = markerColor(lead.score);
      const radius = Math.max(10, Math.min(22, lead.score / 5));
      const marker = L.circleMarker([lead.latitude, lead.longitude], {
        radius,
        fillColor: color,
        color,
        weight: 1.5,
        fillOpacity: 0.7,
      }).addTo(map);

      const popup = document.createElement("div");
      const nameEl = document.createElement("strong");
      nameEl.textContent = lead.name;
      const br1 = document.createElement("br");
      const scoreEl = document.createTextNode(`Score: ${lead.score}`);
      const br2 = document.createElement("br");
      const addrEl = document.createTextNode(lead.address ?? "");
      popup.append(nameEl, br1, scoreEl, br2, addrEl);
      marker.bindPopup(popup);

      if (onSelect) {
        marker.on("click", () => onSelect(lead));
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ height, width: "100%", borderRadius: "0.5rem" }} />;
}
