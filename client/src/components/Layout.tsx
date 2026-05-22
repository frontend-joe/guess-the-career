import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { Users, UserCog, Building2, Database, Gamepad2, LayoutGrid, Trophy, Shuffle, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/footballers", label: "Footballers", icon: Users },
  { to: "/managers", label: "Managers", icon: UserCog },
  { to: "/clubs", label: "Clubs", icon: Building2 },
  { to: "/elevens", label: "Elevens", icon: LayoutGrid },
  { to: "/competitions", label: "Competitions", icon: Trophy },
  { to: "/two-clubs", label: "Two Clubs", icon: Shuffle },
  { to: "/database", label: "Database", icon: Database },
  { to: "/play", label: "Play", icon: Gamepad2 },
];

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen md:flex-row bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 border-r flex-col shrink-0">
        <div className="px-4 py-5 border-b">
          <span className="font-semibold text-sm tracking-tight">
            Guess the Career
          </span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            Admin
          </span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div>
          <span className="font-semibold text-sm tracking-tight">
            Guess the Career
          </span>
          <span className="text-xs text-muted-foreground ml-2">Admin</span>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          className="p-1 -mr-1 text-muted-foreground hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-background border-r flex flex-col transition-transform duration-200",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <span className="font-semibold text-sm tracking-tight">
              Guess the Career
            </span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Admin
            </span>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-1 -mr-1 text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
