import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../services/api';
import { UserPlus, Users as UsersIcon, Shield, RotateCcw, Pencil } from 'lucide-react';

const ROLES = ['super-admin', 'admin', 'manager', 'staff'] as const;

const ROLE_BADGE: Record<string, string> = {
  'super-admin': 'bg-[#fef2f2] text-[#e7000b]',
  admin: 'bg-[#0a0a0a] text-white',
  manager: 'bg-[#fffbeb] text-[#d97706]',
  staff: 'bg-[#fafafa] text-[#737373]',
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

  const handleRoleChange = async (user: UserRow, newRole: string) => {
    if (newRole === user.role) return;
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
    <div className="max-w-4xl mx-auto space-y-6 animate-in pb-16 sm:pb-0">
      <div className="card-blueprint p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-[#0a0a0a] text-white flex items-center justify-center shrink-0">
              <UsersIcon className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#0a0a0a]">Team Members</h1>
              <p className="text-xs text-[#737373] mt-1">Manage users, roles, branch and team access.</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="btn-primary text-xs px-4 py-2.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="card-blueprint p-6 space-y-4">
          <h3 className="font-bold text-[#0a0a0a]">Create User</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#737373] mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sabin"
                className="input-blueprint w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#737373] mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="input-blueprint w-full" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#737373] mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                className="input-blueprint w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#737373] mb-1">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}
                className="input-blueprint w-full">
                {ROLES.filter((r) => r !== 'super-admin').map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#737373] mb-1">Team</label>
              <input type="text" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="e.g. Sales"
                className="input-blueprint w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#737373] mb-1">Branch Access (synced from orders)</label>
            {branches.length === 0 ? (
              <p className="text-sm text-[#a3a3a3]">No branches found yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {branches.map((b) => (
                  <button type="button" key={b} onClick={() => toggleBranch(b)}
                    className={`min-h-[44px] px-3.5 rounded-2xl text-xs font-bold border cursor-pointer ${selectedBranches.includes(b) ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]' : 'bg-[#fafafa] text-[#737373] border-[#e5e5e5]'}`}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="btn-primary px-5 py-2.5 disabled:opacity-50 cursor-pointer">
              {saving ? 'Creating...' : 'Create User'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="btn-outline px-5 py-2.5 cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="card-blueprint p-12 text-center text-[#a3a3a3]">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="card-blueprint p-12 text-center text-[#a3a3a3]">No users yet.</div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isSelf = currentUser?.id === u.id;
            return (
              <div key={u.id} className="card-blueprint p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                          className="input-blueprint w-40"
                        />
                        <button type="submit" className="btn-primary text-xs px-3 py-2 cursor-pointer">Save</button>
                        <button type="button" onClick={() => setEditingName(null)} className="btn-outline text-xs px-3 py-2 cursor-pointer">Cancel</button>
                      </form>
                    ) : (
                      <span className="font-bold text-[#0a0a0a]">{u.name || u.email}</span>
                    )}
                    {!editingName && u.name && (
                      <span className="text-xs text-[#a3a3a3] font-medium">{u.email}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setEditingName(u.id); setNameDraft(u.name || ''); }}
                      className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#737373] hover:text-[#0a0a0a] cursor-pointer"
                      title="Edit name"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {isSelf && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#fafafa] text-[#737373]">You</span>}
                    {!u.isActive && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#fef2f2] text-[#e7000b]">Inactive</span>}
                  </div>
                  <div className="text-xs text-[#737373] mt-1 space-x-2">
                    {u.branches.length > 0 && <span>Branches: {u.branches.join(', ')}</span>}
                    {u.team && <span>Team: {u.team}</span>}
                    {u.lastLoginAt && <span>Last login: {new Date(u.lastLoginAt).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u, e.target.value)}
                    className={`min-h-[44px] text-xs font-bold px-2.5 rounded-lg border-0 cursor-pointer ${ROLE_BADGE[u.role] || 'bg-[#fafafa] text-[#737373]'}`}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {!isSelf && (
                    <>
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`min-h-[44px] text-xs font-bold px-3 rounded-2xl cursor-pointer ${u.isActive ? 'bg-[#fafafa] text-[#737373] hover:bg-[#e5e5e5]' : 'bg-[#ecfdf5] text-[#059669] hover:bg-[#d1fae5]'}`}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => setResetTarget(u)}
                        className="min-h-[44px] flex items-center gap-1 text-xs font-bold px-3 rounded-2xl bg-[#fafafa] text-[#737373] hover:bg-[#e5e5e5] cursor-pointer"
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
          <div className="bg-white rounded-[24px] shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-[#0a0a0a] flex items-center gap-2"><Shield className="w-4 h-4 text-[#737373]" /> Reset Password</h3>
            <p className="text-sm text-[#737373]">Set a new password for <span className="font-bold text-[#0a0a0a]">{resetTarget.email}</span></p>
            <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required minLength={8}
              placeholder="New password (min 8 chars)"
              className="input-blueprint w-full" />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setResetTarget(null)}
                className="btn-outline px-5 py-2.5 cursor-pointer">Cancel</button>
              <button type="submit" disabled={saving}
                className="btn-primary px-5 py-2.5 disabled:opacity-50 cursor-pointer">
                {saving ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}