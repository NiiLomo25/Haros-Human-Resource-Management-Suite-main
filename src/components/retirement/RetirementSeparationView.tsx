/**
 * Haros HRMIS - Retirement & Separation Management Module (Section 14)
 * Manages 7 Separation Categories, Statutory 60-Year Retirement Horizon Forecast,
 * Multi-Unit Clearance Processing, Outstanding Leave Reconciliation, and Exit Execution.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  Hourglass,
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building2,
  ChevronRight,
  User,
  Users,
  Check,
  X,
  FileCheck,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Briefcase,
  FileText,
  Award,
  Edit2,
  Trash2,
} from 'lucide-react';
import { db } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import {
  SeparationRecord,
  SeparationType,
  ClearanceItem,
  ClearanceDepartmentUnit,
  Employee,
  Department,
  GradeLevel,
} from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';
import { BrandCrest } from '../common/BrandCrest';
import { useInstitutionInfo } from '../../hooks/useInstitutionInfo';

interface RetirementSeparationViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const RetirementSeparationView: React.FC<RetirementSeparationViewProps> = ({
  onSelectEmployee,
}) => {
  const { currentUser, hasPermission } = useAuth();
  const { institutionName, institutionCountry } = useInstitutionInfo();
  const [dataVersion, setDataVersion] = useState(0);

  // Active Tab: 'forecast' | 'records' | 'clearance'
  const [activeTab, setActiveTab] = useState<'forecast' | 'records'>('forecast');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [horizonMonths, setHorizonMonths] = useState<number>(12);

  // Selected Record for Clearance or Warrant Preview
  const [selectedSeparationId, setSelectedSeparationId] = useState<number | null>(null);
  const [showNewSeparationModal, setShowNewSeparationModal] = useState(false);
  const [editingSeparation, setEditingSeparation] = useState<SeparationRecord | null>(null);
  const [deletingSeparation, setDeletingSeparation] = useState<SeparationRecord | null>(null);
  const [confirmExecuteSeparation, setConfirmExecuteSeparation] = useState<SeparationRecord | null>(null);
  const [showWarrantModal, setShowWarrantModal] = useState<SeparationRecord | null>(null);
  const lastWarrantRef = useRef<SeparationRecord | null>(null);
  if (showWarrantModal) lastWarrantRef.current = showWarrantModal;
  const activeWarrantRecord = showWarrantModal || lastWarrantRef.current;

  // Data fetching
  const separationRecords = useMemo(() => db.getSeparationRecords(), [dataVersion]);
  const retirementForecast = useMemo(() => db.getRetirementForecast(horizonMonths), [horizonMonths, dataVersion]);
  const employees = useMemo(() => db.getEmployees(), [dataVersion]);
  const departments = useMemo(() => db.getDepartments(), []);
  const gradeLevels = useMemo(() => db.getGradeLevels(), []);

  // Filtered separation records
  const filteredRecords = useMemo(() => {
    return separationRecords.filter((rec) => {
      const emp = db.getEmployeeById(rec.employeeId);
      const personal = db.getEmployeePersonalInfo(rec.employeeId);
      const name = personal?.fullName || `${personal?.firstName} ${personal?.surname}`;

      const matchSearch =
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp?.staffId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.separationReference.toLowerCase().includes(searchTerm.toLowerCase());

      const matchType = typeFilter === 'All' || rec.separationType === typeFilter;
      return matchSearch && matchType;
    });
  }, [separationRecords, searchTerm, typeFilter]);

  // Selected Separation Detail
  const activeSeparationRecord = useMemo(() => {
    if (!selectedSeparationId) return null;
    return db.getSeparationRecordById(selectedSeparationId) || null;
  }, [selectedSeparationId, dataVersion]);

  const activeClearanceItems = useMemo(() => {
    if (!selectedSeparationId) return [];
    return db.getClearanceItems(selectedSeparationId);
  }, [selectedSeparationId, dataVersion]);

  // Handlers
  const handleClearanceToggle = (item: ClearanceItem) => {
    const newStatus = !item.isCleared;
    db.updateClearanceItem(
      item.id,
      {
        isCleared: newStatus,
        clearedByOfficer: newStatus ? `${currentUser?.fullName} (${currentUser?.username})` : undefined,
        clearanceDate: newStatus ? new Date().toISOString().split('T')[0] : undefined,
      },
      currentUser?.username || 'admin'
    );
    setDataVersion((prev) => prev + 1);
  };

  const handleConfirmExecuteSeparation = () => {
    if (!confirmExecuteSeparation) return;
    db.executeSeparation(confirmExecuteSeparation.id, currentUser?.username || 'admin');
    setConfirmExecuteSeparation(null);
    setDataVersion((prev) => prev + 1);
  };

  const handleConfirmDeleteSeparation = () => {
    if (!deletingSeparation) return;
    const res = db.deleteSeparationRecord(deletingSeparation.id, currentUser?.username || 'admin');
    if (!res.success) {
      notificationService.error('Delete Separation Blocked', res.message, {
        module: 'Retirement & Separation',
        actor: currentUser?.username,
      });
    } else if (selectedSeparationId === deletingSeparation.id) {
      setSelectedSeparationId(null);
    }
    setDeletingSeparation(null);
    setDataVersion((prev) => prev + 1);
  };

  const handleExportCsv = () => {
    const headers = [
      'Ref Number',
      'Staff ID',
      'Employee Name',
      'Separation Type',
      'Submission Date',
      'Effective Date',
      'Service Years',
      'Outstanding Leave (Days)',
      'Estimated Gratuity (GHS)',
      'Workflow Status',
    ];

    const rows = filteredRecords.map((r) => {
      const emp = db.getEmployeeById(r.employeeId);
      const personal = db.getEmployeePersonalInfo(r.employeeId);
      return [
        r.separationReference,
        emp?.staffId || '',
        `"${personal?.fullName || ''}"`,
        r.separationType,
        r.submissionDate,
        r.effectiveDate,
        r.yearsOfServiceAtSeparation,
        r.outstandingLeaveDays,
        r.gratuityEstimatedGhs || 0,
        r.status,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Civil_Service_Separation_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notificationService.success(
      'Separation Register Exported',
      `Exported ${filteredRecords.length} separation record(s) to CSV.`,
      { module: 'Retirement & Separation', actor: currentUser?.username }
    );
  };

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-rose-700 text-white flex items-center justify-center shadow-xs">
            <Hourglass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Retirement & Separation Management</h1>
            <p className="text-xs text-slate-500">
              Statutory 60-year retirement forecasts, resignation, exit clearances, and discharge warrants (Section 14)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {hasPermission('SEPARATION_MANAGE') && (
            <button
              onClick={() => setShowNewSeparationModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Initiate Separation Docket</span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Register (CSV)</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-200 text-xs">
        <button
          onClick={() => {
            setActiveTab('forecast');
            setSelectedSeparationId(null);
          }}
          className={`px-4 py-2 font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'forecast'
              ? 'border-rose-700 text-rose-800 bg-rose-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Statutory Retirement Forecast ({retirementForecast.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2 font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'records'
              ? 'border-rose-700 text-rose-800 bg-rose-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Separation & Exit Register ({separationRecords.length})</span>
        </button>
      </div>

      {/* TAB 1: RETIREMENT FORECAST HORIZON */}
      {activeTab === 'forecast' && (
        <div className="space-y-4">
          {/* Controls & Quick Horizon Selector */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-700">Forecast Horizon Threshold:</span>
              <div className="flex items-center space-x-1">
                {[3, 6, 12, 24].map((m) => (
                  <button
                    key={m}
                    onClick={() => setHorizonMonths(m)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                      horizonMonths === m
                        ? 'bg-rose-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Next {m} Months
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-slate-500">
              Statutory Threshold: <strong>60 Years of Age</strong> or <strong>35 Years of Pensionable Service</strong>
            </div>
          </div>

          {/* Forecast Officers Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {retirementForecast.map((item) => {
              const dept = departments.find((d) => d.id === item.employment.currentDepartmentId);
              const grade = gradeLevels.find((g) => g.id === item.employment.currentGradeId);
              const age = db.calculateAge(item.personal.dateOfBirth);
              const serviceYears = db.calculateTotalYearsOfService(item.employment.dateOfFirstAppointment);

              const isImmediate = item.monthsToRetirement <= 3;
              const hasSeparationDocket = separationRecords.some((s) => s.employeeId === item.employee.id);

              return (
                <div
                  key={item.employee.id}
                  className={`p-4 rounded-xl border bg-white space-y-3 shadow-xs transition-colors ${
                    isImmediate ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-900 text-sm">{item.personal.fullName}</h4>
                        {isImmediate && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 animate-pulse">
                            Immediate Action Required
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs text-blue-700 font-bold block mt-0.5">
                        {item.employee.staffId} • {dept?.departmentName}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                        item.monthsToRetirement <= 0
                          ? 'bg-rose-600 text-white'
                          : item.monthsToRetirement <= 6
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.monthsToRetirement <= 0
                        ? 'Overdue for Exit'
                        : `${item.monthsToRetirement} Month${item.monthsToRetirement !== 1 ? 's' : ''} Remaining`}
                    </span>
                  </div>

                  {/* Demographic & Career Facts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Current Age:</span>
                      <span className="font-bold text-slate-800">{age} Years</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Service Duration:</span>
                      <span className="font-bold text-slate-800">{serviceYears} Years</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Current Grade:</span>
                      <span className="font-bold text-blue-900">{grade?.gradeName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Statutory Date:</span>
                      <span className="font-mono font-bold text-rose-700">{item.statutoryDate}</span>
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <div className="text-[11px] text-slate-500">
                      {hasSeparationDocket ? (
                        <span className="text-emerald-700 font-semibold flex items-center">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Clearance Docket Active
                        </span>
                      ) : (
                        <span className="text-slate-400">Pre-separation notifications pending</span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {onSelectEmployee && (
                        <button
                          onClick={() => onSelectEmployee(item.employee.id)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px]"
                        >
                          Dossier
                        </button>
                      )}

                      {!hasSeparationDocket && hasPermission('SEPARATION_MANAGE') && (
                        <button
                          onClick={() => {
                            db.createSeparationRecord(
                              {
                                employeeId: item.employee.id,
                                separationType: 'Retirement',
                                submissionDate: new Date().toISOString().split('T')[0],
                                effectiveDate: item.statutoryDate,
                                reason: 'Statutory compulsory retirement upon reaching 60 years of age',
                                statutoryRetirementAge: 60,
                                yearsOfServiceAtSeparation: serviceYears,
                                outstandingLeaveDays: 20,
                                gratuityEstimatedGhs: Math.round(serviceYears * 2800),
                                status: 'Clearance In Progress',
                              },
                              currentUser?.username || 'admin'
                            );
                            setDataVersion((prev) => prev + 1);
                            setActiveTab('records');
                          }}
                          className="px-3 py-1 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold text-[11px] shadow-xs"
                        >
                          Initiate Retirement Docket
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {retirementForecast.length === 0 && (
              <div className="col-span-2 py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                No officers approaching statutory retirement within {horizonMonths} months.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SEPARATION & CLEARANCE REGISTER */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Search & Type Filters */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search docket, employee name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs rounded border border-slate-300 bg-white focus:outline-blue-600 w-56 sm:w-64"
                />
              </div>

              <div className="min-w-[170px]">
                <SearchableSelect
                  value={typeFilter}
                  onChange={(val) => setTypeFilter(val)}
                  options={[
                    { value: 'All', label: 'All Categories (7)' },
                    { value: 'Retirement', label: 'Retirement' },
                    { value: 'Voluntary Resignation', label: 'Voluntary Resignation' },
                    { value: 'Termination', label: 'Termination' },
                    { value: 'Dismissal', label: 'Dismissal' },
                    { value: 'Death', label: 'Death' },
                    { value: 'Contract Expiry', label: 'Contract Expiry' },
                    { value: 'Other Separation', label: 'Other Separation' },
                  ]}
                  placeholder="All Categories"
                  searchPlaceholder="Filter categories..."
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Docket Ref</th>
                    <th className="py-2.5 px-3">Officer Name</th>
                    <th className="py-2.5 px-3">Separation Category</th>
                    <th className="py-2.5 px-3">Effective Date</th>
                    <th className="py-2.5 px-3">Service Years</th>
                    <th className="py-2.5 px-3">Leave Due</th>
                    <th className="py-2.5 px-3">Workflow Status</th>
                    <th className="py-2.5 px-3 text-center">Clearance & Exit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((rec) => {
                    const emp = db.getEmployeeById(rec.employeeId);
                    const personal = db.getEmployeePersonalInfo(rec.employeeId);
                    const isSelected = selectedSeparationId === rec.id;

                    return (
                      <tr
                        key={rec.id}
                        className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-rose-50/50' : ''}`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-rose-800">{rec.separationReference}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">{personal?.fullName}</span>
                          <span className="font-mono text-[10px] text-blue-700">{emp?.staffId}</span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{rec.separationType}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{rec.effectiveDate}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">{rec.yearsOfServiceAtSeparation} yrs</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-800">{rec.outstandingLeaveDays} Days</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.status === 'Separation Executed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rec.status === 'Clearance Completed'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => setSelectedSeparationId(isSelected ? null : rec.id)}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-rose-100 hover:text-rose-800 text-slate-700 font-semibold text-[11px] transition-colors"
                            >
                              {isSelected ? 'Hide Clearance' : 'Clearance (6 Units)'}
                            </button>

                            {rec.status === 'Separation Executed' && (
                              <button
                                onClick={() => setShowWarrantModal(rec)}
                                className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold text-[11px]"
                              >
                                Warrant
                              </button>
                            )}

                            {rec.status === 'Clearance Completed' && hasPermission('SEPARATION_APPROVE') && (
                              <button
                                onClick={() => setConfirmExecuteSeparation(rec)}
                                className="px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold text-[11px]"
                              >
                                Execute Exit
                              </button>
                            )}

                            {rec.status !== 'Separation Executed' && hasPermission('SEPARATION_MANAGE') && (
                              <>
                                <button
                                  onClick={() => setEditingSeparation(rec)}
                                  className="p-1.5 rounded bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors"
                                  title="Edit separation docket"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeletingSeparation(rec)}
                                  className="p-1.5 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors"
                                  title="Delete unexecuted separation docket"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No separation records found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ACTIVE CLEARANCE INSPECTION PANEL */}
          {activeSeparationRecord && (
            <div className="p-5 bg-white rounded-xl border border-slate-300 shadow-md space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center">
                    <ShieldCheck className="w-4 h-4 text-rose-700 mr-2" />
                    Statutory Clearance Checklist — {activeSeparationRecord.separationReference}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mandatory sign-offs across 6 civil service directorates before terminal benefits and discharge warrant issuance
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-slate-600">
                    {activeClearanceItems.filter((i) => i.isCleared).length} of 6 Units Cleared
                  </span>
                  <button
                    onClick={() => setSelectedSeparationId(null)}
                    className="p-1 rounded text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Clearance Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeClearanceItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-lg border text-xs space-y-2 transition-colors ${
                      item.isCleared
                        ? 'bg-emerald-50/50 border-emerald-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-slate-900">{item.unitName}</span>
                      <button
                        onClick={() => handleClearanceToggle(item)}
                        className={`p-1.5 rounded-full flex items-center justify-center transition-colors ${
                          item.isCleared
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-400'
                        }`}
                        title={item.isCleared ? 'Mark Uncleared' : 'Grant Unit Clearance'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug">{item.remarks}</p>

                    {item.outstandingObligations && !item.isCleared && (
                      <div className="p-1.5 rounded bg-rose-50 border border-rose-200 text-rose-900 text-[10px] font-semibold">
                        Outstanding: {item.outstandingObligations}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      {item.isCleared ? (
                        <span className="text-emerald-800 font-medium">
                          Cleared by {item.clearedByOfficer} on {item.clearanceDate}
                        </span>
                      ) : (
                        <span>Pending institutional endorsement</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Clearance Summary Footer */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
                <div className="text-slate-600">
                  Estimated Terminal Gratuity: <strong>{activeSeparationRecord.gratuityEstimatedGhs ? `GHS ${activeSeparationRecord.gratuityEstimatedGhs.toLocaleString()}` : 'GHS 0'}</strong>
                </div>

                {activeSeparationRecord.status !== 'Separation Executed' && (
                  <button
                    disabled={activeClearanceItems.some((i) => !i.isCleared)}
                    onClick={() => setConfirmExecuteSeparation(activeSeparationRecord)}
                    className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-bold shadow-xs transition-colors"
                  >
                    Ratify All Clearances & Execute Separation
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DRAWER: INITIATE SEPARATION DOCKET */}
      <SlideOverPanel
        isOpen={showNewSeparationModal}
        onClose={() => setShowNewSeparationModal(false)}
        title="Initiate Civil Service Separation Docket"
        subtitle="Exit Request & 6-Unit Departmental Clearance Provisioning"
        icon={<Hourglass className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const employeeId = Number(form.employeeId.value);
            const employment = db.getEmployeeEmploymentInfo(employeeId);
            const serviceYears = employment ? db.calculateTotalYearsOfService(employment.dateOfFirstAppointment) : 10;

            db.createSeparationRecord(
              {
                employeeId,
                separationType: form.separationType.value as SeparationType,
                submissionDate: form.submissionDate.value,
                effectiveDate: form.effectiveDate.value,
                reason: form.reason.value.trim(),
                statutoryRetirementAge: 60,
                yearsOfServiceAtSeparation: serviceYears,
                outstandingLeaveDays: Number(form.outstandingLeaveDays.value),
                gratuityEstimatedGhs: Number(form.gratuityEstimatedGhs.value),
                status: 'Clearance In Progress',
                exitInterviewNotes: form.exitInterviewNotes.value.trim(),
              },
              currentUser?.username || 'admin'
            );

            setDataVersion((prev) => prev + 1);
            setShowNewSeparationModal(false);
            setActiveTab('records');
          }}
          className="flex-1 flex flex-col overflow-hidden text-xs"
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2.5">
              Registers a formal exit request, provisions the 6 departmental clearance checkpoints, and logs audit events.
            </p>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Select Officer</label>
              <select name="employeeId" required className="w-full p-2 rounded border border-slate-300 bg-white">
                {employees.map((emp) => {
                  const personal = db.getEmployeePersonalInfo(emp.id);
                  return (
                    <option key={emp.id} value={emp.id}>
                      {emp.staffId} — {personal?.fullName}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Separation Category</label>
                <select name="separationType" className="w-full p-2 rounded border border-slate-300 bg-white">
                  <option value="Retirement">Retirement (Statutory)</option>
                  <option value="Voluntary Resignation">Voluntary Resignation</option>
                  <option value="Termination">Termination</option>
                  <option value="Dismissal">Dismissal</option>
                  <option value="Death">Death (Post-Mortem Exit)</option>
                  <option value="Contract Expiry">Contract Expiry</option>
                  <option value="Other Separation">Other Separation</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Effective Separation Date</label>
                <input
                  name="effectiveDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full p-2 rounded border border-slate-300 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Submission Date</label>
                <input
                  name="submissionDate"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full p-2 rounded border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Outstanding Leave (Days)</label>
                <input
                  name="outstandingLeaveDays"
                  type="number"
                  defaultValue={15}
                  required
                  className="w-full p-2 rounded border border-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Estimated Gratuity / Terminal Benefits (GHS)</label>
              <input
                name="gratuityEstimatedGhs"
                type="number"
                defaultValue={45000}
                className="w-full p-2 rounded border border-slate-300"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Formal Justification / Grounds</label>
              <textarea
                name="reason"
                rows={2}
                required
                placeholder="e.g. Attainment of statutory retirement age of 60 years or formal resignation letter"
                className="w-full p-2 rounded border border-slate-300"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Exit Interview &amp; Handover Notes</label>
              <textarea
                name="exitInterviewNotes"
                rows={2}
                placeholder="Record summary of handover notes and knowledge transfer"
                className="w-full p-2 rounded border border-slate-300"
              />
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowNewSeparationModal(false)}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold"
            >
              Create Separation Docket
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* DRAWER: FORMAL DISCHARGE WARRANT & CERTIFICATE OF SERVICE */}
      <SlideOverPanel
        isOpen={Boolean(showWarrantModal)}
        onClose={() => setShowWarrantModal(null)}
        title="Official Warrant of Separation & Certificate of Service"
        subtitle={activeWarrantRecord ? `Ref: ${activeWarrantRecord.separationReference}` : 'Separation Certificate'}
        icon={<Award className="w-4 h-4" />}
        maxWidthClass="max-w-2xl"
        overlayClassName="bg-black/40"
      >
        {activeWarrantRecord && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Certificate Header */}
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                <BrandCrest
                  sizeClass="w-12 h-12"
                  className="mx-auto mb-1.5 border border-[#C9A24D] bg-white"
                />
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500">{institutionCountry}</div>
                <h2 className="text-lg font-extrabold text-slate-900">{institutionName}</h2>
                <div className="text-xs font-serif font-bold text-rose-800 uppercase tracking-wider">
                  Official Warrant of Separation &amp; Certificate of Service
                </div>
                <div className="text-[10px] font-mono text-slate-500">Ref: {activeWarrantRecord.separationReference}</div>
              </div>

              {/* Content Body */}
              {(() => {
                const emp = db.getEmployeeById(activeWarrantRecord.employeeId);
                const personal = db.getEmployeePersonalInfo(activeWarrantRecord.employeeId);
                const employment = db.getEmployeeEmploymentInfo(activeWarrantRecord.employeeId);
                const dept = departments.find((d) => d.id === employment?.currentDepartmentId);
                const grade = gradeLevels.find((g) => g.id === employment?.currentGradeId);

                return (
                  <div className="space-y-4 text-xs leading-relaxed text-slate-800 font-serif">
                    <p>
                      This is to formally certify that <strong>{personal?.fullName}</strong> (Staff ID: <code>{emp?.staffId}</code>)
                      has faithfully served the Government of the Republic of Ghana in the capacity of{' '}
                      <strong>{employment?.currentPositionTitle}</strong> within the <strong>{dept?.departmentName}</strong> at Grade Level{' '}
                      <strong>{grade?.gradeName}</strong>.
                    </p>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs font-sans space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Separation Mode:</span>
                          <span className="font-bold text-rose-900">{activeWarrantRecord.separationType}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Effective Date:</span>
                          <span className="font-mono font-bold text-slate-800">{activeWarrantRecord.effectiveDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Meritorious Service:</span>
                          <span className="font-bold text-slate-800">{activeWarrantRecord.yearsOfServiceAtSeparation} Years</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Departmental Clearance:</span>
                          <span className="font-bold text-emerald-800">Fully Satisfied (6 Units)</span>
                        </div>
                      </div>
                    </div>

                    <p className="italic text-slate-600">
                      "{activeWarrantRecord.exitInterviewNotes || 'Commended for unreserved institutional dedication and exemplary civil conduct.'}"
                    </p>

                    <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs font-sans">
                      <div className="border-t border-slate-400 pt-2">
                        <span className="font-bold block text-slate-900">Dr. K. A. Boateng</span>
                        <span className="text-[10px] text-slate-500">For: Head of the Civil Service</span>
                      </div>

                      <div className="border-t border-slate-400 pt-2">
                        <span className="font-bold block text-slate-900">Mrs. Janet Antwi</span>
                        <span className="text-[10px] text-slate-500">Director, Human Resource Management</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  notificationService.success(
                    'Discharge Warrant Print Prepared',
                    'Sent official Civil Service Discharge Warrant to the system print dialog.',
                    { module: 'Retirement & Separation', actor: currentUser?.username }
                  );
                  window.print();
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Discharge Warrant</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWarrantModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* DRAWER: EDIT SEPARATION DOCKET */}
      <SlideOverPanel
        isOpen={Boolean(editingSeparation)}
        onClose={() => setEditingSeparation(null)}
        title="Edit Separation & Exit Docket"
        subtitle={editingSeparation?.separationReference}
        icon={<Edit2 className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        {editingSeparation && (
          <form
            key={editingSeparation.id}
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              db.updateSeparationRecord(
                editingSeparation.id,
                {
                  separationType: form.separationType.value as SeparationType,
                  submissionDate: form.submissionDate.value,
                  effectiveDate: form.effectiveDate.value,
                  outstandingLeaveDays: Number(form.outstandingLeaveDays.value),
                  gratuityEstimatedGhs: Number(form.gratuityEstimatedGhs.value),
                  reason: form.reason.value.trim(),
                  exitInterviewNotes: form.exitInterviewNotes.value.trim(),
                },
                currentUser?.username || 'admin'
              );
              setEditingSeparation(null);
              setDataVersion((prev) => prev + 1);
            }}
            className="flex-1 flex flex-col overflow-hidden text-xs"
          >
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                Officer:{' '}
                <strong>{db.getEmployeePersonalInfo(editingSeparation.employeeId)?.fullName}</strong>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Separation Category</label>
                  <select
                    name="separationType"
                    defaultValue={editingSeparation.separationType}
                    className="w-full p-2 rounded border border-slate-300 bg-white"
                  >
                    <option value="Retirement">Retirement (Statutory)</option>
                    <option value="Voluntary Resignation">Voluntary Resignation</option>
                    <option value="Termination">Termination</option>
                    <option value="Dismissal">Dismissal</option>
                    <option value="Death">Death (Post-Mortem Exit)</option>
                    <option value="Contract Expiry">Contract Expiry</option>
                    <option value="Other Separation">Other Separation</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Effective Separation Date</label>
                  <input
                    name="effectiveDate"
                    type="date"
                    defaultValue={editingSeparation.effectiveDate}
                    required
                    className="w-full p-2 rounded border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Submission Date</label>
                  <input
                    name="submissionDate"
                    type="date"
                    defaultValue={editingSeparation.submissionDate}
                    required
                    className="w-full p-2 rounded border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Outstanding Leave (Days)</label>
                  <input
                    name="outstandingLeaveDays"
                    type="number"
                    defaultValue={editingSeparation.outstandingLeaveDays}
                    required
                    className="w-full p-2 rounded border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Estimated Gratuity (GHS)</label>
                <input
                  name="gratuityEstimatedGhs"
                  type="number"
                  defaultValue={editingSeparation.gratuityEstimatedGhs || 0}
                  className="w-full p-2 rounded border border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Formal Justification / Grounds</label>
                <textarea
                  name="reason"
                  rows={2}
                  defaultValue={editingSeparation.reason}
                  required
                  className="w-full p-2 rounded border border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Exit Interview &amp; Handover Notes</label>
                <textarea
                  name="exitInterviewNotes"
                  rows={2}
                  defaultValue={editingSeparation.exitInterviewNotes || ''}
                  className="w-full p-2 rounded border border-slate-300"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingSeparation(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold"
              >
                Save Docket Changes
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* DRAWER: DELETE SEPARATION DOCKET CONFIRMATION */}
      <SlideOverPanel
        isOpen={Boolean(deletingSeparation)}
        onClose={() => setDeletingSeparation(null)}
        title="Delete Separation Docket"
        subtitle={deletingSeparation?.separationReference}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingSeparation && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1.5">
                <div className="font-bold">
                  Delete separation docket {deletingSeparation.separationReference} for{' '}
                  {db.getEmployeePersonalInfo(deletingSeparation.employeeId)?.fullName}?
                </div>
                <p className="leading-relaxed">
                  This removes the docket and its 6 unit clearance items. Separations already executed onto the Nominal Roll are permanently locked.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingSeparation(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSeparation}
                className="px-4 py-1.5 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold"
              >
                Delete Docket
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* DRAWER: EXECUTE SEPARATION CONFIRMATION */}
      <SlideOverPanel
        isOpen={Boolean(confirmExecuteSeparation)}
        onClose={() => setConfirmExecuteSeparation(null)}
        title="Execute Formal Civil Service Separation"
        subtitle={confirmExecuteSeparation?.separationReference}
        icon={<AlertTriangle className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {confirmExecuteSeparation && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1.5">
                <div className="font-bold">
                  Finalize separation for {db.getEmployeePersonalInfo(confirmExecuteSeparation.employeeId)?.fullName}?
                </div>
                <p className="leading-relaxed">
                  This will transition the officer&apos;s employment status to Retired/Separated, vacate their occupied establishment post, and issue their statutory Discharge Warrant.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmExecuteSeparation(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExecuteSeparation}
                className="px-4 py-1.5 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold"
              >
                Execute &amp; Issue Warrant
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
