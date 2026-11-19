/**
 * Haros HRMIS - Collapsible Left-Hand Navigation Sidebar
 * 16 Main civil service destinations with notification badges and high-contrast active state
 */

import React from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  ArrowRightLeft,
  Award,
  UserPlus,
  CalendarDays,
  Clock,
  GraduationCap,
  TrendingUp,
  CreditCard,
  Hourglass,
  Scale,
  FileSpreadsheet,
  UserCog,
  Settings,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BrandCrest } from '../common/BrandCrest';
import { useInstitutionInfo } from '../../hooks/useInstitutionInfo';

export type NavModuleId =
  | 'dashboard'
  | 'staff'
  | 'organization'
  | 'movements'
  | 'promotions'
  | 'recruitment'
  | 'leave'
  | 'attendance'
  | 'training'
  | 'performance'
  | 'payroll'
  | 'retirement'
  | 'disciplinary'
  | 'establishment'
  | 'reports'
  | 'users'
  | 'settings';

interface NavigationSidebarProps {
  currentModule: NavModuleId;
  onSelectModule: (moduleId: NavModuleId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  pendingMovementsCount: number;
  retiringSoonCount: number;
  promotionEligibleCount: number;
}

interface NavItem {
  id: NavModuleId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeColor?: string;
  permission?: string;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  currentModule,
  onSelectModule,
  collapsed,
  onToggleCollapse,
  pendingMovementsCount,
  retiringSoonCount,
  promotionEligibleCount,
}) => {
  const { hasPermission } = useAuth();
  const { institutionName, institutionCountry } = useInstitutionInfo();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard & Analytics', icon: LayoutDashboard },
    { id: 'staff', label: 'Staff Management', icon: Users, permission: 'STAFF_VIEW' },
    { id: 'organization', label: 'Organization Structure', icon: Building2 },
    {
      id: 'movements',
      label: 'Staff Movements',
      icon: ArrowRightLeft,
      badge: pendingMovementsCount,
      badgeColor: 'bg-amber-500 text-slate-900',
    },
    {
      id: 'promotions',
      label: 'Promotions & Progression',
      icon: Award,
      badge: promotionEligibleCount,
      badgeColor: 'bg-emerald-600 text-white',
    },
    { id: 'recruitment', label: 'Recruitment & Appt.', icon: UserPlus },
    { id: 'leave', label: 'Leave Management', icon: CalendarDays },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'training', label: 'Training & Development', icon: GraduationCap },
    { id: 'performance', label: 'Performance Appraisals', icon: TrendingUp },
    { id: 'payroll', label: 'Payroll & Compensation', icon: CreditCard },
    {
      id: 'retirement',
      label: 'Retirement & Separation',
      icon: Hourglass,
      badge: retiringSoonCount,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'disciplinary',
      label: 'Disciplinary Records',
      icon: ShieldAlert,
      permission: 'CONFIDENTIAL_VIEW',
    },
    { id: 'establishment', label: 'Establishment & Cadre', icon: Scale },
    { id: 'reports', label: 'Reports & Analytics', icon: FileSpreadsheet },
    { id: 'users', label: 'User & Access (RBAC)', icon: UserCog },
    { id: 'settings', label: 'System Configuration', icon: Settings },
  ];

  return (
    <aside
      className={`bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col transition-all duration-200 select-none shrink-0 no-print ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Sidebar Action: Module Title / Collapse Toggle */}
      <div className="h-11 px-3 flex items-center justify-between border-b border-slate-800 text-xs font-semibold text-slate-400">
        {!collapsed && <span className="uppercase tracking-wider">System Modules</span>}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors ml-auto"
          title={collapsed ? 'Expand Navigation' : 'Collapse Navigation'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Items List */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentModule === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectModule(item.id)}
              className={`w-full flex items-center rounded-md px-2.5 py-2 text-xs font-medium transition-colors group relative ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                } ${collapsed ? 'mx-auto' : 'mr-3'}`}
              />

              {!collapsed && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}

              {/* Notification Badges */}
              {item.badge && item.badge > 0 ? (
                <span
                  className={`ml-auto px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    item.badgeColor || 'bg-blue-500 text-white'
                  } ${collapsed ? 'absolute top-1 right-1' : ''}`}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Bottom Environment Notice & Crest */}
      {!collapsed ? (
        <div className="p-3 border-t border-slate-800 flex items-center gap-2.5 text-[10px] text-slate-500 leading-tight">
          <BrandCrest
            sizeClass="w-8 h-8"
            className="border border-amber-400/40 bg-slate-800"
            fallbackIconClassName="w-4 h-4 text-amber-400"
          />
          <div className="min-w-0">
            <div className="font-semibold text-slate-300">Haros Suite v1.0 LTS</div>
            <div className="truncate" title={`${institutionCountry} · ${institutionName}`}>
              {institutionName}
            </div>
            <div className="text-emerald-500 mt-0.5">Air-Gapped Local Storage</div>
          </div>
        </div>
      ) : (
        <div
          className="py-3 border-t border-slate-800 flex justify-center"
          title={`${institutionCountry} · ${institutionName}`}
        >
          <BrandCrest
            sizeClass="w-8 h-8"
            className="border border-amber-400/40 bg-slate-800"
            fallbackIconClassName="w-4 h-4 text-amber-400"
          />
        </div>
      )}
    </aside>
  );
};
