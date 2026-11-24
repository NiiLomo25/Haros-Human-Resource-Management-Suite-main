import ExcelJS from 'exceljs';
import { db } from '../../db/storage';
import {
  SHEET_NAMES,
  EMPLOYEE_HEADERS,
  CAPABILITY_HEADERS,
  SKILL_HEADERS,
  MEMBERSHIP_HEADERS,
  ValidationReport,
  ImportResultSummary,
} from './types';
import { SKILL_CATEGORIES } from '../../components/staff/TrainingAndSkillsEditor';

export const MEMBERSHIP_STATUS_OPTIONS = ['Active', 'Lapsed', 'Suspended'] as const;

export const GENDER_OPTIONS = ['Male', 'Female'] as const;
export const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'] as const;
export const CADRE_OPTIONS = [
  'Professional',
  'Sub-Professional',
  'Technical',
  'Administrative',
  'Consultant',
] as const;
export const EMPLOYMENT_TYPE_OPTIONS = [
  'Permanent & Pensionable',
  'Fixed-Term Contract',
  'Casual',
] as const;
export const SALARY_STEP_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
export const QUALIFICATION_LEVEL_OPTIONS = [
  'Bachelor',
  'Master',
  'Doctorate',
  'HND',
  'Diploma',
  'WASSCE',
  'Professional',
] as const;

export function sanitizeExcelRangeName(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
}

function columnNumberToLetter(col: number): string {
  let temp = col;
  let letter = '';
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

function addSheetDataValidation(
  sheet: ExcelJS.Worksheet,
  sqref: string,
  validation: ExcelJS.DataValidation
): void {
  const internal = sheet as unknown as {
    dataValidations: { add: (address: string, rule: ExcelJS.DataValidation) => void };
  };
  internal.dataValidations.add(sqref, validation);
}

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function generateBulkRegistrationTemplate(): Promise<void> {
  const mdas = db.getMdas().filter((m) => m.isActive !== false);
  const departments = db.getDepartments().filter((d) => d.status !== 'Archived');
  const gradeLevels = db.getGradeLevels().filter((g) => g.isActive !== false);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Haros Civil Service HRMIS';
  workbook.created = new Date();
  workbook.modified = new Date();

  // -------------------------------------------------------------------------
  // 1. EMPLOYEES SHEET
  // -------------------------------------------------------------------------
  const empSheet = workbook.addWorksheet(SHEET_NAMES.EMPLOYEES, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const empWidths = [
    18, 18, 18, 16, 24, 12, 16, 15, 22, 20, 28, 30, 22, 20, 20,
    22, 24, 38, 36, 30, 38, 28, 28, 14, 18, 20, 32, 30, 14,
    34, 26, 28, 36,
  ];

  empSheet.columns = EMPLOYEE_HEADERS.map((header, idx) => ({
    header,
    key: `col_${idx}`,
    width: empWidths[idx] || 20,
  }));

  const empHeaderRow = empSheet.getRow(1);
  empHeaderRow.height = 28;
  empHeaderRow.eachCell((cell, colNumber) => {
    const headerText = String(EMPLOYEE_HEADERS[colNumber - 1] || '');
    const isRequired = headerText.endsWith('*');
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isRequired ? 'FF1E3A8A' : 'FF334155' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    };
  });

  // Format text & date columns on Employees sheet
  const MAX_TEMPLATE_ROWS = 1005;
  const textColIndices = [1, 9, 10, 15, 30, 33]; // Staff ID*, Ghana Card (NIA), Telephone*, Next of Kin Phone, Other Contact(s), Previous Posting
  const dateColIndices = [5, 22, 23, 32]; // DOB, First Appointment, Assumption of Duty, Current Promotion Date

  textColIndices.forEach((colIdx) => {
    const col = empSheet.getColumn(colIdx);
    col.numFmt = '@';
  });

  dateColIndices.forEach((colIdx) => {
    const col = empSheet.getColumn(colIdx);
    col.numFmt = 'dd/mm/yyyy';
  });

  // -------------------------------------------------------------------------
  // 2. TRAINING CAPABILITIES SHEET
  // -------------------------------------------------------------------------
  const capSheet = workbook.addWorksheet(SHEET_NAMES.CAPABILITIES, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  capSheet.columns = [
    { header: CAPABILITY_HEADERS[0], key: 'staffId', width: 22 },
    { header: CAPABILITY_HEADERS[1], key: 'capability', width: 65 },
  ];
  capSheet.getColumn(1).numFmt = '@';

  const capHeaderRow = capSheet.getRow(1);
  capHeaderRow.height = 26;
  capHeaderRow.eachCell((cell, colIdx) => {
    const isReq = String(CAPABILITY_HEADERS[colIdx - 1] || '').endsWith('*');
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isReq ? 'FF1E3A8A' : 'FF334155' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // -------------------------------------------------------------------------
  // 3. SKILLS SHEET
  // -------------------------------------------------------------------------
  const skillSheet = workbook.addWorksheet(SHEET_NAMES.SKILLS, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  skillSheet.columns = [
    { header: SKILL_HEADERS[0], key: 'staffId', width: 22 },
    { header: SKILL_HEADERS[1], key: 'skillName', width: 34 },
    { header: SKILL_HEADERS[2], key: 'category', width: 22 },
    { header: SKILL_HEADERS[3], key: 'evidence', width: 55 },
  ];
  skillSheet.getColumn(1).numFmt = '@';

  const skillHeaderRow = skillSheet.getRow(1);
  skillHeaderRow.height = 26;
  skillHeaderRow.eachCell((cell, colIdx) => {
    const isReq = String(SKILL_HEADERS[colIdx - 1] || '').endsWith('*');
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isReq ? 'FF1E3A8A' : 'FF334155' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // -------------------------------------------------------------------------
  // 4. PROFESSIONAL MEMBERSHIPS SHEET
  // -------------------------------------------------------------------------
  const memSheet = workbook.addWorksheet(SHEET_NAMES.MEMBERSHIPS, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  memSheet.columns = [
    { header: MEMBERSHIP_HEADERS[0], key: 'staffId', width: 22 },
    { header: MEMBERSHIP_HEADERS[1], key: 'professionalBody', width: 42 },
    { header: MEMBERSHIP_HEADERS[2], key: 'membershipNumber', width: 24 },
    { header: MEMBERSHIP_HEADERS[3], key: 'membershipCategory', width: 22 },
    { header: MEMBERSHIP_HEADERS[4], key: 'registrationDate', width: 28 },
    { header: MEMBERSHIP_HEADERS[5], key: 'expiryDate', width: 26 },
    { header: MEMBERSHIP_HEADERS[6], key: 'membershipStatus', width: 20 },
  ];
  memSheet.getColumn(1).numFmt = '@';
  memSheet.getColumn(3).numFmt = '@';
  memSheet.getColumn(5).numFmt = 'dd/mm/yyyy';
  memSheet.getColumn(6).numFmt = 'dd/mm/yyyy';

  const memHeaderRow = memSheet.getRow(1);
  memHeaderRow.height = 26;
  memHeaderRow.eachCell((cell, colIdx) => {
    const isReq = String(MEMBERSHIP_HEADERS[colIdx - 1] || '').endsWith('*');
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isReq ? 'FF1E3A8A' : 'FF334155' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // -------------------------------------------------------------------------
  // 5. LISTS SHEET (HIDDEN) WITH LIVE MASTER DATA & NAMED RANGES
  // -------------------------------------------------------------------------
  const listsSheet = workbook.addWorksheet(SHEET_NAMES.LISTS, {
    state: 'hidden',
  });

  const mdaLabels = mdas.map((m) => `${m.code} - ${m.name}`);
  const gradeLabels = gradeLevels.map((g) => g.gradeName);
  const skillCategoryLabels = SKILL_CATEGORIES.map((c) => c.value);

  const staticLists: { col: number; header: string; rangeName: string; values: readonly string[] | string[] }[] = [
    { col: 1, header: 'Gender', rangeName: 'GenderList', values: GENDER_OPTIONS },
    { col: 2, header: 'Marital Status', rangeName: 'MaritalStatusList', values: MARITAL_STATUS_OPTIONS },
    { col: 3, header: 'Staff Categorization', rangeName: 'CadreList', values: CADRE_OPTIONS },
    { col: 4, header: 'Employment Type', rangeName: 'EmploymentTypeList', values: EMPLOYMENT_TYPE_OPTIONS },
    { col: 5, header: 'MDA', rangeName: 'MdaList', values: mdaLabels },
    { col: 6, header: 'Grade Scale', rangeName: 'GradeList', values: gradeLabels },
    { col: 7, header: 'Salary Step', rangeName: 'SalaryStepList', values: SALARY_STEP_OPTIONS },
    { col: 8, header: 'Qualification Level', rangeName: 'QualificationLevelList', values: QUALIFICATION_LEVEL_OPTIONS },
    { col: 9, header: 'Skill Category', rangeName: 'SkillCategoryList', values: skillCategoryLabels },
    { col: 10, header: 'Membership Status', rangeName: 'MembershipStatusList', values: MEMBERSHIP_STATUS_OPTIONS },
  ];

  staticLists.forEach((list) => {
    const colLetter = columnNumberToLetter(list.col);
    listsSheet.getCell(1, list.col).value = list.header;
    listsSheet.getCell(1, list.col).font = { bold: true };
    list.values.forEach((val, idx) => {
      listsSheet.getCell(idx + 2, list.col).value = val;
    });
    if (list.values.length > 0) {
      const endRow = list.values.length + 1;
      workbook.definedNames.add(
        `'${SHEET_NAMES.LISTS}'!$${colLetter}$2:$${colLetter}$${endRow}`,
        list.rangeName
      );
    }
  });

  // Populate Department ranges per MDA starting at column 11 (K) for dependent dropdowns
  let nextDeptCol = 11;
  const allDeptNames: string[] = [];
  mdas.forEach((mda) => {
    const mdaDepts = departments.filter((d) => d.mdaId === mda.id);
    if (mdaDepts.length === 0) return;

    const rangeName = `DEPT_${sanitizeExcelRangeName(mda.code)}`;
    const colLetter = columnNumberToLetter(nextDeptCol);
    listsSheet.getCell(1, nextDeptCol).value = `${mda.code} Departments`;
    listsSheet.getCell(1, nextDeptCol).font = { bold: true };

    mdaDepts.forEach((d, idx) => {
      listsSheet.getCell(idx + 2, nextDeptCol).value = d.departmentName;
      allDeptNames.push(`${mda.code}: ${d.departmentName}`);
    });

    const endRow = mdaDepts.length + 1;
    workbook.definedNames.add(
      `'${SHEET_NAMES.LISTS}'!$${colLetter}$2:$${colLetter}$${endRow}`,
      rangeName
    );
    nextDeptCol++;
  });

  // Apply Excel Data Validations to Employees sheet (rows 2..MAX_TEMPLATE_ROWS)
  const rangeValidationMap: { colIdx: number; formula: string; title: string; prompt: string }[] = [
    { colIdx: 6, formula: '=GenderList', title: 'Gender', prompt: 'Select Male or Female' },
    { colIdx: 7, formula: '=MaritalStatusList', title: 'Marital Status', prompt: 'Select Marital Status' },
    { colIdx: 16, formula: '=CadreList', title: 'Staff Categorization', prompt: 'Select Civil Service Cadre' },
    { colIdx: 17, formula: '=EmploymentTypeList', title: 'Employment Type', prompt: 'Select Employment Type' },
    { colIdx: 18, formula: '=MdaList', title: 'MDA', prompt: 'Select Ministry / Agency (MDA)' },
    { colIdx: 21, formula: '=GradeList', title: 'Grade Scale', prompt: 'Select Civil Service Grade Scale' },
    { colIdx: 25, formula: '=SalaryStepList', title: 'Salary Step', prompt: 'Select Salary Step (1 to 10)' },
    { colIdx: 26, formula: '=QualificationLevelList', title: 'Qualification Level', prompt: 'Select Highest Qualification Level' },
    { colIdx: 31, formula: '=GradeList', title: 'First Grade', prompt: 'Select the officer\'s entry-grade Civil Service scale' },
  ];

  rangeValidationMap.forEach((rv) => {
    const colLetter = columnNumberToLetter(rv.colIdx);
    addSheetDataValidation(empSheet, `${colLetter}2:${colLetter}${MAX_TEMPLATE_ROWS}`, {
      type: 'list',
      allowBlank: true,
      formulae: [rv.formula],
      showInputMessage: true,
      promptTitle: rv.title,
      prompt: rv.prompt,
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: `Invalid ${rv.title}`,
      error: `Please select a valid value from the ${rv.title} dropdown.`,
    });
  });

  // Dependent Department dropdown using INDIRECT on MDA column (R = Col 18, S = Col 19)
  for (let r = 2; r <= MAX_TEMPLATE_ROWS; r++) {
    addSheetDataValidation(empSheet, `S${r}`, {
      type: 'list',
      allowBlank: true,
      formulae: [
        `=INDIRECT("DEPT_"&SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(UPPER(LEFT(R${r},FIND(" - ",R${r}&" - ")-1)),"-","_")," ","_"),".","_"),"&","_"))`,
      ],
      showInputMessage: true,
      promptTitle: 'Department',
      prompt: 'Select MDA first; dropdown shows departments belonging to that MDA.',
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Department Validation',
      error: 'Department must belong to the selected MDA.',
    });

    // Ensure text formatting on input cells so Excel preserves leading zeros & strings
    textColIndices.forEach((cIdx) => {
      empSheet.getCell(r, cIdx).numFmt = '@';
    });
  }

  // Skill Category validation on Skills sheet
  addSheetDataValidation(skillSheet, `C2:C${MAX_TEMPLATE_ROWS * 3}`, {
    type: 'list',
    allowBlank: true,
    formulae: ['=SkillCategoryList'],
    showInputMessage: true,
    promptTitle: 'Skill Category',
    prompt: 'Select one of the 8 approved skill categories.',
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Invalid Skill Category',
    error: 'Choose a valid category from the dropdown.',
  });

  // Membership Status validation on Professional Memberships sheet
  addSheetDataValidation(memSheet, `G2:G${MAX_TEMPLATE_ROWS * 3}`, {
    type: 'list',
    allowBlank: true,
    formulae: ['=MembershipStatusList'],
    showInputMessage: true,
    promptTitle: 'Membership Status',
    prompt: 'Select Active, Lapsed, or Suspended (defaults to Active).',
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Invalid Membership Status',
    error: 'Choose Active, Lapsed, or Suspended.',
  });

  // -------------------------------------------------------------------------
  // 5. INSTRUCTIONS SHEET
  // -------------------------------------------------------------------------
  const instSheet = workbook.addWorksheet(SHEET_NAMES.INSTRUCTIONS);
  instSheet.columns = [
    { width: 28 },
    { width: 32 },
    { width: 16 },
    { width: 58 },
  ];

  // Title
  instSheet.mergeCells('A1:D1');
  const titleCell = instSheet.getCell('A1');
  titleCell.value = 'HAROS CIVIL SERVICE HRMIS — BULK EMPLOYEE REGISTRATION TEMPLATE GUIDE';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  instSheet.getRow(1).height = 30;

  // Warning Banner
  instSheet.mergeCells('A2:D2');
  const warnCell = instSheet.getCell('A2');
  warnCell.value =
    'IMPORTANT: DO NOT rename worksheet tabs or modify column header names. Files with renamed sheets or headers will be rejected upon upload.';
  warnCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF991B1B' } };
  warnCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
  warnCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
  instSheet.getRow(2).height = 28;

  // Key Rules & Limits
  const rules = [
    ['1. Maximum Batch Size', 'Up to 1,000 employee rows per file upload for optimal browser performance.'],
    ['2. Staff ID Rule', 'Every employee must have a manually typed, unique Staff ID (Text format, e.g. OHCS-EMP-00999). Duplicates inside the file or already in the database will fail validation.'],
    ['3. Linking Across Sheets', 'To attach training capabilities, skills, or professional memberships to an employee, repeat the exact same Staff ID on the "Training Capabilities", "Skills", and "Professional Memberships" sheets.'],
    ['4. Capabilities, Skills & Memberships Limits', 'Maximum 10 Training Capabilities, 10 Skills, and 10 Professional Memberships per Staff ID. Duplicate entries for the same Staff ID are rejected.'],
    ['5. Date Format', 'Use DD/MM/YYYY (e.g. 15/06/1988). Employees must be at least 18 years old. Assumption of Duty cannot be earlier than First Appointment.'],
    ['6. Phone Numbers', 'Enter valid Ghana numbers (e.g. +233 24 412 8901 or 0244128901). Local 0XX numbers are automatically normalized to +233 during upload.'],
    ['7. MDA & Department', 'Select MDA first on the Employees sheet. Department must belong to the chosen MDA (validated against live system master data).'],
    ['8. Statutory Retirement', 'Calculated automatically on import as the earlier of 60 years of age or 35 years of service from First Appointment.'],
  ];

  instSheet.getCell('A4').value = 'GENERAL RULES & SYSTEM LIMITS';
  instSheet.getCell('A4').font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } };

  rules.forEach((rule, idx) => {
    const r = idx + 5;
    instSheet.getCell(r, 1).value = rule[0];
    instSheet.getCell(r, 1).font = { bold: true, size: 10 };
    instSheet.mergeCells(r, 2, r, 4);
    instSheet.getCell(r, 2).value = rule[1];
    instSheet.getCell(r, 2).font = { size: 10 };
    instSheet.getCell(r, 2).alignment = { wrapText: true };
    instSheet.getRow(r).height = 22;
  });

  // Example Section (with unique Staff ID OHCS-EMP-00999 repeated across sheets)
  let curRow = 14;
  instSheet.mergeCells(curRow, 1, curRow, 4);
  const exHeader = instSheet.getCell(curRow, 1);
  exHeader.value = 'LABELLED EXAMPLE ROW (DO NOT ENTER DATA HERE — COPY STRUCTURE TO THE DATA TABS)';
  exHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  exHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
  instSheet.getRow(curRow).height = 24;
  curRow++;

  const sampleEmpId = 'OHCS-EMP-00999';
  const sampleMda = mdaLabels[0] || 'OHCS - Office of the Head of Civil Service';
  const firstMdaDepts = departments.filter((d) => d.mdaId === mdas[0]?.id);
  const sampleDept = firstMdaDepts[0]?.departmentName || 'Human Resource Management Directorate';
  const sampleGrade = gradeLabels[4] || gradeLabels[0] || 'Assistant Director IIB';

  const exampleEmployeesPairs: [string, string][] = [
    ['Employees -> Staff ID*', sampleEmpId],
    ['Employees -> Surname*', 'Boateng'],
    ['Employees -> First Name*', 'Abena'],
    ['Employees -> Other Names', 'Serwaa'],
    ['Employees -> Date of Birth (DD/MM/YYYY)*', '15/06/1988'],
    ['Employees -> Gender*', 'Female'],
    ['Employees -> Marital Status', 'Married'],
    ['Employees -> Nationality', 'Ghanaian'],
    ['Employees -> Ghana Card (NIA)', 'GHA-718293041-9'],
    ['Employees -> Telephone (+233)*', '+233 24 555 0199'],
    ['Employees -> Email', 'abena.boateng@ohcs.gov.gh'],
    ['Employees -> Residential Address', 'No. 14 Liberation Road, Airport Residential, Accra'],
    ['Employees -> Next of Kin Name', 'Kwaku Boateng'],
    ['Employees -> Next of Kin Relationship', 'Spouse'],
    ['Employees -> Next of Kin Phone', '+233 20 555 0188'],
    ['Employees -> Staff Categorization*', 'Professional'],
    ['Employees -> Employment Type', 'Permanent & Pensionable'],
    ['Employees -> MDA*', sampleMda],
    ['Employees -> Department*', sampleDept],
    ['Employees -> Designation*', 'Senior Human Resource Officer'],
    ['Employees -> Grade Scale*', sampleGrade],
    ['Employees -> First Appointment (DD/MM/YYYY)*', '10/01/2022'],
    ['Employees -> Assumption of Duty (DD/MM/YYYY)*', '10/01/2022'],
    ['Employees -> Salary Level', '14'],
    ['Employees -> Salary Step (1-10)', '1'],
    ['Employees -> Qualification Level', 'Master'],
    ['Employees -> Qualification Title', 'MPA Public Sector Management'],
    ['Employees -> Awarding Institution', 'GIMPA'],
    ['Employees -> Year Obtained', '2020'],
    ['Employees -> Other Contact(s)', '+233 55 111 2233, +233 20 444 5566'],
    ['Employees -> First Grade (Entry Grade)', gradeLabels[0] || 'Assistant Director IIA'],
    ['Employees -> Current Promotion Date (DD/MM/YYYY)', '10/01/2022'],
    ['Employees -> Previous Posting', 'HR Research Unit, Ministry of Finance'],
    ['Training Capabilities -> Staff ID*', sampleEmpId],
    ['Training Capabilities -> Capability Description', 'Civil Service Establishment Quota & Post Control Auditing'],
    ['Skills -> Staff ID*', sampleEmpId],
    ['Skills -> Skill Name*', 'Human Resource Policy Analysis'],
    ['Skills -> Skill Category*', 'Professional'],
    ['Skills -> Evidence / Application of Skill', 'Led 2025 Scheme of Service harmonization review across 3 directorates.'],
    ['Professional Memberships -> Staff ID*', sampleEmpId],
    ['Professional Memberships -> Professional Body*', 'Institute of Human Resource Management Practitioners (IHRMP)'],
    ['Professional Memberships -> Membership Number*', 'IHRMP-GH-2041'],
    ['Professional Memberships -> Category', 'Chartered Member'],
    ['Professional Memberships -> Registration Date (DD/MM/YYYY)', '15/01/2018'],
    ['Professional Memberships -> Expiry Date (DD/MM/YYYY)', '31/12/2027'],
    ['Professional Memberships -> Membership Status', 'Active'],
  ];

  exampleEmployeesPairs.forEach(([field, exVal]) => {
    instSheet.getCell(curRow, 1).value = 'EXAMPLE';
    instSheet.getCell(curRow, 1).font = { bold: true, size: 9, color: { argb: 'FF047857' } };
    instSheet.getCell(curRow, 2).value = field;
    instSheet.getCell(curRow, 2).font = { bold: true, size: 10 };
    instSheet.mergeCells(curRow, 3, curRow, 4);
    instSheet.getCell(curRow, 3).value = exVal;
    instSheet.getCell(curRow, 3).font = { size: 10, color: { argb: 'FF1E293B' } };
    instSheet.getCell(curRow, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
    curRow++;
  });

  // Column Reference Guide
  curRow += 2;
  instSheet.getCell(curRow, 1).value = 'SHEET & COLUMN SPECIFICATION GUIDE';
  instSheet.getCell(curRow, 1).font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } };
  curRow++;

  const guideHeaders = ['Worksheet', 'Column Header', 'Required?', 'Format & Accepted Values'];
  guideHeaders.forEach((h, i) => {
    const c = instSheet.getCell(curRow, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  });
  curRow++;

  const guideRows: [string, string, string, string][] = [
    ['Employees', 'Staff ID*', 'Required', 'Unique uppercase alphanumeric/hyphen code (Text). Never auto-generated.'],
    ['Employees', 'Surname* / First Name*', 'Required', 'Officer legal surname and first name.'],
    ['Employees', 'Other Names', 'Optional', 'Middle or other given names.'],
    ['Employees', 'Date of Birth (DD/MM/YYYY)*', 'Required', 'DD/MM/YYYY format. Must be at least 18 years old.'],
    ['Employees', 'Gender*', 'Required', 'Dropdown: Male, Female'],
    ['Employees', 'Marital Status', 'Optional', 'Dropdown: Single, Married, Divorced, Widowed, Separated'],
    ['Employees', 'Nationality', 'Optional', 'Defaults to Ghanaian if left blank.'],
    ['Employees', 'Ghana Card (NIA)', 'Optional', 'NIA Ghana Card number in GHA-XXXXXXXXX-X format (e.g. GHA-718293041-9).'],
    ['Employees', 'Telephone (+233)*', 'Required', 'Ghana number (+233XXXXXXXXX or 0XXXXXXXXX). Auto-normalized to +233.'],
    ['Employees', 'Email', 'Optional', 'Valid email format (e.g. name@civilservice.gov.gh).'],
    ['Employees', 'Residential Address', 'Optional', 'Current residential address.'],
    ['Employees', 'Next of Kin (Name / Rel / Phone)', 'Optional', 'Next of kin full name, relationship, and +233 phone.'],
    ['Employees', 'Staff Categorization*', 'Required', 'Dropdown: Professional, Sub-Professional, Technical, Administrative, Consultant'],
    ['Employees', 'Employment Type', 'Optional', 'Dropdown: Permanent & Pensionable, Fixed-Term Contract, Casual'],
    ['Employees', 'MDA*', 'Required', 'Dropdown populated from live MDAs in system.'],
    ['Employees', 'Department*', 'Required', 'Dependent dropdown; department must belong to selected MDA.'],
    ['Employees', 'Designation*', 'Required', 'Role / position title (e.g. Senior Human Resource Officer).'],
    ['Employees', 'Grade Scale*', 'Required', 'Dropdown populated from live Civil Service Grade Levels.'],
    ['Employees', 'First Appointment (DD/MM/YYYY)*', 'Required', 'DD/MM/YYYY format. Used for statutory 35-year service computation.'],
    ['Employees', 'Assumption of Duty (DD/MM/YYYY)*', 'Required', 'DD/MM/YYYY format. Cannot be before First Appointment.'],
    ['Employees', 'Salary Level', 'Optional', 'Numeric rank; defaults to selected Grade Scale rank if blank.'],
    ['Employees', 'Salary Step (1-10)', 'Optional', 'Dropdown 1–10 (defaults to 1 if blank).'],
    ['Employees', 'Qualification (Level, Title, Institution, Year)', 'Optional', 'Year Obtained must be a 4-digit year not in the future.'],
    ['Employees', 'Other Contact(s)', 'Optional', 'Additional Ghana phone numbers separated by comma, semicolon, slash, pipe or new line. Auto-normalized to +233.'],
    ['Employees', 'First Grade (Entry Grade)', 'Optional', 'Dropdown populated from live Civil Service Grade Levels (entry grade at appointment).'],
    ['Employees', 'Current Promotion Date (DD/MM/YYYY)', 'Optional', 'DD/MM/YYYY format. Cannot be in the future or before First Appointment.'],
    ['Employees', 'Previous Posting', 'Optional', 'Free text describing the officer\'s prior posting before current placement.'],
    ['Training Capabilities', 'Staff ID* / Capability Description', 'Optional Sheet', 'Repeat Staff ID (max 10 rows per officer). Staff ID must exist on Employees sheet.'],
    ['Skills', 'Staff ID* / Skill Name* / Skill Category* / Evidence', 'Optional Sheet', 'Repeat Staff ID (max 10 rows per officer). Category from 8 approved values.'],
    ['Professional Memberships', 'Staff ID* / Professional Body* / Membership Number* / Category / Dates / Status', 'Optional Sheet', 'Repeat Staff ID (max 10 rows per officer). Status: Active, Lapsed, or Suspended.'],
  ];

  guideRows.forEach((gr) => {
    gr.forEach((val, i) => {
      const c = instSheet.getCell(curRow, i + 1);
      c.value = val;
      c.font = { size: 10, bold: i === 2 && val === 'Required' };
      c.alignment = { wrapText: true, vertical: 'top' };
    });
    instSheet.getRow(curRow).height = 20;
    curRow++;
  });

  // Also append MDA -> Department Reference table at bottom of Instructions for quick lookup
  curRow += 2;
  instSheet.getCell(curRow, 1).value = 'LIVE MDA & DEPARTMENT DIRECTORY (FOR REFERENCE)';
  instSheet.getCell(curRow, 1).font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' } };
  curRow++;
  ['MDA Code', 'MDA Name', 'Dept Code', 'Department Name'].forEach((h, i) => {
    const c = instSheet.getCell(curRow, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
  });
  curRow++;
  mdas.forEach((mda) => {
    const mDepts = departments.filter((d) => d.mdaId === mda.id);
    if (mDepts.length === 0) {
      instSheet.getCell(curRow, 1).value = mda.code;
      instSheet.getCell(curRow, 2).value = mda.name;
      instSheet.getCell(curRow, 3).value = '-';
      instSheet.getCell(curRow, 4).value = '(No active departments configured — add one in Organization view first)';
      curRow++;
    } else {
      mDepts.forEach((d) => {
        instSheet.getCell(curRow, 1).value = mda.code;
        instSheet.getCell(curRow, 2).value = mda.name;
        instSheet.getCell(curRow, 3).value = d.departmentCode;
        instSheet.getCell(curRow, 4).value = d.departmentName;
        curRow++;
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer as ArrayBuffer, 'Employee_Bulk_Registration_Template.xlsx');
}

export async function generateErrorReportXlsx(report: ValidationReport): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Haros Civil Service HRMIS';

  // Sheet 1: Failed Employee Rows + Error Reason column
  const failedSheet = workbook.addWorksheet('Failed Employee Rows', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headers = [...EMPLOYEE_HEADERS, 'Row Number', 'Error Reason'];
  failedSheet.columns = headers.map((h) => ({
    header: h,
    width: h === 'Error Reason' ? 55 : 22,
  }));

  const hRow = failedSheet.getRow(1);
  hRow.height = 26;
  hRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const errorRows = report.rows.filter((r) => r.errors.length > 0);
  errorRows.forEach((row) => {
    const reasons = row.errors.map((e) => `[${e.sheet} • ${e.column}] ${e.message}`).join(' | ');
    const values = [
      ...EMPLOYEE_HEADERS.map((h) => row.rawRow.rawValues[h] ?? ''),
      row.rowNumber,
      reasons,
    ];
    const added = failedSheet.addRow(values);
    added.getCell(headers.length).font = { color: { argb: 'FF991B1B' }, bold: true };
  });

  // Sheet 2: Complete Validation Issues Ledger (includes Training Capabilities & Skills sheet errors)
  const issueSheet = workbook.addWorksheet('All Validation Issues', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  issueSheet.columns = [
    { header: 'Severity', width: 12 },
    { header: 'Sheet', width: 24 },
    { header: 'Row #', width: 10 },
    { header: 'Staff ID', width: 20 },
    { header: 'Column', width: 28 },
    { header: 'Plain-English Reason', width: 65 },
  ];
  const iHeader = issueSheet.getRow(1);
  iHeader.height = 24;
  iHeader.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  });

  report.allIssues.forEach((iss) => {
    const r = issueSheet.addRow([
      iss.severity.toUpperCase(),
      iss.sheet,
      iss.rowNumber,
      iss.staffId || '(Blank)',
      iss.column,
      iss.message,
    ]);
    r.getCell(1).font = {
      bold: true,
      color: { argb: iss.severity === 'error' ? 'FF991B1B' : 'FF92400E' },
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerDownload(buffer as ArrayBuffer, `Employee_Bulk_Errors_${dateStr}.xlsx`);
}

export async function generateImportReportXlsx(result: ImportResultSummary): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Haros Civil Service HRMIS';

  const sheet = workbook.addWorksheet('Bulk Import Report', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Staff ID', width: 22 },
    { header: 'Full Name', width: 32 },
    { header: 'Result', width: 16 },
    { header: 'Reason', width: 65 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  result.outcomes.forEach((item) => {
    const r = sheet.addRow([item.staffId, item.fullName, item.result, item.reason]);
    const color =
      item.result === 'Imported'
        ? 'FF047857'
        : item.result === 'Skipped'
        ? 'FF92400E'
        : 'FF991B1B';
    r.getCell(3).font = { bold: true, color: { argb: color } };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerDownload(buffer as ArrayBuffer, `Employee_Bulk_Import_Report_${dateStr}.xlsx`);
}
