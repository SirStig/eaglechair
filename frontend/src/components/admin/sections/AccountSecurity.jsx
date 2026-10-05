import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
} from 'lucide-react';
import apiClient from '../../../config/apiClient';
import { useToast } from '../../../contexts/ToastContext';
import { useAuthStore } from '../../../store/authStore';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';

const ROLE_LABELS = { viewer: 'Viewer', editor: 'Editor', admin: 'Admin', super_admin: 'Super Admin' };

const PERMISSION_LABELS = {
  edit_catalog: 'Edit catalog',
  edit_sales: 'Edit sales',
  edit_content: 'Edit website content',
  delete: 'Delete',
  view_audit: 'View activity log',
  permanent_delete: 'Permanently delete',
  manage_admins: 'Manage admins',
};

// Mirrors SecurityManager.validate_password_strength (PASSWORD_MIN_LENGTH = 8)
const MIN_LENGTH = 8;
const PASSWORD_RULES = [
  { label: `At least ${MIN_LENGTH} characters`, test: (p) => p.length >= MIN_LENGTH },
  { label: 'One number', test: (p) => /\d/.test(p) },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
];

const inputClass =
  'w-full rounded-lg border border-dark-500 bg-dark-900 px-3 py-2.5 text-sm text-dark-50 placeholder-dark-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50';

function Panel({ title, description, icon: Icon, children, actions }) {
  return (
    <section className="rounded-xl border border-dark-600 bg-dark-800">
      <header className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-dark-50">
            {Icon && <Icon className="h-4 w-4 text-primary-500" aria-hidden="true" />}
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-dark-200">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function formatWhen(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function DeviceIcon({ device, className }) {
  const label = (device || '').toLowerCase();
  if (label.includes('iphone') || label.includes('android')) return <Smartphone className={className} aria-hidden="true" />;
  if (label.includes('ipad')) return <Tablet className={className} aria-hidden="true" />;
  return <Laptop className={className} aria-hidden="true" />;
}

function ProfilePanel({ user, permissions }) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username;
  return (
    <Panel title="Profile" icon={ShieldCheck} description="Ask a super admin to change your name, email or role.">
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-dark-200">Name</dt>
          <dd className="mt-0.5 font-medium text-dark-50">{name}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-dark-200">Email</dt>
          <dd className="mt-0.5 truncate font-medium text-dark-50">{user?.email}</dd>
        </div>
        <div>
          <dt className="text-dark-200">Role</dt>
          <dd className="mt-0.5 font-medium text-dark-50">{ROLE_LABELS[user?.role] || user?.role}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <p className="text-sm text-dark-200">What you can do</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {permissions.size === 0 && (
            <li className="rounded-full border border-dark-500 px-2.5 py-1 text-xs text-dark-100">View only</li>
          )}
          {Object.keys(PERMISSION_LABELS)
            .filter((p) => permissions.has(p))
            .map((p) => (
              <li key={p} className="rounded-full border border-primary-500/30 bg-primary-500/10 px-2.5 py-1 text-xs text-primary-300">
                {PERMISSION_LABELS[p]}
              </li>
            ))}
        </ul>
      </div>
    </Panel>
  );
}

function ChangePasswordPanel({ toast, onChanged }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const rules = PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(form.next) }));
  const matches = form.next.length > 0 && form.next === form.confirm;
  const canSubmit = form.current && rules.every((r) => r.ok) && matches && !saving;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/api/v1/auth/password/change', {
        current_password: form.current,
        new_password: form.next,
      });
      setForm({ current: '', next: '', confirm: '' });
      toast.success('Password changed. Your other devices have been signed out.');
      onChanged();
    } catch (err) {
      setError(err.message || 'Could not change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Change password" icon={KeyRound} description="You stay signed in here; every other device is signed out.">
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-dark-100">Current password</span>
            <input type="password" autoComplete="current-password" className={inputClass} value={form.current} onChange={set('current')} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-dark-100">New password</span>
            <input type="password" autoComplete="new-password" className={inputClass} value={form.next} onChange={set('next')} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-dark-100">Confirm new password</span>
            <input type="password" autoComplete="new-password" className={inputClass} value={form.confirm} onChange={set('confirm')} />
          </label>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-dark-900 transition-colors hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Change password
          </button>
        </div>
        <ul className="space-y-1.5 self-start rounded-lg border border-dark-600 bg-dark-900/60 p-4 text-sm" aria-label="Password requirements">
          {rules.map((rule) => (
            <li key={rule.label} className={rule.ok ? 'text-emerald-400' : 'text-dark-200'}>
              <CheckCircle2 className="mr-1.5 inline h-4 w-4 align-[-3px]" aria-hidden="true" />
              {rule.label}
            </li>
          ))}
          <li className={matches ? 'text-emerald-400' : 'text-dark-200'}>
            <CheckCircle2 className="mr-1.5 inline h-4 w-4 align-[-3px]" aria-hidden="true" />
            Both new passwords match
          </li>
        </ul>
      </form>
    </Panel>
  );
}

function SignInSecurityPanel({ status }) {
  const navigate = useNavigate();
  const items = [
    { key: 'mfa', label: 'Authenticator app (2FA)', on: status?.hasMfa, icon: ShieldCheck },
    { key: 'passkey', label: 'Passkey', on: status?.hasPasskey, icon: Fingerprint },
  ];
  const missing = status && (!status.hasMfa || !status.hasPasskey);
  return (
    <Panel
      title="Sign-in security"
      icon={ShieldAlert}
      description="Passkeys and 2FA also let you confirm sensitive changes."
      actions={
        missing ? (
          <button
            type="button"
            onClick={() => navigate('/admin/setup-security')}
            className="rounded-lg border border-primary-500/40 px-3 py-1.5 text-sm font-medium text-primary-300 hover:bg-primary-500/10"
          >
            Set up
          </button>
        ) : null
      }
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const ItemIcon = item.icon;
          return (
            <li key={item.key} className="flex items-center gap-3 rounded-lg border border-dark-600 bg-dark-900/60 px-4 py-3">
              <ItemIcon className={`h-5 w-5 ${item.on ? 'text-emerald-400' : 'text-dark-300'}`} aria-hidden="true" />
              <span className="flex-1 text-sm text-dark-50">{item.label}</span>
              <span className={`text-xs font-semibold ${item.on ? 'text-emerald-400' : 'text-amber-400'}`}>
                {status ? (item.on ? 'On' : 'Not set up') : '…'}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function SessionsPanel({ sessions, loading, error, busyId, onRevoke, onRevokeOthers }) {
  const active = sessions.filter((s) => s.active);
  const ended = sessions.filter((s) => !s.active);
  const others = active.filter((s) => !s.current).length;

  return (
    <Panel
      title="Where you're signed in"
      icon={Laptop}
      description="Every device signed in to your admin account. Sign out anything you don't recognise."
      actions={
        others > 0 ? (
          <button
            type="button"
            onClick={onRevokeOthers}
            disabled={busyId === 'others'}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            {busyId === 'others' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogOut className="h-4 w-4" aria-hidden="true" />}
            Sign out all other devices
          </button>
        ) : null
      }
    >
      {loading && <p className="flex items-center gap-2 text-sm text-dark-200"><Loader2 className="h-4 w-4 animate-spin" /> Loading devices…</p>}
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      {!loading && !error && active.length === 0 && (
        <p className="text-sm text-dark-200">
          No device sessions yet. Devices appear here after their next sign-in.
        </p>
      )}
      <ul className="divide-y divide-white/[0.06]">
        {active.map((s) => (
          <SessionRow key={s.id} session={s} busy={busyId === s.id} onRevoke={() => onRevoke(s)} />
        ))}
      </ul>
      {ended.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-dark-200 hover:text-dark-50">
            Recently signed out ({ended.length})
          </summary>
          <ul className="mt-2 divide-y divide-white/[0.06] opacity-70">
            {ended.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

function SessionRow({ session, busy, onRevoke }) {
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <DeviceIcon device={session.device} className="hidden h-8 w-8 flex-shrink-0 text-dark-200 sm:block" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-dark-50">
          {session.device}
          {session.current && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">This device</span>
          )}
          <span className="rounded-full border border-dark-500 px-2 py-0.5 text-[11px] text-dark-100">
            {session.login_method === 'passkey' ? 'Passkey' : 'Password'}
          </span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-200">
          <span className="font-mono">{session.ip_address || 'Unknown IP'}</span>
          {session.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {session.location}
            </span>
          )}
          <span>Signed in {formatWhen(session.signed_in_at)}</span>
          {session.active ? (
            <span>Last active {formatWhen(session.last_seen_at)}</span>
          ) : (
            <span>Signed out {formatWhen(session.revoked_at)}</span>
          )}
        </p>
      </div>
      {onRevoke && (
        <button
          type="button"
          onClick={onRevoke}
          disabled={busy}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-dark-500 px-3 py-1.5 text-sm text-dark-100 hover:border-red-500/50 hover:text-red-300 disabled:opacity-50 sm:self-center"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogOut className="h-4 w-4" aria-hidden="true" />}
          Sign out
        </button>
      )}
    </li>
  );
}

/**
 * Account & Security: the signed-in admin's profile, password, 2FA/passkey
 * status and every device they're signed in on (with sign-out).
 */
const AccountSecurity = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { permissions } = useAdminPermissions();
  const [status, setStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await apiClient.get('/api/v1/auth/admin/sessions');
      setSessions(data?.items || []);
      setError(null);
    } catch (err) {
      setError(`Couldn't load devices: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    apiClient.get('/api/v1/auth/admin/setup-status').then(setStatus).catch(() => {});
  }, [loadSessions]);

  const revoke = async (session) => {
    setBusyId(session.id);
    try {
      await apiClient.delete(`/api/v1/auth/admin/sessions/${session.id}`);
      if (session.current) {
        await logout();
        navigate('/login', { replace: true });
        return;
      }
      toast.success(`Signed out ${session.device}`);
      await loadSessions();
    } catch (err) {
      toast.error(`Couldn't sign out that device: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    setBusyId('others');
    try {
      const result = await apiClient.post('/api/v1/auth/admin/sessions/revoke-others');
      toast.success(result?.message || 'Signed out your other devices');
      await loadSessions();
    } catch (err) {
      toast.error(`Couldn't sign out other devices: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => Number(b.current) - Number(a.current)),
    [sessions]
  );

  return (
    <AdminPage width="default">
      <AdminPageHeader
        eyebrow="Account"
        title="Account & Security"
        icon={ShieldCheck}
        description="Your profile, password and the devices signed in to your admin account."
      />
      <ProfilePanel user={user} permissions={permissions} />
      <ChangePasswordPanel toast={toast} onChanged={loadSessions} />
      <SignInSecurityPanel status={status} />
      <SessionsPanel
        sessions={sortedSessions}
        loading={loading}
        error={error}
        busyId={busyId}
        onRevoke={revoke}
        onRevokeOthers={revokeOthers}
      />
    </AdminPage>
  );
};

export default AccountSecurity;
