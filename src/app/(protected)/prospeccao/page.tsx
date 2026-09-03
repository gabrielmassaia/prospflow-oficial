import { Target } from "lucide-react";

import { requireCompany, requireUser } from "@/lib/tenant";

export default async function ProspeccaoPage() {
  const user = await requireUser();
  const { company } = await requireCompany(user.id);

  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex flex-1 flex-col p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-foreground text-2xl font-semibold">Prospecção</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Olá, {firstName}. Bem-vindo de volta à{" "}
          <span className="text-foreground font-medium">{company.name}</span>.
        </p>
      </div>

      {/* Empty state */}
      <div className="border-border bg-muted/20 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed py-20">
        <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
          <Target className="text-primary h-6 w-6" />
        </div>
        <h2 className="text-foreground mt-4 text-base font-semibold">Nenhuma campanha ainda</h2>
        <p className="text-muted-foreground mt-1.5 max-w-sm text-center text-sm">
          Na Fase 2 vamos criar campanhas de prospecção com busca geolocalizada e geração de leads
          automática via Cloudflare AI.
        </p>
      </div>
    </div>
  );
}
