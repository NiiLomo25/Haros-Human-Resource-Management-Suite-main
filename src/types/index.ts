/**
 * Haros HRMIS - Core Data Models and Relational Types
 * Aligned with Step 2 Relational Database Schema
 */

export type Gender = 'Male' | 'Female';
export type MaritalStatus = 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Separated';
export type EmploymentStatus = 'Active' | 'On Probation' | 'On Secondment' | 'On Study Leave' | 'Interdicted' | 'Suspended' | 'Separated' | 'Retired';
export type EmployeeCategory =
  | 'Professional'
  | 'Sub-Professional'
  | 'Technical'
  | 'Administrative'
  | 'Consultant';
export type EmploymentType = 'Permanent & Pensionable' | 'Fixed-Term Contract' | 'Casual';

export type MovementType =
  | 'Transfer'
  | 'Posting'
  | 'Secondment'
  | 'Acting Appointment'
  | 'Reassignment'
  | 'Redeployment'
  | 'Promotion'
  | 'Demotion'
  | 'Interdepartmental Movement'
  | 'Inter-MDA Movement'
  | 'Return from Secondment'
  | 'Temporary Assignment';

export type MovementWorkflowStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Implemented'
  | 'Rejected'
  | 'Cancelled';

export interface Employee {
  id: number;
  staffId: string; // Unique e.g. "OHCS-EMP-00101"
  isActive: boolean;
  isDeleted: boolean;
  createdDate: string;
  createdBy: string;
  modifiedDate: string;
  modifiedBy: string;
}

export interface EmployeePersonalInfo {
  id: number;
  employeeId: number;
  surname: string;
  firstName: string;
  otherNames?: string;
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: Gender;
  maritalStatus: MaritalStatus;
  nationality: string;
  nationalIdentificationNumber?: string;
  residentialAddress: string;
  telephoneNumber: string;
  emailAddress: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
  nextOfKinAddress?: string;
  otherContacts?: string[];
  photoUrl?: string;
}

export interface EmployeeEmploymentInfo {
  id: number;
  employeeId: number;
  employeeCategory: EmployeeCategory;
  employmentType: EmploymentType;
  dateOfFirstAppointment: string;
  dateOfAssumptionOfDuty: string;
  confirmationDate?: string;
  statutoryRetirementDate: string;
  currentEmploymentStatus: EmploymentStatus;
  currentMdaId: number;
  currentDepartmentId: number;
  currentUnitId?: number;
  currentPositionTitle: string;
  currentGradeId: number;
  currentSalaryLevel: number;
  currentSalaryStep: number;
  reportingOfficerEmployeeId?: number;
  dateAssignedCurrentRole: string;
  dateAssignedCurrentGrade: string;
  firstGradeId?: number;
  currentPromotionDate?: string;
  previousPosting?: string;
}

export interface EmployeeQualification {
  id: number;
  employeeId: number;
  qualificationLevel: string; // WASSCE, HND, Bachelor, Master, PhD, Professional
  qualificationTitle: string;
  institutionName: string;
  country: string;
  courseOfStudy: string;
  yearObtained: number;
  certificateNumber?: string;
  verificationStatus: 'Verified' | 'Pending' | 'Rejected';
}

export interface EmployeeProfessionalMembership {
  id: number;
  employeeId: number;
  professionalBody: string; // e.g. "Institute of Human Resource Management Practitioners (IHRMP)"
  membershipNumber: string;
  membershipCategory: string; // e.g. "Chartered Member", "Fellow", "Associate"
  registrationDate: string;
  expiryDate?: string;
  membershipStatus: 'Active' | 'Lapsed' | 'Suspended';
}

export interface PriorEmploymentHistory {
  id: number;
  employeeId: number;
  organizationName: string;
  positionTitle: string;
  gradeRank?: string;
  startDate: string;
  endDate: string;
  reasonForLeaving?: string;
}

export interface EmployeeDocument {
  id: number;
  employeeId: number;
  documentCategory: 'Appointment Letter' | 'Promotion Letter' | 'Transfer Letter' | 'Academic Certificate' | 'Performance Appraisal' | 'Confirmation Letter' | 'Other';
  documentTitle: string;
  fileName: string;
  fileExtension: string;
  fileSizeInBytes: number;
  uploadDate: string;
  uploadedBy: string;
  notes?: string;
}

// --- Section 4 & Capability Form: Training Capabilities & Staff Skills ---
export interface EmployeeTrainingCapability {
  id: number;
  employeeId: number;
  capability: string;
  createdAt: string;
  updatedAt: string;
}

export type SkillCategory =
  | 'Technical'
  | 'Professional'
  | 'Digital'
  | 'Leadership'
  | 'Communication'
  | 'Analytical'
  | 'Interpersonal'
  | 'Other';

export interface EmployeeSkill {
  id: number;
  employeeId: number;
  skillName: string;
  category: SkillCategory;
  evidence: string;
  createdAt: string;
  updatedAt: string;
}

export interface Mda {
  id: number;
  code: string; // e.g. "MOF", "OHCS"
  name: string;
  mdaType: 'Ministry' | 'Department' | 'Agency' | 'Commission';
  headEmployeeId?: number;
  isActive: boolean;
}

export interface Department {
  id: number;
  mdaId: number;
  departmentCode: string;
  departmentName: string;
  parentDepartmentId?: number;
  departmentHeadEmployeeId?: number;
  status: 'Active' | 'Archived';
}

export interface Unit {
  id: number;
  departmentId: number;
  unitCode: string;
  unitName: string;
  unitHeadEmployeeId?: number;
}

export type ProgressionType = 'Automatic Career Progression' | 'Competitive Senior Promotion';

export interface GradeLevel {
  id: number;
  gradeName: string; // e.g. "Junior Clerk", "Director", "Director of Procurement and Supply Chain Manager"
  hierarchyRank: number; // internal ordering weight (1 to 25)
  minYearsInGradeForPromotion: number;
  monthlyBaseGhs: number;
  isActive: boolean;
  cadreCategory?: 'Professional' | 'Sub-Professional' | 'General';
  occupationalGroup?: string; // e.g. "Procurement & Supply Chain Management", "General Administration"
  progressionMode?: 'Automatic' | 'Competitive';
  isSeniorManagement?: boolean;
}

export interface EstablishmentPosition {
  id: number;
  positionCode: string;
  departmentId: number;
  gradeId: number;
  positionTitle: string;
  approvedCadreQuota: number;
  status: 'Active' | 'Frozen' | 'Abolished';
}

export interface StaffMovement {
  id: number;
  movementReferenceNumber: string;
  employeeId: number;
  movementType: MovementType;
  previousMdaId: number;
  previousDepartmentId: number;
  previousUnitId?: number;
  previousPositionTitle: string;
  previousGradeId: number;
  previousSalaryLevel: number;
  previousSalaryStep: number;
  newMdaId: number;
  newDepartmentId: number;
  newUnitId?: number;
  newPositionTitle: string;
  newGradeId: number;
  newSalaryLevel: number;
  newSalaryStep: number;
  effectiveDate: string;
  approvalDate?: string;
  implementationDate?: string;
  movementReason: string;
  approvedByUserId?: number;
  supportingDocumentName?: string;
  remarks?: string;
  workflowStatus: MovementWorkflowStatus;
  createdTimestamp: string;
  createdBy: string;
}

export interface StaffMovementHistory {
  id: number;
  movementId: number;
  employeeId: number;
  movementReferenceNumber: string;
  movementType: MovementType;
  mdaNameFrom: string;
  mdaNameTo: string;
  departmentNameFrom: string;
  departmentNameTo: string;
  unitNameFrom?: string;
  unitNameTo?: string;
  positionTitleFrom: string;
  positionTitleTo: string;
  gradeNameFrom: string;
  gradeNameTo: string;
  effectiveDate: string;
  approvalDate: string;
  implementedDate: string;
  approvedByOfficerName: string;
  reason: string;
  supportingDocumentReference?: string;
  archivedSnapshotJson: string;
  recordedTimestamp: string;
}

export interface RecruitmentApplicant {
  id: number;
  applicantNumber: string; // e.g. "APP-2026-001"
  vacancyPositionTitle: string;
  departmentId: number;
  mdaId: number;
  gradeId: number;
  cadreCategory: EmployeeCategory;
  firstName: string;
  surname: string;
  otherNames?: string;
  gender: Gender;
  dateOfBirth: string;
  nationalIdentificationNumber?: string;
  telephoneNumber: string;
  emailAddress: string;
  highestQualification: string;
  institutionName: string;
  yearsOfExperience: number;
  applicationDate: string;
  interviewScore?: number; // 0 - 100
  interviewDate?: string;
  interviewNotes?: string;
  status: 'Applied' | 'Shortlisted' | 'Interviewed' | 'Selected' | 'Appointed' | 'Rejected';
  appointedEmployeeId?: number;
}

export interface PromotionRecommendation {
  id: number;
  employeeId: number;
  currentGradeId: number;
  recommendedGradeId: number;
  recommendationDate: string;
  yearsInCurrentGrade: number;
  boardReviewNotes: string;
  recommendedBy: string;
  status: 'Pending Review' | 'Board Approved' | 'Implemented' | 'Deferred';
  approvedDate?: string;
  progressionType?: ProgressionType;
  competitiveExamScore?: number; // 0 - 100 for competitive merit promotions
  boardInterviewPanel?: string;
  performanceAppraisalScore?: number;
  conductStatus?: 'Cleared' | 'Sanction Active' | 'Pending Review';
}

export interface PromotionEligibilityResult {
  employeeId: number;
  yearsInGrade: number;
  requiredYears: number;
  progressionType: ProgressionType;
  progressionMode: 'Automatic' | 'Competitive';
  isSeniorManagement: boolean;
  statutoryRuleSummary: string;
  hasSufficientTimeInGrade: boolean;
  hasSatisfactoryPerformance: boolean;
  performanceScore?: number;
  performanceRating?: string;
  hasCleanConduct: boolean;
  conductStatus: 'Cleared' | 'Sanction Active' | 'Pending Review';
  activeSanctionDetails?: string;
  isEligible: boolean;
  blockerReasons: string[];
  suggestedTargetGrade?: GradeLevel;
}

export interface LeaveBalance {
  id: number;
  employeeId: number;
  leaveTypeId: number;
  calendarYear: number;
  annualEntitlementDays: number;
  broughtForwardDays: number;
  daysTaken: number;
  availableDays: number;
}

export interface LeaveType {
  id: number;
  leaveCode: string;
  leaveName: string;
  defaultDaysPerYear: number;
  isPaid: boolean;
}

export interface LeaveApplication {
  id: number;
  leaveReferenceNumber: string;
  employeeId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  daysRequested: number;
  handoverOfficerEmployeeId?: number;
  reason: string;
  contactAddressWhileOnLeave?: string;
  contactPhoneWhileOnLeave?: string;
  workflowStatus: 'Submitted' | 'Supervisor Recommended' | 'HR Reviewed' | 'Approved' | 'Rejected' | 'Resumed';
  resumptionDate?: string;
  createdDate: string;
}

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: 'Present' | 'Late' | 'Absent' | 'On Leave' | 'Official Duty' | 'Half Day';
  remarks?: string;
}

export type TrainingCategory =
  | 'Academic/Institution'
  | 'Scheme of Service'
  | 'Conferences / Workshops / Webinars'
  | 'Knowledge Sharing Fora'
  | 'Coaching and Mentoring'
  | 'On-the-Job Training'
  | 'Book Review / Personal Reading'
  | string;

export interface TrainingProgram {
  id: number;
  programCode: string;
  title: string;
  category: TrainingCategory;
  institutionName: string;
  location: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  costGhs: number;
  sponsoredBy: string;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Cancelled';
}

export interface TrainingNomination {
  id: number;
  trainingProgramId: number;
  employeeId: number;
  nominationDate: string;
  status: 'Nominated' | 'Approved' | 'Attended' | 'Completed' | 'Certified';
  certificateNumber?: string;
  evaluationScore?: number;
  feedbackNotes?: string;
}

export interface PerformanceAppraisal {
  id: number;
  appraisalCycle: string;
  employeeId: number;
  supervisorEmployeeId: number;
  appraisalPeriodStart: string;
  appraisalPeriodEnd: string;
  kpiTargetsSummary: string;
  selfAssessmentScore: number;
  supervisorScore: number;
  finalRating: 'Unsatisfactory' | 'Needs Improvement' | 'Meets Expectations' | 'Exceeds Expectations' | 'Outstanding';
  overallScorePercentage: number;
  strengthsAndAchievements: string;
  areasForImprovement: string;
  status: 'Draft Self-Appraisal' | 'Supervisor Review' | 'HR Finalized' | 'Completed';
  completedDate?: string;
}

export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  staffId?: string;
  roleName: string;
  roleId: number;
  passwordHash?: string;
  passwordUpdatedAt?: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lastLoginDate?: string;
}

export interface Role {
  id: number;
  roleName: string;
  description: string;
  isSystemRole: boolean;
  permissions: string[];
}

export interface AuditTrailLog {
  id: number;
  userId?: number;
  username: string;
  machineName: string;
  ipOrHost: string;
  module: string;
  actionType: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'APPROVE_MOVEMENT' | 'SYSTEM_INIT' | 'SECURITY';
  entityName: string;
  recordId: string;
  oldValuesJson?: string;
  newValuesJson?: string;
  timestampUtc: string;
}

export interface SystemSetting {
  settingKey: string;
  settingValue: string;
  category: string;
  description: string;
}

// --- Section 13: Payroll & Compensation Models ---
export interface SalaryStructure {
  id: number;
  structureCode: string; // e.g. "SSSS-2026"
  name: string; // e.g. "Single Spine Salary Structure"
  effectiveYear: number;
  baseRateDailyGhs: number;
  status: 'Active' | 'Draft' | 'Archived';
}

export interface SalaryGradeStep {
  id: number;
  gradeLevelId: number;
  stepNumber: number; // 1 to 5
  basicSalaryMonthlyGhs: number;
  annualSalaryGhs: number;
}

export interface PayrollComponent {
  id: number;
  componentCode: string;
  name: string;
  type: 'Allowance' | 'Deduction';
  calculationType: 'PercentageOfBasic' | 'FixedAmount';
  rateOrAmount: number; // percentage (e.g. 15 for 15%) or fixed GHS (e.g. 450)
  isStatutory: boolean;
  isTaxable: boolean;
  appliesToAll: boolean;
  targetCadre?: EmployeeCategory;
  description?: string;
}

export interface EmployeePayrollAssignment {
  id: number;
  employeeId: number;
  gradeId: number;
  salaryStep: number;
  basicSalaryMonthlyGhs: number;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  ssnitNumber: string;
  taxIdentificationNumber: string;
  allowanceComponentIds: number[];
  deductionComponentIds: number[];
}

export interface PayrollRun {
  id: number;
  periodYear: number;
  periodMonth: number; // 1 to 12
  periodLabel: string; // e.g. "November 2026 Payroll Run"
  totalStaffCount: number;
  totalBasicGhs: number;
  totalAllowancesGhs: number;
  totalGrossGhs: number;
  totalDeductionsGhs: number;
  totalNetGhs: number;
  status: 'Draft' | 'Processed' | 'Audited' | 'Approved' | 'Disbursed';
  processedDate?: string;
  processedBy?: string;
  approvedDate?: string;
  approvedBy?: string;
}

export interface EmployeePayslip {
  id: number;
  payrollRunId: number;
  employeeId: number;
  staffId: string;
  employeeName: string;
  departmentName: string;
  gradeName: string;
  salaryStep: number;
  basicSalaryGhs: number;
  totalAllowancesGhs: number;
  grossSalaryGhs: number;
  ssnitDeductionGhs: number;
  payeTaxGhs: number;
  otherDeductionsGhs: number;
  totalDeductionsGhs: number;
  netSalaryGhs: number;
  bankName: string;
  bankAccountNumber: string;
  periodLabel: string;
}

// --- Section 14: Retirement & Separation Models ---
export type SeparationType =
  | 'Retirement'
  | 'Voluntary Resignation'
  | 'Termination'
  | 'Dismissal'
  | 'Death'
  | 'Contract Expiry'
  | 'Other Separation';

export type SeparationWorkflowStatus =
  | 'Pending Clearance'
  | 'Clearance In Progress'
  | 'Clearance Completed'
  | 'Ratified by HR Director'
  | 'Separation Executed'
  | 'Rejected';

export interface SeparationRecord {
  id: number;
  separationReference: string; // e.g. "SEP-2026-001"
  employeeId: number;
  separationType: SeparationType;
  submissionDate: string;
  effectiveDate: string;
  reason: string;
  statutoryRetirementAge: number; // e.g. 60
  yearsOfServiceAtSeparation: number;
  outstandingLeaveDays: number;
  gratuityEstimatedGhs?: number;
  status: SeparationWorkflowStatus;
  approvedByOfficer?: string;
  approvalDate?: string;
  exitInterviewNotes?: string;
}

export type ClearanceDepartmentUnit =
  | 'Library & Research Center'
  | 'IT & Telecommunications'
  | 'Transport & Fleet Unit'
  | 'Finance & Loan Advances'
  | 'General Registry & Security'
  | 'Internal Audit Agency';

export interface ClearanceItem {
  id: number;
  separationRecordId: number;
  unitName: ClearanceDepartmentUnit;
  isCleared: boolean;
  clearedByOfficer?: string;
  clearanceDate?: string;
  remarks?: string;
  outstandingObligations?: string;
}

// --- Section 15: Disciplinary Management Models ---
export type DisciplinaryOffence =
  | 'Insubordination & Disregard of Lawful Order'
  | 'Gross Misconduct & Civil Disorder'
  | 'Absence Without Official Leave (AWOL)'
  | 'Financial Malfeasance & Misappropriation'
  | 'Breach of Official Oath & Code of Conduct'
  | 'Unauthorized Leakage of Classified Information'
  | 'Negligence in the Discharge of Duty'
  | 'Other Infraction';

export type DisciplinarySanction =
  | 'Exonerated (No Action)'
  | 'Verbal Admonition'
  | 'Written Warning & Reprimand'
  | 'Withholding of Annual Increment'
  | 'Reduction in Rank (Demotion)'
  | 'Interdiction with Half Salary'
  | 'Suspension from Service'
  | 'Summary Dismissal';

export type DisciplinaryCaseStatus =
  | 'Reported'
  | 'Under Investigation'
  | 'Committee Hearing'
  | 'Sanction Imposed'
  | 'Exonerated'
  | 'Appealed'
  | 'Closed';

export interface DisciplinaryCase {
  id: number;
  caseReference: string; // e.g. "DISC-2026-001"
  employeeId: number;
  incidentDate: string;
  natureOfOffence: DisciplinaryOffence;
  allegationSummary: string;
  investigationDetails: string;
  disciplinaryCommitteeMembers: string;
  hearingDate?: string;
  outcome: 'Pending Investigation' | 'Charge Established' | 'Exonerated' | 'Dismissed';
  sanctionRecommended?: DisciplinarySanction;
  decisionDate?: string;
  supportingDocumentRef?: string;
  caseStatus: DisciplinaryCaseStatus;
  isConfidential: boolean;
  recordedBy: string;
  recordedDate: string;
}

// --- Section 16: Computer Registration, Application Activation & Expiry Control ---
export interface ActivationAdminAccount {
  id: number;
  username: string;
  fullName: string;
  passwordHash: string;
  isActive: boolean;
  lastAuthorizedAt?: string;
}

export interface RegisteredComputer {
  id: number;
  computerName: string;
  hardwareId: string;
  osPlatform: string;
  registeredAt: string;
  registeredBy: string;
  tradeEDate: string;
  status: 'Active' | 'Expired' | 'Tampered' | 'Revoked';
  integritySignature: string;
}

export interface ApplicationExpiryConfig {
  tradeEDate: string; // YYYY-MM-DD
  updatedAt: string;
  updatedBy: string;
  maxSeenUtcMs: number;
  lastValidatedUtcMs: number;
  clockTamperDetected: boolean;
  clockTamperReason?: string;
  integritySignature: string;
}

export type StartupBlockReason =
  | 'UNREGISTERED_COMPUTER'
  | 'EXPIRY_NOT_CONFIGURED'
  | 'EXPIRED'
  | 'CLOCK_TAMPERED'
  | null;

export interface StartupValidationResult {
  hardwareId: string;
  detectedComputerName: string;
  osPlatform: string;
  isComputerRegistered: boolean;
  registeredComputer: RegisteredComputer | null;
  hasExpiryConfigured: boolean;
  tradeEDate: string;
  isExpired: boolean;
  clockTamperDetected: boolean;
  clockTamperReason?: string;
  canAccessLogin: boolean;
  canAccessApplication: boolean;
  blockReason: StartupBlockReason;
  daysRemaining: number | null;
  persistenceVaultActive: boolean;
}

// --- Section 17: Unified Role-Based Access Control (RBAC) & Route Permission Matrix ---
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

export type PermissionItemType = 'route' | 'submenu' | 'action';

export interface PermissionDefinition {
  code: string;
  label: string;
  module: string;
  moduleId: NavModuleId;
  routePath: string;
  itemType: PermissionItemType;
  description?: string;
}

export interface RoutePermissionRecord {
  id: number;
  roleId: number;
  permissionCode: string;
  isAllowed: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export interface RouteSyncResult {
  added: number;
  updated: number;
  skipped: number;
  totalDefinitions: number;
  syncedAt: string;
}
