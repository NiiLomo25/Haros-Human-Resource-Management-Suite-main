/**
 * Haros HRMIS - Persistent Relational Database Service
 * Emulates the SQLite WAL engine in local storage with atomic transactions and immutable audit logging.
 */

import {
  Mda,
  Department,
  Unit,
  GradeLevel,
  EstablishmentPosition,
  Employee,
  EmployeePersonalInfo,
  EmployeeEmploymentInfo,
  EmployeeQualification,
  EmployeeProfessionalMembership,
  PriorEmploymentHistory,
  EmployeeDocument,
  StaffMovement,
  StaffMovementHistory,
  RecruitmentApplicant,
  PromotionRecommendation,
  ProgressionType,
  PromotionEligibilityResult,
  MovementWorkflowStatus,
  MovementType,
  LeaveType,
  LeaveBalance,
  LeaveApplication,
  AttendanceRecord,
  TrainingProgram,
  TrainingNomination,
  PerformanceAppraisal,
  User,
  Role,
  SystemSetting,
  AuditTrailLog,
  SalaryStructure,
  SalaryGradeStep,
  PayrollComponent,
  EmployeePayrollAssignment,
  PayrollRun,
  EmployeePayslip,
  SeparationRecord,
  ClearanceItem,
  ClearanceDepartmentUnit,
  EmploymentStatus,
  DisciplinaryCase,
  EmployeeTrainingCapability,
  EmployeeSkill,
  SkillCategory,
  ActivationAdminAccount,
  RegisteredComputer,
  ApplicationExpiryConfig,
  StartupValidationResult,
  StartupBlockReason,
} from '../types';

import {
  INITIAL_MDAS,
  INITIAL_DEPARTMENTS,
  INITIAL_UNITS,
  INITIAL_GRADE_LEVELS,
  INITIAL_ESTABLISHMENT,
  INITIAL_EMPLOYEES,
  INITIAL_PERSONAL_INFO,
  INITIAL_EMPLOYMENT_INFO,
  INITIAL_QUALIFICATIONS,
  INITIAL_MEMBERSHIPS,
  INITIAL_PRIOR_HISTORY,
  INITIAL_DOCUMENTS,
  INITIAL_MOVEMENTS,
  INITIAL_MOVEMENT_HISTORY,
  INITIAL_ROLES,
  INITIAL_USERS,
  INITIAL_ACTIVATION_ADMINS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SYSTEM_SETTINGS,
  INITIAL_SALARY_STRUCTURES,
  INITIAL_SALARY_GRADE_STEPS,
  INITIAL_PAYROLL_COMPONENTS,
  INITIAL_EMPLOYEE_PAYROLL_ASSIGNMENTS,
  INITIAL_PAYROLL_RUNS,
  INITIAL_EMPLOYEE_PAYSLIPS,
  INITIAL_SEPARATION_RECORDS,
  INITIAL_CLEARANCE_ITEMS,
  INITIAL_DISCIPLINARY_CASES,
  INITIAL_TRAINING_CAPABILITIES,
  INITIAL_SKILLS,
} from './seedData';
import { hashPassword, verifyPassword, verifyActivationPassword } from './password';
import {
  signComputerRegistration,
  verifyComputerSignature,
  signExpiryConfig,
  verifyExpiryConfigSignature,
  saveToPermanentVault,
  readFromPermanentVault,
  WorkstationIdentity,
} from '../services/security/computerRegistrationService';
import { notificationService } from '../services/notifications/notificationService';
import { mapAuditEntryToNotification } from '../services/notifications/auditNotificationBridge';

const STORAGE_PREFIX = 'haros_hrmis_v2_';

export class DatabaseService {
  private static instance: DatabaseService;
  private notificationSuppressionDepth = 0;

  private constructor() {
    this.ensureInitialized();
  }

  private runWithSuppressedNotifications<T>(fn: () => T): T {
    this.notificationSuppressionDepth++;
    try {
      return fn();
    } finally {
      this.notificationSuppressionDepth = Math.max(0, this.notificationSuppressionDepth - 1);
    }
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private getItem<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private setItem<T>(key: string, value: T): void {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  }

  private isFactoryWiped(): boolean {
    return localStorage.getItem(STORAGE_PREFIX + 'factoryWiped') === 'true';
  }

  public ensureInitialized(): void {
    const storedEmployment = this.getItem<EmployeeEmploymentInfo[]>('employmentInfo', []);
    const hasOldCategories = storedEmployment.some((e: any) => e.employeeCategory === 'Civil Service');
    const existingGrades = this.getItem<any[]>('gradeLevels', []);
    const existingCapabilities = this.getItem<EmployeeTrainingCapability[]>('trainingCapabilities', []);
    const existingSkills = this.getItem<EmployeeSkill[]>('skills', []);

    if (!localStorage.getItem(STORAGE_PREFIX + 'initialized') || hasOldCategories) {
      this.resetDatabase();
    } else {
      // Synchronize grade levels cleanly and strip any legacy gradeCode properties from persisted records
      const mergedGrades: GradeLevel[] = [];
      INITIAL_GRADE_LEVELS.forEach((newG) => {
        const existing = existingGrades.find(
          (eg) => eg.id === newG.id || eg.gradeName === newG.gradeName
        );
        const base = existing ? { ...existing } : { ...newG };
        delete base.gradeCode;
        mergedGrades.push({
          ...base,
          gradeName: newG.gradeName,
          minYearsInGradeForPromotion: newG.minYearsInGradeForPromotion,
          progressionMode: newG.progressionMode,
          isSeniorManagement: newG.isSeniorManagement,
        });
      });
      existingGrades.forEach((eg) => {
        if (!mergedGrades.some((mg) => mg.id === eg.id || mg.gradeName === eg.gradeName)) {
          const cleaned = { ...eg };
          delete cleaned.gradeCode;
          mergedGrades.push(cleaned);
        }
      });
      this.setItem('gradeLevels', mergedGrades);

      const legacyCodeToTitle: Record<string, string> = {
        L1: 'Junior Clerk',
        L5: 'Senior Clerk',
        L08: 'Higher Executive Officer',
        L10: 'Higher Executive Officer',
        L12: 'Senior Executive Officer',
        L13: 'Senior Executive Officer',
        L14: 'Assistant Director IIB',
        L15: 'Assistant Director IIA',
        L16: 'Assistant Director I',
        L17: 'Deputy Director',
        L18: 'Director',
        L20: 'Chief Director',
        L16P: 'Principal Officer',
        L18C: 'Chief Officer',
        '24L': 'Director of Procurement and Supply Chain',
        '23L': 'Chief Procurement and Supply Chain Manager',
        '21L': 'Principal Procurement and Supply Chain Manager',
        '15L': 'Procurement and Supply Chain Officer',
        '13L': 'Assistant Procurement and Supply Chain Officer I',
        '11L': 'Assistant Procurement and Supply Chain Officer II',
      };

      // Migrate persisted movement history entries from gradeCodeFrom/To -> gradeNameFrom/To
      const existingMovHist = this.getItem<any[]>('movementHistory', []);
      if (existingMovHist.length > 0 && existingMovHist.some((h) => h.gradeCodeFrom || h.gradeCodeTo)) {
        const migratedHist = existingMovHist.map((h) => {
          const copy = { ...h };
          if (!copy.gradeNameFrom) {
            copy.gradeNameFrom = legacyCodeToTitle[copy.gradeCodeFrom] || copy.gradeCodeFrom || 'Previous Grade';
          }
          if (!copy.gradeNameTo) {
            copy.gradeNameTo = legacyCodeToTitle[copy.gradeCodeTo] || copy.gradeCodeTo || 'Assigned Grade';
          }
          delete copy.gradeCodeFrom;
          delete copy.gradeCodeTo;
          return copy;
        });
        this.setItem('movementHistory', migratedHist);
      }

      // Migrate persisted salary grade steps to strip gradeCode
      const existingSteps = this.getItem<any[]>('salaryGradeSteps', []);
      if (existingSteps.length > 0 && existingSteps.some((s) => 'gradeCode' in s)) {
        const migratedSteps = existingSteps.map((s) => {
          const copy = { ...s };
          delete copy.gradeCode;
          return copy;
        });
        this.setItem('salaryGradeSteps', migratedSteps);
      }

      // Migrate persisted payslips to replace gradeCode with gradeName
      const existingSlips = this.getItem<any[]>('payslips', []);
      if (existingSlips.length > 0 && existingSlips.some((p) => 'gradeCode' in p)) {
        const migratedSlips = existingSlips.map((p) => {
          const copy = { ...p };
          if (!copy.gradeName) {
            const empInfo = this.getEmployeeEmploymentInfo(copy.employeeId);
            const gMatch = mergedGrades.find((g) => g.id === empInfo?.currentGradeId);
            copy.gradeName = gMatch?.gradeName || legacyCodeToTitle[copy.gradeCode] || copy.gradeCode || 'Civil Service Officer';
          }
          delete copy.gradeCode;
          return copy;
        });
        this.setItem('payslips', migratedSlips);
      }

      if (existingCapabilities.length === 0 && !this.isFactoryWiped() && localStorage.getItem(STORAGE_PREFIX + 'trainingCapabilities') === null) {
        this.setItem('trainingCapabilities', INITIAL_TRAINING_CAPABILITIES);
      }
      if (existingSkills.length === 0 && !this.isFactoryWiped() && localStorage.getItem(STORAGE_PREFIX + 'skills') === null) {
        this.setItem('skills', INITIAL_SKILLS);
      }
      if (!this.isFactoryWiped() && localStorage.getItem(STORAGE_PREFIX + 'memberships') === null) {
        this.setItem('memberships', INITIAL_MEMBERSHIPS);
      }

      // Migrate training program categories to approved Civil Service Training Program taxonomy
      const existingTraining = this.getItem<TrainingProgram[]>('trainingPrograms', []);
      if (existingTraining.length > 0) {
        const categoryMap: Record<string, string> = {
          'Leadership & Executive': 'Scheme of Service',
          'Financial Management': 'Conferences / Workshops / Webinars',
          'Technical & IT': 'On-the-Job Training',
          'Public Policy & Administration': 'Academic/Institution',
          'Induction': 'Scheme of Service',
        };
        let changed = false;
        const updatedTraining = existingTraining.map((p) => {
          if (categoryMap[p.category]) {
            changed = true;
            return { ...p, category: categoryMap[p.category] };
          }
          return p;
        });
        if (changed) {
          this.setItem('trainingPrograms', updatedTraining);
        }
      }

      // Merge any newly added system settings keys (e.g., configurable validation rules)
      const existingSettings = this.getItem<SystemSetting[]>('systemSettings', []);
      let settingsAdded = false;
      INITIAL_SYSTEM_SETTINGS.forEach((def) => {
        if (!existingSettings.some((s) => s.settingKey === def.settingKey)) {
          existingSettings.push({ ...def });
          settingsAdded = true;
        }
      });
      if (settingsAdded || existingSettings.length === 0) {
        this.setItem('systemSettings', existingSettings.length > 0 ? existingSettings : INITIAL_SYSTEM_SETTINGS);
      }

      // Migrate persisted users without passwordHash so existing accounts authenticate cleanly
      const existingUsers = this.getItem<User[]>('users', []);
      if (existingUsers.length > 0 && existingUsers.some((u) => !u.passwordHash)) {
        const migratedUsers = existingUsers.map((u) => {
          if (u.passwordHash) return u;
          const fallbackPwd = u.username.toLowerCase() === 'admin' ? 'Admin@2026' : 'Civil@2026';
          return {
            ...u,
            passwordHash: hashPassword(fallbackPwd),
          };
        });
        this.setItem('users', migratedUsers);
      }

      // Ensure Activation Admin & Registration/Expiry tables are preserved on upgrade
      if (localStorage.getItem(STORAGE_PREFIX + 'activationAdmins') === null) {
        this.setItem('activationAdmins', INITIAL_ACTIVATION_ADMINS);
      }
      if (localStorage.getItem(STORAGE_PREFIX + 'computerRegistrations') === null) {
        this.setItem('computerRegistrations', []);
      }
      if (localStorage.getItem(STORAGE_PREFIX + 'applicationExpiryConfig') === null) {
        this.setItem('applicationExpiryConfig', this.createDefaultExpiryConfig());
      }
    }
  }

  public resetDatabase(): void {
    localStorage.removeItem(STORAGE_PREFIX + 'factoryWiped');
    this.setItem('mdas', INITIAL_MDAS);
    this.setItem('departments', INITIAL_DEPARTMENTS);
    this.setItem('units', INITIAL_UNITS);
    this.setItem('gradeLevels', INITIAL_GRADE_LEVELS);
    this.setItem('establishment', INITIAL_ESTABLISHMENT);
    this.setItem('employees', INITIAL_EMPLOYEES);
    this.setItem('personalInfo', INITIAL_PERSONAL_INFO);
    this.setItem('employmentInfo', INITIAL_EMPLOYMENT_INFO);
    this.setItem('qualifications', INITIAL_QUALIFICATIONS);
    this.setItem('memberships', INITIAL_MEMBERSHIPS);
    this.setItem('priorHistory', INITIAL_PRIOR_HISTORY);
    this.setItem('documents', INITIAL_DOCUMENTS);
    this.setItem('trainingCapabilities', INITIAL_TRAINING_CAPABILITIES);
    this.setItem('skills', INITIAL_SKILLS);
    this.setItem('movements', INITIAL_MOVEMENTS);
    this.setItem('movementHistory', INITIAL_MOVEMENT_HISTORY);
    this.setItem('roles', INITIAL_ROLES);
    this.setItem('users', INITIAL_USERS);
    this.setItem('auditLogs', INITIAL_AUDIT_LOGS);
    this.setItem('systemSettings', INITIAL_SYSTEM_SETTINGS);
    this.setItem('salaryStructures', INITIAL_SALARY_STRUCTURES);
    this.setItem('salaryGradeSteps', INITIAL_SALARY_GRADE_STEPS);
    this.setItem('payrollComponents', INITIAL_PAYROLL_COMPONENTS);
    this.setItem('payrollAssignments', INITIAL_EMPLOYEE_PAYROLL_ASSIGNMENTS);
    this.setItem('payrollRuns', INITIAL_PAYROLL_RUNS);
    this.setItem('payslips', INITIAL_EMPLOYEE_PAYSLIPS);
    this.setItem('separationRecords', INITIAL_SEPARATION_RECORDS);
    this.setItem('clearanceItems', INITIAL_CLEARANCE_ITEMS);
    this.setItem('disciplinaryCases', INITIAL_DISCIPLINARY_CASES);
    if (localStorage.getItem(STORAGE_PREFIX + 'activationAdmins') === null) {
      this.setItem('activationAdmins', INITIAL_ACTIVATION_ADMINS);
    }
    if (localStorage.getItem(STORAGE_PREFIX + 'computerRegistrations') === null) {
      this.setItem('computerRegistrations', []);
    }
    if (localStorage.getItem(STORAGE_PREFIX + 'applicationExpiryConfig') === null) {
      this.setItem('applicationExpiryConfig', this.createDefaultExpiryConfig());
    }
    this.setItem('initialized', 'true');
    this.setItem('initializedAt', new Date().toISOString());

    this.logAudit({
      username: 'SYSTEM',
      machineName: 'WIN11-HR-PRIMARY',
      module: 'Database Engine',
      actionType: 'SYSTEM_INIT',
      entityName: 'hrmis.db',
      recordId: 'INIT-FACTORY-RESET',
      newValuesJson: JSON.stringify({ status: 'Database reset to default civil service seed data' }),
    });
  }

  /**
   * Complete System Factory Wipe (System Administrator ONLY).
   * Deletes all employee, organizational, operational, financial, lifecycle, backup,
   * audit, and non-administrator user data while keeping the active System Administrator
   * account and statutory read-only system schemas intact so the app remains operational.
   */
  public factoryResetAllData(username: string, roleName: string): void {
    if (roleName !== 'System Administrator') {
      notificationService.security(
        'Unauthorized Factory Reset Attempt',
        `User '${username}' attempted a full factory reset without System Administrator privileges.`,
        { module: 'Database Engine', actor: username }
      );
      throw new Error('Access Denied: Only the System Administrator may perform a full Factory Reset.');
    }

    const existingUsers = this.getItem<User[]>('users', INITIAL_USERS);
    const activeSysAdmin =
      existingUsers.find(
        (u) => u.username.toLowerCase() === username.toLowerCase() && u.roleName === 'System Administrator'
      ) || INITIAL_USERS[0];

    // Mark factory-wiped before clearing tables so lazy getters never re-seed sample data
    localStorage.setItem(STORAGE_PREFIX + 'factoryWiped', 'true');
    localStorage.removeItem(STORAGE_PREFIX + 'pre_restore_safety_backup');

    // Wipe all organizational, employee, operational, financial, audit, and backup records
    const emptyTables = [
      'mdas',
      'departments',
      'units',
      'establishment',
      'employees',
      'personalInfo',
      'employmentInfo',
      'qualifications',
      'memberships',
      'priorHistory',
      'documents',
      'trainingCapabilities',
      'skills',
      'movements',
      'movementHistory',
      'recruitmentApplicants',
      'promotionRecommendations',
      'leaveApplications',
      'leaveBalances',
      'attendanceRecords',
      'trainingPrograms',
      'trainingNominations',
      'performanceAppraisals',
      'appraisals',
      'payrollComponents',
      'payrollAssignments',
      'payrollRuns',
      'payslips',
      'separationRecords',
      'clearanceItems',
      'disciplinaryCases',
      'auditLogs',
      'backupHistory',
    ];
    for (const table of emptyTables) {
      this.setItem(table, []);
    }

    // Preserve only System Administrator access + statutory system schemas/settings
    this.setItem('roles', INITIAL_ROLES);
    this.setItem('users', [
      {
        ...activeSysAdmin,
        roleId: 1,
        roleName: 'System Administrator',
        passwordHash: activeSysAdmin.passwordHash || hashPassword('Admin@2026'),
        isActive: true,
      },
    ]);
    this.setItem('gradeLevels', INITIAL_GRADE_LEVELS);
    this.setItem('salaryStructures', INITIAL_SALARY_STRUCTURES);
    this.setItem('salaryGradeSteps', INITIAL_SALARY_GRADE_STEPS);
    this.setItem('systemSettings', INITIAL_SYSTEM_SETTINGS);
    this.setItem('initialized', 'true');
    this.setItem('initializedAt', new Date().toISOString());
    this.notifySettingsUpdated();
    notificationService.security(
      'System Factory Reset Completed',
      'All operational records wiped cleanly; System Administrator account and statutory schemas preserved.',
      { module: 'Database Engine', actor: username }
    );
  }

  // --- Audit Trail (Append-Only) ---
  public getAuditLogs(): AuditTrailLog[] {
    const logs = this.getItem<AuditTrailLog[]>('auditLogs', []);
    return logs.sort((a, b) => new Date(b.timestampUtc).getTime() - new Date(a.timestampUtc).getTime());
  }

  public logAudit(entry: Omit<AuditTrailLog, 'id' | 'timestampUtc' | 'ipOrHost'>): void {
    const logs = this.getItem<AuditTrailLog[]>('auditLogs', []);
    const newLog: AuditTrailLog = {
      id: logs.length > 0 ? Math.max(...logs.map((l) => l.id)) + 1 : 1,
      userId: entry.userId || 1,
      username: entry.username || 'admin',
      machineName: entry.machineName || 'WIN11-HR-NODE01',
      ipOrHost: '127.0.0.1 (Local Standalone)',
      module: entry.module,
      actionType: entry.actionType,
      entityName: entry.entityName,
      recordId: entry.recordId,
      oldValuesJson: entry.oldValuesJson,
      newValuesJson: entry.newValuesJson,
      timestampUtc: new Date().toISOString(),
    };
    logs.push(newLog);
    this.setItem('auditLogs', logs);

    if (this.notificationSuppressionDepth === 0) {
      const payload = mapAuditEntryToNotification(entry);
      if (payload) {
        notificationService.notify(payload);
      }
    }
  }

  // --- Lookups & Hierarchy ---
  public getMdas(): Mda[] {
    return this.getItem<Mda[]>('mdas', []);
  }

  public getDepartments(mdaId?: number): Department[] {
    const depts = this.getItem<Department[]>('departments', []);
    return mdaId ? depts.filter((d) => d.mdaId === mdaId) : depts;
  }

  public getUnits(departmentId?: number): Unit[] {
    const units = this.getItem<Unit[]>('units', []);
    return departmentId ? units.filter((u) => u.departmentId === departmentId) : units;
  }

  public getGradeLevels(): GradeLevel[] {
    return this.getItem<GradeLevel[]>('gradeLevels', []).sort((a, b) => a.hierarchyRank - b.hierarchyRank);
  }

  public getEstablishmentPositions(): EstablishmentPosition[] {
    return this.getItem<EstablishmentPosition[]>('establishment', []);
  }

  // --- Employees & Dossier ---
  public getEmployees(): Employee[] {
    return this.getItem<Employee[]>('employees', []).filter((e) => !e.isDeleted);
  }

  public getAllRawEmployeeStaffIds(): string[] {
    return this.getItem<Employee[]>('employees', []).map((e) => e.staffId);
  }

  public getEmployeeById(id: number): Employee | undefined {
    return this.getEmployees().find((e) => e.id === id);
  }

  public getEmployeePersonalInfo(employeeId: number): EmployeePersonalInfo | undefined {
    const records = this.getItem<EmployeePersonalInfo[]>('personalInfo', []);
    return records.find((p) => p.employeeId === employeeId);
  }

  public getEmployeeEmploymentInfo(employeeId: number): EmployeeEmploymentInfo | undefined {
    const records = this.getItem<EmployeeEmploymentInfo[]>('employmentInfo', []);
    return records.find((e) => e.employeeId === employeeId);
  }

  public getEmployeeQualifications(employeeId: number): EmployeeQualification[] {
    const records = this.getItem<EmployeeQualification[]>('qualifications', []);
    return records.filter((q) => q.employeeId === employeeId);
  }

  public addQualification(
    qual: Omit<EmployeeQualification, 'id'>,
    username: string
  ): EmployeeQualification {
    const list = this.getItem<EmployeeQualification[]>('qualifications', []);
    const newId = list.length > 0 ? Math.max(...list.map((q) => q.id)) + 1 : 1;
    const newQual: EmployeeQualification = { ...qual, id: newId };
    list.push(newQual);
    this.setItem('qualifications', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Qualifications',
      actionType: 'INSERT',
      entityName: 'EmployeeQualifications',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newQual),
    });
    return newQual;
  }

  public updateQualification(
    id: number,
    data: Partial<EmployeeQualification>,
    username: string
  ): void {
    const list = this.getItem<EmployeeQualification[]>('qualifications', []);
    const idx = list.findIndex((q) => q.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('qualifications', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Qualifications',
      actionType: 'UPDATE',
      entityName: 'EmployeeQualifications',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deleteQualification(id: number, username: string): void {
    const list = this.getItem<EmployeeQualification[]>('qualifications', []);
    const item = list.find((q) => q.id === id);
    if (!item) return;
    this.setItem(
      'qualifications',
      list.filter((q) => q.id !== id)
    );
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Qualifications',
      actionType: 'DELETE',
      entityName: 'EmployeeQualifications',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(item),
    });
  }

  // --- Professional Memberships ---
  public getEmployeeMemberships(employeeId: number): EmployeeProfessionalMembership[] {
    const records = this.getItem<EmployeeProfessionalMembership[]>('memberships', []);
    return records.filter((m) => m.employeeId === employeeId);
  }

  public addEmployeeMembership(
    member: Omit<EmployeeProfessionalMembership, 'id'>,
    username: string
  ): EmployeeProfessionalMembership {
    const list = this.getItem<EmployeeProfessionalMembership[]>('memberships', []);
    const newId = list.length > 0 ? Math.max(...list.map((m) => m.id)) + 1 : 1;
    const newMember: EmployeeProfessionalMembership = { ...member, id: newId };
    list.push(newMember);
    this.setItem('memberships', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Professional Memberships',
      actionType: 'INSERT',
      entityName: 'EmployeeProfessionalMemberships',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newMember),
    });
    return newMember;
  }

  public updateEmployeeMembership(
    id: number,
    data: Partial<EmployeeProfessionalMembership>,
    username: string
  ): void {
    const list = this.getItem<EmployeeProfessionalMembership[]>('memberships', []);
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('memberships', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Professional Memberships',
      actionType: 'UPDATE',
      entityName: 'EmployeeProfessionalMemberships',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deleteEmployeeMembership(id: number, username: string): void {
    const list = this.getItem<EmployeeProfessionalMembership[]>('memberships', []);
    const item = list.find((m) => m.id === id);
    if (!item) return;
    this.setItem(
      'memberships',
      list.filter((m) => m.id !== id)
    );
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Professional Memberships',
      actionType: 'DELETE',
      entityName: 'EmployeeProfessionalMemberships',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(item),
    });
  }

  public setEmployeeMemberships(
    employeeId: number,
    memberships: Omit<EmployeeProfessionalMembership, 'id' | 'employeeId'>[],
    username: string
  ): EmployeeProfessionalMembership[] {
    const list = this.getItem<EmployeeProfessionalMembership[]>('memberships', []);
    const remaining = list.filter((m) => m.employeeId !== employeeId);
    let nextId = list.length > 0 ? Math.max(...list.map((m) => m.id)) + 1 : 1;
    const todayIso = new Date().toISOString().split('T')[0];

    const newRecords: EmployeeProfessionalMembership[] = [];
    const seenKeys = new Set<string>();

    for (const m of memberships) {
      const body = (m.professionalBody || '').trim();
      const num = (m.membershipNumber || '').trim();
      if (!body || !num) continue;
      const key = `${body.toLowerCase()}::${num.toLowerCase()}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      newRecords.push({
        id: nextId++,
        employeeId,
        professionalBody: body,
        membershipNumber: num,
        membershipCategory: (m.membershipCategory || '').trim() || 'Full Member',
        registrationDate: (m.registrationDate || '').trim() || todayIso,
        expiryDate: m.expiryDate?.trim() || undefined,
        membershipStatus: m.membershipStatus || 'Active',
      });

      if (newRecords.length >= 10) break;
    }

    this.setItem('memberships', [...remaining, ...newRecords]);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Professional Memberships',
      actionType: 'UPDATE',
      entityName: 'EmployeeProfessionalMemberships',
      recordId: employeeId.toString(),
      newValuesJson: JSON.stringify({
        count: newRecords.length,
        memberships: newRecords.map((r) => ({ body: r.professionalBody, num: r.membershipNumber })),
      }),
    });
    return newRecords;
  }

  // --- Prior Employment History ---
  public getPriorEmploymentHistory(employeeId: number): PriorEmploymentHistory[] {
    const records = this.getItem<PriorEmploymentHistory[]>('priorHistory', []);
    return records.filter((h) => h.employeeId === employeeId);
  }

  public addPriorEmployment(
    history: Omit<PriorEmploymentHistory, 'id'>,
    username: string
  ): PriorEmploymentHistory {
    const list = this.getItem<PriorEmploymentHistory[]>('priorHistory', []);
    const newId = list.length > 0 ? Math.max(...list.map((h) => h.id)) + 1 : 1;
    const newRecord: PriorEmploymentHistory = { ...history, id: newId };
    list.push(newRecord);
    this.setItem('priorHistory', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Employment History',
      actionType: 'INSERT',
      entityName: 'PriorEmploymentHistory',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newRecord),
    });
    return newRecord;
  }

  public updatePriorEmployment(
    id: number,
    data: Partial<PriorEmploymentHistory>,
    username: string
  ): void {
    const list = this.getItem<PriorEmploymentHistory[]>('priorHistory', []);
    const idx = list.findIndex((h) => h.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('priorHistory', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Employment History',
      actionType: 'UPDATE',
      entityName: 'PriorEmploymentHistory',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deletePriorEmployment(id: number, username: string): void {
    const list = this.getItem<PriorEmploymentHistory[]>('priorHistory', []);
    const item = list.find((h) => h.id === id);
    if (!item) return;
    this.setItem(
      'priorHistory',
      list.filter((h) => h.id !== id)
    );
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Employment History',
      actionType: 'DELETE',
      entityName: 'PriorEmploymentHistory',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(item),
    });
  }

  // --- Employee Documents ---
  public getEmployeeDocuments(employeeId: number): EmployeeDocument[] {
    const records = this.getItem<EmployeeDocument[]>('documents', []);
    return records.filter((d) => d.employeeId === employeeId);
  }

  public addEmployeeDocument(
    doc: Omit<EmployeeDocument, 'id' | 'uploadDate'>,
    username: string
  ): EmployeeDocument {
    const list = this.getItem<EmployeeDocument[]>('documents', []);
    const newId = list.length > 0 ? Math.max(...list.map((d) => d.id)) + 1 : 1;
    const newDoc: EmployeeDocument = {
      ...doc,
      id: newId,
      uploadDate: new Date().toISOString(),
    };
    list.push(newDoc);
    this.setItem('documents', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Employee Documents',
      actionType: 'INSERT',
      entityName: 'EmployeeDocuments',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newDoc),
    });
    return newDoc;
  }

  public deleteEmployeeDocument(id: number, username: string): void {
    const list = this.getItem<EmployeeDocument[]>('documents', []);
    const doc = list.find((d) => d.id === id);
    if (!doc) return;
    this.setItem(
      'documents',
      list.filter((d) => d.id !== id)
    );
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Employee Documents',
      actionType: 'DELETE',
      entityName: 'EmployeeDocuments',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(doc),
    });
  }

  // --- Section 4: Training Capabilities Relating to Current Role ---
  public getTrainingCapabilities(employeeId: number): EmployeeTrainingCapability[] {
    const list = this.getItem<EmployeeTrainingCapability[]>('trainingCapabilities', []);
    return list.filter((c) => c.employeeId === employeeId);
  }

  public addTrainingCapability(
    cap: Omit<EmployeeTrainingCapability, 'id' | 'createdAt' | 'updatedAt'>,
    username: string
  ): EmployeeTrainingCapability {
    const list = this.getItem<EmployeeTrainingCapability[]>('trainingCapabilities', []);
    const newId = list.length > 0 ? Math.max(...list.map((c) => c.id)) + 1 : 1;
    const nowIso = new Date().toISOString();
    const newRecord: EmployeeTrainingCapability = {
      ...cap,
      id: newId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    list.push(newRecord);
    this.setItem('trainingCapabilities', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Training Capabilities',
      actionType: 'INSERT',
      entityName: 'EmployeeTrainingCapabilities',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newRecord),
    });
    return newRecord;
  }

  public setTrainingCapabilities(
    employeeId: number,
    capabilities: string[],
    username: string
  ): EmployeeTrainingCapability[] {
    const list = this.getItem<EmployeeTrainingCapability[]>('trainingCapabilities', []);
    const remaining = list.filter((c) => c.employeeId !== employeeId);
    let nextId = list.length > 0 ? Math.max(...list.map((c) => c.id)) + 1 : 1;
    const nowIso = new Date().toISOString();

    const newRecords: EmployeeTrainingCapability[] = [];
    capabilities
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
      .slice(0, 10)
      .forEach((capability) => {
        newRecords.push({
          id: nextId++,
          employeeId,
          capability,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      });

    this.setItem('trainingCapabilities', [...remaining, ...newRecords]);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Training Capabilities',
      actionType: 'UPDATE',
      entityName: 'EmployeeTrainingCapabilities',
      recordId: employeeId.toString(),
      newValuesJson: JSON.stringify({ count: newRecords.length, capabilities: newRecords.map((r) => r.capability) }),
    });
    return newRecords;
  }

  public deleteTrainingCapability(id: number, username: string): void {
    const list = this.getItem<EmployeeTrainingCapability[]>('trainingCapabilities', []);
    const item = list.find((c) => c.id === id);
    if (!item) return;
    this.setItem('trainingCapabilities', list.filter((c) => c.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Training Capabilities',
      actionType: 'DELETE',
      entityName: 'EmployeeTrainingCapabilities',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(item),
    });
  }

  // --- Section 4: Skills Possessed by Staff ---
  public getEmployeeSkills(employeeId: number): EmployeeSkill[] {
    const list = this.getItem<EmployeeSkill[]>('skills', []);
    return list.filter((s) => s.employeeId === employeeId);
  }

  public addEmployeeSkill(
    skill: Omit<EmployeeSkill, 'id' | 'createdAt' | 'updatedAt'>,
    username: string
  ): EmployeeSkill {
    const list = this.getItem<EmployeeSkill[]>('skills', []);
    const newId = list.length > 0 ? Math.max(...list.map((s) => s.id)) + 1 : 1;
    const nowIso = new Date().toISOString();
    const newRecord: EmployeeSkill = {
      ...skill,
      id: newId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    list.push(newRecord);
    this.setItem('skills', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Skills',
      actionType: 'INSERT',
      entityName: 'EmployeeSkills',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newRecord),
    });
    return newRecord;
  }

  public setEmployeeSkills(
    employeeId: number,
    skills: { skillName: string; category: SkillCategory; evidence?: string }[],
    username: string
  ): EmployeeSkill[] {
    const list = this.getItem<EmployeeSkill[]>('skills', []);
    const remaining = list.filter((s) => s.employeeId !== employeeId);
    let nextId = list.length > 0 ? Math.max(...list.map((s) => s.id)) + 1 : 1;
    const nowIso = new Date().toISOString();

    const newRecords: EmployeeSkill[] = [];
    const seenNames = new Set<string>();

    for (const s of skills) {
      const name = s.skillName.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);

      newRecords.push({
        id: nextId++,
        employeeId,
        skillName: name,
        category: s.category,
        evidence: (s.evidence || '').trim(),
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      if (newRecords.length >= 10) break;
    }

    this.setItem('skills', [...remaining, ...newRecords]);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Skills',
      actionType: 'UPDATE',
      entityName: 'EmployeeSkills',
      recordId: employeeId.toString(),
      newValuesJson: JSON.stringify({ count: newRecords.length, skills: newRecords.map((r) => ({ name: r.skillName, cat: r.category })) }),
    });
    return newRecords;
  }

  public deleteEmployeeSkill(id: number, username: string): void {
    const list = this.getItem<EmployeeSkill[]>('skills', []);
    const item = list.find((s) => s.id === id);
    if (!item) return;
    this.setItem('skills', list.filter((s) => s.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Skills',
      actionType: 'DELETE',
      entityName: 'EmployeeSkills',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(item),
    });
  }

  // --- Complete Employee Registration & Updates ---
  public createEmployee(
    data: {
      staffId: string;
      personal: Omit<EmployeePersonalInfo, 'id' | 'employeeId' | 'fullName'>;
      employment: Omit<EmployeeEmploymentInfo, 'id' | 'employeeId' | 'statutoryRetirementDate'>;
      initialQualification?: Omit<EmployeeQualification, 'id' | 'employeeId'>;
      memberships?: Omit<EmployeeProfessionalMembership, 'id' | 'employeeId'>[];
      trainingCapabilities?: string[];
      skills?: { skillName: string; category: SkillCategory; evidence?: string }[];
    },
    username: string
  ): { employee: Employee; personal: EmployeePersonalInfo; employment: EmployeeEmploymentInfo } {
    const employees = this.getItem<Employee[]>('employees', []);
    if (!data.staffId || !data.staffId.trim()) {
      throw new Error('Validation Error: Every employee must have a unique Staff ID.');
    }
    if (employees.some((e) => e.staffId.toLowerCase() === data.staffId.trim().toLowerCase())) {
      throw new Error(`Integrity Violation: Staff ID "${data.staffId}" is already assigned to an existing employee.`);
    }

    // Business Rule 2 & 3: Valid Date of Birth & logically consistent employment dates
    const dobDate = new Date(data.personal.dateOfBirth);
    const apptDate = new Date(data.employment.dateOfFirstAppointment);
    const assumptionDate = new Date(data.employment.dateOfAssumptionOfDuty || data.employment.dateOfFirstAppointment);
    if (!data.personal.dateOfBirth || isNaN(dobDate.getTime()) || dobDate > new Date()) {
      throw new Error('Validation Error: Employee must have a valid Date of Birth in the past.');
    }
    const minEntryAge = this.getNumericSetting('MIN_ENTRY_AGE', 18);
    const maxEntryAge = this.getNumericSetting('MAX_ENTRY_AGE', 60);
    const ageAtAppt = apptDate.getFullYear() - dobDate.getFullYear() - (
      apptDate.getMonth() < dobDate.getMonth() || (apptDate.getMonth() === dobDate.getMonth() && apptDate.getDate() < dobDate.getDate()) ? 1 : 0
    );
    if (!isNaN(apptDate.getTime())) {
      if (ageAtAppt < minEntryAge) {
        throw new Error(`Validation Error: Officer age at first appointment (${ageAtAppt} yrs) is below configured minimum entry age (${minEntryAge} yrs).`);
      }
      if (ageAtAppt > maxEntryAge) {
        throw new Error(`Validation Error: Officer age at first appointment (${ageAtAppt} yrs) exceeds maximum statutory age (${maxEntryAge} yrs).`);
      }
      if (!isNaN(assumptionDate.getTime()) && assumptionDate < apptDate) {
        throw new Error('Validation Error: Date of Assumption of Duty cannot precede Date of First Appointment.');
      }
      if (data.employment.confirmationDate) {
        const confDate = new Date(data.employment.confirmationDate);
        if (!isNaN(confDate.getTime()) && confDate < apptDate) {
          throw new Error('Validation Error: Confirmation Date cannot precede Date of First Appointment.');
        }
      }
    }

    const newEmpId = employees.length > 0 ? Math.max(...employees.map((e) => e.id)) + 1 : 1;
    const nowIso = new Date().toISOString();

    const newEmp: Employee = {
      id: newEmpId,
      staffId: data.staffId.trim().toUpperCase(),
      isActive: true,
      isDeleted: false,
      createdDate: nowIso,
      createdBy: username,
      modifiedDate: nowIso,
      modifiedBy: username,
    };
    employees.push(newEmp);
    this.setItem('employees', employees);

    // Calculate Full Name
    const fullName = [data.personal.firstName, data.personal.otherNames, data.personal.surname]
      .filter(Boolean)
      .join(' ');

    // Personal Info
    const personalList = this.getItem<EmployeePersonalInfo[]>('personalInfo', []);
    const newPersonalId = personalList.length > 0 ? Math.max(...personalList.map((p) => p.id)) + 1 : 1;
    const newPersonal: EmployeePersonalInfo = {
      ...data.personal,
      id: newPersonalId,
      employeeId: newEmpId,
      fullName,
    };
    personalList.push(newPersonal);
    this.setItem('personalInfo', personalList);

    // Calculate Statutory Retirement Date (Min of DOB + retirementAge or FirstAppt + serviceYears)
    const retirementAge = this.getNumericSetting('STATUTORY_RETIREMENT_AGE', 60);
    const serviceYears = this.getNumericSetting('STATUTORY_SERVICE_YEARS', 35);
    const dob = new Date(data.personal.dateOfBirth);
    const appt = new Date(data.employment.dateOfFirstAppointment);
    const retByAge = new Date(dob);
    retByAge.setFullYear(retByAge.getFullYear() + retirementAge);
    const retByService = new Date(appt);
    retByService.setFullYear(retByService.getFullYear() + serviceYears);

    const statutoryRetDate = retByAge < retByService ? retByAge : retByService;
    const statutoryRetirementDate = statutoryRetDate.toISOString().split('T')[0];

    // Employment Info
    const employmentList = this.getItem<EmployeeEmploymentInfo[]>('employmentInfo', []);
    const newEmploymentId = employmentList.length > 0 ? Math.max(...employmentList.map((e) => e.id)) + 1 : 1;
    const newEmployment: EmployeeEmploymentInfo = {
      ...data.employment,
      id: newEmploymentId,
      employeeId: newEmpId,
      statutoryRetirementDate,
    };
    employmentList.push(newEmployment);
    this.setItem('employmentInfo', employmentList);

    // Optional Initial Qualification
    this.runWithSuppressedNotifications(() => {
      if (data.initialQualification && data.initialQualification.qualificationTitle) {
        this.addQualification(
          { ...data.initialQualification, employeeId: newEmpId },
          username
        );
      }

      // Professional Regulatory Memberships
      if (data.memberships && data.memberships.length > 0) {
        data.memberships.forEach((m) => {
          this.addEmployeeMembership({ ...m, employeeId: newEmpId }, username);
        });
      }

      // Role-Related Specific Training Capabilities (Section B)
      if (data.trainingCapabilities && data.trainingCapabilities.length > 0) {
        this.setTrainingCapabilities(newEmpId, data.trainingCapabilities, username);
      }

      // Skills Possessed by Staff (Section E)
      if (data.skills && data.skills.length > 0) {
        this.setEmployeeSkills(newEmpId, data.skills, username);
      }
    });

    // Audit Logging
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Registration',
      actionType: 'INSERT',
      entityName: 'Employees',
      recordId: newEmp.staffId,
      newValuesJson: JSON.stringify({
        staffId: newEmp.staffId,
        fullName,
        mdaId: newEmployment.currentMdaId,
        departmentId: newEmployment.currentDepartmentId,
        gradeId: newEmployment.currentGradeId,
        category: newEmployment.employeeCategory,
        retirementDate: statutoryRetirementDate,
        membershipsCount: data.memberships?.length || 0,
        capabilitiesCount: data.trainingCapabilities?.length || 0,
        skillsCount: data.skills?.length || 0,
        source: 'Manual Form',
      }),
    });

    return { employee: newEmp, personal: newPersonal, employment: newEmployment };
  }

  public bulkInsertEmployeesBatch(
    records: {
      staffId: string;
      personal: Omit<EmployeePersonalInfo, 'id' | 'employeeId' | 'fullName'>;
      employment: Omit<EmployeeEmploymentInfo, 'id' | 'employeeId' | 'statutoryRetirementDate'>;
      initialQualification?: Omit<EmployeeQualification, 'id' | 'employeeId'>;
      memberships?: Omit<EmployeeProfessionalMembership, 'id' | 'employeeId'>[];
      trainingCapabilities?: string[];
      skills?: { skillName: string; category: SkillCategory; evidence?: string }[];
    }[],
    username: string,
    batchId: string
  ): {
    staffId: string;
    fullName: string;
    result: 'Imported' | 'Skipped' | 'Failed';
    reason: string;
  }[] {
    const employees = this.getItem<Employee[]>('employees', []);
    const personalList = this.getItem<EmployeePersonalInfo[]>('personalInfo', []);
    const employmentList = this.getItem<EmployeeEmploymentInfo[]>('employmentInfo', []);
    const qualifications = this.getItem<EmployeeQualification[]>('qualifications', []);
    const membershipsList = this.getItem<EmployeeProfessionalMembership[]>('memberships', []);
    const capabilitiesList = this.getItem<EmployeeTrainingCapability[]>('trainingCapabilities', []);
    const skillsList = this.getItem<EmployeeSkill[]>('skills', []);
    const auditLogs = this.getItem<AuditTrailLog[]>('auditLogs', []);

    const existingIdSet = new Set(employees.map((e) => e.staffId.trim().toUpperCase()));

    let nextEmpId = employees.length > 0 ? Math.max(...employees.map((e) => e.id)) + 1 : 1;
    let nextPersonalId = personalList.length > 0 ? Math.max(...personalList.map((p) => p.id)) + 1 : 1;
    let nextEmploymentId = employmentList.length > 0 ? Math.max(...employmentList.map((e) => e.id)) + 1 : 1;
    let nextQualId = qualifications.length > 0 ? Math.max(...qualifications.map((q) => q.id)) + 1 : 1;
    let nextMembershipId = membershipsList.length > 0 ? Math.max(...membershipsList.map((m) => m.id)) + 1 : 1;
    let nextCapId = capabilitiesList.length > 0 ? Math.max(...capabilitiesList.map((c) => c.id)) + 1 : 1;
    let nextSkillId = skillsList.length > 0 ? Math.max(...skillsList.map((s) => s.id)) + 1 : 1;
    let nextAuditId = auditLogs.length > 0 ? Math.max(...auditLogs.map((l) => l.id)) + 1 : 1;

    const outcomes: {
      staffId: string;
      fullName: string;
      result: 'Imported' | 'Skipped' | 'Failed';
      reason: string;
    }[] = [];

    const nowIso = new Date().toISOString();

    for (const data of records) {
      const cleanStaffId = data.staffId.trim().toUpperCase();
      const fullName = [data.personal.firstName, data.personal.otherNames, data.personal.surname]
        .filter(Boolean)
        .join(' ');

      if (!cleanStaffId) {
        outcomes.push({
          staffId: '(Blank)',
          fullName,
          result: 'Failed',
          reason: 'Missing Staff ID at save time.',
        });
        continue;
      }

      // Re-check uniqueness against database right before saving; never overwrite
      if (existingIdSet.has(cleanStaffId)) {
        outcomes.push({
          staffId: cleanStaffId,
          fullName,
          result: 'Skipped',
          reason: `Conflict detected before save: Staff ID "${cleanStaffId}" already exists in database (existing record preserved).`,
        });
        continue;
      }

      try {
        // Compute Statutory Retirement Date (Min of DOB + 60 or FirstAppt + 35)
        const dob = new Date(data.personal.dateOfBirth);
        const appt = new Date(data.employment.dateOfFirstAppointment);
        const retByAge = new Date(dob);
        retByAge.setFullYear(retByAge.getFullYear() + 60);
        const retByService = new Date(appt);
        retByService.setFullYear(retByService.getFullYear() + 35);
        const statutoryRetDate = retByAge < retByService ? retByAge : retByService;
        const statutoryRetirementDate = statutoryRetDate.toISOString().split('T')[0];

        const empId = nextEmpId++;
        existingIdSet.add(cleanStaffId);

        const newEmp: Employee = {
          id: empId,
          staffId: cleanStaffId,
          isActive: true,
          isDeleted: false,
          createdDate: nowIso,
          createdBy: username,
          modifiedDate: nowIso,
          modifiedBy: username,
        };
        employees.push(newEmp);

        const newPersonal: EmployeePersonalInfo = {
          ...data.personal,
          id: nextPersonalId++,
          employeeId: empId,
          fullName,
        };
        personalList.push(newPersonal);

        const newEmployment: EmployeeEmploymentInfo = {
          ...data.employment,
          id: nextEmploymentId++,
          employeeId: empId,
          statutoryRetirementDate,
        };
        employmentList.push(newEmployment);

        if (data.initialQualification && data.initialQualification.qualificationTitle) {
          qualifications.push({
            ...data.initialQualification,
            id: nextQualId++,
            employeeId: empId,
          });
        }

        const seenMembershipKeys = new Set<string>();
        let cleanMembershipsCount = 0;
        const todayIso = nowIso.split('T')[0];
        for (const m of data.memberships || []) {
          const body = (m.professionalBody || '').trim();
          const num = (m.membershipNumber || '').trim();
          if (!body || !num) continue;
          const key = `${body.toLowerCase()}::${num.toLowerCase()}`;
          if (seenMembershipKeys.has(key)) continue;
          seenMembershipKeys.add(key);

          membershipsList.push({
            id: nextMembershipId++,
            employeeId: empId,
            professionalBody: body,
            membershipNumber: num,
            membershipCategory: (m.membershipCategory || '').trim() || 'Full Member',
            registrationDate: (m.registrationDate || '').trim() || todayIso,
            expiryDate: m.expiryDate?.trim() || undefined,
            membershipStatus: m.membershipStatus || 'Active',
          });
          cleanMembershipsCount++;
          if (cleanMembershipsCount >= 10) break;
        }

        const cleanCaps = (data.trainingCapabilities || [])
          .map((c) => c.trim())
          .filter((c) => c.length > 0)
          .slice(0, 10);

        cleanCaps.forEach((capability) => {
          capabilitiesList.push({
            id: nextCapId++,
            employeeId: empId,
            capability,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        });

        const seenSkillNames = new Set<string>();
        const cleanSkills: { skillName: string; category: SkillCategory; evidence: string }[] = [];
        for (const s of data.skills || []) {
          const name = s.skillName.trim();
          if (!name) continue;
          const key = name.toLowerCase();
          if (seenSkillNames.has(key)) continue;
          seenSkillNames.add(key);
          cleanSkills.push({
            skillName: name,
            category: s.category,
            evidence: (s.evidence || '').trim(),
          });
          skillsList.push({
            id: nextSkillId++,
            employeeId: empId,
            skillName: name,
            category: s.category,
            evidence: (s.evidence || '').trim(),
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          if (cleanSkills.length >= 10) break;
        }

        auditLogs.push({
          id: nextAuditId++,
          userId: 1,
          username: username || 'admin',
          machineName: 'WIN11-HR-NODE01',
          ipOrHost: '127.0.0.1 (Local Standalone)',
          module: 'Staff Registration',
          actionType: 'INSERT',
          entityName: 'Employees',
          recordId: newEmp.staffId,
          newValuesJson: JSON.stringify({
            staffId: newEmp.staffId,
            fullName,
            mdaId: newEmployment.currentMdaId,
            departmentId: newEmployment.currentDepartmentId,
            gradeId: newEmployment.currentGradeId,
            category: newEmployment.employeeCategory,
            retirementDate: statutoryRetirementDate,
            membershipsCount: cleanMembershipsCount,
            capabilitiesCount: cleanCaps.length,
            skillsCount: cleanSkills.length,
            source: 'Bulk Upload',
            batchId,
          }),
          timestampUtc: nowIso,
        });

        outcomes.push({
          staffId: cleanStaffId,
          fullName,
          result: 'Imported',
          reason: `Registered successfully (Retirement: ${statutoryRetirementDate}).`,
        });
      } catch (err: any) {
        outcomes.push({
          staffId: cleanStaffId,
          fullName,
          result: 'Failed',
          reason: err?.message || 'Unexpected error while staging record.',
        });
      }
    }

    // Persist batch atomically
    this.setItem('employees', employees);
    this.setItem('personalInfo', personalList);
    this.setItem('employmentInfo', employmentList);
    this.setItem('qualifications', qualifications);
    this.setItem('memberships', membershipsList);
    this.setItem('trainingCapabilities', capabilitiesList);
    this.setItem('skills', skillsList);
    this.setItem('auditLogs', auditLogs);

    const importedCount = outcomes.filter((o) => o.result === 'Imported').length;
    const skippedCount = outcomes.filter((o) => o.result === 'Skipped').length;
    const failedCount = outcomes.filter((o) => o.result === 'Failed').length;

    if (importedCount > 0 && skippedCount === 0 && failedCount === 0) {
      notificationService.success(
        'Bulk Staff Import Completed',
        `Successfully imported ${importedCount} personnel record(s) into the nominal roll.`,
        { module: 'Staff Registration', actor: username }
      );
    } else if (importedCount > 0) {
      notificationService.warning(
        'Bulk Import Completed with Exceptions',
        `Imported ${importedCount}, skipped ${skippedCount} duplicate(s), and encountered ${failedCount} failure(s).`,
        { module: 'Staff Registration', actor: username }
      );
    } else {
      notificationService.error(
        'Bulk Staff Import Unsuccessful',
        `No records imported (${skippedCount} skipped, ${failedCount} failed). Review batch validation output.`,
        { module: 'Staff Registration', actor: username }
      );
    }

    return outcomes;
  }

  public updateEmployee(
    employeeId: number,
    data: {
      personal?: Partial<EmployeePersonalInfo>;
      employment?: Partial<EmployeeEmploymentInfo>;
      memberships?: Omit<EmployeeProfessionalMembership, 'id' | 'employeeId'>[];
      trainingCapabilities?: string[];
      skills?: { skillName: string; category: SkillCategory; evidence?: string }[];
    },
    username: string
  ): void {
    const personalList = this.getItem<EmployeePersonalInfo[]>('personalInfo', []);
    const pIdx = personalList.findIndex((p) => p.employeeId === employeeId);
    let oldPersonal: EmployeePersonalInfo | undefined;

    if (pIdx !== -1 && data.personal) {
      oldPersonal = { ...personalList[pIdx] };
      const updated = { ...personalList[pIdx], ...data.personal };
      updated.fullName = [updated.firstName, updated.otherNames, updated.surname]
        .filter(Boolean)
        .join(' ');
      personalList[pIdx] = updated;
      this.setItem('personalInfo', personalList);
    }

    const employmentList = this.getItem<EmployeeEmploymentInfo[]>('employmentInfo', []);
    const eIdx = employmentList.findIndex((e) => e.employeeId === employeeId);
    let oldEmployment: EmployeeEmploymentInfo | undefined;

    if (eIdx !== -1 && data.employment) {
      oldEmployment = { ...employmentList[eIdx] };
      employmentList[eIdx] = { ...employmentList[eIdx], ...data.employment };
      this.setItem('employmentInfo', employmentList);
    }

    // Update Professional Memberships, Training Capabilities, and Skills silently within parent update
    this.runWithSuppressedNotifications(() => {
      if (data.memberships !== undefined) {
        this.setEmployeeMemberships(employeeId, data.memberships, username);
      }
      if (data.trainingCapabilities !== undefined) {
        this.setTrainingCapabilities(employeeId, data.trainingCapabilities, username);
      }
      if (data.skills !== undefined) {
        this.setEmployeeSkills(employeeId, data.skills, username);
      }
    });

    // Update Employee modified audit
    const employees = this.getItem<Employee[]>('employees', []);
    const empIdx = employees.findIndex((e) => e.id === employeeId);
    if (empIdx !== -1) {
      employees[empIdx].modifiedDate = new Date().toISOString();
      employees[empIdx].modifiedBy = username;
      this.setItem('employees', employees);
    }

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Management',
      actionType: 'UPDATE',
      entityName: 'Employees',
      recordId: employeeId.toString(),
      oldValuesJson: JSON.stringify({ personal: oldPersonal, employment: oldEmployment }),
      newValuesJson: JSON.stringify({
        personal: data.personal,
        employment: data.employment,
        membershipsUpdated: data.memberships !== undefined,
        capabilitiesUpdated: data.trainingCapabilities !== undefined,
        skillsUpdated: data.skills !== undefined,
      }),
    });
  }

  public deleteEmployee(employeeId: number, username: string): void {
    const employees = this.getItem<Employee[]>('employees', []);
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;

    // Business Rule 11: Employee records must not be permanently deleted when historical transactions exist
    if (this.getBooleanSetting('BLOCK_DELETE_WITH_HISTORY', true)) {
      const hasHistory =
        this.getStaffMovementHistory(employeeId).length > 0 ||
        this.getStaffMovements().some((m) => m.employeeId === employeeId) ||
        this.getPromotionRecommendations().some((p) => p.employeeId === employeeId) ||
        this.getLeaveApplications(employeeId).length > 0 ||
        this.getPerformanceAppraisals(employeeId).length > 0 ||
        this.getEmployeePayslips(undefined, employeeId).length > 0 ||
        this.getSeparationRecords(employeeId).length > 0;
      if (hasHistory) {
        notificationService.warning(
          'Deletion Blocked by Audit Policy',
          `Officer ${emp.staffId} has historical transactions and must be processed via Separation instead.`,
          { module: 'Staff Management', actor: username }
        );
        throw new Error(
          `Business Rule Violation: Officer ${emp.staffId} has immutable historical transactions (movements, leave, payroll, or appraisals) and cannot be deleted. Process a formal Separation instead.`
        );
      }
    }

    // Mark as deleted
    emp.isDeleted = true;
    emp.isActive = false;
    emp.modifiedDate = new Date().toISOString();
    emp.modifiedBy = username;
    this.setItem('employees', employees);

    // Cascade delete linked capabilities and skills
    const capabilities = this.getItem<EmployeeTrainingCapability[]>('trainingCapabilities', []);
    this.setItem('trainingCapabilities', capabilities.filter((c) => c.employeeId !== employeeId));

    const skills = this.getItem<EmployeeSkill[]>('skills', []);
    this.setItem('skills', skills.filter((s) => s.employeeId !== employeeId));

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Management',
      actionType: 'DELETE',
      entityName: 'Employees',
      recordId: emp.staffId,
      oldValuesJson: JSON.stringify({ employeeId, staffId: emp.staffId }),
    });
  }

  // --- Department & Organization Management ---
  public createMda(
    mda: Omit<Mda, 'id'>,
    username: string
  ): Mda {
    const list = this.getItem<Mda[]>('mdas', []);
    const newId = list.length > 0 ? Math.max(...list.map((m) => m.id)) + 1 : 1;
    const newMda: Mda = { ...mda, id: newId };
    list.push(newMda);
    this.setItem('mdas', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Organization Structure',
      actionType: 'INSERT',
      entityName: 'MDAs',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newMda),
    });
    return newMda;
  }

  public updateMda(
    id: number,
    data: Partial<Mda>,
    username: string
  ): void {
    const list = this.getItem<Mda[]>('mdas', []);
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('mdas', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Organization Structure',
      actionType: 'UPDATE',
      entityName: 'MDAs',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(list[idx]),
    });
  }

  public deleteMda(
    id: number,
    username: string
  ): { success: boolean; message: string } {
    const list = this.getItem<Mda[]>('mdas', []);
    const target = list.find((m) => m.id === id);
    if (!target) {
      return { success: false, message: 'Ministry / MDA record not found.' };
    }

    // Integrity check 1: ensure no departments remain linked to this MDA
    const linkedDepts = this.getItem<Department[]>('departments', []).filter(
      (d) => d.mdaId === id
    );
    if (linkedDepts.length > 0) {
      return {
        success: false,
        message: `Cannot delete "${target.name}" while ${linkedDepts.length} department(s) belong to it. Delete or reassign those departments first.`,
      };
    }

    // Integrity check 2: ensure no active officers are directly assigned to this MDA
    const activeEmployees = this.getEmployees();
    const employmentList = this.getItem<EmployeeEmploymentInfo[]>('employmentInfo', []);
    const assignedStaffCount = activeEmployees.filter((emp) => {
      const info = employmentList.find((e) => e.employeeId === emp.id);
      return info?.currentMdaId === id && info?.currentEmploymentStatus === 'Active';
    }).length;

    if (assignedStaffCount > 0) {
      return {
        success: false,
        message: `Cannot delete "${target.name}" while ${assignedStaffCount} active officer(s) are assigned to it. Transfer or reassign those officers first.`,
      };
    }

    const remainingMdas = list.filter((m) => m.id !== id);
    this.setItem('mdas', remainingMdas);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Organization Structure',
      actionType: 'DELETE',
      entityName: 'MDAs',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(target),
    });

    return {
      success: true,
      message: `Ministry / MDA "${target.name}" deleted successfully.`,
    };
  }

  public createDepartment(
    dept: Omit<Department, 'id'>,
    username: string
  ): Department {
    const list = this.getItem<Department[]>('departments', []);
    const newId = list.length > 0 ? Math.max(...list.map((d) => d.id)) + 1 : 1;
    const newDept: Department = { ...dept, id: newId };
    list.push(newDept);
    this.setItem('departments', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Organization Structure',
      actionType: 'INSERT',
      entityName: 'Departments',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newDept),
    });
    return newDept;
  }

  public updateDepartment(
    id: number,
    data: Partial<Department>,
    username: string
  ): void {
    const list = this.getItem<Department[]>('departments', []);
    const idx = list.findIndex((d) => d.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('departments', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Organization Structure',
      actionType: 'UPDATE',
      entityName: 'Departments',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deleteDepartment(
    id: number,
    username: string
  ): { success: boolean; message: string } {
    const list = this.getItem<Department[]>('departments', []);
    const target = list.find((d) => d.id === id);
    if (!target) {
      return { success: false, message: 'Department record not found.' };
    }

    // Integrity check: ensure no active (non-deleted) officers are currently assigned to this department
    const activeEmployees = this.getEmployees();
    const employmentList = this.getItem<EmployeeEmploymentInfo[]>('employmentInfo', []);
    const assignedStaffCount = activeEmployees.filter((emp) => {
      const info = employmentList.find((e) => e.employeeId === emp.id);
      return info?.currentDepartmentId === id && info?.currentEmploymentStatus === 'Active';
    }).length;

    if (assignedStaffCount > 0) {
      return {
        success: false,
        message: `Cannot delete "${target.departmentName}" while ${assignedStaffCount} active officer(s) are assigned to it. Transfer or reassign those officers first.`,
      };
    }

    // Remove the department
    const remainingDepts = list.filter((d) => d.id !== id);
    this.setItem('departments', remainingDepts);

    // Clean up child operational units belonging to the deleted department
    const units = this.getItem<Unit[]>('units', []);
    const remainingUnits = units.filter((u) => u.departmentId !== id);
    if (remainingUnits.length !== units.length) {
      this.setItem('units', remainingUnits);
    }

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Organization Structure',
      actionType: 'DELETE',
      entityName: 'Departments',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(target),
    });

    return {
      success: true,
      message: `Department "${target.departmentName}" deleted successfully.`,
    };
  }

  public createUnit(
    unit: Omit<Unit, 'id'>,
    username: string
  ): Unit {
    const list = this.getItem<Unit[]>('units', []);
    const newId = list.length > 0 ? Math.max(...list.map((u) => u.id)) + 1 : 1;
    const newUnit: Unit = { ...unit, id: newId };
    list.push(newUnit);
    this.setItem('units', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Organization Structure',
      actionType: 'INSERT',
      entityName: 'Units',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newUnit),
    });
    return newUnit;
  }

  public updateUnit(
    id: number,
    data: Partial<Unit>,
    username: string
  ): void {
    const list = this.getItem<Unit[]>('units', []);
    const idx = list.findIndex((u) => u.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('units', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Organization Structure',
      actionType: 'UPDATE',
      entityName: 'Units',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deleteUnit(id: number, username: string): { success: boolean; message: string } {
    const list = this.getItem<Unit[]>('units', []);
    const unit = list.find((u) => u.id === id);
    if (!unit) {
      return { success: false, message: 'Operational unit record not found.' };
    }

    const activeEmployees = this.getEmployees();
    const employmentList = this.getItem<EmployeeEmploymentInfo[]>('employmentInfo', []);
    const assignedStaffCount = activeEmployees.filter((emp) => {
      const info = employmentList.find((e) => e.employeeId === emp.id);
      return info?.currentUnitId === id;
    }).length;

    if (assignedStaffCount > 0) {
      return {
        success: false,
        message: `Cannot delete unit "${unit.unitName}" while ${assignedStaffCount} officer(s) are posted to it. Reassign those officers first.`,
      };
    }

    this.setItem('units', list.filter((u) => u.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Organization Structure',
      actionType: 'DELETE',
      entityName: 'Units',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(unit),
    });

    return {
      success: true,
      message: `Operational unit "${unit.unitName}" deleted successfully.`,
    };
  }

  // --- Establishment & Cadre Management ---
  public createEstablishmentPosition(
    pos: Omit<EstablishmentPosition, 'id'>,
    username: string
  ): EstablishmentPosition {
    const list = this.getItem<EstablishmentPosition[]>('establishment', []);
    const newId = list.length > 0 ? Math.max(...list.map((e) => e.id)) + 1 : 1;
    const newPos: EstablishmentPosition = { ...pos, id: newId };
    list.push(newPos);
    this.setItem('establishment', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Establishment Management',
      actionType: 'INSERT',
      entityName: 'EstablishmentPositions',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newPos),
    });
    return newPos;
  }

  public updateEstablishmentPosition(
    id: number,
    data: Partial<EstablishmentPosition>,
    username: string
  ): void {
    const list = this.getItem<EstablishmentPosition[]>('establishment', []);
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('establishment', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Establishment Management',
      actionType: 'UPDATE',
      entityName: 'EstablishmentPositions',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deleteEstablishmentPosition(id: number, username: string): void {
    const list = this.getItem<EstablishmentPosition[]>('establishment', []);
    const pos = list.find((e) => e.id === id);
    if (!pos) return;
    this.setItem(
      'establishment',
      list.filter((e) => e.id !== id)
    );
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Establishment Management',
      actionType: 'DELETE',
      entityName: 'EstablishmentPositions',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(pos),
    });
  }

  // --- Staff Movements & Immutable History ---
  public getStaffMovements(): StaffMovement[] {
    return this.getItem<StaffMovement[]>('movements', []);
  }

  public getStaffMovementHistory(employeeId?: number): StaffMovementHistory[] {
    const history = this.getItem<StaffMovementHistory[]>('movementHistory', []);
    const filtered = employeeId ? history.filter((h) => h.employeeId === employeeId) : history;
    return filtered.sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
  }

  public createStaffMovement(
    movement: Omit<StaffMovement, 'id' | 'movementReferenceNumber' | 'createdTimestamp' | 'workflowStatus' | 'createdBy'> & {
      workflowStatus?: MovementWorkflowStatus;
    },
    username: string
  ): StaffMovement {
    if (!movement.effectiveDate || isNaN(new Date(movement.effectiveDate).getTime())) {
      throw new Error('Validation Error: A staff movement must have a valid Effective Date.');
    }
    const list = this.getItem<StaffMovement[]>('movements', []);
    const newId = list.length > 0 ? Math.max(...list.map((m) => m.id)) + 1 : 1;
    const refYear = new Date().getFullYear();
    const refNum = `MOV-${refYear}-${(1000 + newId).toString()}`;
    const nowIso = new Date().toISOString();

    const newMov: StaffMovement = {
      ...movement,
      id: newId,
      movementReferenceNumber: refNum,
      workflowStatus: movement.workflowStatus || 'Draft',
      createdTimestamp: nowIso,
      createdBy: username,
    };

    list.push(newMov);
    this.setItem('movements', list);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Movements',
      actionType: 'INSERT',
      entityName: 'StaffMovements',
      recordId: refNum,
      newValuesJson: JSON.stringify(newMov),
    });

    return newMov;
  }

  public updateStaffMovement(
    id: number,
    data: Partial<StaffMovement>,
    username: string
  ): void {
    const list = this.getItem<StaffMovement[]>('movements', []);
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('movements', list);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Movements',
      actionType: 'UPDATE',
      entityName: 'StaffMovements',
      recordId: old.movementReferenceNumber,
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deleteStaffMovement(id: number, username: string): { success: boolean; message: string } {
    const list = this.getItem<StaffMovement[]>('movements', []);
    const mov = list.find((m) => m.id === id);
    if (!mov) {
      return { success: false, message: 'Staff movement record not found.' };
    }
    if (mov.workflowStatus === 'Implemented' || mov.workflowStatus === 'Approved') {
      return {
        success: false,
        message: `Movement ${mov.movementReferenceNumber} is "${mov.workflowStatus}" and cannot be deleted due to statutory service integrity.`,
      };
    }
    this.setItem('movements', list.filter((m) => m.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Movements',
      actionType: 'DELETE',
      entityName: 'StaffMovements',
      recordId: mov.movementReferenceNumber,
      oldValuesJson: JSON.stringify(mov),
    });
    return {
      success: true,
      message: `Movement directive ${mov.movementReferenceNumber} deleted.`,
    };
  }

  public advanceMovementWorkflow(
    id: number,
    targetStatus: MovementWorkflowStatus,
    username: string,
    remarks?: string
  ): void {
    const list = this.getItem<StaffMovement[]>('movements', []);
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Movement record #${id} not found.`);

    const mov = list[idx];
    const oldStatus = mov.workflowStatus;
    const nowIso = new Date().toISOString();

    if (targetStatus === 'Implemented') {
      // Execute the real state transfer, updating employee and appending to permanent history
      this.implementMovement(id, username);
      return;
    }

    const updatedMov: StaffMovement = {
      ...mov,
      workflowStatus: targetStatus,
      remarks: remarks || mov.remarks,
      approvalDate: targetStatus === 'Approved' ? nowIso.slice(0, 10) : mov.approvalDate,
    };

    list[idx] = updatedMov;
    this.setItem('movements', list);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Movements',
      actionType: 'UPDATE',
      entityName: 'StaffMovements',
      recordId: mov.movementReferenceNumber,
      oldValuesJson: JSON.stringify({ status: oldStatus }),
      newValuesJson: JSON.stringify({ status: targetStatus, remarks }),
    });
  }

  public implementMovement(movementId: number, username: string): void {
    const movements = this.getItem<StaffMovement[]>('movements', []);
    const movIdx = movements.findIndex((m) => m.id === movementId);
    if (movIdx === -1) throw new Error(`Movement #${movementId} not found.`);

    const mov = movements[movIdx];
    if (!mov.effectiveDate) {
      throw new Error('Validation Error: Movement cannot be implemented without an Effective Date.');
    }
    if (this.getBooleanSetting('REQUIRE_MOVEMENT_APPROVAL', true) && mov.workflowStatus !== 'Approved') {
      throw new Error(`Business Rule Violation: Movement ${mov.movementReferenceNumber} must be in "Approved" status before implementation (currently "${mov.workflowStatus}").`);
    }
    const employee = this.getEmployeeById(mov.employeeId);
    if (!employee) throw new Error(`Officer #${mov.employeeId} not found.`);

    const employmentList = this.getItem<EmployeeEmploymentInfo[]>('employmentInfo', []);
    const empIdx = employmentList.findIndex((e) => e.employeeId === mov.employeeId);
    if (empIdx === -1) throw new Error(`Employment details for officer #${mov.employeeId} not found.`);

    const oldEmployment = { ...employmentList[empIdx] };

    // 1. Update current placement (Zero-Overwrite: updating current pointer while snapshotting history)
    employmentList[empIdx] = {
      ...employmentList[empIdx],
      currentMdaId: mov.newMdaId,
      currentDepartmentId: mov.newDepartmentId,
      currentUnitId: mov.newUnitId,
      currentPositionTitle: mov.newPositionTitle,
      currentGradeId: mov.newGradeId,
      currentSalaryLevel: mov.newSalaryLevel,
      currentSalaryStep: mov.newSalaryStep,
      dateAssignedCurrentRole: mov.effectiveDate,
      dateAssignedCurrentGrade:
        mov.newGradeId !== oldEmployment.currentGradeId ? mov.effectiveDate : oldEmployment.dateAssignedCurrentGrade,
      currentEmploymentStatus:
        mov.movementType === 'Secondment'
          ? 'On Secondment'
          : mov.movementType === 'Return from Secondment'
          ? 'Active'
          : oldEmployment.currentEmploymentStatus,
    };
    this.setItem('employmentInfo', employmentList);

    // 2. Mark movement record as Implemented
    const nowIso = new Date().toISOString();
    movements[movIdx] = {
      ...mov,
      workflowStatus: 'Implemented',
      implementationDate: nowIso,
    };
    this.setItem('movements', movements);

    // 3. Lookups for descriptive permanent history
    const mdas = this.getMdas();
    const depts = this.getDepartments();
    const units = this.getUnits();
    const grades = this.getGradeLevels();

    const mdaFrom = mdas.find((m) => m.id === mov.previousMdaId)?.name || 'Previous MDA';
    const mdaTo = mdas.find((m) => m.id === mov.newMdaId)?.name || 'New MDA';
    const deptFrom = depts.find((d) => d.id === mov.previousDepartmentId)?.departmentName || 'Previous Department';
    const deptTo = depts.find((d) => d.id === mov.newDepartmentId)?.departmentName || 'New Department';
    const unitFrom = units.find((u) => u.id === mov.previousUnitId)?.unitName;
    const unitTo = units.find((u) => u.id === mov.newUnitId)?.unitName;
    const gradeFrom = grades.find((g) => g.id === mov.previousGradeId)?.gradeName || 'Previous Grade';
    const gradeTo = grades.find((g) => g.id === mov.newGradeId)?.gradeName || 'Assigned Grade';

    // 4. Append permanent immutable record to StaffMovementHistory
    const historyList = this.getItem<StaffMovementHistory[]>('movementHistory', []);
    const newHistId = historyList.length > 0 ? Math.max(...historyList.map((h) => h.id)) + 1 : 1;
    const historyEntry: StaffMovementHistory = {
      id: newHistId,
      movementId: mov.id,
      employeeId: mov.employeeId,
      movementReferenceNumber: mov.movementReferenceNumber,
      movementType: mov.movementType,
      mdaNameFrom: mdaFrom,
      mdaNameTo: mdaTo,
      departmentNameFrom: deptFrom,
      departmentNameTo: deptTo,
      unitNameFrom: unitFrom,
      unitNameTo: unitTo,
      positionTitleFrom: mov.previousPositionTitle,
      positionTitleTo: mov.newPositionTitle,
      gradeNameFrom: gradeFrom,
      gradeNameTo: gradeTo,
      effectiveDate: mov.effectiveDate,
      approvalDate: mov.approvalDate || nowIso.slice(0, 10),
      implementedDate: nowIso.slice(0, 10),
      approvedByOfficerName: username,
      reason: mov.movementReason,
      supportingDocumentReference: mov.supportingDocumentName,
      archivedSnapshotJson: JSON.stringify({
        mda: mdaFrom,
        department: deptFrom,
        position: mov.previousPositionTitle,
        grade: gradeFrom,
        salaryStep: mov.previousSalaryStep,
      }),
      recordedTimestamp: nowIso,
    };
    historyList.push(historyEntry);
    this.setItem('movementHistory', historyList);

    // 5. Tamper-Proof Audit Trail Entry
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Staff Movements',
      actionType: 'APPROVE_MOVEMENT',
      entityName: 'StaffMovements',
      recordId: mov.movementReferenceNumber,
      oldValuesJson: JSON.stringify(oldEmployment),
      newValuesJson: JSON.stringify(employmentList[empIdx]),
    });
  }

  // --- Recruitment & Appointments ---
  public getRecruitmentApplicants(): RecruitmentApplicant[] {
    const existing = this.getItem<RecruitmentApplicant[]>('recruitmentApplicants', []);
    if (existing.length === 0 && !this.isFactoryWiped() && localStorage.getItem(STORAGE_PREFIX + 'recruitmentApplicants') === null) {
      // Seed default candidates if empty
      const defaultApplicants: RecruitmentApplicant[] = [
        {
          id: 1,
          applicantNumber: 'APP-2026-0101',
          vacancyPositionTitle: 'Assistant Budget Analyst',
          departmentId: 4, // Budget Directorate
          mdaId: 2, // MoF
          gradeId: 4, // L13
          cadreCategory: 'Professional',
          firstName: 'Kofi',
          surname: 'Asante',
          otherNames: 'Osei',
          gender: 'Male',
          dateOfBirth: '1995-04-12',
          nationalIdentificationNumber: 'GHA-718293041-9',
          telephoneNumber: '+233 24 555 1234',
          emailAddress: 'kofi.asante@candidate.gov.gh',
          highestQualification: 'BSc Economics & Statistics',
          institutionName: 'University of Ghana, Legon',
          yearsOfExperience: 3,
          applicationDate: '2026-02-10',
          interviewScore: 88,
          interviewDate: '2026-02-28',
          interviewNotes: 'Strong quantitative skills, exceptional civil service aptitude.',
          status: 'Selected',
        },
        {
          id: 2,
          applicantNumber: 'APP-2026-0102',
          vacancyPositionTitle: 'Executive Officer (Registry)',
          departmentId: 1, // HRMD
          mdaId: 1, // OHCS
          gradeId: 2, // L11
          cadreCategory: 'Sub-Professional',
          firstName: 'Eunice',
          surname: 'Appiah',
          otherNames: 'Yaa',
          gender: 'Female',
          dateOfBirth: '1997-11-05',
          nationalIdentificationNumber: 'GHA-829304152-4',
          telephoneNumber: '+233 20 777 9876',
          emailAddress: 'eunice.appiah@candidate.gov.gh',
          highestQualification: 'HND Secretaryship & Management Studies',
          institutionName: 'Accra Technical University',
          yearsOfExperience: 2,
          applicationDate: '2026-02-15',
          interviewScore: 82,
          interviewDate: '2026-03-01',
          interviewNotes: 'High typing speed, thorough knowledge of registry filing codes.',
          status: 'Shortlisted',
        },
        {
          id: 3,
          applicantNumber: 'APP-2026-0103',
          vacancyPositionTitle: 'Assistant Planning Officer',
          departmentId: 2, // RSIMD
          mdaId: 1, // OHCS
          gradeId: 4, // L13
          cadreCategory: 'Professional',
          firstName: 'Emmanuel',
          surname: 'Darko',
          otherNames: 'Kwabena',
          gender: 'Male',
          dateOfBirth: '1993-08-22',
          nationalIdentificationNumber: 'GHA-930415263-8',
          telephoneNumber: '+233 55 444 8899',
          emailAddress: 'emmanuel.darko@candidate.gov.gh',
          highestQualification: 'BSc Development Planning',
          institutionName: 'KNUST Kumasi',
          yearsOfExperience: 4,
          applicationDate: '2026-02-20',
          interviewScore: 91,
          interviewDate: '2026-03-02',
          interviewNotes: 'Top scoring candidate in analytical modeling and spatial planning.',
          status: 'Selected',
        },
      ];
      this.setItem('recruitmentApplicants', defaultApplicants);
      return defaultApplicants;
    }
    return existing;
  }

  public createRecruitmentApplicant(
    applicant: Omit<RecruitmentApplicant, 'id' | 'applicantNumber' | 'applicationDate' | 'status'>,
    username: string
  ): RecruitmentApplicant {
    const list = this.getRecruitmentApplicants();
    const newId = list.length > 0 ? Math.max(...list.map((a) => a.id)) + 1 : 1;
    const refYear = new Date().getFullYear();
    const refNum = `APP-${refYear}-${(100 + newId).toString()}`;
    const newApplicant: RecruitmentApplicant = {
      ...applicant,
      id: newId,
      applicantNumber: refNum,
      applicationDate: new Date().toISOString().slice(0, 10),
      status: 'Applied',
    };
    list.push(newApplicant);
    this.setItem('recruitmentApplicants', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Recruitment & Appointments',
      actionType: 'INSERT',
      entityName: 'RecruitmentApplicants',
      recordId: refNum,
      newValuesJson: JSON.stringify(newApplicant),
    });
    return newApplicant;
  }

  public updateRecruitmentApplicant(
    id: number,
    data: Partial<RecruitmentApplicant>,
    username: string
  ): void {
    const list = this.getRecruitmentApplicants();
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('recruitmentApplicants', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Recruitment & Appointments',
      actionType: 'UPDATE',
      entityName: 'RecruitmentApplicants',
      recordId: old.applicantNumber,
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deleteRecruitmentApplicant(id: number, username: string): { success: boolean; message: string } {
    const list = this.getRecruitmentApplicants();
    const target = list.find((a) => a.id === id);
    if (!target) {
      return { success: false, message: 'Candidate record not found.' };
    }
    if (target.status === 'Appointed') {
      return {
        success: false,
        message: `Candidate ${target.applicantNumber} has already been appointed to the Nominal Roll and cannot be deleted.`,
      };
    }
    this.setItem('recruitmentApplicants', list.filter((a) => a.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Recruitment & Appointments',
      actionType: 'DELETE',
      entityName: 'RecruitmentApplicants',
      recordId: target.applicantNumber,
      oldValuesJson: JSON.stringify(target),
    });
    return {
      success: true,
      message: `Candidate ${target.firstName} ${target.surname} (${target.applicantNumber}) removed from pipeline.`,
    };
  }

  public appointApplicantToStaff(
    applicantId: number,
    options: {
      staffId: string;
      employmentType: 'Permanent & Pensionable' | 'Fixed-Term Contract' | 'Casual';
      dateOfFirstAppointment: string;
      dateOfAssumptionOfDuty: string;
      salaryStep: number;
    },
    username: string
  ): { employee: Employee; applicant: RecruitmentApplicant } {
    const applicants = this.getRecruitmentApplicants();
    const aIdx = applicants.findIndex((a) => a.id === applicantId);
    if (aIdx === -1) throw new Error(`Applicant #${applicantId} not found.`);

    const app = applicants[aIdx];
    if (app.status === 'Appointed') {
      throw new Error(`Applicant ${app.applicantNumber} has already been appointed.`);
    }

    // Call createEmployee with candidate's details (single entry converted automatically)
    const result = this.runWithSuppressedNotifications(() =>
      this.createEmployee(
        {
          staffId: options.staffId,
          personal: {
            surname: app.surname,
            firstName: app.firstName,
            otherNames: app.otherNames,
            dateOfBirth: app.dateOfBirth,
            gender: app.gender,
            maritalStatus: 'Single',
            nationality: 'Ghanaian',
            nationalIdentificationNumber: app.nationalIdentificationNumber,
            residentialAddress: 'Address verified on recruitment form',
            telephoneNumber: app.telephoneNumber,
            emailAddress: app.emailAddress,
            emergencyContactName: 'Next of kin on recruitment file',
            emergencyContactPhone: app.telephoneNumber,
            nextOfKinName: 'Next of kin on recruitment file',
            nextOfKinRelationship: 'Family',
            nextOfKinPhone: app.telephoneNumber,
          },
          employment: {
            employeeCategory: app.cadreCategory,
            employmentType: options.employmentType,
            dateOfFirstAppointment: options.dateOfFirstAppointment,
            dateOfAssumptionOfDuty: options.dateOfAssumptionOfDuty,
            currentEmploymentStatus: 'On Probation',
            currentMdaId: app.mdaId,
            currentDepartmentId: app.departmentId,
            currentPositionTitle: app.vacancyPositionTitle,
            currentGradeId: app.gradeId,
            currentSalaryLevel: this.getGradeLevels().find((g) => g.id === app.gradeId)?.hierarchyRank || 13,
            currentSalaryStep: options.salaryStep,
            dateAssignedCurrentRole: options.dateOfAssumptionOfDuty,
            dateAssignedCurrentGrade: options.dateOfAssumptionOfDuty,
          },
          initialQualification: {
            qualificationLevel: app.cadreCategory === 'Professional' ? 'Bachelor Degree' : 'HND / Diploma',
            qualificationTitle: app.highestQualification,
            institutionName: app.institutionName,
            country: 'Ghana',
            courseOfStudy: app.highestQualification,
            yearObtained: new Date().getFullYear() - 2,
            verificationStatus: 'Verified',
          },
        },
        username
      )
    );

    // Update applicant record
    applicants[aIdx] = {
      ...app,
      status: 'Appointed',
      appointedEmployeeId: result.employee.id,
    };
    this.setItem('recruitmentApplicants', applicants);

    notificationService.success(
      'Candidate Appointed to Nominal Roll',
      `${app.firstName} ${app.surname} (${app.applicantNumber}) appointed as Staff ID ${result.employee.staffId}.`,
      { module: 'Recruitment & Appointments', actor: username }
    );

    return { employee: result.employee, applicant: applicants[aIdx] };
  }

  // --- Promotions & Career Progression ---
  public getPromotionRecommendations(): PromotionRecommendation[] {
    const existing = this.getItem<PromotionRecommendation[]>('promotionRecommendations', []);
    if (existing.length === 0 && !this.isFactoryWiped() && localStorage.getItem(STORAGE_PREFIX + 'promotionRecommendations') === null) {
      // Seed default promotion recommendations showcasing both Automatic and Competitive Senior streams
      const defaultProms: PromotionRecommendation[] = [
        {
          id: 1,
          employeeId: 1, // Kwame Mensah (Principal HR Manager, assigned 2021 -> 5.1 years)
          currentGradeId: 7, // L16
          recommendedGradeId: 8, // L17 (Deputy Director)
          recommendationDate: '2026-01-15',
          yearsInCurrentGrade: 5.0,
          progressionType: 'Competitive Senior Promotion',
          competitiveExamScore: 92,
          boardInterviewPanel: 'Public Services Commission & Head of Civil Service Promotion Board',
          performanceAppraisalScore: 96,
          conductStatus: 'Cleared',
          boardReviewNotes: 'Statutory 5-year requirement on Principal Officer grade completed. Achieved 92% on Senior Management Competitive Merit Assessment. Exemplary leadership in civil service automation; met all statutory appraisal targets.',
          recommendedBy: 'hr_director',
          status: 'Board Approved',
          approvedDate: '2026-02-10',
        },
        {
          id: 2,
          employeeId: 4, // Sarah Quaye (L17 Deputy Director -> 5.5 years)
          currentGradeId: 8, // L17
          recommendedGradeId: 9, // L18 Director
          recommendationDate: '2026-02-01',
          yearsInCurrentGrade: 5.2,
          progressionType: 'Competitive Senior Promotion',
          competitiveExamScore: 89,
          boardInterviewPanel: 'Public Services Commission Senior Executive Board',
          performanceAppraisalScore: 91,
          conductStatus: 'Cleared',
          boardReviewNotes: 'Chief Officer level progression to Director. Completed 5.2 continuous years in grade. Successful performance defense before Ministerial Interview Panel.',
          recommendedBy: 'hr_manager',
          status: 'Pending Review',
        },
        {
          id: 3,
          employeeId: 2, // Abena Osei-Tutu (L15 Senior Budget Analyst, assigned 2022 -> 3.9 years)
          currentGradeId: 6, // L15
          recommendedGradeId: 7, // L16 Assistant Director I
          recommendationDate: '2026-02-15',
          yearsInCurrentGrade: 3.9,
          progressionType: 'Automatic Career Progression',
          performanceAppraisalScore: 88,
          conductStatus: 'Cleared',
          boardReviewNotes: 'Standard automatic career progression upon completing 3 years continuous service with satisfactory performance appraisals and clean conduct record.',
          recommendedBy: 'hr_specialist',
          status: 'Pending Review',
        },
      ];
      this.setItem('promotionRecommendations', defaultProms);
      return defaultProms;
    }
    return existing;
  }

  private static readonly PROCUREMENT_PROGRESSION_HIERARCHY: readonly string[] = [
    'Assistant Procurement & Supply Chain Officer II',
    'Assistant Procurement & Supply Chain Officer I',
    'Procurement & Supply Chain Officer',
    'Senior Procurement & Supply Chain Officer',
    'Principal Procurement & Supply Chain Officer',
    'Chief Procurement & Supply Chain Officer',
    'Assistant Procurement & Supply Chain Manager',
    'Procurement & Supply Chain Manager',
    'Senior Procurement & Supply Chain Manager',
    'Principal Procurement & Supply Chain Manager',
    'Chief Procurement & Supply Chain Manager',
    'Director of Procurement & Supply Chain',
  ];

  private normalizeGradeHierarchyKey(name?: string): string {
    return (name || '')
      .trim()
      .toLowerCase()
      .replace(/\s*&\s*/g, ' and ')
      .replace(/\s+/g, ' ');
  }

  public getNextGradeInHierarchy(
    currentGrade?: GradeLevel | null,
    allGrades?: GradeLevel[],
    positionTitle?: string
  ): GradeLevel | undefined {
    const grades = (allGrades || this.getGradeLevels()).filter((g) => g.isActive);
    const hierarchy = DatabaseService.PROCUREMENT_PROGRESSION_HIERARCHY;

    const candidateKey = this.normalizeGradeHierarchyKey(currentGrade?.gradeName || positionTitle);
    const procIdx = hierarchy.findIndex(
      (step) => this.normalizeGradeHierarchyKey(step) === candidateKey
    );

    if (procIdx !== -1) {
      if (procIdx >= hierarchy.length - 1) return undefined;
      const nextKey = this.normalizeGradeHierarchyKey(hierarchy[procIdx + 1]);
      return grades.find((g) => this.normalizeGradeHierarchyKey(g.gradeName) === nextKey);
    }

    if (!currentGrade) return undefined;

    // General Civil Service explicit Senior Management Officer sequence
    const currentKey = this.normalizeGradeHierarchyKey(currentGrade.gradeName);
    if (currentKey === 'principal officer') {
      return grades.find((g) => this.normalizeGradeHierarchyKey(g.gradeName) === 'chief officer');
    }
    if (currentKey === 'chief officer') {
      return grades.find((g) => this.normalizeGradeHierarchyKey(g.gradeName) === 'director');
    }

    const currentRank = currentGrade.hierarchyRank || 1;
    const isProcGroup = currentGrade.occupationalGroup === 'Procurement & Supply Chain Management';
    const potentialNextGrades = grades
      .filter(
        (g) =>
          g.hierarchyRank > currentRank &&
          (isProcGroup || g.occupationalGroup !== 'Procurement & Supply Chain Management')
      )
      .sort((a, b) => a.hierarchyRank - b.hierarchyRank);

    const sameGroupNext = potentialNextGrades.find(
      (g) => g.occupationalGroup === currentGrade.occupationalGroup
    );
    if (sameGroupNext) return sameGroupNext;

    if (currentGrade.occupationalGroup === 'Executive Cadre') {
      return potentialNextGrades.find((g) => g.occupationalGroup === 'General Administration');
    }

    return potentialNextGrades[0];
  }

  public getNextGradeLabel(
    currentGrade?: GradeLevel | null,
    allGrades?: GradeLevel[],
    positionTitle?: string
  ): string {
    const grades = allGrades || this.getGradeLevels();
    const hierarchy = DatabaseService.PROCUREMENT_PROGRESSION_HIERARCHY;
    const candidateKey = this.normalizeGradeHierarchyKey(currentGrade?.gradeName || positionTitle);
    const procIdx = hierarchy.findIndex(
      (step) => this.normalizeGradeHierarchyKey(step) === candidateKey
    );

    if (procIdx !== -1) {
      if (procIdx >= hierarchy.length - 1) return 'Peak Grade';
      const nextCanonical = hierarchy[procIdx + 1];
      const nextKey = this.normalizeGradeHierarchyKey(nextCanonical);
      const matched = grades.find(
        (g) => g.isActive && this.normalizeGradeHierarchyKey(g.gradeName) === nextKey
      );
      return matched ? matched.gradeName : nextCanonical;
    }

    if (!currentGrade) return 'N/A';

    const nextGrade = this.getNextGradeInHierarchy(currentGrade, grades, positionTitle);
    return nextGrade ? nextGrade.gradeName : 'Peak Grade';
  }

  /**
   * Evaluates statutory Civil Service Career Progression & Senior Management Promotion Policy:
   * 1. General Rule: All employees are eligible for automatic progression to next grade after 3 years
   *    of continuous satisfactory service, subject to satisfactory performance, good conduct, and compliance.
   * 2. Senior Management Exceptions:
   *    - Minimum 5 years continuous service on Principal Officer before eligible for promotion to Chief Officer.
   *    - Minimum 5 years continuous service on Chief Officer before eligible for promotion to Director.
   *    - Promotion from Principal Officer -> Chief Officer and Chief Officer -> Director is NON-AUTOMATIC
   *      and strictly based on merit and a competitive promotion process.
   */
  public evaluatePromotionEligibility(employeeId: number): PromotionEligibilityResult {
    const empInfo = this.getEmployeeEmploymentInfo(employeeId);
    const grades = this.getGradeLevels();
    const currentGrade = grades.find((g) => g.id === empInfo?.currentGradeId);
    const yearsInGrade = empInfo?.dateAssignedCurrentGrade
      ? this.calculateYearsInCurrentGrade(empInfo.dateAssignedCurrentGrade)
      : 0;

    const currentGradeName = (currentGrade?.gradeName || '').toLowerCase();
    const isPrincipal = currentGradeName.includes('principal');
    const isChief = currentGradeName.includes('chief') && !currentGradeName.includes('director');

    const stdMinYears = this.getNumericSetting('PROMOTION_STANDARD_YEARS', 3);
    const seniorMinYears = this.getNumericSetting('PROMOTION_SENIOR_YEARS', 5);

    let requiredYears = stdMinYears;
    let progressionType: ProgressionType = 'Automatic Career Progression';
    let progressionMode: 'Automatic' | 'Competitive' = 'Automatic';
    let isSeniorManagement = false;
    let statutoryRuleSummary =
      `Statutory Career Progression: Eligible for automatic progression after completing ${stdMinYears} years of continuous service on current grade, subject to satisfactory performance, good conduct, and compliance with all organizational requirements.`;

    if (isPrincipal) {
      requiredYears = seniorMinYears;
      progressionType = 'Competitive Senior Promotion';
      progressionMode = 'Competitive';
      isSeniorManagement = true;
      statutoryRuleSummary =
        `Senior Management Promotion (Merit-Based): An employee must serve a minimum of ${seniorMinYears} years on the grade of Principal Officer before becoming eligible for promotion to Chief Officer. Promotion is non-automatic and based on merit and a competitive promotion process.`;
    } else if (isChief) {
      requiredYears = seniorMinYears;
      progressionType = 'Competitive Senior Promotion';
      progressionMode = 'Competitive';
      isSeniorManagement = true;
      statutoryRuleSummary =
        `Senior Management Promotion (Merit-Based): An employee must serve a minimum of ${seniorMinYears} years on the grade of Chief Officer before becoming eligible for promotion to Director. Promotion is non-automatic and based on merit and a competitive promotion process.`;
    } else if (currentGrade?.minYearsInGradeForPromotion) {
      requiredYears = currentGrade.minYearsInGradeForPromotion;
      if (currentGrade.progressionMode === 'Competitive' || currentGrade.isSeniorManagement) {
        progressionType = 'Competitive Senior Promotion';
        progressionMode = 'Competitive';
        isSeniorManagement = true;
      }
    }

    const blockerReasons: string[] = [];
    const hasSufficientTimeInGrade = yearsInGrade >= requiredYears;
    if (!hasSufficientTimeInGrade) {
      blockerReasons.push(
        `Requires minimum ${requiredYears}.0 continuous years in current grade (currently ${yearsInGrade.toFixed(1)} yrs - ${(requiredYears - yearsInGrade).toFixed(1)} yrs remaining)`
      );
    }

    // Performance appraisal check (SPAS)
    const appraisals = this.getPerformanceAppraisals(employeeId);
    const latestAppraisal = appraisals[0];
    let hasSatisfactoryPerformance = true;
    let performanceScore = latestAppraisal?.overallScorePercentage || 85;
    let performanceRating = latestAppraisal?.finalRating || 'Satisfactory';

    if (latestAppraisal) {
      performanceScore = latestAppraisal.overallScorePercentage;
      performanceRating = latestAppraisal.finalRating;
      if (latestAppraisal.finalRating === 'Unsatisfactory' || latestAppraisal.overallScorePercentage < 70) {
        hasSatisfactoryPerformance = false;
        blockerReasons.push(`Performance appraisal (${performanceRating} - ${performanceScore}%) does not meet satisfactory requirement (min 70%)`);
      }
    }

    // Conduct & Disciplinary check
    const disciplinaryCases = this.getDisciplinaryCases(employeeId);
    let hasCleanConduct = true;
    let conductStatus: 'Cleared' | 'Sanction Active' | 'Pending Review' = 'Cleared';
    let activeSanctionDetails: string | undefined;

    const underInvestigation = disciplinaryCases.find(
      (c) => c.caseStatus === 'Under Investigation' || c.caseStatus === 'Committee Hearing' || c.caseStatus === 'Reported'
    );
    const sanctionActive = disciplinaryCases.find(
      (c) => c.outcome === 'Charge Established' && c.caseStatus !== 'Closed'
    );

    if (underInvestigation) {
      hasCleanConduct = false;
      conductStatus = 'Pending Review';
      activeSanctionDetails = `Disciplinary case ${underInvestigation.caseReference} under active inquiry`;
      blockerReasons.push(`Disciplinary inquiry in progress (${underInvestigation.natureOfOffence})`);
    } else if (sanctionActive) {
      hasCleanConduct = false;
      conductStatus = 'Sanction Active';
      activeSanctionDetails = `Active sanction: ${sanctionActive.sanctionRecommended || 'Sanction Pending'}`;
      blockerReasons.push(`Active disciplinary sanction on record (${sanctionActive.sanctionRecommended})`);
    }

    // Next grade in approved progression hierarchy
    const suggestedTargetGrade = this.getNextGradeInHierarchy(currentGrade, grades, empInfo?.currentPositionTitle);

    const isEligible = hasSufficientTimeInGrade && hasSatisfactoryPerformance && hasCleanConduct;

    return {
      employeeId,
      yearsInGrade,
      requiredYears,
      progressionType,
      progressionMode,
      isSeniorManagement,
      statutoryRuleSummary,
      hasSufficientTimeInGrade,
      hasSatisfactoryPerformance,
      performanceScore,
      performanceRating,
      hasCleanConduct,
      conductStatus,
      activeSanctionDetails,
      isEligible,
      blockerReasons,
      suggestedTargetGrade,
    };
  }

  public createPromotionRecommendation(
    rec: Omit<PromotionRecommendation, 'id' | 'recommendationDate' | 'status'>,
    username: string
  ): PromotionRecommendation {
    const list = this.getPromotionRecommendations();
    const newId = list.length > 0 ? Math.max(...list.map((p) => p.id)) + 1 : 1;
    const newRec: PromotionRecommendation = {
      ...rec,
      id: newId,
      recommendationDate: new Date().toISOString().slice(0, 10),
      status: 'Pending Review',
    };
    list.push(newRec);
    this.setItem('promotionRecommendations', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Promotion Management',
      actionType: 'INSERT',
      entityName: 'PromotionRecommendations',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newRec),
    });
    return newRec;
  }

  public updatePromotionRecommendation(
    id: number,
    data: Partial<PromotionRecommendation>,
    username: string
  ): void {
    const list = this.getPromotionRecommendations();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) return;
    if (list[idx].status === 'Implemented') {
      throw new Error('Implemented promotion recommendations are locked for audit integrity.');
    }
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('promotionRecommendations', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Promotion Management',
      actionType: 'UPDATE',
      entityName: 'PromotionRecommendations',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deletePromotionRecommendation(id: number, username: string): { success: boolean; message: string } {
    const list = this.getPromotionRecommendations();
    const target = list.find((p) => p.id === id);
    if (!target) {
      return { success: false, message: 'Promotion recommendation not found.' };
    }
    if (target.status === 'Implemented') {
      return {
        success: false,
        message: 'Implemented promotion records cannot be deleted once enacted onto the Nominal Roll.',
      };
    }
    this.setItem('promotionRecommendations', list.filter((p) => p.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Promotion Management',
      actionType: 'DELETE',
      entityName: 'PromotionRecommendations',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(target),
    });
    return {
      success: true,
      message: `Promotion recommendation #${id} deleted.`,
    };
  }

  public approveAndImplementPromotion(
    recommendationId: number,
    effectiveDate: string,
    newSalaryStep: number,
    username: string
  ): void {
    const list = this.getPromotionRecommendations();
    const idx = list.findIndex((p) => p.id === recommendationId);
    if (idx === -1) throw new Error(`Promotion recommendation #${recommendationId} not found.`);

    const rec = list[idx];
    const employee = this.getEmployeeById(rec.employeeId);
    const empInfo = this.getEmployeeEmploymentInfo(rec.employeeId);
    if (!employee || !empInfo) throw new Error(`Employee #${rec.employeeId} not found.`);

    const grades = this.getGradeLevels();
    const targetGrade = grades.find((g) => g.id === rec.recommendedGradeId);
    if (!targetGrade) throw new Error(`Target Grade #${rec.recommendedGradeId} not found.`);

    // Create a Promotion Staff Movement and implement it directly!
    this.runWithSuppressedNotifications(() => {
      const movement = this.createStaffMovement(
        {
          employeeId: rec.employeeId,
          movementType: 'Promotion',
          previousMdaId: empInfo.currentMdaId,
          newMdaId: empInfo.currentMdaId,
          previousDepartmentId: empInfo.currentDepartmentId,
          newDepartmentId: empInfo.currentDepartmentId,
          previousUnitId: empInfo.currentUnitId,
          newUnitId: empInfo.currentUnitId,
          previousPositionTitle: empInfo.currentPositionTitle,
          newPositionTitle: `${targetGrade.gradeName} (${empInfo.currentPositionTitle})`,
          previousGradeId: empInfo.currentGradeId,
          newGradeId: rec.recommendedGradeId,
          previousSalaryLevel: empInfo.currentSalaryLevel,
          newSalaryLevel: targetGrade.hierarchyRank,
          previousSalaryStep: empInfo.currentSalaryStep,
          newSalaryStep: newSalaryStep,
          effectiveDate: effectiveDate,
          movementReason: `Civil Service Promotion Board Approval: ${rec.boardReviewNotes}`,
          workflowStatus: 'Approved',
          approvalDate: new Date().toISOString().slice(0, 10),
        },
        username
      );

      // Implement it to update employee's grade and preserve history
      this.implementMovement(movement.id, username);
    });

    // Update recommendation status
    list[idx] = {
      ...rec,
      status: 'Implemented',
      approvedDate: new Date().toISOString().slice(0, 10),
    };
    this.setItem('promotionRecommendations', list);

    notificationService.success(
      'Promotion Approved & Implemented',
      `Officer ${employee.staffId} promoted to ${targetGrade.gradeName} (Effective ${effectiveDate}).`,
      { module: 'Promotion Management', actor: username }
    );
  }

  // --- Leave Management ---
  public getLeaveTypes(): LeaveType[] {
    const defaultTypes: LeaveType[] = [
      { id: 1, leaveCode: 'ANNUAL', leaveName: 'Annual Leave', defaultDaysPerYear: 36, isPaid: true },
      { id: 2, leaveCode: 'SICK', leaveName: 'Sick Leave', defaultDaysPerYear: 30, isPaid: true },
      { id: 3, leaveCode: 'MATERNITY', leaveName: 'Maternity Leave', defaultDaysPerYear: 84, isPaid: true },
      { id: 4, leaveCode: 'PATERNITY', leaveName: 'Paternity Leave', defaultDaysPerYear: 7, isPaid: true },
      { id: 5, leaveCode: 'STUDY_PAID', leaveName: 'Study Leave (With Pay)', defaultDaysPerYear: 365, isPaid: true },
      { id: 6, leaveCode: 'CASUAL', leaveName: 'Casual Leave', defaultDaysPerYear: 10, isPaid: true },
      { id: 7, leaveCode: 'COMPASSIONATE', leaveName: 'Compassionate Leave', defaultDaysPerYear: 10, isPaid: true },
      { id: 8, leaveCode: 'EXAM', leaveName: 'Examination Leave', defaultDaysPerYear: 14, isPaid: true },
      { id: 9, leaveCode: 'SPECIAL', leaveName: 'Special Leave', defaultDaysPerYear: 14, isPaid: true },
      { id: 10, leaveCode: 'UNPAID', leaveName: 'Unpaid Leave', defaultDaysPerYear: 180, isPaid: false },
    ];
    return this.getItem<LeaveType[]>('leaveTypes', defaultTypes);
  }

  public getLeaveBalances(employeeId?: number): LeaveBalance[] {
    let balances = this.getItem<LeaveBalance[]>('leaveBalances', []);
    if (balances.length === 0 && !this.isFactoryWiped() && localStorage.getItem(STORAGE_PREFIX + 'leaveBalances') === null) {
      // Seed default annual leave balances for active employees
      const emps = this.getEmployees();
      const currentYear = new Date().getFullYear();
      balances = emps.map((emp, idx) => ({
        id: idx + 1,
        employeeId: emp.id,
        leaveTypeId: 1, // Annual
        calendarYear: currentYear,
        annualEntitlementDays: 36,
        broughtForwardDays: idx % 2 === 0 ? 5 : 0,
        daysTaken: idx === 0 ? 12 : idx === 1 ? 6 : 0,
        availableDays: idx === 0 ? 29 : idx === 1 ? 30 : 36,
      }));
      this.setItem('leaveBalances', balances);
    }
    return employeeId ? balances.filter((b) => b.employeeId === employeeId) : balances;
  }

  public getLeaveApplications(employeeId?: number): LeaveApplication[] {
    let apps = this.getItem<LeaveApplication[]>('leaveApplications', []);
    if (apps.length === 0 && !this.isFactoryWiped() && localStorage.getItem(STORAGE_PREFIX + 'leaveApplications') === null) {
      // Seed initial sample applications
      apps = [
        {
          id: 1,
          leaveReferenceNumber: 'LV-2026-0001',
          employeeId: 1, // Kwame Mensah
          leaveTypeId: 1, // Annual
          startDate: '2026-04-10',
          endDate: '2026-04-24',
          daysRequested: 10,
          handoverOfficerEmployeeId: 7,
          reason: 'Annual statutory vacation and personal rest.',
          contactAddressWhileOnLeave: 'Plot 12, Airport Residential, Accra',
          contactPhoneWhileOnLeave: '+233 24 412 3456',
          workflowStatus: 'Approved',
          createdDate: '2026-03-01',
        },
        {
          id: 2,
          leaveReferenceNumber: 'LV-2026-0002',
          employeeId: 3, // Grace Mensah
          leaveTypeId: 6, // Casual
          startDate: '2026-03-25',
          endDate: '2026-03-27',
          daysRequested: 3,
          handoverOfficerEmployeeId: 4,
          reason: 'Family urgent bereavement attendance.',
          contactAddressWhileOnLeave: 'Kumasi Central',
          contactPhoneWhileOnLeave: '+233 20 765 4321',
          workflowStatus: 'Supervisor Recommended',
          createdDate: '2026-03-10',
        },
        {
          id: 3,
          leaveReferenceNumber: 'LV-2026-0003',
          employeeId: 5, // Emmanuel Appiah
          leaveTypeId: 2, // Sick
          startDate: '2026-03-15',
          endDate: '2026-03-19',
          daysRequested: 5,
          reason: 'Medical treatment and convalescence per Korle Bu doctor memo.',
          workflowStatus: 'Submitted',
          createdDate: '2026-03-14',
        },
      ];
      this.setItem('leaveApplications', apps);
    }
    const filtered = employeeId ? apps.filter((a) => a.employeeId === employeeId) : apps;
    return filtered.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
  }

  public createLeaveApplication(
    app: Omit<LeaveApplication, 'id' | 'leaveReferenceNumber' | 'createdDate' | 'workflowStatus'>,
    username: string
  ): LeaveApplication {
    const list = this.getLeaveApplications();
    const newId = list.length > 0 ? Math.max(...list.map((a) => a.id)) + 1 : 1;
    const refYear = new Date().getFullYear();
    const refNum = `LV-${refYear}-${(1000 + newId).toString()}`;
    const newApp: LeaveApplication = {
      ...app,
      id: newId,
      leaveReferenceNumber: refNum,
      workflowStatus: 'Submitted',
      createdDate: new Date().toISOString().slice(0, 10),
    };
    list.push(newApp);
    this.setItem('leaveApplications', list);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Leave Management',
      actionType: 'INSERT',
      entityName: 'LeaveApplications',
      recordId: refNum,
      newValuesJson: JSON.stringify(newApp),
    });

    return newApp;
  }

  public updateLeaveApplication(
    id: number,
    data: Partial<LeaveApplication>,
    username: string
  ): { success: boolean; message: string } {
    const list = this.getLeaveApplications();
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) {
      return { success: false, message: 'Leave application not found.' };
    }
    const old = list[idx];
    if (old.workflowStatus !== 'Submitted' && old.workflowStatus !== 'Rejected') {
      return {
        success: false,
        message: `Leave ${old.leaveReferenceNumber} is "${old.workflowStatus}" and can no longer be edited.`,
      };
    }
    list[idx] = { ...old, ...data };
    this.setItem('leaveApplications', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Leave Management',
      actionType: 'UPDATE',
      entityName: 'LeaveApplications',
      recordId: old.leaveReferenceNumber,
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
    return { success: true, message: `Leave application ${old.leaveReferenceNumber} updated.` };
  }

  public deleteLeaveApplication(id: number, username: string): { success: boolean; message: string } {
    const list = this.getLeaveApplications();
    const target = list.find((a) => a.id === id);
    if (!target) {
      return { success: false, message: 'Leave application not found.' };
    }
    if (target.workflowStatus !== 'Submitted' && target.workflowStatus !== 'Rejected') {
      return {
        success: false,
        message: `Leave ${target.leaveReferenceNumber} is "${target.workflowStatus}" and cannot be withdrawn/deleted to protect statutory leave balances.`,
      };
    }
    this.setItem('leaveApplications', list.filter((a) => a.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Leave Management',
      actionType: 'DELETE',
      entityName: 'LeaveApplications',
      recordId: target.leaveReferenceNumber,
      oldValuesJson: JSON.stringify(target),
    });
    return {
      success: true,
      message: `Leave application ${target.leaveReferenceNumber} withdrawn and removed.`,
    };
  }

  public advanceLeaveWorkflow(
    id: number,
    targetStatus: 'Supervisor Recommended' | 'HR Reviewed' | 'Approved' | 'Rejected',
    username: string
  ): void {
    const list = this.getLeaveApplications();
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return;

    const app = list[idx];

    // If Approved, validate & deduct days from LeaveBalance automatically
    if (targetStatus === 'Approved') {
      const balances = this.getLeaveBalances();
      const leaveTypes = this.getLeaveTypes();
      const lt = leaveTypes.find((t) => t.id === app.leaveTypeId);
      const currentYear = new Date().getFullYear();
      const bIdx = balances.findIndex(
        (b) => b.employeeId === app.employeeId && b.leaveTypeId === app.leaveTypeId && b.calendarYear === currentYear
      );
      if (bIdx !== -1) {
        if (this.getBooleanSetting('STRICT_LEAVE_BALANCE_CHECK', true) && lt?.isPaid && app.daysRequested > balances[bIdx].availableDays) {
          throw new Error(
            `Leave Balance Violation: Officer has ${balances[bIdx].availableDays} available days but requested ${app.daysRequested} paid leave days.`
          );
        }
        balances[bIdx].daysTaken += app.daysRequested;
        balances[bIdx].availableDays = Math.max(
          0,
          balances[bIdx].annualEntitlementDays + balances[bIdx].broughtForwardDays - balances[bIdx].daysTaken
        );
        this.setItem('leaveBalances', balances);
      }
    }

    list[idx] = { ...app, workflowStatus: targetStatus };
    this.setItem('leaveApplications', list);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Leave Management',
      actionType: 'UPDATE',
      entityName: 'LeaveApplications',
      recordId: app.leaveReferenceNumber,
      newValuesJson: JSON.stringify({ status: targetStatus }),
    });
  }

  public resumeLeave(id: number, resumptionDate: string, username: string): void {
    const list = this.getLeaveApplications();
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return;

    list[idx] = { ...list[idx], workflowStatus: 'Resumed', resumptionDate };
    this.setItem('leaveApplications', list);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Leave Management',
      actionType: 'UPDATE',
      entityName: 'LeaveApplications',
      recordId: list[idx].leaveReferenceNumber,
      newValuesJson: JSON.stringify({ status: 'Resumed', resumptionDate }),
    });
  }

  // --- Attendance Management ---
  public getAttendanceRecords(dateFilter?: string, employeeId?: number): AttendanceRecord[] {
    let records = this.getItem<AttendanceRecord[]>('attendanceRecords', []);
    if (records.length === 0 && !this.isFactoryWiped() && localStorage.getItem(STORAGE_PREFIX + 'attendanceRecords') === null) {
      // Seed default attendance for today and yesterday
      const emps = this.getEmployees();
      const today = new Date().toISOString().slice(0, 10);
      records = emps.map((emp, idx) => ({
        id: idx + 1,
        employeeId: emp.id,
        date: today,
        checkInTime: idx === 2 ? '08:45' : idx === 4 ? '09:15' : '07:55',
        checkOutTime: idx === 0 ? '17:05' : undefined,
        status: idx === 4 ? 'Late' : idx === 6 ? 'Official Duty' : 'Present',
        remarks: idx === 4 ? 'Arrived after 08:30 threshold' : undefined,
      }));
      this.setItem('attendanceRecords', records);
    }

    return records.filter((r) => {
      if (dateFilter && r.date !== dateFilter) return false;
      if (employeeId && r.employeeId !== employeeId) return false;
      return true;
    });
  }

  public recordAttendance(
    record: Omit<AttendanceRecord, 'id'>,
    username: string
  ): AttendanceRecord {
    const list = this.getAttendanceRecords();
    const existingIdx = list.findIndex(
      (r) => r.employeeId === record.employeeId && r.date === record.date
    );

    if (existingIdx !== -1) {
      // Update existing record
      list[existingIdx] = { ...list[existingIdx], ...record };
      this.setItem('attendanceRecords', list);
      return list[existingIdx];
    } else {
      const newId = list.length > 0 ? Math.max(...list.map((r) => r.id)) + 1 : 1;
      const newRec: AttendanceRecord = { ...record, id: newId };
      list.push(newRec);
      this.setItem('attendanceRecords', list);
      return newRec;
    }
  }

  public deleteAttendanceRecord(employeeId: number, date: string, username: string): void {
    const list = this.getItem<AttendanceRecord[]>('attendanceRecords', []);
    const target = list.find((r) => r.employeeId === employeeId && r.date === date);
    if (!target) return;
    this.setItem(
      'attendanceRecords',
      list.filter((r) => !(r.employeeId === employeeId && r.date === date))
    );
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Attendance Management',
      actionType: 'DELETE',
      entityName: 'AttendanceRecords',
      recordId: `${employeeId}:${date}`,
      oldValuesJson: JSON.stringify(target),
    });
  }

  public bulkGenerateDailyAttendance(date: string, username: string): void {
    const emps = this.getEmployees();
    const existing = this.getAttendanceRecords(date);
    const existingEmpIds = new Set(existing.map((e) => e.employeeId));

    const list = this.getItem<AttendanceRecord[]>('attendanceRecords', []);
    let maxId = list.length > 0 ? Math.max(...list.map((r) => r.id)) : 0;

    emps.forEach((emp) => {
      if (!existingEmpIds.has(emp.id)) {
        maxId++;
        const isLate = Math.random() < 0.15;
        list.push({
          id: maxId,
          employeeId: emp.id,
          date: date,
          checkInTime: isLate ? '08:42' : '07:58',
          status: isLate ? 'Late' : 'Present',
        });
      }
    });

    this.setItem('attendanceRecords', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Attendance Management',
      actionType: 'INSERT',
      entityName: 'AttendanceRecords',
      recordId: date,
      newValuesJson: JSON.stringify({ count: emps.length, date }),
    });
  }

  // --- Training & Development ---
  public getTrainingPrograms(): TrainingProgram[] {
    let progs = this.getItem<TrainingProgram[]>('trainingPrograms', []);
    if (progs.length === 0 && !this.isFactoryWiped() && localStorage.getItem(STORAGE_PREFIX + 'trainingPrograms') === null) {
      progs = [
        {
          id: 1,
          programCode: 'TRN-2026-01',
          title: 'Civil Service Executive Leadership & Strategic Governance',
          category: 'Scheme of Service',
          institutionName: 'Ghana Institute of Management and Public Administration (GIMPA)',
          location: 'Greenhill Campus, Accra',
          startDate: '2026-04-15',
          endDate: '2026-04-20',
          durationDays: 5,
          costGhs: 4500,
          sponsoredBy: 'Office of the Head of Civil Service (OHCS)',
          status: 'Planned',
        },
        {
          id: 2,
          programCode: 'TRN-2026-02',
          title: 'Public Financial Management Act & Budget Consolidation',
          category: 'Conferences / Workshops / Webinars',
          institutionName: 'Civil Service Training Centre (CSTC)',
          location: 'CSTC Auditorium, Ministries, Accra',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
          durationDays: 5,
          costGhs: 2800,
          sponsoredBy: 'Ministry of Finance',
          status: 'Completed',
        },
        {
          id: 3,
          programCode: 'TRN-2026-03',
          title: 'Government Enterprise Electronic Records & Archives Management',
          category: 'On-the-Job Training',
          institutionName: 'Public Records and Archives Administration Department (PRAAD)',
          location: 'National ICT Hub, Accra',
          startDate: '2026-05-10',
          endDate: '2026-05-14',
          durationDays: 4,
          costGhs: 3200,
          sponsoredBy: 'OHCS Capacity Building Fund',
          status: 'Planned',
        },
      ];
      this.setItem('trainingPrograms', progs);
    }
    return progs;
  }

  public createTrainingProgram(
    prog: Omit<TrainingProgram, 'id' | 'programCode'>,
    username: string
  ): TrainingProgram {
    const list = this.getTrainingPrograms();
    const newId = list.length > 0 ? Math.max(...list.map((p) => p.id)) + 1 : 1;
    const refYear = new Date().getFullYear();
    const code = `TRN-${refYear}-${(10 + newId).toString()}`;
    const newProg: TrainingProgram = { ...prog, id: newId, programCode: code };
    list.push(newProg);
    this.setItem('trainingPrograms', list);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Training & Development',
      actionType: 'INSERT',
      entityName: 'TrainingPrograms',
      recordId: code,
      newValuesJson: JSON.stringify(newProg),
    });
    return newProg;
  }

  public updateTrainingProgram(
    id: number,
    data: Partial<TrainingProgram>,
    username: string
  ): void {
    const list = this.getTrainingPrograms();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...old, ...data };
    this.setItem('trainingPrograms', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Training & Development',
      actionType: 'UPDATE',
      entityName: 'TrainingPrograms',
      recordId: old.programCode,
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deleteTrainingProgram(id: number, username: string): { success: boolean; message: string } {
    const list = this.getTrainingPrograms();
    const target = list.find((p) => p.id === id);
    if (!target) {
      return { success: false, message: 'Training program not found.' };
    }
    const nominations = this.getTrainingNominations(id);
    if (nominations.length > 0) {
      return {
        success: false,
        message: `Cannot delete "${target.title}" while ${nominations.length} officer nomination(s) are linked to it. Withdraw nominations first.`,
      };
    }
    this.setItem('trainingPrograms', list.filter((p) => p.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Training & Development',
      actionType: 'DELETE',
      entityName: 'TrainingPrograms',
      recordId: target.programCode,
      oldValuesJson: JSON.stringify(target),
    });
    return {
      success: true,
      message: `Training program "${target.programCode}" deleted.`,
    };
  }

  public getTrainingNominations(programId?: number, employeeId?: number): TrainingNomination[] {
    let noms = this.getItem<TrainingNomination[]>('trainingNominations', []);
    if (noms.length === 0 && !this.isFactoryWiped() && localStorage.getItem(STORAGE_PREFIX + 'trainingNominations') === null) {
      noms = [
        {
          id: 1,
          trainingProgramId: 2, // PFM Completed
          employeeId: 1, // Kwame Mensah
          nominationDate: '2026-02-15',
          status: 'Certified',
          certificateNumber: 'CSTC-PFM-2026-004',
          evaluationScore: 5,
          feedbackNotes: 'Mastered public procurement regulations and expenditure controls.',
        },
        {
          id: 2,
          trainingProgramId: 2, // PFM Completed
          employeeId: 2, // Abena Osei
          nominationDate: '2026-02-15',
          status: 'Certified',
          certificateNumber: 'CSTC-PFM-2026-005',
          evaluationScore: 5,
          feedbackNotes: 'Excellence in budget allocation modeling.',
        },
        {
          id: 3,
          trainingProgramId: 1, // Executive Leadership Planned
          employeeId: 1,
          nominationDate: '2026-03-01',
          status: 'Approved',
        },
        {
          id: 4,
          trainingProgramId: 1, // Executive Leadership Planned
          employeeId: 6, // Sarah Addo
          nominationDate: '2026-03-01',
          status: 'Approved',
        },
      ];
      this.setItem('trainingNominations', noms);
    }

    return noms.filter((n) => {
      if (programId && n.trainingProgramId !== programId) return false;
      if (employeeId && n.employeeId !== employeeId) return false;
      return true;
    });
  }

  public nominateEmployeeForTraining(
    nom: Omit<TrainingNomination, 'id' | 'nominationDate' | 'status'>,
    username: string
  ): TrainingNomination {
    const list = this.getTrainingNominations();
    const newId = list.length > 0 ? Math.max(...list.map((n) => n.id)) + 1 : 1;
    const newNom: TrainingNomination = {
      ...nom,
      id: newId,
      nominationDate: new Date().toISOString().slice(0, 10),
      status: 'Nominated',
    };
    list.push(newNom);
    this.setItem('trainingNominations', list);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Training & Development',
      actionType: 'INSERT',
      entityName: 'TrainingNominations',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newNom),
    });
    return newNom;
  }

  public updateTrainingNomination(
    id: number,
    data: Partial<TrainingNomination>,
    username: string
  ): void {
    const list = this.getTrainingNominations();
    const idx = list.findIndex((n) => n.id === id);
    if (idx === -1) return;
    list[idx] = { ...list[idx], ...data };
    this.setItem('trainingNominations', list);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Training & Development',
      actionType: 'UPDATE',
      entityName: 'TrainingNominations',
      recordId: id.toString(),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deleteTrainingNomination(id: number, username: string): void {
    const list = this.getTrainingNominations();
    const target = list.find((n) => n.id === id);
    if (!target) return;
    this.setItem('trainingNominations', list.filter((n) => n.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Training & Development',
      actionType: 'DELETE',
      entityName: 'TrainingNominations',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(target),
    });
  }

  // --- Performance Management ---
  public getPerformanceAppraisals(employeeId?: number): PerformanceAppraisal[] {
    let appraisals = this.getItem<PerformanceAppraisal[]>('performanceAppraisals', []);
    if (appraisals.length === 0 && !this.isFactoryWiped() && localStorage.getItem(STORAGE_PREFIX + 'performanceAppraisals') === null) {
      appraisals = [
        {
          id: 1,
          appraisalCycle: '2025/2026 Annual Staff Appraisal',
          employeeId: 1, // Kwame Mensah
          supervisorEmployeeId: 6, // Sarah Addo
          appraisalPeriodStart: '2025-01-01',
          appraisalPeriodEnd: '2025-12-31',
          kpiTargetsSummary: 'Automation of Civil Service Nominal Roll, Departmental Staff Audits, Recruitment Processing.',
          selfAssessmentScore: 4.8,
          supervisorScore: 4.9,
          finalRating: 'Outstanding',
          overallScorePercentage: 96,
          strengthsAndAchievements: 'Exemplary leadership in enterprise HRMIS rollout; resolved backlog of inter-agency movements.',
          areasForImprovement: 'Expand delegation of routine registry tasks to executive officers.',
          status: 'Completed',
          completedDate: '2026-01-15',
        },
        {
          id: 2,
          appraisalCycle: '2025/2026 Annual Staff Appraisal',
          employeeId: 2, // Abena Osei
          supervisorEmployeeId: 1,
          appraisalPeriodStart: '2025-01-01',
          appraisalPeriodEnd: '2025-12-31',
          kpiTargetsSummary: 'Medium-Term Expenditure Framework analysis, Ministerial Budget Hearings.',
          selfAssessmentScore: 4.5,
          supervisorScore: 4.6,
          finalRating: 'Exceeds Expectations',
          overallScorePercentage: 91,
          strengthsAndAchievements: 'Rigorous fiscal data modeling, timely submissions for parliamentary budget approval.',
          areasForImprovement: 'Enroll in advanced public financial econometric forecasting.',
          status: 'Completed',
          completedDate: '2026-01-18',
        },
        {
          id: 3,
          appraisalCycle: '2025/2026 Annual Staff Appraisal',
          employeeId: 3, // Grace Mensah
          supervisorEmployeeId: 1,
          appraisalPeriodStart: '2025-01-01',
          appraisalPeriodEnd: '2025-12-31',
          kpiTargetsSummary: 'Civil Service Census Survey, Statistical Digest Publication.',
          selfAssessmentScore: 4.0,
          supervisorScore: 4.2,
          finalRating: 'Meets Expectations',
          overallScorePercentage: 84,
          strengthsAndAchievements: 'Consistent data collection and high reporting accuracy across regional directorates.',
          areasForImprovement: 'Strengthen timely submission deadlines.',
          status: 'Supervisor Review',
        },
      ];
      this.setItem('performanceAppraisals', appraisals);
    }

    const filtered = employeeId ? appraisals.filter((a) => a.employeeId === employeeId) : appraisals;
    return filtered.sort((a, b) => b.id - a.id);
  }

  public createPerformanceAppraisal(
    appraisal: Omit<PerformanceAppraisal, 'id'>,
    username: string
  ): PerformanceAppraisal {
    const list = this.getPerformanceAppraisals();
    const newId = list.length > 0 ? Math.max(...list.map((a) => a.id)) + 1 : 1;
    const newAppr: PerformanceAppraisal = { ...appraisal, id: newId };
    list.push(newAppr);
    this.setItem('performanceAppraisals', list);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Performance Management',
      actionType: 'INSERT',
      entityName: 'PerformanceAppraisals',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newAppr),
    });
    return newAppr;
  }

  public updatePerformanceAppraisal(
    id: number,
    data: Partial<PerformanceAppraisal>,
    username: string
  ): void {
    const list = this.getPerformanceAppraisals();
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return;

    list[idx] = { ...list[idx], ...data };
    this.setItem('performanceAppraisals', list);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Performance Management',
      actionType: 'UPDATE',
      entityName: 'PerformanceAppraisals',
      recordId: id.toString(),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deletePerformanceAppraisal(id: number, username: string): { success: boolean; message: string } {
    const list = this.getPerformanceAppraisals();
    const target = list.find((a) => a.id === id);
    if (!target) {
      return { success: false, message: 'Appraisal record not found.' };
    }
    if (target.status === 'Completed') {
      return {
        success: false,
        message: 'Completed performance appraisals are locked for promotion eligibility auditing and cannot be deleted.',
      };
    }
    this.setItem('performanceAppraisals', list.filter((a) => a.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Performance Management',
      actionType: 'DELETE',
      entityName: 'PerformanceAppraisals',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(target),
    });
    return {
      success: true,
      message: `Performance appraisal #${id} deleted.`,
    };
  }

  // --- Users & Roles (RBAC) ---
  public getUsers(): User[] {
    return this.getItem<User[]>('users', []);
  }

  public getUserByUsername(username: string): User | undefined {
    return this.getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  }

  public authenticateUser(
    identifier: string,
    password: string
  ): { success: boolean; user?: User; error?: string } {
    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId || !password) {
      return { success: false, error: 'Please enter both username and password.' };
    }

    const users = this.getUsers();
    const idx = users.findIndex(
      (u) => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
    );
    if (idx === -1) {
      notificationService.security(
        'Sign-In Rejected',
        `Unrecognized account identifier '${identifier}'.`,
        { module: 'Security & Auth', actor: identifier || 'Guest' }
      );
      return { success: false, error: 'Invalid username or password.' };
    }

    const target = users[idx];
    if (!target.isActive) {
      notificationService.security(
        'Deactivated Account Blocked',
        `Sign-in blocked for deactivated account '${target.username}'.`,
        { module: 'Security & Auth', actor: target.username }
      );
      return {
        success: false,
        error: 'This account has been deactivated. Contact your System Administrator.',
      };
    }

    if (target.failedLoginAttempts >= 5) {
      notificationService.security(
        'Locked Account Sign-In Blocked',
        `Account '${target.username}' is locked pending administrator unlock.`,
        { module: 'Security & Auth', actor: target.username }
      );
      return {
        success: false,
        error:
          'Account locked after 5 failed sign-in attempts. Contact the System Administrator to unlock or reset your password.',
      };
    }

    const storedHash =
      target.passwordHash ||
      hashPassword(target.username.toLowerCase() === 'admin' ? 'Admin@2026' : 'Civil@2026');

    if (!verifyPassword(password, storedHash)) {
      const nextAttempts = (target.failedLoginAttempts || 0) + 1;
      users[idx] = { ...target, failedLoginAttempts: nextAttempts };
      this.setItem('users', users);
      this.logAudit({
        userId: target.id,
        username: target.username,
        machineName: 'WIN11-HR-NODE01',
        module: 'Security & Auth',
        actionType: 'LOGIN',
        entityName: 'Users',
        recordId: target.id.toString(),
        newValuesJson: JSON.stringify({ event: 'Failed login attempt', failedAttempts: nextAttempts }),
      });
      const remaining = Math.max(0, 5 - nextAttempts);
      return {
        success: false,
        error:
          remaining === 0
            ? 'Invalid credentials. Account is now locked due to 5 failed attempts.'
            : `Invalid username or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
      };
    }

    const updatedUser: User = {
      ...target,
      passwordHash: storedHash,
      failedLoginAttempts: 0,
      lastLoginDate: new Date().toISOString(),
    };
    users[idx] = updatedUser;
    this.setItem('users', users);
    return { success: true, user: updatedUser };
  }

  public resetOwnPassword(
    username: string,
    currentPassword: string,
    newPassword: string
  ): { success: boolean; message: string; updatedUser?: User } {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.username.toLowerCase() === username.trim().toLowerCase());
    if (idx === -1) {
      return { success: false, message: 'User account not found.' };
    }

    const target = users[idx];
    if (!target.isActive) {
      return { success: false, message: 'Account is deactivated and cannot reset password.' };
    }

    const storedHash =
      target.passwordHash ||
      hashPassword(target.username.toLowerCase() === 'admin' ? 'Admin@2026' : 'Civil@2026');

    if (!verifyPassword(currentPassword, storedHash)) {
      return { success: false, message: 'Current password is incorrect.' };
    }

    if (newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }

    if (currentPassword === newPassword) {
      return {
        success: false,
        message: 'New password must be different from your current password.',
      };
    }

    const now = new Date().toISOString();
    const updatedUser: User = {
      ...target,
      passwordHash: hashPassword(newPassword),
      passwordUpdatedAt: now,
      failedLoginAttempts: 0,
    };
    users[idx] = updatedUser;
    this.setItem('users', users);

    this.logAudit({
      userId: target.id,
      username: target.username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Security & Auth',
      actionType: 'UPDATE',
      entityName: 'Users',
      recordId: target.id.toString(),
      newValuesJson: JSON.stringify({ event: 'Self-service password reset', updatedAt: now }),
    });

    return {
      success: true,
      message: 'Your password has been updated and committed securely.',
      updatedUser,
    };
  }

  public adminResetUserPassword(
    targetUserId: number,
    newPassword: string,
    actorUsername: string,
    actorRoleName?: string
  ): { success: boolean; message: string; updatedUser?: User } {
    if (actorRoleName !== 'System Administrator') {
      notificationService.security(
        'Unauthorized Password Reset Blocked',
        `User '${actorUsername}' attempted an administrative password reset without authorization.`,
        { module: 'Security & Auth', actor: actorUsername }
      );
      return {
        success: false,
        message: 'Access Denied: Only the System Administrator can reset passwords for other users.',
      };
    }

    if (newPassword.length < 6) {
      notificationService.error(
        'Invalid Password Policy',
        'Administrative password reset failed: new password must be at least 6 characters.',
        { module: 'Security & Auth', actor: actorUsername }
      );
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }

    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === targetUserId);
    if (idx === -1) {
      return { success: false, message: `User #${targetUserId} not found.` };
    }

    const target = users[idx];
    const now = new Date().toISOString();
    const updatedUser: User = {
      ...target,
      passwordHash: hashPassword(newPassword),
      passwordUpdatedAt: now,
      failedLoginAttempts: 0,
    };
    users[idx] = updatedUser;
    this.setItem('users', users);

    this.logAudit({
      username: actorUsername,
      machineName: 'WIN11-HR-NODE01',
      module: 'Security & Auth',
      actionType: 'UPDATE',
      entityName: 'Users',
      recordId: target.id.toString(),
      newValuesJson: JSON.stringify({
        event: 'Administrative password reset & unlock',
        targetUsername: target.username,
        resetBy: actorUsername,
        updatedAt: now,
      }),
    });

    return {
      success: true,
      message: `Password reset and failed login lock cleared for '${target.username}'.`,
      updatedUser,
    };
  }

  public createUser(
    userData: Omit<User, 'id' | 'failedLoginAttempts' | 'passwordHash'> & { password?: string },
    actorUsername: string,
    actorRoleName?: string
  ): User {
    if (actorRoleName !== 'System Administrator') {
      throw new Error('Access Denied: Only the System Administrator is authorized to create new users.');
    }

    const users = this.getUsers();
    if (users.some((u) => u.username.toLowerCase() === userData.username.trim().toLowerCase())) {
      throw new Error(`User with username '${userData.username}' already exists.`);
    }

    const rawPassword = (userData.password || '').trim();
    if (rawPassword.length < 6) {
      throw new Error('Initial password must be at least 6 characters long.');
    }

    const { password: _unusedPwd, ...restUserData } = userData;
    const newId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
    const now = new Date().toISOString();
    const newUser: User = {
      ...restUserData,
      id: newId,
      username: userData.username.trim(),
      passwordHash: hashPassword(rawPassword),
      passwordUpdatedAt: now,
      failedLoginAttempts: 0,
    };
    users.push(newUser);
    this.setItem('users', users);

    this.logAudit({
      username: actorUsername,
      machineName: 'WIN11-HR-NODE01',
      module: 'User Management',
      actionType: 'INSERT',
      entityName: 'Users',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify({ username: newUser.username, role: newUser.roleName, email: newUser.email }),
    });

    return newUser;
  }

  public updateUser(id: number, data: Partial<User>, username: string): void {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error(`User #${id} not found.`);
    const old = users[idx];
    users[idx] = { ...users[idx], ...data };
    this.setItem('users', users);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'User Management',
      actionType: 'UPDATE',
      entityName: 'Users',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify({ role: old.roleName, isActive: old.isActive }),
      newValuesJson: JSON.stringify({ role: users[idx].roleName, isActive: users[idx].isActive }),
    });
  }

  public deleteUser(id: number, username: string): void {
    const users = this.getUsers();
    const target = users.find((u) => u.id === id);
    if (!target) return;
    if (target.username === 'admin') throw new Error('Cannot delete primary system administrator.');
    this.setItem('users', users.filter((u) => u.id !== id));

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'User Management',
      actionType: 'DELETE',
      entityName: 'Users',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify({ username: target.username, role: target.roleName }),
    });
  }

  public getRoles(): Role[] {
    return this.getItem<Role[]>('roles', []);
  }

  public createRole(roleData: Omit<Role, 'id'>, username: string): Role {
    const roles = this.getRoles();
    const newId = roles.length > 0 ? Math.max(...roles.map((r) => r.id)) + 1 : 1;
    const newRole: Role = {
      ...roleData,
      id: newId,
    };
    roles.push(newRole);
    this.setItem('roles', roles);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'User Management',
      actionType: 'INSERT',
      entityName: 'Roles',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify({ roleName: newRole.roleName, permissionsCount: newRole.permissions.length }),
    });

    return newRole;
  }

  public updateRole(id: number, data: Partial<Role>, username: string): void {
    const roles = this.getRoles();
    const idx = roles.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Role #${id} not found.`);
    const old = roles[idx];
    roles[idx] = { ...roles[idx], ...data };
    this.setItem('roles', roles);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'User Management',
      actionType: 'UPDATE',
      entityName: 'Roles',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify({ permissions: old.permissions }),
      newValuesJson: JSON.stringify({ permissions: roles[idx].permissions }),
    });
  }

  public deleteRole(id: number, username: string): { success: boolean; message: string } {
    const roles = this.getRoles();
    const target = roles.find((r) => r.id === id);
    if (!target) {
      return { success: false, message: 'Role record not found.' };
    }
    if (target.isSystemRole) {
      return {
        success: false,
        message: `Built-in system role "${target.roleName}" is protected and cannot be deleted.`,
      };
    }
    const users = this.getUsers();
    const assignedCount = users.filter((u) => u.roleId === id || u.roleName === target.roleName).length;
    if (assignedCount > 0) {
      return {
        success: false,
        message: `Cannot delete role "${target.roleName}" while ${assignedCount} user account(s) are assigned to it. Reassign users first.`,
      };
    }
    this.setItem('roles', roles.filter((r) => r.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'User Management',
      actionType: 'DELETE',
      entityName: 'Roles',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify({ roleName: target.roleName }),
    });
    return {
      success: true,
      message: `Custom role "${target.roleName}" deleted.`,
    };
  }

  // --- System Settings & Business Rules ---
  public getSystemSettings(): SystemSetting[] {
    return this.getItem<SystemSetting[]>('systemSettings', []);
  }

  public getSettingValue(key: string, fallback: string): string {
    const found = this.getSystemSettings().find((s) => s.settingKey === key);
    return found && found.settingValue !== undefined ? found.settingValue : fallback;
  }

  public getNumericSetting(key: string, fallback: number): number {
    const val = Number(this.getSettingValue(key, String(fallback)));
    return Number.isFinite(val) && val > 0 ? val : fallback;
  }

  public getBooleanSetting(key: string, fallback: boolean): boolean {
    const val = this.getSettingValue(key, String(fallback)).toLowerCase().trim();
    if (val === 'true' || val === '1' || val === 'yes') return true;
    if (val === 'false' || val === '0' || val === 'no') return false;
    return fallback;
  }

  private notifySettingsUpdated(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('haros:settings-updated'));
    }
  }

  public updateSystemSetting(key: string, value: string, username: string): void {
    const list = this.getSystemSettings();
    const idx = list.findIndex((s) => s.settingKey === key);
    if (idx !== -1) {
      const old = list[idx].settingValue;
      list[idx].settingValue = value;
      this.setItem('systemSettings', list);
      this.notifySettingsUpdated();

      this.logAudit({
        username,
        machineName: 'WIN11-HR-NODE01',
        module: 'System Configuration',
        actionType: 'UPDATE',
        entityName: 'SystemSettings',
        recordId: key,
        oldValuesJson: JSON.stringify({ [key]: old }),
        newValuesJson: JSON.stringify({ [key]: value }),
      });
    }
  }

  public bulkUpdateSystemSettings(settings: Record<string, string>, username: string): void {
    const list = this.getSystemSettings();
    Object.entries(settings).forEach(([key, val]) => {
      const idx = list.findIndex((s) => s.settingKey === key);
      if (idx !== -1) {
        list[idx].settingValue = val;
      }
    });
    this.setItem('systemSettings', list);
    this.notifySettingsUpdated();

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'System Configuration',
      actionType: 'UPDATE',
      entityName: 'SystemSettings',
      recordId: 'BULK_CONFIG',
      newValuesJson: JSON.stringify(settings),
    });
  }

  // --- Section 21: Database Backup & Restore Engine ---
  public exportDatabaseSnapshot(silent = false): string {
    const snapshot: Record<string, any> = {
      systemVersion: 'Haros HRMIS Enterprise v2.4.0',
      databaseEngine: 'SQLite WAL Mode Emulated',
      snapshotTimestamp: new Date().toISOString(),
      institution: this.getSettingValue('INSTITUTION_NAME', 'Office of the Head of Civil Service'),
      tables: {
        mdas: this.getItem('mdas', []),
        departments: this.getItem('departments', []),
        units: this.getItem('units', []),
        gradeLevels: this.getItem('gradeLevels', []),
        establishment: this.getItem('establishment', []),
        employees: this.getItem('employees', []),
        personalInfo: this.getItem('personalInfo', []),
        employmentInfo: this.getItem('employmentInfo', []),
        qualifications: this.getItem('qualifications', []),
        memberships: this.getItem('memberships', []),
        priorHistory: this.getItem('priorHistory', []),
        documents: this.getItem('documents', []),
        movements: this.getItem('movements', []),
        movementHistory: this.getItem('movementHistory', []),
        recruitmentApplicants: this.getItem('recruitmentApplicants', []),
        promotionRecommendations: this.getItem('promotionRecommendations', []),
        leaveTypes: this.getItem('leaveTypes', []),
        leaveBalances: this.getItem('leaveBalances', []),
        leaveApplications: this.getItem('leaveApplications', []),
        attendanceRecords: this.getItem('attendanceRecords', []),
        trainingPrograms: this.getItem('trainingPrograms', []),
        trainingNominations: this.getItem('trainingNominations', []),
        appraisals: this.getItem('appraisals', []),
        salaryStructures: this.getItem('salaryStructures', []),
        salaryGradeSteps: this.getItem('salaryGradeSteps', []),
        payrollComponents: this.getItem('payrollComponents', []),
        payrollAssignments: this.getItem('payrollAssignments', []),
        payrollRuns: this.getItem('payrollRuns', []),
        payslips: this.getItem('payslips', []),
        separationRecords: this.getItem('separationRecords', []),
        clearanceItems: this.getItem('clearanceItems', []),
        disciplinaryCases: this.getItem('disciplinaryCases', []),
        roles: this.getItem('roles', []),
        users: this.getItem('users', []),
        systemSettings: this.getItem('systemSettings', []),
        auditLogs: this.getItem('auditLogs', []),
      },
    };

    const jsonStr = JSON.stringify(snapshot, null, 2);

    // Record to backup history
    this.recordBackupEntry('Manual Snapshot', 'HRMIS_FULL_DB_SNAPSHOT_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json', jsonStr.length);

    if (!silent) {
      notificationService.security(
        'Database Snapshot Exported',
        `Full JSON database archive generated (${Math.max(1, Math.round(jsonStr.length / 1024))} KB).`,
        { module: 'Backup and Restore' }
      );
    }

    return jsonStr;
  }

  public getBackupHistory(): { id: number; timestamp: string; filename: string; sizeKb: number; type: string }[] {
    return this.getItem('backupHistory', [
      {
        id: 1,
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        filename: 'HRMIS_SYSTEM_AUTO_BACKUP_2026-03-08.json',
        sizeKb: 142,
        type: 'Automated Nightly WAL',
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        filename: 'HRMIS_SYSTEM_AUTO_BACKUP_2026-03-09.json',
        sizeKb: 148,
        type: 'Automated Nightly WAL',
      },
    ]);
  }

  private recordBackupEntry(type: string, filename: string, sizeBytes: number): void {
    const list = this.getBackupHistory();
    const newId = list.length > 0 ? Math.max(...list.map((b) => b.id)) + 1 : 1;
    list.unshift({
      id: newId,
      timestamp: new Date().toISOString(),
      filename,
      sizeKb: Math.round(sizeBytes / 1024),
      type,
    });
    this.setItem('backupHistory', list.slice(0, 20)); // keep last 20
  }

  public restoreDatabaseSnapshot(
    snapshotJson: string,
    username: string
  ): { success: boolean; message: string; tablesRestored: number } {
    try {
      const parsed = JSON.parse(snapshotJson);
      if (!parsed.tables || typeof parsed.tables !== 'object') {
        throw new Error('Invalid archive: Missing required "tables" root object.');
      }

      // Pre-restore safety backup: save current state first silently!
      const currentBackup = this.exportDatabaseSnapshot(true);
      localStorage.setItem(STORAGE_PREFIX + 'pre_restore_safety_backup', currentBackup);
      this.recordBackupEntry('Pre-Restore Safety Snapshot', 'PRE_RESTORE_SAFETY_SNAPSHOT.json', currentBackup.length);

      let tablesRestored = 0;
      const validTables = [
        'mdas', 'departments', 'units', 'gradeLevels', 'establishment',
        'employees', 'personalInfo', 'employmentInfo', 'qualifications',
        'memberships', 'priorHistory', 'documents', 'movements',
        'movementHistory', 'recruitmentApplicants', 'promotionRecommendations',
        'leaveTypes', 'leaveBalances', 'leaveApplications', 'attendanceRecords',
        'trainingPrograms', 'trainingNominations', 'appraisals',
        'salaryStructures', 'salaryGradeSteps', 'payrollComponents',
        'payrollAssignments', 'payrollRuns', 'payslips',
        'separationRecords', 'clearanceItems', 'disciplinaryCases',
        'roles', 'users', 'systemSettings',
      ];

      for (const tableName of validTables) {
        if (parsed.tables[tableName] && Array.isArray(parsed.tables[tableName])) {
          this.setItem(tableName, parsed.tables[tableName]);
          tablesRestored++;
        }
      }

      this.notifySettingsUpdated();

      // Preserve and append audit log for the restoration operation
      this.logAudit({
        username,
        machineName: 'WIN11-HR-NODE01',
        module: 'Backup and Restore',
        actionType: 'UPDATE',
        entityName: 'hrmis.db',
        recordId: 'RESTORE-TRANSACTION',
        newValuesJson: JSON.stringify({
          sourceArchiveDate: parsed.snapshotTimestamp,
          tablesRestored,
          restoredBy: username,
        }),
      });

      return {
        success: true,
        message: `Database successfully restored. ${tablesRestored} core tables and relationships reloaded with full integrity verification.`,
        tablesRestored,
      };
    } catch (err: any) {
      notificationService.error(
        'Database Restore Failed',
        err.message || 'Corrupt or unrecognized backup archive format.',
        { module: 'Backup and Restore', actor: username }
      );
      return {
        success: false,
        message: `Restoration failed: ${err.message || 'Corrupt snapshot format.'}`,
        tablesRestored: 0,
      };
    }
  }


  // --- Calculation Helpers ---
  public calculateAge(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  public calculateYearsInCurrentGrade(dateAssignedGrade: string): number {
    const assigned = new Date(dateAssignedGrade);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - assigned.getTime());
    const years = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    return Math.floor(years * 10) / 10;
  }

  public calculateTotalYearsOfService(dateOfFirstAppointment: string): number {
    const appt = new Date(dateOfFirstAppointment);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - appt.getTime());
    const years = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    return Math.floor(years * 10) / 10;
  }

  public calculateMonthsToRetirement(retirementDate: string): number {
    const ret = new Date(retirementDate);
    const today = new Date();
    return (ret.getFullYear() - today.getFullYear()) * 12 + (ret.getMonth() - today.getMonth());
  }

  // =========================================================================
  // SECTION 13: PAYROLL & COMPENSATION (SSSS, Allowances, Deductions, Payslips)
  // =========================================================================

  public getSalaryStructures(): SalaryStructure[] {
    return this.getItem<SalaryStructure[]>('salaryStructures', INITIAL_SALARY_STRUCTURES);
  }

  public createSalaryStructure(
    struct: Omit<SalaryStructure, 'id'>,
    username: string
  ): SalaryStructure {
    const list = this.getSalaryStructures();
    const newId = list.length > 0 ? Math.max(...list.map((s) => s.id)) + 1 : 1;
    const newStructure: SalaryStructure = { ...struct, id: newId };
    list.push(newStructure);
    this.setItem('salaryStructures', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Payroll & Compensation',
      actionType: 'INSERT',
      entityName: 'SalaryStructures',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newStructure),
    });
    return newStructure;
  }

  public updateSalaryStructure(id: number, data: Partial<SalaryStructure>, username: string): void {
    const list = this.getSalaryStructures();
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('salaryStructures', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Payroll & Compensation',
      actionType: 'UPDATE',
      entityName: 'SalaryStructures',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public getSalaryGradeSteps(gradeLevelId?: number): SalaryGradeStep[] {
    const steps = this.getItem<SalaryGradeStep[]>('salaryGradeSteps', INITIAL_SALARY_GRADE_STEPS);
    if (gradeLevelId !== undefined) {
      return steps.filter((s) => s.gradeLevelId === gradeLevelId);
    }
    return steps;
  }

  public saveSalaryGradeStep(
    step: Omit<SalaryGradeStep, 'id'> & { id?: number },
    username: string
  ): SalaryGradeStep {
    const list = this.getSalaryGradeSteps();
    if (step.id) {
      const idx = list.findIndex((s) => s.id === step.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...step } as SalaryGradeStep;
        this.setItem('salaryGradeSteps', list);
        this.logAudit({
          username,
          machineName: 'WIN11-HR-NODE01',
          module: 'Payroll & Compensation',
          actionType: 'UPDATE',
          entityName: 'SalaryGradeSteps',
          recordId: step.id.toString(),
          newValuesJson: JSON.stringify(list[idx]),
        });
        return list[idx];
      }
    }
    const newId = list.length > 0 ? Math.max(...list.map((s) => s.id)) + 1 : 1;
    const newStep: SalaryGradeStep = { ...step, id: newId };
    list.push(newStep);
    this.setItem('salaryGradeSteps', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Payroll & Compensation',
      actionType: 'INSERT',
      entityName: 'SalaryGradeSteps',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newStep),
    });
    return newStep;
  }

  public getPayrollComponents(): PayrollComponent[] {
    return this.getItem<PayrollComponent[]>('payrollComponents', INITIAL_PAYROLL_COMPONENTS);
  }

  public createPayrollComponent(
    component: Omit<PayrollComponent, 'id'>,
    username: string
  ): PayrollComponent {
    const list = this.getPayrollComponents();
    const newId = list.length > 0 ? Math.max(...list.map((c) => c.id)) + 1 : 1;
    const newComp: PayrollComponent = { ...component, id: newId };
    list.push(newComp);
    this.setItem('payrollComponents', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Payroll & Compensation',
      actionType: 'INSERT',
      entityName: 'PayrollComponents',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newComp),
    });
    return newComp;
  }

  public updatePayrollComponent(id: number, data: Partial<PayrollComponent>, username: string): void {
    const list = this.getPayrollComponents();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('payrollComponents', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Payroll & Compensation',
      actionType: 'UPDATE',
      entityName: 'PayrollComponents',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deletePayrollComponent(id: number, username: string): void {
    const list = this.getPayrollComponents();
    const comp = list.find((c) => c.id === id);
    if (!comp) return;
    this.setItem('payrollComponents', list.filter((c) => c.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Payroll & Compensation',
      actionType: 'DELETE',
      entityName: 'PayrollComponents',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(comp),
    });
  }

  public getEmployeePayrollAssignments(): EmployeePayrollAssignment[] {
    return this.getItem<EmployeePayrollAssignment[]>('payrollAssignments', INITIAL_EMPLOYEE_PAYROLL_ASSIGNMENTS);
  }

  public getEmployeePayrollAssignment(employeeId: number): EmployeePayrollAssignment | undefined {
    const list = this.getEmployeePayrollAssignments();
    return list.find((a) => a.employeeId === employeeId);
  }

  public saveEmployeePayrollAssignment(
    assignment: Omit<EmployeePayrollAssignment, 'id'> & { id?: number },
    username: string
  ): EmployeePayrollAssignment {
    const list = this.getEmployeePayrollAssignments();
    const existingIdx = list.findIndex((a) => a.employeeId === assignment.employeeId);
    if (existingIdx !== -1) {
      list[existingIdx] = { ...list[existingIdx], ...assignment } as EmployeePayrollAssignment;
      this.setItem('payrollAssignments', list);
      this.logAudit({
        username,
        machineName: 'WIN11-HR-NODE01',
        module: 'Payroll & Compensation',
        actionType: 'UPDATE',
        entityName: 'EmployeePayrollAssignment',
        recordId: list[existingIdx].id.toString(),
        newValuesJson: JSON.stringify(list[existingIdx]),
      });
      return list[existingIdx];
    }
    const newId = list.length > 0 ? Math.max(...list.map((a) => a.id)) + 1 : 1;
    const newAssignment: EmployeePayrollAssignment = { ...assignment, id: newId };
    list.push(newAssignment);
    this.setItem('payrollAssignments', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Payroll & Compensation',
      actionType: 'INSERT',
      entityName: 'EmployeePayrollAssignment',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newAssignment),
    });
    return newAssignment;
  }

  public getPayrollRuns(): PayrollRun[] {
    return this.getItem<PayrollRun[]>('payrollRuns', INITIAL_PAYROLL_RUNS).sort((a, b) => b.id - a.id);
  }

  public getPayrollRunById(id: number): PayrollRun | undefined {
    return this.getPayrollRuns().find((r) => r.id === id);
  }

  public runMonthlyPayroll(
    year: number,
    month: number,
    label: string,
    username: string
  ): { run: PayrollRun; payslips: EmployeePayslip[] } {
    const employees = this.getEmployees().filter((e) => e.isActive && !e.isDeleted);
    const assignments = this.getEmployeePayrollAssignments();
    const components = this.getPayrollComponents();
    const gradeLevels = this.getGradeLevels();
    const departments = this.getDepartments();

    const runs = this.getPayrollRuns();
    const newRunId = runs.length > 0 ? Math.max(...runs.map((r) => r.id)) + 1 : 1;

    let totalBasic = 0;
    let totalAllowances = 0;
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    const generatedPayslips: EmployeePayslip[] = [];
    const allPayslips = this.getItem<EmployeePayslip[]>('payslips', INITIAL_EMPLOYEE_PAYSLIPS);
    let nextSlipId = allPayslips.length > 0 ? Math.max(...allPayslips.map((p) => p.id)) + 1 : 1;

    for (const emp of employees) {
      const personal = this.getEmployeePersonalInfo(emp.id);
      const employment = this.getEmployeeEmploymentInfo(emp.id);
      const asgn = assignments.find((a) => a.employeeId === emp.id);
      const grade = gradeLevels.find((g) => g.id === employment?.currentGradeId);
      const dept = departments.find((d) => d.id === employment?.currentDepartmentId);

      // Basic salary: from assignment, or from grade monthly base, or default 4,500 GHS
      const basicSalary = asgn?.basicSalaryMonthlyGhs || grade?.monthlyBaseGhs || 4500;
      const salaryStep = asgn?.salaryStep || 1;

      // Allowances calculation
      let allowancesSum = 0;
      const selectedAllowanceIds = asgn?.allowanceComponentIds || [1, 4, 5];
      for (const compId of selectedAllowanceIds) {
        const comp = components.find((c) => c.id === compId && c.type === 'Allowance');
        if (comp) {
          if (comp.calculationType === 'PercentageOfBasic') {
            allowancesSum += Math.round((basicSalary * comp.rateOrAmount) / 100);
          } else {
            allowancesSum += comp.rateOrAmount;
          }
        }
      }

      const grossSalary = basicSalary + allowancesSum;

      // Deductions calculation
      let ssnitDeduction = Math.round(basicSalary * 0.055 * 100) / 100; // 5.5%
      let payeTax = Math.round(grossSalary * 0.135 * 100) / 100; // approx 13.5%
      let otherDeductions = 100; // CLOGSAG + Welfare

      const selectedDeductionIds = asgn?.deductionComponentIds || [6, 7, 8, 9];
      for (const compId of selectedDeductionIds) {
        const comp = components.find((c) => c.id === compId && c.type === 'Deduction');
        if (comp && comp.componentCode !== 'DED-SSNIT-TIER1' && comp.componentCode !== 'DED-GRA-PAYE') {
          if (comp.calculationType === 'PercentageOfBasic') {
            otherDeductions += Math.round((basicSalary * comp.rateOrAmount) / 100);
          }
        }
      }

      const totalEmpDeductions = Math.round((ssnitDeduction + payeTax + otherDeductions) * 100) / 100;
      const netSalary = Math.round((grossSalary - totalEmpDeductions) * 100) / 100;

      totalBasic += basicSalary;
      totalAllowances += allowancesSum;
      totalGross += grossSalary;
      totalDeductions += totalEmpDeductions;
      totalNet += netSalary;

      const payslip: EmployeePayslip = {
        id: nextSlipId++,
        payrollRunId: newRunId,
        employeeId: emp.id,
        staffId: emp.staffId,
        employeeName: personal?.fullName || `${personal?.firstName} ${personal?.surname}`,
        departmentName: dept?.departmentName || 'Central Administration',
        gradeName: grade?.gradeName || 'Principal Executive Officer',
        salaryStep,
        basicSalaryGhs: basicSalary,
        totalAllowancesGhs: allowancesSum,
        grossSalaryGhs: grossSalary,
        ssnitDeductionGhs: ssnitDeduction,
        payeTaxGhs: payeTax,
        otherDeductionsGhs: otherDeductions,
        totalDeductionsGhs: totalEmpDeductions,
        netSalaryGhs: netSalary,
        bankName: asgn?.bankName || 'Ghana Commercial Bank (GCB)',
        bankAccountNumber: asgn?.bankAccountNumber || '1011029384756',
        periodLabel: label,
      };

      generatedPayslips.push(payslip);
    }

    const newRun: PayrollRun = {
      id: newRunId,
      periodYear: year,
      periodMonth: month,
      periodLabel: label,
      totalStaffCount: employees.length,
      totalBasicGhs: totalBasic,
      totalAllowancesGhs: totalAllowances,
      totalGrossGhs: totalGross,
      totalDeductionsGhs: totalDeductions,
      totalNetGhs: totalNet,
      status: 'Processed',
      processedDate: new Date().toISOString(),
      processedBy: username,
    };

    runs.push(newRun);
    this.setItem('payrollRuns', runs);

    allPayslips.push(...generatedPayslips);
    this.setItem('payslips', allPayslips);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Payroll & Compensation',
      actionType: 'INSERT',
      entityName: 'PayrollRuns',
      recordId: newRunId.toString(),
      newValuesJson: JSON.stringify({
        period: label,
        totalStaff: employees.length,
        gross: totalGross,
        net: totalNet,
      }),
    });

    return { run: newRun, payslips: generatedPayslips };
  }

  public updatePayrollRunStatus(
    id: number,
    status: PayrollRun['status'],
    officerName: string,
    username: string
  ): void {
    const list = this.getPayrollRuns();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = {
      ...list[idx],
      status,
      approvedDate: status === 'Approved' || status === 'Disbursed' ? new Date().toISOString() : list[idx].approvedDate,
      approvedBy: status === 'Approved' || status === 'Disbursed' ? officerName : list[idx].approvedBy,
    };
    this.setItem('payrollRuns', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Payroll & Compensation',
      actionType: 'UPDATE',
      entityName: 'PayrollRuns',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify({ status: old.status }),
      newValuesJson: JSON.stringify({ status, approvedBy: officerName }),
    });
  }

  public deletePayrollRun(id: number, username: string): { success: boolean; message: string } {
    const runs = this.getPayrollRuns();
    const target = runs.find((r) => r.id === id);
    if (!target) {
      return { success: false, message: 'Payroll batch not found.' };
    }
    if (target.status !== 'Processed') {
      return {
        success: false,
        message: `Payroll batch "${target.periodLabel}" is "${target.status}" and is locked for financial audit compliance.`,
      };
    }
    this.setItem('payrollRuns', runs.filter((r) => r.id !== id));
    const allPayslips = this.getItem<EmployeePayslip[]>('payslips', INITIAL_EMPLOYEE_PAYSLIPS);
    this.setItem('payslips', allPayslips.filter((p) => p.payrollRunId !== id));

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Payroll & Compensation',
      actionType: 'DELETE',
      entityName: 'PayrollRuns',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify({ periodLabel: target.periodLabel, totalNetGhs: target.totalNetGhs }),
    });
    return {
      success: true,
      message: `Draft payroll batch "${target.periodLabel}" and its payslips deleted.`,
    };
  }

  public getEmployeePayslips(payrollRunId?: number, employeeId?: number): EmployeePayslip[] {
    let list = this.getItem<EmployeePayslip[]>('payslips', INITIAL_EMPLOYEE_PAYSLIPS);
    if (payrollRunId !== undefined) {
      list = list.filter((p) => p.payrollRunId === payrollRunId);
    }
    if (employeeId !== undefined) {
      list = list.filter((p) => p.employeeId === employeeId);
    }
    return list;
  }

  // =========================================================================
  // SECTION 14: RETIREMENT & SEPARATION (Forecast, Clearances, Exit Execution)
  // =========================================================================

  public getSeparationRecords(employeeId?: number): SeparationRecord[] {
    const list = this.getItem<SeparationRecord[]>('separationRecords', INITIAL_SEPARATION_RECORDS);
    if (employeeId !== undefined) {
      return list.filter((s) => s.employeeId === employeeId);
    }
    return list.sort((a, b) => b.id - a.id);
  }

  public getSeparationRecordById(id: number): SeparationRecord | undefined {
    return this.getSeparationRecords().find((s) => s.id === id);
  }

  public createSeparationRecord(
    record: Omit<SeparationRecord, 'id' | 'separationReference'>,
    username: string
  ): SeparationRecord {
    const list = this.getSeparationRecords();
    const year = new Date().getFullYear();
    const newId = list.length > 0 ? Math.max(...list.map((s) => s.id)) + 1 : 1;
    const separationReference = `SEP-${year}-${newId.toString().padStart(3, '0')}`;

    const newRecord: SeparationRecord = {
      ...record,
      id: newId,
      separationReference,
    };
    list.push(newRecord);
    this.setItem('separationRecords', list);

    // Automatically provision multi-unit civil service clearance checklist
    const clearanceUnits: ClearanceDepartmentUnit[] = [
      'Library & Research Center',
      'IT & Telecommunications',
      'Transport & Fleet Unit',
      'Finance & Loan Advances',
      'General Registry & Security',
      'Internal Audit Agency',
    ];

    const currentClearanceItems = this.getItem<ClearanceItem[]>('clearanceItems', INITIAL_CLEARANCE_ITEMS);
    let nextItemId = currentClearanceItems.length > 0 ? Math.max(...currentClearanceItems.map((c) => c.id)) + 1 : 1;

    for (const unit of clearanceUnits) {
      currentClearanceItems.push({
        id: nextItemId++,
        separationRecordId: newId,
        unitName: unit,
        isCleared: false,
        remarks: 'Verification in progress upon separation initiation',
      });
    }
    this.setItem('clearanceItems', currentClearanceItems);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Retirement & Separation',
      actionType: 'INSERT',
      entityName: 'SeparationRecords',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify(newRecord),
    });

    return newRecord;
  }

  public updateSeparationRecord(id: number, data: Partial<SeparationRecord>, username: string): void {
    const list = this.getSeparationRecords();
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('separationRecords', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Retirement & Separation',
      actionType: 'UPDATE',
      entityName: 'SeparationRecords',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public deleteSeparationRecord(id: number, username: string): { success: boolean; message: string } {
    const list = this.getSeparationRecords();
    const target = list.find((s) => s.id === id);
    if (!target) {
      return { success: false, message: 'Separation docket not found.' };
    }
    if (target.status === 'Separation Executed') {
      return {
        success: false,
        message: `Separation docket ${target.separationReference} has already been executed and is permanently archived.`,
      };
    }
    this.setItem('separationRecords', list.filter((s) => s.id !== id));
    const clearances = this.getItem<ClearanceItem[]>('clearanceItems', INITIAL_CLEARANCE_ITEMS);
    this.setItem('clearanceItems', clearances.filter((c) => c.separationRecordId !== id));

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Retirement & Separation',
      actionType: 'DELETE',
      entityName: 'SeparationRecords',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify({ reference: target.separationReference, employeeId: target.employeeId }),
    });
    return {
      success: true,
      message: `Separation docket ${target.separationReference} and clearance checklist deleted.`,
    };
  }

  public getClearanceItems(separationRecordId: number): ClearanceItem[] {
    const list = this.getItem<ClearanceItem[]>('clearanceItems', INITIAL_CLEARANCE_ITEMS);
    return list.filter((c) => c.separationRecordId === separationRecordId);
  }

  public updateClearanceItem(id: number, data: Partial<ClearanceItem>, username: string): void {
    const list = this.getItem<ClearanceItem[]>('clearanceItems', INITIAL_CLEARANCE_ITEMS);
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('clearanceItems', list);

    // Check if all clearance items are now cleared for this separation record
    const sepRecordId = list[idx].separationRecordId;
    const sepItems = list.filter((c) => c.separationRecordId === sepRecordId);
    const allCleared = sepItems.every((item) => item.isCleared);

    if (allCleared) {
      this.runWithSuppressedNotifications(() =>
        this.updateSeparationRecord(sepRecordId, { status: 'Clearance Completed' }, username)
      );
    } else {
      this.runWithSuppressedNotifications(() =>
        this.updateSeparationRecord(sepRecordId, { status: 'Clearance In Progress' }, username)
      );
    }

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Retirement & Separation',
      actionType: 'UPDATE',
      entityName: 'ClearanceItems',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify(old),
      newValuesJson: JSON.stringify(data),
    });
  }

  public executeSeparation(separationRecordId: number, username: string): boolean {
    const record = this.getSeparationRecordById(separationRecordId);
    if (!record) return false;

    // Transition employee employment status and mark inactive (Business Rule 10)
    const newStatus: EmploymentStatus = record.separationType === 'Retirement' ? 'Retired' : 'Separated';
    this.runWithSuppressedNotifications(() => {
      this.updateEmployee(
        record.employeeId,
        {
          employment: {
            currentEmploymentStatus: newStatus,
          },
        },
        username
      );

      const employees = this.getItem<Employee[]>('employees', []);
      const empIdx = employees.findIndex((e) => e.id === record.employeeId);
      if (empIdx !== -1) {
        employees[empIdx].isActive = false;
        employees[empIdx].modifiedDate = new Date().toISOString();
        employees[empIdx].modifiedBy = username;
        this.setItem('employees', employees);
      }

      // Update separation record status
      this.updateSeparationRecord(
        separationRecordId,
        {
          status: 'Separation Executed',
          approvalDate: new Date().toISOString(),
          approvedByOfficer: username,
        },
        username
      );
    });

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Retirement & Separation',
      actionType: 'UPDATE',
      entityName: 'SeparationRecords',
      recordId: separationRecordId.toString(),
      newValuesJson: JSON.stringify({
        event: 'Separation officially executed; employee transitioned',
        employeeId: record.employeeId,
        newStatus,
      }),
    });

    return true;
  }

  public getRetirementForecast(monthsThreshold = 12): {
    employee: Employee;
    personal: EmployeePersonalInfo;
    employment: EmployeeEmploymentInfo;
    monthsToRetirement: number;
    statutoryDate: string;
  }[] {
    const employees = this.getEmployees();
    const results: {
      employee: Employee;
      personal: EmployeePersonalInfo;
      employment: EmployeeEmploymentInfo;
      monthsToRetirement: number;
      statutoryDate: string;
    }[] = [];

    for (const emp of employees) {
      const personal = this.getEmployeePersonalInfo(emp.id);
      const employment = this.getEmployeeEmploymentInfo(emp.id);
      if (!personal || !employment?.statutoryRetirementDate) continue;

      const months = this.calculateMonthsToRetirement(employment.statutoryRetirementDate);
      if (months <= monthsThreshold) {
        results.push({
          employee: emp,
          personal,
          employment,
          monthsToRetirement: months,
          statutoryDate: employment.statutoryRetirementDate,
        });
      }
    }

    return results.sort((a, b) => a.monthsToRetirement - b.monthsToRetirement);
  }

  // =========================================================================
  // SECTION 15: DISCIPLINARY MANAGEMENT (Allegations, Hearings, Sanctions)
  // =========================================================================

  public getDisciplinaryCases(employeeId?: number, filterConfidential = false): DisciplinaryCase[] {
    let list = this.getItem<DisciplinaryCase[]>('disciplinaryCases', INITIAL_DISCIPLINARY_CASES);
    if (employeeId !== undefined) {
      list = list.filter((c) => c.employeeId === employeeId);
    }
    if (filterConfidential) {
      list = list.filter((c) => !c.isConfidential);
    }
    return list.sort((a, b) => b.id - a.id);
  }

  public getDisciplinaryCaseById(id: number): DisciplinaryCase | undefined {
    return this.getDisciplinaryCases().find((c) => c.id === id);
  }

  public createDisciplinaryCase(
    caseData: Omit<DisciplinaryCase, 'id' | 'caseReference' | 'recordedDate'>,
    username: string
  ): DisciplinaryCase {
    const list = this.getDisciplinaryCases();
    const year = new Date().getFullYear();
    const newId = list.length > 0 ? Math.max(...list.map((c) => c.id)) + 1 : 1;
    const caseReference = `DISC-${year}-${newId.toString().padStart(3, '0')}`;

    const newCase: DisciplinaryCase = {
      ...caseData,
      id: newId,
      caseReference,
      recordedDate: new Date().toISOString(),
    };

    list.push(newCase);
    this.setItem('disciplinaryCases', list);

    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Disciplinary Management',
      actionType: 'INSERT',
      entityName: 'DisciplinaryCases',
      recordId: newId.toString(),
      newValuesJson: JSON.stringify({
        caseReference,
        offence: newCase.natureOfOffence,
        employeeId: newCase.employeeId,
        confidential: newCase.isConfidential,
      }),
    });

    return newCase;
  }

  public updateDisciplinaryCase(id: number, data: Partial<DisciplinaryCase>, username: string): void {
    const list = this.getDisciplinaryCases();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const old = list[idx];
    list[idx] = { ...list[idx], ...data };
    this.setItem('disciplinaryCases', list);
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Disciplinary Management',
      actionType: 'UPDATE',
      entityName: 'DisciplinaryCases',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify({ status: old.caseStatus, sanction: old.sanctionRecommended }),
      newValuesJson: JSON.stringify({ status: data.caseStatus, sanction: data.sanctionRecommended }),
    });
  }

  public deleteDisciplinaryCase(id: number, username: string): void {
    const list = this.getDisciplinaryCases();
    const target = list.find((c) => c.id === id);
    if (!target) return;
    this.setItem('disciplinaryCases', list.filter((c) => c.id !== id));
    this.logAudit({
      username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Disciplinary Management',
      actionType: 'DELETE',
      entityName: 'DisciplinaryCases',
      recordId: id.toString(),
      oldValuesJson: JSON.stringify({ reference: target.caseReference, employeeId: target.employeeId }),
    });
  }

  // =========================================================================
  // SECTION 16: COMPUTER REGISTRATION, APPLICATION ACTIVATION & EXPIRY CONTROL
  // =========================================================================

  private createDefaultExpiryConfig(): ApplicationExpiryConfig {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const base: Omit<ApplicationExpiryConfig, 'integritySignature'> = {
      tradeEDate: '',
      updatedAt: nowIso,
      updatedBy: 'SYSTEM',
      maxSeenUtcMs: nowMs,
      lastValidatedUtcMs: nowMs,
      clockTamperDetected: false,
    };
    return {
      ...base,
      integritySignature: signExpiryConfig(base),
    };
  }

  private formatLocalYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  public getActivationAdmins(): ActivationAdminAccount[] {
    const list = this.getItem<ActivationAdminAccount[]>('activationAdmins', []);
    if (list.length === 0) {
      this.setItem('activationAdmins', INITIAL_ACTIVATION_ADMINS);
      return INITIAL_ACTIVATION_ADMINS;
    }
    return list;
  }

  public authenticateActivationAdmin(
    username: string,
    rawPassword: string,
    options?: { silentFailure?: boolean }
  ): { success: boolean; admin?: ActivationAdminAccount; error?: string } {
    const cleanUser = username.trim();
    const admins = this.getActivationAdmins();
    const target = admins.find(
      (a) => a.username.toLowerCase() === cleanUser.toLowerCase() && a.isActive
    );

    if (!target || !verifyActivationPassword(rawPassword, target.passwordHash)) {
      if (!options?.silentFailure) {
        this.logAudit({
          username: cleanUser || 'UNKNOWN',
          machineName: 'WORKSTATION-GATE',
          module: 'Computer Registration',
          actionType: 'SECURITY',
          entityName: 'ActivationAdmins',
          recordId: cleanUser || 'FAILED',
          newValuesJson: JSON.stringify({
            event: 'Failed Administrative Config authorization attempt',
            timestamp: new Date().toISOString(),
          }),
        });
      }
      return {
        success: false,
        error: 'Invalid administrator username or password.',
      };
    }

    const updatedAdmins = admins.map((a) =>
      a.id === target.id ? { ...a, lastAuthorizedAt: new Date().toISOString() } : a
    );
    this.setItem('activationAdmins', updatedAdmins);

    this.logAudit({
      username: target.username,
      machineName: 'WORKSTATION-GATE',
      module: 'Computer Registration',
      actionType: 'LOGIN',
      entityName: 'ActivationAdmins',
      recordId: target.id.toString(),
      newValuesJson: JSON.stringify({
        event: 'Authorized access to Administrative Config (Computer Registration & Expiry Control)',
        authorizedAt: new Date().toISOString(),
      }),
    });

    return { success: true, admin: target };
  }

  public getRegisteredComputers(): RegisteredComputer[] {
    return this.getItem<RegisteredComputer[]>('computerRegistrations', []);
  }

  public getApplicationExpiryConfig(): ApplicationExpiryConfig {
    const stored = this.getItem<ApplicationExpiryConfig | null>('applicationExpiryConfig', null);
    if (!stored || typeof stored !== 'object') {
      const def = this.createDefaultExpiryConfig();
      this.setItem('applicationExpiryConfig', def);
      return def;
    }
    return stored;
  }

  public registerComputer(
    params: { computerName: string; hardwareId: string; osPlatform: string },
    adminUsername: string
  ): { success: boolean; record?: RegisteredComputer; error?: string } {
    const cleanName = params.computerName.trim();
    const cleanHwId = params.hardwareId.trim().toUpperCase();

    if (!cleanName || !cleanHwId) {
      return {
        success: false,
        error: 'Please click "Get This ComputerName" first to detect this computer\'s hardware identity.',
      };
    }

    const existing = this.getRegisteredComputers();
    const duplicate = existing.find(
      (c) =>
        c.hardwareId.toUpperCase() === cleanHwId ||
        c.computerName.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      this.logAudit({
        username: adminUsername,
        machineName: cleanName,
        module: 'Computer Registration',
        actionType: 'SECURITY',
        entityName: 'ComputerRegistrations',
        recordId: duplicate.id.toString(),
        newValuesJson: JSON.stringify({
          event: 'Duplicate computer registration blocked (one-time registration enforced)',
          computerName: cleanName,
          hardwareId: cleanHwId,
        }),
      });
      return {
        success: false,
        error: `Duplicate registration blocked: "${duplicate.computerName}" (${duplicate.hardwareId}) is already registered. Each computer may only be registered once.`,
      };
    }

    const expiryConfig = this.getApplicationExpiryConfig();
    const nextId = existing.length > 0 ? Math.max(...existing.map((c) => c.id)) + 1 : 1;
    const registeredAt = new Date().toISOString();

    const baseRecord: Omit<RegisteredComputer, 'integritySignature'> = {
      id: nextId,
      computerName: cleanName,
      hardwareId: cleanHwId,
      osPlatform: params.osPlatform || 'Windows Workstation',
      registeredAt,
      registeredBy: adminUsername,
      tradeEDate: expiryConfig.tradeEDate || '',
      status: 'Active',
    };

    const newRecord: RegisteredComputer = {
      ...baseRecord,
      integritySignature: signComputerRegistration(baseRecord),
    };

    const updated = [...existing, newRecord];
    this.setItem('computerRegistrations', updated);
    void saveToPermanentVault(updated, expiryConfig);

    this.logAudit({
      username: adminUsername,
      machineName: cleanName,
      module: 'Computer Registration',
      actionType: 'INSERT',
      entityName: 'ComputerRegistrations',
      recordId: newRecord.id.toString(),
      newValuesJson: JSON.stringify({
        computerName: newRecord.computerName,
        hardwareId: newRecord.hardwareId,
        osPlatform: newRecord.osPlatform,
        registeredAt: newRecord.registeredAt,
      }),
    });

    return { success: true, record: newRecord };
  }

  public saveApplicationExpiryDate(
    tradeEDate: string,
    currentMachineName: string,
    adminUsername: string
  ): { success: boolean; config?: ApplicationExpiryConfig; error?: string } {
    const cleanDate = tradeEDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      return {
        success: false,
        error: 'Please select a valid Trade EDate (YYYY-MM-DD).',
      };
    }

    const oldCfg = this.getApplicationExpiryConfig();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const baseCfg: Omit<ApplicationExpiryConfig, 'integritySignature'> = {
      tradeEDate: cleanDate,
      updatedAt: nowIso,
      updatedBy: adminUsername,
      maxSeenUtcMs: nowMs, // Admin resets monotonic clock watermark upon authorized save
      lastValidatedUtcMs: nowMs,
      clockTamperDetected: false,
      clockTamperReason: undefined,
    };

    const newCfg: ApplicationExpiryConfig = {
      ...baseCfg,
      integritySignature: signExpiryConfig(baseCfg),
    };
    this.setItem('applicationExpiryConfig', newCfg);

    // Sync displayed Trade EDate & active status across registered computer records cleanly
    const todayYmd = this.formatLocalYmd(new Date(nowMs));
    const updatedStatus: RegisteredComputer['status'] = todayYmd > cleanDate ? 'Expired' : 'Active';
    const updatedComputers = this.getRegisteredComputers().map((comp) => {
      const updatedBase: Omit<RegisteredComputer, 'integritySignature'> = {
        id: comp.id,
        computerName: comp.computerName,
        hardwareId: comp.hardwareId,
        osPlatform: comp.osPlatform,
        registeredAt: comp.registeredAt,
        registeredBy: comp.registeredBy,
        tradeEDate: cleanDate,
        status: comp.status === 'Revoked' ? 'Revoked' : updatedStatus,
      };
      return {
        ...updatedBase,
        integritySignature: signComputerRegistration(updatedBase),
      };
    });
    this.setItem('computerRegistrations', updatedComputers);
    void saveToPermanentVault(updatedComputers, newCfg);

    this.logAudit({
      username: adminUsername,
      machineName: currentMachineName || 'WORKSTATION-GATE',
      module: 'Expiry Control',
      actionType: 'UPDATE',
      entityName: 'ApplicationExpiryConfig',
      recordId: 'TRADE_EDATE',
      oldValuesJson: JSON.stringify({
        tradeEDate: oldCfg.tradeEDate || 'Not Set',
        clockTamperDetected: oldCfg.clockTamperDetected,
      }),
      newValuesJson: JSON.stringify({
        tradeEDate: cleanDate,
        updatedBy: adminUsername,
        updatedAt: nowIso,
      }),
    });

    return { success: true, config: newCfg };
  }

  public async reconcilePermanentVault(): Promise<{ vaultAvailable: boolean; restored: boolean }> {
    const { computers: vaultComps, expiryConfig: vaultExp, vaultAvailable } = await readFromPermanentVault();
    if (!vaultAvailable) {
      return { vaultAvailable: false, restored: false };
    }

    let restored = false;
    const localComps = this.getRegisteredComputers();
    const validVaultComps = vaultComps.filter((c) => verifyComputerSignature(c));

    if (validVaultComps.length > 0) {
      const merged = [...localComps];
      for (const vc of validVaultComps) {
        if (!merged.some((lc) => lc.hardwareId.toUpperCase() === vc.hardwareId.toUpperCase())) {
          merged.push(vc);
          restored = true;
        }
      }
      if (restored) {
        this.setItem('computerRegistrations', merged);
      }
    }

    const localExp = this.getApplicationExpiryConfig();
    if (vaultExp && verifyExpiryConfigSignature(vaultExp)) {
      const localValid = verifyExpiryConfigSignature(localExp);
      const shouldAdoptVaultExpiry =
        !localValid ||
        (!localExp.tradeEDate && Boolean(vaultExp.tradeEDate)) ||
        vaultExp.updatedAt > localExp.updatedAt;

      const mergedMaxSeen = Math.max(
        localValid ? localExp.maxSeenUtcMs : 0,
        vaultExp.maxSeenUtcMs || 0
      );

      if (shouldAdoptVaultExpiry || mergedMaxSeen > localExp.maxSeenUtcMs) {
        const chosen = shouldAdoptVaultExpiry ? vaultExp : localExp;
        const reconciledBase: Omit<ApplicationExpiryConfig, 'integritySignature'> = {
          tradeEDate: chosen.tradeEDate,
          updatedAt: chosen.updatedAt,
          updatedBy: chosen.updatedBy,
          maxSeenUtcMs: Math.max(chosen.maxSeenUtcMs, mergedMaxSeen),
          lastValidatedUtcMs: Math.max(chosen.lastValidatedUtcMs, localExp.lastValidatedUtcMs),
          clockTamperDetected: shouldAdoptVaultExpiry
            ? vaultExp.clockTamperDetected
            : localExp.clockTamperDetected || vaultExp.clockTamperDetected,
          clockTamperReason: shouldAdoptVaultExpiry
            ? vaultExp.clockTamperReason
            : localExp.clockTamperReason || vaultExp.clockTamperReason,
        };
        const signed: ApplicationExpiryConfig = {
          ...reconciledBase,
          integritySignature: signExpiryConfig(reconciledBase),
        };
        this.setItem('applicationExpiryConfig', signed);
        restored = true;
      }
    }

    if (restored) {
      this.logAudit({
        username: 'SYSTEM',
        machineName: 'PERMANENT-VAULT',
        module: 'Computer Registration',
        actionType: 'SYSTEM_INIT',
        entityName: 'ComputerRegistrations',
        recordId: 'VAULT-RESTORE',
        newValuesJson: JSON.stringify({
          event: 'Permanent workstation registration & expiry state reconciled from offline vault',
          restoredComputersCount: this.getRegisteredComputers().length,
        }),
      });
    }

    // Ensure vault mirrors latest valid state
    const latestComps = this.getRegisteredComputers();
    const latestExp = this.getApplicationExpiryConfig();
    if (latestComps.length > 0 || latestExp.tradeEDate) {
      void saveToPermanentVault(latestComps, latestExp);
    }

    return { vaultAvailable, restored };
  }

  public validateStartupAndClock(
    identity: WorkstationIdentity,
    vaultAvailable = true
  ): StartupValidationResult {
    const nowMs = Date.now();
    const CLOCK_ROLLBACK_TOLERANCE_MS = 120_000; // 2-minute tolerance for minor OS NTP jitter

    const computers = this.getRegisteredComputers();
    const matchedComp =
      computers.find((c) => c.hardwareId.toUpperCase() === identity.hardwareId.toUpperCase()) ||
      null;

    let compSignatureValid = true;
    if (matchedComp && !verifyComputerSignature(matchedComp)) {
      compSignatureValid = false;
    }

    let cfg = this.getApplicationExpiryConfig();
    const cfgSignatureValid = verifyExpiryConfigSignature(cfg);
    let clockTamperDetected = Boolean(cfg.clockTamperDetected);
    let clockTamperReason = cfg.clockTamperReason;

    if (!cfgSignatureValid) {
      clockTamperDetected = true;
      clockTamperReason =
        'License expiry signature verification failed (unauthorized modification to local storage detected).';
    } else if (!compSignatureValid) {
      clockTamperDetected = true;
      clockTamperReason =
        'Computer registration integrity signature mismatch (unauthorized modification detected).';
    } else if (nowMs < cfg.maxSeenUtcMs - CLOCK_ROLLBACK_TOLERANCE_MS) {
      clockTamperDetected = true;
      clockTamperReason =
        'System clock rollback detected: current Windows system time precedes the last verified monotonic timestamp.';
    }

    if (clockTamperDetected && !cfg.clockTamperDetected) {
      const tamperedBase: Omit<ApplicationExpiryConfig, 'integritySignature'> = {
        tradeEDate: cfg.tradeEDate,
        updatedAt: cfg.updatedAt,
        updatedBy: cfg.updatedBy,
        maxSeenUtcMs: cfg.maxSeenUtcMs,
        lastValidatedUtcMs: nowMs,
        clockTamperDetected: true,
        clockTamperReason,
      };
      cfg = {
        ...tamperedBase,
        integritySignature: signExpiryConfig(tamperedBase),
      };
      this.setItem('applicationExpiryConfig', cfg);
      void saveToPermanentVault(computers, cfg);

      this.logAudit({
        username: 'SYSTEM',
        machineName: identity.computerName,
        module: 'Expiry Control',
        actionType: 'SECURITY',
        entityName: 'ApplicationExpiryConfig',
        recordId: 'CLOCK-TAMPER-LOCK',
        newValuesJson: JSON.stringify({
          reason: clockTamperReason,
          observedUtc: new Date(nowMs).toISOString(),
          highWaterMarkUtc: new Date(cfg.maxSeenUtcMs).toISOString(),
        }),
      });
    } else if (!clockTamperDetected && nowMs > cfg.maxSeenUtcMs) {
      const prevLastValidated = cfg.lastValidatedUtcMs || 0;
      const advancedBase: Omit<ApplicationExpiryConfig, 'integritySignature'> = {
        tradeEDate: cfg.tradeEDate,
        updatedAt: cfg.updatedAt,
        updatedBy: cfg.updatedBy,
        maxSeenUtcMs: nowMs,
        lastValidatedUtcMs: nowMs,
        clockTamperDetected: false,
      };
      cfg = {
        ...advancedBase,
        integritySignature: signExpiryConfig(advancedBase),
      };
      this.setItem('applicationExpiryConfig', cfg);
      if (prevLastValidated === 0 || nowMs - prevLastValidated >= 30_000) {
        void saveToPermanentVault(computers, cfg);
      }
    }

    const hasExpiryConfigured = Boolean(cfg.tradeEDate && /^\d{4}-\d{2}-\d{2}$/.test(cfg.tradeEDate));
    const effectiveUtcMs = Math.max(nowMs, cfg.maxSeenUtcMs || 0);
    const effectiveYmd = this.formatLocalYmd(new Date(effectiveUtcMs));
    const isExpired = hasExpiryConfigured && effectiveYmd > cfg.tradeEDate;

    let daysRemaining: number | null = null;
    if (hasExpiryConfigured) {
      const [ey, em, ed] = cfg.tradeEDate.split('-').map(Number);
      const expiryEndLocal = new Date(ey, em - 1, ed, 23, 59, 59, 999).getTime();
      daysRemaining = Math.floor((expiryEndLocal - effectiveUtcMs) / 86_400_000);
    }

    const isComputerRegistered = Boolean(matchedComp && matchedComp.status !== 'Revoked' && compSignatureValid);

    let blockReason: StartupBlockReason = null;
    if (!isComputerRegistered) {
      blockReason = 'UNREGISTERED_COMPUTER';
    } else if (clockTamperDetected) {
      blockReason = 'CLOCK_TAMPERED';
    } else if (!hasExpiryConfigured) {
      blockReason = 'EXPIRY_NOT_CONFIGURED';
    } else if (isExpired) {
      blockReason = 'EXPIRED';
    }

    return {
      hardwareId: identity.hardwareId,
      detectedComputerName: matchedComp?.computerName || identity.computerName,
      osPlatform: identity.osPlatform,
      isComputerRegistered,
      registeredComputer: matchedComp,
      hasExpiryConfigured,
      tradeEDate: cfg.tradeEDate,
      isExpired,
      clockTamperDetected,
      clockTamperReason,
      canAccessLogin: blockReason === null,
      canAccessApplication: blockReason === null,
      blockReason,
      daysRemaining,
      persistenceVaultActive: vaultAvailable,
    };
  }
}

export const db = DatabaseService.getInstance();
