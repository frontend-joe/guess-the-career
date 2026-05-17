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
import { WhoScoredMorePage } from '@/pages/WhoScoredMorePage'
import { WhoPlayedMorePage } from '@/pages/WhoPlayedMorePage'
import { GuessTheXiPage } from '@/pages/GuessTheXiPage'
import { KnowYourClubPage } from '@/pages/KnowYourClubPage'
import { ElevensPage } from '@/pages/ElevensPage'
import { AddXiMatchPage } from '@/pages/AddXiMatchPage'
import { XiMatchDetailPage } from '@/pages/XiMatchDetailPage'
import { XiSchedulePage } from '@/pages/XiSchedulePage'
import { TwoClubsPage } from '@/pages/TwoClubsPage'
import { CompetitionsPage } from '@/pages/CompetitionsPage'
import { AddCompetitionPage } from '@/pages/AddCompetitionPage'
import { CompetitionDetailPage } from '@/pages/CompetitionDetailPage'
import { TopScorersPage } from '@/pages/TopScorersPage'
import { TopScorersSchedulePage } from '@/pages/TopScorersSchedulePage'
import { PositionKnowledgePage } from '@/pages/PositionKnowledgePage'
import { StyleOfPlayPage } from '@/pages/StyleOfPlayPage'
import { SopSchedulePage } from '@/pages/SopSchedulePage'
import { GoalRatiosPage } from '@/pages/GoalRatiosPage'
import { CenturionsHubPage } from '@/pages/CenturionsHubPage'
import { CenturionsGamePage } from '@/pages/CenturionsGamePage'
import { TwoClubsAdminPage } from '@/pages/TwoClubsAdminPage'
import { TwoClubsAdminDetailPage } from '@/pages/TwoClubsAdminDetailPage'
import { TwoClubsSchedulePage } from '@/pages/TwoClubsSchedulePage'

const router = createBrowserRouter([
  { path: '/play', element: <PlayHubPage /> },
  { path: '/play/guess-the-career', element: <GuessTheCareerModePage /> },
  { path: '/play/guess-the-career/footballers', element: <PlayPage mode="footballer" /> },
  { path: '/play/guess-the-career/managers', element: <PlayPage mode="manager" /> },
  { path: '/play/guess-his-clubs', element: <GuessHisClubsPage /> },
  { path: '/play/clubs-in-common', element: <ClubsInCommonPage /> },
  { path: '/play/who-scored-more', element: <WhoScoredMorePage /> },
  { path: '/play/who-played-more', element: <WhoPlayedMorePage /> },
  { path: '/play/guess-the-xi', element: <GuessTheXiPage /> },
  { path: '/play/know-your-club', element: <KnowYourClubPage /> },
  { path: '/play/two-clubs', element: <TwoClubsPage /> },
  { path: '/play/top-scorers', element: <TopScorersPage /> },
  { path: '/play/position-knowledge', element: <PositionKnowledgePage /> },
  { path: '/play/style-of-play', element: <StyleOfPlayPage /> },
  { path: '/play/goal-ratios', element: <GoalRatiosPage /> },
  { path: '/play/centurions', element: <CenturionsHubPage /> },
  { path: '/play/centurions/:mode', element: <CenturionsGamePage /> },
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
      { path: 'elevens', element: <ElevensPage /> },
      { path: 'elevens/schedule', element: <XiSchedulePage /> },
      { path: 'elevens/add', element: <AddXiMatchPage /> },
      { path: 'elevens/:id', element: <XiMatchDetailPage /> },
      { path: 'competitions', element: <CompetitionsPage /> },
      { path: 'competitions/add', element: <AddCompetitionPage /> },
      { path: 'competitions/top-scorers-schedule', element: <TopScorersSchedulePage /> },
      { path: 'footballers/sop-schedule', element: <SopSchedulePage /> },
      { path: 'competitions/:id', element: <CompetitionDetailPage /> },
      { path: 'database', element: <DatabasePage /> },
      { path: 'two-clubs', element: <TwoClubsAdminPage /> },
      { path: 'two-clubs/schedule', element: <TwoClubsSchedulePage /> },
      { path: 'two-clubs/:clubA/:clubB', element: <TwoClubsAdminDetailPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
