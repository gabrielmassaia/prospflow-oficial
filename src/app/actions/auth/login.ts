"use server";

import { z } from "zod";

import { auth } from "@/lib/auth";
import { translateAuthError } from "@/lib/auth-errors";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export async function loginAction(formData: {
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = loginSchema.safeParse(formData);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const response = await auth.api.signInEmail({ body: parsed.data, asResponse: true });

  if (!response.ok) {
    const err = (await response.json()) as { code?: string; message?: string };
    return { ok: false, error: translateAuthError(err, "Credenciais inválidas") };
  }

  return { ok: true };
}
