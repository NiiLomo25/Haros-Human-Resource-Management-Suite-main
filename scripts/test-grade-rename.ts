/**
 * Verifies the rename "Director of Procurement and Supply Chain" ->
 * "Director of Procurement and Supply Chain Manager": new name in grade scale,
 * old spelling still resolves in bulk uploads, progression ladder intact.
 * In-memory localStorage shim — no production database touched.
 */
import ExcelJS from 'exceljs';

const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
(globalThis as any).window = { dispatchEvent: () => true, hrmisDesktop: undefined };
(globalThis as any).CustomEvent = class CustomEvent {
  constructor(public type: string, public init?: any) {}
};

const { db } = await import('../src/db/storage');
const { INITIAL_GRADE_LEVELS } = await import('../src/db/seedData');
const { parseBulkRegistrationFile } = await import('../src/services/bulkRegistration/parser');
const { validateParsedWorkbook } = await import('../src/services/bulkRegistration/validator');
const { EMPLOYEE_HEADERS, SHEET_NAMES, CAPABILITY_HEADERS, SKILL_HEADERS, MEMBERSHIP_HEADERS } =
  await import('../src/services/bulkRegistration/types');

localStorage.setItem('haros_current_user', 'admin');

let passed = 0, failed = 0;
const check = (n: string, c: boolean, d = '') => {
  if (c) { passed++; console.log(`  PASS  ${n}`); }
  else { failed++; console.log(`  FAIL  ${n} ${d}`); }
};

const NEW_NAME = 'Director of Procurement and Supply Chain Manager';
const OLD_NAME = 'Director of Procurement and Supply Chain';

console.log('[1] Grade scale seed + live list');
const seedG = INITIAL_GRADE_LEVELS.find((g) => g.id === 11)!;
check('seed id 11 renamed', seedG.gradeName === NEW_NAME, seedG.gradeName);
const live = db.getGradeLevels();
check('live list has new name', live.some((g) => g.gradeName === NEW_NAME));
check('live list lacks old name', !live.some((g) => g.gradeName === OLD_NAME));
check('still exactly 30 grades', live.filter((g) => g.isActive !== false).length === 30, `got ${live.length}`);

console.log('\n[2] Career progression');
const chiefPscm = live.find((g) => g.gradeName === 'Chief Procurement and Supply Chain Manager')!;
const next = db.getNextGradeInHierarchy(chiefPscm, live);
check('Chief P&SC Manager -> Director P&SC Manager', next?.gradeName === NEW_NAME, next?.gradeName);
const top = live.find((g) => g.gradeName === NEW_NAME)!;
check('Director P&SC Manager is ladder top', db.getNextGradeInHierarchy(top, live) === undefined);

console.log('\n[3] Bulk upload: old spelling resolves');
const mdas = db.getMdas().filter((m: any) => m.isActive !== false);
const mda = mdas[0];
const dept = db.getDepartments().find((d: any) => d.mdaId === mda.id && d.status !== 'Archived')!;

function row(overrides: Record<string, string>): Record<string, string> {
  return {
    'Staff ID*': 'TST-REN-001',
    'Surname*': 'Rename',
    'First Name*': 'Test',
    'Date of Birth (DD/MM/YYYY)*': '15/06/1988',
    'Gender*': 'Male',
    'Staff Categorization*': 'Professional',
    'Employment Type*': 'Permanent & Pensionable',
    'MDA*': `${mda.code} - ${mda.name}`,
    'Department*': dept.departmentName,
    'Designation*': 'Director of Procurement',
    'Grade Scale*': OLD_NAME,
    'First Grade (Entry Grade)': OLD_NAME,
    'First Appointment (DD/MM/YYYY)*': '10/01/2015',
    ...overrides,
  };
}

async function buildWorkbook(rows: Record<string, string>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const emp = wb.addWorksheet(SHEET_NAMES.EMPLOYEES);
  emp.columns = [...EMPLOYEE_HEADERS].map((h, i) => ({ header: h, key: `c${i}`, width: 18 }));
  rows.forEach((r) => emp.addRow([...EMPLOYEE_HEADERS].map((h) => r[h] ?? '')));
  const cap = wb.addWorksheet(SHEET_NAMES.CAPABILITIES);
  cap.columns = CAPABILITY_HEADERS.map((h, i) => ({ header: h, key: `c${i}` }));
  const sk = wb.addWorksheet(SHEET_NAMES.SKILLS);
  sk.columns = SKILL_HEADERS.map((h, i) => ({ header: h, key: `c${i}` }));
  const mm = wb.addWorksheet(SHEET_NAMES.MEMBERSHIPS);
  mm.columns = MEMBERSHIP_HEADERS.map((h, i) => ({ header: h, key: `c${i}` }));
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

async function validateRows(rows: Record<string, string>[]) {
  const buf = await buildWorkbook(rows);
  const fakeFile = {
    name: 'rename-test.xlsx', size: buf.length,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as File;
  const parsed = await parseBulkRegistrationFile(fakeFile);
  return validateParsedWorkbook(parsed);
}

const repOld = await validateRows([row({})]);
const rOld = repOld.rows[0];
console.log('  old-name row status:', rOld.status, '| errors:', rOld.errors.map((e) => e.message).join(' | ') || 'none');
check('old spelling Grade Scale resolves', !rOld.errors.some((e) => e.column.includes('Grade Scale')), JSON.stringify(rOld.errors));
check('old spelling First Grade resolves', !rOld.errors.some((e) => e.column.includes('First Grade')), JSON.stringify(rOld.errors));
check('row has no errors', rOld.status !== 'Error', JSON.stringify(rOld.errors));
if (rOld.normalized) {
  check('normalized currentGradeId = 11', rOld.normalized.employment.currentGradeId === 11, String(rOld.normalized.employment.currentGradeId));
  check('normalized firstGradeId = 11', rOld.normalized.employment.firstGradeId === 11, String(rOld.normalized.employment.firstGradeId));
}

const repNew = await validateRows([row({ 'Staff ID*': 'TST-REN-002', 'Grade Scale*': NEW_NAME, 'First Grade (Entry Grade)': NEW_NAME })]);
const rNew = repNew.rows[0];
check('new spelling resolves cleanly', rNew.status !== 'Error', JSON.stringify(rNew.errors));

console.log(`\n===== RESULT: ${passed} PASS / ${failed} FAIL =====`);
process.exit(failed ? 1 : 0);
