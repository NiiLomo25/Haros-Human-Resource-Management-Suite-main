import { db } from '../../db/storage';
import {
  ValidationReport,
  ImportErrorPolicy,
  ImportProgress,
  ImportResultSummary,
  ImportRowOutcome,
  ValidatedEmployeeRow,
} from './types';

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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
  let skippedCount = outcomes.filter((o) => o.result === 'Skipped').length;
  let failedCount = outcomes.filter((o) => o.result === 'Failed').length;

  for (let b = 0; b < totalBatches; b++) {
    const start = b * BATCH_SIZE;
    const slice = rowsToImport.slice(start, start + BATCH_SIZE);

    if (slice.length > 0) {
      const batchPayload = slice.map((r) => {
        const n = r.normalized!;
        return {
          staffId: n.staffId,
          personal: n.personal,
          employment: {
            employeeCategory: n.employment.employeeCategory,
            employmentType: n.employment.employmentType,
            dateOfFirstAppointment: n.employment.dateOfFirstAppointment,
            dateOfAssumptionOfDuty: n.employment.dateOfAssumptionOfDuty,
            currentEmploymentStatus: n.employment.currentEmploymentStatus,
            currentMdaId: n.employment.currentMdaId,
            currentDepartmentId: n.employment.currentDepartmentId,
            currentPositionTitle: n.employment.currentPositionTitle,
            currentGradeId: n.employment.currentGradeId,
            currentSalaryLevel: n.employment.currentSalaryLevel,
            currentSalaryStep: n.employment.currentSalaryStep,
            dateAssignedCurrentRole: n.employment.dateAssignedCurrentRole,
            dateAssignedCurrentGrade: n.employment.dateAssignedCurrentGrade,
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
        else if (bo.result === 'Skipped') skippedCount++;
        else failedCount++;
      });
    }

    onProgress?.({
      processed: Math.min(start + slice.length, totalImportCandidates),
      total: totalImportCandidates,
      batchIndex: b + 1,
      totalBatches,
      importedSoFar: importedCount,
      skippedSoFar: skippedCount,
      failedSoFar: failedCount,
    });

    await yieldToUi();
  }

  // Sort outcomes cleanly by original row number
  outcomes.sort((a, b) => a.rowNumber - b.rowNumber);

  return {
    importedCount,
    skippedCount,
    failedCount,
    outcomes,
    completedAt: new Date().toISOString(),
    batchId,
  };
}
