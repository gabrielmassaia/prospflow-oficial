import { Crosshair } from "lucide-react";

import { requireCompany, requireUser } from "@/lib/tenant";
import { AppSidebar } from "@/components/layout/Sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { company } = await requireCompany(user.id);

  return (
    <SidebarProvider className="bg-background h-screen overflow-hidden">
      <AppSidebar user={{ name: user.name, email: user.email }} company={company} />
      <SidebarInset className="overflow-y-auto">
        <header className="border-sidebar-border bg-sidebar flex h-14 shrink-0 items-center gap-2.5 border-b px-4 md:hidden">
          <SidebarTrigger />
          <div className="bg-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
            <Crosshair className="text-primary-foreground h-[15px] w-[15px]" strokeWidth={2.5} />
          </div>
          <span className="text-sidebar-foreground text-[13px] font-semibold tracking-tight">
            ProspFlow
          </span>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
