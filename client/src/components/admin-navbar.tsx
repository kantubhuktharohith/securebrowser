import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  testId: string;
}

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: "fas fa-home", testId: "nav-home" },
  { href: "/admin/dashboard", label: "Dashboard", icon: "fas fa-tachometer-alt", testId: "nav-dashboard" },
  { href: "/admin/hall-tickets", label: "Hall Tickets", icon: "fas fa-qrcode", testId: "nav-hall-tickets" },
  { href: "/admin/monitoring", label: "Monitoring", icon: "fas fa-tv", testId: "nav-monitoring" },
  { href: "/admin/incidents", label: "Incidents", icon: "fas fa-shield-alt", testId: "nav-incidents" },
  { href: "/admin/questions", label: "Questions", icon: "fas fa-question-circle", testId: "nav-questions" },
  { href: "/admin/results", label: "Results", icon: "fas fa-chart-bar", testId: "nav-results" },
  { href: "/admin/analytics", label: "Analytics", icon: "fas fa-chart-line", testId: "nav-analytics" },
  { href: "/admin/manual-verification", label: "Verification", icon: "fas fa-user-check", testId: "nav-verification" },
  { href: "/admin/draft-bin", label: "Draft Bin", icon: "fas fa-archive", testId: "nav-draft-bin" },
];

export function AdminNavbar() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <nav className="glass-header sticky top-0 z-50 border-b border-slate-200/60 dark:border-slate-800/60">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <Link href="/">
            <a className="flex items-center gap-2.5 flex-shrink-0 group" data-testid="nav-brand">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
                <i className="fas fa-graduation-cap text-white text-xs"></i>
              </div>
              <span className="text-base font-bold text-foreground hidden sm:block" style={{ fontFamily: "var(--font-heading)" }}>
                SecureExam
              </span>
              <span className="text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-transparent bg-clip-text hidden sm:block">
                Admin
              </span>
            </a>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 mx-6 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => {
              const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <a
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                        : "text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    }`}
                    data-testid={item.testId}
                  >
                    <i className={`${item.icon} text-[10px] ${isActive ? "text-indigo-600 dark:text-indigo-400" : ""}`}></i>
                    {item.label}
                  </a>
                </Link>
              );
            })}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* User Badge */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-2.5 py-1.5">
              <div className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center">
                <i className="fas fa-user-shield text-white text-[8px]"></i>
              </div>
              <span className="text-xs font-medium text-foreground max-w-[100px] truncate">
                {user?.firstName || user?.email}
              </span>
            </div>

            {/* Logout Button */}
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-xs h-8 px-2.5"
              onClick={handleLogout}
              data-testid="nav-logout"
            >
              <i className="fas fa-sign-out-alt mr-1.5 text-[10px]"></i>
              <span className="hidden sm:inline">Logout</span>
            </Button>

            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden h-8 w-8 p-0 rounded-lg"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="nav-mobile-toggle"
            >
              <i className={`fas ${mobileOpen ? "fa-times" : "fa-bars"} text-sm`}></i>
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-200/60 dark:border-slate-800/60 py-2 pb-3">
            <div className="grid grid-cols-2 gap-1">
              {navItems.map((item) => {
                const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <a
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                          : "text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/60"
                      }`}
                      onClick={() => setMobileOpen(false)}
                      data-testid={`mobile-${item.testId}`}
                    >
                      <i className={`${item.icon} text-[10px] w-3 ${isActive ? "text-indigo-600" : ""}`}></i>
                      {item.label}
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
