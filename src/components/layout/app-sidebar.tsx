import { Link, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  FileSearch,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { APP_NAME } from "#/lib/constants";
import { useAuth } from "#/components/auth/auth-provider";
import { Badge } from "#/components/ui/badge";
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
} from "#/components/ui/sidebar";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tracker", label: "Tracker", icon: ClipboardList },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/audit", label: "Audit Log", icon: FileSearch },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { auth } = useAuth();

  const primaryRole = auth?.roles[0] ?? "admin";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <img src="/logo192.png" alt="Logo" className="h-8 w-8 rounded-md group-data-[collapsible=icon]:hidden" />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-tight">
              {APP_NAME}
            </span>
            <span className="text-xs text-sidebar-foreground/70">
              Compliance
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.to);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.to}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex flex-col gap-1 group-data-[collapsible=icon]:items-center">
          <Badge variant="secondary" className="w-fit capitalize">
            {primaryRole}
          </Badge>
          <span className="truncate text-xs text-sidebar-foreground/80 group-data-[collapsible=icon]:hidden">
            {auth?.email}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
