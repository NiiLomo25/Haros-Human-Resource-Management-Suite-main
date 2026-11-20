/**
 * Haros HRMIS - Single Source of Truth RBAC & Route Permission Service
 * Centralizes module visibility, submenu permissions, action authorizations,
 * legacy/dotted alias normalization, URL route parsing, and non-destructive route sync.
 *
 * SECURITY PRINCIPLE: STRICT DEFAULT DENY.
 * Any module, route, submenu, or action not explicitly granted to a role is denied.
 * Only 'System Administrator' (permissions containing 'ALL') holds unrestricted access.
 */

import {
  NavModuleId,
  PermissionDefinition,
  Role,
  RoutePermissionRecord,
} from '../../types';

export const HRMIS_MODULE_DEFINITIONS: PermissionDefinition[] = [
  {
    code: 'ROUTE:/dashboard',
    label: 'Dashboard & Analytics',
    module: 'Core Workspace',
    moduleId: 'dashboard',
    routePath: '/dashboard',
    itemType: 'route',
    description: 'Executive workforce metrics, alerts, and multi-dimensional analytics',
  },
  {
    code: 'ROUTE:/staff',
    label: 'Staff Management',
    module: 'Human Capital',
    moduleId: 'staff',
    routePath: '/staff',
    itemType: 'route',
    description: 'Central civil service staff nominal roll and 12-tab personnel dossiers',
  },
  {
    code: 'ROUTE:/organization',
    label: 'Organization Structure',
    module: 'Human Capital',
    moduleId: 'organization',
    routePath: '/organization',
    itemType: 'route',
    description: 'Ministries, Departments & Agencies (MDAs), directorates, and units',
  },
  {
    code: 'ROUTE:/establishment',
    label: 'Establishment & Cadre',
    module: 'Human Capital',
    moduleId: 'establishment',
    routePath: '/establishment',
    itemType: 'route',
    description: 'Approved establishment posts, cadre quotas, and vacancy tracking',
  },
  {
    code: 'ROUTE:/movements',
    label: 'Staff Movements',
    module: 'Career & Mobility',
    moduleId: 'movements',
    routePath: '/movements',
    itemType: 'route',
    description: 'Transfers, postings, secondments, and movement approval workflows',
  },
  {
    code: 'ROUTE:/promotions',
    label: 'Promotions & Progression',
    module: 'Career & Mobility',
    moduleId: 'promotions',
    routePath: '/promotions',
    itemType: 'route',
    description: '3-year & 5-year promotion eligibility engine and promotion board workflow',
  },
  {
    code: 'ROUTE:/recruitment',
    label: 'Recruitment & Appt.',
    module: 'Career & Mobility',
    moduleId: 'recruitment',
    routePath: '/recruitment',
    itemType: 'route',
    description: 'Applicant pipeline, interview scoring, and civil service appointments',
  },
  {
    code: 'ROUTE:/leave',
    label: 'Leave Management',
    module: 'Time & Performance',
    moduleId: 'leave',
    routePath: '/leave',
    itemType: 'route',
    description: 'Annual & statutory leave applications, balances, and approvals',
  },
  {
    code: 'ROUTE:/attendance',
    label: 'Attendance',
    module: 'Time & Performance',
    moduleId: 'attendance',
    routePath: '/attendance',
    itemType: 'route',
    description: 'Daily attendance register and timekeeping logs',
  },
  {
    code: 'ROUTE:/training',
    label: 'Training & Development',
    module: 'Time & Performance',
    moduleId: 'training',
    routePath: '/training',
    itemType: 'route',
    description: 'Training programs, staff nominations, and capacity building',
  },
  {
    code: 'ROUTE:/performance',
    label: 'Performance Appraisals',
    module: 'Time & Performance',
    moduleId: 'performance',
    routePath: '/performance',
    itemType: 'route',
    description: 'Annual SPAS KPI evaluations and supervisor ratings',
  },
  {
    code: 'ROUTE:/payroll',
    label: 'Payroll & Compensation',
    module: 'Compensation & Exits',
    moduleId: 'payroll',
    routePath: '/payroll',
    itemType: 'route',
    description: 'Single Spine Salary Structure (SSSS), monthly payroll runs, and payslips',
  },
  {
    code: 'ROUTE:/retirement',
    label: 'Retirement & Separation',
    module: 'Compensation & Exits',
    moduleId: 'retirement',
    routePath: '/retirement',
    itemType: 'route',
    description: 'Statutory retirement forecast and multi-unit exit clearance',
  },
  {
    code: 'ROUTE:/disciplinary',
    label: 'Disciplinary Records',
    module: 'Compensation & Exits',
    moduleId: 'disciplinary',
    routePath: '/disciplinary',
    itemType: 'route',
    description: 'Confidential disciplinary cases, hearings, and statutory sanctions',
  },
  {
    code: 'ROUTE:/reports',
    label: 'Reports & Analytics',
    module: 'Intelligence & Audit',
    moduleId: 'reports',
    routePath: '/reports',
    itemType: 'route',
    description: '20 statutory civil service reports and Employee Personal History dossiers',
  },
  {
    code: 'ROUTE:/users',
    label: 'User & Access (RBAC)',
    module: 'Administration',
    moduleId: 'users',
    routePath: '/users',
    itemType: 'route',
    description: 'User account provisioning, security roles, and Permission Matrix',
  },
  {
    code: 'ROUTE:/settings',
    label: 'System Configuration',
    module: 'Administration',
    moduleId: 'settings',
    routePath: '/settings',
    itemType: 'route',
    description: 'Institutional parameters, WAL backup & restore, audit ledger, and password policy',
  },
];

export const HRMIS_SUBMENU_DEFINITIONS: PermissionDefinition[] = [
  {
    code: 'SUBMENU:/reports/payroll',
    label: 'Reports Submenu: Payroll & Wage Bill (REP-16)',
    module: 'Intelligence & Audit',
    moduleId: 'reports',
    routePath: '/reports/payroll',
    itemType: 'submenu',
  },
  {
    code: 'SUBMENU:/reports/disciplinary',
    label: 'Reports Submenu: Disciplinary Docket (REP-20)',
    module: 'Intelligence & Audit',
    moduleId: 'reports',
    routePath: '/reports/disciplinary',
    itemType: 'submenu',
  },
  {
    code: 'SUBMENU:/reports/personal_history',
    label: 'Reports Submenu: Employee Personal History Report',
    module: 'Intelligence & Audit',
    moduleId: 'reports',
    routePath: '/reports/personal_history',
    itemType: 'submenu',
  },
  {
    code: 'SUBMENU:/users/accounts',
    label: 'User Mgmt Tab: User Accounts Directory',
    module: 'Administration',
    moduleId: 'users',
    routePath: '/users/accounts',
    itemType: 'submenu',
  },
  {
    code: 'SUBMENU:/users/roles',
    label: 'User Mgmt Tab: Civil Service Roles Registry',
    module: 'Administration',
    moduleId: 'users',
    routePath: '/users/roles',
    itemType: 'submenu',
  },
  {
    code: 'SUBMENU:/users/matrix',
    label: 'User Mgmt Tab: Permission Matrix',
    module: 'Administration',
    moduleId: 'users',
    routePath: '/users/matrix',
    itemType: 'submenu',
  },
  {
    code: 'SUBMENU:/settings/config',
    label: 'Settings Tab: Parameters & Rules Config',
    module: 'Administration',
    moduleId: 'settings',
    routePath: '/settings/config',
    itemType: 'submenu',
  },
  {
    code: 'SUBMENU:/settings/backup',
    label: 'Settings Tab: Backup & Restore (WAL)',
    module: 'Administration',
    moduleId: 'settings',
    routePath: '/settings/backup',
    itemType: 'submenu',
  },
  {
    code: 'SUBMENU:/settings/audit',
    label: 'Settings Tab & TitleBar: Forensic Audit Trail',
    module: 'Administration',
    moduleId: 'settings',
    routePath: '/settings/audit',
    itemType: 'submenu',
  },
  {
    code: 'SUBMENU:/settings/password',
    label: 'Settings Tab: Password Reset & Self-Service',
    module: 'Administration',
    moduleId: 'settings',
    routePath: '/settings/password',
    itemType: 'submenu',
  },
];

export const HRMIS_ACTION_DEFINITIONS: PermissionDefinition[] = [
  { code: 'STAFF_VIEW', label: 'View Staff Records & Dossiers', module: 'Staff Management', moduleId: 'staff', routePath: '/staff#view', itemType: 'action' },
  { code: 'STAFF_CREATE', label: 'Register New Public Officers (Single & Bulk)', module: 'Staff Management', moduleId: 'staff', routePath: '/staff#create', itemType: 'action' },
  { code: 'STAFF_EDIT', label: 'Edit Officer Profiles, Qualifications & Skills', module: 'Staff Management', moduleId: 'staff', routePath: '/staff#edit', itemType: 'action' },
  { code: 'STAFF_DELETE', label: 'Archive / Deactivate Staff Dossiers', module: 'Staff Management', moduleId: 'staff', routePath: '/staff#delete', itemType: 'action' },
  { code: 'DOCUMENTS_MANAGE', label: 'Upload & Manage Officer Documents', module: 'Staff Management', moduleId: 'staff', routePath: '/staff#documents', itemType: 'action' },

  { code: 'ORG_VIEW', label: 'View MDAs, Departments & Units', module: 'Organization Structure', moduleId: 'organization', routePath: '/organization#view', itemType: 'action' },
  { code: 'ORG_MANAGE', label: 'Create, Edit & Delete MDAs, Departments & Units', module: 'Organization Structure', moduleId: 'organization', routePath: '/organization#manage', itemType: 'action' },

  { code: 'ESTABLISHMENT_VIEW', label: 'View Establishment Quotas & Posts', module: 'Establishment & Cadre', moduleId: 'establishment', routePath: '/establishment#view', itemType: 'action' },
  { code: 'ESTABLISHMENT_MANAGE', label: 'Manage Cadre Quotas & Establishment Posts', module: 'Establishment & Cadre', moduleId: 'establishment', routePath: '/establishment#manage', itemType: 'action' },

  { code: 'MOVEMENT_VIEW', label: 'View Staff Movements & History Ledger', module: 'Staff Movements', moduleId: 'movements', routePath: '/movements#view', itemType: 'action' },
  { code: 'MOVEMENT_SUBMIT', label: 'Initiate & Edit Staff Movements / Postings', module: 'Staff Movements', moduleId: 'movements', routePath: '/movements#submit', itemType: 'action' },
  { code: 'MOVEMENT_REVIEW', label: 'Review Submitted Movement Requests', module: 'Staff Movements', moduleId: 'movements', routePath: '/movements#review', itemType: 'action' },
  { code: 'MOVEMENT_APPROVE', label: 'Approve Staff Movements & Postings', module: 'Staff Movements', moduleId: 'movements', routePath: '/movements#approve', itemType: 'action' },
  { code: 'MOVEMENT_IMPLEMENT', label: 'Implement Approved Transfers & Postings', module: 'Staff Movements', moduleId: 'movements', routePath: '/movements#implement', itemType: 'action' },

  { code: 'PROMOTION_VIEW', label: 'View Promotion Eligibility & Recommendations', module: 'Promotions & Progression', moduleId: 'promotions', routePath: '/promotions#view', itemType: 'action' },
  { code: 'PROMOTION_RECOMMEND', label: 'Recommend Officers & Edit Board Entries', module: 'Promotions & Progression', moduleId: 'promotions', routePath: '/promotions#recommend', itemType: 'action' },
  { code: 'PROMOTION_APPROVE', label: 'Approve & Implement Career Promotions', module: 'Promotions & Progression', moduleId: 'promotions', routePath: '/promotions#approve', itemType: 'action' },

  { code: 'RECRUITMENT_VIEW', label: 'View Recruitment Pipeline & Applicants', module: 'Recruitment & Appt.', moduleId: 'recruitment', routePath: '/recruitment#view', itemType: 'action' },
  { code: 'RECRUITMENT_MANAGE', label: 'Register & Edit Recruitment Applicants', module: 'Recruitment & Appt.', moduleId: 'recruitment', routePath: '/recruitment#manage', itemType: 'action' },
  { code: 'RECRUITMENT_SCORE', label: 'Record Interview Scores & Shortlist', module: 'Recruitment & Appt.', moduleId: 'recruitment', routePath: '/recruitment#score', itemType: 'action' },
  { code: 'RECRUITMENT_APPOINT', label: 'Appoint Selected Applicants to Civil Service', module: 'Recruitment & Appt.', moduleId: 'recruitment', routePath: '/recruitment#appoint', itemType: 'action' },

  { code: 'LEAVE_VIEW', label: 'View Leave Balances & Applications', module: 'Leave Management', moduleId: 'leave', routePath: '/leave#view', itemType: 'action' },
  { code: 'LEAVE_APPLY', label: 'Submit & Edit Leave Applications', module: 'Leave Management', moduleId: 'leave', routePath: '/leave#apply', itemType: 'action' },
  { code: 'LEAVE_REVIEW', label: 'Recommend & HR-Review Leave Applications', module: 'Leave Management', moduleId: 'leave', routePath: '/leave#review', itemType: 'action' },
  { code: 'LEAVE_APPROVE', label: 'Approve, Deduct & Resume Leave Applications', module: 'Leave Management', moduleId: 'leave', routePath: '/leave#approve', itemType: 'action' },

  { code: 'ATTENDANCE_VIEW', label: 'View Daily Attendance Register', module: 'Attendance', moduleId: 'attendance', routePath: '/attendance#view', itemType: 'action' },
  { code: 'ATTENDANCE_LOG', label: 'Record & Bulk-Generate Daily Attendance', module: 'Attendance', moduleId: 'attendance', routePath: '/attendance#log', itemType: 'action' },

  { code: 'TRAINING_VIEW', label: 'View Training Programs & Nominations', module: 'Training & Development', moduleId: 'training', routePath: '/training#view', itemType: 'action' },
  { code: 'TRAINING_MANAGE', label: 'Create & Manage Training Programs & Nominations', module: 'Training & Development', moduleId: 'training', routePath: '/training#manage', itemType: 'action' },

  { code: 'PERFORMANCE_VIEW', label: 'View Performance Appraisals', module: 'Performance Appraisals', moduleId: 'performance', routePath: '/performance#view', itemType: 'action' },
  { code: 'PERFORMANCE_EVALUATE', label: 'Conduct, Score & Finalize Appraisals', module: 'Performance Appraisals', moduleId: 'performance', routePath: '/performance#evaluate', itemType: 'action' },

  { code: 'PAYROLL_VIEW', label: 'View Salary Scales, Assignments & Payslips', module: 'Payroll & Compensation', moduleId: 'payroll', routePath: '/payroll#view', itemType: 'action' },
  { code: 'PAYROLL_MANAGE', label: 'Execute Monthly Payroll & Edit Pay Structures', module: 'Payroll & Compensation', moduleId: 'payroll', routePath: '/payroll#manage', itemType: 'action' },

  { code: 'SEPARATION_VIEW', label: 'View Retirement Horizon & Separation Cases', module: 'Retirement & Separation', moduleId: 'retirement', routePath: '/retirement#view', itemType: 'action' },
  { code: 'SEPARATION_MANAGE', label: 'Initiate Separations & Update Clearances', module: 'Retirement & Separation', moduleId: 'retirement', routePath: '/retirement#manage', itemType: 'action' },
  { code: 'SEPARATION_APPROVE', label: 'Ratify & Execute Final Separations', module: 'Retirement & Separation', moduleId: 'retirement', routePath: '/retirement#approve', itemType: 'action' },

  { code: 'DISCIPLINARY_VIEW', label: 'View Confidential Disciplinary Registers', module: 'Disciplinary Records', moduleId: 'disciplinary', routePath: '/disciplinary#view', itemType: 'action' },
  { code: 'DISCIPLINARY_MANAGE', label: 'Record Allegations & Committee Sanctions', module: 'Disciplinary Records', moduleId: 'disciplinary', routePath: '/disciplinary#manage', itemType: 'action' },
  { code: 'CONFIDENTIAL_VIEW', label: 'Access Classified Records & Confidential Files', module: 'Security & Integrity', moduleId: 'disciplinary', routePath: '/disciplinary#confidential', itemType: 'action' },

  { code: 'REPORTS_VIEW', label: 'Access & Export Statutory Civil Service Reports', module: 'Reports & Analytics', moduleId: 'reports', routePath: '/reports#view', itemType: 'action' },
  { code: 'AUDIT_VIEW', label: 'Inspect Immutable Forensic Audit Trail', module: 'System Security', moduleId: 'settings', routePath: '/settings/audit#view', itemType: 'action' },
  { code: 'USERS_MANAGE', label: 'Administer RBAC User Accounts, Roles & Matrix', module: 'System Security', moduleId: 'users', routePath: '/users#manage', itemType: 'action' },
  { code: 'SETTINGS_MANAGE', label: 'Modify System Parameters, Backups & Recovery', module: 'System Administration', moduleId: 'settings', routePath: '/settings#manage', itemType: 'action' },
];

export const ALL_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  ...HRMIS_MODULE_DEFINITIONS,
  ...HRMIS_SUBMENU_DEFINITIONS,
  ...HRMIS_ACTION_DEFINITIONS,
];

/**
 * Legacy and dotted permission code aliases used across existing views
 * mapped deterministically to canonical permission codes.
 */
export const PERMISSION_ALIAS_MAP: Record<string, string> = {
  'staff.view': 'STAFF_VIEW',
  'staff.create': 'STAFF_CREATE',
  'staff.edit': 'STAFF_EDIT',
  'staff.delete': 'STAFF_DELETE',
  'org.manage': 'ORG_MANAGE',
  'establishment.manage': 'ESTABLISHMENT_MANAGE',
  'movement.initiate': 'MOVEMENT_SUBMIT',
  'movement.review': 'MOVEMENT_REVIEW',
  'movement.approve': 'MOVEMENT_APPROVE',
  'movement.implement': 'MOVEMENT_IMPLEMENT',
  'promotion.recommend': 'PROMOTION_RECOMMEND',
  'promotion.approve': 'PROMOTION_APPROVE',
  'promotion.implement': 'PROMOTION_APPROVE',
  'recruitment.manage': 'RECRUITMENT_MANAGE',
  'recruitment.score': 'RECRUITMENT_SCORE',
  'recruitment.appoint': 'RECRUITMENT_APPOINT',
  'leave.apply': 'LEAVE_APPLY',
  'leave.review': 'LEAVE_REVIEW',
  'leave.approve': 'LEAVE_APPROVE',
  'attendance.record': 'ATTENDANCE_LOG',
  'training.manage': 'TRAINING_MANAGE',
  'performance.evaluate': 'PERFORMANCE_EVALUATE',
};

export const VALID_MODULE_IDS: NavModuleId[] = HRMIS_MODULE_DEFINITIONS.map((m) => m.moduleId);

export function getModuleRouteCode(moduleId: NavModuleId): string {
  return `ROUTE:/${moduleId}`;
}

export function normalizePermissionKey(key: string): string {
  const trimmed = (key || '').trim();
  if (!trimmed) return '';
  if (PERMISSION_ALIAS_MAP[trimmed]) return PERMISSION_ALIAS_MAP[trimmed];
  const lower = trimmed.toLowerCase();
  if (PERMISSION_ALIAS_MAP[lower]) return PERMISSION_ALIAS_MAP[lower];
  return trimmed;
}

export function isAdminRole(role: Pick<Role, 'roleName' | 'permissions'> | null | undefined): boolean {
  if (!role) return false;
  return (
    role.roleName === 'System Administrator' ||
    (Array.isArray(role.permissions) && role.permissions.includes('ALL'))
  );
}

/**
 * Strict Default-Deny evaluator.
 * If routePermissions are provided, checks the persisted SQLite/localStorage route_permissions table
 * as the primary source of truth, falling back to role.permissions only when no explicit table entry exists
 * (or requiring explicit grant in both when synchronized).
 */
export function roleHasPermission(
  role: Role | null | undefined,
  permissionKey: string,
  routePermissions?: RoutePermissionRecord[]
): boolean {
  if (!role) return false;
  if (isAdminRole(role)) return true;

  const canonical = normalizePermissionKey(permissionKey);
  if (!canonical) return false;
  if (canonical === 'ALL') return false; // Only System Administrator has ALL

  if (routePermissions && routePermissions.length > 0) {
    const roleRecords = routePermissions.filter((rp) => rp.roleId === role.id);
    if (roleRecords.length > 0) {
      const exact = roleRecords.find((rp) => rp.permissionCode === canonical);
      if (exact) {
        return exact.isAllowed === true;
      }
      // If routePermissions are synced for this role and code is unknown/untracked, check role.permissions
      return Array.isArray(role.permissions) && role.permissions.includes(canonical);
    }
  }

  return Array.isArray(role.permissions) && role.permissions.includes(canonical);
}

export function roleCanAccessModule(
  role: Role | null | undefined,
  moduleId: NavModuleId,
  routePermissions?: RoutePermissionRecord[]
): boolean {
  return roleHasPermission(role, getModuleRouteCode(moduleId), routePermissions);
}

export function roleCanAccessSubmenu(
  role: Role | null | undefined,
  submenuCode: string,
  routePermissions?: RoutePermissionRecord[]
): boolean {
  return roleHasPermission(role, submenuCode, routePermissions);
}

export function getAllowedModuleIdsForRole(
  role: Role | null | undefined,
  routePermissions?: RoutePermissionRecord[]
): NavModuleId[] {
  if (!role) return [];
  if (isAdminRole(role)) return [...VALID_MODULE_IDS];
  return VALID_MODULE_IDS.filter((modId) => roleCanAccessModule(role, modId, routePermissions));
}

export function getFirstAllowedModule(
  role: Role | null | undefined,
  routePermissions?: RoutePermissionRecord[]
): NavModuleId | null {
  const allowed = getAllowedModuleIdsForRole(role, routePermissions);
  if (allowed.length === 0) return null;
  if (allowed.includes('dashboard')) return 'dashboard';
  return allowed[0];
}

/**
 * Parses a module ID from browser location (hash, pathname, or query `?module=`).
 * Returns:
 *  - null if user is at root ('', '/', '/index.html', '#/', '#')
 *  - NavModuleId if valid module path
 *  - string (the raw segment) if an unrecognized/restricted route path was requested
 */
export function parseModuleFromLocation(
  pathname: string,
  hash: string,
  search: string
): NavModuleId | string | null {
  const params = new URLSearchParams(search || '');
  const queryMod = params.get('module')?.trim().toLowerCase();
  if (queryMod) {
    return queryMod;
  }

  if (hash && hash !== '#' && hash !== '#/') {
    const cleanHash = hash.replace(/^#\/?/, '').split('?')[0].split('/')[0].trim().toLowerCase();
    if (cleanHash) {
      return cleanHash;
    }
  }

  const cleanPath = (pathname || '').replace(/^\/+/, '').split('/')[0].trim().toLowerCase();
  if (cleanPath && cleanPath !== 'index.html') {
    return cleanPath;
  }

  return null;
}

/**
 * Maps built-in seeded Civil Service roles to their canonical Route + Submenu + Action permissions.
 * Used for fresh database initialization and one-time non-destructive legacy upgrade ONLY.
 */
export function getDefaultSeedPermissionsForRole(roleName: string): string[] {
  switch (roleName) {
    case 'System Administrator':
      return ['ALL'];

    case 'HR Director':
      return [
        'ROUTE:/dashboard',
        'ROUTE:/staff',
        'ROUTE:/organization',
        'ROUTE:/establishment',
        'ROUTE:/movements',
        'ROUTE:/promotions',
        'ROUTE:/recruitment',
        'ROUTE:/leave',
        'ROUTE:/attendance',
        'ROUTE:/training',
        'ROUTE:/performance',
        'ROUTE:/payroll',
        'ROUTE:/retirement',
        'ROUTE:/disciplinary',
        'ROUTE:/reports',
        'SUBMENU:/reports/payroll',
        'SUBMENU:/reports/disciplinary',
        'SUBMENU:/reports/personal_history',
        'STAFF_VIEW',
        'STAFF_EDIT',
        'ORG_VIEW',
        'ESTABLISHMENT_VIEW',
        'ESTABLISHMENT_MANAGE',
        'MOVEMENT_VIEW',
        'MOVEMENT_REVIEW',
        'MOVEMENT_APPROVE',
        'MOVEMENT_IMPLEMENT',
        'PROMOTION_VIEW',
        'PROMOTION_APPROVE',
        'RECRUITMENT_VIEW',
        'LEAVE_VIEW',
        'LEAVE_APPROVE',
        'ATTENDANCE_VIEW',
        'TRAINING_VIEW',
        'PERFORMANCE_VIEW',
        'PAYROLL_VIEW',
        'SEPARATION_VIEW',
        'SEPARATION_MANAGE',
        'SEPARATION_APPROVE',
        'DISCIPLINARY_VIEW',
        'DISCIPLINARY_MANAGE',
        'CONFIDENTIAL_VIEW',
        'REPORTS_VIEW',
      ];

    case 'HR Manager':
      return [
        'ROUTE:/dashboard',
        'ROUTE:/staff',
        'ROUTE:/movements',
        'ROUTE:/promotions',
        'ROUTE:/recruitment',
        'ROUTE:/leave',
        'ROUTE:/attendance',
        'ROUTE:/training',
        'ROUTE:/performance',
        'ROUTE:/retirement',
        'ROUTE:/disciplinary',
        'ROUTE:/reports',
        'SUBMENU:/reports/disciplinary',
        'SUBMENU:/reports/personal_history',
        'STAFF_VIEW',
        'STAFF_CREATE',
        'STAFF_EDIT',
        'MOVEMENT_VIEW',
        'MOVEMENT_SUBMIT',
        'MOVEMENT_REVIEW',
        'PROMOTION_VIEW',
        'PROMOTION_RECOMMEND',
        'RECRUITMENT_VIEW',
        'RECRUITMENT_MANAGE',
        'RECRUITMENT_SCORE',
        'LEAVE_VIEW',
        'LEAVE_APPLY',
        'LEAVE_REVIEW',
        'LEAVE_APPROVE',
        'ATTENDANCE_VIEW',
        'TRAINING_VIEW',
        'TRAINING_MANAGE',
        'PERFORMANCE_VIEW',
        'PERFORMANCE_EVALUATE',
        'SEPARATION_VIEW',
        'SEPARATION_MANAGE',
        'DISCIPLINARY_VIEW',
        'REPORTS_VIEW',
      ];

    case 'HR Officer':
      return [
        'ROUTE:/dashboard',
        'ROUTE:/staff',
        'ROUTE:/leave',
        'ROUTE:/attendance',
        'STAFF_VIEW',
        'STAFF_CREATE',
        'STAFF_EDIT',
        'DOCUMENTS_MANAGE',
        'LEAVE_VIEW',
        'LEAVE_APPLY',
        'ATTENDANCE_VIEW',
        'ATTENDANCE_LOG',
      ];

    case 'Auditor':
      return [
        'ROUTE:/dashboard',
        'ROUTE:/staff',
        'ROUTE:/movements',
        'ROUTE:/payroll',
        'ROUTE:/reports',
        'ROUTE:/settings',
        'SUBMENU:/reports/payroll',
        'SUBMENU:/reports/personal_history',
        'SUBMENU:/settings/audit',
        'STAFF_VIEW',
        'MOVEMENT_VIEW',
        'PAYROLL_VIEW',
        'AUDIT_VIEW',
        'REPORTS_VIEW',
      ];

    case 'Finance Officer':
      return [
        'ROUTE:/dashboard',
        'ROUTE:/staff',
        'ROUTE:/payroll',
        'ROUTE:/reports',
        'SUBMENU:/reports/payroll',
        'STAFF_VIEW',
        'PAYROLL_VIEW',
        'PAYROLL_MANAGE',
        'CONFIDENTIAL_VIEW',
        'REPORTS_VIEW',
      ];

    default:
      return [];
  }
}

/**
 * One-time migration helper for roles created BEFORE routePermissions existed.
 * Preserves existing grants and derives corresponding route permissions ONLY if the role
 * had zero ROUTE:/ entries yet; does NOT grant anything for ungranted modules (Default Deny).
 */
export function deriveLegacyMigrationGrantsForRole(role: Role): Set<string> {
  if (isAdminRole(role)) {
    return new Set(['ALL', ...ALL_PERMISSION_DEFINITIONS.map((d) => d.code)]);
  }

  const raw = Array.isArray(role.permissions) ? role.permissions : [];
  const normalized = new Set<string>(raw.map(normalizePermissionKey).filter(Boolean));
  const hasExplicitRoutes = Array.from(normalized).some((p) => p.startsWith('ROUTE:/'));

  if (hasExplicitRoutes) {
    return normalized;
  }

  // Known built-in system roles with unchanged legacy seed arrays
  if (role.isSystemRole) {
    const defaults = getDefaultSeedPermissionsForRole(role.roleName);
    const merged = new Set<string>([...normalized]);
    // Respect whatever operational permissions remain in role.permissions!
    // Only add ROUTE:/... for areas where the role actually still holds permissions.
    const checkHasAny = (codes: string[]) => codes.some((c) => normalized.has(c));
    if (defaults.length > 0 && normalized.size > 0) {
      merged.add('ROUTE:/dashboard');
    }
    if (checkHasAny(['STAFF_VIEW', 'STAFF_CREATE', 'STAFF_EDIT', 'STAFF_DELETE', 'DOCUMENTS_MANAGE'])) {
      merged.add('ROUTE:/staff');
      merged.add('SUBMENU:/reports/personal_history');
    }
    if (checkHasAny(['ORG_VIEW', 'ORG_MANAGE'])) merged.add('ROUTE:/organization');
    if (checkHasAny(['ESTABLISHMENT_VIEW', 'ESTABLISHMENT_MANAGE'])) merged.add('ROUTE:/establishment');
    if (checkHasAny(['MOVEMENT_VIEW', 'MOVEMENT_SUBMIT', 'MOVEMENT_REVIEW', 'MOVEMENT_APPROVE', 'MOVEMENT_IMPLEMENT'])) {
      merged.add('ROUTE:/movements');
    }
    if (checkHasAny(['PROMOTION_VIEW', 'PROMOTION_RECOMMEND', 'PROMOTION_APPROVE'])) merged.add('ROUTE:/promotions');
    if (checkHasAny(['RECRUITMENT_VIEW', 'RECRUITMENT_MANAGE', 'RECRUITMENT_SCORE', 'RECRUITMENT_APPOINT'])) {
      merged.add('ROUTE:/recruitment');
    }
    if (checkHasAny(['LEAVE_VIEW', 'LEAVE_APPLY', 'LEAVE_REVIEW', 'LEAVE_APPROVE'])) merged.add('ROUTE:/leave');
    if (checkHasAny(['ATTENDANCE_VIEW', 'ATTENDANCE_LOG'])) merged.add('ROUTE:/attendance');
    if (checkHasAny(['TRAINING_VIEW', 'TRAINING_MANAGE'])) merged.add('ROUTE:/training');
    if (checkHasAny(['PERFORMANCE_VIEW', 'PERFORMANCE_EVALUATE'])) merged.add('ROUTE:/performance');
    if (checkHasAny(['PAYROLL_VIEW', 'PAYROLL_MANAGE'])) {
      merged.add('ROUTE:/payroll');
      merged.add('SUBMENU:/reports/payroll');
    }
    if (checkHasAny(['SEPARATION_VIEW', 'SEPARATION_MANAGE', 'SEPARATION_APPROVE'])) merged.add('ROUTE:/retirement');
    if (checkHasAny(['DISCIPLINARY_VIEW', 'DISCIPLINARY_MANAGE', 'CONFIDENTIAL_VIEW'])) {
      merged.add('ROUTE:/disciplinary');
      merged.add('SUBMENU:/reports/disciplinary');
    }
    if (checkHasAny(['REPORTS_VIEW'])) merged.add('ROUTE:/reports');
    if (checkHasAny(['USERS_MANAGE'])) {
      merged.add('ROUTE:/users');
      merged.add('SUBMENU:/users/accounts');
      merged.add('SUBMENU:/users/roles');
      merged.add('SUBMENU:/users/matrix');
    }
    if (checkHasAny(['SETTINGS_MANAGE'])) {
      merged.add('ROUTE:/settings');
      merged.add('SUBMENU:/settings/config');
      merged.add('SUBMENU:/settings/backup');
      merged.add('SUBMENU:/settings/audit');
      merged.add('SUBMENU:/settings/password');
    }
    if (checkHasAny(['AUDIT_VIEW'])) {
      merged.add('ROUTE:/settings');
      merged.add('SUBMENU:/settings/audit');
    }
    return merged;
  }

  // Legacy custom role: only map routes corresponding to permissions it explicitly holds
  if (normalized.has('STAFF_VIEW') || normalized.has('STAFF_CREATE') || normalized.has('STAFF_EDIT')) {
    normalized.add('ROUTE:/staff');
  }
  if (normalized.has('MOVEMENT_SUBMIT') || normalized.has('MOVEMENT_APPROVE')) normalized.add('ROUTE:/movements');
  if (normalized.has('PROMOTION_APPROVE') || normalized.has('PROMOTION_RECOMMEND')) normalized.add('ROUTE:/promotions');
  if (normalized.has('LEAVE_APPROVE') || normalized.has('LEAVE_APPLY')) normalized.add('ROUTE:/leave');
  if (normalized.has('PAYROLL_VIEW') || normalized.has('PAYROLL_MANAGE')) normalized.add('ROUTE:/payroll');
  if (normalized.has('DISCIPLINARY_MANAGE') || normalized.has('DISCIPLINARY_VIEW')) normalized.add('ROUTE:/disciplinary');
  if (normalized.has('SEPARATION_MANAGE') || normalized.has('SEPARATION_APPROVE')) normalized.add('ROUTE:/retirement');
  if (normalized.has('ESTABLISHMENT_MANAGE')) normalized.add('ROUTE:/establishment');
  if (normalized.has('REPORTS_VIEW')) normalized.add('ROUTE:/reports');
  if (normalized.has('USERS_MANAGE')) normalized.add('ROUTE:/users');
  if (normalized.has('SETTINGS_MANAGE')) normalized.add('ROUTE:/settings');

  return normalized;
}
