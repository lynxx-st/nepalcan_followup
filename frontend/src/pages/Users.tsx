import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../services/api';
import { UserPlus, Users as UsersIcon, Shield, RotateCcw, Pencil } from 'lucide-react';

const ROLES = ['super-admin', 'admin', 'manager', 'staff'] as const;

const ROLE_BADGE: Record<string, string> = {
  'super-admin': 'bg-red-100 text-red-700',
  admin: 'bg-indigo-100 text-indigo-700',
  manager: 'bg-amber-100 text-amber-700',
  staff: 'bg-slate-100 text-slate-700',
};

interface UserRow {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  branches: string[];
  team: string | null;
  isActive: boolean;
  lastLoginAt?: string;
}

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [team, setTeam] = useState('');
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  })();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [u, b]: any = await Promise.all([adminApi.listUsers(), adminApi.listBranches()]);
      setUsers(u.data || []);
      setBranches(b.data || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleBranch = (branch: string) => {
    setSelectedBranches((prev) =>
      prev.includes(branch) ? prev.filter((b) => b !== branch) : [...prev, branch]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.createUser({ name, email, password, role, branches: selectedBranches, team: team || null });
      toast.success('User created');
      setShowCreate(false);
      setName(''); setEmail(''); setPassword(''); setRole('staff'); setSelectedBranches([]); setTeam('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveName = async (user: UserRow) => {
    try {
      await adminApi.updateUser(user.id, { name: nameDraft.trim() });
      toast.success('Name updated');
      setEditingName(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update name');
    }
  };

  const handleRoleChange = async (user: UserRow, newRole: string) => {    if (newRole === user.role) return;
    try {
      await adminApi.updateUser(user.id, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update role');
    }
  };

  const handleToggleActive = async (user: UserRow) => {
    try {
      await adminApi.updateUser(user.id, { isActive: !user.isActive });
      toast.success(user.isActive ? 'User deactivated' : 'User activated');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update user');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    try {
      await adminApi.resetPassword(resetTarget.id, resetPassword);
      toast.success(`Password reset for ${resetTarget.email}`);
      setResetTarget(null);
      setResetPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in">
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white rounded-2xl p-6 border border-indigo-500 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <UsersIcon className="w-6 h-6" />
            <div>
              <h1 className="text-2xl font-black">Team Members</h1>
              <p className="text-sm text-indigo-200 mt-1">Manage users, roles, branch and team access.</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-2 bg-white text-indigo-700 text-sm font-bold px-4 py-2 rounded-lg hover:bg-indigo-50 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-800">Create User</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sabin"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                {ROLES.filter((r) => r !== 'super-admin').map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team</label>
              <input type="text" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="e.g. Sales"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Branch Access (synced from orders)</label>
            {branches.length === 0 ? (
              <p className="text-sm text-slate-400">No branches found yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {branches.map((b) => (
                  <button type="button" key={b} onClick={() => toggleBranch(b)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer ${selectedBranches.includes(b) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
              {saving ? 'Creating...' : 'Create User'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="px-5 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">No users yet.</div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isSelf = currentUser?.id === u.id;
            return (
              <div key={u.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {editingName === u.id ? (
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(e) => { e.preventDefault(); handleSaveName(u); }}
                      >
                        <input
                          autoFocus
                          type="text"
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          className="px-2 py-1 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button type="submit" className="text-xs font-bold px-2 py-1 rounded bg-indigo-600 text-white cursor-pointer">Save</button>
                        <button type="button" onClick={() => setEditingName(null)} className="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 cursor-pointer">Cancel</button>
                      </form>
                    ) : (
                      <span className="font-bold text-slate-900">{u.name || u.email}</span>
                    )}
                    {!editingName && u.name && (
                      <span className="text-xs text-slate-400 font-medium">{u.email}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setEditingName(u.id); setNameDraft(u.name || ''); }}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Edit name"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {isSelf && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600">You</span>}
                    {!u.isActive && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">Inactive</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 space-x-2">
                    {u.branches.length > 0 && <span>Branches: {u.branches.join(', ')}</span>}
                    {u.team && <span>Team: {u.team}</span>}
                    {u.lastLoginAt && <span>Last login: {new Date(u.lastLoginAt).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u, e.target.value)}
                    className={`text-xs font-bold px-2 py-1.5 rounded-lg border-0 ${ROLE_BADGE[u.role] || 'bg-slate-100 text-slate-700'}`}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {!isSelf && (
                    <>
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer ${u.isActive ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => setResetTarget(u)}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset Password
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resetTarget && (
        <form onSubmit={handleReset} className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Shield className="w-4 h-4 text-indigo-600" /> Reset Password</h3>
            <p className="text-sm text-slate-500">Set a new password for <span className="font-bold text-slate-700">{resetTarget.email}</span></p>
            <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required minLength={8}
              placeholder="New password (min 8 chars)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setResetTarget(null)}
                className="px-5 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button type="submit" disabled={saving}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
                {saving ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
