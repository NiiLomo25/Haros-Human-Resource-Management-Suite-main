/**
 * Node/tsx verification for the new bulk-registration & employee fields:
 * otherContacts, firstGradeId, currentPromotionDate, previousPosting.
 * Uses an in-memory localStorage shim — no production database touched.
 */
import ExcelJS from 'exceljs';

// --- Browser shims (must exist before storage.ts module side-effects run) ---
const mem = new Map<string, string>();
const localStorageShim = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
};
(globalThis as any).localStorage = localStorageShim;
(globalThis as any).window = {
  dispatchEvent: () => true,
  hrmisDesktop: undefined,
};
(globalThis as any).CustomEvent = class CustomEvent {
  constructor(public type: string, public init?: any) {}
};

const { db } = await import('../src/db/storage');
const { parseBulkRegistrationFile } = await import('../src/services/bulkRegistration/parser');
const {
  validateParsedWorkbook,
  normalizeGhanaPhone,
  parseCivilServiceDate,
} = await import('../src/services/bulkRegistration/validator');
const { executeBulkImport } = await import('../src/services/bulkRegistration/importer');
const {
  EMPLOYEE_HEADERS,
  SHEET_NAMES,
  CAPABILITY_HEADERS,
  SKILL_HEADERS,
  MEMBERSHIP_HEADERS,
} = await import('../src/services/bulkRegistration/types');

localStorage.setItem('haros_current_user', 'admin');

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

// ---------- helpers ----------
const mdas = db.getMdas().filter((m: any) => m.isActive !== false);
const mda = mdas[0];
const dept = db.getDepartments().find((d: any) => d.mdaId === mda.id && d.status !== 'Archived')!;
const grades = db.getGradeLevels().filter((g: any) => g.isActive !== false);
const grade = grades[grades.length - 1]; // highest grade for "current"
const firstGrade = grades[0];

console.log(`Fixture: MDA=${mda.code}, Dept=${dept.departmentName}, Grade=${grade.gradeName}, FirstGrade=${firstGrade.gradeName}`);

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  const row: Record<string, string> = {
    'Staff ID*': 'TST-EMP-90001',
    'Surname*': 'Testperson',
    'First Name*': 'Ama',
    'Other Names': 'Serwaa',
    'Date of Birth (DD/MM/YYYY)*': '15/06/1988',
    'Gender*': 'Female',
    'Marital Status': 'Married',
    'Nationality': 'Ghanaian',
    'Ghana Card (NIA)': 'GHA-799988877-6',
    'Telephone (+233)': '0551234567',
    'Email': 'ama.testperson@civilservice.gov.gh',
    'Residential Address': 'Accra',
    'Next of Kin Name': 'Kofi Testperson',
    'Next of Kin Relationship': 'Spouse',
    'Next of Kin Phone': '0201112233',
    'Staff Categorization*': 'Professional',
    'Employment Type*': 'Permanent & Pensionable',
    'MDA*': `${mda.code} - ${mda.name}`,
    'Department*': dept.departmentName,
    'Designation*': 'Senior HR Officer',
    'Grade Scale*': grade.gradeName,
    'First Appointment (DD/MM/YYYY)*': '10/01/2015',
    'Assumption of Duty (DD/MM/YYYY)': '10/01/2015',
    'Salary Level': '',
    'Salary Step (1-10)': '1',
    'Qualification Level': '',
    'Qualification Title': '',
    'Awarding Institution': '',
    'Year Obtained': '',
  };
  return { ...row, ...overrides };
}

async function buildWorkbook(headerList: readonly string[], rows: Record<string, string>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const emp = wb.addWorksheet(SHEET_NAMES.EMPLOYEES);
  emp.columns = headerList.map((h, i) => ({ header: h, key: `c${i}`, width: 18 }));
  rows.forEach((r) => {
    emp.addRow(headerList.map((h) => r[h] ?? ''));
  });
  const cap = wb.addWorksheet(SHEET_NAMES.CAPABILITIES);
  cap.columns = CAPABILITY_HEADERS.map((h, i) => ({ header: h, key: `c${i}` }));
  const sk = wb.addWorksheet(SHEET_NAMES.SKILLS);
  sk.columns = SKILL_HEADERS.map((h, i) => ({ header: h, key: `c${i}` }));
  const mem = wb.addWorksheet(SHEET_NAMES.MEMBERSHIPS);
  mem.columns = MEMBERSHIP_HEADERS.map((h, i) => ({ header: h, key: `c${i}` }));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

async function parseBuf(buf: Buffer, name: string) {
  const fakeFile = {
    name,
    size: buf.length,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as File;
  return parseBulkRegistrationFile(fakeFile);
}

// ---------- 1. Template header sanity ----------
console.log('\n[1] EMPLOYEE_HEADERS shape');
check('EMPLOYEE_HEADERS has 33 columns', EMPLOYEE_HEADERS.length === 33, `got ${EMPLOYEE_HEADERS.length}`);
check('col30 = Other Contact(s)', EMPLOYEE_HEADERS[29] === 'Other Contact(s)');
check('col31 = First Grade', EMPLOYEE_HEADERS[30] === 'First Grade (Entry Grade)');
check('col32 = Promotion Date', EMPLOYEE_HEADERS[31] === 'Current Promotion Date (DD/MM/YYYY)');
check('col33 = Previous Posting', EMPLOYEE_HEADERS[32] === 'Previous Posting');

// ---------- 2. Phone normalization unit checks ----------
console.log('\n[2] normalizeGhanaPhone');
check('local 0XX -> +233', normalizeGhanaPhone('0244128901') === '+233 24 412 8901');
check('intl +233', normalizeGhanaPhone('+233244128901') === '+233 24 412 8901');
check('invalid rejected', normalizeGhanaPhone('abc') === null);
check('date parse DD/MM/YYYY', parseCivilServiceDate('15/06/1988') === '1988-06-15');

// ---------- 3. Parse + validate 33-column template ----------
console.log('\n[3] 33-column parse & validate');
const row33 = {
  ...baseRow(),
  'Other Contact(s)': '0551112233; 0204445566 / +233 27 999 8877',
  'First Grade (Entry Grade)': firstGrade.gradeName,
  'Current Promotion Date (DD/MM/YYYY)': '01/07/2020',
  'Previous Posting': 'HR Research Unit, Ministry of Finance',
};
const wb33 = await buildWorkbook(EMPLOYEE_HEADERS, [row33]);
const parsed33 = await parseBuf(wb33, 'bulk33.xlsx');
check('33-col row parsed', parsed33.employees.length === 1);
check('otherContact raw captured', parsed33.employees[0].otherContact.includes('0551112233'));
check('firstGrade raw captured', parsed33.employees[0].firstGrade === firstGrade.gradeName);
check('promo date raw captured', parsed33.employees[0].currentPromotionDate === '01/07/2020');
check('previousPosting raw captured', parsed33.employees[0].previousPosting.includes('HR Research'));

const report33 = await validateParsedWorkbook(parsed33);
const vrow33 = report33.rows[0];
check('33-col row has no errors', vrow33.errors.length === 0, JSON.stringify(vrow33.errors));
check('otherContacts normalized x3', vrow33.normalized?.personal.otherContacts?.length === 3,
  JSON.stringify(vrow33.normalized?.personal.otherContacts));
check('otherContacts +233 format', vrow33.normalized?.personal.otherContacts?.[0] === '+233 55 111 2233');
check('firstGradeId resolved', vrow33.normalized?.employment.firstGradeId === firstGrade.id);
check('currentPromotionDate ISO', vrow33.normalized?.employment.currentPromotionDate === '2020-07-01');
check('dateAssignedCurrentGrade aligned', vrow33.normalized?.employment.dateAssignedCurrentGrade === '2020-07-01');
check('previousPosting persisted', vrow33.normalized?.employment.previousPosting === 'HR Research Unit, Ministry of Finance');

// ---------- 4. Legacy 29-column template still parses ----------
console.log('\n[4] legacy 29-column parse');
const legacy29 = EMPLOYEE_HEADERS.slice(0, 29);
const wb29 = await buildWorkbook(legacy29, [baseRow()]);
const parsed29 = await parseBuf(wb29, 'legacy29.xlsx');
check('29-col header accepted', parsed29.employees.length === 1);
check('29-col new fields empty', parsed29.employees[0].otherContact === '' && parsed29.employees[0].firstGrade === '');
const report29 = await validateParsedWorkbook(parsed29);
check('29-col row valid', report29.rows[0].errors.length === 0, JSON.stringify(report29.rows[0].errors));
check('29-col otherContacts undefined', report29.rows[0].normalized?.personal.otherContacts === undefined);

// ---------- 5. Legacy 28-column (no Ghana Card) still parses ----------
console.log('\n[5] legacy 28-column parse');
const legacy28 = legacy29.filter((h) => h !== 'Ghana Card (NIA)');
const row28: Record<string, string> = {};
for (const [k, v] of Object.entries(baseRow())) {
  if (k === 'Ghana Card (NIA)') continue;
  row28[k] = v;
}
const wb28 = await buildWorkbook(legacy28, [row28]);
const parsed28 = await parseBuf(wb28, 'legacy28.xlsx');
check('28-col header accepted', parsed28.employees.length === 1);
const report28 = await validateParsedWorkbook(parsed28);
check('28-col row valid', report28.rows[0].errors.length === 0, JSON.stringify(report28.rows[0].errors));

// ---------- 6. Validation rules ----------
console.log('\n[6] validation rules');
const badContact = { ...baseRow({ 'Staff ID*': 'TST-EMP-90002' }), 'Other Contact(s)': 'notaphone' };
const wbBad = await buildWorkbook(EMPLOYEE_HEADERS, [badContact]);
const repBad = await validateParsedWorkbook(await parseBuf(wbBad, 'bad.xlsx'));
check('invalid other contact -> error', repBad.rows[0].errors.some((e) => e.column === 'Other Contact(s)'));

const badPromo = { ...baseRow({ 'Staff ID*': 'TST-EMP-90003' }), 'Current Promotion Date (DD/MM/YYYY)': '01/01/2010' };
const wbBad2 = await buildWorkbook(EMPLOYEE_HEADERS, [badPromo]);
const repBad2 = await validateParsedWorkbook(await parseBuf(wbBad2, 'bad2.xlsx'));
check('promo before first appt -> error', repBad2.rows[0].errors.some((e) => e.column.includes('Promotion')));

const badGrade = { ...baseRow({ 'Staff ID*': 'TST-EMP-90004' }), 'First Grade (Entry Grade)': 'Nonexistent Grade ZZZ' };
const wbBad3 = await buildWorkbook(EMPLOYEE_HEADERS, [badGrade]);
const repBad3 = await validateParsedWorkbook(await parseBuf(wbBad3, 'bad3.xlsx'));
check('unknown first grade -> error', repBad3.rows[0].errors.some((e) => e.column === 'First Grade (Entry Grade)'));

// ---------- 7. Bulk import persistence ----------
console.log('\n[7] bulk import persists new fields');
const result = await executeBulkImport(report33, 'valid_only', 'admin');
check('import succeeded', result.importedCount === 1, JSON.stringify(result.outcomes));
const imported = db.getEmployees().find((e: any) => e.staffId === 'TST-EMP-90001');
check('employee record created', Boolean(imported));
const pInfo = db.getEmployeePersonalInfo(imported!.id);
const eInfo = db.getEmployeeEmploymentInfo(imported!.id);
check('otherContacts persisted', pInfo?.otherContacts?.length === 3, JSON.stringify(pInfo?.otherContacts));
check('firstGradeId persisted', eInfo?.firstGradeId === firstGrade.id);
check('currentPromotionDate persisted', eInfo?.currentPromotionDate === '2020-07-01');
check('previousPosting persisted', eInfo?.previousPosting === 'HR Research Unit, Ministry of Finance');
check('dateAssignedCurrentGrade aligned', eInfo?.dateAssignedCurrentGrade === '2020-07-01');

// ---------- 8. createEmployee validation ----------
console.log('\n[8] createEmployee date consistency');
function makePayload(promo?: string) {
  return {
    staffId: 'TST-EMP-90010',
    personal: {
      surname: 'Manual', firstName: 'Kofi', dateOfBirth: '1990-01-01', gender: 'Male' as const,
      maritalStatus: 'Single' as const, nationality: 'Ghanaian', residentialAddress: 'Accra',
      telephoneNumber: '+233 24 000 0001', emailAddress: 'kofi@x.gov.gh',
      emergencyContactName: 'X', emergencyContactPhone: '+233 24 000 0001',
      nextOfKinName: 'X', nextOfKinRelationship: 'Brother', nextOfKinPhone: '+233 24 000 0001',
      otherContacts: ['+233 55 999 0000'],
    },
    employment: {
      employeeCategory: 'Professional' as const, employmentType: 'Permanent & Pensionable' as const,
      dateOfFirstAppointment: '2020-01-01', dateOfAssumptionOfDuty: '2020-01-01',
      currentEmploymentStatus: 'Active' as const, currentMdaId: mda.id, currentDepartmentId: dept!.id,
      currentPositionTitle: 'Officer', currentGradeId: grade.id, currentSalaryLevel: 10, currentSalaryStep: 1,
      dateAssignedCurrentRole: '2020-01-01', dateAssignedCurrentGrade: '2020-01-01',
      firstGradeId: firstGrade.id, currentPromotionDate: promo, previousPosting: 'Previous Unit',
    },
  };
}
let threw = false;
try {
  db.createEmployee(makePayload('2019-01-01'), 'admin'); // before first appt
} catch {
  threw = true;
}
check('createEmployee rejects promo < first appt', threw);

const created = db.createEmployee(makePayload('2021-06-01'), 'admin');
check('createEmployee accepts valid promo', created.employment.currentPromotionDate === '2021-06-01');
check('createEmployee persists otherContacts', created.personal.otherContacts?.[0] === '+233 55 999 0000');
check('createEmployee persists firstGrade/previousPosting',
  created.employment.firstGradeId === firstGrade.id && created.employment.previousPosting === 'Previous Unit');

// ---------- 9. updateEmployee round-trip ----------
console.log('\n[9] updateEmployee round-trip');
// UI layer cleans before calling updateEmployee (trim/dedupe in modal & dossier)
const cleanedContacts = Array.from(
  new Set(['+233 20 111 2222', '+233 20 111 2222', '  '].map((c) => c.trim()).filter((c) => c.length > 0))
);
db.updateEmployee(created.employee.id, {
  personal: { ...created.personal, otherContacts: cleanedContacts },
}, 'admin');
const pAfter = db.getEmployeePersonalInfo(created.employee.id);
check('otherContacts updated & persisted', JSON.stringify(pAfter?.otherContacts) === JSON.stringify(['+233 20 111 2222']));
check('employment fields untouched by personal update',
  pAfter !== undefined && db.getEmployeeEmploymentInfo(created.employee.id)?.currentPromotionDate === '2021-06-01');

console.log(`\n===== RESULT: ${passed} PASS / ${failed} FAIL =====`);
process.exit(failed > 0 ? 1 : 0);
