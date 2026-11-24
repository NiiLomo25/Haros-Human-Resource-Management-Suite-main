import React, { useState, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Search,
  ShieldCheck,
  FileWarning,
  Users,
  Check,
  Ban,
} from 'lucide-react';
import { db } from '../../db/storage';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { SlideOverPanel } from '../common/SlideOverPanel';
import {
  generateBulkRegistrationTemplate,
  generateErrorReportXlsx,
  generateImportReportXlsx,
} from '../../services/bulkRegistration/templateGenerator';
import { parseBulkRegistrationFile } from '../../services/bulkRegistration/parser';
import { validateParsedWorkbook } from '../../services/bulkRegistration/validator';
import { executeBulkImport } from '../../services/bulkRegistration/importer';
import {
  ValidationReport,
  ImportErrorPolicy,
  ImportProgress,
  ImportResultSummary,
  RowValidationStatus,
  WarningAction,
} from '../../services/bulkRegistration/types';

interface BulkRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCompleted: () => void;
}

type BulkStep = 'template' | 'upload' | 'review';

const PAGE_SIZE = 50;

export const BulkRegistrationModal: React.FC<BulkRegistrationModalProps> = ({
  isOpen,
  onClose,
  onImportCompleted,
}) => {
  const { currentUser } = useAuth();
  const notifications = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeStep, setActiveStep] = useState<BulkStep>('template');
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  // Upload & validation state
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState(0);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  // Preview table filtering & pagination
  const [statusFilter, setStatusFilter] = useState<'All' | RowValidationStatus>('All');
  const [previewSearch, setPreviewSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Import state
  const [importPolicy, setImportPolicy] = useState<ImportErrorPolicy>('valid_only');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<ImportResultSummary | null>(null);
  const [importError, setImportError] = useState('');
  const [resultPage, setResultPage] = useState(1);

  const resetAllState = () => {
    setActiveStep('template');
    setUploadError('');
    setUploadedFileName('');
    setUploadedFileSize(0);
    setValidationReport(null);
    setStatusFilter('All');
    setPreviewSearch('');
    setCurrentPage(1);
    setImportPolicy('valid_only');
    setIsImporting(false);
    setImportProgress(null);
    setImportResult(null);
    setImportError('');
    setResultPage(1);
  };

  // Reset state after 400ms close animation finishes
  React.useEffect(() => {
    if (isOpen) return;
    const timer = setTimeout(() => {
      resetAllState();
    }, 400);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleCloseModal = () => {
    if (isImporting) return;
    const hadImported = importResult && importResult.importedCount > 0;
    if (hadImported) {
      onImportCompleted();
    } else {
      onClose();
    }
  };

  // Live master data counts for Step 1 card
  const masterStats = useMemo(() => {
    const mdas = db.getMdas().filter((m) => m.isActive !== false).length;
    const departments = db.getDepartments().filter((d) => d.status !== 'Archived').length;
    const grades = db.getGradeLevels().filter((g) => g.isActive !== false).length;
    return { mdas, departments, grades };
  }, [isOpen]);

  const filteredPreviewRows = useMemo(() => {
    if (!validationReport) return [];
    const q = previewSearch.trim().toLowerCase();
    return validationReport.rows.filter((row) => {
      if (statusFilter !== 'All' && row.status !== statusFilter) return false;
      if (q) {
        const matchId = row.staffId.toLowerCase().includes(q);
        const matchName = row.displayName.toLowerCase().includes(q);
        const matchNin = row.rawRow.nationalIdentificationNumber?.toLowerCase().includes(q);
        const matchMda = row.mdaDisplay.toLowerCase().includes(q);
        const matchDept = row.departmentDisplay.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchNin && !matchMda && !matchDept) return false;
      }
      return true;
    });
  }, [validationReport, statusFilter, previewSearch]);

  const totalPreviewPages = Math.max(1, Math.ceil(filteredPreviewRows.length / PAGE_SIZE));
  const paginatedPreviewRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPreviewRows.slice(start, start + PAGE_SIZE);
  }, [filteredPreviewRows, currentPage]);

  const importSummaryPlan = useMemo(() => {
    if (!validationReport) {
      return { toImport: 0, toSkip: 0, errorCount: 0, orphanCount: 0 };
    }
    let toImport = 0;
    let toSkip = 0;
    let errorCount = 0;
    for (const r of validationReport.rows) {
      if (r.status === 'Error') errorCount++;
      else if (r.status === 'Valid') toImport++;
      else if (r.status === 'Warning') {
        if (r.warningAction === 'import') toImport++;
        else toSkip++;
      }
    }
    return {
      toImport,
      toSkip,
      errorCount,
      orphanCount: validationReport.orphanIssues.length,
    };
  }, [validationReport]);

  const paginatedOutcomes = useMemo(() => {
    if (!importResult) return [];
    const start = (resultPage - 1) * PAGE_SIZE;
    return importResult.outcomes.slice(start, start + PAGE_SIZE);
  }, [importResult, resultPage]);

  const totalResultPages = importResult
    ? Math.max(1, Math.ceil(importResult.outcomes.length / PAGE_SIZE))
    : 1;

  const handleDownloadTemplate = async () => {
    setIsGeneratingTemplate(true);
    try {
      await generateBulkRegistrationTemplate();
      notifications.success(
        'Bulk Template Downloaded',
        'Generated official Civil Service Bulk Staff Registration Excel workbook (.xlsx).',
        { module: 'Staff Registration', actor: currentUser?.username }
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate Excel template.';
      setUploadError(msg);
      notifications.error('Template Generation Failed', msg, {
        module: 'Staff Registration',
        actor: currentUser?.username,
      });
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const handleFileSelected = async (file: File) => {
    setUploadError('');
    setImportResult(null);
    setImportError('');
    setValidationReport(null);
    setUploadedFileName(file.name);
    setUploadedFileSize(file.size);
    setIsProcessingFile(true);
    setProcessingMessage('Validating file format...');

    try {
      const parsed = await parseBulkRegistrationFile(file, (msg) => setProcessingMessage(msg));
      const report = await validateParsedWorkbook(parsed, (msg) => setProcessingMessage(msg));
      setValidationReport(report);
      setStatusFilter('All');
      setPreviewSearch('');
      setCurrentPage(1);

      if (report.summary.errorCount > 0 || report.summary.warningCount > 0) {
        notifications.warning(
          'Workbook Validated with Findings',
          `${file.name}: ${report.summary.validCount} valid, ${report.summary.warningCount} warning(s), ${report.summary.errorCount} error(s).`,
          { module: 'Staff Registration', actor: currentUser?.username }
        );
      } else {
        notifications.success(
          'Workbook Validated Cleanly',
          `${file.name}: All ${report.summary.validCount} record(s) passed validation and are ready for import.`,
          { module: 'Staff Registration', actor: currentUser?.username }
        );
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to process uploaded Excel workbook.';
      setUploadError(msg);
      setValidationReport(null);
      notifications.error('Workbook Parsing Failed', msg, {
        module: 'Staff Registration',
        actor: currentUser?.username,
      });
    } finally {
      setIsProcessingFile(false);
      setProcessingMessage('');
    }
  };

  const handleWarningActionChange = (rowNumber: number, action: WarningAction) => {
    if (!validationReport) return;
    setValidationReport({
      ...validationReport,
      rows: validationReport.rows.map((r) =>
        r.rowNumber === rowNumber ? { ...r, warningAction: action } : r
      ),
    });
  };

  const handleBulkWarningAction = (action: WarningAction) => {
    if (!validationReport) return;
    setValidationReport({
      ...validationReport,
      rows: validationReport.rows.map((r) =>
        r.status === 'Warning' ? { ...r, warningAction: action } : r
      ),
    });
  };

  const handleStartImport = async () => {
    if (!validationReport) return;
    setImportError('');
    setIsImporting(true);
    setImportProgress({
      processed: 0,
      total: importSummaryPlan.toImport,
      batchIndex: 0,
      totalBatches: Math.max(1, Math.ceil(importSummaryPlan.toImport / 50)),
      importedSoFar: 0,
      skippedSoFar: 0,
      failedSoFar: 0,
    });

    try {
      const result = await executeBulkImport(
        validationReport,
        importPolicy,
        currentUser?.username || 'admin',
        (prog) => setImportProgress(prog)
      );
      setImportResult(result);
      setResultPage(1);
    } catch (err: any) {
      const msg = err?.message || 'Bulk import failed.';
      setImportError(msg);
      notifications.error('Bulk Import Error', msg, {
        module: 'Staff Registration',
        actor: currentUser?.username,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const hasAnyFileErrors =
    (validationReport?.summary.errorCount || 0) > 0 ||
    (validationReport?.orphanIssues.length || 0) > 0;

  const canProceedToImport =
    Boolean(validationReport) &&
    importSummaryPlan.toImport > 0 &&
    !(importPolicy === 'all_or_nothing' && hasAnyFileErrors);

  return (
    <SlideOverPanel
      isOpen={isOpen}
      onClose={handleCloseModal}
      closeDisabled={isImporting}
      title="Bulk Register Civil Service Employees"
      subtitle="Central Employee Database • Batch Excel Upload & Validation"
      icon={<FileSpreadsheet className="w-4 h-4" />}
      maxWidthClass="max-w-4xl lg:max-w-5xl"
      overlayClassName="bg-black/40"
    >

        {/* 3 Step Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 text-xs font-semibold shrink-0">
          <button
            type="button"
            disabled={isImporting || Boolean(importResult)}
            onClick={() => setActiveStep('template')}
            className={`py-2.5 px-4 flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${
              activeStep === 'template'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900 disabled:opacity-50'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>1. Download Template</span>
          </button>

          <button
            type="button"
            disabled={isImporting || Boolean(importResult)}
            onClick={() => setActiveStep('upload')}
            className={`py-2.5 px-4 flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${
              activeStep === 'upload'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900 disabled:opacity-50'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>2. Upload & Validate</span>
            {validationReport && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px]">
                {validationReport.summary.totalRows}
              </span>
            )}
          </button>

          <button
            type="button"
            disabled={!validationReport || isImporting}
            onClick={() => setActiveStep('review')}
            className={`py-2.5 px-4 flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${
              activeStep === 'review'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>3. Review & Import</span>
          </button>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* ================================================================= */}
          {/* STEP 1: DOWNLOAD TEMPLATE */}
          {/* ================================================================= */}
          {activeStep === 'template' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                    <span>Official Civil Service Bulk Registration Template (.xlsx)</span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Generate a fresh Excel workbook populated with the system’s live MDAs, Departments,
                    Grade Scales, and validation dropdowns. Supports up to{' '}
                    <strong>1,000 employee records</strong> per upload.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isGeneratingTemplate}
                  className="px-4 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs flex items-center justify-center space-x-2 shrink-0 transition-colors disabled:opacity-60"
                >
                  {isGeneratingTemplate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Template...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download Template (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live Master Data Included */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Live MDAs Included</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{masterStats.mdas}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Dropdown &amp; MDA-Department validation
                  </div>
                </div>
                <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Active Departments</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {masterStats.departments}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Dependent dropdown filtered per MDA
                  </div>
                </div>
                <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Grade Scale Levels</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{masterStats.grades}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    General &amp; Procurement Single Spine grades
                  </div>
                </div>
              </div>

              {/* Workbook Sheet Structure */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Workbook Sheets &amp; Rules
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">1. Employees (Required)</div>
                    <p className="text-slate-600 text-[11px]">
                      One row per officer with all personal, next-of-kin, placement, grade scale,
                      salary step (1–10), and qualification fields. Required headers end with{' '}
                      <strong className="text-blue-700">*</strong>.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">2. Training Capabilities (Optional)</div>
                    <p className="text-slate-600 text-[11px]">
                      Repeat the officer’s <strong className="font-mono">Staff ID*</strong> for each
                      role-related training capability (maximum 10 per employee).
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">3. Skills (Optional)</div>
                    <p className="text-slate-600 text-[11px]">
                      Repeat <strong className="font-mono">Staff ID*</strong> with Skill Name*, Skill
                      Category* (8 approved categories), and Evidence/Application (max 10 per employee).
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">4. Professional Memberships (Optional)</div>
                    <p className="text-slate-600 text-[11px]">
                      Repeat <strong className="font-mono">Staff ID*</strong> with Professional Body*,
                      Membership Number*, Category, Dates, and Status (max 10 per employee).
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 md:col-span-2">
                    <div className="font-bold text-slate-900">
                      5. Instructions &amp; Hidden Lists
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      Includes a column guide, format rules (<code className="font-mono">DD/MM/YYYY</code>,{' '}
                      <code className="font-mono">+233</code>), and a labelled sample officer across all
                      sheets. Do not rename sheets or headers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 2: UPLOAD & VALIDATE */}
          {/* ================================================================= */}
          {activeStep === 'upload' && (
            <div className="space-y-4">
              {/* Drag & Drop / File Picker Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileSelected(file);
                }}
                className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-300 bg-slate-50/60 hover:border-blue-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                    e.target.value = '';
                  }}
                />

                {isProcessingFile ? (
                  <div className="py-4 flex flex-col items-center space-y-2">
                    <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                    <div className="font-bold text-slate-800">{processingMessage || 'Processing...'}</div>
                    <div className="text-[11px] text-slate-500">
                      Chunked validation keeps the interface responsive for large files.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 text-left">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          {uploadedFileName
                            ? `Loaded: ${uploadedFileName} (${(uploadedFileSize / 1024).toFixed(1)} KB)`
                            : 'Drag & drop your completed .xlsx workbook here'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Only <strong>.xlsx</strong> files matching{' '}
                          <code className="font-mono">Employee_Bulk_Registration_Template.xlsx</code>{' '}
                          are accepted (max 1,000 employee rows).
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold shrink-0 transition-colors"
                    >
                      {uploadedFileName ? 'Choose Another .xlsx File' : 'Select .xlsx File'}
                    </button>
                  </div>
                )}
              </div>

              {/* File Rejection / Structural Error Banner */}
              {uploadError && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">File Validation Rejected</div>
                    <div className="text-[11px] mt-0.5">{uploadError}</div>
                  </div>
                </div>
              )}

              {/* Validation Report Summary & Preview */}
              {validationReport && !isProcessingFile && (
                <div className="space-y-4">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-slate-200 bg-white">
                      <div className="text-[10px] font-bold uppercase text-slate-500">Total Rows</div>
                      <div className="text-xl font-black text-slate-900 mt-0.5">
                        {validationReport.summary.totalRows}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {validationReport.summary.capabilitiesCount} cap •{' '}
                        {validationReport.summary.skillsCount} skills •{' '}
                        {validationReport.summary.membershipsCount} memberships
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/70">
                      <div className="text-[10px] font-bold uppercase text-emerald-800">Valid Rows</div>
                      <div className="text-xl font-black text-emerald-900 mt-0.5">
                        {validationReport.summary.validCount}
                      </div>
                      <div className="text-[10px] text-emerald-700">Ready for registration</div>
                    </div>

                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/70">
                      <div className="text-[10px] font-bold uppercase text-amber-800">
                        Warnings (Duplicates)
                      </div>
                      <div className="text-xl font-black text-amber-900 mt-0.5">
                        {validationReport.summary.warningCount}
                      </div>
                      <div className="text-[10px] text-amber-700">Choose Skip or Import Anyway</div>
                    </div>

                    <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/70">
                      <div className="text-[10px] font-bold uppercase text-rose-800">Errors</div>
                      <div className="text-xl font-black text-rose-900 mt-0.5">
                        {validationReport.summary.errorCount}
                      </div>
                      <div className="text-[10px] text-rose-700">
                        {validationReport.orphanIssues.length > 0
                          ? `+ ${validationReport.orphanIssues.length} child sheet issue(s)`
                          : 'Blocked from import'}
                      </div>
                    </div>
                  </div>

                  {/* Filter Bar & Error Report Download */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(['All', 'Valid', 'Warning', 'Error'] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => {
                            setStatusFilter(tab);
                            setCurrentPage(1);
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                            statusFilter === tab
                              ? 'bg-blue-700 text-white'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}

                      {validationReport.summary.warningCount > 0 && (
                        <div className="flex items-center space-x-1 ml-1 pl-2 border-l border-slate-300">
                          <button
                            type="button"
                            onClick={() => handleBulkWarningAction('skip')}
                            className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold"
                          >
                            Skip All Warnings
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBulkWarningAction('import')}
                            className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 text-[10px] font-bold"
                          >
                            Import All Warnings Anyway
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          value={previewSearch}
                          onChange={(e) => {
                            setPreviewSearch(e.target.value);
                            setCurrentPage(1);
                          }}
                          placeholder="Filter by Staff ID or Name..."
                          className="h-7.5 pl-8 pr-2.5 rounded border border-slate-300 bg-white text-xs w-48 sm:w-56"
                        />
                      </div>

                      {hasAnyFileErrors && (
                        <button
                          type="button"
                          onClick={() => generateErrorReportXlsx(validationReport)}
                          className="px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold flex items-center space-x-1.5 shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Error Report</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            <th className="p-2.5 w-14">Row</th>
                            <th className="p-2.5 w-24">Status</th>
                            <th className="p-2.5">Staff ID</th>
                            <th className="p-2.5">Full Name</th>
                            <th className="p-2.5">MDA / Department</th>
                            <th className="p-2.5">Grade Scale</th>
                            <th className="p-2.5 text-center">Cap / Skills / Mem</th>
                            <th className="p-2.5">Validation Notes / Decision</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedPreviewRows.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                                No rows match the current filter.
                              </td>
                            </tr>
                          ) : (
                            paginatedPreviewRows.map((row) => (
                              <tr key={row.rowNumber} className="hover:bg-slate-50">
                                <td className="p-2 font-mono text-slate-500">#{row.rowNumber}</td>
                                <td className="p-2">
                                  {row.status === 'Valid' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Valid
                                    </span>
                                  )}
                                  {row.status === 'Warning' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      Warning
                                    </span>
                                  )}
                                  {row.status === 'Error' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                                      <AlertCircle className="w-3 h-3 mr-1" />
                                      Error
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 font-mono font-bold text-slate-800">
                                  {row.staffId}
                                </td>
                                <td className="p-2">
                                  <div className="font-medium text-slate-900">{row.displayName}</div>
                                  <div className="text-[10px] font-mono text-slate-500">
                                    NIA: {row.normalized?.personal.nationalIdentificationNumber || row.rawRow.nationalIdentificationNumber || 'Pending'}
                                  </div>
                                </td>
                                <td className="p-2">
                                  <div className="font-semibold text-slate-800">{row.mdaDisplay}</div>
                                  <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                                    {row.departmentDisplay}
                                  </div>
                                </td>
                                <td className="p-2 text-slate-700 truncate max-w-[160px]">
                                  {row.gradeDisplay}
                                </td>
                                <td className="p-2 text-center font-mono text-slate-600">
                                  {row.normalized
                                    ? `${row.normalized.trainingCapabilities.length} / ${row.normalized.skills.length} / ${row.normalized.memberships.length}`
                                    : '—'}
                                </td>
                                <td className="p-2">
                                  {row.status === 'Valid' && (
                                    <span className="text-emerald-700">
                                      All checks passed • Retires{' '}
                                      <span className="font-mono font-semibold">
                                        {row.normalized?.employment.statutoryRetirementDate}
                                      </span>
                                      {(row.rawRow.otherContact || row.rawRow.firstGrade || row.rawRow.currentPromotionDate || row.rawRow.previousPosting) && (
                                        <span className="block text-[10px] text-slate-500 mt-0.5">
                                          {row.rawRow.otherContact && <>Contacts: {row.rawRow.otherContact} • </>}
                                          {row.rawRow.firstGrade && <>First Grade: {row.rawRow.firstGrade} • </>}
                                          {row.rawRow.currentPromotionDate && <>Promo: {row.rawRow.currentPromotionDate} • </>}
                                          {row.rawRow.previousPosting && <>Prev Posting: {row.rawRow.previousPosting}</>}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                  {row.status === 'Warning' && (
                                    <div className="space-y-1">
                                      <div className="text-amber-800 font-medium">
                                        {row.warnings.map((w) => w.message).join(' ')}
                                      </div>
                                      <div className="flex items-center space-x-1.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleWarningActionChange(row.rowNumber, 'skip')
                                          }
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                            row.warningAction === 'skip'
                                              ? 'bg-amber-700 text-white border-amber-700'
                                              : 'bg-white text-slate-700 border-slate-300'
                                          }`}
                                        >
                                          Skip
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleWarningActionChange(row.rowNumber, 'import')
                                          }
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                            row.warningAction === 'import'
                                              ? 'bg-blue-700 text-white border-blue-700'
                                              : 'bg-white text-slate-700 border-slate-300'
                                          }`}
                                        >
                                          Import Anyway
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  {row.status === 'Error' && (
                                    <div className="text-rose-700 space-y-0.5">
                                      {row.errors.slice(0, 2).map((err, idx) => (
                                        <div key={idx}>
                                          <strong>{err.column}:</strong> {err.message}
                                        </div>
                                      ))}
                                      {row.errors.length > 2 && (
                                        <div className="text-[10px] font-semibold">
                                          +{row.errors.length - 2} more issue(s)
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar */}
                    {filteredPreviewRows.length > PAGE_SIZE && (
                      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px]">
                        <span className="text-slate-600">
                          Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                          {Math.min(currentPage * PAGE_SIZE, filteredPreviewRows.length)} of{' '}
                          {filteredPreviewRows.length} rows
                        </span>
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
                          >
                            Prev
                          </button>
                          <span className="font-semibold">
                            Page {currentPage} / {totalPreviewPages}
                          </span>
                          <button
                            type="button"
                            disabled={currentPage >= totalPreviewPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPreviewPages, p + 1))}
                            className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Detailed Issues Breakdown */}
                  {validationReport.allIssues.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                      <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                          <FileWarning className="w-3.5 h-3.5 text-rose-600" />
                          <span>
                            Validation Issue Details ({validationReport.allIssues.length})
                          </span>
                        </span>
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {validationReport.allIssues.slice(0, 200).map((issue, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-1.5 flex items-start space-x-2 text-[11px]"
                          >
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 mt-0.5 ${
                                issue.severity === 'error'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {issue.severity}
                            </span>
                            <span className="font-mono text-slate-500 shrink-0">
                              {issue.sheet} Row #{issue.rowNumber}
                            </span>
                            <span className="font-mono font-bold text-slate-800 shrink-0">
                              [{issue.staffId}]
                            </span>
                            <span className="font-semibold text-slate-700 shrink-0">
                              {issue.column}:
                            </span>
                            <span className="text-slate-700">{issue.message}</span>
                          </div>
                        ))}
                        {validationReport.allIssues.length > 200 && (
                          <div className="p-2 text-center text-[11px] text-slate-500 bg-slate-50">
                            Showing first 200 issues. Click “Download Error Report” for the complete
                            list.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Empty State before file upload */}
              {!validationReport && !isProcessingFile && !uploadError && (
                <div className="p-10 text-center text-slate-400 border border-slate-200 rounded-xl bg-white">
                  <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="font-semibold text-slate-600">No workbook uploaded yet</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Download the template in Step 1, fill in your employee records, and upload the{' '}
                    <code className="font-mono">.xlsx</code> file above.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 3: REVIEW & IMPORT */}
          {/* ================================================================= */}
          {activeStep === 'review' && validationReport && (
            <div className="space-y-4 max-w-4xl mx-auto">
              {!importResult ? (
                <>
                  {/* Pre-Import Batch Plan */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70">
                      <div className="text-[10px] font-bold uppercase text-blue-800">
                        Records Queued to Import
                      </div>
                      <div className="text-2xl font-black text-blue-900 mt-1">
                        {importSummaryPlan.toImport}
                      </div>
                      <div className="text-[11px] text-blue-700 mt-0.5">
                        Valid rows + warnings set to Import Anyway
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70">
                      <div className="text-[10px] font-bold uppercase text-amber-800">
                        Skipped (Duplicate Warnings)
                      </div>
                      <div className="text-2xl font-black text-amber-900 mt-1">
                        {importSummaryPlan.toSkip}
                      </div>
                      <div className="text-[11px] text-amber-700 mt-0.5">
                        Will not overwrite or duplicate staff
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70">
                      <div className="text-[10px] font-bold uppercase text-rose-800">
                        Validation Errors
                      </div>
                      <div className="text-2xl font-black text-rose-900 mt-1">
                        {importSummaryPlan.errorCount}
                      </div>
                      <div className="text-[11px] text-rose-700 mt-0.5">
                        {importSummaryPlan.orphanCount > 0
                          ? `+ ${importSummaryPlan.orphanCount} orphan sheet errors`
                          : 'Excluded in valid-only mode'}
                      </div>
                    </div>
                  </div>

                  {/* Error Policy Selector */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Import Execution Policy
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`p-3 rounded-lg border cursor-pointer flex items-start space-x-2.5 transition-colors ${
                          importPolicy === 'valid_only'
                            ? 'border-blue-600 bg-blue-50/60'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importPolicy"
                          checked={importPolicy === 'valid_only'}
                          onChange={() => setImportPolicy('valid_only')}
                          disabled={isImporting}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-bold text-slate-900">
                            Import valid rows only (Default)
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            Imports all valid records and approved warnings in batches; skips invalid
                            rows and records all outcomes in the downloadable report.
                          </div>
                        </div>
                      </label>

                      <label
                        className={`p-3 rounded-lg border cursor-pointer flex items-start space-x-2.5 transition-colors ${
                          importPolicy === 'all_or_nothing'
                            ? 'border-blue-600 bg-blue-50/60'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importPolicy"
                          checked={importPolicy === 'all_or_nothing'}
                          onChange={() => setImportPolicy('all_or_nothing')}
                          disabled={isImporting}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-bold text-slate-900">Cancel if any errors</div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            Blocks the import completely unless zero validation errors exist across
                            all worksheets.
                          </div>
                        </div>
                      </label>
                    </div>

                    {importPolicy === 'all_or_nothing' && hasAnyFileErrors && (
                      <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2 text-[11px]">
                        <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                          Import is blocked because &ldquo;Cancel if any errors&rdquo; is selected and{' '}
                          {importSummaryPlan.errorCount + importSummaryPlan.orphanCount} error(s)
                          remain. Fix errors or switch to &ldquo;Import valid rows only&rdquo;.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Statutory Compliance & Audit Note */}
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-1">
                    <div className="font-bold text-slate-900">Pre-Save Integrity Guarantees:</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>
                        Uses exact Staff IDs from the Excel file (never auto-generated or overwritten).
                      </li>
                      <li>
                        Re-checks Staff ID uniqueness against the live database immediately before each
                        batch save.
                      </li>
                      <li>
                        Computes Statutory Retirement Date (earlier of 60 years of age or 35 years of
                        service).
                      </li>
                      <li>
                        Creates Qualification, Professional Memberships, Training Capabilities, and
                        Skills linked to each officer, and logs an immutable Audit Trail entry (
                        <code className="font-mono">source: Bulk Upload</code>).
                      </li>
                    </ul>
                  </div>

                  {importError && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{importError}</span>
                    </div>
                  )}

                  {/* Batch Progress Bar */}
                  {isImporting && importProgress && (
                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 space-y-2.5">
                      <div className="flex items-center justify-between font-bold text-blue-900">
                        <span className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
                          <span>
                            Importing Batch {importProgress.batchIndex} of{' '}
                            {importProgress.totalBatches}...
                          </span>
                        </span>
                        <span className="font-mono">
                          {importProgress.processed} / {importProgress.total}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-blue-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-700 transition-all duration-150"
                          style={{
                            width: `${
                              importProgress.total > 0
                                ? Math.round((importProgress.processed / importProgress.total) * 100)
                                : 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* ============================================================= */
                /* FINAL RESULT SCREEN */
                /* ============================================================= */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-emerald-950 text-sm">
                          Bulk Registration Complete
                        </div>
                        <div className="text-[11px] text-emerald-800">
                          Batch Reference: <code className="font-mono font-bold">{importResult.batchId}</code>{' '}
                          • Recorded in Civil Service Audit Trail
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => generateImportReportXlsx(importResult)}
                      className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center space-x-2 shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Import Report (.xlsx)</span>
                    </button>
                  </div>

                  {/* X Imported, Y Skipped, Z Failed */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl border border-emerald-200 bg-white text-center">
                      <div className="text-2xl font-black text-emerald-700">
                        {importResult.importedCount}
                      </div>
                      <div className="text-[11px] font-bold uppercase text-slate-600 mt-0.5">
                        Imported
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-amber-200 bg-white text-center">
                      <div className="text-2xl font-black text-amber-700">
                        {importResult.skippedCount}
                      </div>
                      <div className="text-[11px] font-bold uppercase text-slate-600 mt-0.5">
                        Skipped
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-rose-200 bg-white text-center">
                      <div className="text-2xl font-black text-rose-700">
                        {importResult.failedCount}
                      </div>
                      <div className="text-[11px] font-bold uppercase text-slate-600 mt-0.5">
                        Failed
                      </div>
                    </div>
                  </div>

                  {/* Outcome Ledger Table */}
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="p-2.5 w-14">Row</th>
                            <th className="p-2.5">Staff ID</th>
                            <th className="p-2.5">Full Name</th>
                            <th className="p-2.5 w-24">Result</th>
                            <th className="p-2.5">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedOutcomes.map((o, idx) => (
                            <tr key={`${o.rowNumber}-${idx}`} className="hover:bg-slate-50">
                              <td className="p-2 font-mono text-slate-500">#{o.rowNumber}</td>
                              <td className="p-2 font-mono font-bold text-slate-900">{o.staffId}</td>
                              <td className="p-2 font-medium text-slate-800">{o.fullName}</td>
                              <td className="p-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    o.result === 'Imported'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : o.result === 'Skipped'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {o.result}
                                </span>
                              </td>
                              <td className="p-2 text-slate-600">{o.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {importResult.outcomes.length > PAGE_SIZE && (
                      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px]">
                        <span className="text-slate-600">
                          Page {resultPage} of {totalResultPages} ({importResult.outcomes.length} total)
                        </span>
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            disabled={resultPage === 1}
                            onClick={() => setResultPage((p) => Math.max(1, p - 1))}
                            className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            disabled={resultPage >= totalResultPages}
                            onClick={() =>
                              setResultPage((p) => Math.min(totalResultPages, p + 1))
                            }
                            className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Navigation */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {!importResult && activeStep !== 'template' && (
              <button
                type="button"
                disabled={isImporting}
                onClick={() => setActiveStep(activeStep === 'review' ? 'upload' : 'template')}
                className="px-3 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold flex items-center space-x-1.5 disabled:opacity-40"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous Step</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {!importResult ? (
              <>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleCloseModal}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium disabled:opacity-40"
                >
                  Cancel
                </button>

                {activeStep === 'template' && (
                  <button
                    type="button"
                    onClick={() => setActiveStep('upload')}
                    className="px-4 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold flex items-center space-x-1.5"
                  >
                    <span>Next: Upload &amp; Validate</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {activeStep === 'upload' && (
                  <button
                    type="button"
                    disabled={!validationReport || isProcessingFile}
                    onClick={() => setActiveStep('review')}
                    className="px-4 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Next: Review &amp; Import</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {activeStep === 'review' && (
                  <button
                    type="button"
                    disabled={!canProceedToImport || isImporting}
                    onClick={handleStartImport}
                    className="px-5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {isImporting
                        ? 'Importing...'
                        : `Start Bulk Import (${importSummaryPlan.toImport})`}
                    </span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onImportCompleted();
                }}
                className="px-5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs"
              >
                Done &amp; Refresh Directory
              </button>
            )}
          </div>
        </div>
    </SlideOverPanel>
  );
};
