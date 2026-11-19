/**
 * Haros HRMIS - User Management and Security (Section 19)
 * Role-Based Access Control (RBAC), User Accounts register,
 * Custom Roles creator, and fine-grained Permission Matrix.
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  Shield,
  UserPlus,
  Key,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Edit2,
  Trash2,
  Search,
  Check,
  AlertTriangle,
  Plus,
  X,
  FileText,
  Eye,
  EyeOff,
} from 'lucide-react';
import { db } from '../../db/storage';
import { User, Role } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';

export const ALL_SYSTEM_PERMISSIONS = [
  { code: 'STAFF_VIEW', label: 'View Staff Records & Dossiers', module: 'Staff Management' },
  { code: 'STAFF_CREATE', label: 'Register New Public Officers', module: 'Staff Management' },
  { code: 'STAFF_EDIT', label: 'Edit Officer Profiles & Documents', module: 'Staff Management' },
  { code: 'STAFF_DELETE', label: 'Archive / Deactivate Staff Dossiers', module: 'Staff Management' },
  { code: 'MOVEMENT_SUBMIT', label: 'Initiate Staff Movement & Postings', module: 'Staff Movement' },
  { code: 'MOVEMENT_APPROVE', label: 'Approve & Implement Transfers/Postings', module: 'Staff Movement' },
  { code: 'PROMOTION_APPROVE', label: 'Approve Promotion Recommendations', module: 'Career Progression' },
  { code: 'LEAVE_APPROVE', label: 'Authorize & Deduct Leave Applications', module: 'Leave Management' },
  { code: 'PAYROLL_VIEW', label: 'View Salary Scales & Payslips', module: 'Payroll & Compensation' },
  { code: 'PAYROLL_MANAGE', label: 'Execute Payroll & Generate Bank Advice', module: 'Payroll & Compensation' },
  { code: 'CONFIDENTIAL_VIEW', label: 'View Classified & Disciplinary Dockets', module: 'Security & Integrity' },
  { code: 'DISCIPLINARY_MANAGE', label: 'Record Allegations & Committee Sanctions', module: 'Disciplinary Management' },
  { code: 'SEPARATION_MANAGE', label: 'Process Retirements & Exit Clearances', module: 'Retirement & Separation' },
  { code: 'ESTABLISHMENT_MANAGE', label: 'Manage Cadre Quotas & Organizational Units', module: 'Establishment Management' },
  { code: 'REPORTS_VIEW', label: 'Access & Export 20 Statutory Reports', module: 'Reporting & Analytics' },
  { code: 'USERS_MANAGE', label: 'Administer RBAC User Accounts & Passwords', module: 'System Security' },
  { code: 'SETTINGS_MANAGE', label: 'System Configuration, Backups & Recovery', module: 'System Administration' },
];

export const UserManagementView: React.FC = () => {
  const { currentUser, currentRole, isRole } = useAuth();
  const notifications = useNotifications();
  const isSystemAdmin = Boolean(
    currentUser &&
      isRole('System Administrator') &&
      currentUser.roleName === 'System Administrator'
  );

  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'matrix'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<User | null>(null);

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserStaffId, setEditUserStaffId] = useState('');
  const [editUserRoleId, setEditUserRoleId] = useState<number>(1);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDesc, setEditRoleDesc] = useState('');
  const [editRolePerms, setEditRolePerms] = useState<string[]>([]);
  const [deletingRole, setDeletingRole] = useState<{ role: Role; assignedCount: number } | null>(null);

  // Data
  const users = useMemo(() => db.getUsers(), [refreshTrigger]);
  const roles = useMemo(() => db.getRoles(), [refreshTrigger]);

  // Form states for new user
  const [formUsername, setFormUsername] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStaffId, setFormStaffId] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [formRoleId, setFormRoleId] = useState<number>(roles[0]?.id || 1);
  const [formError, setFormError] = useState('');

  // Form states for new role
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['STAFF_VIEW', 'REPORTS_VIEW']);

  // Handle Create User (System Administrator ONLY)
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!isSystemAdmin || !currentRole) {
      const msg = 'Access Denied: Only the System Administrator can create user accounts.';
      setFormError(msg);
      notifications.security('Unauthorized User Provisioning', msg, { module: 'User Management', actor: currentUser?.username });
      return;
    }
    if (!formUsername.trim() || !formFullName.trim() || !formEmail.trim()) {
      const msg = 'Please enter username, full name, and official email.';
      setFormError(msg);
      notifications.warning('Missing User Fields', msg, { module: 'User Management', actor: currentUser?.username });
      return;
    }
    if (formPassword.length < 6) {
      const msg = 'Initial password must be at least 6 characters long.';
      setFormError(msg);
      notifications.warning('Password Policy Warning', msg, { module: 'User Management', actor: currentUser?.username });
      return;
    }
    if (formPassword !== formConfirmPassword) {
      const msg = 'Initial password and confirmation password do not match.';
      setFormError(msg);
      notifications.warning('Password Mismatch', msg, { module: 'User Management', actor: currentUser?.username });
      return;
    }
    const role = roles.find((r) => r.id === formRoleId);
    if (!role) {
      const msg = 'Please select a valid role.';
      setFormError(msg);
      notifications.warning('Invalid Role Selected', msg, { module: 'User Management', actor: currentUser?.username });
      return;
    }

    try {
      db.createUser(
        {
          username: formUsername.trim(),
          fullName: formFullName.trim(),
          email: formEmail.trim(),
          staffId: formStaffId.trim() || undefined,
          roleId: role.id,
          roleName: role.roleName,
          password: formPassword,
          isActive: true,
        },
        currentUser?.username || 'admin',
        currentRole.roleName
      );
      setRefreshTrigger((prev) => prev + 1);
      setShowAddUserModal(false);
      setFormUsername('');
      setFormFullName('');
      setFormEmail('');
      setFormStaffId('');
      setFormPassword('');
      setFormConfirmPassword('');
      setActionNotice({
        type: 'success',
        text: `User account '${formUsername.trim()}' created under role '${role.roleName}'.`,
      });
    } catch (err: any) {
      const msg = err.message || 'Error creating user account.';
      setFormError(msg);
      notifications.error('Account Creation Error', msg, { module: 'User Management', actor: currentUser?.username });
    }
  };

  // Toggle user active status
  const handleToggleStatus = (user: User) => {
    if (!isSystemAdmin) return;
    if (user.username === 'admin') {
      const msg = 'The root system administrator account cannot be deactivated.';
      setActionNotice({ type: 'error', text: msg });
      notifications.security('Protected Root Account', msg, { module: 'User Management', actor: currentUser?.username });
      return;
    }
    db.updateUser(user.id, { isActive: !user.isActive }, currentUser?.username || 'admin');
    setRefreshTrigger((prev) => prev + 1);
    setActionNotice({
      type: 'success',
      text: `Account '${user.username}' ${!user.isActive ? 'activated' : 'deactivated'}.`,
    });
  };

  // Reset failed login attempts
  const handleUnlockUser = (user: User) => {
    if (!isSystemAdmin) return;
    db.updateUser(user.id, { failedLoginAttempts: 0 }, currentUser?.username || 'admin');
    setRefreshTrigger((prev) => prev + 1);
    setActionNotice({
      type: 'success',
      text: `Account '${user.username}' has been unlocked and failed attempts cleared.`,
    });
  };

  // Confirm Delete user
  const handleConfirmDeleteUser = () => {
    if (!isSystemAdmin || !pendingDeleteUser) return;
    if (pendingDeleteUser.username === 'admin') {
      const msg = 'Cannot delete primary system administrator.';
      setActionNotice({ type: 'error', text: msg });
      notifications.security('Protected Root Account', msg, { module: 'User Management', actor: currentUser?.username });
      setPendingDeleteUser(null);
      return;
    }
    const deletedName = pendingDeleteUser.username;
    db.deleteUser(pendingDeleteUser.id, currentUser?.username || 'admin');
    setPendingDeleteUser(null);
    setRefreshTrigger((prev) => prev + 1);
    setActionNotice({ type: 'success', text: `User account '${deletedName}' has been deleted.` });
  };

  // Handle Create Role
  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSystemAdmin || !newRoleName.trim()) return;
    db.createRole(
      {
        roleName: newRoleName.trim(),
        description: newRoleDesc.trim(),
        isSystemRole: false,
        permissions: selectedPermissions,
      },
      currentUser?.username || 'admin'
    );
    setRefreshTrigger((prev) => prev + 1);
    setShowAddRoleModal(false);
    setNewRoleName('');
    setNewRoleDesc('');
    setSelectedPermissions(['STAFF_VIEW', 'REPORTS_VIEW']);
  };

  // Toggle permission in role
  const handleToggleRolePermission = (role: Role, permCode: string) => {
    if (!isSystemAdmin) return;
    if (role.isSystemRole && role.roleName === 'System Administrator') {
      const msg = 'System Administrator has immutable root permissions and cannot be modified.';
      setActionNotice({
        type: 'error',
        text: msg,
      });
      notifications.security('Immutable Role Policy', msg, { module: 'User Management', actor: currentUser?.username });
      return;
    }
    const hasPerm = role.permissions.includes(permCode);
    const updatedPerms = hasPerm
      ? role.permissions.filter((p) => p !== permCode)
      : [...role.permissions, permCode];

    db.updateRole(role.id, { permissions: updatedPerms }, currentUser?.username || 'admin');
    setRefreshTrigger((prev) => prev + 1);
  };

  // Open Edit User
  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserFullName(user.fullName);
    setEditUserEmail(user.email);
    setEditUserStaffId(user.staffId || '');
    setEditUserRoleId(user.roleId);
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSystemAdmin || !editingUser) return;
    const role = roles.find((r) => r.id === editUserRoleId);
    if (!role) return;
    const targetRole =
      editingUser.username === 'admin'
        ? roles.find((r) => r.roleName === 'System Administrator') || role
        : role;

    db.updateUser(
      editingUser.id,
      {
        fullName: editUserFullName.trim(),
        email: editUserEmail.trim(),
        staffId: editUserStaffId.trim() || undefined,
        roleId: targetRole.id,
        roleName: targetRole.roleName,
      },
      currentUser?.username || 'admin'
    );
    setEditingUser(null);
    setRefreshTrigger((prev) => prev + 1);
    setActionNotice({
      type: 'success',
      text: `Updated user account '${editingUser.username}'.`,
    });
  };

  // Open Edit Role
  const handleOpenEditRole = (role: Role) => {
    setEditingRole(role);
    setEditRoleName(role.roleName);
    setEditRoleDesc(role.description);
    setEditRolePerms([...role.permissions]);
  };

  const handleSaveEditRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSystemAdmin || !editingRole) return;
    const isRoot = editingRole.isSystemRole && editingRole.roleName === 'System Administrator';
    db.updateRole(
      editingRole.id,
      {
        roleName: editingRole.isSystemRole ? editingRole.roleName : editRoleName.trim(),
        description: editRoleDesc.trim(),
        permissions: isRoot ? editingRole.permissions : editRolePerms,
      },
      currentUser?.username || 'admin'
    );
    setEditingRole(null);
    setRefreshTrigger((prev) => prev + 1);
    setActionNotice({
      type: 'success',
      text: `Updated role '${editingRole.isSystemRole ? editingRole.roleName : editRoleName.trim()}'.`,
    });
  };

  const handleConfirmDeleteRole = () => {
    if (!isSystemAdmin || !deletingRole) return;
    const res = db.deleteRole(deletingRole.role.id, currentUser?.username || 'admin');
    setDeletingRole(null);
    setRefreshTrigger((prev) => prev + 1);
    setActionNotice({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (searchTerm.trim() === '') return true;
      const q = searchTerm.toLowerCase();
      return (
        u.username.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.roleName.toLowerCase().includes(q)
      );
    });
  }, [users, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden text-slate-800 text-xs">
      {/* Top Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">User Management & Role-Based Access Control (RBAC)</h1>
            <p className="text-[11px] text-slate-500">
              Manage civil service credentials, institutional roles, password policies, and security permissions
            </p>
          </div>
        </div>

        {/* Tab Switcher & Action */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded font-semibold transition-colors ${
                activeTab === 'users' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              User Accounts ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`px-3 py-1.5 rounded font-semibold transition-colors ${
                activeTab === 'roles' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Civil Service Roles ({roles.length})
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded font-semibold transition-colors ${
                activeTab === 'matrix' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Permission Matrix
            </button>
          </div>

          {activeTab === 'users' && isSystemAdmin && (
            <button
              onClick={() => {
                setFormError('');
                setShowAddUserModal(true);
              }}
              className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create User</span>
            </button>
          )}

          {activeTab === 'roles' && isSystemAdmin && (
            <button
              onClick={() => setShowAddRoleModal(true)}
              className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Custom Role</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!isSystemAdmin && (
          <div className="max-w-7xl mx-auto mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-center space-x-2 text-xs">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Read-Only Security View:</strong> Only the <strong>System Administrator</strong> can create new
              user accounts, modify roles, or manage access permissions. Use{' '}
              <strong>System Configuration → Password Reset</strong> to update your own password.
            </span>
          </div>
        )}

        {actionNotice && (
          <div
            className={`max-w-7xl mx-auto mb-4 p-3 rounded-lg border flex items-center justify-between text-xs font-medium ${
              actionNotice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <span>{actionNotice.text}</span>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="p-0.5 rounded hover:bg-black/5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {pendingDeleteUser && isSystemAdmin && (
          <div className="max-w-7xl mx-auto mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-rose-900 font-medium">
              Delete user account <strong className="font-mono">{pendingDeleteUser.username}</strong> (
              {pendingDeleteUser.roleName})? This user will immediately lose workstation access.
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setPendingDeleteUser(null)}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: USER ACCOUNTS TABLE */}
        {activeTab === 'users' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Search and stats bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
              <div className="relative min-w-[260px] flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search user accounts by username, name, email, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded border border-slate-300 bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center space-x-4 text-slate-600 font-mono text-[11px]">
                <span>
                  Active Accounts: <b className="text-emerald-700">{users.filter((u) => u.isActive).length}</b>
                </span>
                <span>
                  Deactivated: <b className="text-rose-700">{users.filter((u) => !u.isActive).length}</b>
                </span>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
                      <th className="p-3">User / Identity</th>
                      <th className="p-3">Full Officer Name</th>
                      <th className="p-3">Official Email</th>
                      <th className="p-3">Linked Staff ID</th>
                      <th className="p-3">Assigned Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Failed Logins</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold">
                              {user.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 font-mono">{user.username}</div>
                              <div className="text-[10px] text-slate-400">ID #{user.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-slate-800">{user.fullName}</td>
                        <td className="p-3 font-mono text-slate-600">{user.email}</td>
                        <td className="p-3 font-mono text-blue-700 font-semibold">{user.staffId || '—'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {user.roleName}
                          </span>
                        </td>
                        <td className="p-3">
                          {user.isActive ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3 mr-1" />
                              Deactivated
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {user.failedLoginAttempts > 0 ? (
                            <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                              {user.failedLoginAttempts} failed
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {isSystemAdmin ? (
                            <div className="flex items-center justify-end space-x-1.5">
                              {user.failedLoginAttempts > 0 && (
                                <button
                                  onClick={() => handleUnlockUser(user)}
                                  className="p-1 rounded text-amber-600 hover:bg-amber-50"
                                  title="Reset failed login counter"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(user)}
                                className="p-1 rounded text-slate-500 hover:text-blue-700 hover:bg-blue-50"
                                title="Edit user account"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(user)}
                                className={`p-1 rounded ${
                                  user.isActive
                                    ? 'text-rose-600 hover:bg-rose-50'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={user.isActive ? 'Deactivate User Account' : 'Activate User Account'}
                              >
                                {user.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                              {user.username !== 'admin' && (
                                <button
                                  onClick={() => setPendingDeleteUser(user)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                  title="Delete user account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">Admin Only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ROLES REGISTRY */}
        {activeTab === 'roles' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((role) => {
                const assignedCount = users.filter(
                  (u) => u.roleName === role.roleName || u.roleId === role.id
                ).length;
                return (
                  <div key={role.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded bg-blue-50 text-blue-700 flex items-center justify-center">
                            <Shield className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">{role.roleName}</h3>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {role.isSystemRole ? 'System Built-In Role' : 'Custom Defined Role'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
                            {role.permissions.length} perms
                          </span>
                          {isSystemAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditRole(role)}
                                title="Edit Role Details & Permissions"
                                className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {!role.isSystemRole && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingRole({ role, assignedCount })}
                                  title="Delete Custom Role"
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 mt-2">{role.description}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">
                        Users Assigned: <b>{assignedCount}</b>
                      </span>
                      <button
                        onClick={() => setActiveTab('matrix')}
                        className="text-blue-600 hover:text-blue-800 font-semibold text-[11px]"
                      >
                        Configure Permissions →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: FINE-GRAINED PERMISSION MATRIX */}
        {activeTab === 'matrix' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-900 text-[11px] flex items-center justify-between">
              <div>
                <b>Civil Service Security Policy:</b> Click checkboxes below to grant or revoke specific operational
                authorizations for each role in real-time. Changes are logged immediately to the append-only audit trail.
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <th className="p-3 min-w-[220px]">Permission Definition</th>
                      <th className="p-3 min-w-[140px]">Functional Module</th>
                      {roles.map((role) => (
                        <th key={role.id} className="p-3 text-center min-w-[110px] border-l border-slate-200">
                          <div className="font-bold text-slate-900">{role.roleName}</div>
                          <div className="text-[9px] text-slate-400 font-mono">
                            {role.isSystemRole ? 'System' : 'Custom'}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ALL_SYSTEM_PERMISSIONS.map((perm) => (
                      <tr key={perm.code} className="hover:bg-slate-50/70">
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{perm.label}</div>
                          <div className="text-[10px] font-mono text-slate-400">{perm.code}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                            {perm.module}
                          </span>
                        </td>
                        {roles.map((role) => {
                          const hasPerm = role.permissions.includes(perm.code);
                          const isRoot = role.isSystemRole && role.roleName === 'System Administrator';
                          const disabledCheckbox = isRoot || !isSystemAdmin;
                          return (
                            <td key={role.id} className="p-3 text-center border-l border-slate-200">
                              <input
                                type="checkbox"
                                checked={hasPerm}
                                disabled={disabledCheckbox}
                                onChange={() => handleToggleRolePermission(role, perm.code)}
                                className={`w-4 h-4 rounded text-blue-600 focus:ring-blue-500 ${
                                  disabledCheckbox ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DRAWER: ADD USER */}
      <SlideOverPanel
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        title="Create Civil Service User Account"
        subtitle="RBAC Security Provisioning & Account Access"
        icon={<UserPlus className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        <form onSubmit={handleCreateUser} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {formError && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Username (Login ID) *</label>
              <input
                type="text"
                required
                placeholder="e.g. k.mensah or hr_officer"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Officer Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Kwame Mensah"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Official Email Address *</label>
              <input
                type="email"
                required
                placeholder="e.g. kmensah@ohcs.gov.gh"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Link to Staff ID (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. CS-2021-0042"
                value={formStaffId}
                onChange={(e) => setFormStaffId(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assign Security Role *</label>
              <SearchableSelect
                value={formRoleId}
                onChange={(val) => setFormRoleId(parseInt(val, 10))}
                options={roles.map((r) => ({
                  value: r.id.toString(),
                  label: r.roleName,
                  subLabel: `${r.permissions.length} perms`,
                  badge: r.isSystemRole ? 'System' : 'Custom',
                }))}
                placeholder="Select security role..."
                searchPlaceholder="Filter roles..."
              />
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Initial Password * (min 6 characters)
                </label>
                <button
                  type="button"
                  onClick={() => setShowFormPassword(!showFormPassword)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 inline-flex items-center space-x-1 font-medium"
                >
                  {showFormPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showFormPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                type={showFormPassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Set initial workstation password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Confirm Initial Password *
                </label>
                <input
                  type={showFormPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Re-enter initial password"
                  value={formConfirmPassword}
                  onChange={(e) => setFormConfirmPassword(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddUserModal(false)}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
            >
              Save &amp; Provision Account
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* DRAWER: ADD CUSTOM ROLE */}
      <SlideOverPanel
        isOpen={showAddRoleModal}
        onClose={() => setShowAddRoleModal(false)}
        title="Create New Custom Civil Service Role"
        subtitle="Fine-Grained RBAC Role & Permission Allocation"
        icon={<Shield className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        <form onSubmit={handleCreateRole} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Role Title / Designation *</label>
              <input
                type="text"
                required
                placeholder="e.g. Regional Registry Officer"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description &amp; Scope</label>
              <textarea
                rows={2}
                placeholder="Scope of duties and functional access boundaries..."
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                className="w-full p-2 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Grant Permissions ({selectedPermissions.length} selected)
              </label>
              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded p-2 space-y-1 bg-slate-50">
                {ALL_SYSTEM_PERMISSIONS.map((p) => {
                  const isChecked = selectedPermissions.includes(p.code);
                  return (
                    <label
                      key={p.code}
                      className="flex items-center space-x-2 p-1.5 rounded hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedPermissions((prev) => prev.filter((c) => c !== p.code));
                          } else {
                            setSelectedPermissions((prev) => [...prev, p.code]);
                          }
                        }}
                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800 text-[11px]">{p.label}</span>
                      <span className="text-[9px] font-mono text-slate-400">({p.module})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddRoleModal(false)}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
            >
              Create Custom Role
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* DRAWER: EDIT USER ACCOUNT */}
      <SlideOverPanel
        isOpen={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title={editingUser ? `Edit User Account: ${editingUser.username}` : 'Edit User Account'}
        subtitle="Update Officer Identity, Staff Link & Security Role"
        icon={<Edit2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {editingUser && (
          <form onSubmit={handleSaveEditUser} className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Username (Immutable)</label>
                <input
                  type="text"
                  disabled
                  value={editingUser.username}
                  className="w-full h-8 px-2.5 rounded border border-slate-200 bg-slate-100 text-slate-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Officer Name *</label>
                <input
                  type="text"
                  required
                  value={editUserFullName}
                  onChange={(e) => setEditUserFullName(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Official Email Address *</label>
                <input
                  type="email"
                  required
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Linked Staff ID</label>
                <input
                  type="text"
                  value={editUserStaffId}
                  onChange={(e) => setEditUserStaffId(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assigned Security Role *</label>
                {editingUser.username === 'admin' ? (
                  <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                    Primary <strong>admin</strong> account role is locked to System Administrator.
                  </div>
                ) : (
                  <SearchableSelect
                    value={editUserRoleId}
                    onChange={(val) => setEditUserRoleId(parseInt(val, 10))}
                    options={roles.map((r) => ({
                      value: r.id.toString(),
                      label: r.roleName,
                      subLabel: `${r.permissions.length} perms`,
                      badge: r.isSystemRole ? 'System' : 'Custom',
                    }))}
                    placeholder="Select security role..."
                    searchPlaceholder="Filter roles..."
                  />
                )}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
              >
                Save Account Changes
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* DRAWER: EDIT ROLE */}
      <SlideOverPanel
        isOpen={Boolean(editingRole)}
        onClose={() => setEditingRole(null)}
        title={editingRole ? `Edit Role: ${editingRole.roleName}` : 'Edit Role'}
        subtitle="Update Role Description & Permission Matrix"
        icon={<Edit2 className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        {editingRole && (
          <form onSubmit={handleSaveEditRole} className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Role Title / Designation *</label>
                <input
                  type="text"
                  required
                  disabled={editingRole.isSystemRole}
                  value={editRoleName}
                  onChange={(e) => setEditRoleName(e.target.value)}
                  className={`w-full h-8 px-2.5 rounded border border-slate-300 text-xs ${
                    editingRole.isSystemRole ? 'bg-slate-100 text-slate-500' : 'focus:ring-1 focus:ring-blue-500 focus:outline-hidden'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description &amp; Scope</label>
                <textarea
                  rows={2}
                  value={editRoleDesc}
                  onChange={(e) => setEditRoleDesc(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Granted Permissions ({editRolePerms.length} selected)
                </label>
                {editingRole.isSystemRole && editingRole.roleName === 'System Administrator' ? (
                  <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                    System Administrator permissions are immutable root authorizations.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto border border-slate-200 rounded p-2 space-y-1 bg-slate-50">
                    {ALL_SYSTEM_PERMISSIONS.map((p) => {
                      const isChecked = editRolePerms.includes(p.code);
                      return (
                        <label
                          key={p.code}
                          className="flex items-center space-x-2 p-1.5 rounded hover:bg-white cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setEditRolePerms((prev) => prev.filter((c) => c !== p.code));
                              } else {
                                setEditRolePerms((prev) => [...prev, p.code]);
                              }
                            }}
                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-semibold text-slate-800 text-[11px]">{p.label}</span>
                          <span className="text-[9px] font-mono text-slate-400">({p.module})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingRole(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
              >
                Save Role Changes
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* DRAWER: DELETE CUSTOM ROLE */}
      <SlideOverPanel
        isOpen={Boolean(deletingRole)}
        onClose={() => setDeletingRole(null)}
        title="Delete Custom Security Role"
        subtitle={deletingRole?.role.roleName}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingRole && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                Permanently delete custom role <strong>{deletingRole.role.roleName}</strong>?
              </div>
              {deletingRole.assignedCount > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start space-x-2 text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    Cannot delete while {deletingRole.assignedCount} user account(s) are assigned to this role. Reassign those users first.
                  </span>
                </div>
              )}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingRole(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingRole.assignedCount > 0}
                onClick={handleConfirmDeleteRole}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
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
