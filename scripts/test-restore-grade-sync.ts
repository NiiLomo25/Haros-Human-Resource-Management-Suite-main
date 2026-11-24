// Verify: restoring an old snapshot missing new grades re-syncs them.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

const { DatabaseService } = await import('../src/db/storage');
const { INITIAL_GRADE_LEVELS } = await import('../src/db/seedData');
const db = DatabaseService.getInstance();

// Build an "old" snapshot: gradeLevels without ids 25-30, plus one custom grade
const oldGrades = INITIAL_GRADE_LEVELS.filter((g) => g.id < 25).map((g) => ({ ...g }));
oldGrades.push({
  id: 99, gradeName: 'Custom Legacy Grade', hierarchyRank: 50,
  minYearsInGradeForPromotion: 3, monthlyBaseGhs: 5000, isActive: true,
  cadreCategory: 'General' as any, occupationalGroup: 'Custom',
  progressionMode: 'Automatic', isSeniorManagement: false,
});

const snapshot = JSON.stringify({ tables: { gradeLevels: oldGrades } });
const res = db.restoreDatabaseSnapshot(snapshot, 'admin');
console.log('restore:', res.success, res.message);

const grades = db.getGradeLevels();
const names = grades.map((g) => g.gradeName);
const checks: [string, boolean][] = [
  ['restore succeeded', res.success === true],
  ['Principal Procurement Manager present', names.includes('Principal Procurement Manager')],
  ['all 30 default grades present', INITIAL_GRADE_LEVELS.every((g) => names.includes(g.gradeName))],
  ['custom legacy grade preserved', names.includes('Custom Legacy Grade')],
  ['PPM fields intact', grades.find((g) => g.gradeName === 'Principal Procurement Manager')?.hierarchyRank === 22],
];
let pass = 0, fail = 0;
for (const [label, ok] of checks) { console.log((ok ? '  PASS  ' : '  FAIL  ') + label); ok ? pass++ : fail++; }
console.log(`\n===== RESULT: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
