"use client";

/* eslint-disable @typescript-eslint/no-require-imports */
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

import type { Campaign } from "@/domain/repositories/ICampaignRepository";
import type { Lead } from "@/domain/repositories/ILeadRepository";

function markerColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#94a3b8";
}

interface CampaignMapProps {
  campaign: Campaign;
  leads: Lead[];
  height?: number | string;
}

export default function CampaignMap({ campaign, leads, height = 560 }: CampaignMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const L = require("leaflet");

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });

    const center: [number, number] = [campaign.latitude, campaign.longitude];
    const map = L.map(containerRef.current).setView(center, 13);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    L.marker(center).addTo(map).bindPopup(`Centro: ${campaign.city}, ${campaign.state}`);

    leads.forEach((lead) => {
      const color = markerColor(lead.score);
      const radius = Math.max(8, Math.min(18, lead.score / 5));
      const popup = document.createElement("div");
      const nameEl = document.createElement("strong");
      nameEl.textContent = lead.name;
      const br = document.createElement("br");
      const scoreEl = document.createTextNode(`Score: ${lead.score}`);
      popup.append(nameEl, br, scoreEl);
      L.circleMarker([lead.latitude, lead.longitude], {
        radius,
        fillColor: color,
        color,
        weight: 1.5,
        fillOpacity: 0.7,
      })
        .addTo(map)
        .bindPopup(popup);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ height, width: "100%", borderRadius: "0.5rem" }} />;
}
