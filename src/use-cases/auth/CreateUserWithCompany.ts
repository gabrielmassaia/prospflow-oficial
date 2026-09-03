import { auth } from "@/lib/auth";
import { translateAuthError } from "@/lib/auth-errors";
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
      const response = await auth.api.signUpEmail({
        body: { name, email, password },
        asResponse: true,
      });

      if (!response.ok) {
        const err = (await response.json()) as { code?: string; message?: string };
        return { ok: false, error: translateAuthError(err, "Erro ao criar usuário") };
      }

      const data = (await response.json()) as { user: { id: string } };
      const userId = data.user.id;

      const slug = slugify(companyName);

      await this.companyRepo.create({ name: companyName, slug, ownerId: userId });

      return { ok: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro inesperado";
      return { ok: false, error: message };
    }
  }
}
