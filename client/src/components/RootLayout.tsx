import { Outlet } from 'react-router'
import { SignupBanner } from '@/components/SignupBanner'

// App-wide shell: renders the matched route plus the global signup banner so the
// banner appears on every game without each game mounting it.
export function RootLayout() {
  return (
    <>
      <Outlet />
      <SignupBanner />
    </>
  )
}
