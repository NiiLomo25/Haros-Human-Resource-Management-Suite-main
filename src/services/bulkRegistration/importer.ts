import { db } from '../../db/storage';
import { Mda, Department } from '../../types';
import {
  ValidationReport,
  ImportErrorPolicy,
  ImportProgress,
  ImportResultSummary,
  ImportRowOutcome,
  ValidatedEmployeeRow,
  NormalizedEmployeeRecord,
  OrgUpsert,
} from './types';

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const MDA_TYPE_VALUES = ['Ministry', 'Department', 'Agency', 'Commission'] as const;

function normalizeKey(s: string): string {
  return s.trim().toLowerCase();
}

function matchMdaByLabel(mdas: Mda[], label: string): Mda | undefined {
  const key = normalizeKey(label);
  const codePart = key.split(' - ')[0];
  return (
    mdas.find((m) => normalizeKey(`${m.code} - ${m.name}`) === key) ||
    mdas.find((m) => normalizeKey(m.code) === key || normalizeKey(m.code) === codePart) ||
    mdas.find((m) => normalizeKey(m.name) === key)
  );
}

function matchDeptByLabel(depts: Department[], label: string): Department | undefined {
  const key = normalizeKey(label);
  const codePart = key.split(' - ')[0];
  return (
    depts.find((d) => normalizeKey(`${d.departmentCode} - ${d.departmentName}`) === key) ||
    depts.find((d) => normalizeKey(d.departmentName) === key) ||
    depts.find((d) => normalizeKey(d.departmentCode) === key || normalizeKey(d.departmentCode) === codePart)
  );
}

function autoDepartmentCode(name: string, existing: Department[]): string {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8) || 'DEPT';
  const used = new Set(existing.map((d) => normalizeKey(d.departmentCode)));
  if (!used.has(normalizeKey(base))) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(normalizeKey(candidate))) return candidate;
  }
  return `${base}-${Date.now() % 10000}`;
}

/**
 * Registers or updates MDAs and Departments declared on the optional
 * "MDA & Departments" worksheet (or inline on the Employees sheet) before
 * any employee rows are imported.
 */
function executeOrgUpserts(report: ValidationReport, username: string): string[] {
  const failures: string[] = [];
  for (const u of report.orgUpserts) {
    try {
      if (u.kind === 'mda') {
        const all = db.getMdas();
        const existing = all.find((m) => normalizeKey(m.code) === normalizeKey(u.code));
        const requestedType = (MDA_TYPE_VALUES as readonly string[]).includes(u.mdaType || '')
          ? (u.mdaType as Mda['mdaType'])
          : undefined;
        if (existing) {
          db.updateMda(
            existing.id,
            {
              name: u.name || existing.name,
              ...(requestedType ? { mdaType: requestedType } : {}),
              isActive: true,
            },
            username
          );
        } else {
          db.createMda(
            {
              code: u.code.trim().toUpperCase(),
              name: u.name,
              mdaType: requestedType || 'Agency',
              isActive: true,
            },
            username
          );
        }
      } else {
        const parent = db.getMdas().find((m) => normalizeKey(m.code) === normalizeKey(u.mdaRef || ''));
        if (!parent) {
          failures.push(`Department "${u.name}": parent MDA "${u.mdaRef}" could not be resolved.`);
          continue;
        }
        const siblings = db.getDepartments(parent.id);
        const deptNameKey = normalizeKey(u.name);
        const deptCodeKey = normalizeKey(u.code || '');
        const existingDept = siblings.find(
          (d) =>
            normalizeKey(d.departmentName) === deptNameKey ||
            (deptCodeKey && deptCodeKey !== deptNameKey && normalizeKey(d.departmentCode) === deptCodeKey)
        );
        if (existingDept) {
          db.updateDepartment(
            existingDept.id,
            { departmentName: u.name || existingDept.departmentName, status: 'Active' },
            username
          );
        } else {
          const explicitCode = u.code && normalizeKey(u.code) !== deptNameKey ? u.code.trim() : '';
          db.createDepartment(
            {
              mdaId: parent.id,
              departmentCode: explicitCode || autoDepartmentCode(u.name, siblings),
              departmentName: u.name,
              status: 'Active',
            },
            username
          );
        }
      }
    } catch (err: any) {
      failures.push(`${u.kind === 'mda' ? 'MDA' : 'Department'} "${u.name}": ${err?.message || 'upsert failed'}`);
    }
  }
  return failures;
}

function cellFilled(rawRow: ValidatedEmployeeRow['rawRow'], header: string): boolean {
  return (rawRow.rawValues[header] || '').trim().length > 0;
}

/**
 * For rows whose Staff ID matches an existing ACTIVE record, blank optional
 * cells must preserve the saved values instead of overwriting them with
 * template defaults.
 */
function mergeForUpdate(
  normalized: NormalizedEmployeeRecord,
  rawRow: ValidatedEmployeeRow['rawRow'],
  existingPersonal: any,
  existingEmployment: any
): { personal: any; employment: any } {
  const p = normalized.personal;
  const e = normalized.employment;
  const blank = (h: string) => !cellFilled(rawRow, h);

  const personal = {
    ...p,
    otherNames: blank('Other Names') ? existingPersonal?.otherNames : p.otherNames,
    maritalStatus: blank('Marital Status') ? existingPersonal?.maritalStatus ?? p.maritalStatus : p.maritalStatus,
    nationality: blank('Nationality') ? existingPersonal?.nationality ?? p.nationality : p.nationality,
    nationalIdentificationNumber: blank('Ghana Card (NIA)')
      ? existingPersonal?.nationalIdentificationNumber
      : p.nationalIdentificationNumber,
    residentialAddress: blank('Residential Address')
      ? existingPersonal?.residentialAddress ?? p.residentialAddress
      : p.residentialAddress,
    telephoneNumber: blank('Telephone (+233)')
      ? existingPersonal?.telephoneNumber ?? p.telephoneNumber
      : p.telephoneNumber,
    emailAddress: blank('Email') ? existingPersonal?.emailAddress ?? p.emailAddress : p.emailAddress,
    emergencyContactName: blank('Next of Kin Name')
      ? existingPersonal?.nextOfKinName ?? p.emergencyContactName
      : p.emergencyContactName,
    emergencyContactPhone: blank('Next of Kin Phone')
      ? existingPersonal?.nextOfKinPhone ?? p.emergencyContactPhone
      : p.emergencyContactPhone,
    nextOfKinName: blank('Next of Kin Name') ? existingPersonal?.nextOfKinName ?? p.nextOfKinName : p.nextOfKinName,
    nextOfKinRelationship: blank('Next of Kin Relationship')
      ? existingPersonal?.nextOfKinRelationship ?? p.nextOfKinRelationship
      : p.nextOfKinRelationship,
    nextOfKinPhone: blank('Next of Kin Phone')
      ? existingPersonal?.nextOfKinPhone ?? p.nextOfKinPhone
      : p.nextOfKinPhone,
    otherContacts: blank('Other Contact(s)')
      ? existingPersonal?.otherContacts ?? p.otherContacts
      : p.otherContacts,
  };

  const employment = {
    ...e,
    dateOfAssumptionOfDuty: blank('Assumption of Duty (DD/MM/YYYY)')
      ? existingEmployment?.dateOfAssumptionOfDuty ?? e.dateOfAssumptionOfDuty
      : e.dateOfAssumptionOfDuty,
    currentSalaryLevel: blank('Salary Level')
      ? existingEmployment?.currentSalaryLevel ?? e.currentSalaryLevel
      : e.currentSalaryLevel,
    currentSalaryStep: blank('Salary Step (1-10)')
      ? existingEmployment?.currentSalaryStep ?? e.currentSalaryStep
      : e.currentSalaryStep,
    firstGradeId: blank('First Grade (Entry Grade)')
      ? existingEmployment?.firstGradeId ?? e.firstGradeId
      : e.firstGradeId,
    currentPromotionDate: blank('Current Promotion Date (DD/MM/YYYY)')
      ? existingEmployment?.currentPromotionDate ?? e.currentPromotionDate
      : e.currentPromotionDate,
    previousPosting: blank('Previous Posting')
      ? existingEmployment?.previousPosting ?? e.previousPosting
      : e.previousPosting,
    // Grade tenure date is only reset when a new promotion date is supplied
    dateAssignedCurrentGrade: cellFilled(rawRow, 'Current Promotion Date (DD/MM/YYYY)')
      ? e.currentPromotionDate || e.dateAssignedCurrentGrade
      : existingEmployment?.dateAssignedCurrentGrade ?? e.dateAssignedCurrentGrade,
  };

  return { personal, employment };
}

export async function executeBulkImport(
  report: ValidationReport,
  policy: ImportErrorPolicy,
  username: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResultSummary> {
  if (policy === 'all_or_nothing' && (report.summary.errorCount > 0 || report.orphanIssues.length > 0)) {
    throw new Error(
      'Import cancelled: "Cancel if any errors" mode is active and the file contains validation errors.'
    );
  }

  // Phase 0: register/update MDAs & Departments before any employee rows
  const orgFailures = executeOrgUpserts(report, username);
  const freshMdas = db.getMdas();
  const resolveMdaId = (label: string, fallback: number): number => {
    if (fallback >= 0) return fallback;
    return matchMdaByLabel(freshMdas, label)?.id ?? -1;
  };
  const resolveDeptId = (mdaId: number, label: string, fallback: number): number => {
    if (fallback >= 0) return fallback;
    if (mdaId < 0) return -1;
    return matchDeptByLabel(db.getDepartments(mdaId), label)?.id ?? -1;
  };

  const batchId = `BULK-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`;
  const outcomes: ImportRowOutcome[] = [];
  const rowsToImport: ValidatedEmployeeRow[] = [];

  for (const row of report.rows) {
    if (row.status === 'Error' || !row.normalized) {
      const reason =
        row.errors.map((e) => `${e.column}: ${e.message}`).join(' | ') || 'Validation error.';
      outcomes.push({
        rowNumber: row.rowNumber,
        staffId: row.staffId,
        fullName: row.displayName,
        result: 'Failed',
        reason,
      });
      continue;
    }

    if (row.status === 'Warning' && row.warningAction === 'skip') {
      const warnReason = row.warnings.map((w) => w.message).join(' | ');
      outcomes.push({
        rowNumber: row.rowNumber,
        staffId: row.staffId,
        fullName: row.displayName,
        result: 'Skipped',
        reason: `Skipped by user choice (${warnReason})`,
      });
      continue;
    }

    rowsToImport.push(row);
  }

  // Re-check database uniqueness & insert in responsive batches
  const BATCH_SIZE = 50;
  const totalImportCandidates = rowsToImport.length;
  const totalBatches = Math.max(1, Math.ceil(totalImportCandidates / BATCH_SIZE));

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = outcomes.filter((o) => o.result === 'Skipped').length;
  let failedCount = outcomes.filter((o) => o.result === 'Failed').length;

  for (let b = 0; b < totalBatches; b++) {
    const start = b * BATCH_SIZE;
    const slice = rowsToImport.slice(start, start + BATCH_SIZE);

    if (slice.length > 0) {
      const batchPayload = slice.map((r) => {
        const n = r.normalized!;
        // Resolve org IDs created during Phase 0 (validator used -1 sentinels)
        const mdaId = resolveMdaId(n.employment.mdaLabel, n.employment.currentMdaId);
        const deptId = resolveDeptId(mdaId, n.employment.departmentLabel, n.employment.currentDepartmentId);

        // Existing ACTIVE staff IDs update; blank optional cells keep saved values
        const existingEmp = db
          .getEmployees()
          .find((e) => e.staffId.trim().toUpperCase() === n.staffId);
        const isUpdate = Boolean(existingEmp);
        const existingPersonal = isUpdate ? db.getEmployeePersonalInfo(existingEmp!.id) : undefined;
        const existingEmployment = isUpdate ? db.getEmployeeEmploymentInfo(existingEmp!.id) : undefined;
        const merged = isUpdate
          ? mergeForUpdate(n, r.rawRow, existingPersonal, existingEmployment)
          : { personal: n.personal, employment: n.employment };

        return {
          staffId: n.staffId,
          personal: merged.personal,
          employment: {
            employeeCategory: merged.employment.employeeCategory,
            employmentType: merged.employment.employmentType,
            dateOfFirstAppointment: merged.employment.dateOfFirstAppointment,
            dateOfAssumptionOfDuty: merged.employment.dateOfAssumptionOfDuty,
            currentEmploymentStatus: merged.employment.currentEmploymentStatus,
            currentMdaId: mdaId,
            currentDepartmentId: deptId,
            currentPositionTitle: merged.employment.currentPositionTitle,
            currentGradeId: merged.employment.currentGradeId,
            currentSalaryLevel: merged.employment.currentSalaryLevel,
            currentSalaryStep: merged.employment.currentSalaryStep,
            dateAssignedCurrentRole: merged.employment.dateAssignedCurrentRole,
            dateAssignedCurrentGrade: merged.employment.dateAssignedCurrentGrade,
            firstGradeId: merged.employment.firstGradeId,
            currentPromotionDate: merged.employment.currentPromotionDate,
            previousPosting: merged.employment.previousPosting,
          },
          initialQualification: n.initialQualification,
          memberships: n.memberships,
          trainingCapabilities: n.trainingCapabilities,
          skills: n.skills,
        };
      });

      const batchOutcomes = db.bulkInsertEmployeesBatch(batchPayload, username, batchId);

      batchOutcomes.forEach((bo, idx) => {
        const srcRow = slice[idx];
        outcomes.push({
          rowNumber: srcRow.rowNumber,
          staffId: bo.staffId,
          fullName: bo.fullName,
          result: bo.result,
          reason: bo.reason,
        });
        if (bo.result === 'Imported') importedCount++;
        else if (bo.result === 'Updated') updatedCount++;
        else if (bo.result === 'Skipped') skippedCount++;
        else failedCount++;
      });
    }

    onProgress?.({
      processed: Math.min(start + slice.length, totalImportCandidates),
      total: totalImportCandidates,
      batchIndex: b + 1,
      totalBatches,
      importedSoFar: importedCount + updatedCount,
      skippedSoFar: skippedCount,
      failedSoFar: failedCount,
    });

    await yieldToUi();
  }

  // Surface org upsert failures as failed pseudo-outcomes so nothing is silent
  orgFailures.forEach((f, i) => {
    outcomes.push({
      rowNumber: 0,
      staffId: '(Org)',
      fullName: f,
      result: 'Failed',
      reason: f,
    });
    failedCount++;
    void i;
  });

  // Sort outcomes cleanly by original row number
  outcomes.sort((a, b) => a.rowNumber - b.rowNumber);

  return {
    importedCount,
    updatedCount,
    skippedCount,
    failedCount,
    outcomes,
    completedAt: new Date().toISOString(),
    batchId,
  };
}
