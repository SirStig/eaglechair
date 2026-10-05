// Action builders for <BulkActionBar actions={...}>

/** Common pair for any list with an is_active flag */
export const ACTIVE_ACTIONS = [
  { label: 'Activate', changes: { is_active: true } },
  { label: 'Deactivate', changes: { is_active: false }, tone: 'danger' },
];

/** Yes/No pick list for a boolean field */
export const booleanAction = (label, field, yes = 'Yes', no = 'No') => ({
  label,
  options: [
    { value: 'true', label: yes },
    { value: 'false', label: no },
  ],
  toChanges: (v) => ({ [field]: v === 'true' }),
});

/** Pick list from rows with id/name; `none` adds a clear option sent as null */
export const idAction = (label, field, rows, { none, getLabel = (r) => r.name } = {}) => ({
  label,
  options: [
    ...(none ? [{ value: 'none', label: none }] : []),
    ...(rows || []).map((r) => ({ value: String(r.id), label: getLabel(r) })),
  ],
  toChanges: (v) => ({ [field]: v === 'none' ? null : Number(v) }),
});
