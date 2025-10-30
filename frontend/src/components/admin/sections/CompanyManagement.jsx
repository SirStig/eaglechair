import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';

const CompanyManagement = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchCompanies();
  }, [page]);

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

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-2xl font-bold text-dark-50">Company Management</h2>
      
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="px-4 py-3 text-left text-sm font-medium text-dark-300">Company</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-dark-300">Contact</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-dark-300">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-dark-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                    <td className="px-4 py-4">
                      <p className="font-medium text-dark-50">{company.company_name}</p>
                      <p className="text-sm text-dark-400">{company.industry}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-dark-200">{company.rep_first_name} {company.rep_last_name}</p>
                      <p className="text-sm text-dark-400">{company.rep_email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`
                        px-2 py-1 rounded text-xs font-medium
                        ${company.status === 'active' ? 'bg-green-900/30 text-green-500' : ''}
                        ${company.status === 'pending' ? 'bg-yellow-900/30 text-yellow-500' : ''}
                        ${company.status === 'suspended' ? 'bg-red-900/30 text-red-500' : ''}
                      `}>
                        {company.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button size="sm" variant="outline">View</Button>
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
    </div>
  );
};

export default CompanyManagement;
