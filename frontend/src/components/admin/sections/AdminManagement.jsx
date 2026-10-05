import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Lock, Plus, ShieldCheck, ShieldOff, Unlock, UserCog, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import ConfirmModal from '../../ui/ConfirmModal';
import apiClient from '../../../config/apiClient';
import { useToast } from '../../../contexts/ToastContext';
import { useAuthStore } from '../../../store/authStore';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';

const BASE = '/api/v1/admin/admins';

const ROLE_STYLES = {
  super_admin: 'border-primary-500/40 bg-primary-500/10 text-primary-300',
  admin: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  editor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  viewer: 'border-dark-400 bg-dark-700 text-dark-100',
};

const INPUT =
  'w-full rounded-lg border border-dark-500 bg-dark-900 px-3.5 py-2.5 text-sm text-dark-50 placeholder-dark-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50';

const errorText = (err) => err?.data?.message || err?.data?.detail || err?.message || 'Something went wrong';

const fullName = (a) => `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.username;

const formatWhen = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const isLocked = (a) => {
  if (!a.locked_until) return false;
  const until = new Date(a.locked_until);
  return Number.isNaN(until.getTime()) || until.getTime() > Date.now();
};

const sameSet = (a, b) => a.length === b.length && a.every((v) => b.includes(v));

function RoleBadge({ role, label }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[role] || ROLE_STYLES.viewer}`}>
      {label || role}
    </span>
  );
}

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  username: '',
  phone: '',
  role: 'editor',
  permissions: null, // null = role defaults
  password: '',
  is_active: true,
};

/**
 * Add / edit an admin. `admin` null = add.
 */
function AdminEditor({ isOpen, admin, catalogue, isSelf, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setForm(
      admin
        ? {
            first_name: admin.first_name || '',
            last_name: admin.last_name || '',
            email: admin.email || '',
            username: admin.username || '',
            phone: admin.phone || '',
            role: admin.role,
            permissions: admin.custom_permissions ? admin.permissions : null,
            password: '',
            is_active: admin.is_active,
          }
        : EMPTY_FORM
    );
  }, [isOpen, admin]);

  const roleDefaults = useMemo(
    () => catalogue.roles.find((r) => r.value === form.role)?.permissions || [],
    [catalogue.roles, form.role]
  );
  const grantable = catalogue.permissions.filter((p) => p.grantable);
  const isSuper = form.role === 'super_admin';
  const checked = isSuper ? roleDefaults : form.permissions ?? roleDefaults;
  const isCustom = !isSuper && form.permissions !== null && !sameSet(form.permissions, roleDefaults);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const togglePermission = (value) => {
    const next = checked.includes(value) ? checked.filter((v) => v !== value) : [...checked, value];
    setForm((f) => ({ ...f, permissions: sameSet(next, roleDefaults) ? null : next }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        phone: form.phone.trim() || null,
        permissions: isSuper ? null : form.permissions,
      };
      let saved;
      if (admin) {
        if (!isSelf) {
          body.role = form.role;
          body.is_active = form.is_active;
        }
        saved = await apiClient.patch(`${BASE}/${admin.id}`, body);
        toast.success(`${fullName(saved)} updated`);
      } else {
        saved = await apiClient.post(BASE, { ...body, role: form.role, password: form.password });
        toast.success(`${fullName(saved)} added`);
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={admin ? `Edit ${fullName(admin)}` : 'Add admin'} size="md">
      <form onSubmit={save} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-dark-100">First name</span>
            <input required className={INPUT} value={form.first_name} onChange={set('first_name')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-dark-100">Last name</span>
            <input required className={INPUT} value={form.last_name} onChange={set('last_name')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-dark-100">Email</span>
            <input required type="email" className={INPUT} value={form.email} onChange={set('email')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-dark-100">Username</span>
            <input
              required
              minLength={3}
              pattern="[A-Za-z0-9._\-]+"
              title="Letters, numbers, dots, dashes and underscores"
              className={INPUT}
              value={form.username}
              onChange={set('username')}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-dark-100">Phone <span className="text-dark-300">(optional)</span></span>
            <input className={INPUT} value={form.phone} onChange={set('phone')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-dark-100">Role</span>
            <select
              className={INPUT}
              value={form.role}
              disabled={isSelf}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, permissions: null }))}
            >
              {catalogue.roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {isSelf && <span className="mt-1 block text-xs text-dark-200">You can't change your own role.</span>}
          </label>
          {!admin && (
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-dark-100">Password</span>
              <input
                required
                type="password"
                autoComplete="new-password"
                className={INPUT}
                value={form.password}
                onChange={set('password')}
              />
              <span className="mt-1 block text-xs text-dark-200">
                At least 8 characters with upper and lower case letters and a number. Share it with them securely.
              </span>
            </label>
          )}
        </div>

        <fieldset>
          <div className="mb-2 flex items-center justify-between gap-3">
            <legend className="text-sm font-medium text-dark-100">
              Permissions {isCustom && <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-300">Custom</span>}
            </legend>
            {isCustom && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, permissions: null }))}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                Reset to role defaults
              </button>
            )}
          </div>
          {isSuper ? (
            <p className="rounded-lg border border-dark-500 bg-dark-700/50 px-3 py-2.5 text-sm text-dark-100">
              Super admins have every permission, including managing admins and permanently deleting records.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {grantable.map((p) => (
                <label
                  key={p.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-dark-500 bg-dark-700/40 px-3 py-2.5 hover:border-dark-400"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-primary-500"
                    checked={checked.includes(p.value)}
                    onChange={() => togglePermission(p.value)}
                  />
                  <span>
                    <span className="block text-sm text-dark-50">{p.label}</span>
                    <span className="block text-xs text-dark-200">{p.description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {admin && (
          <label className={`flex items-center gap-3 ${isSelf ? 'opacity-50' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary-500"
              checked={form.is_active}
              disabled={isSelf}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            <span className="text-sm text-dark-50">
              Active
              <span className="block text-xs text-dark-200">Deactivating signs them out everywhere and blocks sign-in.</span>
            </span>
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-dark-500 pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? 'Saving…' : admin ? 'Save changes' : 'Add admin'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordModal({ admin, onClose }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPassword('');
    setError(null);
  }, [admin]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.post(`${BASE}/${admin.id}/reset-password`, { new_password: password });
      toast.success(res?.message || 'Password updated');
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!admin} onClose={onClose} title={admin ? `Set a new password for ${fullName(admin)}` : ''} size="sm">
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-dark-100">They'll be signed out everywhere and need this password to sign in again.</p>
        <input
          required
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          className={INPUT}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={saving || !password}>
            {saving ? 'Saving…' : 'Set password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Super admin "Admins" section: list, add and edit admins, roles and
 * per-admin permissions. Writes need a recent identity confirmation; the
 * apiClient handles the REAUTH_REQUIRED prompt and retries.
 */
const AdminManagement = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [data, setData] = useState({ items: [], roles: [], permissions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // admin, 'new' or null
  const [passwordFor, setPasswordFor] = useState(null);
  const [pending, setPending] = useState(null); // { kind, admin }

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await apiClient.get(BASE));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const roleLabel = (value) => data.roles.find((r) => r.value === value)?.label || value;
  const permissionLabel = (value) => data.permissions.find((p) => p.value === value)?.label || value;

  const upsert = (saved) =>
    setData((d) => ({
      ...d,
      items: d.items.some((a) => a.id === saved.id)
        ? d.items.map((a) => (a.id === saved.id ? saved : a))
        : [...d.items, saved],
    }));

  const runPending = async () => {
    const { kind, admin } = pending;
    try {
      if (kind === 'reset-security') {
        const res = await apiClient.post(`${BASE}/${admin.id}/reset-security`);
        toast.success(res?.message || '2FA and passkeys cleared');
      } else if (kind === 'unlock') {
        const res = await apiClient.post(`${BASE}/${admin.id}/unlock`);
        toast.success(res?.message || 'Unlocked');
      } else if (kind === 'toggle-active') {
        upsert(await apiClient.patch(`${BASE}/${admin.id}`, { is_active: !admin.is_active }));
        toast.success(`${fullName(admin)} ${admin.is_active ? 'deactivated' : 'reactivated'}`);
      }
      await load();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const confirmCopy = pending
    ? {
        'reset-security': {
          title: `Reset 2FA and passkeys for ${fullName(pending.admin)}?`,
          message: 'Their authenticator app and passkeys stop working and they set them up again at next sign-in. They are signed out everywhere.',
          confirmText: 'Reset',
        },
        unlock: {
          title: `Unlock ${fullName(pending.admin)}?`,
          message: 'Clears failed sign-in attempts so they can sign in again right away.',
          confirmText: 'Unlock',
          variant: 'info',
        },
        'toggle-active': pending.admin.is_active
          ? {
              title: `Deactivate ${fullName(pending.admin)}?`,
              message: 'They are signed out everywhere and can no longer sign in. Their activity history is kept.',
              confirmText: 'Deactivate',
            }
          : {
              title: `Reactivate ${fullName(pending.admin)}?`,
              message: 'They can sign in again with their existing password.',
              confirmText: 'Reactivate',
              variant: 'info',
            },
      }[pending.kind]
    : null;

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="System"
        title="Admins"
        icon={UserCog}
        description="Who can sign in to the admin panel and what each person can do. Changes here ask you to confirm it's you."
        actions={
          <Button variant="primary" size="sm" onClick={() => setEditing('new')} className="gap-1.5" disabled={!data.roles.length}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add admin
          </Button>
        }
      />

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <span>{error}</span>
          <Button variant="ghost" size="xs" onClick={load}>Retry</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-dark-600 bg-dark-800">
        {loading ? (
          <div className="space-y-px">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse bg-dark-750" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-dark-600 text-xs uppercase tracking-wider text-dark-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Admin</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Sign-in security</th>
                  <th className="px-4 py-3 font-medium">Last sign-in</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {data.items.map((a) => {
                  const isSelf = currentUser?.id === a.id;
                  return (
                    <tr key={a.id} className={`align-top ${a.is_active ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setEditing(a)} className="text-left">
                          <span className="block font-medium text-dark-50 hover:text-primary-400">
                            {fullName(a)} {isSelf && <span className="text-xs font-normal text-dark-200">(you)</span>}
                          </span>
                          <span className="block text-xs text-dark-200">{a.email} · @{a.username}</span>
                        </button>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {!a.is_active && (
                            <span className="rounded bg-dark-600 px-1.5 py-0.5 text-[11px] text-dark-100">Inactive</span>
                          )}
                          {isLocked(a) && (
                            <span className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[11px] text-red-300">
                              <Lock className="h-3 w-3" aria-hidden="true" /> Locked
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={a.role} label={roleLabel(a.role)} />
                        {a.custom_permissions && (
                          <span
                            className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-300"
                            title={a.permissions.map(permissionLabel).join(', ') || 'Read-only'}
                          >
                            Custom
                          </span>
                        )}
                        <span className="mt-1 block text-xs text-dark-200">
                          {a.role === 'super_admin'
                            ? 'Everything'
                            : a.permissions.length
                              ? a.permissions.map(permissionLabel).join(', ')
                              : 'Read-only'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`flex items-center gap-1.5 ${a.has_passkey ? 'text-green-400' : 'text-dark-200'}`}>
                          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> {a.has_passkey ? 'Passkey' : 'No passkey'}
                        </span>
                        <span className={`mt-1 flex items-center gap-1.5 ${a.is_2fa_enabled ? 'text-green-400' : 'text-dark-200'}`}>
                          {a.is_2fa_enabled
                            ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            : <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />}
                          {a.is_2fa_enabled ? '2FA on' : '2FA off'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-dark-100">
                        {formatWhen(a.last_login) || <span className="text-dark-300">Never</span>}
                        {a.last_login_ip && <span className="block text-dark-200">{a.last_login_ip}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button variant="ghost" size="xs" onClick={() => setEditing(a)}>Edit</Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            title="See what they changed"
                            onClick={() => navigate(`/admin/activity?admin_id=${a.id}`)}
                            className="gap-1"
                          >
                            <History className="h-3.5 w-3.5" aria-hidden="true" /> Activity
                          </Button>
                          <Button variant="ghost" size="xs" onClick={() => setPasswordFor(a)}>Set password</Button>
                          {(a.is_2fa_enabled || a.has_passkey) && (
                            <Button variant="ghost" size="xs" onClick={() => setPending({ kind: 'reset-security', admin: a })}>
                              Reset 2FA
                            </Button>
                          )}
                          {isLocked(a) && (
                            <Button variant="ghost" size="xs" onClick={() => setPending({ kind: 'unlock', admin: a })} className="gap-1">
                              <Unlock className="h-3.5 w-3.5" aria-hidden="true" /> Unlock
                            </Button>
                          )}
                          {!isSelf && (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => setPending({ kind: 'toggle-active', admin: a })}
                              className={a.is_active ? 'hover:!text-red-300' : ''}
                            >
                              {a.is_active ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminEditor
        isOpen={!!editing}
        admin={editing === 'new' ? null : editing}
        catalogue={data}
        isSelf={editing && editing !== 'new' && currentUser?.id === editing.id}
        onClose={() => setEditing(null)}
        onSaved={upsert}
      />

      <PasswordModal admin={passwordFor} onClose={() => setPasswordFor(null)} />

      <ConfirmModal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        onConfirm={runPending}
        title={confirmCopy?.title}
        message={confirmCopy?.message}
        confirmText={confirmCopy?.confirmText}
        variant={confirmCopy?.variant || 'danger'}
        confirmButtonVariant={confirmCopy?.variant === 'info' ? 'primary' : 'danger'}
      />
    </AdminPage>
  );
};

export default AdminManagement;
