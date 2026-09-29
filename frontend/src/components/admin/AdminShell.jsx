/**
 * AdminShell
 * Layout element for the /admin route tree. Lives in its own module so the
 * AI chat provider/service and admin PWA chrome are only downloaded once an
 * admin route is visited (App.jsx lazy-loads it), not by public visitors.
 */

import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AIChatProvider, useAIChat } from '../../contexts/AIChatContext';
import AdminBottomNav from './AdminBottomNav';
import { useStandalone } from '../../hooks/useStandalone';
import { useMediaQuery } from '../../hooks/useMediaQuery';

function AdminPWAWrapper() {
  const location = useLocation();
  const isStandalone = useStandalone();
  const isTabletOrSmaller = useMediaQuery('(max-width: 767px)');
  const isAIChatPage = location.pathname.startsWith('/admin/ai');
  const showBottomNav = isStandalone && isTabletOrSmaller && !isAIChatPage;
  const { closeChat } = useAIChat();

  useEffect(() => {
    if (!isStandalone) return;
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const original = meta.getAttribute('content');
    meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    return () => { meta.setAttribute('content', original); };
  }, [isStandalone]);

  return (
    <>
      <Outlet />
      {showBottomNav && <AdminBottomNav onNavigate={closeChat} />}
    </>
  );
}

// Shared AIChatProvider for chat state persistence across admin pages
export default function AdminShell() {
  return (
    <AIChatProvider>
      <AdminPWAWrapper />
    </AIChatProvider>
  );
}
