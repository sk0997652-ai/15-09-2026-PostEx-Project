// ==============================================================================
// PostEx HR Onboarding Portal — PortalSidebar Component (Step 14F)
// Shared responsive sidebar shell across all 4 staff roles:
// - <640px: slide-in drawer (224px / w-56) with backdrop and close button
// - 640-1023px: tablet icon rail (56px / w-14) with title tooltips
// - >=1024px: desktop full sidebar (192px / w-48)
// ==============================================================================

import React from 'react';
import { X, LogOut } from 'lucide-react';

export interface PortalSidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  onSelect: () => void;
  active: boolean;
  hidden?: boolean;
  title?: string;
  ariaLabel?: string;
}

export interface PortalSidebarBrand {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
}

export interface PortalSidebarProps {
  brand: PortalSidebarBrand;
  headerExtra?: React.ReactNode;
  items: PortalSidebarItem[];
  footer?: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  /**
   * Optional custom sign out action to render the standardized full-width sign-out button
   */
  onSignOut?: () => void;
  signOutBtnId?: string;
  signOutLabel?: string;
  userContext?: {
    name?: string;
    email?: string;
  };
}

export const PortalSidebar: React.FC<PortalSidebarProps> = ({
  brand,
  headerExtra,
  items,
  footer,
  isOpen,
  onClose,
  onSignOut,
  signOutBtnId = 'portal-signout-btn',
  signOutLabel = 'Sign Out',
  userContext,
}) => {
  return (
    <>
      {/* Mobile Slide-In Drawer Backdrop (<640px) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`${
          isOpen
            ? 'fixed inset-y-0 left-0 z-50 w-56 flex shadow-2xl'
            : 'hidden'
        } sm:static sm:z-auto sm:flex sm:w-14 lg:w-48 bg-slate-900 text-slate-300 flex-col shrink-0 border-r border-slate-800 transition-all duration-200`}
      >
        {/* Brand / Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between sm:justify-center lg:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-tag shadow-xs shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">
              {brand.icon}
            </div>
            <div className="min-w-0 sm:hidden lg:block">
              <span className="text-card-heading text-white block truncate leading-tight">
                {brand.title}
              </span>
              {brand.subtitle && (
                <span className="text-caption text-slate-400 font-medium block truncate leading-tight">
                  {brand.subtitle}
                </span>
              )}
              {headerExtra && <div className="mt-1">{headerExtra}</div>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation drawer"
            className="sm:hidden p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-2 space-y-1 text-body flex-1 overflow-y-auto">
          {items
            .filter((item) => !item.hidden)
            .map((item) => {
              const tooltipTitle = item.title || item.label;
              return (
                <button
                  key={item.id}
                  id={item.id}
                  title={tooltipTitle}
                  aria-label={item.ariaLabel || item.label}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  className={`w-full flex items-center sm:justify-center lg:justify-start gap-2.5 px-2.5 sm:px-0 lg:px-2.5 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                    item.active
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span className="shrink-0 flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5">
                    {item.icon}
                  </span>
                  <span className="sm:hidden lg:inline truncate flex-1 text-left">
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="sm:hidden lg:inline shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>

        {/* Footer Area: User Session & Sign Out */}
        <div className="p-2 border-t border-slate-800 space-y-2">
          {footer ? (
            footer
          ) : (
            <>
              {userContext && (userContext.name || userContext.email) && (
                <div className="px-1.5 py-0.5 text-caption sm:hidden lg:block">
                  <span className="text-caption text-slate-400 block leading-tight">Logged in as</span>
                  <span className="font-semibold text-white truncate block leading-tight">
                    {userContext.name || userContext.email}
                  </span>
                </div>
              )}
              {onSignOut && (
                <button
                  id={signOutBtnId}
                  title={signOutLabel}
                  onClick={onSignOut}
                  className="w-full flex items-center justify-center gap-2 px-2.5 sm:px-0 lg:px-2.5 py-1.5 rounded-lg text-body font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span className="sm:hidden lg:inline">{signOutLabel}</span>
                </button>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
};
