import { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';
import {
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Package,
  Edit2,
  Save,
  X,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import apiClient from '../../config/apiClient';

const AccountSettings = () => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState({ label: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'USA' });
  const [addressSaving, setAddressSaving] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/v1/dashboard/profile');
      setProfileData(data);
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    if (profileData) {
      // Initialize form data with current profile data
      setProfileFormData({
        company_name: profileData.companyName || '',
        legal_name: profileData.legalName || '',
        industry: profileData.industry || '',
        website: profileData.website || '',
        rep_first_name: profileData.representative?.firstName || '',
        rep_last_name: profileData.representative?.lastName || '',
        rep_title: profileData.representative?.title || '',
        rep_phone: profileData.representative?.phone || '',
        billing_address_line1: profileData.billingAddress?.line1 || '',
        billing_address_line2: profileData.billingAddress?.line2 || '',
        billing_city: profileData.billingAddress?.city || '',
        billing_state: profileData.billingAddress?.state || '',
        billing_zip: profileData.billingAddress?.zip || '',
        billing_country: profileData.billingAddress?.country || '',
      });
      setIsEditingProfile(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setProfileFormData(null);
  };

  const handleSaveProfile = async () => {
    if (!profileFormData) return;

    try {
      setProfileSaving(true);
      await apiClient.put('/api/v1/dashboard/profile', profileFormData);
      
      // Reload profile data
      await loadProfileData();
      setIsEditingProfile(false);
      setProfileFormData(null);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleFormChange = (field, value) => {
    setProfileFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const openAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm({ label: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'USA' });
    setAddressModalOpen(true);
  };

  const openEditAddress = (addr) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      label: addr.label || '',
      line1: addr.line1 || '',
      line2: addr.line2 || '',
      city: addr.city || '',
      state: addr.state || '',
      zip: addr.zip || '',
      country: addr.country || 'USA',
    });
    setAddressModalOpen(true);
  };

  const closeAddressModal = () => {
    setAddressModalOpen(false);
    setEditingAddressId(null);
  };

  const saveAddress = async () => {
    if (!addressForm.line1?.trim() || !addressForm.city?.trim() || !addressForm.state?.trim() || !addressForm.zip?.trim()) {
      alert('Please fill in required address fields (Line 1, City, State, ZIP).');
      return;
    }
    try {
      setAddressSaving(true);
      if (editingAddressId) {
        await apiClient.put(`/api/v1/dashboard/shipping-addresses/${editingAddressId}`, addressForm);
      } else {
        await apiClient.post('/api/v1/dashboard/shipping-addresses', addressForm);
      }
      await loadProfileData();
      closeAddressModal();
    } catch (err) {
      console.error('Error saving address:', err);
      alert('Failed to save address.');
    } finally {
      setAddressSaving(false);
    }
  };

  const deleteAddress = async (id) => {
    if (!window.confirm('Remove this shipping address?')) return;
    try {
      await apiClient.delete(`/api/v1/dashboard/shipping-addresses/${id}`);
      await loadProfileData();
    } catch (err) {
      console.error('Error deleting address:', err);
      alert('Failed to delete address.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-dark-200">Loading account settings...</p>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-200">Failed to load account settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-dark-50">Account Settings</h1>
        {!isEditingProfile && (
          <Button variant="outline" onClick={handleEditProfile} className="flex items-center gap-2">
            <Edit2 className="w-4 h-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid gap-6">
        {/* Company Information */}
        <Card className="p-6 bg-dark-700 border-dark-600">
          <h2 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Company Information
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Company Name
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.company_name}
                  onChange={(e) => handleFormChange('company_name', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.companyName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Legal Name
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.legal_name}
                  onChange={(e) => handleFormChange('legal_name', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.legalName || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1 flex items-center gap-1">
                Tax ID
                <AlertCircle className="w-3 h-3 text-dark-400" title="Contact support to update Tax ID" />
              </label>
              <p className="text-dark-50">{profileData.taxId || 'N/A'}</p>
              {isEditingProfile && (
                <p className="text-xs text-dark-400 mt-1">Contact support to update Tax ID</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Industry
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.industry}
                  onChange={(e) => handleFormChange('industry', e.target.value)}
                  placeholder="e.g., Hospitality, Healthcare, etc."
                />
              ) : (
                <p className="text-dark-50">{profileData.industry || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Website
              </label>
              {isEditingProfile ? (
                <Input
                  type="url"
                  value={profileFormData.website}
                  onChange={(e) => handleFormChange('website', e.target.value)}
                  placeholder="https://example.com"
                />
              ) : (
                <p className="text-dark-50">{profileData.website || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Account Status
              </label>
              <Badge variant={profileData.status === 'approved' ? 'success' : 'warning'}>
                {profileData.status}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Representative Information */}
        <Card className="p-6 bg-dark-700 border-dark-600">
          <h2 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Representative Information
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                First Name
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.rep_first_name}
                  onChange={(e) => handleFormChange('rep_first_name', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.representative.firstName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Last Name
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.rep_last_name}
                  onChange={(e) => handleFormChange('rep_last_name', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.representative.lastName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Title
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.rep_title}
                  onChange={(e) => handleFormChange('rep_title', e.target.value)}
                  placeholder="e.g., Purchasing Manager"
                />
              ) : (
                <p className="text-dark-50">{profileData.representative.title || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1 flex items-center gap-1">
                <Mail className="w-4 h-4" />
                Email
              </label>
              <p className="text-dark-50">{profileData.representative.email}</p>
              <p className="text-xs text-dark-400 mt-1">Email cannot be changed here</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1 flex items-center gap-1">
                <Phone className="w-4 h-4" />
                Phone
              </label>
              {isEditingProfile ? (
                <Input
                  type="tel"
                  value={profileFormData.rep_phone}
                  onChange={(e) => handleFormChange('rep_phone', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.representative.phone}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Billing Address */}
        <Card className="p-6 bg-dark-700 border-dark-600">
          <h2 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Billing Address
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Address Line 1
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.billing_address_line1}
                  onChange={(e) => handleFormChange('billing_address_line1', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.billingAddress.line1}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Address Line 2
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.billing_address_line2}
                  onChange={(e) => handleFormChange('billing_address_line2', e.target.value)}
                  placeholder="Optional"
                />
              ) : (
                <p className="text-dark-50">{profileData.billingAddress.line2 || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                City
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.billing_city}
                  onChange={(e) => handleFormChange('billing_city', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.billingAddress.city}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                State
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.billing_state}
                  onChange={(e) => handleFormChange('billing_state', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.billingAddress.state}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                ZIP Code
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.billing_zip}
                  onChange={(e) => handleFormChange('billing_zip', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.billingAddress.zip}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Country
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.billing_country}
                  onChange={(e) => handleFormChange('billing_country', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.billingAddress.country}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Shipping Addresses */}
        <Card className="p-6 bg-dark-700 border-dark-600">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark-50 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Shipping Addresses
            </h2>
            <Button variant="outline" size="sm" onClick={openAddAddress} className="flex items-center gap-1">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
          <div className="space-y-3">
            {(profileData.shippingAddresses || []).length === 0 ? (
              <p className="text-dark-400 text-sm">No shipping addresses. Add one for quote requests.</p>
            ) : (
              (profileData.shippingAddresses || []).map((addr) => (
                <div
                  key={addr.id}
                  className="flex items-start justify-between gap-4 p-3 rounded-lg bg-dark-600 border border-dark-500"
                >
                  <div>
                    {addr.label && <p className="font-medium text-dark-100">{addr.label}</p>}
                    <p className="text-sm text-dark-300">
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ''} — {addr.city}, {addr.state} {addr.zip}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEditAddress(addr)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteAddress(addr.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          {addressModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={closeAddressModal}>
              <div className="bg-dark-700 border border-dark-600 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-dark-50">{editingAddressId ? 'Edit' : 'Add'} Shipping Address</h3>
                <Input placeholder="Label (e.g. Warehouse)" value={addressForm.label} onChange={e => setAddressForm(f => ({ ...f, label: e.target.value }))} />
                <Input placeholder="Address Line 1 *" value={addressForm.line1} onChange={e => setAddressForm(f => ({ ...f, line1: e.target.value }))} />
                <Input placeholder="Address Line 2" value={addressForm.line2} onChange={e => setAddressForm(f => ({ ...f, line2: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="City *" value={addressForm.city} onChange={e => setAddressForm(f => ({ ...f, city: e.target.value }))} />
                  <Input placeholder="State *" value={addressForm.state} onChange={e => setAddressForm(f => ({ ...f, state: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="ZIP *" value={addressForm.zip} onChange={e => setAddressForm(f => ({ ...f, zip: e.target.value }))} />
                  <Input placeholder="Country" value={addressForm.country} onChange={e => setAddressForm(f => ({ ...f, country: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={closeAddressModal}>Cancel</Button>
                  <Button variant="primary" onClick={saveAddress} disabled={addressSaving}>{addressSaving ? 'Saving...' : 'Save'}</Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Action Buttons */}
        {isEditingProfile && (
          <div className="flex gap-4 justify-end">
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={profileSaving}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {profileSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSettings;

