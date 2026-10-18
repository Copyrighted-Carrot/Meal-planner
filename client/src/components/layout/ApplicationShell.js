import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { CarrotIcon, PotIcon, BookIcon, CalendarIcon, ListIcon, LogoutIcon } from '../Icons';
import './ApplicationShell.css';

const destinations = [
  ['/', 'Add Meal', CarrotIcon],
  ['/available-meals', 'Available Meals', PotIcon],
  ['/browse', 'Browse Recipes', BookIcon],
  ['/meal-planner', 'Meal Planner', CalendarIcon],
  ['/grocery-list', 'Grocery List', ListIcon],
];

export function KitchenNavigation() {
  const { logout, user } = useContext(AuthContext);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const toggle = useRef(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  const memberSince = new Date(user?.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return <nav className={`kitchen-navigation${open ? ' is-open' : ''}`} aria-label="Main navigation"
    onKeyDown={event => {
      if (event.key === 'Escape' && open) { setOpen(false); toggle.current?.focus(); }
    }}>
    <div className="kitchen-navigation-heading">
      <button type="button" className="greeting-plank" aria-pressed={showStats}
        onClick={() => setShowStats(value => !value)} title="Show your membership date">
        {showStats ? `👨‍🍳 Chef Since ${memberSince}` : `👋 Hi, ${user?.name || 'Chef'}`}
      </button>
      <button ref={toggle} type="button" className="sidebar-btn kitchen-menu-toggle"
        aria-expanded={open} aria-controls="kitchen-navigation-links" onClick={() => setOpen(value => !value)}>
        <span aria-hidden="true">{open ? '✕' : '☰'}</span><span>{open ? 'Close menu' : 'Kitchen menu'}</span>
      </button>
    </div>
    <div id="kitchen-navigation-links" className="kitchen-navigation-links">
      {destinations.map(([to, label, Icon]) => {
        const active = pathname === to || (to === '/' && pathname === '/add');
        return <Link key={to} to={to} className={`sidebar-btn${active ? ' active' : ''}`}
          aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)}>
          <span aria-hidden="true"><Icon /></span><span>{label}</span>
        </Link>;
      })}
      <button type="button" onClick={logout} className="sidebar-btn logout">
        <span aria-hidden="true"><LogoutIcon /></span><span>Logout</span>
      </button>
    </div>
  </nav>;
}

export default function ApplicationShell({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const { pathname } = useLocation();
  const manager = ['/manager-access', '/rustic-manager-dashboard'].includes(pathname);
  const publicPage = ['/login', '/register'].includes(pathname) || !isAuthenticated;
  // Keep the separate Manager layout outside the user application's shell.
  if (manager) return <div className="App"><div className="container mt-4">{children}</div></div>;
  return <div className={`App app-shell${publicPage ? ' app-shell--public' : ''}`}>
    <a className="skip-to-content" href="#main-content">Skip to content</a>
    {!publicPage && <KitchenNavigation />}
    <main id="main-content" className="app-main" tabIndex={-1}>{children}</main>
  </div>;
}
