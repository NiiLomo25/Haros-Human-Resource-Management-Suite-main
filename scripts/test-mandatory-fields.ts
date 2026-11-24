/**
 * Verifies the 12-mandatory-field bulk registration rule:
 * mandatory = Staff ID, Surname, First Name, DOB, Gender, Staff Categorization,
 * Employment Type, MDA, Department, Designation, Grade Scale, First Appointment.
 * Telephone, Assumption of Duty and all other columns are optional.
 * In-memory localStorage shim — no production database touched.
 */
import ExcelJS from 'exceljs';

const mem = new Map<string, string>();
const localStorageShim = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
(globalThis as any).localStorage = localStorageShim;
(globalThis as any).window = { dispatchEvent: () => true, hrmisDesktop: undefined };
(globalThis as any).CustomEvent = class CustomEvent {
  constructor(public type: string, public init?: any) {}
};

const { db } = await import('../src/db/storage');
const { parseBulkRegistrationFile } = await import('../src/services/bulkRegistration/parser');
const { validateParsedWorkbook } = await import('../src/services/bulkRegistration/validator');
const {
  EMPLOYEE_HEADERS, SHEET_NAMES, CAPABILITY_HEADERS, SKILL_HEADERS, MEMBERSHIP_HEADERS,
} = await import('../src/services/bulkRegistration/types');

localStorage.setItem('haros_current_user', 'admin');

let passed = 0, failed = 0;
const check = (n: string, c: boolean, d = '') => {
  if (c) { passed++; console.log(`  PASS  ${n}`); }
  else { failed++; console.log(`  FAIL  ${n} ${d}`); }
};

const mdas = db.getMdas().filter((m: any) => m.isActive !== false);
const mda = mdas[0];
const dept = db.getDepartments().find((d: any) => d.mdaId === mda.id && d.status !== 'Archived')!;
const grade = db.getGradeLevels().filter((g: any) => g.isActive !== false).slice(-1)[0];

// Only the 12 mandatory fields populated; every optional column blank.
function mandatoryOnlyRow(overrides: Record<string, string> = {}): Record<string, string> {
  const row: Record<string, string> = {
    'Staff ID*': 'TST-MAND-001',
    'Surname*': 'Mandatory',
    'First Name*': 'Only',
    'Date of Birth (DD/MM/YYYY)*': '15/06/1988',
    'Gender*': 'Female',
    'Staff Categorization*': 'Professional',
    'Employment Type*': 'Permanent & Pensionable',
    'MDA*': `${mda.code} - ${mda.name}`,
    'Department*': dept.departmentName,
    'Designation*': 'HR Officer',
    'Grade Scale*': grade.gradeName,
    'First Appointment (DD/MM/YYYY)*': '10/01/2015',
  };
  return { ...row, ...overrides };
}

async function buildWorkbook(headerList: readonly string[], rows: Record<string, string>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const emp = wb.addWorksheet(SHEET_NAMES.EMPLOYEES);
  emp.columns = headerList.map((h, i) => ({ header: h, key: `c${i}`, width: 18 }));
  rows.forEach((r) => emp.addRow(headerList.map((h) => r[h] ?? '')));
  const cap = wb.addWorksheet(SHEET_NAMES.CAPABILITIES);
  cap.columns = CAPABILITY_HEADERS.map((h, i) => ({ header: h, key: `c${i}` }));
  const sk = wb.addWorksheet(SHEET_NAMES.SKILLS);
  sk.columns = SKILL_HEADERS.map((h, i) => ({ header: h, key: `c${i}` }));
  const mem = wb.addWorksheet(SHEET_NAMES.MEMBERSHIPS);
  mem.columns = MEMBERSHIP_HEADERS.map((h, i) => ({ header: h, key: `c${i}` }));
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

async function parseBuf(buf: Buffer, name: string) {
  const fakeFile = {
    name, size: buf.length,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as File;
  return parseBulkRegistrationFile(fakeFile);
}

console.log('[1] Header mandatory markers');
const starred = EMPLOYEE_HEADERS.filter((h) => h.endsWith('*'));
check('exactly 12 mandatory columns', starred.length === 12, `got ${starred.length}: ${starred.join(', ')}`);
const headerList: readonly string[] = EMPLOYEE_HEADERS;
check('Employment Type* mandatory', headerList.includes('Employment Type*'));
check('Telephone optional', headerList.includes('Telephone (+233)') && !headerList.includes('Telephone (+233)*'));
check('Assumption of Duty optional', headerList.includes('Assumption of Duty (DD/MM/YYYY)') && !headerList.includes('Assumption of Duty (DD/MM/YYYY)*'));

console.log('\n[2] Only 12 mandatory fields populated -> Valid');
const wb1 = await buildWorkbook([...EMPLOYEE_HEADERS], [mandatoryOnlyRow()]);
const parsed1 = await parseBuf(wb1, 'mandatory-only.xlsx');
const rep1 = await validateParsedWorkbook(parsed1);
const row1 = rep1.rows[0];
console.log('  row status:', row1.status, '| errors:', row1.errors.map(e => `${e.column}: ${e.message}`).join(' | ') || 'none');
check('row validates', row1.status !== 'Error', JSON.stringify(row1.errors));
const norm1 = row1.normalized;
check('normalized record produced', !!norm1);
if (norm1) {
  check('telephone empty allowed', norm1.personal.telephoneNumber === '');
  check('assumption defaults to first appointment',
    norm1.employment.dateOfAssumptionOfDuty === '2015-01-10',
    `got ${norm1.employment.dateOfAssumptionOfDuty}`);
  check('dateAssignedCurrentRole = assumption default',
    norm1.employment.dateAssignedCurrentRole === '2015-01-10');
  check('employmentType persisted', norm1.employment.employmentType === 'Permanent & Pensionable');
}

console.log('\n[3] Missing Employment Type -> Error');
const wb2 = await buildWorkbook([...EMPLOYEE_HEADERS], [mandatoryOnlyRow({ 'Employment Type*': '', 'Staff ID*': 'TST-MAND-002' })]);
const rep2 = await validateParsedWorkbook(await parseBuf(wb2, 'no-emptype.xlsx'));
check('error on Employment Type*', rep2.rows[0].errors.some(e => e.column === 'Employment Type*'), JSON.stringify(rep2.rows[0].errors));

console.log('\n[4] Telephone optional / validated only when filled');
const wb3 = await buildWorkbook([...EMPLOYEE_HEADERS], [mandatoryOnlyRow({ 'Staff ID*': 'TST-MAND-003' })]);
const rep3 = await validateParsedWorkbook(await parseBuf(wb3, 'no-phone.xlsx'));
check('blank telephone OK', !rep3.rows[0].errors.some(e => e.column.includes('Telephone')), JSON.stringify(rep3.rows[0].errors));
const wb4 = await buildWorkbook([...EMPLOYEE_HEADERS], [mandatoryOnlyRow({ 'Staff ID*': 'TST-MAND-004', 'Telephone (+233)': 'notaphone' })]);
const rep4 = await validateParsedWorkbook(await parseBuf(wb4, 'bad-phone.xlsx'));
check('invalid telephone rejected', rep4.rows[0].errors.some(e => e.column === 'Telephone (+233)'), JSON.stringify(rep4.rows[0].errors));

console.log('\n[5] Assumption of Duty optional & constrained when filled');
const wb5 = await buildWorkbook([...EMPLOYEE_HEADERS], [mandatoryOnlyRow({ 'Staff ID*': 'TST-MAND-005', 'Assumption of Duty (DD/MM/YYYY)': '05/01/2014' })]);
const rep5 = await validateParsedWorkbook(await parseBuf(wb5, 'early-assumption.xlsx'));
check('assumption before first appt rejected', rep5.rows[0].errors.some(e => e.column === 'Assumption of Duty (DD/MM/YYYY)'), JSON.stringify(rep5.rows[0].errors));
const wb6 = await buildWorksheetCheck();
async function buildWorksheetCheck() {
  return buildWorkbook([...EMPLOYEE_HEADERS], [mandatoryOnlyRow({ 'Staff ID*': 'TST-MAND-006', 'Assumption of Duty (DD/MM/YYYY)': '20/03/2016' })]);
}
const rep6 = await validateParsedWorkbook(await parseBuf(wb6, 'valid-assumption.xlsx'));
const norm6 = rep6.rows[0].normalized;
check('explicit assumption honoured', norm6?.employment.dateOfAssumptionOfDuty === '2016-03-20', `got ${norm6?.employment.dateOfAssumptionOfDuty}`);

console.log('\n[6] Previously downloaded template (old header markers) still parses');
const OLD_HEADERS = EMPLOYEE_HEADERS.map((h) =>
  h === 'Telephone (+233)' ? 'Telephone (+233)*'
  : h === 'Employment Type*' ? 'Employment Type'
  : h === 'Assumption of Duty (DD/MM/YYYY)' ? 'Assumption of Duty (DD/MM/YYYY)*'
  : h
);
const oldRow: Record<string, string> = {};
for (const [k, v] of Object.entries(mandatoryOnlyRow())) {
  oldRow[k === 'Employment Type*' ? 'Employment Type' : k] = v;
}
const wbOld = await buildWorkbook(OLD_HEADERS, [oldRow]);
try {
  const repOld = await validateParsedWorkbook(await parseBuf(wbOld, 'old-template.xlsx'));
  check('old template parses & validates', repOld.rows[0].status !== 'Error', JSON.stringify(repOld.rows[0].errors));
  check('old template telephone populated', repOld.rows[0].normalized?.personal.telephoneNumber === '');
} catch (e: any) {
  check('old template parses', false, e.message);
}

console.log(`\n===== RESULT: ${passed} PASS / ${failed} FAIL =====`);
process.exit(failed ? 1 : 0);
