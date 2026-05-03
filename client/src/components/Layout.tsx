import { NavLink, Outlet } from 'react-router'
import { Users, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/footballers', label: 'Footballers', icon: Users },
  { to: '/days', label: 'Schedule', icon: CalendarDays },
]

export function Layout() {
  return (
    <div className="flex flex-col h-screen md:flex-row bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 border-r flex-col shrink-0">
        <div className="px-4 py-5 border-b">
          <span className="font-semibold text-sm tracking-tight">Guess the Career</span>
          <span className="block text-xs text-muted-foreground mt-0.5">Admin</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
      <header className="md:hidden flex items-center border-b px-4 py-3 shrink-0">
        <span className="font-semibold text-sm tracking-tight">Guess the Career</span>
        <span className="text-xs text-muted-foreground ml-2">Admin</span>
      </header>

      {/* Main content — extra bottom padding on mobile for the tab bar */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-background flex safe-area-inset-bottom">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
