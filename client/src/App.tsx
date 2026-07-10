import { createBrowserRouter, RouterProvider, Navigate } from 'react-router'
import { Layout } from '@/components/Layout'
import { PublicHomePage } from '@/pages/PublicHomePage'
import { AuthPage } from '@/pages/AuthPage'
import { RequireAdmin } from '@/components/guards'
import { UsersPage } from '@/pages/UsersPage'
import { ForeignersPage } from '@/pages/ForeignersPage'
import { ForeignersAdminPage } from '@/pages/ForeignersAdminPage'
import { ForeignersSchedulePage } from '@/pages/ForeignersSchedulePage'
import { SerieAPage } from '@/pages/SerieAPage'
import { SerieAAdminPage } from '@/pages/SerieAAdminPage'
import { SerieASchedulePage } from '@/pages/SerieASchedulePage'
import { LaLigaPage } from '@/pages/LaLigaPage'
import { LaLigaAdminPage } from '@/pages/LaLigaAdminPage'
import { LaLigaSchedulePage } from '@/pages/LaLigaSchedulePage'
import { DualNationalityPage } from '@/pages/DualNationalityPage'
import { DualNationalityAdminPage } from '@/pages/DualNationalityAdminPage'
import { FootballFamiliesAdminPage } from '@/pages/FootballFamiliesAdminPage'
import { FootballFamiliesPage } from '@/pages/FootballFamiliesPage'
import { BookendsPage } from '@/pages/BookendsPage'
import { BookendsAdminPage } from '@/pages/BookendsAdminPage'
import { BookendsSchedulePage } from '@/pages/BookendsSchedulePage'
import { UncappedPlayersPage } from '@/pages/UncappedPlayersPage'
import { UncappedPlayersAdminPage } from '@/pages/UncappedPlayersAdminPage'
import { UncappedPlayersSchedulePage } from '@/pages/UncappedPlayersSchedulePage'
import { RootLayout } from '@/components/RootLayout'
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
import { ThreeClubsPage } from '@/pages/ThreeClubsPage'
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
import { KitGamePage } from '@/pages/KitGamePage'
import { HonorGamePage } from '@/pages/HonorGamePage'
import { TwoClubsAdminPage } from '@/pages/TwoClubsAdminPage'
import { TwoClubsAdminDetailPage } from '@/pages/TwoClubsAdminDetailPage'
import { TwoClubsSchedulePage } from '@/pages/TwoClubsSchedulePage'
import { ThreeClubsAdminPage } from '@/pages/ThreeClubsAdminPage'
import { ThreeClubsAdminDetailPage } from '@/pages/ThreeClubsAdminDetailPage'
import { ThreeClubsSchedulePage } from '@/pages/ThreeClubsSchedulePage'
import { BallonDorPage } from '@/pages/BallonDorPage'
import { BallonDorSchedulePage } from '@/pages/BallonDorSchedulePage'
import { BallonDorsAdminPage } from '@/pages/BallonDorsAdminPage'
import { WorldCupPage } from '@/pages/WorldCupPage'
import { WorldCupSchedulePage } from '@/pages/WorldCupSchedulePage'
import { WorldCupAdminPage } from '@/pages/WorldCupAdminPage'
import { NationalityPlayersPage } from '@/pages/NationalityPlayersPage'
import { NationalsAdminPage } from '@/pages/NationalsAdminPage'
import { NationalsAdminDetailPage } from '@/pages/NationalsAdminDetailPage'
import { NationalsSchedulePage } from '@/pages/NationalsSchedulePage'
import { ClubLegendsPage } from '@/pages/ClubLegendsPage'
import { ClubLegendsAdminPage } from '@/pages/ClubLegendsAdminPage'
import { ClubLegendsSchedulePage } from '@/pages/ClubLegendsSchedulePage'
import { RandomListsPage } from '@/pages/RandomListsPage'
import { RandomListsAdminPage } from '@/pages/RandomListsAdminPage'
import { RandomListsSchedulePage } from '@/pages/RandomListsSchedulePage'
import { ClubMarksmanPage } from '@/pages/ClubMarksmanPage'
import { ClubMarksmanAdminPage } from '@/pages/ClubMarksmanAdminPage'
import { ClubMarksmanSchedulePage } from '@/pages/ClubMarksmanSchedulePage'
import { InternationalLegendsPage } from '@/pages/InternationalLegendsPage'
import { InternationalLegendsAdminPage } from '@/pages/InternationalLegendsAdminPage'
import { InternationalLegendsSchedulePage } from '@/pages/InternationalLegendsSchedulePage'
import { InternationalMarksmanPage } from '@/pages/InternationalMarksmanPage'
import { InternationalMarksmanAdminPage } from '@/pages/InternationalMarksmanAdminPage'
import { InternationalMarksmanSchedulePage } from '@/pages/InternationalMarksmanSchedulePage'
import { ClubForeignersPage } from '@/pages/ClubForeignersPage'
import { ClubForeignersAdminPage } from '@/pages/ClubForeignersAdminPage'
import { ClubForeignersSchedulePage } from '@/pages/ClubForeignersSchedulePage'
import { TransfersPage } from '@/pages/TransfersPage'
import { TransfersAdminPage } from '@/pages/TransfersAdminPage'
import { TransfersSchedulePage } from '@/pages/TransfersSchedulePage'
import { TransferHistoryPage } from '@/pages/TransferHistoryPage'
import { TransferHistoryAdminPage } from '@/pages/TransferHistoryAdminPage'
import { TransferHistorySchedulePage } from '@/pages/TransferHistorySchedulePage'
import { TransferWindowDetailPage } from '@/pages/TransferWindowDetailPage'

const router = createBrowserRouter([
 {
  element: <RootLayout />,
  children: [
  // Public marketing landing + auth
  { path: '/', element: <PublicHomePage /> },
  { path: '/login', element: <AuthPage mode="login" /> },
  { path: '/signup', element: <AuthPage mode="signup" /> },

  // All games are free to play — no signup required (signup is offered for a
  // better experience, but never gates play).
  { path: '/play/guess-the-xi', element: <GuessTheXiPage /> },
  { path: '/play/guess-the-career', element: <GuessTheCareerModePage /> },
  { path: '/play/guess-the-career/footballers', element: <PlayPage mode="footballer" /> },
  { path: '/play/guess-the-career/managers', element: <PlayPage mode="manager" /> },
  { path: '/play/guess-his-clubs', element: <GuessHisClubsPage /> },
  { path: '/play/clubs-in-common', element: <ClubsInCommonPage /> },
  { path: '/play/who-scored-more', element: <WhoScoredMorePage /> },
  { path: '/play/who-played-more', element: <WhoPlayedMorePage /> },
  { path: '/play/know-your-club', element: <KnowYourClubPage /> },
  { path: '/play/two-clubs', element: <TwoClubsPage /> },
  { path: '/play/three-clubs', element: <ThreeClubsPage /> },
  { path: '/play/top-scorers', element: <TopScorersPage /> },
  { path: '/play/position-knowledge', element: <PositionKnowledgePage /> },
  { path: '/play/style-of-play', element: <StyleOfPlayPage /> },
  { path: '/play/goal-ratios', element: <GoalRatiosPage /> },
  { path: '/play/centurions', element: <CenturionsHubPage /> },
  { path: '/play/centurions/:mode', element: <CenturionsGamePage /> },
  { path: '/play/guess-the-kit', element: <KitGamePage /> },
  { path: '/play/more-trophies', element: <HonorGamePage /> },
  { path: '/play/ballon-dors', element: <BallonDorPage /> },
  { path: '/play/world-cup', element: <WorldCupPage /> },
  { path: '/play/nationality-players', element: <NationalityPlayersPage /> },
  { path: '/play/foreigners', element: <ForeignersPage /> },
  { path: '/play/serie-a', element: <SerieAPage /> },
  { path: '/play/la-liga', element: <LaLigaPage /> },
  { path: '/play/dual-nationality', element: <DualNationalityPage /> },
  { path: '/play/football-families', element: <FootballFamiliesPage /> },
  { path: '/play/bookends', element: <BookendsPage /> },
  { path: '/play/uncapped-players', element: <UncappedPlayersPage /> },
  { path: '/play/club-legends', element: <ClubLegendsPage /> },
  { path: '/play/random-lists', element: <RandomListsPage /> },
  { path: '/play/club-marksman', element: <ClubMarksmanPage /> },
  { path: '/play/international-legends', element: <InternationalLegendsPage /> },
  { path: '/play/international-marksman', element: <InternationalMarksmanPage /> },
  { path: '/play/club-foreigners', element: <ClubForeignersPage /> },
  { path: '/play/transfers', element: <TransfersPage /> },
  { path: '/play/transfer-history', element: <TransferHistoryPage /> },

  // Admin-only all-games testing hub
  { path: '/play', element: <RequireAdmin><PlayHubPage /></RequireAdmin> },

  // Admin dashboard (login-protected) — children are relative, so they resolve
  // under /admin/* automatically.
  {
    path: '/admin',
    element: <RequireAdmin><Layout /></RequireAdmin>,
    children: [
      { index: true, element: <Navigate to="/admin/footballers" replace /> },
      { path: 'footballers', element: <FootballersPage /> },
      { path: 'footballers/add', element: <AddFootballerPage /> },
      { path: 'footballers/schedule', element: <FootballerSchedulePage /> },
      { path: 'footballers/:id', element: <FootballerDetailPage /> },
      { path: 'days', element: <Navigate to="/admin/footballers/schedule" replace /> },
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
      { path: 'users', element: <UsersPage /> },
      { path: 'two-clubs', element: <TwoClubsAdminPage /> },
      { path: 'two-clubs/schedule', element: <TwoClubsSchedulePage /> },
      { path: 'two-clubs/:clubA/:clubB', element: <TwoClubsAdminDetailPage /> },
      { path: 'three-clubs', element: <ThreeClubsAdminPage /> },
      { path: 'three-clubs/schedule', element: <ThreeClubsSchedulePage /> },
      { path: 'three-clubs/:clubA/:clubB/:clubC', element: <ThreeClubsAdminDetailPage /> },
      { path: 'ballon-dors', element: <BallonDorsAdminPage /> },
      { path: 'ballon-dors/schedule', element: <BallonDorSchedulePage /> },
      { path: 'world-cup', element: <WorldCupAdminPage /> },
      { path: 'world-cup/schedule', element: <WorldCupSchedulePage /> },
      { path: 'nationals', element: <NationalsAdminPage /> },
      { path: 'nationals/schedule', element: <NationalsSchedulePage /> },
      { path: 'foreigners', element: <ForeignersAdminPage /> },
      { path: 'foreigners/schedule', element: <ForeignersSchedulePage /> },
      { path: 'serie-a', element: <SerieAAdminPage /> },
      { path: 'serie-a/schedule', element: <SerieASchedulePage /> },
      { path: 'la-liga', element: <LaLigaAdminPage /> },
      { path: 'la-liga/schedule', element: <LaLigaSchedulePage /> },
      { path: 'dual-nationality', element: <DualNationalityAdminPage /> },
      { path: 'football-families', element: <FootballFamiliesAdminPage /> },
      { path: 'bookends', element: <BookendsAdminPage /> },
      { path: 'bookends/schedule', element: <BookendsSchedulePage /> },
      { path: 'uncapped-players', element: <UncappedPlayersAdminPage /> },
      { path: 'uncapped-players/schedule', element: <UncappedPlayersSchedulePage /> },
      { path: 'nationals/:nationality/:club', element: <NationalsAdminDetailPage /> },
      { path: 'club-legends', element: <ClubLegendsAdminPage /> },
      { path: 'club-legends/schedule', element: <ClubLegendsSchedulePage /> },
      { path: 'random-lists', element: <RandomListsAdminPage /> },
      { path: 'random-lists/schedule', element: <RandomListsSchedulePage /> },
      { path: 'club-marksman', element: <ClubMarksmanAdminPage /> },
      { path: 'club-marksman/schedule', element: <ClubMarksmanSchedulePage /> },
      { path: 'international-legends', element: <InternationalLegendsAdminPage /> },
      { path: 'international-legends/schedule', element: <InternationalLegendsSchedulePage /> },
      { path: 'international-marksman', element: <InternationalMarksmanAdminPage /> },
      { path: 'international-marksman/schedule', element: <InternationalMarksmanSchedulePage /> },
      { path: 'club-foreigners', element: <ClubForeignersAdminPage /> },
      { path: 'club-foreigners/schedule', element: <ClubForeignersSchedulePage /> },
      { path: 'transfers', element: <TransfersAdminPage /> },
      { path: 'transfers/schedule', element: <TransfersSchedulePage /> },
      { path: 'transfer-history', element: <TransferHistoryAdminPage /> },
      { path: 'transfer-history/schedule', element: <TransferHistorySchedulePage /> },
      { path: 'transfer-history/:id', element: <TransferWindowDetailPage /> },
    ],
  },
  ],
 },
])

export default function App() {
  return <RouterProvider router={router} />
}
