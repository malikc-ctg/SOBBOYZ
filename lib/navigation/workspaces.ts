import {
  LayoutDashboard,
  Briefcase,
  Repeat,
  Globe,
  ClipboardList,
  ClipboardCheck,
  Users,
  Waves,
  Home,
  Building2,
  PhoneCall,
  UserCheck,
  UserPlus,
  Package,
  TrendingUp,
  DollarSign,
  Shield,
  Settings,
  Radio,
  Map,
  type LucideIcon,
} from 'lucide-react';

export type WorkspaceId = 'dispatch' | 'sales' | 'workforce' | 'finance';

export interface WorkspaceNavItem {
  id: string;
  href: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: LucideIcon;
  badgeKey?: 'unassignedJobs' | 'activeJobs' | 'newLeads' | 'pendingApplications';
  exact?: boolean;
  group?: string;
  fullscreenOnLaunch?: boolean;
}

export interface WorkspaceConfig {
  id: WorkspaceId;
  name: string;
  shortName: string;
  tagline: string;
  shortcut: string;
  defaultHref: string;
  icon: LucideIcon;
  accentClass: string;
  badgeBgClass: string;
  restrictedToLeadership?: boolean;
  items: WorkspaceNavItem[];
}

export const WORKSPACES: WorkspaceConfig[] = [
  {
    id: 'dispatch',
    name: 'Dispatch & Field Ops',
    shortName: 'Dispatch',
    tagline: 'Live field command, scheduling & zones',
    shortcut: '1',
    defaultHref: '/sobadmin?app=dispatch',
    icon: Radio,
    accentClass: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
    badgeBgClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    items: [
      {
        id: 'command-center',
        href: '/sobadmin?app=dispatch',
        label: 'Command Queue',
        shortLabel: 'Command',
        description: 'Live dispatch queue, active operations & daily metrics',
        icon: LayoutDashboard,
        badgeKey: 'unassignedJobs',
        exact: true,
        group: 'Live Operations',
      },
      {
        id: 'live-map',
        href: '/sobadmin?app=dispatch&view=map',
        label: 'Live GPS Map',
        shortLabel: 'Live Map',
        description: 'Real-time GPS tracking of cleaners & active jobs',
        icon: Map,
        badgeKey: 'activeJobs',
        exact: true,
        group: 'Live Operations',
      },
      {
        id: 'jobs',
        href: '/sobadmin/jobs',
        label: 'Jobs & Schedule',
        shortLabel: 'Jobs',
        description: 'All bookings, dispatch assignments & status workflows',
        icon: Briefcase,
        group: 'Scheduling',
      },
      {
        id: 'recurring',
        href: '/sobadmin/recurring',
        label: 'Recurring Engine',
        shortLabel: 'Recurring',
        description: 'Automated weekly, bi-weekly & monthly service schedules',
        icon: Repeat,
        group: 'Scheduling',
      },
      {
        id: 'zones',
        href: '/sobadmin/zones',
        label: 'Service Zones',
        shortLabel: 'Zones',
        description: 'Regional coverage polygons & territory assignment',
        icon: Globe,
        group: 'Scheduling',
      },
    ],
  },
  {
    id: 'sales',
    name: 'Sales OS & CRM',
    shortName: 'Sales',
    tagline: 'Inbound CRM & Outbound Sales OS',
    shortcut: '2',
    defaultHref: '/sobadmin/sales',
    icon: Waves,
    accentClass: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30',
    badgeBgClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    items: [
      {
        id: 'sales-launchpad',
        href: '/sobadmin/sales',
        label: 'Sales & CRM Hub',
        shortLabel: 'Sales Hub',
        description: 'Inbound CRM & Outbound Sales OS Launchpad',
        icon: Waves,
        exact: true,
        group: 'Sales Hub',
      },
      {
        id: 'leads',
        href: '/sobadmin/leads',
        label: 'Inbound Leads',
        shortLabel: 'Inbound Leads',
        description: 'New inquiries, instant pricing quotes & conversion queue',
        icon: ClipboardList,
        badgeKey: 'newLeads',
        group: 'Inbound CRM',
      },
      {
        id: 'tenders',
        href: '/sobadmin/tenders',
        label: 'Vendor Lists & Tenders',
        shortLabel: 'Vendor & Tenders',
        description: 'Commercial subcontractor pre-qualification & active project bids',
        icon: ClipboardCheck,
        group: 'Inbound CRM',
      },
      {
        id: 'customers',
        href: '/sobadmin/customers',
        label: 'Customers & Accounts',
        shortLabel: 'Customers',
        description: 'Residential & commercial accounts, balances & history',
        icon: Users,
        group: 'Inbound CRM',
      },
      {
        id: 'sales-phone',
        href: '/sobadmin/sales?app=phone',
        label: 'B2B Phone Sales',
        shortLabel: 'B2B Phone',
        description: 'Outbound inside tele-sales Kanban, Touch Centre & Quo AI sync',
        icon: PhoneCall,
        exact: true,
        group: 'Outbound Sales OS',
      },
      {
        id: 'sales-residential',
        href: '/sobadmin/sales?app=residential',
        label: 'KnockLog Residential',
        shortLabel: 'Residential',
        description: 'Door-to-door territory canvassing & GPS pin logging',
        icon: Home,
        exact: true,
        group: 'Outbound Sales OS',
        fullscreenOnLaunch: true,
      },
      {
        id: 'sales-commercial',
        href: '/sobadmin/sales?app=commercial',
        label: 'KnockLog Commercial',
        shortLabel: 'Commercial',
        description: 'Plaza & storefront B2B field canvassing',
        icon: Building2,
        exact: true,
        group: 'Outbound Sales OS',
        fullscreenOnLaunch: true,
      },
    ],
  },
  {
    id: 'workforce',
    name: 'Workforce & Supply',
    shortName: 'Workforce',
    tagline: 'Cleaner roster, timesheets, hiring & inventory',
    shortcut: '3',
    defaultHref: '/sobadmin/employees',
    icon: UserCheck,
    accentClass: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    badgeBgClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    items: [
      {
        id: 'employees',
        href: '/sobadmin/employees',
        label: 'Cleaners & Roster',
        shortLabel: 'Cleaners',
        description: 'Active service providers, hourly wages & timesheet review',
        icon: UserCheck,
        exact: true,
        group: 'Team Management',
      },
      {
        id: 'applications',
        href: '/sobadmin/employees/applications',
        label: 'Applicant Pipeline',
        shortLabel: 'Applicants',
        description: 'Review incoming cleaner applications & onboarding status',
        icon: UserPlus,
        badgeKey: 'pendingApplications',
        group: 'Team Management',
      },
      {
        id: 'supply',
        href: '/sobadmin/supply',
        label: 'Supply & Equipment OS',
        shortLabel: 'Supply',
        description: 'Chemical inventory, kit allocations, restocks & equipment',
        icon: Package,
        group: 'Inventory & Fleet',
      },
    ],
  },
  {
    id: 'finance',
    name: 'Finance & Admin',
    shortName: 'Finance',
    tagline: 'P&L, payroll, QBO accounting, audit & settings',
    shortcut: '4',
    defaultHref: '/sobadmin/finance',
    icon: TrendingUp,
    accentClass: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    badgeBgClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    restrictedToLeadership: true,
    items: [
      {
        id: 'finance',
        href: '/sobadmin/finance',
        label: 'Finance & P&L Suite',
        shortLabel: 'Finance',
        description: 'Unit economics, QBO sync, ad spend P&L & cleaner payroll',
        icon: TrendingUp,
        group: 'Financials',
      },
      {
        id: 'payouts',
        href: '/sobadmin/payouts',
        label: 'Vendor & Cleaner Payouts',
        shortLabel: 'Payouts',
        description: 'QuickBooks vendor disbursements & transaction ledger',
        icon: DollarSign,
        group: 'Financials',
      },
      {
        id: 'audit',
        href: '/sobadmin/audit',
        label: 'Audit & Call Vault',
        shortLabel: 'Audit Trail',
        description: 'System event history, job photo evidence & Quo call logs',
        icon: Shield,
        group: 'Governance',
      },
      {
        id: 'settings',
        href: '/sobadmin/settings',
        label: 'Platform Settings',
        shortLabel: 'Settings',
        description: 'Pricing rules, QuickBooks connection & system configuration',
        icon: Settings,
        group: 'Governance',
      },
    ],
  },
];

export const WORKSPACE_MAP: Record<WorkspaceId, WorkspaceConfig> = {
  dispatch: WORKSPACES[0],
  sales: WORKSPACES[1],
  workforce: WORKSPACES[2],
  finance: WORKSPACES[3],
};

export interface UserProfileContext {
  id?: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  title?: string | null;
}

/**
 * Determines which workspace owns a given pathname.
 */
export function resolveWorkspaceFromPath(pathname: string): WorkspaceId {
  if (
    pathname.startsWith('/sobadmin/leads') ||
    pathname.startsWith('/sobadmin/tenders') ||
    pathname.startsWith('/sobadmin/customers') ||
    pathname.startsWith('/sobadmin/sales') ||
    pathname.startsWith('/sales')
  ) {
    return 'sales';
  }

  if (
    pathname.startsWith('/sobadmin/employees') ||
    pathname.startsWith('/sobadmin/teams') ||
    pathname.startsWith('/sobadmin/supply')
  ) {
    return 'workforce';
  }

  if (
    pathname.startsWith('/sobadmin/finance') ||
    pathname.startsWith('/sobadmin/payouts') ||
    pathname.startsWith('/sobadmin/audit') ||
    pathname.startsWith('/sobadmin/settings')
  ) {
    return 'finance';
  }

  return 'dispatch';
}

/**
 * Checks if a user has leadership/admin privileges to view restricted Finance & Admin modules.
 */
export function isLeadershipProfile(profile?: UserProfileContext | null): boolean {
  if (!profile) return true;
  const titleLower = (profile.title || '').toLowerCase();
  const roleLower = (profile.role || '').toLowerCase();

  if (titleLower.includes('managing partner') || titleLower.includes('founder') || titleLower.includes('director')) {
    return true;
  }
  if (
    titleLower.includes('account executive') ||
    titleLower.includes('sales rep') ||
    roleLower === 'sales'
  ) {
    return false;
  }
  return roleLower === 'admin' || !profile.role;
}

/**
 * Returns the list of workspaces accessible to the current user profile.
 */
export function getAllowedWorkspacesForUser(profile?: UserProfileContext | null): WorkspaceConfig[] {
  const canViewFinance = isLeadershipProfile(profile);
  if (canViewFinance) return WORKSPACES;
  return WORKSPACES.filter((ws) => !ws.restrictedToLeadership);
}

/**
 * Resolves the post-login landing destination — always boots into the Sea of Blue OS Launchpad (/sobadmin)
 * so the operator can pick their workstation tile.
 */
export function resolvePostLoginDestination(
  _profile?: UserProfileContext | null,
  _savedWorkspaceId?: string | null
): { workspaceId: WorkspaceId; href: string } {
  return { workspaceId: 'dispatch', href: '/sobadmin' };
}

export const STORAGE_KEYS = {
  ACTIVE_WORKSPACE: 'sob_active_workspace_v1',
  LAST_ROUTE_BY_WORKSPACE: 'sob_workspace_routes_v1',
  SIDEBAR_COLLAPSED: 'sob_sidebar_collapsed_v1',
} as const;
