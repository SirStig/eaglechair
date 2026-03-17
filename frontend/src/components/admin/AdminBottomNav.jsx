/**
 * AdminBottomNav
 * Fixed tab bar shown only in standalone PWA mode on mobile (≤767px).
 * Quick navigation to main dashboard sections. AI Chat is in the header.
 */

import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, FileText } from 'lucide-react';

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/admin/catalog', icon: Package, label: 'Catalog' },
  { to: '/admin/quotes', icon: FileText, label: 'Quotes' },
];

export default function AdminBottomNav({ onNavigate }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-dark-900 border-t border-dark-700 flex items-stretch pb-safe">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => onNavigate?.()}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1 text-xs font-medium transition-colors touch-manipulation min-h-[52px] ${
              isActive ? 'text-primary-400' : 'text-dark-400 hover:text-dark-100'
            }`
          }
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
