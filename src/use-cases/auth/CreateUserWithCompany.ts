import { auth } from "@/lib/auth";
import type { ICompanyRepository } from "@/domain/repositories/ICompanyRepository";

interface Input {
  name: string;
  email: string;
  password: string;
  companyName: string;
}

type Result = { ok: true } | { ok: false; error: string };

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export class CreateUserWithCompany {
  constructor(private companyRepo: ICompanyRepository) {}

  async execute({ name, email, password, companyName }: Input): Promise<Result> {
    try {
      // 1. Criar usuário via Better Auth (server-side)
      const response = await auth.api.signUpEmail({
        body: { name, email, password },
        asResponse: true,
      });

      if (!response.ok) {
        const err = (await response.json()) as { message?: string };
        return { ok: false, error: err.message ?? "Erro ao criar usuário" };
      }

      const data = (await response.json()) as { user: { id: string } };
      const userId = data.user.id;

      // 2. Gerar slug da empresa
      const slug = slugify(companyName);

      // 3. Criar empresa + membro em transação
      await this.companyRepo.create({ name: companyName, slug, ownerId: userId });

      return { ok: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro inesperado";
      return { ok: false, error: message };
    }
  }
}