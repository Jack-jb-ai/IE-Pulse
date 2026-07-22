import {
  Activity,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  Cog,
  Factory,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Gauge,
  GitFork,
  Home,
  Inbox,
  Kanban,
  Layers,
  LayoutDashboard,
  LineChart,
  LucideIcon,
  MapPin,
  Microscope,
  Pencil,
  Settings2,
  TableProperties,
  Timer,
  Truck,
  UserCheck,
  Wrench
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppId = 'pulse' | 'ole' | 'fsms' | 'ebuild' | 'iebaseline' | 'cycle-time' | 'ppqt' | 'lbr' | 'ipk' | 'machine-mover' | 'tools';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** If true, only show when sidebar is expanded (e.g. sub-items) */
  sub?: boolean;
  /** If true (default), only active on exact match. Set false to keep active on `to/*` sub-routes. */
  exact?: boolean;
}

export interface AppConfig {
  id: AppId;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind color class for the accent dot / badge */
  color: string;
  /** bg color for the icon container in the switcher */
  iconBg: string;
  /** URL prefix the app is deployed under, e.g. /ietools/ole */
  basename: string;
  /** Section in the Google-style AppSwitcher grid (e.g. 'Analytics', 'Operations'). */
  category?: string;
  navItems: NavItem[];
}

// ─── App Definitions ──────────────────────────────────────────────────────────

export const APPS: AppConfig[] = [
  {
    id: 'pulse',
    label: 'IE Pulse',
    description: 'Production monitoring dashboard',
    icon: Activity,
    color: 'text-blue-500',
    iconBg: 'bg-blue-500/15',
    basename: '/ietools/pulse',
    category: 'Analytics',
    navItems: [
      { label: 'Overview', to: '/pulse/overview', icon: Home },
      { label: 'Plants / Layouts', to: '/pulse/plants', icon: MapPin },
      { label: 'Workcells', to: '/pulse/workcells', icon: Factory },
      { label: 'Reports', to: '/pulse/reports', icon: LineChart },
      { label: 'Report A', to: '/pulse/report-a', icon: Gauge },
      { label: 'Documents', to: '/pulse/documents', icon: FileText },
    ],
  },
  {
    id: 'ole',
    label: 'OLE',
    description: 'Overall line efficiency analytics',
    icon: UserCheck,
    color: 'text-emerald-500',
    iconBg: 'bg-emerald-500/15',
    basename: '/ietools/ole',
    category: 'Analytics',
    navItems: [
      { label: 'Map', to: '/ole/map', icon: MapPin },
      { label: 'Report', to: '/ole/report', icon: LineChart, exact: false },
      { label: '4Q Generator', to: '/ole/4q', icon: FileSpreadsheet },
      { label: 'Analysis', to: '/ole/analysis', icon: Microscope },
      // { label: 'Home 0', to: '/ole', icon: TrendingUp },
      { label: 'Standard Man-Hour', to: '/ole/smh', icon: FlaskConical },
      // { label: 'Home 1', to: '/ole/home1', icon: TrendingUp },
      // { label: 'Home 2', to: '/ole/home2', icon: TrendingUp },
      // { label: 'Home 3', to: '/ole/home3', icon: TrendingUp },
      // { label: 'Home 5', to: '/ole/home5', icon: TrendingUp },
      // { label: 'Downtime Management', to: '/ole/downtime', icon: AlertTriangle },
      // { label: 'WC Transfer Man-Hour', to: '/ole/transfer', icon: Users },
      // { label: 'API Test', to: '/ole-mart-api', icon: Database },
    ],
  },
  {
    id: 'cycle-time',
    label: 'Cycle Time',
    description: 'Cycle time analysis and reporting',
    icon: Timer,
    color: 'text-emerald-500',
    iconBg: 'bg-emerald-500/15',
    basename: '/ietools/cycle-time',
    category: 'Analytics',
    navItems: [
      { label: 'Home', to: '/cycle-time/workcells', icon: Home },
      // { label: 'Incompletion Report', to: '/cycle-time/incompletion', icon: ClipboardList },
      { label: 'Incompletion Report', to: '/cycle-time/plant-runners', icon: Building2 },
      // Hidden from the sidebar (routes still work):
      //  • Assemblies → now lives in the workcell Breakdown→Assemblies tab
      //  • Data → still reachable directly at /cycle-time/data
      // { label: 'Assemblies', to: '/cycle-time/assemblies', icon: Boxes },
      // { label: 'Data', to: '/cycle-time/data', icon: Database },
    ],
  },
  {
    id: 'ppqt',
    label: 'PPQT',
    description: 'Capacity sizing and Takt time analysis',
    icon: Layers,
    color: 'text-emerald-500',
    iconBg: 'bg-emerald-500/15',
    basename: '/ietools/ppqt',
    category: 'Analytics',
    navItems: [
      { label: 'Dashboard', to: '/ppqt', icon: LayoutDashboard, exact: false },
      { label: 'Testing Dashboard', to: '/ppqt/dash2', icon: FlaskConical },
      { label: 'Workcells', to: '/ppqt/workcell', icon: Factory },
      { label: 'Config', to: '/ppqt/config', icon: Settings2 },
    ],
  },
  {
    id: 'lbr',
    label: 'LBR',
    description: 'Line Balance Rate — workload balance across stations',
    icon: GitFork,
    color: 'text-emerald-500',
    iconBg: 'bg-emerald-500/15',
    basename: '/ietools/lbr',
    category: 'Analytics',
    // Workcell-scoped pages (profile / assembly / playbook / workcell config) are
    // reached by drilling in from Home; the sidebar only carries always-valid
    // static routes — same approach as IPK.
    navItems: [
      { label: 'Home', to: '/lbr', icon: LayoutDashboard },
      { label: 'Global Config', to: '/lbr/config', icon: Cog },
    ],
  },
  {
    id: 'ipk',
    label: 'IPK',
    description: 'In-Process Kanban simulation & trolley sizing',
    icon: Kanban,
    color: 'text-emerald-500',
    iconBg: 'bg-emerald-500/15',
    basename: '/ietools/ipk',
    category: 'Analytics',
    // Workcell-scoped pages (Simulate / History / Matrix / Config) are reached
    // from the IPKDashboard nav cards + per-page sub-nav once a workcell is
    // selected, so the sidebar only carries the always-valid Home entry.
    navItems: [
      { label: 'Home', to: '/ipk', icon: LayoutDashboard },
      { label: 'Workcells', to: '/ipk/workcells', icon: Factory },
    ],
  },
  {
    id: 'fsms',
    label: 'FSMS',
    description: 'Floor space management system',
    icon: Building2,
    color: 'text-violet-500',
    iconBg: 'bg-violet-500/15',
    basename: '/ietools/fsms',
    category: 'Operations',
    navItems: [
      { label: 'Map', to: '/fsms/plants', icon: MapPin },
      { label: 'Dashboard', to: '/fsms/dashboard', icon: LayoutDashboard, exact: false },
      { label: 'Submissions', to: '/fsms/submissions', icon: Inbox, exact: false },
      { label: 'Layout', to: '/fsms/floor-map', icon: ClipboardList },
      { label: 'Layout Editor', to: '/fsms/editor', icon: Pencil },
      { label: 'Bay Management', to: '/fsms/bays', icon: TableProperties },
    ],
  },
  {
    id: 'machine-mover',
    label: 'Machine Mover',
    description: 'Request, approve and track machine moves',
    icon: Truck,
    color: 'text-blue-500',
    iconBg: 'bg-blue-500/15',
    basename: '/ietools/machine-mover',
    category: 'Operations',
    navItems: [
      { label: 'Requests', to: '/machine-mover', icon: ClipboardList },
      { label: 'Approvals', to: '/machine-mover/approvals', icon: UserCheck },
      { label: 'Reports', to: '/machine-mover/reports', icon: FileText },
    ],
  },
  {
    id: 'ebuild',
    label: 'eBuild Plan',
    description: 'Demand & output planning',
    icon: CalendarDays,
    color: 'text-orange-500',
    iconBg: 'bg-orange-500/15',
    basename: '/ietools/ebuild',
    category: 'Operations',
    navItems: [
      { label: 'Build Plan', to: '/ebuild', icon: Home },
    ],
  },
  {
    id: 'iebaseline',
    label: 'IE Baseline',
    description: 'Learn everything about IE Baseline',
    icon: BookOpen,
    color: 'text-amber-500',
    iconBg: 'bg-amber-500/15',
    basename: '/ietools/iebaseline',
    category: 'Learning & Development',
    navItems: [
      { label: 'Overview', to: '/iebaseline', icon: Home },
      { label: 'Edit', to: '/iebaseline/edit', icon: Pencil },
      { label: 'Assign', to: '/iebaseline/assign', icon: UserCheck },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    description: 'Various tools for IE analysis',
    icon: Wrench,
    color: 'text-blue-500',
    iconBg: 'bg-blue-500/15',
    basename: '/ietools/tools',
    category: 'Tools',
    navItems: [
      { label: 'Overview', to: '/tools', icon: Home },
      { label: 'Edit', to: '/tools/edit', icon: Pencil },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const getApp = (id: AppId): AppConfig =>
  APPS.find(a => a.id === id) ?? APPS[0];
