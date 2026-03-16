/**
 * AdminBottomNav
 * Fixed tab bar shown only in standalone PWA mode on mobile (≤767px).
 * Renders two tabs: AI Chat and Dashboard.
 */

import { NavLink } from 'react-router-dom';
import { MessageSquare, LayoutDashboard } from 'lucide-react';

export default function AdminBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-dark-900 border-t border-dark-700 flex items-stretch pb-safe">
      <NavLink
        to="/admin/ai"
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1 text-xs font-medium transition-colors touch-manipulation min-h-[52px] ${
            isActive
              ? 'text-primary-400'
              : 'text-dark-400 hover:text-dark-100'
          }`
        }
      >
        <MessageSquare className="w-5 h-5" />
        <span>AI Chat</span>
      </NavLink>

      <NavLink
        to="/admin/dashboard"
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1 text-xs font-medium transition-colors touch-manipulation min-h-[52px] ${
            isActive
              ? 'text-primary-400'
              : 'text-dark-400 hover:text-dark-100'
          }`
        }
      >
        <LayoutDashboard className="w-5 h-5" />
        <span>Dashboard</span>
      </NavLink>
    </nav>
  );
}
