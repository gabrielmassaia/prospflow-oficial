"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Crosshair, LogOut, Map, Tag, Target } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  user: { name: string; email: string };
  company: { name: string };
}

const navItems = [
  { href: "/prospeccao", label: "Prospecção", icon: Target, exact: true },
  { href: "/prospeccao/nichos", label: "Nichos", icon: Tag, exact: false },
  { href: "/prospeccao/campanhas", label: "Campanhas", icon: Map, exact: false },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function AppSidebar({ user, company }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  const initials = getInitials(user.name);

  return (
    <Sidebar>
      <SidebarHeader className="border-sidebar-border h-14 flex-row items-center gap-2.5 border-b px-4">
        <div className="bg-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          <Crosshair className="text-primary-foreground h-[15px] w-[15px]" strokeWidth={2.5} />
        </div>
        <span className="text-sidebar-foreground text-[13px] font-semibold tracking-tight">
          ProspFlow
        </span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon, exact }) => {
                const active = exact
                  ? pathname === href
                  : pathname === href || pathname.startsWith(href + "/");
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton isActive={active} render={<Link href={href} />}>
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1 py-1">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sidebar-foreground truncate text-[13px] leading-tight font-medium">
              {user.name}
            </p>
            <p className="text-muted-foreground truncate text-[11px] leading-tight">
              {company.name}
            </p>
          </div>
          <Button
            onClick={handleLogout}
            title="Sair"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
          >
            <LogOut className="h-[15px] w-[15px]" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
