import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import axios from 'axios';
import { 
  Armchair, 
  Plus, 
  Edit2, 
  Trash2, 
  Search,
  Save,
  X
} from 'lucide-react';

const UpholsteryManagement = () => {
  const [upholsteries, setUpholsteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    material_code: '',
    material_type: '',
    description: '',
    grade: '',
    color: '',
    color_hex: '',
    pattern: '',
    durability_rating: '',
    is_com: false
  });

  useEffect(() => {
    fetchUpholsteries();
  }, []);

  const fetchUpholsteries = async () => {
    try {
      setLoading(true);
      // Note: Update this endpoint when backend route is created
      const response = await axios.get('/api/v1/admin/upholsteries');
      setUpholsteries(response.data.items || response.data);
    } catch (error) {
      console.error('Failed to fetch upholsteries:', error);
      setUpholsteries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`/api/v1/admin/upholsteries/${editingId}`, formData);
      } else {
        await axios.post('/api/v1/admin/upholsteries', formData);
      }
      fetchUpholsteries();
      resetForm();
    } catch (error) {
      console.error('Failed to save upholstery:', error);
      alert('Failed to save upholstery');
    }
  };

  const handleEdit = (upholstery) => {
    setFormData({
      name: upholstery.name || '',
      material_code: upholstery.material_code || '',
      material_type: upholstery.material_type || '',
      description: upholstery.description || '',
      grade: upholstery.grade || '',
      color: upholstery.color || '',
      color_hex: upholstery.color_hex || '',
      pattern: upholstery.pattern || '',
      durability_rating: upholstery.durability_rating || '',
      is_com: upholstery.is_com || false
    });
    setEditingId(upholstery.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this upholstery?')) return;
    
    try {
      await axios.delete(`/api/v1/admin/upholsteries/${id}`);
      fetchUpholsteries();
    } catch (error) {
      console.error('Failed to delete upholstery:', error);
      alert('Failed to delete upholstery');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      material_code: '',
      material_type: '',
      description: '',
      grade: '',
      color: '',
      color_hex: '',
      pattern: '',
      durability_rating: '',
      is_com: false
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const filteredUpholsteries = upholsteries.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      item.name?.toLowerCase().includes(searchLower) ||
      item.material_code?.toLowerCase().includes(searchLower) ||
      item.material_type?.toLowerCase().includes(searchLower) ||
      item.grade?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-50 flex items-center gap-2">
            <Armchair className="w-7 h-7 text-primary-500" />
            Upholstery Management
          </h2>
          <p className="text-dark-300 mt-1">Manage upholstery materials, fabrics, and grades</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Upholstery
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-dark-50">
              {editingId ? 'Edit Upholstery' : 'Add New Upholstery'}
            </h3>
            <button
              onClick={resetForm}
              className="p-2 text-dark-300 hover:text-dark-50 hover:bg-dark-600 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Material Code"
                value={formData.material_code}
                onChange={(e) => setFormData({ ...formData, material_code: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Material Type *
                </label>
                <select
                  value={formData.material_type}
                  onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-500 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Type</option>
                  <option value="Vinyl">Vinyl</option>
                  <option value="Fabric">Fabric</option>
                  <option value="Leather">Leather</option>
                  <option value="Faux Leather">Faux Leather</option>
                  <option value="Mesh">Mesh</option>
                </select>
              </div>
              <Input
                label="Grade"
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                placeholder="e.g., A, B, C, Premium"
              />
              <Input
                label="Color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
              <Input
                label="Color Hex"
                value={formData.color_hex}
                onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
                placeholder="#000000"
              />
              <Input
                label="Pattern"
                value={formData.pattern}
                onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
              />
              <Input
                label="Durability Rating"
                value={formData.durability_rating}
                onChange={(e) => setFormData({ ...formData, durability_rating: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-100 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-500 rounded-lg text-dark-50 placeholder-dark-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_com"
                checked={formData.is_com}
                onChange={(e) => setFormData({ ...formData, is_com: e.target.checked })}
                className="w-4 h-4 text-primary-500 bg-dark-700 border-dark-500 rounded focus:ring-primary-500"
              />
              <label htmlFor="is_com" className="text-sm text-dark-200">
                COM/COL (Customer's Own Material/Leather)
              </label>
            </div>
            <div className="flex items-center gap-3 pt-4">
              <Button type="submit" variant="primary" className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                {editingId ? 'Update' : 'Create'} Upholstery
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Search */}
      <Card>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
          <input
            type="text"
            placeholder="Search upholsteries by name, code, type, or grade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </Card>

      {/* Upholsteries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : filteredUpholsteries.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Armchair className="w-16 h-16 text-dark-600 mx-auto mb-4" />
            <p className="text-dark-300 text-lg">No upholsteries found</p>
            <p className="text-dark-400 text-sm mt-2">
              {searchTerm ? 'Try adjusting your search' : 'Add your first upholstery to get started'}
            </p>
          </div>
        ) : (
          filteredUpholsteries.map((item) => (
            <Card key={item.id} className="hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-dark-50 mb-1">{item.name}</h3>
                  <p className="text-sm text-dark-300">{item.material_type}</p>
                </div>
                {item.color_hex && (
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-dark-600"
                    style={{ backgroundColor: item.color_hex }}
                    title={item.color}
                  />
                )}
              </div>
              
              <div className="space-y-2 mb-4">
                {item.material_code && (
                  <p className="text-sm text-dark-200">
                    <span className="text-dark-400">Code:</span> {item.material_code}
                  </p>
                )}
                {item.grade && (
                  <p className="text-sm text-dark-200">
                    <span className="text-dark-400">Grade:</span> {item.grade}
                  </p>
                )}
                {item.pattern && (
                  <p className="text-sm text-dark-200">
                    <span className="text-dark-400">Pattern:</span> {item.pattern}
                  </p>
                )}
                {item.durability_rating && (
                  <p className="text-sm text-dark-200">
                    <span className="text-dark-400">Durability:</span> {item.durability_rating}
                  </p>
                )}
                {item.is_com && (
                  <span className="inline-block px-2 py-1 bg-accent-900/30 text-accent-500 text-xs rounded-full">
                    COM/COL
                  </span>
                )}
              </div>

              {item.description && (
                <p className="text-sm text-dark-300 mb-4 line-clamp-2">{item.description}</p>
              )}

              <div className="flex items-center gap-2 pt-4 border-t border-dark-600">
                <button
                  onClick={() => handleEdit(item)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-dark-200 hover:text-primary-500 hover:bg-dark-700 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-dark-200 hover:text-red-500 hover:bg-dark-700 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default UpholsteryManagement;
