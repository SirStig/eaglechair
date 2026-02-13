import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Modal from '../../ui/Modal';
import apiClient from '../../../config/apiClient';
import AdminCompanyDetailView from './AdminCompanyDetailView';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';

const CompanyManagement = () => {
  const { refreshKeys } = useAdminRefresh();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFormData, setInviteFormData] = useState({ company_name: '', email: '' });
  const [inviteErrors, setInviteErrors] = useState({});
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  useEffect(() => {
    if (!selectedCompanyId) {
      fetchCompanies();
    }
  }, [page, selectedCompanyId, refreshKeys.companies]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/v1/admin/companies', {
        params: { page, page_size: 20 }
      });
      setCompanies(response.items || []);
      setTotalPages(response.pages || 1);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCompany = (companyId) => {
    setSelectedCompanyId(companyId);
  };

  const handleBackToList = () => {
    setSelectedCompanyId(null);
  };

  const handleCompanyUpdated = () => {
    // Optionally refresh the list when a company is updated
    if (!selectedCompanyId) {
      fetchCompanies();
    }
  };

  const handleOpenInviteModal = () => {
    setIsInviteModalOpen(true);
    setInviteFormData({ company_name: '', email: '' });
    setInviteErrors({});
    setInviteSuccess(false);
  };

  const handleCloseInviteModal = () => {
    setIsInviteModalOpen(false);
    setInviteFormData({ company_name: '', email: '' });
    setInviteErrors({});
    setInviteSuccess(false);
  };

  const validateInviteForm = () => {
    const errors = {};
    
    if (!inviteFormData.company_name.trim()) {
      errors.company_name = 'Company name is required';
    }
    
    if (!inviteFormData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteFormData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    setInviteErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateInviteForm()) {
      return;
    }
    
    setInviteLoading(true);
    setInviteErrors({});
    setInviteSuccess(false);
    
    try {
      await apiClient.post('/api/v1/admin/companies/invite', {
        company_name: inviteFormData.company_name.trim(),
        email: inviteFormData.email.trim()
      });
      
      setInviteSuccess(true);
      // Close modal after 2 seconds
      setTimeout(() => {
        handleCloseInviteModal();
        fetchCompanies(); // Refresh company list
      }, 2000);
    } catch (error) {
      console.error('Failed to send invitation:', error);
      
      if (error.response?.status === 409) {
        setInviteErrors({ 
          email: 'A company with this email already exists' 
        });
      } else if (error.response?.status === 400) {
        const detail = error.response?.data?.detail || '';
        if (detail.toLowerCase().includes('email')) {
          setInviteErrors({ email: detail });
        } else {
          setInviteErrors({ _general: detail || 'Invalid information provided' });
        }
      } else {
        setInviteErrors({ 
          _general: error.response?.data?.detail || error.response?.data?.message || 'Failed to send invitation. Please try again.' 
        });
      }
    } finally {
      setInviteLoading(false);
    }
  };

  // Show detail view if a company is selected
  if (selectedCompanyId) {
    return (
      <AdminCompanyDetailView
        companyId={selectedCompanyId}
        onBack={handleBackToList}
        onUpdated={handleCompanyUpdated}
      />
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-dark-50">Company Management</h2>
        <Button onClick={handleOpenInviteModal}>
          Invite Company
        </Button>
      </div>
      
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-dark-300">Company</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-dark-300">Contact</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-dark-300">Status</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-medium text-dark-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <p className="font-medium text-xs sm:text-sm md:text-base text-dark-50">{company.company_name}</p>
                      <p className="text-xs sm:text-sm text-dark-400">{company.industry}</p>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <p className="text-xs sm:text-sm text-dark-200">{company.rep_first_name} {company.rep_last_name}</p>
                      <p className="text-xs sm:text-sm text-dark-400 truncate">{company.rep_email}</p>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <span className={`
                        px-2 py-1 rounded text-xs font-medium
                        ${company.status === 'active' ? 'bg-green-900/30 text-green-500' : ''}
                        ${company.status === 'pending' ? 'bg-yellow-900/30 text-yellow-500' : ''}
                        ${company.status === 'suspended' ? 'bg-red-900/30 text-red-500' : ''}
                        ${company.status === 'inactive' ? 'bg-dark-600 text-dark-400' : ''}
                      `}>
                        {company.status}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 text-right">
                      <Button size="sm" variant="outline" onClick={() => handleViewCompany(company.id)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-dark-700">
            <p className="text-sm text-dark-300">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isInviteModalOpen}
        onClose={handleCloseInviteModal}
        title="Invite Company"
        size="md"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          {inviteSuccess ? (
            <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4">
              <p className="text-green-500 font-medium">
                Invitation email sent successfully!
              </p>
            </div>
          ) : (
            <>
              {inviteErrors._general && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                  <p className="text-red-500 text-sm">{inviteErrors._general}</p>
                </div>
              )}

              <Input
                label="Company Name *"
                placeholder="Enter company name"
                value={inviteFormData.company_name}
                onChange={(e) => setInviteFormData({ ...inviteFormData, company_name: e.target.value })}
                error={inviteErrors.company_name}
                disabled={inviteLoading}
              />

              <Input
                label="Email Address *"
                type="email"
                placeholder="company@example.com"
                value={inviteFormData.email}
                onChange={(e) => setInviteFormData({ ...inviteFormData, email: e.target.value })}
                error={inviteErrors.email}
                disabled={inviteLoading}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseInviteModal}
                  disabled={inviteLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={inviteLoading}
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
};

export default CompanyManagement;
