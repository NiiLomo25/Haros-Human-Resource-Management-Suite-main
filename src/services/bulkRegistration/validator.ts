import { db } from '../../db/storage';
import {
  EmployeeCategory,
  EmploymentType,
  Gender,
  MaritalStatus,
  SkillCategory,
} from '../../types';
import { SKILL_CATEGORIES } from '../../components/staff/TrainingAndSkillsEditor';
import {
  ParsedWorkbookData,
  SHEET_NAMES,
  ValidationIssue,
  ValidatedEmployeeRow,
  ValidationReport,
  NormalizedEmployeeRecord,
  RawCapabilityRow,
  RawSkillRow,
  RawMembershipRow,
} from './types';

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function normalizeStaffId(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidStaffIdFormat(staffId: string): boolean {
  // Alphanumeric with optional hyphens/underscores, 3–30 chars, no spaces
  return /^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$/.test(staffId);
}

/**
 * Parses DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, YYYY-MM-DD, or Excel serial date string
 * into canonical ISO YYYY-MM-DD. Returns null if invalid.
 */
export function parseCivilServiceDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Excel serial number fallback (e.g., "32309")
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial > 1000 && serial < 100000) {
      // Excel epoch 1899-12-30 UTC
      const utcMs = Date.UTC(1899, 11, 30) + serial * 86400000;
      const d = new Date(utcMs);
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
  }

  let day: number;
  let month: number;
  let year: number;

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else {
    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
    if (!dmyMatch) return null;
    day = parseInt(dmyMatch[1], 10);
    month = parseInt(dmyMatch[2], 10);
    year = parseInt(dmyMatch[3], 10);
  }

  if (year < 1920 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const testDate = new Date(Date.UTC(year, month - 1, day));
  if (
    testDate.getUTCFullYear() !== year ||
    testDate.getUTCMonth() !== month - 1 ||
    testDate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function calculateAgeFromIso(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  const mDiff = today.getMonth() + 1 - m;
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) {
    age--;
  }
  return age;
}

export function computeStatutoryRetirementIso(dobIso: string, firstApptIso: string): string {
  const [dy, dm, dd] = dobIso.split('-').map(Number);
  const [ay, am, ad] = firstApptIso.split('-').map(Number);

  const retByAge = new Date(Date.UTC(dy + 60, dm - 1, dd));
  const retByService = new Date(Date.UTC(ay + 35, am - 1, ad));
  const earlier = retByAge < retByService ? retByAge : retByService;
  return earlier.toISOString().split('T')[0];
}

/**
 * Normalizes Ghana telephone numbers to "+233 XX XXX XXXX".
 * Accepts +233XXXXXXXXX, 00233XXXXXXXXX, 233XXXXXXXXX, 0XXXXXXXXX, or 9-digit local.
 */
export function normalizeGhanaPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Reject if contains unexpected letters
  if (/[A-Za-z]/.test(trimmed)) return null;

  const digitsOnly = trimmed.replace(/[^\d+]/g, '');
  let nationalNineDigits = '';

  if (digitsOnly.startsWith('+233')) {
    nationalNineDigits = digitsOnly.slice(4);
  } else if (digitsOnly.startsWith('00233')) {
    nationalNineDigits = digitsOnly.slice(5);
  } else if (digitsOnly.startsWith('233') && digitsOnly.length === 12) {
    nationalNineDigits = digitsOnly.slice(3);
  } else if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    nationalNineDigits = digitsOnly.slice(1);
  } else if (/^\d{9}$/.test(digitsOnly)) {
    nationalNineDigits = digitsOnly;
  } else {
    return null;
  }

  // Handle accidental +2330XXXXXXXXX (user kept local 0 after +233)
  if (nationalNineDigits.startsWith('0') && nationalNineDigits.length === 10) {
    nationalNineDigits = nationalNineDigits.slice(1);
  }

  if (!/^\d{9}$/.test(nationalNineDigits)) {
    return null;
  }

  return `+233 ${nationalNineDigits.slice(0, 2)} ${nationalNineDigits.slice(2, 5)} ${nationalNineDigits.slice(5)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Normalizes Ghana Card (NIA) numbers to "GHA-XXXXXXXXX-X".
 * Returns null if format does not match 9-digit + 1-check-digit GHA pattern.
 */
export function normalizeGhanaCard(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return null;
  const match = /^GHA-?(\d{9})-?(\d)$/.exec(cleaned);
  if (!match) return null;
  return `GHA-${match[1]}-${match[2]}`;
}

function matchGender(raw: string): Gender | null {
  const v = raw.trim().toLowerCase();
  if (v === 'male' || v === 'm') return 'Male';
  if (v === 'female' || v === 'f') return 'Female';
  return null;
}

function matchMaritalStatus(raw: string): MaritalStatus | null {
  const v = raw.trim().toLowerCase();
  const map: Record<string, MaritalStatus> = {
    single: 'Single',
    married: 'Married',
    divorced: 'Divorced',
    widowed: 'Widowed',
    separated: 'Separated',
  };
  return map[v] || null;
}

function matchEmployeeCategory(raw: string): EmployeeCategory | null {
  const v = raw.trim().toLowerCase();
  const map: Record<string, EmployeeCategory> = {
    professional: 'Professional',
    'professional cadre': 'Professional',
    'sub-professional': 'Sub-Professional',
    'sub-professional cadre': 'Sub-Professional',
    subprofessional: 'Sub-Professional',
    technical: 'Technical',
    'technical cadre': 'Technical',
    administrative: 'Administrative',
    'administrative cadre': 'Administrative',
    consultant: 'Consultant',
  };
  return map[v] || null;
}

function matchEmploymentType(raw: string): EmploymentType | null {
  const v = raw.trim().toLowerCase();
  const map: Record<string, EmploymentType> = {
    'permanent & pensionable': 'Permanent & Pensionable',
    permanent: 'Permanent & Pensionable',
    'fixed-term contract': 'Fixed-Term Contract',
    contract: 'Fixed-Term Contract',
    casual: 'Casual',
  };
  return map[v] || null;
}

function matchQualificationLevel(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    bachelor: 'Bachelor',
    "bachelor's degree": 'Bachelor',
    bsc: 'Bachelor',
    ba: 'Bachelor',
    master: 'Master',
    "master's degree": 'Master',
    msc: 'Master',
    mpa: 'Master',
    mba: 'Master',
    doctorate: 'Doctorate',
    'doctorate (phd)': 'Doctorate',
    phd: 'Doctorate',
    hnd: 'HND',
    'higher national diploma (hnd)': 'HND',
    diploma: 'Diploma',
    wassce: 'WASSCE',
    'wassce / secondary': 'WASSCE',
    professional: 'Professional',
    'professional certification': 'Professional',
  };
  return map[v] || null;
}

function matchSkillCategory(raw: string): SkillCategory | null {
  const v = raw.trim().toLowerCase();
  const found = SKILL_CATEGORIES.find((c) => c.value.toLowerCase() === v);
  return found ? found.value : null;
}

function matchMembershipStatus(raw: string): 'Active' | 'Lapsed' | 'Suspended' | null {
  const v = raw.trim().toLowerCase();
  if (v === 'active') return 'Active';
  if (v === 'lapsed') return 'Lapsed';
  if (v === 'suspended') return 'Suspended';
  return null;
}

export async function validateParsedWorkbook(
  parsed: ParsedWorkbookData,
  onProgress?: (message: string) => void
): Promise<ValidationReport> {
  onProgress?.('Loading live Civil Service master data...');

  const mdas = db.getMdas().filter((m) => m.isActive !== false);
  const departments = db.getDepartments().filter((d) => d.status !== 'Archived');
  const gradeLevels = db.getGradeLevels().filter((g) => g.isActive !== false);

  // Check Staff IDs against ALL records in DB (matching db.createEmployee uniqueness rule)
  const existingEmployeesAll = db.getAllRawEmployeeStaffIds
    ? db.getAllRawEmployeeStaffIds()
    : db.getEmployees().map((e) => e.staffId);
  const existingStaffIdSet = new Set(existingEmployeesAll.map((id) => id.trim().toUpperCase()));

  // Build existing person duplicate lookup indexes from active employees
  const activeEmployees = db.getEmployees();
  const existingPhoneMap = new Map<string, string>(); // normalizedPhone -> staffId
  const existingEmailMap = new Map<string, string>(); // lowerEmail -> staffId
  const existingNinMap = new Map<string, string>(); // normalizedNin -> staffId
  const existingNameDobMap = new Map<string, string>(); // surname|firstname|dob -> staffId

  activeEmployees.forEach((emp) => {
    const p = db.getEmployeePersonalInfo(emp.id);
    if (!p) return;
    const normPhone = normalizeGhanaPhone(p.telephoneNumber || '');
    if (normPhone) existingPhoneMap.set(normPhone, emp.staffId);
    if (p.emailAddress) existingEmailMap.set(p.emailAddress.trim().toLowerCase(), emp.staffId);
    if (p.nationalIdentificationNumber) {
      const normDbNin = normalizeGhanaCard(p.nationalIdentificationNumber) || p.nationalIdentificationNumber.trim().toUpperCase();
      if (normDbNin) existingNinMap.set(normDbNin, emp.staffId);
    }
    if (p.surname && p.firstName && p.dateOfBirth) {
      const key = `${p.surname.trim().toLowerCase()}|${p.firstName.trim().toLowerCase()}|${p.dateOfBirth.trim()}`;
      existingNameDobMap.set(key, emp.staffId);
    }
  });

  // Lookup helpers for master data
  const mdaByKey = new Map<string, (typeof mdas)[number]>();
  mdas.forEach((m) => {
    mdaByKey.set(`${m.code} - ${m.name}`.toLowerCase(), m);
    mdaByKey.set(m.code.toLowerCase(), m);
    mdaByKey.set(m.name.toLowerCase(), m);
  });

  const gradeByKey = new Map<string, (typeof gradeLevels)[number]>();
  gradeLevels.forEach((g) => {
    gradeByKey.set(g.gradeName.toLowerCase(), g);
  });

  // Track Staff ID occurrences inside file (flag ALL duplicates!)
  const staffIdOccurrences = new Map<string, number[]>();
  parsed.employees.forEach((row) => {
    const normId = normalizeStaffId(row.staffId);
    if (normId) {
      const list = staffIdOccurrences.get(normId) || [];
      list.push(row.rowNumber);
      staffIdOccurrences.set(normId, list);
    }
  });
  const fileEmployeeStaffIdSet = new Set(staffIdOccurrences.keys());

  // Group and pre-validate Capabilities & Skills by Staff ID
  const capabilitiesByStaff = new Map<string, { items: string[]; errors: ValidationIssue[] }>();
  const orphanIssues: ValidationIssue[] = [];

  parsed.capabilities.forEach((capRow: RawCapabilityRow) => {
    const normId = normalizeStaffId(capRow.staffId);
    if (!normId) {
      orphanIssues.push({
        rowNumber: capRow.rowNumber,
        staffId: '(Blank)',
        sheet: SHEET_NAMES.CAPABILITIES,
        column: 'Staff ID*',
        severity: 'error',
        message: 'Capability entry is missing Staff ID.',
      });
      return;
    }

    if (!fileEmployeeStaffIdSet.has(normId)) {
      orphanIssues.push({
        rowNumber: capRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.CAPABILITIES,
        column: 'Staff ID*',
        severity: 'error',
        message: `Staff ID "${normId}" in Training Capabilities sheet does not exist in the Employees sheet.`,
      });
      return;
    }

    const bucket = capabilitiesByStaff.get(normId) || { items: [], errors: [] };
    if (!capRow.capability.trim()) {
      // Blank capability description on a row with Staff ID - skip or warn? Ignore empty description unless needed, actually flag if completely empty capability
      bucket.errors.push({
        rowNumber: capRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.CAPABILITIES,
        column: 'Capability Description',
        severity: 'error',
        message: 'Capability Description cannot be blank when Staff ID is entered.',
      });
    } else if (bucket.items.length >= 10) {
      bucket.errors.push({
        rowNumber: capRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.CAPABILITIES,
        column: 'Capability Description',
        severity: 'error',
        message: `Exceeds maximum of 10 Training Capabilities for Staff ID "${normId}".`,
      });
    } else {
      bucket.items.push(capRow.capability.trim());
    }
    capabilitiesByStaff.set(normId, bucket);
  });

  const skillsByStaff = new Map<
    string,
    {
      items: { skillName: string; category: SkillCategory; evidence: string }[];
      seenNames: Set<string>;
      errors: ValidationIssue[];
    }
  >();

  parsed.skills.forEach((skillRow: RawSkillRow) => {
    const normId = normalizeStaffId(skillRow.staffId);
    if (!normId) {
      orphanIssues.push({
        rowNumber: skillRow.rowNumber,
        staffId: '(Blank)',
        sheet: SHEET_NAMES.SKILLS,
        column: 'Staff ID*',
        severity: 'error',
        message: 'Skill entry is missing Staff ID.',
      });
      return;
    }

    if (!fileEmployeeStaffIdSet.has(normId)) {
      orphanIssues.push({
        rowNumber: skillRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.SKILLS,
        column: 'Staff ID*',
        severity: 'error',
        message: `Staff ID "${normId}" in Skills sheet does not exist in the Employees sheet.`,
      });
      return;
    }

    const bucket = skillsByStaff.get(normId) || {
      items: [],
      seenNames: new Set<string>(),
      errors: [],
    };

    const trimmedSkill = skillRow.skillName.trim();
    const matchedCat = matchSkillCategory(skillRow.category);

    if (!trimmedSkill) {
      bucket.errors.push({
        rowNumber: skillRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.SKILLS,
        column: 'Skill Name*',
        severity: 'error',
        message: 'Skill Name is required for each row in the Skills sheet.',
      });
    } else if (!matchedCat) {
      bucket.errors.push({
        rowNumber: skillRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.SKILLS,
        column: 'Skill Category*',
        severity: 'error',
        message: `Invalid Skill Category "${skillRow.category || '(blank)'}". Allowed values: Technical, Professional, Digital, Leadership, Communication, Analytical, Interpersonal, Other.`,
      });
    } else if (bucket.seenNames.has(trimmedSkill.toLowerCase())) {
      bucket.errors.push({
        rowNumber: skillRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.SKILLS,
        column: 'Skill Name*',
        severity: 'error',
        message: `Duplicate skill "${trimmedSkill}" for Staff ID "${normId}".`,
      });
    } else if (bucket.items.length >= 10) {
      bucket.errors.push({
        rowNumber: skillRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.SKILLS,
        column: 'Skill Name*',
        severity: 'error',
        message: `Exceeds maximum of 10 Skills for Staff ID "${normId}".`,
      });
    } else {
      bucket.seenNames.add(trimmedSkill.toLowerCase());
      bucket.items.push({
        skillName: trimmedSkill,
        category: matchedCat,
        evidence: skillRow.evidence.trim(),
      });
    }
    skillsByStaff.set(normId, bucket);
  });

  const membershipsByStaff = new Map<
    string,
    {
      items: {
        professionalBody: string;
        membershipNumber: string;
        membershipCategory: string;
        registrationDate: string;
        expiryDate?: string;
        membershipStatus: 'Active' | 'Lapsed' | 'Suspended';
      }[];
      seenKeys: Set<string>;
      errors: ValidationIssue[];
    }
  >();

  const defaultTodayIso = new Date().toISOString().split('T')[0];
  parsed.memberships.forEach((memRow: RawMembershipRow) => {
    const normId = normalizeStaffId(memRow.staffId);
    if (!normId) {
      orphanIssues.push({
        rowNumber: memRow.rowNumber,
        staffId: '(Blank)',
        sheet: SHEET_NAMES.MEMBERSHIPS,
        column: 'Staff ID*',
        severity: 'error',
        message: 'Professional Membership entry is missing Staff ID.',
      });
      return;
    }

    if (!fileEmployeeStaffIdSet.has(normId)) {
      orphanIssues.push({
        rowNumber: memRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.MEMBERSHIPS,
        column: 'Staff ID*',
        severity: 'error',
        message: `Staff ID "${normId}" in Professional Memberships sheet does not exist in the Employees sheet.`,
      });
      return;
    }

    const bucket = membershipsByStaff.get(normId) || {
      items: [],
      seenKeys: new Set<string>(),
      errors: [],
    };

    const body = memRow.professionalBody.trim();
    const num = memRow.membershipNumber.trim();
    const cat = memRow.membershipCategory.trim() || 'Full Member';

    let regIso = defaultTodayIso;
    let regInvalid = false;
    if (memRow.registrationDate.trim()) {
      const parsedReg = parseCivilServiceDate(memRow.registrationDate);
      if (!parsedReg) {
        regInvalid = true;
        bucket.errors.push({
          rowNumber: memRow.rowNumber,
          staffId: normId,
          sheet: SHEET_NAMES.MEMBERSHIPS,
          column: 'Registration Date (DD/MM/YYYY)',
          severity: 'error',
          message: `Invalid Registration Date "${memRow.registrationDate}". Expected DD/MM/YYYY.`,
        });
      } else {
        regIso = parsedReg;
      }
    }

    let expiryIso: string | undefined;
    if (memRow.expiryDate.trim()) {
      const parsedExp = parseCivilServiceDate(memRow.expiryDate);
      if (!parsedExp) {
        bucket.errors.push({
          rowNumber: memRow.rowNumber,
          staffId: normId,
          sheet: SHEET_NAMES.MEMBERSHIPS,
          column: 'Expiry Date (DD/MM/YYYY)',
          severity: 'error',
          message: `Invalid Expiry Date "${memRow.expiryDate}". Expected DD/MM/YYYY.`,
        });
      } else if (!regInvalid && parsedExp < regIso) {
        bucket.errors.push({
          rowNumber: memRow.rowNumber,
          staffId: normId,
          sheet: SHEET_NAMES.MEMBERSHIPS,
          column: 'Expiry Date (DD/MM/YYYY)',
          severity: 'error',
          message: 'Membership Expiry Date cannot be earlier than Registration Date.',
        });
      } else {
        expiryIso = parsedExp;
      }
    }

    let memStatus: 'Active' | 'Lapsed' | 'Suspended' = 'Active';
    if (memRow.membershipStatus.trim()) {
      const matchedStatus = matchMembershipStatus(memRow.membershipStatus);
      if (!matchedStatus) {
        bucket.errors.push({
          rowNumber: memRow.rowNumber,
          staffId: normId,
          sheet: SHEET_NAMES.MEMBERSHIPS,
          column: 'Membership Status',
          severity: 'error',
          message: `Invalid Membership Status "${memRow.membershipStatus}". Allowed: Active, Lapsed, Suspended.`,
        });
      } else {
        memStatus = matchedStatus;
      }
    }

    const dupKey = `${body.toLowerCase()}::${num.toLowerCase()}`;
    if (!body) {
      bucket.errors.push({
        rowNumber: memRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.MEMBERSHIPS,
        column: 'Professional Body*',
        severity: 'error',
        message: 'Professional Body / Association is required for each row in Professional Memberships.',
      });
    } else if (!num) {
      bucket.errors.push({
        rowNumber: memRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.MEMBERSHIPS,
        column: 'Membership Number*',
        severity: 'error',
        message: 'Membership Number is required for each row in Professional Memberships.',
      });
    } else if (bucket.seenKeys.has(dupKey)) {
      bucket.errors.push({
        rowNumber: memRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.MEMBERSHIPS,
        column: 'Membership Number*',
        severity: 'error',
        message: `Duplicate professional membership (${body} • ${num}) for Staff ID "${normId}".`,
      });
    } else if (bucket.items.length >= 10) {
      bucket.errors.push({
        rowNumber: memRow.rowNumber,
        staffId: normId,
        sheet: SHEET_NAMES.MEMBERSHIPS,
        column: 'Professional Body*',
        severity: 'error',
        message: `Exceeds maximum of 10 Professional Memberships for Staff ID "${normId}".`,
      });
    } else {
      bucket.seenKeys.add(dupKey);
      bucket.items.push({
        professionalBody: body,
        membershipNumber: num,
        membershipCategory: cat,
        registrationDate: regIso,
        expiryDate: expiryIso,
        membershipStatus: memStatus,
      });
    }

    membershipsByStaff.set(normId, bucket);
  });

  // In-file duplicate person tracking
  const filePhoneMap = new Map<string, string>();
  const fileEmailMap = new Map<string, string>();
  const fileNinMap = new Map<string, string>();
  const fileNameDobMap = new Map<string, string>();

  const validatedRows: ValidatedEmployeeRow[] = [];
  const allIssues: ValidationIssue[] = [...orphanIssues];
  const currentYear = new Date().getFullYear();

  for (let idx = 0; idx < parsed.employees.length; idx++) {
    const row = parsed.employees[idx];
    const normStaffId = normalizeStaffId(row.staffId);
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    const addErr = (column: string, message: string) => {
      const issue: ValidationIssue = {
        rowNumber: row.rowNumber,
        staffId: normStaffId || '(Blank)',
        sheet: SHEET_NAMES.EMPLOYEES,
        column,
        severity: 'error',
        message,
      };
      errors.push(issue);
    };

    const addWarn = (column: string, message: string) => {
      const issue: ValidationIssue = {
        rowNumber: row.rowNumber,
        staffId: normStaffId || '(Blank)',
        sheet: SHEET_NAMES.EMPLOYEES,
        column,
        severity: 'warning',
        message,
      };
      warnings.push(issue);
    };

    // 1. Staff ID Validation
    if (!normStaffId) {
      addErr('Staff ID*', 'Staff ID is required and must be entered manually.');
    } else {
      if (!isValidStaffIdFormat(normStaffId)) {
        addErr(
          'Staff ID*',
          `Invalid Staff ID format "${normStaffId}". Use 3–30 alphanumeric characters, hyphens, or underscores with no spaces (e.g. OHCS-EMP-00201).`
        );
      }
      const occ = staffIdOccurrences.get(normStaffId) || [];
      if (occ.length > 1) {
        addErr(
          'Staff ID*',
          `Duplicate Staff ID "${normStaffId}" appears multiple times in this file (rows ${occ.join(', ')}).`
        );
      }
      if (existingStaffIdSet.has(normStaffId)) {
        addErr('Staff ID*', `Staff ID already exists in the Civil Service database ("${normStaffId}").`);
      }
    }

    // 2. Names
    const surname = row.surname.trim();
    const firstName = row.firstName.trim();
    const otherNames = row.otherNames.trim();
    if (!surname) addErr('Surname*', 'Surname is required.');
    if (!firstName) addErr('First Name*', 'First Name is required.');

    // 3. Date of Birth & Age (>= 18)
    const dobIso = parseCivilServiceDate(row.dateOfBirth);
    if (!row.dateOfBirth.trim()) {
      addErr('Date of Birth (DD/MM/YYYY)*', 'Date of Birth is required.');
    } else if (!dobIso) {
      addErr('Date of Birth (DD/MM/YYYY)*', `Invalid Date of Birth "${row.dateOfBirth}". Expected DD/MM/YYYY.`);
    } else {
      const todayIso = new Date().toISOString().slice(0, 10);
      if (dobIso > todayIso) {
        addErr('Date of Birth (DD/MM/YYYY)*', 'Date of Birth cannot be in the future.');
      } else {
        const age = calculateAgeFromIso(dobIso);
        if (age < 18) {
          addErr('Date of Birth (DD/MM/YYYY)*', `Officer must be at least 18 years old (calculated age: ${age}).`);
        } else if (age > 65) {
          addWarn('Date of Birth (DD/MM/YYYY)*', `Officer age is ${age} years, which exceeds typical 60–65 service threshold.`);
        }
      }
    }

    // 4. Gender & Marital Status
    const gender = matchGender(row.gender);
    if (!row.gender.trim()) {
      addErr('Gender*', 'Gender is required (Male or Female).');
    } else if (!gender) {
      addErr('Gender*', `Invalid Gender "${row.gender}". Must be "Male" or "Female".`);
    }

    let maritalStatus: MaritalStatus = 'Single';
    if (row.maritalStatus.trim()) {
      const matchedMarital = matchMaritalStatus(row.maritalStatus);
      if (!matchedMarital) {
        addErr(
          'Marital Status',
          `Invalid Marital Status "${row.maritalStatus}". Must be Single, Married, Divorced, Widowed, or Separated.`
        );
      } else {
        maritalStatus = matchedMarital;
      }
    }

    // 5. Ghana Card (NIA), Telephone (+233) & Email
    const rawNin = row.nationalIdentificationNumber.trim();
    let normNin: string | undefined;
    if (rawNin) {
      const parsedNin = normalizeGhanaCard(rawNin);
      if (!parsedNin) {
        addErr(
          'Ghana Card (NIA)',
          `Invalid Ghana Card (NIA) format "${rawNin}". Expected GHA-XXXXXXXXX-X (e.g. GHA-718293041-9).`
        );
      } else {
        normNin = parsedNin;
      }
    }

    const normPhone = normalizeGhanaPhone(row.telephoneNumber);
    if (!row.telephoneNumber.trim()) {
      addErr('Telephone (+233)*', 'Telephone number is required.');
    } else if (!normPhone) {
      addErr(
        'Telephone (+233)*',
        `Invalid Ghana telephone number "${row.telephoneNumber}". Provide +233 followed by 9 digits or a 10-digit 0XX number.`
      );
    }

    const emailRaw = row.emailAddress.trim();
    if (emailRaw && !isValidEmail(emailRaw)) {
      addErr('Email', `Invalid email address format "${emailRaw}".`);
    }

    // Next of Kin Phone
    let normNokPhone = '';
    if (row.nextOfKinPhone.trim()) {
      const parsedNok = normalizeGhanaPhone(row.nextOfKinPhone);
      if (!parsedNok) {
        addErr(
          'Next of Kin Phone',
          `Invalid Next of Kin phone "${row.nextOfKinPhone}". Provide +233 or valid 10-digit Ghana number.`
        );
      } else {
        normNokPhone = parsedNok;
      }
    }

    // 6. Staff Categorization & Employment Type
    const category = matchEmployeeCategory(row.employeeCategory);
    if (!row.employeeCategory.trim()) {
      addErr('Staff Categorization*', 'Staff Categorization is required.');
    } else if (!category) {
      addErr(
        'Staff Categorization*',
        `Invalid Staff Categorization "${row.employeeCategory}". Allowed: Professional, Sub-Professional, Technical, Administrative, Consultant.`
      );
    }

    let empType: EmploymentType = 'Permanent & Pensionable';
    if (row.employmentType.trim()) {
      const matchedType = matchEmploymentType(row.employmentType);
      if (!matchedType) {
        addErr(
          'Employment Type',
          `Invalid Employment Type "${row.employmentType}". Allowed: Permanent & Pensionable, Fixed-Term Contract, Casual.`
        );
      } else {
        empType = matchedType;
      }
    }

    // 7. MDA & Department (must belong to MDA)
    const mdaRaw = row.mda.trim();
    const matchedMda = mdaRaw ? mdaByKey.get(mdaRaw.toLowerCase()) : undefined;
    if (!mdaRaw) {
      addErr('MDA*', 'Ministry / Agency (MDA) is required.');
    } else if (!matchedMda) {
      addErr('MDA*', `MDA "${mdaRaw}" does not match any active Ministry/Agency in master data.`);
    }

    const deptRaw = row.department.trim();
    let matchedDept: (typeof departments)[number] | undefined;
    if (!deptRaw) {
      addErr('Department*', 'Department / Directorate is required.');
    } else if (matchedMda) {
      const mdaDepts = departments.filter((d) => d.mdaId === matchedMda.id);
      matchedDept = mdaDepts.find(
        (d) =>
          d.departmentName.toLowerCase() === deptRaw.toLowerCase() ||
          d.departmentCode.toLowerCase() === deptRaw.toLowerCase() ||
          `${d.departmentCode} - ${d.departmentName}`.toLowerCase() === deptRaw.toLowerCase()
      );
      if (!matchedDept) {
        const otherDept = departments.find(
          (d) =>
            d.departmentName.toLowerCase() === deptRaw.toLowerCase() ||
            d.departmentCode.toLowerCase() === deptRaw.toLowerCase()
        );
        if (otherDept) {
          const ownerMda = mdas.find((m) => m.id === otherDept.mdaId);
          addErr(
            'Department*',
            `Department "${deptRaw}" belongs to ${ownerMda ? `${ownerMda.code} - ${ownerMda.name}` : 'another MDA'}, not ${matchedMda.code}.`
          );
        } else {
          addErr(
            'Department*',
            `Department "${deptRaw}" was not found under ${matchedMda.code} (${matchedMda.name}).`
          );
        }
      }
    } else {
      // MDA invalid, still check if department string exists anywhere
      const anyDept = departments.find(
        (d) =>
          d.departmentName.toLowerCase() === deptRaw.toLowerCase() ||
          d.departmentCode.toLowerCase() === deptRaw.toLowerCase()
      );
      if (!anyDept) {
        addErr('Department*', `Department "${deptRaw}" does not match any department in master data.`);
      }
    }

    // 8. Designation & Grade Scale
    const designation = row.designation.trim();
    if (!designation) {
      addErr('Designation*', 'Designation / Position Title is required.');
    }

    const gradeRaw = row.gradeScale.trim();
    const cleanedGradeKey = gradeRaw.replace(/^[a-z0-9]+\s*-\s*/i, '').toLowerCase();
    const matchedGrade = gradeRaw
      ? gradeByKey.get(gradeRaw.toLowerCase()) || gradeByKey.get(cleanedGradeKey)
      : undefined;
    if (!gradeRaw) {
      addErr('Grade Scale*', 'Civil Service Grade Scale is required.');
    } else if (!matchedGrade) {
      addErr(
        'Grade Scale*',
        `Grade Scale "${gradeRaw}" does not match any active Civil Service grade position title (e.g. "Assistant Director IIB").`
      );
    }

    // 9. First Appointment & Assumption of Duty
    const firstApptIso = parseCivilServiceDate(row.dateOfFirstAppointment);
    if (!row.dateOfFirstAppointment.trim()) {
      addErr('First Appointment (DD/MM/YYYY)*', 'First Appointment date is required.');
    } else if (!firstApptIso) {
      addErr(
        'First Appointment (DD/MM/YYYY)*',
        `Invalid First Appointment date "${row.dateOfFirstAppointment}". Expected DD/MM/YYYY.`
      );
    }

    const assumptionIso = parseCivilServiceDate(row.dateOfAssumptionOfDuty);
    if (!row.dateOfAssumptionOfDuty.trim()) {
      addErr('Assumption of Duty (DD/MM/YYYY)*', 'Assumption of Duty date is required.');
    } else if (!assumptionIso) {
      addErr(
        'Assumption of Duty (DD/MM/YYYY)*',
        `Invalid Assumption of Duty date "${row.dateOfAssumptionOfDuty}". Expected DD/MM/YYYY.`
      );
    }

    if (firstApptIso && assumptionIso && assumptionIso < firstApptIso) {
      addErr(
        'Assumption of Duty (DD/MM/YYYY)*',
        'Assumption of Duty date cannot be earlier than First Appointment date.'
      );
    }

    if (dobIso && firstApptIso) {
      const [dy] = dobIso.split('-').map(Number);
      const [ay] = firstApptIso.split('-').map(Number);
      if (ay - dy < 16) {
        addErr(
          'First Appointment (DD/MM/YYYY)*',
          'First Appointment date is unrealistically close to or before Date of Birth.'
        );
      }
    }

    // 10. Salary Level & Salary Step (1-10)
    let salaryLevel = matchedGrade ? matchedGrade.hierarchyRank : 1;
    if (row.salaryLevel.trim()) {
      const parsedLvl = Number(row.salaryLevel.trim());
      if (!Number.isFinite(parsedLvl) || parsedLvl < 1 || parsedLvl > 35) {
        addErr('Salary Level', `Invalid Salary Level "${row.salaryLevel}". Must be a number between 1 and 35.`);
      } else {
        salaryLevel = Math.round(parsedLvl);
      }
    }

    let salaryStep = 1;
    if (row.salaryStep.trim()) {
      const stepClean = row.salaryStep.trim().replace(/^step\s*/i, '');
      const parsedStep = Number(stepClean);
      if (!Number.isInteger(parsedStep) || parsedStep < 1 || parsedStep > 10) {
        addErr('Salary Step (1-10)', `Invalid Salary Step "${row.salaryStep}". Must be an integer from 1 to 10.`);
      } else {
        salaryStep = parsedStep;
      }
    }

    // 11. Qualification (level, title, institution, year)
    let qualLevel = 'Bachelor';
    if (row.qualificationLevel.trim()) {
      const matchedQualLvl = matchQualificationLevel(row.qualificationLevel);
      if (!matchedQualLvl) {
        addErr(
          'Qualification Level',
          `Invalid Qualification Level "${row.qualificationLevel}". Allowed: Bachelor, Master, Doctorate, HND, Diploma, WASSCE, Professional.`
        );
      } else {
        qualLevel = matchedQualLvl;
      }
    }

    let qualYear = currentYear;
    if (row.yearObtained.trim()) {
      const yNum = Number(row.yearObtained.trim());
      if (!Number.isInteger(yNum) || yNum < 1950 || yNum > currentYear) {
        addErr(
          'Year Obtained',
          `Invalid Year Obtained "${row.yearObtained}". Must be a valid year between 1950 and ${currentYear} (cannot be in the future).`
        );
      } else {
        qualYear = yNum;
      }
    }

    const hasQualDetails =
      row.qualificationTitle.trim().length > 0 ||
      row.qualificationInstitution.trim().length > 0 ||
      row.yearObtained.trim().length > 0;
    if (hasQualDetails && !row.qualificationTitle.trim()) {
      addErr(
        'Qualification Title',
        'Qualification Title is required when Awarding Institution or Year Obtained is provided.'
      );
    }

    // 12. Merge Capabilities, Skills & Memberships errors for this Staff ID
    const capBucket = normStaffId ? capabilitiesByStaff.get(normStaffId) : undefined;
    if (capBucket && capBucket.errors.length > 0) {
      capBucket.errors.forEach((e) => errors.push(e));
    }
    const skillBucket = normStaffId ? skillsByStaff.get(normStaffId) : undefined;
    if (skillBucket && skillBucket.errors.length > 0) {
      skillBucket.errors.forEach((e) => errors.push(e));
    }
    const memBucket = normStaffId ? membershipsByStaff.get(normStaffId) : undefined;
    if (memBucket && memBucket.errors.length > 0) {
      memBucket.errors.forEach((e) => errors.push(e));
    }

    // 13. Possible Duplicate Person Detection (Warning)
    if (normStaffId && !existingStaffIdSet.has(normStaffId)) {
      if (normPhone) {
        const dbMatch = existingPhoneMap.get(normPhone);
        const fileMatch = filePhoneMap.get(normPhone);
        if (dbMatch && dbMatch.toUpperCase() !== normStaffId) {
          addWarn(
            'Telephone (+233)*',
            `Possible duplicate person: phone ${normPhone} matches existing officer ${dbMatch} in database.`
          );
        } else if (fileMatch && fileMatch !== normStaffId) {
          addWarn(
            'Telephone (+233)*',
            `Possible duplicate person: phone ${normPhone} matches earlier row with Staff ID ${fileMatch} in this file.`
          );
        } else {
          filePhoneMap.set(normPhone, normStaffId);
        }
      }

      if (normNin) {
        const dbMatch = existingNinMap.get(normNin);
        const fileMatch = fileNinMap.get(normNin);
        if (dbMatch && dbMatch.toUpperCase() !== normStaffId) {
          addWarn(
            'Ghana Card (NIA)',
            `Possible duplicate person: Ghana Card ${normNin} matches existing officer ${dbMatch} in database.`
          );
        } else if (fileMatch && fileMatch !== normStaffId) {
          addWarn(
            'Ghana Card (NIA)',
            `Possible duplicate person: Ghana Card ${normNin} matches earlier row with Staff ID ${fileMatch} in this file.`
          );
        } else {
          fileNinMap.set(normNin, normStaffId);
        }
      }

      if (emailRaw && isValidEmail(emailRaw)) {
        const lowerEmail = emailRaw.toLowerCase();
        const dbMatch = existingEmailMap.get(lowerEmail);
        const fileMatch = fileEmailMap.get(lowerEmail);
        if (dbMatch && dbMatch.toUpperCase() !== normStaffId) {
          addWarn(
            'Email',
            `Possible duplicate person: email "${emailRaw}" matches existing officer ${dbMatch} in database.`
          );
        } else if (fileMatch && fileMatch !== normStaffId) {
          addWarn(
            'Email',
            `Possible duplicate person: email "${emailRaw}" matches earlier row with Staff ID ${fileMatch} in this file.`
          );
        } else {
          fileEmailMap.set(lowerEmail, normStaffId);
        }
      }

      if (surname && firstName && dobIso) {
        const personKey = `${surname.toLowerCase()}|${firstName.toLowerCase()}|${dobIso}`;
        const dbMatch = existingNameDobMap.get(personKey);
        const fileMatch = fileNameDobMap.get(personKey);
        if (dbMatch && dbMatch.toUpperCase() !== normStaffId) {
          addWarn(
            'Surname* / First Name* / DOB*',
            `Possible duplicate person: ${firstName} ${surname} (${row.dateOfBirth}) matches existing officer ${dbMatch} in database.`
          );
        } else if (fileMatch && fileMatch !== normStaffId) {
          addWarn(
            'Surname* / First Name* / DOB*',
            `Possible duplicate person: ${firstName} ${surname} (${row.dateOfBirth}) matches earlier row (${fileMatch}) in this file.`
          );
        } else {
          fileNameDobMap.set(personKey, normStaffId);
        }
      }
    }

    errors.forEach((e) => allIssues.push(e));
    warnings.forEach((w) => allIssues.push(w));

    const status = errors.length > 0 ? 'Error' : warnings.length > 0 ? 'Warning' : 'Valid';

    let normalized: NormalizedEmployeeRecord | undefined;
    if (
      errors.length === 0 &&
      normStaffId &&
      dobIso &&
      gender &&
      normPhone &&
      category &&
      matchedMda &&
      matchedDept &&
      matchedGrade &&
      firstApptIso &&
      assumptionIso
    ) {
      const fullName = [firstName, otherNames, surname].filter(Boolean).join(' ');
      const fallbackEmail = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${surname
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')}@civilservice.gov.gh`;
      const statutoryRetirementDate = computeStatutoryRetirementIso(dobIso, firstApptIso);
      const nokName = row.nextOfKinName.trim() || 'Not specified';

      normalized = {
        rowNumber: row.rowNumber,
        staffId: normStaffId,
        fullName,
        personal: {
          surname,
          firstName,
          otherNames: otherNames || undefined,
          dateOfBirth: dobIso,
          gender,
          maritalStatus,
          nationality: row.nationality.trim() || 'Ghanaian',
          nationalIdentificationNumber: normNin,
          residentialAddress: row.residentialAddress.trim() || 'Accra, Greater Accra',
          telephoneNumber: normPhone,
          emailAddress: emailRaw || fallbackEmail,
          emergencyContactName: row.nextOfKinName.trim() || 'Family Member',
          emergencyContactPhone: normNokPhone || normPhone,
          nextOfKinName: nokName,
          nextOfKinRelationship: row.nextOfKinRelationship.trim() || 'Spouse',
          nextOfKinPhone: normNokPhone || normPhone,
        },
        employment: {
          employeeCategory: category,
          employmentType: empType,
          dateOfFirstAppointment: firstApptIso,
          dateOfAssumptionOfDuty: assumptionIso,
          currentEmploymentStatus: 'Active',
          currentMdaId: matchedMda.id,
          mdaLabel: `${matchedMda.code} - ${matchedMda.name}`,
          currentDepartmentId: matchedDept.id,
          departmentLabel: matchedDept.departmentName,
          currentPositionTitle: designation,
          currentGradeId: matchedGrade.id,
          gradeLabel: matchedGrade.gradeName,
          currentSalaryLevel: salaryLevel,
          currentSalaryStep: salaryStep,
          dateAssignedCurrentRole: assumptionIso,
          dateAssignedCurrentGrade: firstApptIso,
          statutoryRetirementDate,
        },
        initialQualification: row.qualificationTitle.trim()
          ? {
              qualificationLevel: qualLevel,
              qualificationTitle: row.qualificationTitle.trim(),
              institutionName: row.qualificationInstitution.trim() || 'Accredited Institution',
              country: 'Ghana',
              courseOfStudy: row.qualificationTitle.trim(),
              yearObtained: qualYear,
              verificationStatus: 'Verified',
            }
          : undefined,
        memberships: memBucket?.items || [],
        trainingCapabilities: capBucket?.items || [],
        skills: skillBucket?.items || [],
      };
    }

    const displayName = [firstName, otherNames, surname].filter(Boolean).join(' ') || '(Unnamed)';

    validatedRows.push({
      rowNumber: row.rowNumber,
      staffId: normStaffId || '(Blank)',
      displayName,
      mdaDisplay: matchedMda ? `${matchedMda.code}` : row.mda || '—',
      departmentDisplay: matchedDept ? matchedDept.departmentName : row.department || '—',
      gradeDisplay: matchedGrade ? matchedGrade.gradeName : row.gradeScale || '—',
      status,
      errors,
      warnings,
      warningAction: 'skip', // Safe default for duplicate warnings
      rawRow: row,
      normalized,
    });

    if ((idx + 1) % 150 === 0) {
      onProgress?.(`Validated ${idx + 1} of ${parsed.employees.length} rows...`);
      await yieldToUi();
    }
  }

  const validCount = validatedRows.filter((r) => r.status === 'Valid').length;
  const warningCount = validatedRows.filter((r) => r.status === 'Warning').length;
  const errorCount = validatedRows.filter((r) => r.status === 'Error').length;

  return {
    rows: validatedRows,
    orphanIssues,
    allIssues,
    summary: {
      totalRows: validatedRows.length,
      validCount,
      warningCount,
      errorCount,
      capabilitiesCount: parsed.capabilities.length,
      skillsCount: parsed.skills.length,
      membershipsCount: parsed.memberships.length,
    },
  };
}
