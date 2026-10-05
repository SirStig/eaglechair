import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, MinusCircle, RotateCcw } from 'lucide-react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { formatValue, humanizeField, plural, recordName, STEP_VERBS } from './format';

const BASE = '/api/v1/admin/time-machine';

const STATUS = {
  ok: { icon: CheckCircle2, tone: 'text-emerald-400' },
  conflict: { icon: AlertTriangle, tone: 'text-amber-400' },
  blocked: { icon: Ban, tone: 'text-red-400' },
  noop: { icon: MinusCircle, tone: 'text-dark-300' },
};

function Step({ step }) {
  const { icon: Icon, tone } = STATUS[step.status] || STATUS.ok;
  return (
    <li className="flex gap-3 py-2.5">
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${tone}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        <p className={step.status === 'noop' ? 'text-dark-300' : 'text-dark-50'}>
          {STEP_VERBS[step.kind]} {recordName(step.entry)}
        </p>
        {step.message && (
          <p className={`mt-0.5 text-xs ${step.status === 'blocked' ? 'text-red-300' : 'text-dark-200'}`}>{step.message}</p>
        )}
        {step.conflicts?.length > 0 && (
          <ul className="mt-1.5 space-y-1 text-xs">
            {step.conflicts.map((c) => (
              <li key={c.field} className="rounded bg-amber-500/10 px-2 py-1 text-amber-100">
                <span className="font-medium">{humanizeField(c.field)}</span> is now{' '}
                <span className="break-words">“{formatValue(c.current).slice(0, 140)}”</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * Preview, then restore. `target` is { changeSetId } (undo one change) or
 * { entryId, label } (rewind one record to just before that change).
 */
export default function RestoreDialog({ target, onClose, onRestored }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);

  const params = useMemo(() => {
    if (target?.changeSetId) return { change_set_id: target.changeSetId };
    if (target?.entryId) return { entry_id: target.entryId };
    return null;
  }, [target]);

  useEffect(() => {
    if (!params) return undefined;
    let live = true;
    setPlan(null);
    setError(null);
    setOverwrite(false);
    apiClient
      .get(`${BASE}/preview`, { params })
      .then((data) => live && setPlan(data))
      .catch((err) => live && setError(err?.data?.message || err.message || 'Could not check this change'));
    return () => {
      live = false;
    };
  }, [params]);

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiClient.post(`${BASE}/restore`, { ...params, force: overwrite });
      onRestored(result);
    } catch (err) {
      setError(err?.data?.message || err.message || 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  const counts = plan?.counts || {};
  const summary = [
    counts.restore && `bring back ${plural(counts.restore, 'record')}`,
    counts.revert && `put back old values in ${plural(counts.revert, 'record')}`,
    counts.remove && `remove ${plural(counts.remove, 'added record')}`,
  ].filter(Boolean);
  // Rows restored along with a parent (variations, links...) fold into one line
  const steps = plan?.steps || [];
  const visibleSteps = steps.filter((s) => !s.entry.parent_id || s.status !== 'ok');
  const hiddenLinked = steps.length - visibleSteps.length;
  const canRestore = plan?.can_apply && (!plan.needs_force || overwrite) && !busy;

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={busy ? () => {} : onClose}
      size="md"
      title={target?.entryId ? `Rewind ${target.label || 'this record'}?` : 'Undo this change?'}
    >
      <div className="space-y-4 p-5 sm:p-6">
        {!plan && !error && (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-8 animate-pulse rounded bg-dark-700" />)}
          </div>
        )}

        {plan && (
          <>
            <p className="text-sm text-dark-100">
              {summary.length
                ? <>This will {summary.join(', ')}.</>
                : <>Nothing left to undo: everything is already back the way it was.</>}
              {target?.entryId && summary.length > 0 && <> Later changes to this record are undone too.</>}
              {summary.length > 0 && <> The restore is saved in the Time Machine, so you can undo it as well.</>}
            </p>

            {steps.length > 0 && (
              <ul className="max-h-80 divide-y divide-dark-700 overflow-auto rounded-lg border border-dark-600 bg-dark-900/40 px-3">
                {visibleSteps.map((step) => <Step key={step.entry_id} step={step} />)}
                {hiddenLinked > 0 && (
                  <li className="py-2.5 text-xs text-dark-200">
                    + {plural(hiddenLinked, 'linked row')} (variations, images, category links…) restored with them
                  </li>
                )}
              </ul>
            )}

            {counts.blocked > 0 && (
              <p role="alert" className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                Some of this can&apos;t be undone right now (see above). Restore what it depends on first, then try again.
              </p>
            )}

            {plan.needs_force && counts.blocked === 0 && (
              <label className="flex items-start gap-2.5 rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2.5 text-sm text-amber-100">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-amber-500"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                <span>
                  {counts.conflict === 1 ? 'This was' : 'Some of these were'} changed again since. Overwrite the newer values anyway.
                </span>
              </label>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={restore} disabled={!canRestore}>
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {busy ? 'Restoring…' : target?.entryId ? 'Rewind' : 'Undo change'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
