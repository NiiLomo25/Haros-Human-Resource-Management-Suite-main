/**
 * Haros HRMIS - Executive Dashboard & Analytics
 * Aligned with Section 17 of Project Master Prompt
 * Live calculated metrics from the relational database with multi-dimensional filtering
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  Building2,
  Scale,
  Hourglass,
  ArrowRightLeft,
  Award,
  Filter,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  Calendar,
  Briefcase,
  PieChart as PieChartIcon,
  BarChart3,
  GraduationCap,
} from 'lucide-react';
import { db } from '../../db/storage';
import { NavModuleId } from '../layout/NavigationSidebar';
import { SearchableSelect } from '../common/SearchableSelect';
import { BrandCrest } from '../common/BrandCrest';

interface DashboardViewProps {
  onNavigate: (module: NavModuleId) => void;
  onSelectEmployee?: (employeeId: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onSelectEmployee }) => {
  // Filter States
  const [selectedMdaId, setSelectedMdaId] = useState<string>('ALL');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [selectedGender, setSelectedGender] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Raw Database Entities
  const mdas = useMemo(() => db.getMdas(), [refreshTrigger]);
  const departments = useMemo(() => db.getDepartments(), [refreshTrigger]);
  const gradeLevels = useMemo(() => db.getGradeLevels(), [refreshTrigger]);
  const establishment = useMemo(() => db.getEstablishmentPositions(), [refreshTrigger]);
  const movements = useMemo(() => db.getStaffMovements(), [refreshTrigger]);
  const movementHistory = useMemo(() => db.getStaffMovementHistory(), [refreshTrigger]);

  // Filtered Departments based on selected MDA
  const availableDepts = useMemo(() => {
    if (selectedMdaId === 'ALL') return departments;
    return departments.filter((d) => d.mdaId === Number(selectedMdaId));
  }, [departments, selectedMdaId]);

  // Aggregate Employees with their relational details
  const employeesFull = useMemo(() => {
    const rawEmployees = db.getEmployees();
    return rawEmployees.map((emp) => {
      const personal = db.getEmployeePersonalInfo(emp.id);
      const employment = db.getEmployeeEmploymentInfo(emp.id);
      const age = personal ? db.calculateAge(personal.dateOfBirth) : 0;
      const yearsInGrade = employment ? db.calculateYearsInCurrentGrade(employment.dateAssignedCurrentGrade) : 0;
      const yearsOfService = employment ? db.calculateTotalYearsOfService(employment.dateOfFirstAppointment) : 0;
      const monthsToRetirement = employment ? db.calculateMonthsToRetirement(employment.statutoryRetirementDate) : 999;

      return {
        ...emp,
        personal,
        employment,
        age,
        yearsInGrade,
        yearsOfService,
        monthsToRetirement,
      };
    });
  }, [refreshTrigger]);

  // Apply User Filters
  const filteredEmployees = useMemo(() => {
    return employeesFull.filter((emp) => {
      if (!emp.personal || !emp.employment) return false;
      if (selectedMdaId !== 'ALL' && emp.employment.currentMdaId !== Number(selectedMdaId)) return false;
      if (selectedDeptId !== 'ALL' && emp.employment.currentDepartmentId !== Number(selectedDeptId)) return false;
      if (selectedGender !== 'ALL' && emp.personal.gender !== selectedGender) return false;
      if (selectedStatus !== 'ALL' && emp.employment.currentEmploymentStatus !== selectedStatus) return false;
      if (selectedCategory !== 'ALL' && emp.employment.employeeCategory !== selectedCategory) return false;
      return true;
    });
  }, [employeesFull, selectedMdaId, selectedDeptId, selectedGender, selectedStatus, selectedCategory]);

  // KPI Calculations
  const totalCount = filteredEmployees.length;
  const activeCount = filteredEmployees.filter((e) => e.employment?.currentEmploymentStatus === 'Active').length;
  const maleCount = filteredEmployees.filter((e) => e.personal?.gender === 'Male').length;
  const femaleCount = filteredEmployees.filter((e) => e.personal?.gender === 'Female').length;
  const malePct = totalCount > 0 ? Math.round((maleCount / totalCount) * 100) : 0;
  const femalePct = totalCount > 0 ? Math.round((femaleCount / totalCount) * 100) : 0;

  // Staff Categorization: Professional vs Sub-Professional metrics
  const professionalCount = filteredEmployees.filter(
    (e) => e.employment?.employeeCategory === 'Professional'
  ).length;
  const subProfessionalCount = filteredEmployees.filter(
    (e) => e.employment?.employeeCategory === 'Sub-Professional'
  ).length;
  const professionalPct = totalCount > 0 ? Math.round((professionalCount / totalCount) * 100) : 0;
  const subProfessionalPct = totalCount > 0 ? Math.round((subProfessionalCount / totalCount) * 100) : 0;

  // Early Warning & Operational Queues
  const retiringWithin1Year = filteredEmployees.filter(
    (e) => e.monthsToRetirement >= 0 && e.monthsToRetirement <= 12
  );
  const retiringWithin3Years = filteredEmployees.filter(
    (e) => e.monthsToRetirement > 12 && e.monthsToRetirement <= 36
  );
  const eligibleForPromotion = filteredEmployees.filter(
    (e) => e.yearsInGrade >= 3 && e.employment?.currentEmploymentStatus === 'Active'
  );
  const pendingMovements = movements.filter(
    (m) => m.workflowStatus === 'Draft' || m.workflowStatus === 'Submitted' || m.workflowStatus === 'Under Review'
  );

  // Cadre & Establishment Metrics
  const totalApprovedCadre = establishment.reduce((acc, curr) => acc + curr.approvedCadreQuota, 0);
  const occupiedCadre = activeCount;
  const vacantCadre = Math.max(0, totalApprovedCadre - occupiedCadre);

  // Departmental Staff Strength aggregation
  const deptBreakdown = useMemo(() => {
    const map = new Map<number, number>();
    filteredEmployees.forEach((emp) => {
      const dId = emp.employment?.currentDepartmentId;
      if (dId) {
        map.set(dId, (map.get(dId) || 0) + 1);
      }
    });

    return Array.from(map.entries()).map(([deptId, count]) => {
      const dept = departments.find((d) => d.id === deptId);
      return {
        id: deptId,
        name: dept?.departmentName || 'Unknown Directorate',
        code: dept?.departmentCode || 'N/A',
        count,
      };
    }).sort((a, b) => b.count - a.count);
  }, [filteredEmployees, departments]);

  // Grade Hierarchy aggregation
  const gradeBreakdown = useMemo(() => {
    const tiers = {
      executive: { label: 'Directorate & Senior Executive', count: 0 },
      senior: { label: 'Senior Officers', count: 0 },
      middle: { label: 'Middle Management', count: 0 },
      junior: { label: 'Junior & Clerical Staff', count: 0 },
    };

    filteredEmployees.forEach((emp) => {
      const grade = gradeLevels.find((g) => g.id === emp.employment?.currentGradeId);
      if (grade) {
        if (grade.hierarchyRank >= 18) tiers.executive.count++;
        else if (grade.hierarchyRank >= 15) tiers.senior.count++;
        else if (grade.hierarchyRank >= 10) tiers.middle.count++;
        else tiers.junior.count++;
      }
    });

    return Object.values(tiers);
  }, [filteredEmployees, gradeLevels]);

  const handleResetFilters = () => {
    setSelectedMdaId('ALL');
    setSelectedDeptId('ALL');
    setSelectedGender('ALL');
    setSelectedStatus('ALL');
    setSelectedCategory('ALL');
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto pb-10">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <BrandCrest
            sizeClass="w-10 h-10"
            className="border border-[#C9A24D]/70 bg-white shadow-xs"
          />
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
              <span>Haros HRMIS</span>
              <span>/</span>
              <span className="text-slate-800">Executive Dashboard</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
              Civil Service Human Capital Overview
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh Metrics</span>
          </button>

          <button
            onClick={() => onNavigate('movements')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-700 text-white hover:bg-blue-800 shadow-xs transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Staff Movement Center</span>
          </button>
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar (Section 17 Requirement) */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 mb-2">
          <Filter className="w-3.5 h-3.5 text-blue-600" />
          <span>Dashboard Filters (Real-time DB Query)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Ministry / Agency (MDA)
            </label>
            <SearchableSelect
              value={selectedMdaId}
              onChange={(val) => {
                setSelectedMdaId(val);
                setSelectedDeptId('ALL');
              }}
              options={[
                { value: 'ALL', label: `All MDAs (${mdas.length})` },
                ...mdas.map((m) => ({
                  value: m.id.toString(),
                  label: `${m.code} - ${m.name}`,
                })),
              ]}
              placeholder="All MDAs"
              searchPlaceholder="Filter MDAs..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Department / Directorate
            </label>
            <SearchableSelect
              value={selectedDeptId}
              onChange={(val) => setSelectedDeptId(val)}
              options={[
                { value: 'ALL', label: 'All Departments' },
                ...availableDepts.map((d) => ({
                  value: d.id.toString(),
                  label: d.departmentName,
                })),
              ]}
              placeholder="All Departments"
              searchPlaceholder="Filter departments..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Staff Categorization
            </label>
            <SearchableSelect
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val)}
              options={[
                { value: 'ALL', label: 'All Categories' },
                { value: 'Professional', label: 'Professional Cadre', badge: 'Tier 1' },
                { value: 'Sub-Professional', label: 'Sub-Professional Cadre', badge: 'Tier 2' },
              ]}
              placeholder="All Categories"
              searchPlaceholder="Filter categories..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Gender
            </label>
            <SearchableSelect
              value={selectedGender}
              onChange={(val) => setSelectedGender(val)}
              options={[
                { value: 'ALL', label: 'All Genders' },
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
              ]}
              placeholder="All Genders"
              searchPlaceholder="Filter genders..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Employment Status
            </label>
            <SearchableSelect
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'Active', label: 'Active' },
                { value: 'On Probation', label: 'On Probation' },
                { value: 'On Secondment', label: 'On Secondment' },
                { value: 'Interdicted', label: 'Interdicted' },
                { value: 'Retired', label: 'Retired' },
              ]}
              placeholder="All Statuses"
              searchPlaceholder="Filter status..."
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full h-8 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 Primary KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Staff */}
        <div
          onClick={() => onNavigate('staff')}
          className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs hover:border-blue-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Employees</span>
            <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {totalCount.toLocaleString()}
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
            <span>In current query</span>
            <span className="text-emerald-600 font-semibold flex items-center">
              100% Local DB
            </span>
          </div>
        </div>

        {/* Active Staff */}
        <div
          onClick={() => onNavigate('staff')}
          className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs hover:border-emerald-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Staff</span>
            <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {activeCount.toLocaleString()}
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
            <span>On active nominal roll</span>
            <span className="text-emerald-700 font-medium">
              {totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0}% Active
            </span>
          </div>
        </div>

        {/* Gender Breakdown */}
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Gender Ratio</span>
            <div className="w-8 h-8 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center">
              <PieChartIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {malePct}% <span className="text-xs font-normal text-slate-500">M</span>
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {femalePct}% <span className="text-xs font-normal text-slate-500">F</span>
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 flex overflow-hidden">
            <div className="bg-blue-600 h-full" style={{ width: `${malePct}%` }}></div>
            <div className="bg-pink-500 h-full" style={{ width: `${femalePct}%` }}></div>
          </div>
        </div>

        {/* Cadre & Establishment Vacancy */}
        <div
          onClick={() => onNavigate('establishment')}
          className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs hover:border-amber-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Establishment Vacancies</span>
            <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {vacantCadre} <span className="text-xs font-normal text-slate-500">Posts</span>
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
            <span>Approved: {totalApprovedCadre}</span>
            <span className="text-amber-700 font-medium">
              {totalApprovedCadre > 0 ? Math.round((occupiedCadre / totalApprovedCadre) * 100) : 0}% Filled
            </span>
          </div>
        </div>
      </div>

      {/* Operational Alerts & Action Queues Band */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Retirement Alert */}
        <div
          onClick={() => onNavigate('retirement')}
          className="bg-rose-50/70 border border-rose-200 rounded-lg p-3 hover:bg-rose-50 cursor-pointer transition-colors flex items-start space-x-3"
        >
          <div className="p-2 rounded bg-rose-600 text-white shrink-0 mt-0.5">
            <Hourglass className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-900">Retirement Forecast</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-800 font-mono">
                {retiringWithin1Year.length} In &lt;1 Year
              </span>
            </div>
            <p className="text-[11px] text-rose-700 mt-1 leading-snug">
              {retiringWithin1Year.length > 0
                ? `${retiringWithin1Year.length} civil servant(s) reach mandatory retirement age (60y) within 12 months.`
                : 'No employees retiring within the next 12 months.'}
            </p>
          </div>
        </div>

        {/* Staff Movement Workflow Alert */}
        <div
          onClick={() => onNavigate('movements')}
          className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 hover:bg-amber-50 cursor-pointer transition-colors flex items-start space-x-3"
        >
          <div className="p-2 rounded bg-amber-600 text-white shrink-0 mt-0.5">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900">Pending Staff Movements</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-800 font-mono">
                {pendingMovements.length} Active
              </span>
            </div>
            <p className="text-[11px] text-amber-700 mt-1 leading-snug">
              {pendingMovements.length > 0
                ? `${pendingMovements.length} transfer/posting request(s) awaiting review and implementation.`
                : 'No pending movements in queue.'}
            </p>
          </div>
        </div>

        {/* Promotion Progression Alert */}
        <div
          onClick={() => onNavigate('promotions')}
          className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 hover:bg-emerald-50 cursor-pointer transition-colors flex items-start space-x-3"
        >
          <div className="p-2 rounded bg-emerald-600 text-white shrink-0 mt-0.5">
            <Award className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900">Promotion Eligibility</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-800 font-mono">
                {eligibleForPromotion.length} Qualified
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 mt-1 leading-snug">
              {eligibleForPromotion.length > 0
                ? `${eligibleForPromotion.length} officer(s) have satisfied minimum 3 years time-in-grade.`
                : 'All staff currently within normal time-in-grade.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Visual Analytical Grid (Section 17 & Categorization) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 1. Staff Categorization: Professional vs Sub-Professional (Civil Service Cadre) */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Staff Categorization
                </h2>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Cadre Class</span>
            </div>

            {/* Visual dual-segmented proportion bar */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-indigo-900">
                  Professional: {professionalCount} ({professionalPct}%)
                </span>
                <span className="font-semibold text-teal-800">
                  Sub-Professional: {subProfessionalCount} ({subProfessionalPct}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 flex overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${professionalPct}%` }}
                  title={`Professional: ${professionalCount} (${professionalPct}%)`}
                ></div>
                <div
                  className="bg-teal-500 h-full transition-all duration-500"
                  style={{ width: `${subProfessionalPct}%` }}
                  title={`Sub-Professional: ${subProfessionalCount} (${subProfessionalPct}%)`}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 mt-3 text-xs">
              {/* Professional Button / Card */}
              <div
                onClick={() =>
                  setSelectedCategory(selectedCategory === 'Professional' ? 'ALL' : 'Professional')
                }
                className={`p-2.5 rounded-md border cursor-pointer transition-all ${
                  selectedCategory === 'Professional'
                    ? 'border-indigo-600 bg-indigo-50/90 shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    <span className="font-bold text-indigo-950">Professional Cadre</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-200 text-indigo-800 font-mono">
                    {professionalCount}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                  Graduate & specialized officers (Directors, HR Managers, Analysts, Engineers)
                </p>
              </div>

              {/* Sub-Professional Button / Card */}
              <div
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === 'Sub-Professional' ? 'ALL' : 'Sub-Professional'
                  )
                }
                className={`p-2.5 rounded-md border cursor-pointer transition-all ${
                  selectedCategory === 'Sub-Professional'
                    ? 'border-teal-600 bg-teal-50/90 shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                    <span className="font-bold text-teal-950">Sub-Professional Cadre</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-200 text-teal-800 font-mono">
                    {subProfessionalCount}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                  Executive, technical, clerical, and operational support service officers
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-100 mt-2">
            Click cards above to filter nominal roll by cadre class
          </div>
        </div>

        {/* 2. Departmental Staff Strength */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Departmental Strength
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Headcount</span>
          </div>

          <div className="space-y-3">
            {deptBreakdown.slice(0, 5).map((dept) => {
              const maxCount = Math.max(...deptBreakdown.map((d) => d.count), 1);
              const percentage = Math.round((dept.count / maxCount) * 100);

              return (
                <div key={dept.id} className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-700 truncate max-w-[200px]">
                      {dept.name}
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {dept.count} <span className="text-[10px] font-normal text-slate-500">staff</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Staff by Grade Level Cadre Distribution */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Hierarchy Distribution
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">By Grade Scale</span>
          </div>

          <div className="space-y-3">
            {gradeBreakdown.map((tier, idx) => {
              const tierPercentage = totalCount > 0 ? Math.round((tier.count / totalCount) * 100) : 0;
              const colors = ['bg-indigo-600', 'bg-blue-600', 'bg-teal-600', 'bg-slate-500'];

              return (
                <div key={idx} className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-700">{tier.label}</span>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono font-bold text-slate-900">{tier.count}</span>
                      <span className="text-slate-400">({tierPercentage}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`${colors[idx % colors.length]} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${tierPercentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-Column Feeds: Recent Movements & Upcoming Retirements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Staff Movements Ledger */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Recent Career Movements (Immutable Ledger)
              </h2>
            </div>
            <button
              onClick={() => onNavigate('movements')}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {movementHistory.slice(0, 4).map((m) => {
              const emp = employeesFull.find((e) => e.id === m.employeeId);
              const category = emp?.employment?.employeeCategory;

              return (
                <div key={m.id} className="py-2.5 flex items-start justify-between text-xs">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-900">
                        {emp?.personal?.fullName || 'Civil Servant'} ({emp?.staffId})
                      </span>
                      {category && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            category === 'Professional'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : 'bg-teal-100 text-teal-800 border border-teal-200'
                          }`}
                        >
                          {category}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      <span className="font-medium text-slate-700">{m.movementType}:</span>{' '}
                      {m.mdaNameFrom} ({m.gradeNameFrom}) • {m.departmentNameFrom} &rarr;{' '}
                      <span className="text-blue-700 font-medium">
                        {m.mdaNameTo} • {m.departmentNameTo}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Ref: {m.movementReferenceNumber} | Approved by: {m.approvedByOfficerName}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                      {m.effectiveDate}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Statutory Retirements (Succession Forecast) */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <Hourglass className="w-4 h-4 text-rose-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Statutory Retirement Forecast
              </h2>
            </div>
            <button
              onClick={() => onNavigate('retirement')}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center"
            >
              <span>View 3-Year Forecast</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {employeesFull
              .filter((e) => e.employment?.statutoryRetirementDate)
              .sort((a, b) => a.monthsToRetirement - b.monthsToRetirement)
              .slice(0, 4)
              .map((emp) => {
                const isUrgent = emp.monthsToRetirement <= 12;
                const category = emp.employment?.employeeCategory;

                return (
                  <div key={emp.id} className="py-2.5 flex items-start justify-between text-xs">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-900">
                          {emp.personal?.fullName} ({emp.staffId})
                        </span>
                        {category && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              category === 'Professional'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-teal-100 text-teal-800 border border-teal-200'
                            }`}
                          >
                            {category}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {emp.employment?.currentPositionTitle} •{' '}
                        {gradeLevels.find((g) => g.id === emp.employment?.currentGradeId)?.gradeName}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Age: {emp.age} years | Total Service: {emp.yearsOfService} years
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          isUrgent
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {emp.monthsToRetirement <= 0
                          ? 'DUE NOW'
                          : `${emp.monthsToRetirement} mo. rem.`}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {emp.employment?.statutoryRetirementDate}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};
