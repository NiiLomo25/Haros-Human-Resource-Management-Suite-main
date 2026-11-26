/**
 * Haros HRMIS - Staff Establishment & Vacancy Management View
 * Manages authorized cadre ceilings, occupied posts, real-time vacancy calculations,
 * overstaffing alerts, and statutory Establishment Register exports.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  Scale,
  Plus,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  Users,
  Building2,
  ChevronRight,
  Briefcase,
  GraduationCap,
  Layers,
  ArrowUpDown,
  Edit2,
  Trash2,
  Eye,
  Lock,
} from 'lucide-react';
import { db } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import { EstablishmentPosition } from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';

interface EstablishmentViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const EstablishmentView: React.FC<EstablishmentViewProps> = ({ onSelectEmployee }) => {
  const { currentUser, hasPermission } = useAuth();
  const [dataVersion, setDataVersion] = useState(0);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMdaId, setFilterMdaId] = useState<string>('all');
  const [filterGradeId, setFilterGradeId] = useState<string>('all');
  const [filterVariance, setFilterVariance] = useState<'all' | 'vacant' | 'overstaffed' | 'balanced'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState<EstablishmentPosition | null>(null);
  const [inspectingPostId, setInspectingPostId] = useState<number | null>(null);
  const lastInspectedItemRef = useRef<any>(null);

  // Fetch data
  const mdas = useMemo(() => db.getMdas(), []);
  const gradeLevels = useMemo(() => db.getGradeLevels(), []);
  const rawEstablishments = useMemo(() => db.getEstablishmentPositions(), [dataVersion]);
  const employees = useMemo(() => db.getEmployees(), [dataVersion]);

  // Compute live occupancy and variance for every establishment post
  const establishmentData = useMemo(() => {
    return rawEstablishments.map((post) => {
      const mda = mdas.find((m) => m.id === post.mdaId);
      const grade = gradeLevels.find((g) => g.id === post.gradeId);
      const officer = post.officerEmployeeId
        ? employees.find((e) => e.id === post.officerEmployeeId)
        : undefined;
      const officerInfo = officer ? db.getEmployeeEmploymentInfo(officer.id) : undefined;
      const officerPersonal = officer ? db.getEmployeePersonalInfo(officer.id) : undefined;

      // Count active employees who match this MDA and this grade level
      const occupyingStaff = employees.filter((emp) => {
        const empInfo = db.getEmployeeEmploymentInfo(emp.id);
        if (!empInfo) return false;
        return (
          empInfo.currentMdaId === post.mdaId &&
          empInfo.currentGradeId === post.gradeId &&
          empInfo.currentEmploymentStatus === 'Active'
        );
      });

      const occupiedCadre = occupyingStaff.length;
      const approvedQuota = post.approvedCadreQuota;
      const vacancyCount = Math.max(0, approvedQuota - occupiedCadre);
      const variance = occupiedCadre - approvedQuota; // > 0 = overstaffed, < 0 = understaffed/vacant, 0 = balanced

      let varianceStatus: 'Balanced' | 'Vacant' | 'Overstaffed' = 'Balanced';
      if (variance > 0) varianceStatus = 'Overstaffed';
      else if (variance < 0) varianceStatus = 'Vacant';

      // Infer Cadre category from grade
      const isProf = (grade?.hierarchyRank || 0) >= 12;

      return {
        post,
        mda,
        grade,
        officer,
        officerName: officerPersonal?.fullName || (officer ? `${officerPersonal?.firstName ?? ''} ${officerPersonal?.surname ?? ''}`.trim() : undefined),
        officerTitle: officerInfo?.currentPositionTitle,
        occupiedCadre,
        approvedQuota,
        vacancyCount,
        variance,
        varianceStatus,
        occupyingStaff,
        isProf,
      };
    });
  }, [rawEstablishments, gradeLevels, mdas, employees]);

  // Filtered List
  const filteredList = useMemo(() => {
    return establishmentData.filter((item) => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCode = item.post.positionCode.toLowerCase().includes(q);
        const matchTitle = item.post.positionTitle.toLowerCase().includes(q);
        const matchMda = item.mda?.name.toLowerCase().includes(q) || item.mda?.code.toLowerCase().includes(q) || false;
        const matchGrade = item.grade?.gradeName.toLowerCase().includes(q) || false;
        const matchOfficer = item.officerName?.toLowerCase().includes(q) || false;
        if (!matchCode && !matchTitle && !matchMda && !matchGrade && !matchOfficer) return false;
      }

      // MDA filter
      if (filterMdaId !== 'all' && item.post.mdaId.toString() !== filterMdaId) {
        return false;
      }

      // Grade filter
      if (filterGradeId !== 'all' && item.post.gradeId.toString() !== filterGradeId) {
        return false;
      }

      // Variance status filter
      if (filterVariance === 'vacant' && item.varianceStatus !== 'Vacant') return false;
      if (filterVariance === 'overstaffed' && item.varianceStatus !== 'Overstaffed') return false;
      if (filterVariance === 'balanced' && item.varianceStatus !== 'Balanced') return false;

      // Status
      if (filterStatus !== 'all' && item.post.status !== filterStatus) return false;

      return true;
    });
  }, [establishmentData, searchTerm, filterMdaId, filterGradeId, filterVariance, filterStatus]);

  // Aggregate Metrics
  const aggregateMetrics = useMemo(() => {
    const totalApproved = establishmentData.reduce((sum, e) => sum + e.approvedQuota, 0);
    const totalOccupied = establishmentData.reduce((sum, e) => sum + e.occupiedCadre, 0);
    const totalVacancies = establishmentData.reduce((sum, e) => sum + e.vacancyCount, 0);
    const overstaffedPosts = establishmentData.filter((e) => e.varianceStatus === 'Overstaffed').length;
    return { totalApproved, totalOccupied, totalVacancies, overstaffedPosts };
  }, [establishmentData]);

  // Export Establishment Register CSV
  const handleExportCSV = () => {
    const headers = [
      'Position Code',
      'Position Title',
      'Civil Service Officer',
      'MDA Code',
      'MDA Name',
      'Grade Level',
      'Cadre Type',
      'Approved Quota',
      'Occupied Count',
      'Vacant Posts',
      'Variance Status',
      'Post Status',
    ];

    const rows = filteredList.map((item) => [
      `"${item.post.positionCode}"`,
      `"${item.post.positionTitle}"`,
      `"${item.officerName || ''}"`,
      `"${item.mda?.code || ''}"`,
      `"${item.mda?.name || ''}"`,
      `"${item.grade?.gradeName || ''}"`,
      `"${item.isProf ? 'Professional' : 'Sub-Professional'}"`,
      item.approvedQuota,
      item.occupiedCadre,
      item.vacancyCount,
      `"${item.varianceStatus}"`,
      `"${item.post.status}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Establishment_Register_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notificationService.success(
      'Establishment Register Exported',
      `Exported ${filteredList.length} establishment position(s) to CSV.`,
      { module: 'Establishment Management', actor: currentUser?.username }
    );
  };

  // Form State for Create / Edit Post
  const [formCode, setFormCode] = useState('');
  const [formOfficerEmpId, setFormOfficerEmpId] = useState<number>(0);
  const [formMdaId, setFormMdaId] = useState<number>(mdas[0]?.id || 1);
  const [formGradeId, setFormGradeId] = useState<number>(gradeLevels[0]?.id || 1);
  const [formQuota, setFormQuota] = useState<number>(1);
  const [formStatus, setFormStatus] = useState<'Active' | 'Frozen' | 'Abolished'>('Active');

  // Active, approved Civil Service Officer records eligible to define a post
  const officerOptions = useMemo(() => {
    return employees
      .filter((emp) => {
        if (!emp.isActive) return false;
        const info = db.getEmployeeEmploymentInfo(emp.id);
        return info?.currentEmploymentStatus === 'Active';
      })
      .map((emp) => {
        const pers = db.getEmployeePersonalInfo(emp.id);
        const empInfo = db.getEmployeeEmploymentInfo(emp.id);
        const name = pers?.fullName || `${pers?.firstName ?? ''} ${pers?.surname ?? ''}`.trim() || 'Officer';
        return {
          value: emp.id.toString(),
          label: `${emp.staffId} - ${name}`,
          subLabel: empInfo?.currentPositionTitle,
        };
      });
  }, [employees]);

  const resolvePostTitle = (officerEmpId: number) => {
    const officer = employees.find((e) => e.id === officerEmpId);
    const empInfo = officer ? db.getEmployeeEmploymentInfo(officer.id) : undefined;
    const grade = gradeLevels.find((g) => g.id === formGradeId);
    return empInfo?.currentPositionTitle || grade?.gradeName || 'Civil Service Officer';
  };

  const handleOpenCreateModal = () => {
    setFormCode(`POS-${Math.floor(100 + Math.random() * 900)}`);
    setFormOfficerEmpId(0);
    setFormMdaId(mdas[0]?.id || 1);
    setFormGradeId(gradeLevels[0]?.id || 1);
    setFormQuota(2);
    setFormStatus('Active');
    setEditingPost(null);
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (post: EstablishmentPosition) => {
    setEditingPost(post);
    setFormCode(post.positionCode);
    setFormOfficerEmpId(post.officerEmployeeId || 0);
    setFormMdaId(post.mdaId);
    setFormGradeId(post.gradeId);
    setFormQuota(post.approvedCadreQuota);
    setFormStatus(post.status);
    setShowCreateModal(true);
  };

  const handleSavePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) return;

    const positionTitle = formOfficerEmpId
      ? resolvePostTitle(formOfficerEmpId)
      : editingPost?.positionTitle || 'Civil Service Officer';
    const payload = {
      positionCode: formCode.trim().toUpperCase(),
      mdaId: formMdaId,
      gradeId: formGradeId,
      positionTitle,
      officerEmployeeId: formOfficerEmpId || undefined,
      approvedCadreQuota: formQuota,
      status: formStatus,
    };

    if (editingPost) {
      db.updateEstablishmentPosition(editingPost.id, payload, currentUser?.username || 'admin');
    } else {
      db.createEstablishmentPosition(payload, currentUser?.username || 'admin');
    }

    setShowCreateModal(false);
    setDataVersion((v) => v + 1);
  };

  const handleDeletePost = (id: number) => {
    if (confirm('Are you sure you want to abolish/remove this establishment post?')) {
      db.deleteEstablishmentPosition(id, currentUser?.username || 'admin');
      setDataVersion((v) => v + 1);
    }
  };

  const inspectedItem = useMemo(() => {
    if (!inspectingPostId) return null;
    return establishmentData.find((e) => e.post.id === inspectingPostId);
  }, [inspectingPostId, establishmentData]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>HRMIS Core</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-blue-700">Establishment Management</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center">
            <Scale className="w-5 h-5 mr-2 text-blue-700" />
            Establishment Register & Cadre Vacancy Control
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Maintain statutory authorized establishment ceilings, track vacancies, and prevent unbudgeted recruitment.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Register</span>
          </button>

          {hasPermission('establishment.manage') && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Establishment Post</span>
            </button>
          )}
        </div>
      </div>

      {/* Establishment KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Approved Cadre Quota</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{aggregateMetrics.totalApproved}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Civil Service authorized ceiling</div>
        </div>

        <div className="bg-blue-50/60 rounded-lg border border-blue-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-800 uppercase">Occupied Posts</div>
          <div className="text-2xl font-black text-blue-900 mt-1">{aggregateMetrics.totalOccupied}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">
            {aggregateMetrics.totalApproved > 0
              ? ((aggregateMetrics.totalOccupied / aggregateMetrics.totalApproved) * 100).toFixed(1)
              : 0}% occupancy rate
          </div>
        </div>

        <div className="bg-emerald-50/60 rounded-lg border border-emerald-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase flex items-center justify-between">
            <span>Declared Vacancies</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{aggregateMetrics.totalVacancies}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Available for recruitment or promotion</div>
        </div>

        <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase flex items-center justify-between">
            <span>Overstaffed Posts</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{aggregateMetrics.overstaffedPosts}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Positions exceeding approved quota</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by position code (e.g. POS-101), title, MDA, officer, or grade..."
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
            <span className="font-bold text-slate-800">{filteredList.length}</span>
            <span>of {establishmentData.length} posts</span>
          </div>
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* MDA */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              MDA
            </label>
            <SearchableSelect
              value={filterMdaId}
              onChange={(val) => setFilterMdaId(val)}
              options={[
                { value: 'all', label: 'All MDAs' },
                ...mdas.map((m) => ({
                  value: m.id.toString(),
                  label: `${m.code} - ${m.name}`,
                })),
              ]}
              placeholder="All MDAs"
              searchPlaceholder="Filter MDAs..."
            />
          </div>

          {/* Grade Level */}
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
              searchPlaceholder="Filter grade levels..."
            />
          </div>

          {/* Variance Status */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Variance Status
            </label>
            <SearchableSelect
              value={filterVariance}
              onChange={(val) => setFilterVariance(val as any)}
              options={[
                { value: 'all', label: 'All Variances' },
                { value: 'vacant', label: 'Vacant Only (Understaffed)' },
                { value: 'overstaffed', label: 'Overstaffed Only' },
                { value: 'balanced', label: 'Balanced (100% Filled)' },
              ]}
              placeholder="All Variances"
              searchPlaceholder="Filter variances..."
            />
          </div>

          {/* Post Status */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Position Status
            </label>
            <SearchableSelect
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'Active', label: 'Active' },
                { value: 'Frozen', label: 'Frozen' },
                { value: 'Abolished', label: 'Abolished' },
              ]}
              placeholder="All Statuses"
              searchPlaceholder="Filter statuses..."
            />
          </div>
        </div>
      </div>

      {/* Establishment Register Grid */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                <th className="p-3">Position Code</th>
                <th className="p-3">Designation & Cadre</th>
                <th className="p-3">MDA</th>
                <th className="p-3">Grade Level</th>
                <th className="p-3 text-center">Approved Quota</th>
                <th className="p-3 text-center">Occupied</th>
                <th className="p-3 text-center">Vacant</th>
                <th className="p-3">Variance Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    <Scale className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-slate-600">No establishment posts found matching filters.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const p = item.post;

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/25 transition-colors">
                      {/* Code */}
                      <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {p.positionCode}
                      </td>

                      {/* Title & Cadre */}
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{p.positionTitle}</div>
                        {item.officerName && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Officer: {item.officerName}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
                          {item.isProf ? (
                            <span className="inline-flex items-center text-blue-700 font-semibold">
                              <GraduationCap className="w-3 h-3 mr-0.5" />
                              Professional Cadre
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-amber-700 font-semibold">
                              <Briefcase className="w-3 h-3 mr-0.5" />
                              Sub-Professional Cadre
                            </span>
                          )}
                        </div>
                      </td>

                      {/* MDA — primary placement */}
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{item.mda?.name || '—'}</div>
                        <div className="text-[10px] text-slate-500">
                          {item.mda?.code || ''}
                        </div>
                      </td>

                      {/* Grade */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{item.grade?.gradeName}</div>
                      </td>

                      {/* Approved Quota */}
                      <td className="p-3 text-center font-bold text-slate-900">
                        {item.approvedQuota}
                      </td>

                      {/* Occupied */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setInspectingPostId(p.id)}
                          className={`font-black text-xs hover:underline ${
                            item.occupiedCadre > item.approvedQuota ? 'text-red-700' : 'text-blue-700'
                          }`}
                          title="Click to view occupying officers"
                        >
                          {item.occupiedCadre}
                        </button>
                      </td>

                      {/* Vacant Posts */}
                      <td className="p-3 text-center font-bold">
                        {item.vacancyCount > 0 ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-black">
                            +{item.vacancyCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Variance Status Badge */}
                      <td className="p-3 whitespace-nowrap">
                        {item.varianceStatus === 'Overstaffed' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            <AlertTriangle className="w-3 h-3 mr-1 text-red-600" />
                            Overstaffed (+{item.variance})
                          </span>
                        ) : item.varianceStatus === 'Vacant' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Vacant ({item.vacancyCount} open)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Balanced (100%)
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => setInspectingPostId(p.id)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-700 hover:text-white text-slate-700 text-xs font-semibold transition-colors"
                          title="View occupying staff roster"
                        >
                          Roster
                        </button>

                        {hasPermission('establishment.manage') && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors"
                              title="Edit Quota"
                            >
                              <Edit2 className="w-3 h-3 inline" />
                            </button>
                            <button
                              onClick={() => handleDeletePost(p.id)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-red-100 text-red-600 text-xs transition-colors"
                              title="Abolish Position"
                            >
                              <Trash2 className="w-3 h-3 inline" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECT OCCUPYING OFFICERS DRAWER */}
      {(() => {
        if (inspectedItem) lastInspectedItemRef.current = inspectedItem;
        const activeInspected = inspectedItem || lastInspectedItemRef.current;

        return (
          <SlideOverPanel
            isOpen={Boolean(inspectedItem)}
            onClose={() => setInspectingPostId(null)}
            title={
              activeInspected
                ? `${activeInspected.post.positionCode} • ${activeInspected.post.positionTitle}`
                : 'Establishment Post Roster'
            }
            subtitle={
              activeInspected
                ? `${activeInspected.mda?.name || 'MDA'} (${activeInspected.mda?.code || ''}) • Grade: ${activeInspected.grade?.gradeName || ''} • Approved: ${activeInspected.approvedQuota} Posts`
                : 'Occupying Officers'
            }
            icon={<Users className="w-4 h-4" />}
            maxWidthClass="max-w-2xl"
            overlayClassName="bg-black/40"
          >
            {activeInspected && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Officers Currently Occupying This Post ({activeInspected.occupyingStaff.length})
                  </div>

                  {activeInspected.occupyingStaff.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 rounded border border-slate-200">
                      <p className="font-medium text-slate-600">This post is currently VACANT.</p>
                      <p className="text-xs text-emerald-700 mt-1 font-semibold">
                        {activeInspected.approvedQuota} position quota authorized for recruitment or promotion.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded">
                      {activeInspected.occupyingStaff.map((emp: any) => {
                        const pers = db.getEmployeePersonalInfo(emp.id);
                        const empInfo = db.getEmployeeEmploymentInfo(emp.id);

                        return (
                          <div key={emp.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                            <div>
                              <div className="font-semibold text-slate-900 text-xs">
                                {pers?.fullName || `${pers?.firstName} ${pers?.surname}`}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Staff ID: <strong className="text-blue-700">{emp.staffId}</strong> • Assigned: {empInfo?.dateAssignedCurrentRole || 'N/A'}
                              </div>
                            </div>

                            {onSelectEmployee && (
                              <button
                                type="button"
                                onClick={() => {
                                  setInspectingPostId(null);
                                  onSelectEmployee(emp.id);
                                }}
                                className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-700 hover:text-white text-xs font-semibold transition-colors"
                              >
                                Open Dossier
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setInspectingPostId(null)}
                    className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </SlideOverPanel>
        );
      })()}

      {/* CREATE / EDIT ESTABLISHMENT POST DRAWER */}
      <SlideOverPanel
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingPost ? 'Edit Establishment Post' : 'Create Establishment Post'}
        subtitle="Authorized Cadre Ceiling & Civil Service Establishment Register"
        icon={<Scale className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        <form onSubmit={handleSavePost} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Position Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. POS-101"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded uppercase font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Civil Service Officer <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={formOfficerEmpId ? formOfficerEmpId.toString() : ''}
                onChange={(val) => {
                  const empId = parseInt(val, 10);
                  setFormOfficerEmpId(empId);
                  const empInfo = db.getEmployeeEmploymentInfo(empId);
                  if (empInfo?.currentGradeId) setFormGradeId(empInfo.currentGradeId);
                  if (empInfo?.currentMdaId) setFormMdaId(empInfo.currentMdaId);
                }}
                options={officerOptions}
                placeholder="Select civil service officer..."
                searchPlaceholder="Search officer by Staff ID or name..."
                buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 h-10"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Post designation and grade are derived from the selected officer&apos;s active record.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                MDA <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={formMdaId.toString()}
                onChange={(val) => setFormMdaId(parseInt(val, 10))}
                options={mdas.map((m) => ({
                  value: m.id.toString(),
                  label: `${m.code} - ${m.name}`,
                  subLabel: m.mdaType,
                }))}
                placeholder="Select MDA..."
                searchPlaceholder="Filter MDAs..."
                buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 h-10"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Approved Grade Level <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={formGradeId.toString()}
                onChange={(val) => setFormGradeId(parseInt(val, 10))}
                options={gradeLevels.map((g) => ({ value: g.id.toString(), label: g.gradeName }))}
                placeholder="Select grade..."
                searchPlaceholder="Filter grade levels..."
                buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 h-10"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Approved Cadre Quota (Ceiling) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formQuota}
                onChange={(e) => setFormQuota(parseInt(e.target.value) || 1)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Post Status
              </label>
              <SearchableSelect
                value={formStatus}
                onChange={(val) => setFormStatus(val as 'Active' | 'Frozen' | 'Abolished')}
                options={[
                  { value: 'Active', label: 'Active' },
                  { value: 'Frozen', label: 'Frozen (Recruitment Blocked)' },
                  { value: 'Abolished', label: 'Abolished' },
                ]}
                placeholder="Select status..."
                searchPlaceholder="Filter statuses..."
                buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 h-10"
              />
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs"
            >
              Save Post
            </button>
          </div>
        </form>
      </SlideOverPanel>
    </div>
  );
};
