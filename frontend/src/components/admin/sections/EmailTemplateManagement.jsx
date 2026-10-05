import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Pencil, Plus, Send, Power, Code2, Eye } from 'lucide-react';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Modal from '../../ui/Modal';
import ConfirmModal from '../../ui/ConfirmModal';
import apiClient from '../../../config/apiClient';
import { useToast } from '../../../contexts/ToastContext';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import useBulkSelection from '../../../hooks/useBulkSelection';
import BulkActionBar from '../bulk/BulkActionBar';
import { ACTIVE_ACTIONS } from '../bulk/bulkActions';
import { SelectAllCheckbox, RowCheckbox } from '../bulk/SelectCheckbox';

const EMPTY_FORM = {
  template_type: '',
  name: '',
  description: '',
  subject: '',
  body: '',
  is_active: true,
  available_variables: {},
};

const TEXTAREA_CLASS = 'w-full rounded-lg border border-dark-400 bg-dark-700 px-4 py-2.5 text-dark-50 placeholder-dark-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500';

// apiClient rejects with { message, status, data }; FastAPI puts details in data.detail
const errorMessage = (err, fallback) => {
  const detail = err?.data?.detail;
  if (typeof detail === 'string') return detail;
  return err?.message || fallback;
};

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null);

/**
 * Email Template Management
 *
 * Jinja2 templates for system emails. Deleting is a soft delete: the API
 * deactivates the template so the built-in default is used instead.
 */
const EmailTemplateManagement = () => {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [bodyView, setBodyView] = useState('code');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState(null);
  const [testTemplate, setTestTemplate] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [testContext, setTestContext] = useState('{}');
  const [testError, setTestError] = useState(null);
  const [testing, setTesting] = useState(false);
  const bodyRef = useRef(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoadError(null);
      const response = await apiClient.get('/api/v1/admin/emails', {
        params: { include_inactive: true },
      });
      setTemplates(response.templates || []);
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to load email templates'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => (b.is_active - a.is_active) || a.name.localeCompare(b.name)),
    [templates]
  );
  const selection = useBulkSelection(sortedTemplates);

  const setField = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const openEditor = (template) => {
    setSelectedTemplate(template);
    setFormData(template ? {
      template_type: template.template_type,
      name: template.name,
      description: template.description || '',
      subject: template.subject,
      body: template.body,
      is_active: template.is_active,
      available_variables: template.available_variables || {},
    } : EMPTY_FORM);
    setFormError(null);
    setBodyView('code');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  // Insert {{ variable }} at the cursor in the body editor
  const insertVariable = (name) => {
    const token = `{{ ${name} }}`;
    const el = bodyRef.current;
    if (!el || bodyView !== 'code') {
      setField('body', `${formData.body}${token}`);
      return;
    }
    const { selectionStart = formData.body.length, selectionEnd = formData.body.length } = el;
    const next = formData.body.slice(0, selectionStart) + token + formData.body.slice(selectionEnd);
    setField('body', next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + token.length, selectionStart + token.length);
    });
  };

  const handleSave = async () => {
    const missing = ['template_type', 'name', 'subject', 'body'].filter((k) => !String(formData[k] || '').trim());
    if (missing.length) {
      setFormError('Type, name, subject and body are required.');
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const payload = {
        ...formData,
        available_variables: typeof formData.available_variables === 'object' ? formData.available_variables : {},
      };
      if (selectedTemplate) {
        await apiClient.patch(`/api/v1/admin/emails/${selectedTemplate.id}`, payload);
      } else {
        await apiClient.post('/api/v1/admin/emails', payload);
      }
      toast.success(selectedTemplate ? 'Template saved' : 'Template created');
      setEditorOpen(false);
      await loadTemplates();
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to save template'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeactivate = async () => {
    const template = pendingDeactivate;
    if (!template) return;
    try {
      await apiClient.delete(`/api/v1/admin/emails/${template.id}`);
      toast.success(`"${template.name}" deactivated`);
      await loadTemplates();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to deactivate template'));
    }
  };

  const reactivate = async (template) => {
    try {
      await apiClient.patch(`/api/v1/admin/emails/${template.id}`, { is_active: true });
      toast.success(`"${template.name}" reactivated`);
      await loadTemplates();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to reactivate template'));
    }
  };

  const openTest = (template) => {
    // Prefill sample values for each documented variable
    const sample = Object.fromEntries(
      Object.keys(template.available_variables || {}).map((name) => [name, `Sample ${name.replace(/_/g, ' ')}`])
    );
    setTestTemplate(template);
    setTestEmail('');
    setTestContext(JSON.stringify(sample, null, 2));
    setTestError(null);
  };

  const sendTestEmail = async () => {
    let context;
    try {
      context = JSON.parse(testContext || '{}');
    } catch {
      setTestError('Sample values must be valid JSON.');
      return;
    }
    try {
      setTesting(true);
      setTestError(null);
      await apiClient.post('/api/v1/admin/emails/test', {
        to_email: testEmail,
        template_type: testTemplate.template_type,
        context,
      });
      toast.success(`Test email sent to ${testEmail}`);
      setTestTemplate(null);
    } catch (err) {
      setTestError(errorMessage(err, 'Failed to send test email'));
    } finally {
      setTesting(false);
    }
  };

  const variables = Object.entries(formData.available_variables || {});

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="System"
        title="Email Templates"
        description="Subjects and content of the emails the system sends."
        actions={
          <Button onClick={() => openEditor(null)} variant="primary" size="sm" className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New template
          </Button>
        }
      />

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <span>{loadError}</span>
          <Button variant="ghost" size="xs" onClick={() => { setLoading(true); loadTemplates(); }}>Retry</Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-dark-800" />)}
        </div>
      ) : !loadError && sortedTemplates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dark-500 px-6 py-12 text-center">
          <p className="font-medium text-dark-50">No custom templates</p>
          <p className="mt-1 text-sm text-dark-200">The built-in defaults are used until you create one.</p>
        </div>
      ) : (
        <ul className="divide-y divide-dark-700 overflow-hidden rounded-xl border border-dark-600 bg-dark-800">
          <li className="flex items-center gap-3 px-4 py-2 text-xs text-dark-200 sm:px-5">
            <SelectAllCheckbox selection={selection} label="Select all templates" />
            <span>Select all</span>
          </li>
          {sortedTemplates.map((template) => (
            <li key={template.id} className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5 ${template.is_active ? '' : 'opacity-70'} ${selection.isSelected(template.id) ? 'bg-primary-900/15' : ''}`}>
              <RowCheckbox selection={selection} id={template.id} label={`Select ${template.name}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-dark-50">{template.name}</h3>
                  <code className="rounded bg-dark-700 px-1.5 py-0.5 text-[11px] text-dark-100">{template.template_type}</code>
                  {!template.is_active && (
                    <span className="rounded-full bg-dark-600 px-2 py-0.5 text-[11px] font-medium text-dark-100">Inactive</span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-dark-100">
                  <span className="text-dark-200">Subject:</span> {template.subject}
                </p>
                <p className="mt-1 text-xs text-dark-200">
                  Sent {template.times_sent || 0} {template.times_sent === 1 ? 'time' : 'times'}
                  {template.last_sent_at && ` · last ${formatDate(template.last_sent_at)}`}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <Button variant="ghost" size="xs" onClick={() => openTest(template)} disabled={!template.is_active} className="gap-1.5">
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Test
                </Button>
                <Button variant="ghost" size="xs" onClick={() => openEditor(template)} className="gap-1.5">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </Button>
                {template.is_active ? (
                  <Button variant="ghost" size="xs" onClick={() => setPendingDeactivate(template)} className="gap-1.5 hover:!text-red-300">
                    <Power className="h-4 w-4" aria-hidden="true" />
                    Deactivate
                  </Button>
                ) : (
                  <Button variant="ghost" size="xs" onClick={() => reactivate(template)} className="gap-1.5">
                    <Power className="h-4 w-4" aria-hidden="true" />
                    Reactivate
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Edit / create */}
      <Modal
        isOpen={editorOpen}
        onClose={closeEditor}
        title={selectedTemplate ? `Edit: ${selectedTemplate.name}` : 'New email template'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Template type"
              value={formData.template_type}
              onChange={(e) => setField('template_type', e.target.value)}
              placeholder="email_verification"
              disabled={!!selectedTemplate}
              helperText={selectedTemplate ? 'The system looks templates up by type, so it cannot be changed.' : 'Must match the type the system sends, e.g. quote_created.'}
              required
            />
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Email verification"
              required
            />
          </div>

          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="When this email is sent"
          />

          <Input
            label="Subject"
            value={formData.subject}
            onChange={(e) => setField('subject', e.target.value)}
            placeholder="Your quote {{ quote_number }} is ready"
            required
          />

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label htmlFor="email-template-body" className="text-sm font-medium text-dark-100">Body (HTML)</label>
              <div className="inline-flex rounded-lg border border-dark-500 p-0.5" role="tablist" aria-label="Body view">
                {[
                  { value: 'code', label: 'HTML', icon: <Code2 className="h-3.5 w-3.5" aria-hidden="true" /> },
                  { value: 'preview', label: 'Preview', icon: <Eye className="h-3.5 w-3.5" aria-hidden="true" /> },
                ].map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={bodyView === value}
                    onClick={() => setBodyView(value)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${bodyView === value ? 'bg-dark-500 text-dark-50' : 'text-dark-200 hover:text-dark-50'}`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {bodyView === 'code' ? (
              <textarea
                id="email-template-body"
                ref={bodyRef}
                className={`${TEXTAREA_CLASS} min-h-[18rem] resize-y font-mono text-sm leading-relaxed`}
                value={formData.body}
                onChange={(e) => setField('body', e.target.value)}
                placeholder={'<h1>Hello {{ company_name }}</h1>\n<p>…</p>\n{{ button(url, "View quote") }}'}
                spellCheck={false}
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-dark-400 bg-white">
                <iframe
                  title="Email preview"
                  sandbox=""
                  srcDoc={formData.body}
                  className="h-[18rem] w-full"
                />
                <p className="border-t border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] text-gray-600">
                  Variables are shown unfilled. Send a test to see the final email.
                </p>
              </div>
            )}

            <p className="mt-1.5 text-xs text-dark-200">
              Jinja2 syntax. Helpers: <code>button(url, text)</code>, <code>code(value)</code>, <code>image(url, alt)</code>.
            </p>
          </div>

          {variables.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-dark-100">Available variables <span className="font-normal text-dark-200">· click to insert</span></p>
              <div className="flex flex-wrap gap-1.5">
                {variables.map(([name, description]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => insertVariable(name)}
                    title={typeof description === 'string' ? description : undefined}
                    className="rounded-md border border-dark-500 bg-dark-700 px-2 py-1 font-mono text-xs text-primary-300 transition-colors hover:border-primary-500 hover:bg-dark-600"
                  >
                    {`{{ ${name} }}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setField('is_active', e.target.checked)}
              className="h-4 w-4 accent-primary-500"
            />
            <span className="text-sm text-dark-100">Active <span className="text-dark-200">(inactive templates fall back to the built-in default)</span></span>
          </label>

          {formError && (
            <div role="alert" className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-dark-500 pt-4">
            <Button variant="ghost" size="sm" onClick={closeEditor} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : selectedTemplate ? 'Save changes' : 'Create template'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Test send */}
      <Modal
        isOpen={!!testTemplate}
        onClose={() => !testing && setTestTemplate(null)}
        title={`Send test: ${testTemplate?.name || ''}`}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); sendTestEmail(); }}
        >
          <Input
            label="Send to"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
          <div>
            <label htmlFor="email-test-context" className="mb-1.5 block text-sm font-medium text-dark-100">Sample values (JSON)</label>
            <textarea
              id="email-test-context"
              className={`${TEXTAREA_CLASS} resize-y font-mono text-sm`}
              rows={8}
              value={testContext}
              onChange={(e) => setTestContext(e.target.value)}
              spellCheck={false}
            />
          </div>
          {testError && (
            <div role="alert" className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {testError}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-dark-500 pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => setTestTemplate(null)} disabled={testing}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={testing || !testEmail}>
              {testing ? 'Sending…' : 'Send test email'}
            </Button>
          </div>
        </form>
      </Modal>

      <BulkActionBar
        selection={selection}
        resource="email-templates"
        noun="template"
        actions={ACTIVE_ACTIONS}
        onDone={loadTemplates}
      />

      <ConfirmModal
        isOpen={!!pendingDeactivate}
        onClose={() => setPendingDeactivate(null)}
        onConfirm={confirmDeactivate}
        title="Deactivate template?"
        message={pendingDeactivate ? `"${pendingDeactivate.name}" will stop being used and the built-in default will be sent instead. You can reactivate it later.` : ''}
        confirmText="Deactivate"
        variant="warning"
      />
    </AdminPage>
  );
};

export default EmailTemplateManagement;
