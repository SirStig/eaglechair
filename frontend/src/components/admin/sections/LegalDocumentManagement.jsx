import { useState, useEffect } from 'react';
import { FileText, Plus, Edit2, Trash2, Search, Filter, Eye, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EditModal from '../EditModal';
import apiClient from '../../../config/apiClient';

/**
 * Legal Document Management Section
 * 
 * Full CRUD interface for managing legal documents with:
 * - Filtering by document type
 * - Search functionality
 * - Table view with all document details
 * - Create/Edit/Delete operations
 * - Active status toggling
 */
const LegalDocumentManagement = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Document type options (matches backend enum)
  const documentTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'price_list', label: 'Price List' },
    { value: 'dimensions_sizes', label: 'Dimensions & Sizes' },
    { value: 'orders', label: 'Orders' },
    { value: 'com_col_orders', label: 'COM/COL Orders' },
    { value: 'minimum_order', label: 'Minimum Order' },
    { value: 'payments', label: 'Payments' },
    { value: 'terms', label: 'Terms' },
    { value: 'taxes', label: 'Taxes' },
    { value: 'legal_costs', label: 'Legal Costs' },
    { value: 'quotations', label: 'Quotations' },
    { value: 'warranty', label: 'Warranty' },
    { value: 'flammability', label: 'Flammability' },
    { value: 'custom_finishes', label: 'Custom Finishes' },
    { value: 'partial_shipments', label: 'Partial Shipments' },
    { value: 'storage', label: 'Storage' },
    { value: 'returns', label: 'Returns' },
    { value: 'cancellations', label: 'Cancellations' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'special_service', label: 'Special Service' },
    { value: 'shipments_damage', label: 'Shipments & Damage' },
    { value: 'freight_classification', label: 'Freight Classification' },
    { value: 'ip_disclaimer', label: 'IP Disclaimer' },
    { value: 'ip_assignment', label: 'IP Assignment' },
    { value: 'conditions_of_sale', label: 'Conditions of Sale' },
    { value: 'privacy_policy', label: 'Privacy Policy' },
    { value: 'other', label: 'Other' }
  ];

  // Fetch legal documents
  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/cms-admin/legal-documents');
      setDocuments(response || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch legal documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Filter and search documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = searchTerm === '' || 
      doc.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.slug?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || doc.documentType === filterType || doc.document_type === filterType;
    
    return matchesSearch && matchesType;
  });

  // Create new document
  const handleCreate = () => {
    setSelectedDoc({
      title: '',
      documentType: 'other',
      content: '',
      shortDescription: '',
      slug: '',
      version: '1.0',
      effectiveDate: '',
      metaTitle: '',
      metaDescription: '',
      displayOrder: 0,
      isActive: true
    });
    setShowEditModal(true);
  };

  // Edit existing document
  const handleEdit = (doc) => {
    setSelectedDoc({
      id: doc.id,
      title: doc.title,
      documentType: doc.documentType || doc.document_type,
      content: doc.content,
      shortDescription: doc.shortDescription || doc.short_description || '',
      slug: doc.slug,
      version: doc.version || '1.0',
      effectiveDate: doc.effectiveDate || doc.effective_date || '',
      metaTitle: doc.metaTitle || doc.meta_title || '',
      metaDescription: doc.metaDescription || doc.meta_description || '',
      displayOrder: doc.displayOrder || doc.display_order || 0,
      isActive: doc.isActive !== undefined ? doc.isActive : doc.is_active !== undefined ? doc.is_active : true
    });
    setShowEditModal(true);
  };

  // Save document (create or update)
  const handleSave = async (docData) => {
    try {
      if (docData.id) {
        // Update existing
        await apiClient.put(`/api/v1/cms-admin/legal-documents/${docData.id}`, docData);
      } else {
        // Create new
        await apiClient.post('/api/v1/cms-admin/legal-documents', docData);
      }
      
      await fetchDocuments();
      setShowEditModal(false);
      setSelectedDoc(null);
    } catch (err) {
      throw new Error(err.message || 'Failed to save legal document');
    }
  };

  // Delete document
  const handleDelete = async (docId) => {
    if (!confirm('Are you sure you want to delete this legal document?')) return;
    
    try {
      await apiClient.delete(`/api/v1/cms-admin/legal-documents/${docId}`);
      await fetchDocuments();
    } catch (err) {
      alert(`Failed to delete document: ${err.message}`);
    }
  };

  // Toggle active status
  const handleToggleActive = async (doc) => {
    try {
      const updatedDoc = {
        ...doc,
        isActive: !doc.isActive,
        // Ensure we send the right field name
        is_active: !doc.isActive
      };
      
      await apiClient.put(`/api/v1/cms-admin/legal-documents/${doc.id}`, updatedDoc);
      await fetchDocuments();
    } catch (err) {
      alert(`Failed to toggle status: ${err.message}`);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-600/20 rounded-lg">
            <FileText className="w-6 h-6 text-primary-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-dark-50">Legal Documents</h2>
            <p className="text-dark-300 text-sm">
              Manage all legal documents, policies, and terms
            </p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Document
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 placeholder-dark-400 focus:border-primary-500 focus:outline-none"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none appearance-none cursor-pointer"
            >
              {documentTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-dark-300">
          Showing {filteredDocuments.length} of {documents.length} documents
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 text-dark-300">
          Loading legal documents...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Documents Table */}
      {!loading && !error && (
        <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-900 border-b border-dark-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-300 uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-300 uppercase tracking-wider">
                    Version
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-300 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-dark-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-dark-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                <AnimatePresence>
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-dark-400">
                        No documents found
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc, index) => (
                      <motion.tr
                        key={doc.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-dark-750 transition-colors"
                      >
                        <td className="px-4 py-3 text-dark-50 font-medium">
                          {doc.title}
                        </td>
                        <td className="px-4 py-3 text-dark-200 text-sm">
                          {documentTypes.find(t => t.value === (doc.documentType || doc.document_type))?.label || doc.documentType || doc.document_type}
                        </td>
                        <td className="px-4 py-3 text-dark-300 text-sm font-mono">
                          {doc.slug}
                        </td>
                        <td className="px-4 py-3 text-dark-300 text-sm">
                          {doc.version}
                        </td>
                        <td className="px-4 py-3 text-dark-300 text-sm">
                          {doc.displayOrder || doc.display_order || 0}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleActive(doc)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                              doc.isActive || doc.is_active
                                ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                                : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                            }`}
                          >
                            {doc.isActive || doc.is_active ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Active
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                Inactive
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(doc)}
                              className="p-1.5 text-primary-400 hover:bg-primary-900/20 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-1.5 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && selectedDoc && (
          <EditModal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedDoc(null);
            }}
            onSave={handleSave}
            elementData={selectedDoc}
            elementType="legal-document"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LegalDocumentManagement;
