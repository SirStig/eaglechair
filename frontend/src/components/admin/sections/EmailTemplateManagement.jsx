import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import apiClient from '../../../config/apiClient';
import {
  Mail,
  Edit2,
  Trash2,
  Eye,
  Plus,
  CheckCircle,
  XCircle,
  Send,
  FileText,
} from 'lucide-react';
import Modal from '../../ui/Modal';

const EmailTemplateManagement = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    template_type: '',
    name: '',
    description: '',
    subject: '',
    body: '',
    is_active: true,
    available_variables: {}
  });
  const [testEmail, setTestEmail] = useState('');
  const [testContext, setTestContext] = useState('{}');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/v1/admin/emails', {
        params: { include_inactive: true }
      });
      setTemplates(response.templates || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load email templates');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setFormData({
      template_type: template.template_type,
      name: template.name,
      description: template.description || '',
      subject: template.subject,
      body: template.body,
      is_active: template.is_active,
      available_variables: template.available_variables || {}
    });
    setIsEditModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setFormData({
      template_type: '',
      name: '',
      description: '',
      subject: '',
      body: '',
      is_active: true,
      available_variables: {}
    });
    setIsCreateModalOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const payload = {
        ...formData,
        available_variables: typeof formData.available_variables === 'object' 
          ? formData.available_variables 
          : {}
      };

      if (selectedTemplate) {
        // Update existing
        await apiClient.patch(`/api/v1/admin/emails/${selectedTemplate.id}`, payload);
      } else {
        // Create new
        await apiClient.post('/api/v1/admin/emails', payload);
      }

      setIsEditModalOpen(false);
      setIsCreateModalOpen(false);
      await loadTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('Are you sure you want to deactivate this template? It will no longer be available for use.')) {
      return;
    }

    try {
      await apiClient.delete(`/api/v1/admin/emails/${templateId}`);
      await loadTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
      setError(err.response?.data?.detail || 'Failed to deactivate template');
    }
  };

  const handleTest = (template) => {
    setSelectedTemplate(template);
    setTestEmail('');
    setTestContext('{}');
    setIsTestModalOpen(true);
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      setError('Please enter a test email address');
      return;
    }

    try {
      setTesting(true);
      setError(null);

      let contextObj = {};
      try {
        contextObj = JSON.parse(testContext || '{}');
      } catch (e) {
        setError('Invalid JSON in context field');
        return;
      }

      await apiClient.post('/api/v1/admin/emails/test', {
        to_email: testEmail,
        template_type: selectedTemplate.template_type,
        context: contextObj
      });

      alert(`Test email sent successfully to ${testEmail}`);
      setIsTestModalOpen(false);
    } catch (err) {
      console.error('Error sending test email:', err);
      setError(err.response?.data?.detail || 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = (isActive) => {
    if (isActive) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-500 flex items-center gap-1.5 w-fit">
          <CheckCircle className="w-3.5 h-3.5" />
          Active
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-dark-600 text-dark-400 flex items-center gap-1.5 w-fit">
        <XCircle className="w-3.5 h-3.5" />
        Inactive
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-dark-600 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-50 flex items-center gap-3">
            <Mail className="w-7 h-7 text-primary-500" />
            Email Template Management
          </h2>
          <p className="text-dark-200 mt-1">Manage email templates for system notifications</p>
        </div>
        <Button onClick={handleCreate} variant="primary" className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Template
        </Button>
      </div>

      {error && (
        <div className="bg-red-900/30 border-2 border-red-600 text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="bg-dark-800 border-dark-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-dark-50">{template.name}</h3>
                  {getStatusBadge(template.is_active)}
                </div>
                <p className="text-sm text-dark-300 mb-2">
                  <span className="font-medium">Type:</span> {template.template_type}
                </p>
                {template.description && (
                  <p className="text-sm text-dark-200 mb-3">{template.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-dark-400">
                  <span className="flex items-center gap-1">
                    <Send className="w-4 h-4" />
                    Sent {template.times_sent || 0} times
                  </span>
                  {template.last_sent_at && (
                    <span>
                      Last sent: {new Date(template.last_sent_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleTest(template)}
                  className="flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  Test
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleEdit(template)}
                  className="flex items-center gap-1.5"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDelete(template.id)}
                  className="flex items-center gap-1.5 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit/Create Modal */}
      <Modal
        isOpen={isEditModalOpen || isCreateModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setIsCreateModalOpen(false);
          setError(null);
        }}
        title={selectedTemplate ? 'Edit Email Template' : 'Create Email Template'}
        size="xl"
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border-2 border-red-600 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Input
            label="Template Type"
            value={formData.template_type}
            onChange={(e) => setFormData({ ...formData, template_type: e.target.value })}
            placeholder="email_verification"
            disabled={!!selectedTemplate}
            required
          />

          <Input
            label="Template Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Email Verification"
            required
          />

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Description
            </label>
            <textarea
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows="2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Template description"
            />
          </div>

          <Input
            label="Subject"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="Email Subject Line"
            required
          />

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Body (HTML) *
            </label>
            <textarea
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              rows="12"
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              placeholder="<h1>Email Content</h1>&#10;<p>Use {{ variable_name }} for variables</p>&#10;{{ button(url, text) }}"
              required
            />
            <p className="text-xs text-dark-400 mt-1">
              Use Jinja2 syntax. Helper functions: button(url, text), code(value), image(url, alt)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-dark-600 text-primary-600"
            />
            <label htmlFor="is_active" className="text-sm text-dark-200">
              Template is active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setIsCreateModalOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : selectedTemplate ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Test Email Modal */}
      <Modal
        isOpen={isTestModalOpen}
        onClose={() => {
          setIsTestModalOpen(false);
          setError(null);
        }}
        title={`Test Email: ${selectedTemplate?.name}`}
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border-2 border-red-600 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Input
            label="Test Email Address"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            required
          />

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Template Context (JSON)
            </label>
            <textarea
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              rows="6"
              value={testContext}
              onChange={(e) => setTestContext(e.target.value)}
              placeholder='{"company_name": "Test Company", "verification_url": "https://..."}'
            />
            <p className="text-xs text-dark-400 mt-1">
              JSON object with variables to use in the template
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
            <Button
              variant="secondary"
              onClick={() => {
                setIsTestModalOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={sendTestEmail}
              disabled={testing || !testEmail}
            >
              {testing ? 'Sending...' : 'Send Test Email'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EmailTemplateManagement;

