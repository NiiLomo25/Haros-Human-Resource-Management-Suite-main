import ExcelJS from 'exceljs';
import {
  SHEET_NAMES,
  EMPLOYEE_HEADERS,
  CAPABILITY_HEADERS,
  SKILL_HEADERS,
  MEMBERSHIP_HEADERS,
  ORG_HEADERS,
  ParsedWorkbookData,
  RawEmployeeRow,
  RawCapabilityRow,
  RawSkillRow,
  RawMembershipRow,
  RawOrgRow,
} from './types';

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function formatUtcDateDdMmYyyy(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function extractCellString(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (val === null || val === undefined) return '';

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return formatUtcDateDdMmYyyy(val);
  }

  if (typeof val === 'string') {
    return val.trim();
  }

  if (typeof val === 'number') {
    return String(val).trim();
  }

  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }

  if (typeof val === 'object') {
    // Formula cell
    if ('result' in val) {
      const res = (val as { result?: unknown }).result;
      if (res instanceof Date && !isNaN(res.getTime())) {
        return formatUtcDateDdMmYyyy(res);
      }
      if (res !== null && res !== undefined) {
        return String(res).trim();
      }
      return '';
    }
    // Rich text cell
    if ('richText' in val && Array.isArray((val as { richText?: unknown[] }).richText)) {
      return (val as { richText: { text?: string }[] }).richText
        .map((rt) => rt.text || '')
        .join('')
        .trim();
    }
    // Hyperlink cell (e.g. email auto-converted to mailto hyperlink by Excel)
    if ('text' in val) {
      const txt = (val as { text?: unknown }).text;
      if (typeof txt === 'string') return txt.trim();
      if (txt && typeof txt === 'object' && 'richText' in txt) {
        return ((txt as { richText: { text?: string }[] }).richText || [])
          .map((rt) => rt.text || '')
          .join('')
          .trim();
      }
    }
    // Error cell
    if ('error' in val) {
      return '';
    }
  }

  return String(val).trim();
}

const LEGACY_EMPLOYEE_HEADERS_29 = EMPLOYEE_HEADERS.slice(0, 29);
const LEGACY_EMPLOYEE_HEADERS_28 = LEGACY_EMPLOYEE_HEADERS_29.filter(
  (h) => h !== 'Ghana Card (NIA)'
);

function validateSheetHeaders(
  sheet: ExcelJS.Worksheet,
  expectedHeaders: readonly string[],
  sheetLabel: string,
  alternateHeadersList?: (readonly string[])[]
): readonly string[] {
  const row1 = sheet.getRow(1);
  // Header matching ignores the trailing '*' required-field marker so that
  // templates downloaded before the mandatory/optional columns changed
  // (e.g. "Telephone (+233)*" vs "Telephone (+233)") still validate.
  const stripMarker = (h: string) => h.replace(/\*+\s*$/, '').trim();
  const matchesHeaderList = (list: readonly string[]): number => {
    for (let i = 0; i < list.length; i++) {
      const actual = extractCellString(row1.getCell(i + 1));
      if (stripMarker(actual) !== stripMarker(list[i])) return i;
    }
    return -1;
  };

  const primaryMismatch = matchesHeaderList(expectedHeaders);
  if (primaryMismatch === -1) return expectedHeaders;

  if (alternateHeadersList) {
    for (const alt of alternateHeadersList) {
      if (matchesHeaderList(alt) === -1) return alt;
    }
  }

  const actual = extractCellString(row1.getCell(primaryMismatch + 1));
  const expected = expectedHeaders[primaryMismatch];
  throw new Error(
    `Header mismatch in "${sheetLabel}" sheet at column ${primaryMismatch + 1}: expected "${expected}", found "${actual || '(blank)'}". Please use the unmodified Bulk Registration Template.`
  );
}

export async function parseBulkRegistrationFile(
  file: File,
  onProgress?: (message: string) => void
): Promise<ParsedWorkbookData> {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.xlsx')) {
    throw new Error('Invalid file format. Only .xlsx Excel workbooks are accepted.');
  }

  onProgress?.('Reading Excel workbook...');
  const arrayBuffer = await file.arrayBuffer();

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(arrayBuffer);
  } catch {
    throw new Error(
      'Unable to parse workbook. The file appears corrupted or is not a valid .xlsx Excel file.'
    );
  }

  const empSheet = workbook.getWorksheet(SHEET_NAMES.EMPLOYEES);
  const capSheet = workbook.getWorksheet(SHEET_NAMES.CAPABILITIES);
  const skillSheet = workbook.getWorksheet(SHEET_NAMES.SKILLS);
  const memSheet = workbook.getWorksheet(SHEET_NAMES.MEMBERSHIPS);
  const orgSheet = workbook.getWorksheet(SHEET_NAMES.ORGS);

  if (!empSheet) {
    throw new Error(
      `Missing required worksheet "${SHEET_NAMES.EMPLOYEES}". Do not rename sheets in the template.`
    );
  }
  if (!capSheet) {
    throw new Error(
      `Missing required worksheet "${SHEET_NAMES.CAPABILITIES}". Do not rename sheets in the template.`
    );
  }
  if (!skillSheet) {
    throw new Error(
      `Missing required worksheet "${SHEET_NAMES.SKILLS}". Do not rename sheets in the template.`
    );
  }

  const activeEmployeeHeaders = validateSheetHeaders(
    empSheet,
    EMPLOYEE_HEADERS,
    SHEET_NAMES.EMPLOYEES,
    [LEGACY_EMPLOYEE_HEADERS_29, LEGACY_EMPLOYEE_HEADERS_28]
  );
  validateSheetHeaders(capSheet, CAPABILITY_HEADERS, SHEET_NAMES.CAPABILITIES);
  validateSheetHeaders(skillSheet, SKILL_HEADERS, SHEET_NAMES.SKILLS);
  if (memSheet) {
    validateSheetHeaders(memSheet, MEMBERSHIP_HEADERS, SHEET_NAMES.MEMBERSHIPS);
  }
  // "MDA & Departments" is an optional worksheet — only validated when present
  if (orgSheet) {
    validateSheetHeaders(orgSheet, ORG_HEADERS, SHEET_NAMES.ORGS);
  }

  // Parse Employees Sheet
  onProgress?.('Extracting employee rows...');
  const employees: RawEmployeeRow[] = [];
  const empRowCount = empSheet.rowCount;

  for (let r = 2; r <= empRowCount; r++) {
    const row = empSheet.getRow(r);
    const rawValues: Record<string, string> = {};
    let hasAnyValue = false;

    for (let c = 1; c <= activeEmployeeHeaders.length; c++) {
      const val = extractCellString(row.getCell(c));
      rawValues[activeEmployeeHeaders[c - 1]] = val;
      if (val.length > 0) hasAnyValue = true;
    }

    if (!hasAnyValue) continue;

    employees.push({
      rowNumber: r,
      rawValues,
      staffId: rawValues['Staff ID*'] || '',
      surname: rawValues['Surname*'] || '',
      firstName: rawValues['First Name*'] || '',
      otherNames: rawValues['Other Names'] || '',
      dateOfBirth: rawValues['Date of Birth (DD/MM/YYYY)*'] || '',
      gender: rawValues['Gender*'] || '',
      maritalStatus: rawValues['Marital Status'] || '',
      nationality: rawValues['Nationality'] || '',
      nationalIdentificationNumber: rawValues['Ghana Card (NIA)'] || '',
      telephoneNumber: rawValues['Telephone (+233)'] || '',
      emailAddress: rawValues['Email'] || '',
      residentialAddress: rawValues['Residential Address'] || '',
      nextOfKinName: rawValues['Next of Kin Name'] || '',
      nextOfKinRelationship: rawValues['Next of Kin Relationship'] || '',
      nextOfKinPhone: rawValues['Next of Kin Phone'] || '',
      employeeCategory: rawValues['Staff Categorization*'] || '',
      employmentType: rawValues['Employment Type*'] || '',
      mda: rawValues['MDA*'] || '',
      department: rawValues['Department*'] || '',
      designation: rawValues['Designation*'] || '',
      gradeScale: rawValues['Grade Scale*'] || '',
      dateOfFirstAppointment: rawValues['First Appointment (DD/MM/YYYY)*'] || '',
      dateOfAssumptionOfDuty: rawValues['Assumption of Duty (DD/MM/YYYY)'] || '',
      salaryLevel: rawValues['Salary Level'] || '',
      salaryStep: rawValues['Salary Step (1-10)'] || '',
      qualificationLevel: rawValues['Qualification Level'] || '',
      qualificationTitle: rawValues['Qualification Title'] || '',
      qualificationInstitution: rawValues['Awarding Institution'] || '',
      yearObtained: rawValues['Year Obtained'] || '',
      otherContact: rawValues['Other Contact(s)'] || '',
      firstGrade: rawValues['First Grade (Entry Grade)'] || '',
      currentPromotionDate: rawValues['Current Promotion Date (DD/MM/YYYY)'] || '',
      previousPosting: rawValues['Previous Posting'] || '',
    });

    if (employees.length % 200 === 0) {
      onProgress?.(`Parsed ${employees.length} employee rows...`);
      await yieldToUi();
    }
  }

  if (employees.length === 0) {
    throw new Error(
      'The "Employees" sheet contains no employee data rows. Add at least one employee record below row 1.'
    );
  }

  if (employees.length > 1000) {
    throw new Error(
      `File contains ${employees.length} employee rows, exceeding the 1,000-row batch limit. Please split into batches of up to 1,000 rows.`
    );
  }

  // Parse Training Capabilities Sheet
  onProgress?.('Extracting training capabilities...');
  const capabilities: RawCapabilityRow[] = [];
  const capRowCount = capSheet.rowCount;
  for (let r = 2; r <= capRowCount; r++) {
    const row = capSheet.getRow(r);
    const staffId = extractCellString(row.getCell(1));
    const capability = extractCellString(row.getCell(2));
    if (!staffId && !capability) continue;

    capabilities.push({
      rowNumber: r,
      staffId,
      capability,
    });

    if (r % 400 === 0) {
      await yieldToUi();
    }
  }

  // Parse Skills Sheet
  onProgress?.('Extracting staff skills...');
  const skills: RawSkillRow[] = [];
  const skillRowCount = skillSheet.rowCount;
  for (let r = 2; r <= skillRowCount; r++) {
    const row = skillSheet.getRow(r);
    const staffId = extractCellString(row.getCell(1));
    const skillName = extractCellString(row.getCell(2));
    const category = extractCellString(row.getCell(3));
    const evidence = extractCellString(row.getCell(4));
    if (!staffId && !skillName && !category && !evidence) continue;

    skills.push({
      rowNumber: r,
      staffId,
      skillName,
      category,
      evidence,
    });

    if (r % 400 === 0) {
      await yieldToUi();
    }
  }

  // Parse Professional Memberships Sheet (optional for backward compatibility with older templates)
  const memberships: RawMembershipRow[] = [];
  if (memSheet) {
    onProgress?.('Extracting professional memberships...');
    const memRowCount = memSheet.rowCount;
    for (let r = 2; r <= memRowCount; r++) {
      const row = memSheet.getRow(r);
      const staffId = extractCellString(row.getCell(1));
      const professionalBody = extractCellString(row.getCell(2));
      const membershipNumber = extractCellString(row.getCell(3));
      const membershipCategory = extractCellString(row.getCell(4));
      const registrationDate = extractCellString(row.getCell(5));
      const expiryDate = extractCellString(row.getCell(6));
      const membershipStatus = extractCellString(row.getCell(7));

      if (
        !staffId &&
        !professionalBody &&
        !membershipNumber &&
        !membershipCategory &&
        !registrationDate &&
        !expiryDate &&
        !membershipStatus
      ) {
        continue;
      }

      memberships.push({
        rowNumber: r,
        staffId,
        professionalBody,
        membershipNumber,
        membershipCategory,
        registrationDate,
        expiryDate,
        membershipStatus,
      });

      if (r % 400 === 0) {
        await yieldToUi();
      }
    }
  }

  // Parse optional MDA & Departments worksheet
  const orgs: RawOrgRow[] = [];
  if (orgSheet) {
    onProgress?.('Extracting MDA & Department registrations...');
    const orgRowCount = orgSheet.rowCount;
    for (let r = 2; r <= orgRowCount; r++) {
      const row = orgSheet.getRow(r);
      const mdaCode = extractCellString(row.getCell(1));
      const mdaName = extractCellString(row.getCell(2));
      const mdaType = extractCellString(row.getCell(3));
      const departmentCode = extractCellString(row.getCell(4));
      const departmentName = extractCellString(row.getCell(5));
      if (!mdaCode && !mdaName && !departmentCode && !departmentName) continue;

      orgs.push({ rowNumber: r, mdaCode, mdaName, mdaType, departmentCode, departmentName });

      if (r % 400 === 0) await yieldToUi();
    }
  }

  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    employees,
    capabilities,
    skills,
    memberships,
    orgs,
  };
}
