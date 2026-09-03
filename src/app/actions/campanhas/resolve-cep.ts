"use server";

import { z } from "zod";

import { requireCompany, requireUser } from "@/lib/tenant";

const cepSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .refine((s) => s.length === 8, "CEP deve ter 8 dígitos");

const viacepSchema = z.object({
  localidade: z.string().optional(),
  uf: z.string().optional(),
  logradouro: z.string().optional(),
  erro: z.boolean().optional(),
});

const nominatimSchema = z.array(z.object({ lat: z.string(), lon: z.string() }));

type CepData = { city: string; state: string; street: string; latitude: number; longitude: number };
type Result = { ok: true; data: CepData } | { ok: false; error: string };

export async function resolveCepAction(cep: string): Promise<Result> {
  const user = await requireUser();
  await requireCompany(user.id);

  const parsed = cepSchema.safeParse(cep);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const digits = parsed.data;

  try {
    const viacepRes = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const viacep = viacepSchema.parse(await viacepRes.json());
    if (viacep.erro || !viacep.localidade || !viacep.uf) {
      return { ok: false, error: "CEP não encontrado" };
    }

    const city = viacep.localidade;
    const state = viacep.uf;
    const street = viacep.logradouro ?? "";

    const query = encodeURIComponent(`${street || city}, ${city}, ${state}, Brazil`);
    const nominatimRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { "Accept-Language": "pt-BR", "User-Agent": "ProspFlow/1.0" },
    });
    const nominatim = nominatimSchema.parse(await nominatimRes.json());
    const first = nominatim[0];

    return {
      ok: true,
      data: {
        city,
        state,
        street,
        latitude: first ? parseFloat(first.lat) : 0,
        longitude: first ? parseFloat(first.lon) : 0,
      },
    };
  } catch {
    return { ok: false, error: "Erro ao buscar CEP" };
  }
}
