/**
 * Haros HRMIS - Department & Organizational Management View
 * Implements full organizational structure, MDA hierarchy, Directorates, Units,
 * Department Heads, and staffing rollups linked to the central employee database.
 */

import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Users,
  Search,
  ChevronRight,
  Shield,
  Layers,
  FolderTree,
  UserCheck,
  Briefcase,
  GraduationCap,
  Scale,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { db } from '../../db/storage';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Department, Mda, Unit, Employee, EmployeePersonalInfo } from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';

interface OrganizationViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const OrganizationView: React.FC<OrganizationViewProps> = ({ onSelectEmployee }) => {
  const { currentUser, hasPermission } = useAuth();
  const notify = useNotifications();
  const [dataVersion, setDataVersion] = useState(0);

  // View mode: 'cards' | 'mdas' | 'tree'
  const [activeView, setActiveView] = useState<'cards' | 'mdas' | 'tree'>('cards');
  const [selectedMdaId, setSelectedMdaId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Department for deep roster inspection
  const [inspectDeptId, setInspectDeptId] = useState<number | null>(null);

  // Modals
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [unitParentDeptId, setUnitParentDeptId] = useState<number | null>(null);
  const [showAddMdaModal, setShowAddMdaModal] = useState(false);
  const [editingMda, setEditingMda] = useState<Mda | null>(null);
  const [deletingMda, setDeletingMda] = useState<{
    mda: Mda;
    deptCount: number;
    staffCount: number;
  } | null>(null);
  const [deleteMdaError, setDeleteMdaError] = useState('');
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<{
    dept: Department;
    staffCount: number;
    unitsCount: number;
  } | null>(null);
  const [deleteDeptError, setDeleteDeptError] = useState('');
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<{
    unit: Unit;
    deptName: string;
    staffCount: number;
  } | null>(null);
  const [deleteUnitError, setDeleteUnitError] = useState('');

  // Load data
  const mdas = useMemo(() => db.getMdas(), [dataVersion]);
  const departments = useMemo(() => db.getDepartments(), [dataVersion]);
  const units = useMemo(() => db.getUnits(), [dataVersion]);
  const employees = useMemo(() => db.getEmployees(), [dataVersion]);
  const establishments = useMemo(() => db.getEstablishmentPositions(), [dataVersion]);

  // Compute departmental intelligence (staff count, cadre distribution, establishment quota)
  const departmentStats = useMemo(() => {
    return departments.map((dept) => {
      // Find all officers assigned to this department
      const staffInDept = employees.filter((emp) => {
        const empInfo = db.getEmployeeEmploymentInfo(emp.id);
        return empInfo?.currentDepartmentId === dept.id && empInfo?.currentEmploymentStatus === 'Active';
      });

      const professionalCount = staffInDept.filter((emp) => {
        const empInfo = db.getEmployeeEmploymentInfo(emp.id);
        return empInfo?.employeeCategory === 'Professional';
      }).length;

      const subProfessionalCount = staffInDept.filter((emp) => {
        const empInfo = db.getEmployeeEmploymentInfo(emp.id);
        return empInfo?.employeeCategory === 'Sub-Professional';
      }).length;

      // Find department head officer
      let headOfficerName = 'Vacant / Unassigned';
      if (dept.departmentHeadEmployeeId) {
        const headPersonal = db.getEmployeePersonalInfo(dept.departmentHeadEmployeeId);
        if (headPersonal) {
          headOfficerName = headPersonal.fullName || `${headPersonal.firstName} ${headPersonal.surname}`;
        }
      }

      // Department units
      const deptUnits = units.filter((u) => u.departmentId === dept.id);

      // Establishment quota
      const deptEstablishments = establishments.filter((e) => e.departmentId === dept.id && e.status === 'Active');
      const approvedCadre = deptEstablishments.reduce((sum, e) => sum + e.approvedCadreQuota, 0);
      const occupiedCadre = staffInDept.length;
      const vacantPosts = Math.max(0, approvedCadre - occupiedCadre);

      const mda = mdas.find((m) => m.id === dept.mdaId);

      return {
        department: dept,
        mda,
        staffCount: staffInDept.length,
        staffList: staffInDept,
        professionalCount,
        subProfessionalCount,
        unitsCount: deptUnits.length,
        units: deptUnits,
        headOfficerName,
        approvedCadre,
        occupiedCadre,
        vacantPosts,
      };
    });
  }, [departments, employees, units, establishments, mdas]);

  // Filtered department list
  const filteredDepartments = useMemo(() => {
    return departmentStats.filter((item) => {
      if (selectedMdaId !== 'all' && item.department.mdaId.toString() !== selectedMdaId) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCode = item.department.departmentCode.toLowerCase().includes(q);
        const matchName = item.department.departmentName.toLowerCase().includes(q);
        const matchMda = item.mda?.name.toLowerCase().includes(q) || item.mda?.code.toLowerCase().includes(q);
        const matchHead = item.headOfficerName.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchMda && !matchHead) return false;
      }
      return true;
    });
  }, [departmentStats, selectedMdaId, searchTerm]);

  // Compute MDA-level intelligence (departments count, active staff count, head officer)
  const mdaStats = useMemo(() => {
    return mdas.map((mda) => {
      const mdaDepts = departmentStats.filter((d) => d.department.mdaId === mda.id);
      const staffCount = employees.filter((emp) => {
        const empInfo = db.getEmployeeEmploymentInfo(emp.id);
        return empInfo?.currentMdaId === mda.id && empInfo?.currentEmploymentStatus === 'Active';
      }).length;
      const approvedCadre = mdaDepts.reduce((sum, d) => sum + d.approvedCadre, 0);

      let headOfficerName = 'Vacant / Unassigned';
      if (mda.headEmployeeId) {
        const headPersonal = db.getEmployeePersonalInfo(mda.headEmployeeId);
        if (headPersonal) {
          headOfficerName =
            headPersonal.fullName || `${headPersonal.firstName} ${headPersonal.surname}`;
        }
      }

      return {
        mda,
        deptCount: mdaDepts.length,
        staffCount,
        approvedCadre,
        headOfficerName,
      };
    });
  }, [mdas, departmentStats, employees]);

  const filteredMdas = useMemo(() => {
    if (!searchTerm.trim()) return mdaStats;
    const q = searchTerm.toLowerCase();
    return mdaStats.filter(
      (item) =>
        item.mda.code.toLowerCase().includes(q) ||
        item.mda.name.toLowerCase().includes(q) ||
        item.mda.mdaType.toLowerCase().includes(q) ||
        item.headOfficerName.toLowerCase().includes(q)
    );
  }, [mdaStats, searchTerm]);

  // Total KPIs
  const totalStats = useMemo(() => {
    const totalDepts = departments.length;
    const totalUnits = units.length;
    const totalStaff = departmentStats.reduce((sum, d) => sum + d.staffCount, 0);
    const assignedHeads = departments.filter((d) => d.departmentHeadEmployeeId).length;
    const totalApprovedCadre = departmentStats.reduce((sum, d) => sum + d.approvedCadre, 0);
    return { totalDepts, totalUnits, totalStaff, assignedHeads, totalApprovedCadre };
  }, [departments, units, departmentStats]);

  // Form state for creating Ministry / MDA
  const [newMdaCode, setNewMdaCode] = useState('');
  const [newMdaName, setNewMdaName] = useState('');
  const [newMdaType, setNewMdaType] = useState<'Ministry' | 'Department' | 'Agency' | 'Commission'>('Ministry');
  const [newMdaHeadId, setNewMdaHeadId] = useState<string>('');

  const handleCreateMda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMdaCode.trim() || !newMdaName.trim()) return;

    db.createMda(
      {
        code: newMdaCode.trim().toUpperCase(),
        name: newMdaName.trim(),
        mdaType: newMdaType,
        headEmployeeId: newMdaHeadId ? parseInt(newMdaHeadId) : undefined,
        isActive: true,
      },
      currentUser?.username || 'admin'
    );

    setNewMdaCode('');
    setNewMdaName('');
    setNewMdaType('Ministry');
    setNewMdaHeadId('');
    setShowAddMdaModal(false);
    setDataVersion((v) => v + 1);
  };

  // Form state for editing & deleting Ministry / MDA
  const [editMdaCode, setEditMdaCode] = useState('');
  const [editMdaName, setEditMdaName] = useState('');
  const [editMdaType, setEditMdaType] = useState<'Ministry' | 'Department' | 'Agency' | 'Commission'>('Ministry');
  const [editMdaHeadId, setEditMdaHeadId] = useState<string>('');
  const [editMdaIsActive, setEditMdaIsActive] = useState<boolean>(true);
  const [editMdaError, setEditMdaError] = useState('');

  const handleOpenEditMda = (mda: Mda) => {
    setEditMdaError('');
    setEditingMda(mda);
    setEditMdaCode(mda.code);
    setEditMdaName(mda.name);
    setEditMdaType(mda.mdaType);
    setEditMdaHeadId(mda.headEmployeeId ? mda.headEmployeeId.toString() : '');
    setEditMdaIsActive(mda.isActive);
  };

  const handleUpdateMda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMda || !editMdaCode.trim() || !editMdaName.trim()) return;

    const normalizedCode = editMdaCode.trim().toUpperCase();
    const duplicate = mdas.find(
      (m) => m.id !== editingMda.id && m.code.toUpperCase() === normalizedCode
    );
    if (duplicate) {
      const msg = `An institution with code "${normalizedCode}" already exists (${duplicate.name}).`;
      setEditMdaError(msg);
      notify.error('Duplicate Institution Code', msg, { module: 'Organization Structure' });
      return;
    }

    db.updateMda(
      editingMda.id,
      {
        code: normalizedCode,
        name: editMdaName.trim(),
        mdaType: editMdaType,
        headEmployeeId: editMdaHeadId ? parseInt(editMdaHeadId, 10) : undefined,
        isActive: editMdaIsActive,
      },
      currentUser?.username || 'admin'
    );

    setEditingMda(null);
    setEditMdaError('');
    setDataVersion((v) => v + 1);
  };

  const handleOpenDeleteMda = (mda: Mda) => {
    const stat = mdaStats.find((s) => s.mda.id === mda.id);
    setDeleteMdaError('');
    setDeletingMda({
      mda,
      deptCount: stat?.deptCount ?? departments.filter((d) => d.mdaId === mda.id).length,
      staffCount:
        stat?.staffCount ??
        employees.filter((emp) => {
          const empInfo = db.getEmployeeEmploymentInfo(emp.id);
          return empInfo?.currentMdaId === mda.id && empInfo?.currentEmploymentStatus === 'Active';
        }).length,
    });
  };

  const handleConfirmDeleteMda = () => {
    if (!deletingMda) return;
    const res = db.deleteMda(deletingMda.mda.id, currentUser?.username || 'admin');
    if (!res.success) {
      setDeleteMdaError(res.message);
      notify.error('Cannot Delete Ministry / MDA', res.message, {
        module: 'Organization Structure',
      });
      return;
    }
    if (selectedMdaId === deletingMda.mda.id.toString()) {
      setSelectedMdaId('all');
    }
    setDeletingMda(null);
    setDeleteMdaError('');
    setDataVersion((v) => v + 1);
  };

  // Form state for creating Department
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptMdaId, setNewDeptMdaId] = useState<number>(mdas[0]?.id || 1);
  const [newDeptHeadId, setNewDeptHeadId] = useState<string>('');

  const handleCreateDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptCode.trim() || !newDeptName.trim()) return;

    db.createDepartment(
      {
        mdaId: newDeptMdaId,
        departmentCode: newDeptCode.trim().toUpperCase(),
        departmentName: newDeptName.trim(),
        departmentHeadEmployeeId: newDeptHeadId ? parseInt(newDeptHeadId) : undefined,
        status: 'Active',
      },
      currentUser?.username || 'admin'
    );

    setNewDeptCode('');
    setNewDeptName('');
    setNewDeptHeadId('');
    setShowAddDeptModal(false);
    setDataVersion((v) => v + 1);
  };

  // Form state for editing Department
  const [editDeptCode, setEditDeptCode] = useState('');
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptMdaId, setEditDeptMdaId] = useState<number>(1);
  const [editDeptHeadId, setEditDeptHeadId] = useState<string>('');
  const [editDeptStatus, setEditDeptStatus] = useState<'Active' | 'Archived'>('Active');

  const handleOpenEditDept = (dept: Department) => {
    setEditingDept(dept);
    setEditDeptCode(dept.departmentCode);
    setEditDeptName(dept.departmentName);
    setEditDeptMdaId(dept.mdaId);
    setEditDeptHeadId(dept.departmentHeadEmployeeId ? dept.departmentHeadEmployeeId.toString() : '');
    setEditDeptStatus(dept.status);
  };

  const handleUpdateDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept || !editDeptCode.trim() || !editDeptName.trim()) return;

    db.updateDepartment(
      editingDept.id,
      {
        mdaId: editDeptMdaId,
        departmentCode: editDeptCode.trim().toUpperCase(),
        departmentName: editDeptName.trim(),
        departmentHeadEmployeeId: editDeptHeadId ? parseInt(editDeptHeadId, 10) : undefined,
        status: editDeptStatus,
      },
      currentUser?.username || 'admin'
    );

    setEditingDept(null);
    setDataVersion((v) => v + 1);
  };

  const handleOpenDeleteDept = (dept: Department, staffCount: number, unitsCount: number) => {
    setDeleteDeptError('');
    setDeletingDept({ dept, staffCount, unitsCount });
  };

  const handleConfirmDeleteDept = () => {
    if (!deletingDept) return;
    const res = db.deleteDepartment(deletingDept.dept.id, currentUser?.username || 'admin');
    if (!res.success) {
      setDeleteDeptError(res.message);
      return;
    }
    if (inspectDeptId === deletingDept.dept.id) {
      setInspectDeptId(null);
    }
    setDeletingDept(null);
    setDeleteDeptError('');
    setDataVersion((v) => v + 1);
  };

  // Form state for creating & editing Unit
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [editUnitCode, setEditUnitCode] = useState('');
  const [editUnitName, setEditUnitName] = useState('');

  const handleOpenEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setEditUnitCode(unit.unitCode);
    setEditUnitName(unit.unitName);
  };

  const handleUpdateUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit || !editUnitCode.trim() || !editUnitName.trim()) return;
    db.updateUnit(
      editingUnit.id,
      {
        unitCode: editUnitCode.trim().toUpperCase(),
        unitName: editUnitName.trim(),
      },
      currentUser?.username || 'admin'
    );
    setEditingUnit(null);
    setDataVersion((v) => v + 1);
  };

  const handleOpenDeleteUnit = (unit: Unit, deptName: string) => {
    const staffCount = employees.filter((emp) => {
      const info = db.getEmployeeEmploymentInfo(emp.id);
      return info?.currentUnitId === unit.id;
    }).length;
    setDeleteUnitError('');
    setDeletingUnit({ unit, deptName, staffCount });
  };

  const handleConfirmDeleteUnit = () => {
    if (!deletingUnit) return;
    const res = db.deleteUnit(deletingUnit.unit.id, currentUser?.username || 'admin');
    if (!res.success) {
      setDeleteUnitError(res.message);
      notify.error('Cannot Delete Operational Unit', res.message, {
        module: 'Organization Structure',
      });
      return;
    }
    setDeletingUnit(null);
    setDeleteUnitError('');
    setDataVersion((v) => v + 1);
  };

  const handleCreateUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitParentDeptId || !newUnitCode.trim() || !newUnitName.trim()) return;

    db.createUnit(
      {
        departmentId: unitParentDeptId,
        unitCode: newUnitCode.trim().toUpperCase(),
        unitName: newUnitName.trim(),
      },
      currentUser?.username || 'admin'
    );

    setNewUnitCode('');
    setNewUnitName('');
    setShowAddUnitModal(false);
    setDataVersion((v) => v + 1);
  };

  // Inspected department details (preserve last data during 400ms close slide-out)
  const inspectedData = useMemo(() => {
    if (!inspectDeptId) return null;
    return departmentStats.find((d) => d.department.id === inspectDeptId) || null;
  }, [inspectDeptId, departmentStats]);

  const lastInspectedRef = React.useRef<typeof inspectedData>(null);
  if (inspectedData) {
    lastInspectedRef.current = inspectedData;
  }
  const activeRosterData = inspectedData || lastInspectedRef.current;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>HRMIS Core</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-blue-700">Organizational Structure</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-blue-700" />
            Department & Organizational Management
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Configure MDAs, Directorates, Departments, and Operational Units linked with staff assignments and cadre ceilings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded text-xs font-semibold">
            <button
              onClick={() => setActiveView('cards')}
              className={`px-3 py-1.5 rounded transition-all flex items-center space-x-1.5 ${
                activeView === 'cards' ? 'bg-white text-blue-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Department Rollup</span>
            </button>
            <button
              onClick={() => setActiveView('mdas')}
              className={`px-3 py-1.5 rounded transition-all flex items-center space-x-1.5 ${
                activeView === 'mdas' ? 'bg-white text-blue-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Ministries / MDAs ({mdas.length})</span>
            </button>
            <button
              onClick={() => setActiveView('tree')}
              className={`px-3 py-1.5 rounded transition-all flex items-center space-x-1.5 ${
                activeView === 'tree' ? 'bg-white text-blue-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Hierarchy Tree</span>
            </button>
          </div>

          {hasPermission('org.manage') && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowAddMdaModal(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Ministry / MDA</span>
              </button>

              <button
                onClick={() => setShowAddDeptModal(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Department</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setActiveView('mdas')}
          className={`text-left rounded-lg border p-3.5 shadow-xs transition-all ${
            activeView === 'mdas'
              ? 'bg-slate-900 border-slate-900 text-white ring-2 ring-blue-500/30'
              : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-sm'
          }`}
          title="Click to manage, edit, or delete Ministries / MDAs"
        >
          <div className={`text-[11px] font-semibold uppercase ${activeView === 'mdas' ? 'text-slate-300' : 'text-slate-500'}`}>
            Institutions (MDAs)
          </div>
          <div className={`text-2xl font-black mt-1 ${activeView === 'mdas' ? 'text-white' : 'text-slate-900'}`}>
            {mdas.length}
          </div>
          <div className={`text-[10px] mt-0.5 flex items-center justify-between ${activeView === 'mdas' ? 'text-amber-300' : 'text-blue-700'}`}>
            <span>Ministries & Agencies</span>
            <span className="font-semibold">Manage →</span>
          </div>
        </button>

        <div className="bg-blue-50/60 rounded-lg border border-blue-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-800 uppercase">Active Departments</div>
          <div className="text-2xl font-black text-blue-900 mt-1">{totalStats.totalDepts}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Across all government MDAs</div>
        </div>

        <div className="bg-purple-50/60 rounded-lg border border-purple-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-purple-800 uppercase">Sub-Units & Sections</div>
          <div className="text-2xl font-black text-purple-900 mt-1">{totalStats.totalUnits}</div>
          <div className="text-[10px] text-purple-700 mt-0.5">Operational divisions</div>
        </div>

        <div className="bg-emerald-50/60 rounded-lg border border-emerald-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase">Heads Assigned</div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{totalStats.assignedHeads} / {totalStats.totalDepts}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">
            {((totalStats.assignedHeads / (totalStats.totalDepts || 1)) * 100).toFixed(0)}% Leadership coverage
          </div>
        </div>

        <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase">Approved Establishment</div>
          <div className="text-2xl font-black text-amber-900 mt-1">{totalStats.totalApprovedCadre}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Authorized civil service posts</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={
              activeView === 'mdas'
                ? 'Search Ministries / MDAs by code, name, classification, or head...'
                : 'Search departments by code, name, MDA, or director name...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        {activeView !== 'mdas' && (
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <span className="text-xs text-slate-500 whitespace-nowrap">Filter by MDA:</span>
            <select
              value={selectedMdaId}
              onChange={(e) => setSelectedMdaId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All MDAs ({departments.length} Depts)</option>
              {mdas.map((m) => (
                <option key={m.id} value={m.id.toString()}>
                  {m.code} - {m.name}
                </option>
              ))}
            </select>
            {selectedMdaId !== 'all' && hasPermission('org.manage') && (() => {
              const chosenMda = mdas.find((m) => m.id.toString() === selectedMdaId);
              if (!chosenMda) return null;
              return (
                <div className="flex items-center space-x-1 pl-1 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleOpenEditMda(chosenMda)}
                    title={`Edit ${chosenMda.code}`}
                    className="p-1.5 rounded border border-slate-200 bg-slate-50 text-slate-600 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDeleteMda(chosenMda)}
                    title={`Delete ${chosenMda.code}`}
                    className="p-1.5 rounded border border-slate-200 bg-slate-50 text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* VIEW 1: Department Cards & Staffing Rollup */}
      {activeView === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDepartments.map((item) => {
            const dept = item.department;
            const cadreFillPercent = item.approvedCadre > 0 ? (item.occupiedCadre / item.approvedCadre) * 100 : 0;
            const isOverstaffed = item.occupiedCadre > item.approvedCadre;

            return (
              <div
                key={dept.id}
                className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Department Code & Actions */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                      {dept.departmentCode}
                    </span>
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase mr-1">
                        {item.mda?.code || 'Civil Service'}
                      </span>
                      {hasPermission('org.manage') && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditDept(dept)}
                            title="Edit Department"
                            className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenDeleteDept(dept, item.staffCount, item.unitsCount)
                            }
                            title="Delete Department"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title & MDA */}
                  <h3 className="font-bold text-slate-900 text-sm mt-2">{dept.departmentName}</h3>
                  <p className="text-[11px] text-slate-500">{item.mda?.name}</p>

                  {/* Head of Department */}
                  <div className="mt-3 p-2 rounded bg-slate-50 border border-slate-200 flex items-center space-x-2 text-xs">
                    <UserCheck className="w-4 h-4 text-blue-700 shrink-0" />
                    <div className="truncate">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase">Head of Department</div>
                      <div className="font-semibold text-slate-800 truncate">{item.headOfficerName}</div>
                    </div>
                  </div>

                  {/* Staff Composition: Professional vs Sub-Professional */}
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">Active Staff Strength:</span>
                      <span className="font-black text-slate-900">{item.staffCount} Officers</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                      <div className="p-1.5 rounded bg-blue-50/70 border border-blue-200 text-blue-800 flex items-center justify-between">
                        <span className="flex items-center">
                          <GraduationCap className="w-3 h-3 mr-1 text-blue-600" />
                          Professional:
                        </span>
                        <span className="font-black">{item.professionalCount}</span>
                      </div>
                      <div className="p-1.5 rounded bg-amber-50/70 border border-amber-200 text-amber-800 flex items-center justify-between">
                        <span className="flex items-center">
                          <Briefcase className="w-3 h-3 mr-1 text-amber-600" />
                          Sub-Prof:
                        </span>
                        <span className="font-black">{item.subProfessionalCount}</span>
                      </div>
                    </div>

                    {/* Cadre Quota Fill Bar */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span>Establishment Quota:</span>
                        <span className="font-bold">
                          {item.occupiedCadre} / {item.approvedCadre} Posts
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOverstaffed
                              ? 'bg-red-500'
                              : cadreFillPercent >= 80
                              ? 'bg-emerald-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min(cadreFillPercent, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Units Count & Listing */}
                  <div className="mt-3 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                    <span className="font-medium text-slate-700">{item.unitsCount} Operational Units:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.units.slice(0, 3).map((u) => (
                        <span key={u.id} className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600">
                          {u.unitName}
                        </span>
                      ))}
                      {item.units.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-500 font-semibold">
                          +{item.units.length - 3} more
                        </span>
                      )}
                      {item.units.length === 0 && (
                        <span className="text-[10px] text-slate-400 italic">No sub-units defined</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {hasPermission('org.manage') && (
                    <button
                      onClick={() => {
                        setUnitParentDeptId(dept.id);
                        setShowAddUnitModal(true);
                      }}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 transition-colors flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Unit</span>
                    </button>
                  )}

                  <button
                    onClick={() => setInspectDeptId(dept.id)}
                    className="ml-auto text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-700 hover:text-white text-slate-700 font-semibold transition-colors flex items-center space-x-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Roster ({item.staffCount})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 1B: Ministries & MDAs Directory Management */}
      {activeView === 'mdas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMdas.map((item) => {
            const { mda, deptCount, staffCount, approvedCadre, headOfficerName } = item;
            return (
              <div
                key={mda.id}
                className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                        {mda.code}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {mda.mdaType}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded mr-1 ${
                          mda.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {mda.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {hasPermission('org.manage') && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditMda(mda)}
                            title="Edit Ministry / MDA"
                            className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteMda(mda)}
                            title="Delete Ministry / MDA"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mt-2.5 leading-snug">
                    {mda.name}
                  </h3>

                  <div className="mt-3 p-2 rounded bg-slate-50 border border-slate-200 flex items-center space-x-2 text-xs">
                    <UserCheck className="w-4 h-4 text-blue-700 shrink-0" />
                    <div className="truncate">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase">
                        Head / Chief Director
                      </div>
                      <div className="font-semibold text-slate-800 truncate">{headOfficerName}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="p-2 rounded bg-blue-50/60 border border-blue-100">
                      <div className="text-[10px] font-semibold text-blue-700 uppercase">Depts</div>
                      <div className="text-sm font-black text-blue-900 tabular-nums">{deptCount}</div>
                    </div>
                    <div className="p-2 rounded bg-emerald-50/60 border border-emerald-100">
                      <div className="text-[10px] font-semibold text-emerald-700 uppercase">Officers</div>
                      <div className="text-sm font-black text-emerald-900 tabular-nums">{staffCount}</div>
                    </div>
                    <div className="p-2 rounded bg-amber-50/60 border border-amber-100">
                      <div className="text-[10px] font-semibold text-amber-700 uppercase">Posts</div>
                      <div className="text-sm font-black text-amber-900 tabular-nums">{approvedCadre}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMdaId(mda.id.toString());
                      setActiveView('cards');
                    }}
                    className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-700 hover:text-white text-slate-700 font-semibold transition-colors flex items-center space-x-1"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>View Departments ({deptCount})</span>
                  </button>

                  {hasPermission('org.manage') && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditMda(mda)}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center space-x-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit MDA</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: Full Civil Service Organizational Hierarchy Tree */}
      {activeView === 'tree' && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Institutional Hierarchy Tree: Government MDAs & Operational Substructures
          </div>

          <div className="space-y-4">
            {mdas.map((mda) => {
              const deptsInMda = departmentStats.filter((d) => d.department.mdaId === mda.id);
              const mdaStaffCount = deptsInMda.reduce((sum, d) => sum + d.staffCount, 0);

              return (
                <div key={mda.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-blue-700 text-white">
                        {mda.code}
                      </span>
                      <h2 className="font-bold text-slate-900 text-sm">{mda.name}</h2>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        {mda.mdaType}
                      </span>
                      {!mda.isActive && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="text-xs font-semibold text-slate-600">
                        {deptsInMda.length} Departments • {mdaStaffCount} Total Personnel
                      </div>
                      {hasPermission('org.manage') && (
                        <div className="flex items-center space-x-1 pl-2 border-l border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleOpenEditMda(mda)}
                            title="Edit Ministry / MDA"
                            className="p-1 rounded text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteMda(mda)}
                            title="Delete Ministry / MDA"
                            className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Department Subtree */}
                  <div className="pl-6 border-l-2 border-blue-300 ml-3 space-y-3 pt-1">
                    {deptsInMda.map((deptStat) => {
                      const d = deptStat.department;

                      return (
                        <div key={d.id} className="bg-white rounded border border-slate-200 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs font-bold text-blue-800">
                                {d.departmentCode}
                              </span>
                              <span className="font-semibold text-slate-800 text-xs">
                                {d.departmentName}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2 text-xs">
                              <span className="font-bold text-blue-700">{deptStat.staffCount} Staff</span>
                              <span className="text-slate-400">|</span>
                              <button
                                onClick={() => setInspectDeptId(d.id)}
                                className="text-xs font-semibold text-blue-600 hover:underline flex items-center"
                              >
                                <span>Inspect Roster</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                              {hasPermission('org.manage') && (
                                <div className="flex items-center space-x-0.5 pl-1 border-l border-slate-200">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditDept(d)}
                                    title="Edit Department"
                                    className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenDeleteDept(d, deptStat.staffCount, deptStat.unitsCount)
                                    }
                                    title="Delete Department"
                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center justify-between">
                            <span>Head of Department: <strong className="text-slate-700">{deptStat.headOfficerName}</strong></span>
                            <span>Cadre: <strong>{deptStat.professionalCount} Prof</strong> / <strong>{deptStat.subProfessionalCount} Sub-Prof</strong></span>
                          </div>

                          {/* Sub-Units Tree Branch */}
                          {deptStat.units.length > 0 && (
                            <div className="pl-4 border-l-2 border-slate-200 ml-2 pt-1 space-y-1">
                              <div className="text-[10px] font-semibold text-slate-400 uppercase">Units:</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {deptStat.units.map((u) => (
                                  <div
                                    key={u.id}
                                    className="p-1.5 bg-slate-50 rounded border border-slate-200 text-[11px] flex items-center justify-between gap-1.5"
                                  >
                                    <div className="truncate">
                                      <span className="font-mono font-bold text-slate-700 mr-1.5">{u.unitCode}:</span>
                                      <span className="text-slate-800">{u.unitName}</span>
                                    </div>
                                    {hasPermission('org.manage') && (
                                      <div className="flex items-center space-x-0.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditUnit(u)}
                                          title="Edit Unit"
                                          className="p-0.5 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-100"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenDeleteUnit(u, d.departmentName)}
                                          title="Delete Unit"
                                          className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-100"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DEPARTMENT ROSTER INSPECTION SLIDING PANEL */}
      <SlideOverPanel
        isOpen={Boolean(inspectedData)}
        onClose={() => setInspectDeptId(null)}
        title={
          activeRosterData
            ? `${activeRosterData.department.departmentCode} — ${activeRosterData.department.departmentName}`
            : 'Departmental Nominal Roster'
        }
        subtitle={
          activeRosterData
            ? `${activeRosterData.mda?.name || 'Civil Service'} • Head: ${activeRosterData.headOfficerName}`
            : undefined
        }
        icon={<Users className="w-4 h-4" />}
        maxWidthClass="max-w-3xl lg:max-w-4xl"
      >
        {activeRosterData && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Department Summary Header Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-3.5 bg-blue-50/40 border-b border-slate-200 text-xs shrink-0">
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-semibold">Active Staff:</span>
                <div className="font-black text-slate-900 text-sm">{activeRosterData.staffCount}</div>
              </div>
              <div>
                <span className="text-blue-700 text-[10px] uppercase font-semibold">Professional:</span>
                <div className="font-black text-blue-900 text-sm">{activeRosterData.professionalCount}</div>
              </div>
              <div>
                <span className="text-amber-700 text-[10px] uppercase font-semibold">Sub-Professional:</span>
                <div className="font-black text-amber-900 text-sm">{activeRosterData.subProfessionalCount}</div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-semibold">Cadre Ceiling:</span>
                <div className="font-black text-slate-900 text-sm">
                  {activeRosterData.occupiedCadre} / {activeRosterData.approvedCadre} Posts
                </div>
              </div>
            </div>

            {/* Roster Table & Operational Units */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {activeRosterData.units.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Operational Units ({activeRosterData.units.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeRosterData.units.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="truncate">
                          <span className="font-mono font-bold text-blue-700 mr-1.5">{u.unitCode}</span>
                          <span className="font-semibold text-slate-800">{u.unitName}</span>
                        </div>
                        {hasPermission('org.manage') && (
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditUnit(u)}
                              title="Edit Unit"
                              className="p-1 rounded text-slate-500 hover:text-blue-700 hover:bg-blue-100"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenDeleteUnit(u, activeRosterData.department.departmentName)
                              }
                              title="Delete Unit"
                              className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Departmental Nominal Roster ({activeRosterData.staffList.length} Active Officers)
                </div>

              {activeRosterData.staffList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border border-slate-200 rounded-lg bg-slate-50/50">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="font-medium text-slate-600">No active officers currently posted to this department.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 overflow-x-auto bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="p-2.5">Staff ID</th>
                        <th className="p-2.5">Officer Name</th>
                        <th className="p-2.5">Cadre Category</th>
                        <th className="p-2.5">Position Title</th>
                        <th className="p-2.5">Grade</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeRosterData.staffList.map((emp) => {
                        const pers = db.getEmployeePersonalInfo(emp.id);
                        const empInfo = db.getEmployeeEmploymentInfo(emp.id);
                        const grade = db.getGradeLevels().find((g) => g.id === empInfo?.currentGradeId);
                        const isProf = empInfo?.employeeCategory === 'Professional';
                        const isSubProf = empInfo?.employeeCategory === 'Sub-Professional';

                        return (
                          <tr key={emp.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-bold text-blue-700">{emp.staffId}</td>
                            <td className="p-2.5 font-semibold text-slate-900">
                              {pers?.fullName || `${pers?.firstName || ''} ${pers?.surname || ''}`}
                            </td>
                            <td className="p-2.5">
                              {isProf ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                  Professional
                                </span>
                              ) : isSubProf ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  Sub-Professional
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                                  {empInfo?.employeeCategory}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-700">{empInfo?.currentPositionTitle}</td>
                            <td className="p-2.5 font-medium text-slate-800">{grade?.gradeName}</td>
                            <td className="p-2.5 text-right">
                              {onSelectEmployee && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInspectDeptId(null);
                                    onSelectEmployee(emp.id);
                                  }}
                                  className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-700 hover:text-white font-semibold transition-colors"
                                >
                                  View Dossier
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              </div>
            </div>

            {/* Panel Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setInspectDeptId(null)}
                className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* ADD DEPARTMENT SLIDING PANEL */}
      <SlideOverPanel
        isOpen={showAddDeptModal}
        onClose={() => setShowAddDeptModal(false)}
        title="Create New Department"
        subtitle="Organizational Structure • Department / Directorate"
        icon={<Building2 className="w-4 h-4" />}
      >
        <form onSubmit={handleCreateDepartment} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Parent MDA / Institution <span className="text-red-500">*</span>
              </label>
              <select
                value={newDeptMdaId}
                onChange={(e) => setNewDeptMdaId(parseInt(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                {mdas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} - {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Department Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. HRMD, RSIM, PPB"
                value={newDeptCode}
                onChange={(e) => setNewDeptCode(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded uppercase font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Department / Directorate Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Human Resource Management Directorate"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Designate Head of Department (Optional)
              </label>
              <select
                value={newDeptHeadId}
                onChange={(e) => setNewDeptHeadId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Leave Unassigned / Vacant --</option>
                {employees.map((emp) => {
                  const pers = db.getEmployeePersonalInfo(emp.id);
                  return (
                    <option key={emp.id} value={emp.id.toString()}>
                      {emp.staffId} - {pers?.fullName || `${pers?.firstName} ${pers?.surname}`}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddDeptModal(false)}
              className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs"
            >
              Save Department
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* ADD UNIT SLIDING PANEL */}
      <SlideOverPanel
        isOpen={showAddUnitModal}
        onClose={() => setShowAddUnitModal(false)}
        title="Add Operational Sub-Unit"
        subtitle={
          departments.find((d) => d.id === unitParentDeptId)?.departmentName ||
          'Organizational Structure'
        }
        icon={<Layers className="w-4 h-4" />}
      >
        <form onSubmit={handleCreateUnit} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Parent Department
              </label>
              <div className="p-2.5 bg-slate-100 rounded border border-slate-200 font-semibold text-slate-800">
                {departments.find((d) => d.id === unitParentDeptId)?.departmentName}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Unit Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. REC-U, TRN-U"
                value={newUnitCode}
                onChange={(e) => setNewUnitCode(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded uppercase font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Unit Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Recruitment & Appointments Unit"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddUnitModal(false)}
              className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs"
            >
              Save Unit
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* ADD MINISTRY / MDA SLIDING PANEL */}
      <SlideOverPanel
        isOpen={showAddMdaModal}
        onClose={() => setShowAddMdaModal(false)}
        title="Create New Government Ministry / MDA"
        subtitle="Public Service Institutional Entity"
        icon={<Building2 className="w-4 h-4" />}
      >
        <form onSubmit={handleCreateMda} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Institution Acronym / Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. MOH, MOTI, MLNR, MOE"
                value={newMdaCode}
                onChange={(e) => setNewMdaCode(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded uppercase font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Short abbreviation used for prefixing staff IDs and warrants.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Official Full Name of Ministry / MDA <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Ministry of Health, Ministry of Education"
                value={newMdaName}
                onChange={(e) => setNewMdaName(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Institutional Classification <span className="text-red-500">*</span>
              </label>
              <select
                value={newMdaType}
                onChange={(e) => setNewMdaType(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="Ministry">Central Government Ministry</option>
                <option value="Department">Extra-Ministerial Department</option>
                <option value="Agency">Executive Agency / Authority</option>
                <option value="Commission">Constitutional / Statutory Commission</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Designated Head / Minister / Chief Director (Optional)
              </label>
              <select
                value={newMdaHeadId}
                onChange={(e) => setNewMdaHeadId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Leave Unassigned / Vacant --</option>
                {employees.map((emp) => {
                  const pers = db.getEmployeePersonalInfo(emp.id);
                  return (
                    <option key={emp.id} value={emp.id.toString()}>
                      {emp.staffId} - {pers?.fullName || `${pers?.firstName} ${pers?.surname}`}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddMdaModal(false)}
              className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs"
            >
              Create Ministry / MDA
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* EDIT DEPARTMENT SLIDING PANEL */}
      <SlideOverPanel
        isOpen={Boolean(editingDept)}
        onClose={() => setEditingDept(null)}
        title="Edit Department / Directorate"
        subtitle={editDeptCode ? `${editDeptCode} • Organizational Structure` : 'Organizational Structure'}
        icon={<Edit2 className="w-4 h-4" />}
      >
        <form onSubmit={handleUpdateDepartment} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Parent MDA / Institution <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={editDeptMdaId.toString()}
                onChange={(val) => setEditDeptMdaId(parseInt(val, 10))}
                options={mdas.map((m) => ({
                  value: m.id.toString(),
                  label: `${m.code} - ${m.name}`,
                  subLabel: m.mdaType,
                }))}
                placeholder="Select MDA..."
                searchPlaceholder="Filter MDAs..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Department Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editDeptCode}
                  onChange={(e) => setEditDeptCode(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded uppercase font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <SearchableSelect
                  value={editDeptStatus}
                  onChange={(val) => setEditDeptStatus(val as 'Active' | 'Archived')}
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Archived', label: 'Archived' },
                  ]}
                  placeholder="Select status..."
                  searchPlaceholder="Filter status..."
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Department / Directorate Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editDeptName}
                onChange={(e) => setEditDeptName(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Head of Department (Optional)
              </label>
              <SearchableSelect
                value={editDeptHeadId}
                onChange={(val) => setEditDeptHeadId(val)}
                options={[
                  { value: '', label: '-- Leave Unassigned / Vacant --' },
                  ...employees.map((emp) => {
                    const pers = db.getEmployeePersonalInfo(emp.id);
                    const fullName =
                      pers?.fullName || `${pers?.firstName || ''} ${pers?.surname || ''}`.trim();
                    return {
                      value: emp.id.toString(),
                      label: `${emp.staffId} - ${fullName}`,
                    };
                  }),
                ]}
                placeholder="-- Leave Unassigned / Vacant --"
                searchPlaceholder="Search officer by name or ID..."
              />
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditingDept(null)}
              className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs"
            >
              Save Changes
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* DELETE DEPARTMENT SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(deletingDept)}
        onClose={() => {
          setDeletingDept(null);
          setDeleteDeptError('');
        }}
        title="Delete Department"
        subtitle={
          deletingDept
            ? `${deletingDept.dept.departmentCode} — ${deletingDept.dept.departmentName}`
            : undefined
        }
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingDept && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                Are you sure you want to permanently remove{' '}
                <strong className="text-rose-950">
                  {deletingDept.dept.departmentCode} — {deletingDept.dept.departmentName}
                </strong>
                ?
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
                <div>
                  Active Staff Assigned:{' '}
                  <strong className="text-slate-900">{deletingDept.staffCount} Officer(s)</strong>
                </div>
                <div>
                  Operational Sub-Units:{' '}
                  <strong className="text-slate-900">{deletingDept.unitsCount} Unit(s)</strong>
                  {deletingDept.unitsCount > 0 && ' (will also be removed)'}
                </div>
              </div>

              {(deletingDept.staffCount > 0 || deleteDeptError) && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2 text-[11px]">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    {deleteDeptError ||
                      `Cannot delete while ${deletingDept.staffCount} active officer(s) are assigned to this department. Reassign or transfer those officers first.`}
                  </span>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDeletingDept(null);
                  setDeleteDeptError('');
                }}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingDept.staffCount > 0}
                onClick={handleConfirmDeleteDept}
                className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* EDIT MINISTRY / MDA SLIDING PANEL */}
      <SlideOverPanel
        isOpen={Boolean(editingMda)}
        onClose={() => {
          setEditingMda(null);
          setEditMdaError('');
        }}
        title="Edit Ministry / MDA"
        subtitle={editMdaCode ? `${editMdaCode} • Public Service Institutional Entity` : 'Public Service Institutional Entity'}
        icon={<Edit2 className="w-4 h-4" />}
      >
        <form onSubmit={handleUpdateMda} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {editMdaError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2 text-[11px]">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{editMdaError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Institution Acronym / Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editMdaCode}
                  onChange={(e) => {
                    setEditMdaCode(e.target.value);
                    setEditMdaError('');
                  }}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded uppercase font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Operational Status
                </label>
                <SearchableSelect
                  value={editMdaIsActive ? 'active' : 'inactive'}
                  onChange={(val) => setEditMdaIsActive(val === 'active')}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                  placeholder="Select status..."
                  searchPlaceholder="Filter status..."
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Official Full Name of Ministry / MDA <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editMdaName}
                onChange={(e) => setEditMdaName(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Institutional Classification <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={editMdaType}
                onChange={(val) => setEditMdaType(val as Mda['mdaType'])}
                options={[
                  { value: 'Ministry', label: 'Central Government Ministry' },
                  { value: 'Department', label: 'Extra-Ministerial Department' },
                  { value: 'Agency', label: 'Executive Agency / Authority' },
                  { value: 'Commission', label: 'Constitutional / Statutory Commission' },
                ]}
                placeholder="Select classification..."
                searchPlaceholder="Filter classifications..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Designated Head / Minister / Chief Director (Optional)
              </label>
              <SearchableSelect
                value={editMdaHeadId}
                onChange={(val) => setEditMdaHeadId(val)}
                options={[
                  { value: '', label: '-- Leave Unassigned / Vacant --' },
                  ...employees.map((emp) => {
                    const pers = db.getEmployeePersonalInfo(emp.id);
                    const fullName =
                      pers?.fullName || `${pers?.firstName || ''} ${pers?.surname || ''}`.trim();
                    return {
                      value: emp.id.toString(),
                      label: `${emp.staffId} - ${fullName}`,
                    };
                  }),
                ]}
                placeholder="-- Leave Unassigned / Vacant --"
                searchPlaceholder="Search officer by name or ID..."
              />
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingMda(null);
                setEditMdaError('');
              }}
              className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs"
            >
              Save MDA Changes
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* DELETE MINISTRY / MDA SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(deletingMda)}
        onClose={() => {
          setDeletingMda(null);
          setDeleteMdaError('');
        }}
        title="Delete Ministry / MDA"
        subtitle={
          deletingMda ? `${deletingMda.mda.code} — ${deletingMda.mda.name}` : undefined
        }
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingMda && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                Are you sure you want to permanently remove{' '}
                <strong className="text-rose-950">
                  {deletingMda.mda.code} — {deletingMda.mda.name}
                </strong>
                ?
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
                <div>
                  Linked Departments:{' '}
                  <strong className="text-slate-900">{deletingMda.deptCount} Department(s)</strong>
                </div>
                <div>
                  Active Staff Assigned:{' '}
                  <strong className="text-slate-900">{deletingMda.staffCount} Officer(s)</strong>
                </div>
              </div>

              {(deletingMda.deptCount > 0 || deletingMda.staffCount > 0 || deleteMdaError) && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2 text-[11px]">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    {deleteMdaError ||
                      (deletingMda.deptCount > 0
                        ? `Cannot delete while ${deletingMda.deptCount} department(s) belong to this MDA. Delete or reassign those departments first.`
                        : `Cannot delete while ${deletingMda.staffCount} active officer(s) are assigned to this MDA. Transfer or reassign those officers first.`)}
                  </span>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDeletingMda(null);
                  setDeleteMdaError('');
                }}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingMda.deptCount > 0 || deletingMda.staffCount > 0}
                onClick={handleConfirmDeleteMda}
                className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
      {/* EDIT UNIT SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(editingUnit)}
        onClose={() => setEditingUnit(null)}
        title="Edit Operational Unit"
        subtitle={editingUnit ? `${editingUnit.unitCode} — ${editingUnit.unitName}` : undefined}
        icon={<Edit2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        <form onSubmit={handleUpdateUnit} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Unit Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editUnitCode}
                onChange={(e) => setEditUnitCode(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 font-mono uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Unit Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editUnitName}
                onChange={(e) => setEditUnitName(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditingUnit(null)}
              className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs"
            >
              Save Unit Changes
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* DELETE UNIT SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(deletingUnit)}
        onClose={() => {
          setDeletingUnit(null);
          setDeleteUnitError('');
        }}
        title="Delete Operational Unit"
        subtitle={
          deletingUnit ? `${deletingUnit.unit.unitCode} — ${deletingUnit.unit.unitName}` : undefined
        }
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingUnit && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                Are you sure you want to permanently delete operational unit{' '}
                <strong className="text-rose-950">
                  {deletingUnit.unit.unitCode} — {deletingUnit.unit.unitName}
                </strong>{' '}
                under {deletingUnit.deptName}?
              </div>

              {(deletingUnit.staffCount > 0 || deleteUnitError) && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2 text-[11px]">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    {deleteUnitError ||
                      `Cannot delete while ${deletingUnit.staffCount} officer(s) are posted to this unit. Reassign those officers first.`}
                  </span>
                </div>
              )}
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDeletingUnit(null);
                  setDeleteUnitError('');
                }}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingUnit.staffCount > 0}
                onClick={handleConfirmDeleteUnit}
                className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
