/**
 * Haros Human Resource Management Information Suite (HRMIS)
 * STEP 4: Application Shell, Windows 11 Desktop Navigation, Auth & Executive Dashboard
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastContainer } from './components/notifications/ToastContainer';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { TitleBar } from './components/layout/TitleBar';
import { NavigationSidebar, NavModuleId } from './components/layout/NavigationSidebar';
import { StatusBar } from './components/layout/StatusBar';
import { DashboardView } from './components/dashboard/DashboardView';
import { AuditTrailModal } from './components/audit/AuditTrailModal';
import { LoginPage } from './components/auth/LoginPage';
import { SelfServicePasswordModal } from './components/auth/SelfServicePasswordModal';
import { DatabaseInfoModal } from './components/system/DatabaseInfoModal';
import { StaffManagementView } from './components/staff/StaffManagementView';
import { OrganizationView } from './components/organization/OrganizationView';
import { EstablishmentView } from './components/establishment/EstablishmentView';
import { StaffMovementView } from './components/movements/StaffMovementView';
import { PromotionManagementView } from './components/promotions/PromotionManagementView';
import { RecruitmentView } from './components/recruitment/RecruitmentView';
import { LeaveManagementView } from './components/leave/LeaveManagementView';
import { AttendanceManagementView } from './components/attendance/AttendanceManagementView';
import { TrainingManagementView } from './components/training/TrainingManagementView';
import { PerformanceManagementView } from './components/performance/PerformanceManagementView';
import { PayrollManagementView } from './components/payroll/PayrollManagementView';
import { RetirementSeparationView } from './components/retirement/RetirementSeparationView';
import { DisciplinaryManagementView } from './components/disciplinary/DisciplinaryManagementView';
import { ReportsManagementView } from './components/reports/ReportsManagementView';
import { UserManagementView } from './components/users/UserManagementView';
import { SystemSettingsView, SystemSettingsTab } from './components/settings/SystemSettingsView';
import { db } from './db/storage';
import {
  detectWindowsWorkstation,
  detectWorkstationIdentitySync,
  WorkstationIdentity,
} from './services/security/computerRegistrationService';
import { StartupValidationResult } from './types';
import {
  HRMIS_MODULE_DEFINITIONS,
  parseModuleFromLocation,
  VALID_MODULE_IDS,
} from './services/security/permissionService';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

const MainShell: React.FC = () => {
  const {
    currentUser,
    currentRole,
    isAuthenticated,
    allowedModules,
    firstAllowedModule,
    canAccessModule,
    canAccessSubmenu,
    hasPermission,
    logout,
  } = useAuth();
  const [currentModule, setCurrentModule] = useState<NavModuleId>('dashboard');
  const [deniedRouteTarget, setDeniedRouteTarget] = useState<string | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SystemSettingsTab>('config');
  const [settingsTabRequestKey, setSettingsTabRequestKey] = useState(0);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Computer Registration, Activation & Expiry Startup Gate
  const identityRef = useRef<WorkstationIdentity>(detectWorkstationIdentitySync());
  const vaultAvailableRef = useRef<boolean>(true);
  const [startupStatus, setStartupStatus] = useState<StartupValidationResult>(() =>
    db.validateStartupAndClock(identityRef.current, true)
  );

  const refreshValidation = useCallback((): StartupValidationResult => {
    const next = db.validateStartupAndClock(identityRef.current, vaultAvailableRef.current);
    setStartupStatus(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ vaultAvailable }, detectedIdentity] = await Promise.all([
          db.reconcilePermanentVault(),
          detectWindowsWorkstation(),
        ]);
        if (cancelled) return;
        vaultAvailableRef.current = vaultAvailable;
        identityRef.current = detectedIdentity;
        setStartupStatus(db.validateStartupAndClock(detectedIdentity, vaultAvailable));
      } catch {
        if (!cancelled) {
          setStartupStatus(db.validateStartupAndClock(identityRef.current, false));
        }
      }
    })();

    const intervalId = window.setInterval(() => {
      setStartupStatus(db.validateStartupAndClock(identityRef.current, vaultAvailableRef.current));
    }, 30_000);

    const handleFocus = () => {
      setStartupStatus(db.validateStartupAndClock(identityRef.current, vaultAvailableRef.current));
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Modals state
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const syncUrlHash = useCallback((mod: NavModuleId, replace = false) => {
    const nextHash = `#/${mod}`;
    if (window.location.hash !== nextHash) {
      if (replace) {
        window.history.replaceState(null, '', nextHash);
      } else {
        window.history.pushState(null, '', nextHash);
      }
    }
  }, []);

  const navigateToModule = useCallback(
    (targetModule: NavModuleId, options?: { employeeId?: number | null; settingsTab?: SystemSettingsTab; replaceUrl?: boolean }) => {
      if (!isAuthenticated) return;
      if (!canAccessModule(targetModule)) {
        setDeniedRouteTarget(targetModule);
        return;
      }
      if (options?.employeeId !== undefined) {
        setSelectedEmployeeId(options.employeeId);
      } else if (targetModule !== 'staff') {
        setSelectedEmployeeId(null);
      }
      if (options?.settingsTab) {
        setSettingsInitialTab(options.settingsTab);
        setSettingsTabRequestKey((prev) => prev + 1);
      } else if (targetModule === 'settings') {
        setSettingsInitialTab('config');
      }
      setDeniedRouteTarget(null);
      setCurrentModule(targetModule);
      syncUrlHash(targetModule, options?.replaceUrl ?? false);
    },
    [isAuthenticated, canAccessModule, syncUrlHash]
  );

  // Sync URL hash / pathname / query route with RBAC policy on login, URL change, and permission updates
  const wasAuthenticatedRef = useRef<boolean>(false);

  const evaluateCurrentLocationRoute = useCallback(
    (fallbackToDefaultOnDenied = false) => {
      if (!isAuthenticated || !currentUser) return;
      const requested = parseModuleFromLocation(
        window.location.pathname,
        window.location.hash,
        window.location.search
      );

      if (requested) {
        const isKnownModule = (VALID_MODULE_IDS as string[]).includes(requested);
        if (isKnownModule && canAccessModule(requested as NavModuleId)) {
          setDeniedRouteTarget(null);
          setCurrentModule(requested as NavModuleId);
          return;
        }

        if (fallbackToDefaultOnDenied && firstAllowedModule) {
          setDeniedRouteTarget(null);
          setCurrentModule(firstAllowedModule);
          syncUrlHash(firstAllowedModule, true);
          return;
        }

        // Explicit unauthorized or unknown direct URL -> show Access Denied (403)
        setDeniedRouteTarget(requested);
        return;
      }

      // No explicit module in URL: land on user's default permitted module (Dashboard & Analytics when permitted)
      if (firstAllowedModule) {
        setDeniedRouteTarget(null);
        setCurrentModule(firstAllowedModule);
        syncUrlHash(firstAllowedModule, true);
      } else {
        setDeniedRouteTarget('dashboard');
      }
    },
    [isAuthenticated, currentUser, canAccessModule, firstAllowedModule, syncUrlHash]
  );

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      wasAuthenticatedRef.current = false;
      setDeniedRouteTarget(null);
      setCurrentModule('dashboard');
      setSettingsInitialTab('config');
      setSelectedEmployeeId(null);
      setShowAuditModal(false);
      setShowDatabaseModal(false);
      setShowPasswordResetModal(false);
      return;
    }

    const isFreshLogin = !wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = true;
    evaluateCurrentLocationRoute(isFreshLogin);
  }, [isAuthenticated, currentUser?.username, allowedModules, evaluateCurrentLocationRoute]);

  useEffect(() => {
    const handleRouteChange = () => {
      evaluateCurrentLocationRoute(false);
    };
    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [evaluateCurrentLocationRoute]);

  // Live Queue Counts for Sidebar Badges (only computed when permitted)
  const movements = useMemo(
    () => (canAccessModule('movements') ? db.getStaffMovements() : []),
    [dataVersion, canAccessModule]
  );
  const employees = useMemo(
    () =>
      canAccessModule('retirement') || canAccessModule('promotions')
        ? db.getEmployees()
        : [],
    [dataVersion, canAccessModule]
  );

  const pendingMovementsCount = useMemo(() => {
    return movements.filter(
      (m) => m.workflowStatus === 'Draft' || m.workflowStatus === 'Submitted' || m.workflowStatus === 'Under Review'
    ).length;
  }, [movements]);

  const retiringSoonCount = useMemo(() => {
    if (!canAccessModule('retirement')) return 0;
    return employees.filter((emp) => {
      const empInfo = db.getEmployeeEmploymentInfo(emp.id);
      if (!empInfo?.statutoryRetirementDate) return false;
      const months = db.calculateMonthsToRetirement(empInfo.statutoryRetirementDate);
      return months >= 0 && months <= 12;
    }).length;
  }, [employees, canAccessModule]);

  const promotionEligibleCount = useMemo(() => {
    if (!canAccessModule('promotions')) return 0;
    return employees.filter((emp) => {
      const empInfo = db.getEmployeeEmploymentInfo(emp.id);
      if (!empInfo) return false;
      const yrs = db.calculateYearsInCurrentGrade(empInfo.dateAssignedCurrentGrade);
      return yrs >= 3 && empInfo.currentEmploymentStatus === 'Active';
    }).length;
  }, [employees, canAccessModule]);

  const handleSelectEmployeeSafely = useCallback(
    (employeeId: number) => {
      navigateToModule('staff', { employeeId });
    },
    [navigateToModule]
  );

  const renderAccessDenied = (blockedTarget: string) => {
    const modDef = HRMIS_MODULE_DEFINITIONS.find((m) => m.moduleId === blockedTarget);
    const targetLabel = modDef ? `${modDef.label} (/${modDef.moduleId})` : `/${blockedTarget}`;

    return (
      <div className="h-full flex items-center justify-center p-6 bg-slate-100">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-xl shadow-sm p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-rose-600 font-bold">
              HTTP 403 • Access Denied
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              Module Access Restricted
            </h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Your assigned role (
              <span className="font-semibold text-slate-800">
                {currentRole?.roleName || currentUser?.roleName || 'Unassigned'}
              </span>
              ) has not been granted permission to access{' '}
              <span className="font-mono font-semibold text-rose-700">{targetLabel}</span>.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            {firstAllowedModule ? (
              <button
                onClick={() => navigateToModule(firstAllowedModule, { replaceUrl: true })}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Authorized Workspace</span>
              </button>
            ) : (
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Module Router (Strict Default-Deny Guard)
  const renderModuleContent = () => {
    if (deniedRouteTarget) {
      return renderAccessDenied(deniedRouteTarget);
    }

    if (!canAccessModule(currentModule)) {
      return renderAccessDenied(currentModule);
    }

    if (currentModule === 'dashboard') {
      return (
        <DashboardView
          onNavigate={(mod) => navigateToModule(mod)}
          onSelectEmployee={handleSelectEmployeeSafely}
        />
      );
    }

    if (currentModule === 'staff') {
      return (
        <StaffManagementView
          initialEmployeeId={selectedEmployeeId}
          onSelectEmployee={(id) => setSelectedEmployeeId(id)}
          onInitiateMovement={() => navigateToModule('movements')}
        />
      );
    }

    if (currentModule === 'organization') {
      return <OrganizationView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'establishment') {
      return <EstablishmentView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'movements') {
      return <StaffMovementView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'promotions') {
      return <PromotionManagementView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'recruitment') {
      return <RecruitmentView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'leave') {
      return <LeaveManagementView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'attendance') {
      return <AttendanceManagementView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'training') {
      return <TrainingManagementView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'performance') {
      return <PerformanceManagementView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'payroll') {
      return <PayrollManagementView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'retirement') {
      return <RetirementSeparationView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'disciplinary') {
      return <DisciplinaryManagementView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'reports') {
      return <ReportsManagementView onSelectEmployee={handleSelectEmployeeSafely} />;
    }

    if (currentModule === 'users') {
      return <UserManagementView />;
    }

    if (currentModule === 'settings') {
      return (
        <SystemSettingsView
          initialTab={settingsInitialTab}
          tabRequestKey={settingsTabRequestKey}
        />
      );
    }

    return renderAccessDenied(currentModule);
  };

  if (!startupStatus.canAccessApplication || !isAuthenticated || !currentUser) {
    return (
      <>
        <ToastContainer canOpenCenter={false} />
        <LoginPage
          startupStatus={startupStatus}
          onRefreshValidation={refreshValidation}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 font-sans select-none antialiased">
      <ToastContainer canOpenCenter={true} />
      <NotificationCenter />

      {/* 1. Windows 11 Fluent Title Bar */}
      <TitleBar
        onOpenAudit={() => {
          if (hasPermission('AUDIT_VIEW') || canAccessSubmenu('SUBMENU:/settings/audit')) {
            setShowAuditModal(true);
          }
        }}
        onOpenDatabaseInfo={() => {
          if (hasPermission('SETTINGS_MANAGE') || canAccessModule('settings')) {
            setShowDatabaseModal(true);
          }
        }}
        onOpenPasswordReset={() => {
          if (canAccessModule('settings')) {
            navigateToModule('settings', { settingsTab: 'password' });
          } else {
            setShowPasswordResetModal(true);
          }
        }}
      />

      {/* 2. Main Work Area: Navigation Sidebar + Scrollable View Container */}
      <div className="flex-1 flex overflow-hidden">
        <NavigationSidebar
          currentModule={currentModule}
          onSelectModule={(id) => navigateToModule(id)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          pendingMovementsCount={pendingMovementsCount}
          retiringSoonCount={retiringSoonCount}
          promotionEligibleCount={promotionEligibleCount}
        />

        <main key={dataVersion} className="flex-1 overflow-y-auto bg-slate-100/90 relative">
          {renderModuleContent()}
        </main>
      </div>

      {/* 3. Bottom Status Bar */}
      <StatusBar
        onOpenDatabaseInfo={() => {
          if (hasPermission('SETTINGS_MANAGE') || canAccessModule('settings')) {
            setShowDatabaseModal(true);
          }
        }}
      />

      {/* 4. Modals */}
      {(hasPermission('AUDIT_VIEW') || canAccessSubmenu('SUBMENU:/settings/audit')) && (
        <AuditTrailModal
          isOpen={showAuditModal}
          onClose={() => setShowAuditModal(false)}
        />
      )}

      {(hasPermission('SETTINGS_MANAGE') || canAccessModule('settings')) && (
        <DatabaseInfoModal
          isOpen={showDatabaseModal}
          onClose={() => setShowDatabaseModal(false)}
          onResetComplete={() => {
            setSelectedEmployeeId(null);
            setDataVersion((prev) => prev + 1);
            setShowDatabaseModal(false);
          }}
        />
      )}

      <SelfServicePasswordModal
        isOpen={showPasswordResetModal}
        onClose={() => setShowPasswordResetModal(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <MainShell />
      </AuthProvider>
    </NotificationProvider>
  );
}

