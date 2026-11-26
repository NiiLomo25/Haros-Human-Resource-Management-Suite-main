/**
 * Verifies the Scheduled Training Directory storage layer:
 * - lazy seed, CRUD, RBAC enforcement (create/edit/approve/cancel)
 * - lifecycle transitions and guards
 * - 30/14/7/1-day reminder sync with dedup
 * - snapshot round-trip of scheduledTrainings
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
const raw = (key: string) => store.get(PREFIX + key);

const isoIn = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

async function main() {
  store.clear();
  localStorage.setItem('haros_current_user', 'admin');
  const { db, DatabaseService } = await import('../src/db/storage');
  const { notificationService } = await import('../src/services/notifications/notificationService');

  let pass = 0;
  let fail = 0;
  const check = (name: string, cond: boolean) => {
    if (cond) { pass++; console.log(`PASS ${name}`); }
    else { fail++; console.log(`FAIL ${name}`); }
  };
  const throws = (fn: () => void) => {
    try { fn(); return false; } catch { return true; }
  };

  db.ensureInitialized();

  // --- Seed ---
  const seeded = db.getScheduledTrainings();
  check('lazy seed creates 3 scheduled trainings', seeded.length === 3);
  check('seed statuses cover Scheduled/Approved/Completed',
    seeded.some((t) => t.status === 'Scheduled') &&
    seeded.some((t) => t.status === 'Approved') &&
    seeded.some((t) => t.status === 'Completed'));

  // --- Create ---
  const created = db.createScheduledTraining(
    {
      trainingTitle: 'Records Management & Archives Refresher',
      trainingDate: isoIn(20),
      trainingType: 'Goods',
      deliveryMode: 'In-Person',
      fundingType: 'Paid',
      certification: 'Certified',
      provider: 'PRAAD',
      venueOrPlatform: 'PRAAD Auditorium',
      budgetGhs: 5000,
      targetMdaId: 1,
      expectedParticipants: 20,
      status: 'Scheduled',
    },
    'admin'
  );
  check('create assigns schedule code', created.scheduleCode.startsWith('TRN-SCH-'));
  check('create persists participants/documents defaults', Array.isArray(created.participants) && Array.isArray(created.documents));

  // --- RBAC: hr_officer lacks TRAINING_SCHEDULE_* ---
  localStorage.setItem('haros_current_user', 'hr_officer');
  check('hr_officer create denied', throws(() =>
    db.createScheduledTraining({
      trainingTitle: 'X', trainingDate: isoIn(5), trainingType: 'Goods', deliveryMode: 'Online',
      fundingType: 'Free', certification: 'Non-Certified', provider: 'P', venueOrPlatform: 'V',
      budgetGhs: 0, targetMdaId: 1, expectedParticipants: 1, status: 'Scheduled',
    }, 'hr_officer')
  ));
  localStorage.setItem('haros_current_user', 'admin');

  // --- Approve flow ---
  check('approve Scheduled -> Approved', (() => {
    db.approveScheduledTraining(created.id, 'admin');
    return db.getScheduledTrainings().find((t) => t.id === created.id)?.status === 'Approved';
  })());
  check('re-approve throws', throws(() => db.approveScheduledTraining(created.id, 'admin')));

  // --- Edit guards ---
  db.updateScheduledTraining(created.id, { provider: 'PRAAD Updated' }, 'admin');
  check('edit applies to Approved', db.getScheduledTrainings().find((t) => t.id === created.id)?.provider === 'PRAAD Updated');

  // --- Completion ---
  db.completeScheduledTraining(created.id, {
    participants: [{ employeeId: 1, attended: true, certificateIssued: true, certificateNumber: 'CERT-1' }],
    actualCostGhs: 5400,
    outcomes: 'Good outcomes',
    lessonsLearned: 'Lesson',
    recommendations: 'Rec',
    documents: [{ documentName: 'Invoice', fileName: 'invoice.pdf', fileSize: 1234, uploadedAt: new Date().toISOString() }],
  }, 'admin');
  const completed = db.getScheduledTrainings().find((t) => t.id === created.id)!;
  check('completion sets status + fields',
    completed.status === 'Completed' && completed.actualCostGhs === 5400 &&
    completed.outcomes === 'Good outcomes' && completed.participants.length === 1 &&
    completed.documents.length === 1);
  check('edit on Completed throws', throws(() => db.updateScheduledTraining(created.id, { provider: 'X' }, 'admin')));
  check('cancel on Completed throws', throws(() => db.cancelScheduledTraining(created.id, 'late', 'admin')));

  // --- Cancel flow ---
  const toCancel = db.createScheduledTraining(
    {
      trainingTitle: 'Cancelled Workshop', trainingDate: isoIn(15), trainingType: 'Works',
      deliveryMode: 'Online', fundingType: 'Free', certification: 'Non-Certified',
      provider: 'Vendor', venueOrPlatform: 'Zoom', budgetGhs: 0, targetMdaId: 2,
      expectedParticipants: 5, status: 'Scheduled',
    },
    'admin'
  );
  db.cancelScheduledTraining(toCancel.id, 'Budget freeze', 'admin');
  const cancelled = db.getScheduledTrainings().find((t) => t.id === toCancel.id)!;
  check('cancel sets Cancelled + reason', cancelled.status === 'Cancelled' && (cancelled.outcomes || '').includes('Budget freeze'));

  // --- Reminder sync ---
  const remind = db.createScheduledTraining(
    {
      trainingTitle: 'Imminent Training', trainingDate: isoIn(5), trainingType: 'Consultancy',
      deliveryMode: 'Online', fundingType: 'Paid', certification: 'Certified',
      provider: 'NCSC', venueOrPlatform: 'Teams', budgetGhs: 1000, targetMdaId: 1,
      expectedParticipants: 10, status: 'Approved',
    },
    'admin'
  );
  const dispatched1 = db.syncScheduledTrainingReminders();
  check('first sync dispatches reminders', dispatched1 >= 1);
  const after1 = db.getScheduledTrainings().find((t) => t.id === remind.id)!;
  check('5-day-out fires 30/14/7 markers', [30, 14, 7].every((m) => after1.reminderMarkersSent.includes(m)));
  check('1-day marker not yet sent', !after1.reminderMarkersSent.includes(1));
  const dispatched2 = db.syncScheduledTrainingReminders();
  check('second sync dedups (no repeat dispatch for same markers)', dispatched2 === 0);
  const notifRaw = store.get('haros_hrmis_v1_notifications');
  check('notification history contains Training Reminder',
    !!notifRaw && notifRaw.includes('Training Reminder'));

  // --- Snapshot round-trip ---
  const snap = db.exportDatabaseSnapshot(true);
  store.clear();
  db.ensureInitialized();
  localStorage.setItem('haros_current_user', 'admin');
  const restoreRes = db.restoreDatabaseSnapshot(snap, 'admin');
  check('snapshot restores scheduledTrainings', restoreRes.success && db.getScheduledTrainings().length >= 5);

  // --- daysUntil helper ---
  check('daysUntilTraining returns integer', Number.isInteger(DatabaseService.daysUntilTraining(isoIn(10))));

  console.log(`\n${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
