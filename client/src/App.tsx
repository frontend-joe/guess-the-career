import { createBrowserRouter, RouterProvider, Navigate } from 'react-router'
import { Layout } from '@/components/Layout'
import { FootballersPage } from '@/pages/FootballersPage'
import { AddFootballerPage } from '@/pages/AddFootballerPage'
import { FootballerDetailPage } from '@/pages/FootballerDetailPage'
import { DaysPage } from '@/pages/DaysPage'
import { PlayPage } from '@/pages/PlayPage'

const router = createBrowserRouter([
  { path: '/play', element: <PlayPage /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/footballers" replace /> },
      { path: 'footballers', element: <FootballersPage /> },
      { path: 'footballers/add', element: <AddFootballerPage /> },
      { path: 'footballers/:id', element: <FootballerDetailPage /> },
      { path: 'days', element: <DaysPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
