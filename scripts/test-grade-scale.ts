/**
 * Node/tsx verification for the 6 new Civil Service grade designations:
 * Store Keeper, Principal Store Keeper, Supply Officer, Senior Supply Officer,
 * Principal Supply Officer, Principal Procurement Manager.
 * In-memory localStorage shim — no production database touched.
 */
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
(globalThis as any).window = { dispatchEvent: () => true, hrmisDesktop: undefined };
(globalThis as any).CustomEvent = class CustomEvent {
  constructor(public type: string, public init?: any) {}
};

const { db } = await import('../src/db/storage');
const { INITIAL_GRADE_LEVELS } = await import('../src/db/seedData');

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
};

db.ensureInitialized();
const grades = db.getGradeLevels();
const byName = (n: string) => grades.find((g) => g.gradeName === n);

// 1. Fresh seed contains all 6 new grades + all 24 originals = 30
check('30 grades seeded', grades.length === 30, `got ${grades.length}`);
check('INITIAL_GRADE_LEVELS has 30', INITIAL_GRADE_LEVELS.length === 30);
const newNames = ['Store Keeper','Principal Store Keeper','Supply Officer','Senior Supply Officer','Principal Supply Officer','Principal Procurement Manager'];
newNames.forEach((n) => check(`grade exists: ${n}`, !!byName(n)));
check('original ids 1-24 preserved', grades.filter(g => g.id >= 1 && g.id <= 24).length === 24);

// 2. Progression ladders
const next = (n: string) => db.getNextGradeInHierarchy(byName(n) ?? null, grades)?.gradeName;
check('Store Keeper -> Principal Store Keeper', next('Store Keeper') === 'Principal Store Keeper', `got ${next('Store Keeper')}`);
check('Supply Officer -> Senior Supply Officer', next('Supply Officer') === 'Senior Supply Officer', `got ${next('Supply Officer')}`);
check('Senior Supply Officer -> Principal Supply Officer', next('Senior Supply Officer') === 'Principal Supply Officer', `got ${next('Senior Supply Officer')}`);
check('Principal Supply Officer -> Peak', db.getNextGradeLabel(byName('Principal Supply Officer') ?? null, grades) === 'Peak Grade', `got ${db.getNextGradeLabel(byName('Principal Supply Officer') ?? null, grades)}`);
check('Principal Store Keeper -> Peak', db.getNextGradeLabel(byName('Principal Store Keeper') ?? null, grades) === 'Peak Grade', `got ${db.getNextGradeLabel(byName('Principal Store Keeper') ?? null, grades)}`);
check('Principal Procurement Manager -> Chief Procurement and Supply Chain Manager', next('Principal Procurement Manager') === 'Chief Procurement and Supply Chain Manager', `got ${next('Principal Procurement Manager')}`);
check('PPSoM -> Chief P&SC Manager (unchanged)', next('Principal Procurement and Supply Chain Manager') === 'Chief Procurement and Supply Chain Manager', `got ${next('Principal Procurement and Supply Chain Manager')}`);
check('Chief Director unaffected (Peak)', db.getNextGradeLabel(byName('Chief Director') ?? null, grades) === 'Peak Grade', `got ${db.getNextGradeLabel(byName('Chief Director') ?? null, grades)}`);

// 3. Senior rule: Principal Supply Officer stays Automatic 3yr (name heuristic must not override)
const mda = db.getMdas()[0];
const dept = db.getDepartments().find((d: any) => d.mdaId === mda.id || d.ministryId === mda.id) || db.getDepartments()[0];
const baseEmp = (staffId: string, gradeName: string) => ({
  staffId,
  personal: {
    surname: 'Test', firstName: staffId, fullName: `Test ${staffId}`, dateOfBirth: '1990-01-01',
    gender: 'Male' as const, maritalStatus: 'Single' as const, nationality: 'Ghanaian',
    residentialAddress: 'Accra', telephoneNumber: '+233 24 000 0001',
    emergencyContactName: 'X', emergencyContactPhone: '+233 24 000 0001',
    nextOfKinName: 'X', nextOfKinRelationship: 'Brother', nextOfKinPhone: '+233 24 000 0001',
  },
  employment: {
    employeeCategory: 'Civil Service' as const, employmentType: 'Permanent & Pensionable' as const,
    dateOfFirstAppointment: '2020-01-01', dateOfAssumptionOfDuty: '2020-01-01',
    currentEmploymentStatus: 'Active' as const, currentMdaId: mda.id, currentDepartmentId: dept.id,
    currentPositionTitle: 'Officer', currentGradeId: byName(gradeName)!.id, currentSalaryLevel: 10, currentSalaryStep: 1,
    dateAssignedCurrentRole: '2020-01-01', dateAssignedCurrentGrade: '2020-01-01',
  },
});
const emp = db.createEmployee(baseEmp('TST-GRADE-001', 'Principal Supply Officer'), 'admin');
const elig = db.evaluatePromotionEligibility(emp.employee.id);
check('Principal Supply Officer = Automatic', elig.progressionType === 'Automatic Career Progression', `got ${elig.progressionType}`);
check('Principal Supply Officer requiredYears=3', elig.requiredYears === 3, `got ${elig.requiredYears}`);
check('Principal Supply Officer next = Peak', !elig.suggestedTargetGrade, `got ${elig.suggestedTargetGrade?.gradeName}`);

// 4. Principal Store Keeper = Competitive 5yr, dynamic summary mentions grade names
const emp2 = db.createEmployee(baseEmp('TST-GRADE-002', 'Principal Store Keeper'), 'admin');
const elig2 = db.evaluatePromotionEligibility(emp2.employee.id);
check('Principal Store Keeper = Competitive', elig2.progressionType === 'Competitive Senior Promotion', `got ${elig2.progressionType}`);
check('Principal Store Keeper requiredYears=5', elig2.requiredYears === 5, `got ${elig2.requiredYears}`);
check('PSK summary references grade name', elig2.statutoryRuleSummary.includes('Principal Store Keeper'), elig2.statutoryRuleSummary);

// 5. Existing-DB merge: simulate persisted grades missing the new 6
const oldGrades = grades.filter(g => g.id <= 24).map(g => ({ ...g }));
mem.set('haros_hrmis_v2_gradeLevels', JSON.stringify(oldGrades));
mem.set('haros_hrmis_v2_initialized', 'true');
db.ensureInitialized();
const merged = db.getGradeLevels();
check('existing DB merges 6 new grades', merged.length === 30, `got ${merged.length}`);
check('merge preserves custom grade', (() => {
  mem.set('haros_hrmis_v2_gradeLevels', JSON.stringify([...oldGrades, { id: 99, gradeName: 'Custom Test Grade', hierarchyRank: 50, minYearsInGradeForPromotion: 4, monthlyBaseGhs: 1, isActive: true }]));
  db.ensureInitialized();
  return db.getGradeLevels().some(g => g.gradeName === 'Custom Test Grade') && db.getGradeLevels().length === 31;
})());

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
