import type { GeoResult, GeoSearchParams, IGeoService, OsmTags } from "@/domain/services/IGeoService";

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export class OverpassGeoService implements IGeoService {
  async search(params: GeoSearchParams): Promise<GeoResult[]> {
    const { latitude: lat, longitude: lon, radiusKm, keywords, osmTags } = params;
    const radiusMeters = radiusKm * 1000;
    const around = `around:${radiusMeters},${lat},${lon}`;

    const lines = ["[out:json][timeout:30][maxsize:2000000];", "("];

    const hasOsmTags = osmTags && Object.values(osmTags).some((v) => Array.isArray(v) && v.length > 0);

    if (hasOsmTags) {
      const tagKeys: (keyof OsmTags)[] = ["amenity", "shop", "craft", "tourism", "office", "leisure"];
      for (const key of tagKeys) {
        const values = osmTags![key];
        if (!values || values.length === 0) continue;
        const regex = values.join("|");
        lines.push(`  node["${key}"~"${regex}"](${around});`);
        lines.push(`  way["${key}"~"${regex}"](${around});`);
      }
    } else if (keywords.length > 0) {
      const nameRegex = keywords.join("|");
      lines.push(`  node["name"~"${nameRegex}",i](${around});`);
      lines.push(`  way["name"~"${nameRegex}",i](${around});`);
    }

    lines.push(");", "out tags center qt 200;");
    const query = lines.join("\n");

    const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

    const messages: Record<number, string> = {
      400: "A query de busca está inválida. Verifique as keywords do nicho.",
      429: "Muitas buscas em pouco tempo. Aguarde alguns segundos e tente novamente.",
      502: "Servidor de busca indisponível. Tentando novamente...",
      503: "Servidor de busca sobrecarregado. Tentando novamente...",
      504: "A busca demorou muito. Tentando servidor alternativo...",
    };

    let lastError = "";
    for (const endpoint of ENDPOINTS) {
      let res: Response;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 35_000);
        res = await fetch(endpoint, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json, text/plain, */*",
            "User-Agent": "ProspFlow/1.0 (prospflow@aivonlabs.com)",
          },
          signal: controller.signal,
        });
        clearTimeout(timer);
      } catch (e) {
        console.error(`[OverpassGeoService] network error on ${endpoint}`, e);
        lastError = "Não foi possível conectar ao servidor de busca.";
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[OverpassGeoService] HTTP ${res.status} on ${endpoint}`, { body });
        lastError = messages[res.status] ?? `Erro ${res.status} no servidor de busca.`;
        if (res.status === 429) break;
        continue;
      }

      let data: OverpassResponse;
      try {
        data = await res.json();
      } catch (e) {
        console.error(`[OverpassGeoService] invalid JSON from ${endpoint}`, e);
        lastError = "O servidor de busca retornou uma resposta inválida.";
        continue;
      }

      const withName = data.elements.filter((el) => el.tags?.name);

      return withName.slice(0, params.maxResults).map((el) => {
        const elLat = el.lat ?? el.center?.lat ?? 0;
        const elLon = el.lon ?? el.center?.lon ?? 0;
        const tags = el.tags ?? {};
        return {
          name: tags.name ?? "",
          latitude: elLat,
          longitude: elLon,
          address: [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", "),
          city: tags["addr:city"] ?? "",
          state: tags["addr:state"] ?? "",
          phone: tags.phone ?? tags["contact:phone"],
          website: tags.website ?? tags["contact:website"],
          tags,
        };
      });
    }

    throw new Error(lastError || "Todos os servidores de busca falharam. Tente novamente em alguns minutos.");
  }
}
