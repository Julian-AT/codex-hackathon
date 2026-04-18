'use client';

import {
  LayoutDashboard,
  Radio,
  Users,
  ListChecks,
  Activity,
  BarChart3,
  Timer,
  GitBranch,
  Rocket,
  Bug,
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
  { id: 'section-tier', label: 'Demo tier', icon: Radio },
  { id: 'section-orchestration', label: 'Orchestration', icon: Users },
  { id: 'section-tasks', label: 'Task results', icon: ListChecks },
  { id: 'section-training', label: 'Training', icon: Activity },
  { id: 'section-eval', label: 'Evaluation', icon: BarChart3 },
  { id: 'section-latency', label: 'Latency', icon: Timer },
  { id: 'section-sankey', label: 'Distillation', icon: GitBranch },
  { id: 'section-deploy', label: 'Deploy', icon: Rocket },
  { id: 'section-observability', label: 'Observability', icon: Bug },
] as const;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border px-2 py-3">
        <span className="px-2 text-xs font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
          Pipeline
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Jump to</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    className="w-full"
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
