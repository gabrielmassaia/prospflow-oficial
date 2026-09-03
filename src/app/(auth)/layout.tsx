import { BarChart2, Crosshair, MapPin, Shield, Sparkles } from "lucide-react";

const features = [
  {
    icon: MapPin,
    title: "Busca geolocalizada de leads",
    description: "Encontre empresas por nicho e localização em segundos via mapa interativo.",
  },
  {
    icon: Sparkles,
    title: "Diagnóstico e mensagem com IA",
    description: "Gere análises do negócio e mensagens personalizadas automaticamente.",
  },
  {
    icon: BarChart2,
    title: "Funil comercial completo",
    description: "Acompanhe cada lead do primeiro contato até o fechamento.",
  },
  {
    icon: Shield,
    title: "Multi-agências com isolamento",
    description: "Gerencie múltiplos clientes com dados 100% separados e seguros.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen lg:h-screen">
      {/* ── Painel esquerdo — brand (50%) ──────────────────────────── */}
      <div className="bg-primary relative hidden overflow-hidden lg:flex lg:w-1/2">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/[0.05]" />
        <div className="absolute -bottom-40 -left-20 h-[480px] w-[480px] rounded-full bg-white/[0.05]" />
        <div className="absolute right-10 bottom-32 h-52 w-52 rounded-full bg-white/[0.05]" />

        <div className="relative flex flex-1 flex-col p-12 xl:p-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Crosshair className="h-[15px] w-[15px] text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">ProspFlow</span>
          </div>

          {/* Tagline */}
          <div className="mt-12">
            <h2 className="text-[2.2rem] leading-[1.15] font-bold tracking-tight text-white xl:text-[2.6rem]">
              Prospecte mais,
              <br />
              feche mais.
            </h2>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-white/65 xl:text-[15px]">
              O sistema de prospecção ativa para agências de marketing digital que querem crescer
              sem depender de indicações.
            </p>

            {/* Features */}
            <ul className="mt-10 space-y-5">
              {features.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <Icon className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-white">{title}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <p className="mt-12 text-[11px] text-white/35">
            © 2025 ProspFlow · Todos os direitos reservados
          </p>
        </div>
      </div>

      {/* ── Painel direito — form (50%) ─────────────────────────────── */}
      <div className="flex flex-1 flex-col lg:w-1/2 lg:flex-none">
        {/* Dot-grid background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden lg:block lg:w-1/2"
          style={{
            backgroundImage:
              "radial-gradient(circle, oklch(0.511 0.243 264 / 0.06) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Mobile header */}
        <div className="border-border flex h-14 items-center gap-2.5 border-b px-6 lg:hidden">
          <div className="bg-primary flex h-7 w-7 items-center justify-center rounded-lg">
            <Crosshair className="text-primary-foreground h-[13px] w-[13px]" strokeWidth={2.5} />
          </div>
          <span className="text-foreground text-[13px] font-semibold tracking-tight">
            ProspFlow
          </span>
        </div>

        {/* Form area */}
        <div className="relative flex flex-1 items-center justify-center p-8">
          {/* Card container */}
          <div className="border-border/60 bg-card w-full max-w-[400px] rounded-2xl border p-8 shadow-md">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
