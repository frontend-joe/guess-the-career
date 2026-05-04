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
import { DatabasePage } from '@/pages/DatabasePage'
import { PlayModePage } from '@/pages/PlayModePage'
import { PlayPage } from '@/pages/PlayPage'

const router = createBrowserRouter([
  { path: '/play', element: <PlayModePage /> },
  { path: '/play/footballers', element: <PlayPage mode="footballer" /> },
  { path: '/play/managers', element: <PlayPage mode="manager" /> },
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
      { path: 'database', element: <DatabasePage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
