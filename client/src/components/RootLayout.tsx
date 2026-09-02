import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { SignupBanner } from '@/components/SignupBanner'
import { PlayerModalProvider } from '@/contexts/PlayerModalContext'
import { CompactModeProvider } from '@/contexts/CompactModeContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { installProgressSync, enableSync, disableSync, syncProgress } from '@/lib/progressSync'

// App-wide shell: renders the matched route plus the global signup banner so the
// banner appears on every game without each game mounting it. The
// PlayerModalProvider lets any game open the shared player info modal, and
// CompactModeProvider holds the admin compact-mode toggle read by every game.
export function RootLayout() {
  const { user, loading } = useAuth()

  // Install the localStorage auto-push wrapper once, as early as possible.
  useEffect(() => {
    installProgressSync()
  }, [])

  // When logged in, mirror progress to the account (upload existing local +
  // restore anything iOS Safari evicted); disable pushing when logged out.
  useEffect(() => {
    if (loading) return
    if (user) {
      enableSync(user.id)
      void syncProgress()
    } else {
      disableSync()
    }
  }, [loading, user])

  return (
    <SettingsProvider>
      <CompactModeProvider>
        <PlayerModalProvider>
          <Outlet />
          <SignupBanner />
        </PlayerModalProvider>
      </CompactModeProvider>
    </SettingsProvider>
  )
}
