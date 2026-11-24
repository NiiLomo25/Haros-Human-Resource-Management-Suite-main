import {
  EmployeeCategory,
  EmploymentType,
  Gender,
  MaritalStatus,
  SkillCategory,
} from '../../types';

export const SHEET_NAMES = {
  EMPLOYEES: 'Employees',
  CAPABILITIES: 'Training Capabilities',
  SKILLS: 'Skills',
  MEMBERSHIPS: 'Professional Memberships',
  ORGS: 'MDA & Departments',
  LISTS: 'Lists',
  INSTRUCTIONS: 'Instructions',
} as const;

export const EMPLOYEE_HEADERS = [
  'Staff ID*',
  'Surname*',
  'First Name*',
  'Other Names',
  'Date of Birth (DD/MM/YYYY)*',
  'Gender*',
  'Marital Status',
  'Nationality',
  'Ghana Card (NIA)',
  'Telephone (+233)',
  'Email',
  'Residential Address',
  'Next of Kin Name',
  'Next of Kin Relationship',
  'Next of Kin Phone',
  'Staff Categorization*',
  'Employment Type*',
  'MDA*',
  'Department*',
  'Designation*',
  'Grade Scale*',
  'First Appointment (DD/MM/YYYY)*',
  'Assumption of Duty (DD/MM/YYYY)',
  'Salary Level',
  'Salary Step (1-10)',
  'Qualification Level',
  'Qualification Title',
  'Awarding Institution',
  'Year Obtained',
  'Other Contact(s)',
  'First Grade (Entry Grade)',
  'Current Promotion Date (DD/MM/YYYY)',
  'Previous Posting',
] as const;

export const ORG_HEADERS = [
  'MDA Code*',
  'MDA Name*',
  'MDA Type',
  'Department Code',
  'Department Name',
] as const;

export const CAPABILITY_HEADERS = [
  'Staff ID*',
  'Capability Description',
] as const;

export const SKILL_HEADERS = [
  'Staff ID*',
  'Skill Name*',
  'Skill Category*',
  'Evidence / Application of Skill',
] as const;

export const MEMBERSHIP_HEADERS = [
  'Staff ID*',
  'Professional Body*',
  'Membership Number*',
  'Category',
  'Registration Date (DD/MM/YYYY)',
  'Expiry Date (DD/MM/YYYY)',
  'Membership Status',
] as const;

export type ValidationSeverity = 'error' | 'warning';
export type RowValidationStatus = 'Valid' | 'Warning' | 'Error';
export type WarningAction = 'skip' | 'import';
export type ImportErrorPolicy = 'valid_only' | 'all_or_nothing';

export interface RawEmployeeRow {
  rowNumber: number;
  rawValues: Record<string, string>;
  staffId: string;
  surname: string;
  firstName: string;
  otherNames: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  nationality: string;
  nationalIdentificationNumber: string;
  telephoneNumber: string;
  emailAddress: string;
  residentialAddress: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
  employeeCategory: string;
  employmentType: string;
  mda: string;
  department: string;
  designation: string;
  gradeScale: string;
  dateOfFirstAppointment: string;
  dateOfAssumptionOfDuty: string;
  salaryLevel: string;
  salaryStep: string;
  qualificationLevel: string;
  qualificationTitle: string;
  qualificationInstitution: string;
  yearObtained: string;
  otherContact: string;
  firstGrade: string;
  currentPromotionDate: string;
  previousPosting: string;
}

export interface RawCapabilityRow {
  rowNumber: number;
  staffId: string;
  capability: string;
}

export interface RawSkillRow {
  rowNumber: number;
  staffId: string;
  skillName: string;
  category: string;
  evidence: string;
}

export interface RawMembershipRow {
  rowNumber: number;
  staffId: string;
  professionalBody: string;
  membershipNumber: string;
  membershipCategory: string;
  registrationDate: string;
  expiryDate: string;
  membershipStatus: string;
}

export interface RawOrgRow {
  rowNumber: number;
  mdaCode: string;
  mdaName: string;
  mdaType: string;
  departmentCode: string;
  departmentName: string;
}

export interface ParsedWorkbookData {
  fileName: string;
  fileSizeBytes: number;
  employees: RawEmployeeRow[];
  capabilities: RawCapabilityRow[];
  skills: RawSkillRow[];
  memberships: RawMembershipRow[];
  orgs: RawOrgRow[];
}

/** An MDA or Department that must be created/updated in master data before employees import. */
export interface OrgUpsert {
  kind: 'mda' | 'department';
  /** Match key for existing records: MDA code, or department code within its MDA. */
  code: string;
  name: string;
  /** For departments: the parent MDA code (or 'CODE - Name' label) resolved at import time. */
  mdaRef?: string;
  mdaType?: string;
  /** True when no existing record matches — import must create it. */
  isNew: boolean;
  source: 'org_sheet' | 'employees_sheet';
}

export interface ValidationIssue {
  rowNumber: number;
  staffId: string;
  sheet: string;
  column: string;
  severity: ValidationSeverity;
  message: string;
}

export interface NormalizedEmployeeRecord {
  rowNumber: number;
  staffId: string; // Uppercase trimmed
  fullName: string;
  personal: {
    surname: string;
    firstName: string;
    otherNames?: string;
    dateOfBirth: string; // YYYY-MM-DD
    gender: Gender;
    maritalStatus: MaritalStatus;
    nationality: string;
    nationalIdentificationNumber?: string;
    residentialAddress: string;
    telephoneNumber: string; // Normalized +233 XX XXX XXXX
    emailAddress: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    nextOfKinName: string;
    nextOfKinRelationship: string;
    nextOfKinPhone: string;
    otherContacts?: string[];
  };
  employment: {
    employeeCategory: EmployeeCategory;
    employmentType: EmploymentType;
    dateOfFirstAppointment: string; // YYYY-MM-DD
    dateOfAssumptionOfDuty: string; // YYYY-MM-DD
    currentEmploymentStatus: 'Active';
    currentMdaId: number; // -1 when the MDA must be registered by the import first
    mdaLabel: string;
    currentDepartmentId: number; // -1 when the Department must be registered by the import first
    departmentLabel: string;
    currentPositionTitle: string;
    currentGradeId: number;
    gradeLabel: string;
    currentSalaryLevel: number;
    currentSalaryStep: number;
    dateAssignedCurrentRole: string;
    dateAssignedCurrentGrade: string;
    firstGradeId?: number;
    currentPromotionDate?: string;
    previousPosting?: string;
    statutoryRetirementDate: string; // Computed YYYY-MM-DD
  };
  initialQualification?: {
    qualificationLevel: string;
    qualificationTitle: string;
    institutionName: string;
    country: string;
    courseOfStudy: string;
    yearObtained: number;
    verificationStatus: 'Verified';
  };
  memberships: {
    professionalBody: string;
    membershipNumber: string;
    membershipCategory: string;
    registrationDate: string;
    expiryDate?: string;
    membershipStatus: 'Active' | 'Lapsed' | 'Suspended';
  }[];
  trainingCapabilities: string[];
  skills: {
    skillName: string;
    category: SkillCategory;
    evidence: string;
  }[];
}

export interface ValidatedEmployeeRow {
  rowNumber: number;
  staffId: string;
  displayName: string;
  mdaDisplay: string;
  departmentDisplay: string;
  gradeDisplay: string;
  status: RowValidationStatus;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  warningAction: WarningAction; // Default 'skip' for duplicate warnings, user can toggle to 'import'
  rawRow: RawEmployeeRow;
  normalized?: NormalizedEmployeeRecord;
}

export interface ValidationReport {
  rows: ValidatedEmployeeRow[];
  orphanIssues: ValidationIssue[]; // Issues from Capabilities / Skills sheets referencing unknown Staff IDs
  allIssues: ValidationIssue[];
  /** MDAs/Departments that must be upserted into master data during import. */
  orgUpserts: OrgUpsert[];
  summary: {
    totalRows: number;
    validCount: number;
    warningCount: number;
    errorCount: number;
    capabilitiesCount: number;
    skillsCount: number;
    membershipsCount: number;
  };
}

export type ImportOutcomeStatus = 'Imported' | 'Updated' | 'Skipped' | 'Failed';

export interface ImportRowOutcome {
  rowNumber: number;
  staffId: string;
  fullName: string;
  result: ImportOutcomeStatus;
  reason: string;
}

export interface ImportProgress {
  processed: number;
  total: number;
  batchIndex: number;
  totalBatches: number;
  importedSoFar: number;
  skippedSoFar: number;
  failedSoFar: number;
}

export interface ImportResultSummary {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  outcomes: ImportRowOutcome[];
  completedAt: string;
  batchId: string;
}
