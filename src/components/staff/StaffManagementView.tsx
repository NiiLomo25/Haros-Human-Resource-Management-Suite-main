/**
 * Haros HRMIS - Staff Management & Nominal Roll View
 * Complete Civil Service Employee Directory with Multi-cadre (Professional / Sub-Professional) filtering,
 * advanced search, CSV Nominal Roll export, and drill-down into master dossiers.
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Download,
  Building2,
  ChevronRight,
  Shield,
  Eye,
  Edit3,
  Briefcase,
  GraduationCap,
  Calendar,
  Layers,
  ArrowUpDown,
  RefreshCw,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { db } from '../../db/storage';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  Employee,
  EmployeePersonalInfo,
  EmployeeEmploymentInfo,
  EmployeeCategory,
  EmploymentStatus,
} from '../../types';
import { StaffRegistrationModal } from './StaffRegistrationModal';
import { BulkRegistrationModal } from './BulkRegistrationModal';
import { StaffDossierView } from './StaffDossierView';
import { SearchableSelect } from '../common/SearchableSelect';

interface StaffManagementViewProps {
  initialEmployeeId?: number | null;
  onSelectEmployee?: (empId: number) => void;
  onInitiateMovement?: (empId: number) => void;
}

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({
  initialEmployeeId = null,
  onInitiateMovement,
}) => {
  const { currentUser, hasPermission } = useAuth();
  const notifications = useNotifications();

  // Internal selection state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(initialEmployeeId);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMdaId, setFilterMdaId] = useState<string>('all');
  const [filterDeptId, setFilterDeptId] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterGradeId, setFilterGradeId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<'staffId' | 'fullName' | 'grade' | 'department'>('staffId');
  const [sortAsc, setSortAsc] = useState(true);

  // Load lookup data
  const mdas = useMemo(() => db.getMdas(), []);
  const departments = useMemo(() => db.getDepartments(), [dataVersion]);
  const gradeLevels = useMemo(() => db.getGradeLevels(), []);

  // Fetch all staff records combined
  const staffList = useMemo(() => {
    const rawEmployees = db.getEmployees();
    return rawEmployees.map((emp) => {
      const personal = db.getEmployeePersonalInfo(emp.id);
      const employment = db.getEmployeeEmploymentInfo(emp.id);
      const dept = departments.find((d) => d.id === employment?.currentDepartmentId);
      const mda = mdas.find((m) => m.id === employment?.currentMdaId);
      const grade = gradeLevels.find((g) => g.id === employment?.currentGradeId);
      const firstGrade = gradeLevels.find((g) => g.id === employment?.firstGradeId);

      const fullName = personal?.fullName || `${personal?.firstName || ''} ${personal?.surname || ''}`.trim() || 'Unnamed Officer';

      return {
        employee: emp,
        personal,
        employment,
        dept,
        mda,
        grade,
        firstGrade,
        fullName,
      };
    });
  }, [dataVersion, departments, mdas, gradeLevels]);

  // Filtered & Sorted Staff
  const filteredStaff = useMemo(() => {
    return staffList.filter((item) => {
      // Search text filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesStaffId = item.employee.staffId.toLowerCase().includes(query);
        const matchesName = item.fullName.toLowerCase().includes(query);
        const matchesNin = item.personal?.nationalIdentificationNumber?.toLowerCase().includes(query) || false;
        const matchesPhone = item.personal?.telephoneNumber?.includes(query) || false;
        const matchesOtherContacts =
          item.personal?.otherContacts?.some((c) => c.toLowerCase().includes(query)) || false;
        const matchesFirstGrade = item.firstGrade?.gradeName.toLowerCase().includes(query) || false;
        const matchesPrevPosting = item.employment?.previousPosting?.toLowerCase().includes(query) || false;
        const matchesEmail = item.personal?.emailAddress?.toLowerCase().includes(query) || false;
        if (!matchesStaffId && !matchesName && !matchesNin && !matchesPhone && !matchesOtherContacts && !matchesFirstGrade && !matchesPrevPosting && !matchesEmail) {
          return false;
        }
      }

      // MDA filter
      if (filterMdaId !== 'all') {
        if (item.employment?.currentMdaId?.toString() !== filterMdaId) return false;
      }

      // Department filter
      if (filterDeptId !== 'all') {
        if (item.employment?.currentDepartmentId?.toString() !== filterDeptId) return false;
      }

      // Category filter (Professional vs Sub-Professional vs others)
      if (filterCategory !== 'all') {
        if (item.employment?.employeeCategory !== filterCategory) return false;
      }

      // Grade filter
      if (filterGradeId !== 'all') {
        if (item.employment?.currentGradeId?.toString() !== filterGradeId) return false;
      }

      // Status filter
      if (filterStatus !== 'all') {
        if (item.employment?.currentEmploymentStatus !== filterStatus) return false;
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'staffId') {
        comparison = a.employee.staffId.localeCompare(b.employee.staffId);
      } else if (sortField === 'fullName') {
        comparison = a.fullName.localeCompare(b.fullName);
      } else if (sortField === 'grade') {
        const rankA = a.grade?.hierarchyRank || 999;
        const rankB = b.grade?.hierarchyRank || 999;
        comparison = rankA - rankB;
      } else if (sortField === 'department') {
        comparison = (a.dept?.departmentName || '').localeCompare(b.dept?.departmentName || '');
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [staffList, searchTerm, filterMdaId, filterDeptId, filterCategory, filterGradeId, filterStatus, sortField, sortAsc]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = staffList.length;
    const professional = staffList.filter((s) => s.employment?.employeeCategory === 'Professional').length;
    const subProfessional = staffList.filter((s) => s.employment?.employeeCategory === 'Sub-Professional').length;
    const technicalAndOther = total - professional - subProfessional;
    const active = staffList.filter((s) => s.employment?.currentEmploymentStatus === 'Active').length;
    const males = staffList.filter((s) => s.personal?.gender === 'Male').length;
    const females = staffList.filter((s) => s.personal?.gender === 'Female').length;
    return { total, professional, subProfessional, technicalAndOther, active, males, females };
  }, [staffList]);

  // Export Nominal Roll as CSV
  const handleExportNominalRoll = () => {
    const headers = [
      'Staff ID',
      'Full Name',
      'Gender',
      'Date of Birth',
      'NIN',
      'MDA Code',
      'MDA Name',
      'Department Code',
      'Department Name',
      'Cadre Category',
      'Grade Level',
      'Position Title',
      'Salary Step',
      'Date of First Appointment',
      'Statutory Retirement Date',
      'Status',
      'Telephone',
      'Other Contacts',
      'First Grade',
      'Current Promotion Date',
      'Previous Posting',
    ];

    const rows = filteredStaff.map((s) => [
      `"${s.employee.staffId}"`,
      `"${s.fullName}"`,
      `"${s.personal?.gender || ''}"`,
      `"${s.personal?.dateOfBirth || ''}"`,
      `"${s.personal?.nationalIdentificationNumber || ''}"`,
      `"${s.mda?.code || ''}"`,
      `"${s.mda?.name || ''}"`,
      `"${s.dept?.departmentCode || ''}"`,
      `"${s.dept?.departmentName || ''}"`,
      `"${s.employment?.employeeCategory || ''}"`,
      `"${s.grade?.gradeName || ''}"`,
      `"${s.employment?.currentPositionTitle || ''}"`,
      `"${s.employment?.currentSalaryStep || 1}"`,
      `"${s.employment?.dateOfFirstAppointment || ''}"`,
      `"${s.employment?.statutoryRetirementDate || ''}"`,
      `"${s.employment?.currentEmploymentStatus || 'Active'}"`,
      `"${s.personal?.telephoneNumber || ''}"`,
      `"${(s.personal?.otherContacts || []).join('; ')}"`,
      `"${s.firstGrade?.gradeName || ''}"`,
      `"${s.employment?.currentPromotionDate || ''}"`,
      `"${s.employment?.previousPosting || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Nominal_Roll_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notifications.success(
      'Nominal Roll Exported',
      `Exported ${filteredStaff.length} staff record(s) to CSV.`,
      { module: 'Staff Management', actor: currentUser?.username }
    );
  };

  // If viewing a specific dossier, render the master dossier view
  if (selectedEmployeeId !== null) {
    return (
      <StaffDossierView
        employeeId={selectedEmployeeId}
        onBack={() => {
          setSelectedEmployeeId(null);
          setDataVersion((v) => v + 1);
        }}
        onInitiateMovement={onInitiateMovement}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>HRMIS Core</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-blue-700">Staff Management</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center">
            <Users className="w-5 h-5 mr-2 text-blue-700" />
            Civil Service Staff Directory & Nominal Roll
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Central repository of civil service personnel across all MDAs, directorates, and units.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportNominalRoll}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            title="Download Nominal Roll as CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Nominal Roll</span>
          </button>

          {hasPermission('staff.create') && (
            <>
              <button
                onClick={() => setShowBulkModal(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-white hover:bg-blue-50 border border-blue-600 text-blue-700 text-xs font-semibold shadow-xs transition-colors"
                title="Bulk register up to 1,000 officers from Excel template"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-700" />
                <span>Bulk Register</span>
              </button>

              <button
                onClick={() => setShowRegisterModal(true)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register New Employee</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cadre & Personnel Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Nominal Roll</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>
            {metrics.active} Active Officers
          </div>
        </div>

        <div className="bg-blue-50/60 rounded-lg border border-blue-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-800 uppercase flex items-center justify-between">
            <span>Professional Cadre</span>
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-1">{metrics.professional}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">
            {metrics.total > 0 ? ((metrics.professional / metrics.total) * 100).toFixed(1) : 0}% of workforce
          </div>
        </div>

        <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase flex items-center justify-between">
            <span>Sub-Professional Cadre</span>
            <Briefcase className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{metrics.subProfessional}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">
            {metrics.total > 0 ? ((metrics.subProfessional / metrics.total) * 100).toFixed(1) : 0}% of workforce
          </div>
        </div>

        <div className="bg-purple-50/60 rounded-lg border border-purple-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-purple-800 uppercase">Technical & Others</div>
          <div className="text-2xl font-black text-purple-900 mt-1">{metrics.technicalAndOther}</div>
          <div className="text-[10px] text-purple-700 mt-0.5">Support & Admin staff</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Gender Distribution</div>
          <div className="text-sm font-bold text-slate-800 mt-2 flex items-center justify-between">
            <span className="text-blue-700">Male: {metrics.males}</span>
            <span className="text-pink-600">Female: {metrics.females}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 flex overflow-hidden">
            <div
              className="bg-blue-600 h-full"
              style={{ width: `${metrics.total > 0 ? (metrics.males / metrics.total) * 100 : 50}%` }}
            ></div>
            <div
              className="bg-pink-500 h-full"
              style={{ width: `${metrics.total > 0 ? (metrics.females / metrics.total) * 100 : 50}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Advanced Filter & Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Staff ID (e.g. EMP-1001), Full Name, NIN, Phone, or Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500 shrink-0">
            <span>Showing:</span>
            <span className="font-bold text-slate-800">{filteredStaff.length}</span>
            <span>of {staffList.length}</span>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* MDA Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              MDA
            </label>
            <SearchableSelect
              value={filterMdaId}
              onChange={(val) => {
                setFilterMdaId(val);
                setFilterDeptId('all');
              }}
              options={[
                { value: 'all', label: 'All MDAs' },
                ...mdas.map((m) => ({
                  value: m.id.toString(),
                  label: `${m.code} - ${m.name}`,
                  subLabel: m.mdaType,
                })),
              ]}
              placeholder="All MDAs"
              searchPlaceholder="Filter MDAs..."
            />
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Department
            </label>
            <SearchableSelect
              value={filterDeptId}
              onChange={(val) => setFilterDeptId(val)}
              options={[
                { value: 'all', label: 'All Departments' },
                ...departments
                  .filter((d) => filterMdaId === 'all' || d.mdaId.toString() === filterMdaId)
                  .map((d) => ({
                    value: d.id.toString(),
                    label: `${d.departmentCode} - ${d.departmentName}`,
                  })),
              ]}
              placeholder="All Departments"
              searchPlaceholder="Filter departments..."
            />
          </div>

          {/* Cadre Categorization Filter: Professional vs Sub-Professional */}
          <div>
            <label className="block text-[10px] font-semibold text-blue-800 uppercase mb-1">
              Cadre Categorization
            </label>
            <SearchableSelect
              value={filterCategory}
              onChange={(val) => setFilterCategory(val)}
              options={[
                { value: 'all', label: 'All Cadres' },
                { value: 'Professional', label: 'Professional Cadre', badge: 'Tier 1' },
                { value: 'Sub-Professional', label: 'Sub-Professional Cadre', badge: 'Tier 2' },
                { value: 'Technical', label: 'Technical Cadre' },
                { value: 'Administrative', label: 'Administrative Cadre' },
                { value: 'Consultant', label: 'Consultant' },
              ]}
              placeholder="All Cadres"
              searchPlaceholder="Filter cadres..."
              buttonClassName="h-8 px-2.5 py-1.5 bg-blue-50/50 border border-blue-200 rounded text-slate-800 text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Grade Level Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Grade Level
            </label>
            <SearchableSelect
              value={filterGradeId}
              onChange={(val) => setFilterGradeId(val)}
              options={[
                { value: 'all', label: 'All Grades' },
                ...gradeLevels.map((g) => ({
                  value: g.id.toString(),
                  label: g.gradeName,
                })),
              ]}
              placeholder="All Grades"
              searchPlaceholder="Filter position titles..."
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Employment Status
            </label>
            <SearchableSelect
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'Active', label: 'Active Duty' },
                { value: 'On Probation', label: 'On Probation' },
                { value: 'On Study Leave', label: 'On Study Leave' },
                { value: 'On Secondment', label: 'On Secondment' },
                { value: 'Interdicted', label: 'Interdicted' },
                { value: 'Suspended', label: 'Suspended' },
                { value: 'Retired', label: 'Retired / Separated' },
              ]}
              placeholder="All Statuses"
              searchPlaceholder="Filter status..."
            />
          </div>
        </div>
      </div>

      {/* Staff Nominal Roll Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                <th
                  onClick={() => {
                    if (sortField === 'staffId') setSortAsc(!sortAsc);
                    else {
                      setSortField('staffId');
                      setSortAsc(true);
                    }
                  }}
                  className="p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Staff ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    if (sortField === 'fullName') setSortAsc(!sortAsc);
                    else {
                      setSortField('fullName');
                      setSortAsc(true);
                    }
                  }}
                  className="p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Officer Name & Title</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3">Cadre Category</th>
                <th
                  onClick={() => {
                    if (sortField === 'department') setSortAsc(!sortAsc);
                    else {
                      setSortField('department');
                      setSortAsc(true);
                    }
                  }}
                  className="p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>MDA & Department</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    if (sortField === 'grade') setSortAsc(!sortAsc);
                    else {
                      setSortField('grade');
                      setSortAsc(true);
                    }
                  }}
                  className="p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Grade & Rank</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3">Contact</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-slate-600">No civil service officers found matching criteria.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try resetting filters or adjusting search keywords.</p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((item) => {
                  const emp = item.employee;
                  const pers = item.personal;
                  const empInfo = item.employment;
                  const dept = item.dept;
                  const mda = item.mda;
                  const grade = item.grade;
                  const isProfessional = empInfo?.employeeCategory === 'Professional';
                  const isSubProfessional = empInfo?.employeeCategory === 'Sub-Professional';

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                      onClick={() => setSelectedEmployeeId(emp.id)}
                    >
                      {/* Staff ID */}
                      <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {emp.staffId}
                      </td>

                      {/* Officer Name & Position */}
                      <td className="p-3">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              pers?.gender === 'Female'
                                ? 'bg-pink-100 text-pink-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {pers?.firstName?.[0] || 'E'}
                            {pers?.surname?.[0] || 'M'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                              {item.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {empInfo?.currentPositionTitle || 'Civil Service Officer'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cadre Category */}
                      <td className="p-3 whitespace-nowrap">
                        {isProfessional ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <GraduationCap className="w-3 h-3 mr-1 text-blue-600" />
                            Professional
                          </span>
                        ) : isSubProfessional ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Briefcase className="w-3 h-3 mr-1 text-amber-600" />
                            Sub-Professional
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {empInfo?.employeeCategory || 'General'}
                          </span>
                        )}
                      </td>

                      {/* MDA & Department — MDA name primary, department beneath */}
                      <td className="p-3">
                        <div className="font-medium text-slate-800">
                          {mda?.name || 'Central Ministry'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {dept?.departmentName || 'General Administration'}
                          {mda?.code ? ` (${mda.code})` : ''}
                        </div>
                      </td>

                      {/* Grade & Step */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {grade?.gradeName || 'Officer'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Step {empInfo?.currentSalaryStep || 1}
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="p-3 whitespace-nowrap text-slate-600">
                        {pers?.telephoneNumber && (
                          <div className="flex items-center space-x-1 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{pers.telephoneNumber}</span>
                            {pers.otherContacts && pers.otherContacts.length > 0 && (
                              <span
                                className="px-1 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold"
                                title={`Other contacts: ${pers.otherContacts.join(', ')}`}
                              >
                                +{pers.otherContacts.length}
                              </span>
                            )}
                          </div>
                        )}
                        {pers?.emailAddress && (
                          <div className="flex items-center space-x-1 text-[10px] text-slate-500 truncate max-w-[130px]">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{pers.emailAddress}</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            empInfo?.currentEmploymentStatus === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : empInfo?.currentEmploymentStatus === 'On Study Leave'
                              ? 'bg-blue-100 text-blue-800'
                              : empInfo?.currentEmploymentStatus === 'On Secondment'
                              ? 'bg-purple-100 text-purple-800'
                              : empInfo?.currentEmploymentStatus === 'Interdicted'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              empInfo?.currentEmploymentStatus === 'Active'
                                ? 'bg-emerald-500'
                                : empInfo?.currentEmploymentStatus === 'On Study Leave'
                                ? 'bg-blue-500'
                                : empInfo?.currentEmploymentStatus === 'On Secondment'
                                ? 'bg-purple-500'
                                : empInfo?.currentEmploymentStatus === 'Interdicted'
                                ? 'bg-red-500'
                                : 'bg-slate-400'
                            }`}
                          ></span>
                          {empInfo?.currentEmploymentStatus || 'Active'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {hasPermission('STAFF_EDIT') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEmployeeId(item.employee.id);
                              }}
                              title="Edit Employee Record (4-Step Wizard)"
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center space-x-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmployeeId(item.employee.id);
                            }}
                            className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-700 hover:text-white text-blue-700 text-xs font-semibold transition-colors flex items-center space-x-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Dossier</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Registration / Edit Sliding Panel */}
      <StaffRegistrationModal
        isOpen={showRegisterModal || editingEmployeeId !== null}
        employeeId={editingEmployeeId}
        onClose={() => {
          setShowRegisterModal(false);
          setEditingEmployeeId(null);
        }}
        onRegistered={(staffId) => {
          setShowRegisterModal(false);
          setEditingEmployeeId(null);
          setDataVersion((v) => v + 1);
          // Look up employee and open their dossier immediately
          const all = db.getEmployees();
          const target = all.find((e) => e.staffId === staffId);
          if (target) {
            setSelectedEmployeeId(target.id);
          }
        }}
      />
      {/* Bulk Registration Sliding Panel */}
      <BulkRegistrationModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onImportCompleted={() => {
          setShowBulkModal(false);
          setDataVersion((v) => v + 1);
        }}
      />
    </div>
  );
};
