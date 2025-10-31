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
} from 'lucide-react';
import apiClient from '../../config/apiClient';

const AccountSettings = () => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);

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
        shipping_address_line1: profileData.shippingAddress?.line1 || '',
        shipping_address_line2: profileData.shippingAddress?.line2 || '',
        shipping_city: profileData.shippingAddress?.city || '',
        shipping_state: profileData.shippingAddress?.state || '',
        shipping_zip: profileData.shippingAddress?.zip || '',
        shipping_country: profileData.shippingAddress?.country || '',
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

        {/* Shipping Address */}
        <Card className="p-6 bg-dark-700 border-dark-600">
          <h2 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Shipping Address
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Address Line 1
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.shipping_address_line1}
                  onChange={(e) => handleFormChange('shipping_address_line1', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.shippingAddress?.line1 || 'N/A'}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Address Line 2
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.shipping_address_line2}
                  onChange={(e) => handleFormChange('shipping_address_line2', e.target.value)}
                  placeholder="Optional"
                />
              ) : (
                <p className="text-dark-50">{profileData.shippingAddress?.line2 || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                City
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.shipping_city}
                  onChange={(e) => handleFormChange('shipping_city', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.shippingAddress?.city || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                State
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.shipping_state}
                  onChange={(e) => handleFormChange('shipping_state', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.shippingAddress?.state || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                ZIP Code
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.shipping_zip}
                  onChange={(e) => handleFormChange('shipping_zip', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.shippingAddress?.zip || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Country
              </label>
              {isEditingProfile ? (
                <Input
                  value={profileFormData.shipping_country}
                  onChange={(e) => handleFormChange('shipping_country', e.target.value)}
                />
              ) : (
                <p className="text-dark-50">{profileData.shippingAddress?.country || 'N/A'}</p>
              )}
            </div>
          </div>
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

