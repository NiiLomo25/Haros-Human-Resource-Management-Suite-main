/**
 * Perf + correctness check for the Organization Structure single-pass indexing
 * and the storage-layer parse/index caches. In-memory localStorage shim.
 */
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
const P = 'haros_hrmis_v2_';

// Seed 2000 employees across 150 departments / ~20 MDAs
const N_EMP = 2000, N_DEPT = 150, N_MDA = 20;
const employees: any[] = [];
const personal: any[] = [];
const employment: any[] = [];
for (let i = 1; i <= N_EMP; i++) {
  employees.push({ id: i, staffId: `EMP-${String(i).padStart(5, '0')}`, isActive: true, isDeleted: false });
  personal.push({ employeeId: i, fullName: `Officer ${i}`, firstName: 'A', surname: 'B' });
  employment.push({
    employeeId: i,
    currentDepartmentId: ((i - 1) % N_DEPT) + 1,
    currentMdaId: (((i - 1) % N_DEPT) % N_MDA) + 1,
    currentEmploymentStatus: 'Active',
    employeeCategory: i % 2 === 0 ? 'Professional' : 'Sub-Professional',
  });
}
localStorage.setItem(P + 'employees', JSON.stringify(employees));
localStorage.setItem(P + 'personalInfo', JSON.stringify(personal));
localStorage.setItem(P + 'employmentInfo', JSON.stringify(employment));

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => {
  if (c) { pass++; console.log(`  PASS  ${n}`); }
  else { fail++; console.log(`  FAIL  ${n} ${d}`); }
};

console.log('[1] Indexed lookups');
let t0 = performance.now();
for (let i = 1; i <= N_EMP; i++) {
  db.getEmployeeEmploymentInfo(i);
  db.getEmployeePersonalInfo(i);
}
const indexedMs = performance.now() - t0;
console.log(`  4000 indexed lookups: ${indexedMs.toFixed(1)} ms`);
check('indexed lookups fast (<500ms)', indexedMs < 500, `${indexedMs.toFixed(0)}ms`);
check('lookup correct', db.getEmployeeEmploymentInfo(7)?.currentDepartmentId === ((7 - 1) % N_DEPT) + 1);

t0 = performance.now();
for (let r = 0; r < 20; r++) {
  for (let i = 1; i <= N_EMP; i++) db.getEmployeeEmploymentInfo(i);
}
const repeatMs = performance.now() - t0;
console.log(`  20x2000 repeated lookups: ${repeatMs.toFixed(1)} ms`);
check('repeated lookups stay fast (<1000ms)', repeatMs < 1000, `${repeatMs.toFixed(0)}ms`);

console.log('\n[2] Simulated org-stats single pass (2000 emp / 150 dept)');
t0 = performance.now();
const staffByDept = new Map<number, number>();
const byMda = new Map<number, number>();
for (const emp of employees) {
  const info = db.getEmployeeEmploymentInfo(emp.id);
  if (info?.currentEmploymentStatus !== 'Active') continue;
  if (info.currentDepartmentId) staffByDept.set(info.currentDepartmentId, (staffByDept.get(info.currentDepartmentId) || 0) + 1);
  if (info.currentMdaId) byMda.set(info.currentMdaId, (byMda.get(info.currentMdaId) || 0) + 1);
}
const simMs = performance.now() - t0;
console.log(`  single pass: ${simMs.toFixed(1)} ms`);
check('single pass < 50ms', simMs < 50, `${simMs.toFixed(1)}ms`);
check('dept counts correct', staffByDept.get(1) === Math.ceil(N_EMP / N_DEPT) || staffByDept.get(1) === 14, `got ${staffByDept.get(1)}`);
check('total staff = 2000', [...staffByDept.values()].reduce((a, b) => a + b, 0) === N_EMP);

console.log('\n[3] Cache invalidation on write');
const before = db.getEmployees().length;
employment[0].employeeCategory = 'Professional';
localStorage.setItem(P + 'employmentInfo', JSON.stringify(employment)); // direct write, bypasses setItem
t0 = performance.now();
const info1 = db.getEmployeeEmploymentInfo(1);
check('direct localStorage write picked up', info1?.employeeCategory === 'Professional');
console.log(`  post-write lookup: ${(performance.now() - t0).toFixed(1)} ms`);

console.log(`\n===== RESULT: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
