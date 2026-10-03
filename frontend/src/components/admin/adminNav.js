import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Tags,
  Users2,
  Palette,
  Droplet,
  Armchair,
  Layers,
  FileText,
  Wrench,
  Settings,
  DollarSign,
  Mail,
  Download,
  ClipboardList,
  BookOpen,
  Inbox,
  Building2,
  Scale,
  Library,
} from 'lucide-react';

/**
 * Admin navigation — the single source of truth for sidebar groups, section
 * ids, URLs, breadcrumbs and the command palette.
 */
export const ADMIN_NAV = [
  {
    id: 'main',
    title: 'Overview',
    items: [
      { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
      { id: 'analytics', label: 'Analytics', icon: TrendingUp, path: '/admin/analytics' },
    ],
  },
  {
    id: 'sales',
    title: 'Sales',
    items: [
      { id: 'quotes', label: 'Quotes', icon: FileText, path: '/admin/quotes' },
      { id: 'inquiries', label: 'Inquiries', icon: Inbox, path: '/admin/inquiries' },
      { id: 'companies', label: 'Companies', icon: Building2, path: '/admin/companies' },
      { id: 'pricing-tiers', label: 'Pricing Tiers', icon: DollarSign, path: '/admin/pricing-tiers' },
    ],
  },
  {
    id: 'products',
    title: 'Products',
    items: [
      { id: 'catalog', label: 'Product Catalog', icon: Package, path: '/admin/catalog' },
      { id: 'register', label: 'Product Register', icon: ClipboardList, path: '/admin/register' },
      { id: 'categories', label: 'Categories', icon: Tags, path: '/admin/categories' },
      { id: 'families', label: 'Product Families', icon: Users2, path: '/admin/families' },
    ],
  },
  {
    id: 'materials',
    title: 'Materials & Options',
    items: [
      { id: 'finishes', label: 'Finishes', icon: Palette, path: '/admin/finishes' },
      { id: 'colors', label: 'Colors', icon: Droplet, path: '/admin/colors' },
      { id: 'upholstery', label: 'Upholstery', icon: Armchair, path: '/admin/upholstery' },
      { id: 'laminates', label: 'Laminates', icon: Layers, path: '/admin/laminates' },
      { id: 'hardware', label: 'Hardware', icon: Wrench, path: '/admin/hardware' },
    ],
  },
  {
    id: 'publishing',
    title: 'Publishing',
    items: [
      { id: 'catalog-builder', label: 'Catalog Builder', icon: BookOpen, path: '/admin/catalog-builder' },
      { id: 'catalogs', label: 'Virtual Catalogs', icon: Library, path: '/admin/resources/catalogs' },
      { id: 'legal-documents', label: 'Legal Documents', icon: Scale, path: '/admin/legal-documents' },
    ],
  },
  {
    id: 'system',
    title: 'System',
    items: [
      { id: 'emails', label: 'Email Templates', icon: Mail, path: '/admin/emails' },
      { id: 'downloads', label: 'Downloads', icon: Download, path: '/admin/downloads' },
      { id: 'settings', label: 'Site Settings', icon: Settings, path: '/admin/settings' },
    ],
  },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.title }))
);

// Longest path first, so /admin/catalog-builder wins over /admin/catalog
const ITEMS_BY_PATH_LENGTH = [...ADMIN_NAV_ITEMS].sort((a, b) => b.path.length - a.path.length);

export function getAdminNavItem(sectionId) {
  return ADMIN_NAV_ITEMS.find((item) => item.id === sectionId) || ADMIN_NAV_ITEMS[0];
}

export function sectionFromPath(pathname) {
  const match = ITEMS_BY_PATH_LENGTH.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`)
  );
  return match ? match.id : 'overview';
}
