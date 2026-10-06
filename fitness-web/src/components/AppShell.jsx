import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const link = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
    isActive
      ? "bg-brand-500/15 text-brand-400 dark:text-brand-300"
      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
  }`;

export default function AppShell() {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f17]">
      {/* Top bar (mobile) */}
      <header className="md:hidden sticky top-0 z-40 border-b border-white/10 bg-white/90 dark:bg-[#0b0f17]/90 backdrop-blur">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-brand-500" />
            <span className="font-semibold text-gray-900 dark:text-white">
              FitTrack
            </span>
          </div>
          <div className="flex items-center gap-2">
            {user && <span className="text-xs subtle">{user.email}</span>}
            <button
              onClick={toggle}
              className="button-ghost"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
          </div>
        </div>
        <nav aria-label="Main navigation" className="flex flex-wrap gap-1 px-4 pb-3">
          <NavLink to="/" className={link}>Home</NavLink>
          <NavLink to="/dashboard" className={link}>Workouts</NavLink>
          <NavLink to="/nutrition" className={link}>Nutrition</NavLink>
          <NavLink to="/profile" className={link}>Profile</NavLink>
          <NavLink to="/insights" className={link}>Insights</NavLink>
        </nav>
      </header>

      <div className="mx-auto max-w-7xl md:grid md:grid-cols-[240px_1fr]">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:block border-r border-white/10 sticky top-0 h-screen p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-9 w-9 rounded-xl bg-brand-500" />
            <span className="font-semibold text-gray-900 dark:text-white">
              FitTrack
            </span>
          </div>
          <nav className="space-y-1">
            <NavLink to="/" className={link}>
              Home
            </NavLink>
            <NavLink to="/dashboard" className={link}>
              Workouts
            </NavLink>
            <NavLink to="/nutrition" className={link}>
              Nutrition
            </NavLink>
            <NavLink to="/profile" className={link}>
              Profile
            </NavLink>
            <NavLink to="/insights" className={link}>
              Insights
            </NavLink>
          </nav>
          <div className="mt-6">
            <button onClick={toggle} className="button-ghost w-full">
              Toggle {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
          {user && (
            <p className="subtle mt-4">
              Signed in as{" "}
              <span className="text-gray-900 dark:text-white">
                {user.email}
              </span>
            </p>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 w-full h-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
