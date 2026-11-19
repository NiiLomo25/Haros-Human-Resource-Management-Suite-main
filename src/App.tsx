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
  Users,
  ArrowRightLeft,
  Award,
  Hourglass,
  Scale,
  FileSpreadsheet,
  Building2,
  CalendarDays,
  ShieldAlert,
  Settings,
  ChevronRight,
  Info,
  Clock,
  GraduationCap,
  TrendingUp,
  CreditCard,
  UserPlus,
  UserCog,
} from 'lucide-react';

const MainShell: React.FC = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const [currentModule, setCurrentModule] = useState<NavModuleId>('dashboard');
  const [settingsInitialTab, setSettingsInitialTab] = useState<SystemSettingsTab>('config');
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

  // Live Queue Counts for Sidebar Badges
  const movements = useMemo(() => db.getStaffMovements(), [dataVersion]);
  const employees = useMemo(() => db.getEmployees(), [dataVersion]);

  const pendingMovementsCount = useMemo(() => {
    return movements.filter(
      (m) => m.workflowStatus === 'Draft' || m.workflowStatus === 'Submitted' || m.workflowStatus === 'Under Review'
    ).length;
  }, [movements]);

  const retiringSoonCount = useMemo(() => {
    return employees.filter((emp) => {
      const empInfo = db.getEmployeeEmploymentInfo(emp.id);
      if (!empInfo?.statutoryRetirementDate) return false;
      const months = db.calculateMonthsToRetirement(empInfo.statutoryRetirementDate);
      return months >= 0 && months <= 12;
    }).length;
  }, [employees]);

  const promotionEligibleCount = useMemo(() => {
    return employees.filter((emp) => {
      const empInfo = db.getEmployeeEmploymentInfo(emp.id);
      if (!empInfo) return false;
      const yrs = db.calculateYearsInCurrentGrade(empInfo.dateAssignedCurrentGrade);
      return yrs >= 3 && empInfo.currentEmploymentStatus === 'Active';
    }).length;
  }, [employees]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  // Module Router
  const renderModuleContent = () => {
    if (currentModule === 'dashboard') {
      return (
        <DashboardView
          onNavigate={(mod) => setCurrentModule(mod)}
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'staff') {
      return (
        <StaffManagementView
          initialEmployeeId={selectedEmployeeId}
          onSelectEmployee={(id) => setSelectedEmployeeId(id)}
          onInitiateMovement={() => setCurrentModule('movements')}
        />
      );
    }

    if (currentModule === 'organization') {
      return (
        <OrganizationView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'establishment') {
      return (
        <EstablishmentView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'movements') {
      return (
        <StaffMovementView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'promotions') {
      return (
        <PromotionManagementView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'recruitment') {
      return (
        <RecruitmentView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'leave') {
      return (
        <LeaveManagementView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'attendance') {
      return (
        <AttendanceManagementView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'training') {
      return (
        <TrainingManagementView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'performance') {
      return (
        <PerformanceManagementView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'payroll') {
      return (
        <PayrollManagementView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'retirement') {
      return (
        <RetirementSeparationView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'disciplinary') {
      return (
        <DisciplinaryManagementView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'reports') {
      return (
        <ReportsManagementView
          onSelectEmployee={(id) => {
            setSelectedEmployeeId(id);
            setCurrentModule('staff');
          }}
        />
      );
    }

    if (currentModule === 'users') {
      return <UserManagementView />;
    }

    if (currentModule === 'settings') {
      return <SystemSettingsView initialTab={settingsInitialTab} />;
    }

    // Default fallback to dashboard if unknown module
    return (
      <DashboardView
        onNavigate={(mod) => setCurrentModule(mod)}
        onSelectEmployee={(id) => {
          setSelectedEmployeeId(id);
          setCurrentModule('staff');
        }}
      />
    );
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
        onOpenAudit={() => setShowAuditModal(true)}
        onOpenDatabaseInfo={() => setShowDatabaseModal(true)}
        onOpenPasswordReset={() => {
          setSettingsInitialTab('password');
          setCurrentModule('settings');
        }}
      />

      {/* 2. Main Work Area: Navigation Sidebar + Scrollable View Container */}
      <div className="flex-1 flex overflow-hidden">
        <NavigationSidebar
          currentModule={currentModule}
          onSelectModule={(id) => {
            if (id !== 'staff') {
              setSelectedEmployeeId(null);
            }
            if (id === 'settings') {
              setSettingsInitialTab('config');
            }
            setCurrentModule(id);
          }}
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
      <StatusBar onOpenDatabaseInfo={() => setShowDatabaseModal(true)} />

      {/* 4. Modals */}
      <AuditTrailModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
      />

      <DatabaseInfoModal
        isOpen={showDatabaseModal}
        onClose={() => setShowDatabaseModal(false)}
        onResetComplete={() => {
          setSelectedEmployeeId(null);
          setDataVersion((prev) => prev + 1);
          setShowDatabaseModal(false);
        }}
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
