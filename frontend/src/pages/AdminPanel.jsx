import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { useAdminStore } from '../store/adminStore';
import { useThemeStore } from '../store/themeStore';

const AdminPanel = () => {
  const { selectedSection, setSection } = useAdminStore();
  const theme = useThemeStore();
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const sections = [
    { id: 'products', name: 'Products', icon: '📦' },
    { id: 'categories', name: 'Categories', icon: '📂' },
    { id: 'quotes', name: 'Quotes', icon: '📋' },
    { id: 'users', name: 'Users', icon: '👥' },
    { id: 'content', name: 'Content', icon: '📝' },
    { id: 'theme', name: 'Theme & Branding', icon: '🎨' },
    { id: 'reps', name: 'Sales Reps', icon: '🗺️' },
    { id: 'resources', name: 'Resources', icon: '📚' },
    { id: 'settings', name: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-dark-800">
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-dark-50">Admin Panel</h1>
          <p className="text-lg text-dark-100">
            Manage your website content, products, and settings
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <Card padding="none">
              <div className="p-4 border-b border-dark-500">
                <h2 className="font-semibold text-dark-50">Admin Menu</h2>
              </div>
              <nav className="p-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
                      selectedSection === section.id
                        ? 'bg-primary-900 text-primary-300 font-medium border border-primary-500'
                        : 'text-dark-100 hover:bg-dark-700'
                    }`}
                  >
                    <span className="text-2xl">{section.icon}</span>
                    <span>{section.name}</span>
                  </button>
                ))}
              </nav>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                {selectedSection === 'products' && <ProductsSection />}
                {selectedSection === 'categories' && <CategoriesSection />}
                {selectedSection === 'quotes' && <QuotesSection />}
                {selectedSection === 'users' && <UsersSection />}
                {selectedSection === 'content' && <ContentSection />}
                {selectedSection === 'theme' && <ThemeSection />}
                {selectedSection === 'reps' && <RepsSection />}
                {selectedSection === 'resources' && <ResourcesSection />}
                {selectedSection === 'settings' && <SettingsSection />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
};

// Product Management Section
const ProductsSection = () => {
  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-dark-50">Products</h2>
        <Button variant="primary">Add New Product</Button>
      </div>
      <div className="space-y-4">
        <div className="border-b border-dark-500 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-dark-50">Classic Wood Chair</h3>
              <p className="text-sm text-dark-200">Chairs • Wood</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Edit</Button>
              <Button variant="danger" size="sm">Delete</Button>
            </div>
          </div>
        </div>
        <p className="text-sm text-dark-200">Total: 25 products</p>
      </div>
    </Card>
  );
};

// Theme & Branding Section
const ThemeSection = () => {
  const theme = useThemeStore();
  const [colors, setColors] = useState({
    primary: theme.primaryColor,
    secondary: theme.secondaryColor,
    accent: theme.accentColor,
  });

  const handleSave = () => {
    theme.updateTheme({
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      accentColor: colors.accent,
    });
  };

  const handleReset = () => {
    theme.resetTheme();
    setColors({
      primary: '#8b7355',
      secondary: '#627d98',
      accent: '#ffc107',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-bold mb-6 text-dark-50">Brand Colors</h2>
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-2">
              Primary Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={colors.primary}
                onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                className="h-12 w-12 rounded border border-dark-400 cursor-pointer bg-dark-700"
              />
              <Input
                value={colors.primary}
                onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-2">
              Secondary Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={colors.secondary}
                onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
                className="h-12 w-12 rounded border border-dark-400 cursor-pointer bg-dark-700"
              />
              <Input
                value={colors.secondary}
                onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-2">
              Accent Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={colors.accent}
                onChange={(e) => setColors({ ...colors, accent: e.target.value })}
                className="h-12 w-12 rounded border border-dark-400 cursor-pointer bg-dark-700"
              />
              <Input
                value={colors.accent}
                onChange={(e) => setColors({ ...colors, accent: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" onClick={handleSave}>
            Save Changes
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Reset to Default
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold mb-6 text-dark-50">Logo & Branding</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-dark-100 mb-2">
            Company Name
          </label>
          <Input defaultValue="Eagle Chair" />
        </div>
        <div>
          <label className="block text-sm font-medium text-dark-100 mb-2">
            Company Logo
          </label>
          <div className="border-2 border-dashed border-dark-400 rounded-lg p-8 text-center">
            <p className="text-dark-200">Upload logo image</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Placeholder sections
const CategoriesSection = () => (
  <Card>
    <h2 className="text-2xl font-bold mb-4 text-dark-50">Categories</h2>
    <p className="text-dark-100">Manage product categories and subcategories</p>
  </Card>
);

const QuotesSection = () => (
  <Card>
    <h2 className="text-2xl font-bold mb-4 text-dark-50">Quote Requests</h2>
    <p className="text-dark-100">View and respond to customer quote requests</p>
  </Card>
);

const UsersSection = () => (
  <Card>
    <h2 className="text-2xl font-bold mb-4 text-dark-50">Users</h2>
    <p className="text-dark-100">Manage customer accounts and permissions</p>
  </Card>
);

const ContentSection = () => (
  <Card>
    <h2 className="text-2xl font-bold mb-4 text-dark-50">Content Management</h2>
    <p className="text-dark-100">Edit page content, about us, legal pages, etc.</p>
  </Card>
);

const RepsSection = () => (
  <Card>
    <h2 className="text-2xl font-bold mb-4 text-dark-50">Sales Representatives</h2>
    <p className="text-dark-100">Manage sales rep information by state/territory</p>
  </Card>
);

const ResourcesSection = () => (
  <Card>
    <h2 className="text-2xl font-bold mb-4 text-dark-50">Resources</h2>
    <p className="text-dark-100">Manage catalogs, guides, and downloadable files</p>
  </Card>
);

const SettingsSection = () => (
  <Card>
    <h2 className="text-2xl font-bold mb-4 text-dark-50">Settings</h2>
    <p className="text-dark-100">General website settings and configurations</p>
  </Card>
);

export default AdminPanel;


