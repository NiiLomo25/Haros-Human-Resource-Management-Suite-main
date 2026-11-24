/**
 * Verifies bulk-registration org upserts and employee updates:
 * - optional "MDA & Departments" worksheet registers/updates orgs
 * - inline "CODE - Name" MDA + unknown Department on Employees sheet
 * - existing ACTIVE Staff ID updates record; blank optional cells preserved
 * - deleted Staff IDs and intra-file duplicates remain blocked
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
const { executeBulkImport } = await import('../src/services/bulkRegistration/importer');
const {
  EMPLOYEE_HEADERS, SHEET_NAMES, CAPABILITY_HEADERS, SKILL_HEADERS, MEMBERSHIP_HEADERS, ORG_HEADERS,
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

function empRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'Staff ID*': 'TST-ORG-001',
    'Surname*': 'Orgtest',
    'First Name*': 'Kofi',
    'Date of Birth (DD/MM/YYYY)*': '15/06/1988',
    'Gender*': 'Male',
    'Staff Categorization*': 'Professional',
    'Employment Type*': 'Permanent & Pensionable',
    'MDA*': `${mda.code} - ${mda.name}`,
    'Department*': dept.departmentName,
    'Designation*': 'HR Officer',
    'Grade Scale*': grade.gradeName,
    'First Appointment (DD/MM/YYYY)*': '10/01/2015',
    ...overrides,
  };
}

async function buildWorkbook(opts: {
  empRows?: Record<string, string>[];
  orgRows?: Record<string, string>[];
  oldOrgHeaders?: boolean;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const emp = wb.addWorksheet(SHEET_NAMES.EMPLOYEES);
  emp.columns = EMPLOYEE_HEADERS.map((h, i) => ({ header: h, key: `c${i}`, width: 18 }));
  (opts.empRows || [empRow()]).forEach((r) => emp.addRow(EMPLOYEE_HEADERS.map((h) => r[h] ?? '')));
  const cap = wb.addWorksheet(SHEET_NAMES.CAPABILITIES);
  cap.columns = CAPABILITY_HEADERS.map((h, i) => ({ header: h, key: `c${i}` }));
  const sk = wb.addWorksheet(SHEET_NAMES.SKILLS);
  sk.columns = SKILL_HEADERS.map((h, i) => ({ header: h, key: `c${i}` }));
  const mem = wb.addWorksheet(SHEET_NAMES.MEMBERSHIPS);
  mem.columns = MEMBERSHIP_HEADERS.map((h, i) => ({ header: h, key: `c${i}` }));
  if (opts.orgRows) {
    const org = wb.addWorksheet(SHEET_NAMES.ORGS);
    const headers = opts.oldOrgHeaders ? ORG_HEADERS : ORG_HEADERS;
    org.columns = headers.map((h, i) => ({ header: h, key: `c${i}`, width: 20 }));
    opts.orgRows.forEach((r) => org.addRow(headers.map((h) => r[h] ?? '')));
  }
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

async function runImport(buf: Buffer, name: string) {
  const fakeFile = {
    name, size: buf.length,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as File;
  const parsed = await parseBulkRegistrationFile(fakeFile);
  const report = await validateParsedWorkbook(parsed);
  return { parsed, report, result: await executeBulkImport(report, 'valid_only', 'admin') };
}

console.log('[1] Inline org registration via Employees sheet');
const NEW_MDA = 'TSTN - Test New Ministry';
const NEW_DEPT = 'Test New Directorate';
const { report: rep1, result: res1 } = await runImport(
  await buildWorkbook({ empRows: [empRow({ 'Staff ID*': 'TST-ORG-010', 'MDA*': NEW_MDA, 'Department*': NEW_DEPT })] }),
  'inline-orgs.xlsx'
);
check('row valid', rep1.rows[0].status !== 'Error', JSON.stringify(rep1.rows[0].errors));
check('orgUpserts collected', rep1.orgUpserts.length >= 2, JSON.stringify(rep1.orgUpserts));
check('import succeeded', res1.importedCount === 1 && res1.failedCount === 0, JSON.stringify(res1.outcomes));
const newMda = db.getMdas().find((m: any) => m.code === 'TSTN');
check('new MDA created', !!newMda && newMda.name === 'Test New Ministry', JSON.stringify(newMda));
const newDeptRec = newMda ? db.getDepartments(newMda.id).find((d: any) => d.departmentName === NEW_DEPT) : undefined;
check('new Department created under new MDA', !!newDeptRec, '');
const importedEmp = db.getEmployees().find((e: any) => e.staffId === 'TST-ORG-010');
check('employee linked to new orgs', !!importedEmp);
if (importedEmp) {
  const ei = db.getEmployeeEmploymentInfo(importedEmp.id);
  check('employment mdaId = new MDA', ei?.currentMdaId === newMda?.id, `got ${ei?.currentMdaId}`);
  check('employment deptId = new dept', ei?.currentDepartmentId === newDeptRec?.id, `got ${ei?.currentDepartmentId}`);
}

console.log('\n[2] Org worksheet registers + updates orgs');
const { result: res2 } = await runImport(
  await buildWorkbook({
    empRows: [empRow({ 'Staff ID*': 'TST-ORG-011' })],
    orgRows: [
      { 'MDA Code*': 'TSTN', 'MDA Name*': 'Test New Ministry (Renamed)', 'MDA Type': 'Ministry', 'Department Code': '', 'Department Name': '' },
      { 'MDA Code*': 'TSTN', 'MDA Name*': '', 'MDA Type': '', 'Department Code': 'TND1', 'Department Name': 'Test New Directorate' },
      { 'MDA Code*': 'AGCY', 'MDA Name*': 'Test Agency Ltd', 'MDA Type': 'Agency', 'Department Code': '', 'Department Name': '' },
    ],
  }),
  'org-sheet.xlsx'
);
check('import ok', res2.failedCount === 0, JSON.stringify(res2.outcomes.filter(o=>o.result==='Failed')));
const renamedMda = db.getMdas().find((m: any) => m.code === 'TSTN');
check('existing MDA updated (rename)', renamedMda?.name === 'Test New Ministry (Renamed)', renamedMda?.name);
check('MDA type updated', renamedMda?.mdaType === 'Ministry', renamedMda?.mdaType);
const agcy = db.getMdas().find((m: any) => m.code === 'AGCY');
check('new MDA from org sheet created', !!agcy && agcy.mdaType === 'Agency');
const tnd1 = renamedMda ? db.getDepartments(renamedMda.id).find((d: any) => d.departmentName === 'Test New Directorate') : undefined;
check('org-sheet dept matched existing (no dup)', !!tnd1 && db.getDepartments(renamedMda!.id).filter((d: any) => d.departmentName === 'Test New Directorate').length === 1);

console.log('\n[3] Existing ACTIVE Staff ID updates record; blanks preserved');
// First import creates the officer with phone + assumption date
const seedRes = await runImport(
  await buildWorkbook({
    empRows: [empRow({
      'Staff ID*': 'TST-ORG-020',
      'First Name*': 'Solo',
      'Date of Birth*': '20/07/1989',
      'Telephone (+233)': '0244000111',
      'Assumption of Duty (DD/MM/YYYY)': '15/02/2015',
      'Previous Posting': 'Old Unit X',
    })],
  }),
  'create-020.xlsx'
);
console.log('  seed outcomes:', JSON.stringify(seedRes.result.outcomes), 'rowErrors:', JSON.stringify(seedRes.report.rows[0]?.errors));
const before = db.getEmployees().find((e: any) => e.staffId === 'TST-ORG-020')!;
const beforeP = db.getEmployeePersonalInfo(before.id)!;
const beforeE = db.getEmployeeEmploymentInfo(before.id)!;
check('seeded phone', beforeP.telephoneNumber === '+233 24 400 0111', beforeP.telephoneNumber);

// Second import: same Staff ID, blank optional cells, changed mandatory designation
const { report: rep3, result: res3 } = await runImport(
  await buildWorkbook({
    empRows: [empRow({
      'Staff ID*': 'TST-ORG-020',
      'Designation*': 'Senior HR Officer',
      'Telephone (+233)': '',
      'Assumption of Duty (DD/MM/YYYY)': '',
      'Previous Posting': '',
      'Other Names': '',
    })],
  }),
  'update-020.xlsx'
);
check('update row is Warning->import default', rep3.rows[0].warningAction === 'import', rep3.rows[0].warningAction);
check('updated outcome', res3.updatedCount === 1 && res3.importedCount === 0, JSON.stringify(res3.outcomes));
const afterP = db.getEmployeePersonalInfo(before.id)!;
const afterE = db.getEmployeeEmploymentInfo(before.id)!;
check('phone preserved when blank', afterP.telephoneNumber === '+233 24 400 0111', afterP.telephoneNumber);
check('assumption preserved when blank', afterE.dateOfAssumptionOfDuty === '2015-02-15', afterE.dateOfAssumptionOfDuty);
check('previousPosting preserved when blank', afterE.previousPosting === 'Old Unit X', afterE.previousPosting);
check('designation updated', afterE.currentPositionTitle === 'Senior HR Officer', afterE.currentPositionTitle);
check('still one record (no dup)', db.getEmployees().filter((e: any) => e.staffId === 'TST-ORG-020').length === 1);

console.log('\n[4] Deleted Staff ID remains blocked');
// Soft-delete the officer then try re-import
db.deleteEmployee(before.id, 'admin');
check('employee deleted', !db.getEmployees().some((e:any)=>e.id===before.id));
const { report: rep4 } = await runImport(
  await buildWorkbook({ empRows: [empRow({ 'Staff ID*': 'TST-ORG-020' })] }),
  'deleted-020.xlsx'
);
check('deleted staffId -> error', rep4.rows[0].status === 'Error' && rep4.rows[0].errors.some(e => e.message.includes('deleted')), JSON.stringify(rep4.rows[0].errors));

console.log('\n[5] Intra-file duplicate Staff IDs remain blocked');
const rep5 = await validateParsedWorkbook(
  await parseBulkRegistrationFile({
    name: 'dupes.xlsx', size: 1,
    arrayBuffer: async () => (await buildWorkbook({ empRows: [empRow({ 'Staff ID*': 'TST-ORG-030' }), empRow({ 'Staff ID*': 'TST-ORG-030' })] })).buffer.slice(0),
  } as unknown as File)
);
check('intra-file dup -> error', rep5.rows.every(r => r.status === 'Error' && r.errors.some(e => e.message.includes('Duplicate'))), JSON.stringify(rep5.rows.map(r=>r.errors)));

console.log(`\n===== RESULT: ${passed} PASS / ${failed} FAIL =====`);
process.exit(failed ? 1 : 0);
