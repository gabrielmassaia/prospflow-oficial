export interface OsmTags {
  amenity?: string[];
  shop?: string[];
  craft?: string[];
  tourism?: string[];
  office?: string[];
  leisure?: string[];
}

export interface GeoSearchParams {
  latitude: number;
  longitude: number;
  radiusKm: number;
  keywords: string[];
  osmTags?: OsmTags;
  maxResults: number;
}

export interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  phone?: string;
  website?: string;
  tags: Record<string, string>;
}

export interface IGeoService {
  search(params: GeoSearchParams): Promise<GeoResult[]>;
}
