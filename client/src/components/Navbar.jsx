import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Hotel, User, LogOut, Shield, CalendarCheck, BedDouble, Users, BarChart3 } from 'lucide-react';

export default function Navbar() {
  const { user, role, isAuthenticated, logout, switchDemoRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      {/* 1-Click Demo Role Switcher Banner */}
      <div className="bg-slate-900 text-slate-300 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-400 uppercase tracking-wider text-[10px] bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
            Demo Mode
          </span>
          <span className="text-slate-400">Quick-switch test account:</span>
          <div className="inline-flex rounded-md shadow-sm gap-1">
            <button
              onClick={() => switchDemoRole('guest')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                role === 'guest' && isAuthenticated
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              Guest (guest@demo.test)
            </button>
            <button
              onClick={() => switchDemoRole('staff')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                role === 'staff'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              Staff (staff@demo.test)
            </button>
            <button
              onClick={() => switchDemoRole('admin')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                role === 'admin'
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              Admin (admin@demo.test)
            </button>
          </div>
        </div>
        <div className="text-slate-400 hidden sm:block">
          All passwords: <code className="text-slate-200 font-mono">Password123!</code>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 font-bold text-slate-900 text-lg">
              <div className="bg-brand-600 text-white p-1.5 rounded-lg shadow-sm">
                <Hotel className="w-5 h-5" />
              </div>
              <span>Grand Horizon</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600">
              <Link to="/" className="px-3 py-2 rounded-md hover:text-slate-900 hover:bg-slate-100 transition">
                Search Rooms
              </Link>

              {isAuthenticated && (
                <Link
                  to="/my-bookings"
                  className="px-3 py-2 rounded-md hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1.5"
                >
                  <CalendarCheck className="w-4 h-4 text-slate-400" />
                  My Bookings
                </Link>
              )}

              {['staff', 'admin'].includes(role) && (
                <>
                  <Link
                    to="/staff/dashboard"
                    className="px-3 py-2 rounded-md hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1.5"
                  >
                    <BedDouble className="w-4 h-4 text-blue-500" />
                    Front Desk
                  </Link>
                  <Link
                    to="/staff/guests"
                    className="px-3 py-2 rounded-md hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1.5"
                  >
                    <Users className="w-4 h-4 text-blue-500" />
                    Guests
                  </Link>
                </>
              )}

              {role === 'admin' && (
                <Link
                  to="/admin"
                  className="px-3 py-2 rounded-md hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1.5 text-purple-700 font-semibold"
                >
                  <BarChart3 className="w-4 h-4" />
                  Admin & Reports
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-slate-900 leading-none">{user?.name}</div>
                  <span
                    className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 uppercase tracking-wider ${
                      role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : role === 'staff'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

