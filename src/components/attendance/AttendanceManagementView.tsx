/**
 * Haros HRMIS - Attendance Management View
 * Features Daily Attendance Monitoring, Check-In/Check-Out Logging,
 * Punctuality Analysis, Absence Tracking, and Offline-Ready Civil Service Records.
 */

import React, { useState, useMemo } from 'react';
import {
  Clock,
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
  Shield,
  Zap,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { db } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import {
  AttendanceRecord,
  Employee,
  Department,
  Mda,
} from '../../types';
import { SlideOverPanel } from '../common/SlideOverPanel';
import { SearchableSelect } from '../common/SearchableSelect';

interface AttendanceManagementViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const AttendanceManagementView: React.FC<AttendanceManagementViewProps> = ({
  onSelectEmployee,
}) => {
  const { currentUser, hasPermission } = useAuth();
  const [dataVersion, setDataVersion] = useState(0);

  // Date selection (defaults to today)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDeptId, setFilterDeptId] = useState<string>('all');

  // Modals state
  const [showLogModal, setShowLogModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [deletingAttendance, setDeletingAttendance] = useState<{
    employeeId: number;
    staffId: string;
    fullName: string;
    date: string;
  } | null>(null);

  // Fetch data
  const employees = useMemo(() => db.getEmployees(), [dataVersion]);
  const departments = useMemo(() => db.getDepartments(), [dataVersion]);
  const rawAttendance = useMemo(() => db.getAttendanceRecords(selectedDate), [selectedDate, dataVersion]);

  // Combine nominal roll with attendance for the selected date
  const dailyRoster = useMemo(() => {
    return employees.map((emp) => {
      const pers = db.getEmployeePersonalInfo(emp.id);
      const empInfo = db.getEmployeeEmploymentInfo(emp.id);
      const dept = departments.find((d) => d.id === empInfo?.currentDepartmentId);
      const att = rawAttendance.find((a) => a.employeeId === emp.id);

      return {
        emp,
        pers,
        empInfo,
        dept,
        attendance: att || {
          id: 0,
          employeeId: emp.id,
          date: selectedDate,
          status: 'Absent' as const,
        },
      };
    });
  }, [employees, departments, rawAttendance, selectedDate]);

  // Filtered List
  const filteredRoster = useMemo(() => {
    return dailyRoster.filter((item) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchStaff = item.emp.staffId.toLowerCase().includes(q);
        const matchName = item.pers?.fullName?.toLowerCase().includes(q) || false;
        const matchDept = item.dept?.departmentName.toLowerCase().includes(q) || false;
        if (!matchStaff && !matchName && !matchDept) return false;
      }

      if (filterStatus !== 'all' && item.attendance.status !== filterStatus) return false;
      if (filterDeptId !== 'all' && item.empInfo?.currentDepartmentId.toString() !== filterDeptId) return false;

      return true;
    });
  }, [dailyRoster, searchTerm, filterStatus, filterDeptId]);

  // Metrics
  const metrics = useMemo(() => {
    const total = dailyRoster.length;
    const present = dailyRoster.filter((d) => d.attendance.status === 'Present').length;
    const late = dailyRoster.filter((d) => d.attendance.status === 'Late').length;
    const officialDuty = dailyRoster.filter((d) => d.attendance.status === 'Official Duty').length;
    const onLeave = dailyRoster.filter((d) => d.attendance.status === 'On Leave').length;
    const absent = dailyRoster.filter((d) => d.attendance.status === 'Absent').length;
    return { total, present, late, officialDuty, onLeave, absent };
  }, [dailyRoster]);

  // Form State for Log Modal
  const [logEmpId, setLogEmpId] = useState<number>(employees[0]?.id || 1);
  const [logCheckIn, setLogCheckIn] = useState('08:00');
  const [logCheckOut, setLogCheckOut] = useState('17:00');
  const [logStatus, setLogStatus] = useState<AttendanceRecord['status']>('Present');
  const [logRemarks, setLogRemarks] = useState('');

  const handleOpenLogModal = (preselectedEmpId?: number) => {
    const empId = preselectedEmpId || employees[0]?.id || 1;
    const existing = rawAttendance.find((a) => a.employeeId === empId);

    setLogEmpId(empId);
    setLogCheckIn(existing?.checkInTime || '08:00');
    setLogCheckOut(existing?.checkOutTime || '17:00');
    setLogStatus(existing?.status || 'Present');
    setLogRemarks(existing?.remarks || '');
    setEditingRecord(existing || null);
    setShowLogModal(true);
  };

  const handleSaveAttendance = (e: React.FormEvent) => {
    e.preventDefault();

    db.recordAttendance(
      {
        employeeId: logEmpId,
        date: selectedDate,
        checkInTime: logCheckIn || undefined,
        checkOutTime: logCheckOut || undefined,
        status: logStatus,
        remarks: logRemarks.trim() || undefined,
      },
      currentUser?.username || 'admin'
    );

    setShowLogModal(false);
    setDataVersion((v) => v + 1);
  };

  const handleBulkPopulate = () => {
    db.bulkGenerateDailyAttendance(selectedDate, currentUser?.username || 'admin');
    setDataVersion((v) => v + 1);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Staff ID',
      'Officer Name',
      'Department',
      'Check-In Time',
      'Check-Out Time',
      'Attendance Status',
      'Remarks',
    ];

    const rows = filteredRoster.map((item) => [
      `"${selectedDate}"`,
      `"${item.emp.staffId}"`,
      `"${item.pers?.fullName || ''}"`,
      `"${item.dept?.departmentName || ''}"`,
      `"${item.attendance.checkInTime || 'N/A'}"`,
      `"${item.attendance.checkOutTime || 'N/A'}"`,
      `"${item.attendance.status}"`,
      `"${(item.attendance.remarks || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Daily_Attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notificationService.success(
      'Attendance Roster Exported',
      `Exported daily attendance sheet (${selectedDate}) for ${filteredRoster.length} officer(s).`,
      { module: 'Attendance Management', actor: currentUser?.username }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Employee Services</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-blue-700">Attendance Management</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-700" />
            Civil Service Daily Attendance & Timekeeping
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Record employee arrivals, analyze punctuality, track official duty assignments, and reconcile monthly registers.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Roster</span>
          </button>

          {hasPermission('attendance.record') && (
            <>
              <button
                onClick={handleBulkPopulate}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
                title="Populate attendance for all staff on this date"
              >
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>Bulk Check-In</span>
              </button>

              <button
                onClick={() => handleOpenLogModal()}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Check-In</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Date Picker & Quick Shift Bar */}
      <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-blue-700" />
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Selected Working Date</div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded px-2.5 py-1"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().slice(0, 10));
            }}
            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
          >
            ← Previous Day
          </button>
          <button
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold"
          >
            Today
          </button>
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().slice(0, 10));
            }}
            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
          >
            Next Day →
          </button>
        </div>
      </div>

      {/* Daily Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Nominal Roll</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Officers on active duty roster</div>
        </div>

        <div className="bg-emerald-50/60 rounded-lg border border-emerald-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase flex items-center justify-between">
            <span>Present On-Time</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{metrics.present}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">
            {metrics.total > 0 ? ((metrics.present / metrics.total) * 100).toFixed(0) : 0}% on-time arrival
          </div>
        </div>

        <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase flex items-center justify-between">
            <span>Late Arrivals</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{metrics.late}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Arrived after 08:30 GMT</div>
        </div>

        <div className="bg-blue-50/60 rounded-lg border border-blue-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-800 uppercase flex items-center justify-between">
            <span>Official Duty / Leave</span>
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-1">{metrics.officialDuty + metrics.onLeave}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Authorized external assignments</div>
        </div>

        <div className="bg-red-50/60 rounded-lg border border-red-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-red-800 uppercase flex items-center justify-between">
            <span>Unexcused Absent</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-900 mt-1">{metrics.absent}</div>
          <div className="text-[10px] text-red-700 mt-0.5">No check-in recorded</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by staff ID, officer name, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center space-x-2.5 w-full md:w-auto text-xs">
          <SearchableSelect
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'all', label: 'All Attendance Statuses' },
              { value: 'Present', label: 'Present' },
              { value: 'Late', label: 'Late' },
              { value: 'Official Duty', label: 'Official Duty' },
              { value: 'On Leave', label: 'On Leave' },
              { value: 'Absent', label: 'Absent' },
            ]}
            placeholder="All Attendance Statuses"
            searchPlaceholder="Filter statuses..."
            buttonClassName="p-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 focus:bg-white h-8 w-44"
          />

          <SearchableSelect
            value={filterDeptId}
            onChange={setFilterDeptId}
            options={[
              { value: 'all', label: 'All Departments' },
              ...departments.map((d) => ({
                value: d.id.toString(),
                label: `${d.departmentCode} - ${d.departmentName}`,
              })),
            ]}
            placeholder="All Departments"
            searchPlaceholder="Filter departments..."
            buttonClassName="p-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 focus:bg-white h-8 w-52"
          />
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                <th className="p-3">Staff ID</th>
                <th className="p-3">Officer Name</th>
                <th className="p-3">Department</th>
                <th className="p-3 text-center">Check-In Time</th>
                <th className="p-3 text-center">Check-Out Time</th>
                <th className="p-3">Attendance Status</th>
                <th className="p-3">Remarks / Verification</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRoster.map((item) => {
                const att = item.attendance;

                return (
                  <tr key={item.emp.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                      {item.emp.staffId}
                    </td>

                    <td className="p-3">
                      <div className="font-semibold text-slate-900">
                        {item.pers?.fullName || `${item.pers?.firstName} ${item.pers?.surname}`}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.empInfo?.currentPositionTitle}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="text-slate-800 font-medium">{item.dept?.departmentName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{item.dept?.departmentCode}</div>
                    </td>

                    <td className="p-3 text-center font-mono font-bold whitespace-nowrap text-slate-800">
                      {att.checkInTime || '—'}
                    </td>

                    <td className="p-3 text-center font-mono font-semibold whitespace-nowrap text-slate-600">
                      {att.checkOutTime || '—'}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          att.status === 'Present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : att.status === 'Late'
                            ? 'bg-amber-100 text-amber-800'
                            : att.status === 'Official Duty'
                            ? 'bg-blue-100 text-blue-800'
                            : att.status === 'On Leave'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            att.status === 'Present'
                              ? 'bg-emerald-500'
                              : att.status === 'Late'
                              ? 'bg-amber-500'
                              : att.status === 'Official Duty'
                              ? 'bg-blue-500'
                              : att.status === 'On Leave'
                              ? 'bg-purple-500'
                              : 'bg-red-500'
                          }`}
                        ></span>
                        {att.status}
                      </span>
                    </td>

                    <td className="p-3 text-slate-500 text-[11px] truncate max-w-xs">
                      {att.remarks || 'Standard biometric / manual verification'}
                    </td>

                    <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                      {hasPermission('attendance.record') && (
                        <>
                          <button
                            onClick={() => handleOpenLogModal(item.emp.id)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                            title="Edit check-in or status"
                          >
                            <Edit2 className="w-3 h-3 inline" />
                          </button>
                          {att.id > 0 && (
                            <button
                              onClick={() =>
                                setDeletingAttendance({
                                  employeeId: item.emp.id,
                                  staffId: item.emp.staffId,
                                  fullName:
                                    item.pers?.fullName ||
                                    `${item.pers?.firstName || ''} ${item.pers?.surname || ''}`.trim() ||
                                    item.emp.staffId,
                                  date: selectedDate,
                                })
                              }
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-semibold transition-colors"
                              title="Clear saved attendance entry for this date"
                            >
                              <Trash2 className="w-3 h-3 inline" />
                            </button>
                          )}
                        </>
                      )}

                      {onSelectEmployee && (
                        <button
                          onClick={() => onSelectEmployee(item.emp.id)}
                          className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-700 hover:text-white text-blue-700 font-semibold transition-colors"
                        >
                          Dossier
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOG CHECK-IN SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        title="Record Officer Attendance"
        subtitle={`Working Date: ${selectedDate} • ${
          editingRecord ? 'Updating Existing Record' : 'New Timekeeping Entry'
        }`}
        icon={<Clock className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        <form onSubmit={handleSaveAttendance} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Civil Service Officer
              </label>
              <SearchableSelect
                value={logEmpId.toString()}
                onChange={(val) => setLogEmpId(parseInt(val, 10))}
                options={employees.map((emp) => {
                  const pers = db.getEmployeePersonalInfo(emp.id);
                  const name = pers?.fullName || `${pers?.firstName ?? ''} ${pers?.surname ?? ''}`.trim() || 'Officer';
                  return { value: emp.id.toString(), label: `${emp.staffId} - ${name}` };
                })}
                placeholder="Select officer..."
                searchPlaceholder="Search officer by Staff ID or name..."
                buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 h-10"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Attendance Status
              </label>
              <SearchableSelect
                value={logStatus}
                onChange={(val) => setLogStatus(val as AttendanceRecord['status'])}
                options={[
                  { value: 'Present', label: 'Present (On-Time)' },
                  { value: 'Late', label: 'Late Arrival' },
                  { value: 'Official Duty', label: 'Official Duty / Fieldwork' },
                  { value: 'On Leave', label: 'On Authorized Leave' },
                  { value: 'Absent', label: 'Unexcused Absent' },
                  { value: 'Half Day', label: 'Half Day' },
                ]}
                placeholder="Select status..."
                searchPlaceholder="Filter statuses..."
                buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 h-10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Check-In Time
                </label>
                <input
                  type="time"
                  value={logCheckIn}
                  onChange={(e) => setLogCheckIn(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Check-Out Time
                </label>
                <input
                  type="time"
                  value={logCheckOut}
                  onChange={(e) => setLogCheckOut(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Remarks / Justification
              </label>
              <textarea
                rows={3}
                placeholder="Record late reason, fieldwork assignment, or medical note..."
                value={logRemarks}
                onChange={(e) => setLogRemarks(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowLogModal(false)}
              className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs transition-colors"
            >
              Save Time Record
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* DELETE ATTENDANCE RECORD CONFIRMATION DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(deletingAttendance)}
        onClose={() => setDeletingAttendance(null)}
        title="Delete Attendance Record"
        subtitle={deletingAttendance ? `${deletingAttendance.staffId} • ${deletingAttendance.date}` : undefined}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingAttendance && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1.5">
                <div className="font-bold">
                  Remove saved timekeeping entry for {deletingAttendance.fullName} on {deletingAttendance.date}?
                </div>
                <p className="leading-relaxed">
                  Clearing this attendance record resets the officer&apos;s daily entry on this date until re-logged.
                </p>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingAttendance(null)}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  db.deleteAttendanceRecord(
                    deletingAttendance.employeeId,
                    deletingAttendance.date,
                    currentUser?.username || 'admin'
                  );
                  setDeletingAttendance(null);
                  setDataVersion((v) => v + 1);
                }}
                className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold shadow-xs"
              >
                Delete Record
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
