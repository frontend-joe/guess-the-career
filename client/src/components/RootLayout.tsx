import { Outlet } from 'react-router'
import { SignupBanner } from '@/components/SignupBanner'
import { PlayerModalProvider } from '@/contexts/PlayerModalContext'
import { CompactModeProvider } from '@/contexts/CompactModeContext'

// App-wide shell: renders the matched route plus the global signup banner so the
// banner appears on every game without each game mounting it. The
// PlayerModalProvider lets any game open the shared player info modal, and
// CompactModeProvider holds the admin compact-mode toggle read by every game.
export function RootLayout() {
  return (
    <CompactModeProvider>
      <PlayerModalProvider>
        <Outlet />
        <SignupBanner />
      </PlayerModalProvider>
    </CompactModeProvider>
  )
}
