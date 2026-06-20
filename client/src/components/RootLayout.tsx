import { Outlet } from 'react-router'
import { SignupBanner } from '@/components/SignupBanner'
import { PlayerModalProvider } from '@/contexts/PlayerModalContext'

// App-wide shell: renders the matched route plus the global signup banner so the
// banner appears on every game without each game mounting it. The
// PlayerModalProvider lets any game open the shared player info modal.
export function RootLayout() {
  return (
    <PlayerModalProvider>
      <Outlet />
      <SignupBanner />
    </PlayerModalProvider>
  )
}
