import { createBrowserRouter, RouterProvider, Navigate } from 'react-router'
import { Layout } from '@/components/Layout'
import { FootballersPage } from '@/pages/FootballersPage'
import { AddFootballerPage } from '@/pages/AddFootballerPage'
import { FootballerDetailPage } from '@/pages/FootballerDetailPage'
import { FootballerSchedulePage } from '@/pages/FootballerSchedulePage'
import { ManagersPage } from '@/pages/ManagersPage'
import { AddManagerPage } from '@/pages/AddManagerPage'
import { ManagerDetailPage } from '@/pages/ManagerDetailPage'
import { ManagerSchedulePage } from '@/pages/ManagerSchedulePage'
import { ClubsPage } from '@/pages/ClubsPage'
import { DatabasePage } from '@/pages/DatabasePage'
import { PlayPage } from '@/pages/PlayPage'
import { PlayHubPage } from '@/pages/PlayHubPage'
import { GuessTheCareerModePage } from '@/pages/GuessTheCareerModePage'
import { GuessHisClubsPage } from '@/pages/GuessHisClubsPage'
import { ClubsInCommonPage } from '@/pages/ClubsInCommonPage'

const router = createBrowserRouter([
  { path: '/play', element: <PlayHubPage /> },
  { path: '/play/guess-the-career', element: <GuessTheCareerModePage /> },
  { path: '/play/guess-the-career/footballers', element: <PlayPage mode="footballer" /> },
  { path: '/play/guess-the-career/managers', element: <PlayPage mode="manager" /> },
  { path: '/play/guess-his-clubs', element: <GuessHisClubsPage /> },
  { path: '/play/clubs-in-common', element: <ClubsInCommonPage /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/footballers" replace /> },
      { path: 'footballers', element: <FootballersPage /> },
      { path: 'footballers/add', element: <AddFootballerPage /> },
      { path: 'footballers/schedule', element: <FootballerSchedulePage /> },
      { path: 'footballers/:id', element: <FootballerDetailPage /> },
      { path: 'days', element: <Navigate to="/footballers/schedule" replace /> },
      { path: 'managers', element: <ManagersPage /> },
      { path: 'managers/add', element: <AddManagerPage /> },
      { path: 'managers/schedule', element: <ManagerSchedulePage /> },
      { path: 'managers/:id', element: <ManagerDetailPage /> },
      { path: 'clubs', element: <ClubsPage /> },
      { path: 'database', element: <DatabasePage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
