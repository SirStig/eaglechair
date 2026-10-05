import { useState, useEffect, useCallback } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Modal from '../../ui/Modal';
import apiClient from '../../../config/apiClient';
import AdminCompanyDetailView from './AdminCompanyDetailView';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';
import { useToast } from '../../../contexts/ToastContext';
import TableSortHead from '../TableSortHead';
import PaginationBar from '../PaginationBar';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import useBulkSelection from '../../../hooks/useBulkSelection';
import BulkActionBar from '../bulk/BulkActionBar';
import { SelectAllCheckbox, RowCheckbox } from '../bulk/SelectCheckbox';

const CompanyManagement = () => {
  const { refreshKeys } = useAdminRefresh();
  const toast = useToast();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFormData, setInviteFormData] = useState({ company_name: '', email: '' });
  const [inviteErrors, setInviteErrors] = useState({});
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [sortBy, setSortBy] = useState('company_name');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    if (!selectedCompanyId) {
      fetchCompanies();
    }
  }, [page, pageSize, selectedCompanyId, sortBy, sortDir, refreshKeys.companies]);

  const handleSort = useCallback((key) => {
    setSortBy(key);
    setSortDir((d) => (key === sortBy ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
    setPage(1);
  }, [sortBy]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/v1/admin/companies', {
        params: {
          page,
          page_size: pageSize,
          sort_by: sortBy || undefined,
          sort_dir: sortDir,
        }
      });
      setCompanies(response.items || []);
      setTotalPages(response.pages || 1);
      setTotal(response.total ?? 0);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const selection = useBulkSelection(companies);

  // Status changes go through the per-company endpoint (it handles side effects)
  const setStatus = (status) => async (ids) => {
    let failCount = 0;
    for (const id of ids) {
      try {
        await apiClient.patch(`/api/v1/admin/companies/${id}/status`, { status });
      } catch {
        failCount++;
      }
    }
    if (failCount === ids.length) throw new Error('Failed to update company status');
    if (failCount > 0) toast.error(`Failed to update ${failCount}`);
  };

  const bulkActions = [
    { label: 'Activate', run: setStatus('active') },
    { label: 'Suspend', run: setStatus('suspended'), tone: 'danger' },
    { label: 'Set inactive', run: setStatus('inactive'), tone: 'danger' },
  ];

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
    <AdminPage>
      <AdminPageHeader
        eyebrow="Sales"
        title="Companies"
        description="Manage customer accounts and send invitations"
        actions={
          <Button onClick={handleOpenInviteModal}>
            Invite Company
          </Button>
        }
      />
      
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-12 text-dark-400">
            <p className="text-lg">No companies found</p>
          </div>
        ) : (
          <>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(v) => { setPageSize(v); setPage(1); }}
              position="top"
            />
            <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="px-3 sm:px-4 py-3 text-left">
                    <SelectAllCheckbox selection={selection} label="Select all companies" />
                  </th>
                  <TableSortHead label="Company" sortKey="company_name" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-dark-300" />
                  <TableSortHead label="Contact" sortKey="contact" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-dark-300" />
                  <TableSortHead label="Status" sortKey="status" activeSortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-dark-300" />
                  <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-medium text-dark-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr
                    key={company.id}
                    className={`border-b border-dark-700 hover:bg-dark-700/50 cursor-pointer select-none ${selection.isSelected(company.id) ? 'bg-primary-900/10' : ''}`}
                    onClick={(e) => {
                      if (!e.target.closest('button') && !e.target.closest('[data-no-select]')) {
                        selection.toggle(company.id, e);
                      }
                    }}
                  >
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <RowCheckbox selection={selection} id={company.id} label={`Select ${company.company_name}`} />
                    </td>
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
                    <td className="px-3 sm:px-4 py-3 sm:py-4 text-right" data-no-select onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => handleViewCompany(company.id)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(v) => { setPageSize(v); setPage(1); }}
              position="bottom"
            />
          </>
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

      <BulkActionBar
        selection={selection}
        noun="account"
        actions={bulkActions}
        onDone={fetchCompanies}
      />
    </AdminPage>
  );
};

export default CompanyManagement;
