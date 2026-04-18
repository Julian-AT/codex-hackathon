'use client';

import {
  LayoutDashboard,
  Users,
  ListChecks,
  Activity,
  BarChart3,
  Timer,
  Rocket,
  Bug,
  BriefcaseBusiness,
  ShieldCheck,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

const NAV = [
  { id: 'section-run', label: 'Run pipeline', icon: LayoutDashboard },
  { id: 'section-briefing', label: 'Executive summary', icon: BriefcaseBusiness },
  { id: 'section-orchestration', label: 'Orchestration', icon: Users },
  { id: 'section-tasks', label: 'Task results', icon: ListChecks },
  { id: 'section-training', label: 'Training', icon: Activity },
  { id: 'section-eval', label: 'Evaluation', icon: BarChart3 },
  { id: 'section-latency', label: 'Latency', icon: Timer },
  { id: 'section-deploy', label: 'Deploy', icon: Rocket },
  { id: 'section-observability', label: 'Observability', icon: Bug },
  { id: 'section-eval', label: 'Offline proof', icon: ShieldCheck },
] as const;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border px-2 py-4">
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3 group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.85),rgba(59,130,246,0.85))] text-slate-950">
              <LayoutDashboard className="size-4" />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <div className="text-sm font-semibold tracking-tight text-white">Control Room</div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                Offline Specialist
              </div>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Sections</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    className="w-full rounded-xl text-slate-300 transition-colors hover:bg-white/5 hover:text-white data-[active=true]:bg-white/8 data-[active=true]:text-white"
                    onClick={() => scrollToId(id)}
                    tooltip={label}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
