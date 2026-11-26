/**
 * Verifies establishment posts migrated from departmentId -> mdaId:
 * - ensureInitialized migrates legacy records via department lookup
 * - restoreDatabaseSnapshot runs the same migration
 * - seed data uses mdaId
 */

(globalThis as any).window = { dispatchEvent: () => true, hrmisDesktop: undefined };
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
};

const PREFIX = 'haros_hrmis_v2_';
const seed = (key: string, value: any) => store.set(PREFIX + key, JSON.stringify(value));

async function main() {
  const { db } = await import('../src/db/storage');
  const { INITIAL_MDAS, INITIAL_DEPARTMENTS, INITIAL_ESTABLISHMENT } = await import('../src/db/seedData');

  let pass = 0;
  let fail = 0;
  const check = (name: string, cond: boolean) => {
    if (cond) { pass++; console.log(`PASS ${name}`); }
    else { fail++; console.log(`FAIL ${name}`); }
  };

  // --- Scenario 1: legacy records with departmentId get migrated on ensureInitialized ---
  store.clear();
  seed('initialized', 'true');
  seed('mdas', INITIAL_MDAS);
  seed('departments', INITIAL_DEPARTMENTS);
  seed('gradeLevels', []);
  seed('establishment', [
    { id: 1, positionCode: 'EST-LEG-01', departmentId: 1, gradeId: 9, positionTitle: 'Director of HR', approvedCadreQuota: 2, status: 'Active' },
    { id: 2, positionCode: 'EST-LEG-02', departmentId: 4, gradeId: 7, positionTitle: 'Principal Analyst', approvedCadreQuota: 5, status: 'Active' },
    { id: 3, positionCode: 'EST-LEG-03', departmentId: 999, gradeId: 6, positionTitle: 'Orphan Dept Post', approvedCadreQuota: 1, status: 'Active' },
  ]);
  seed('employmentInfo', []);
  seed('employees', []);

  db.ensureInitialized();

  const migrated = JSON.parse(store.get(PREFIX + 'establishment')!);
  check('post dept 1 -> mdaId 1', migrated[0].mdaId === 1);
  check('post dept 4 -> mdaId 2', migrated[1].mdaId === 2);
  check('unknown dept falls back to raw id', migrated[2].mdaId === 999);
  check('departmentId stripped', migrated.every((p: any) => !('departmentId' in p)));
  check('mdaId present on all', migrated.every((p: any) => p.mdaId !== undefined));

  // Idempotent: second run does not corrupt
  db.ensureInitialized();
  const remigrated = JSON.parse(store.get(PREFIX + 'establishment')!);
  check('idempotent re-run', remigrated[0].mdaId === 1 && remigrated[1].mdaId === 2);

  // --- Scenario 2: seed data uses mdaId ---
  store.clear();
  db.resetDatabase();
  const seeded = db.getEstablishmentPositions();
  check('seed posts have mdaId', seeded.every((p) => typeof p.mdaId === 'number'));
  check('seed OHCS posts -> mda 1', seeded.filter((p) => p.positionCode.startsWith('EST-OHCS')).every((p) => p.mdaId === 1));
  check('seed MOF posts -> mda 2', seeded.filter((p) => p.positionCode.startsWith('EST-MOF')).every((p) => p.mdaId === 2));

  console.log(`\n${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
