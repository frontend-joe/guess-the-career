import {
  Shirt, Medal, Link2, Globe, Shield, Star, ArrowLeftRight, Banknote, Flag, Plane,
  BookOpen, Handshake, Route, TrendingUp, Footprints, Trophy, Target, Users, Waypoints, MapPin, Sun, Network, Bookmark, UserX, Award, Goal, Languages, ListChecks, type LucideIcon,
} from 'lucide-react'

// Shared game metadata — single source of truth for the landing page game cards
// and the in-game burger menu (game switcher).
export interface Game {
  name: string
  pitch: string
  to: string
  icon: LucideIcon
  free?: boolean
}

export const FREE_GAME: Game = {
  name: 'Guess the XI',
  pitch: 'Name every player in a classic starting line-up with clues.',
  to: '/play/guess-the-xi',
  icon: Shirt,
  free: true,
}

export const GATED_GAMES: Game[] = [
  { name: 'Top Scorers', pitch: "Guess a competition's leading marksmen.", to: '/play/top-scorers', icon: Medal },
  { name: 'Two Clubs', pitch: 'Five players, two clubs — name who turned out for both.', to: '/play/two-clubs', icon: Link2 },
  { name: 'Three Clubs', pitch: 'Three players, three clubs — name who turned out for all three.', to: '/play/three-clubs', icon: Waypoints },
  { name: 'Transfer History', pitch: "Name the season's biggest transfers from the fee and the badges.", to: '/play/transfer-history', icon: Banknote },
  { name: 'Nationality Players', pitch: 'A flag and a club — name the players who are both.', to: '/play/nationality-players', icon: Flag },
  { name: 'Overseas Players', pitch: 'Name the overseas players who lined up for an English club.', to: '/play/foreigners', icon: Plane },
  { name: 'Serie A Players', pitch: 'Name the players of a country who turned out in Serie A.', to: '/play/serie-a', icon: MapPin },
  { name: 'La Liga Players', pitch: 'Name the players of a country who turned out in Spain.', to: '/play/la-liga', icon: Sun },
  { name: 'Dual Nationality', pitch: 'Name the players who represented two different nations.', to: '/play/dual-nationality', icon: Users },
  { name: 'Football Families', pitch: 'Name the related footballers from each family.', to: '/play/football-families', icon: Network },
  { name: 'Bookend Players', pitch: 'Name the player who started and finished at the same club.', to: '/play/bookends', icon: Bookmark },
  { name: 'Uncapped Players', pitch: 'Name the players who never earned a senior international cap.', to: '/play/uncapped-players', icon: UserX },
  { name: "Ballon d'Or", pitch: 'Name every player in the running for football’s biggest prize.', to: '/play/ballon-dors', icon: Globe },
  { name: 'World Cup', pitch: 'Recall the squads that went to the World Cup.', to: '/play/world-cup', icon: Trophy },
  { name: 'Club Legends', pitch: 'Name the cult heroes with 100+ appearances.', to: '/play/club-legends', icon: Star },
  { name: 'Random Lists', pitch: 'Name the players on each bespoke list.', to: '/play/random-lists', icon: ListChecks },
  { name: 'Club Marksman', pitch: 'Name the deadly strikers with 50+ goals for a club.', to: '/play/club-marksman', icon: Target },
  { name: 'International Legends', pitch: 'Name the players with 50+ caps for a country.', to: '/play/international-legends', icon: Award },
  { name: 'International Marksman', pitch: 'Name the players with 25+ international goals.', to: '/play/international-marksman', icon: Goal },
  { name: 'Club Foreigners', pitch: 'Name the overseas players who turned out for a club.', to: '/play/club-foreigners', icon: Languages },
  { name: 'Know Your Transfers', pitch: 'Which players made that move from one club to another?', to: '/play/transfers', icon: ArrowLeftRight },
  { name: 'Style of Play', pitch: 'Guess the player from their style of play.', to: '/play/style-of-play', icon: BookOpen },
]

export const BANTER_GAMES: Game[] = [
  { name: 'Guess the Career', pitch: 'Name the mystery player from his club-by-club career.', to: '/play/guess-the-career', icon: Users },
  { name: 'Clubs in Common', pitch: 'Spot the club two players both turned out for.', to: '/play/clubs-in-common', icon: Handshake },
  { name: 'Guess His Clubs', pitch: 'Name every club a mystery player turned out for.', to: '/play/guess-his-clubs', icon: Route },
  { name: 'Who Scored More', pitch: 'Two players head-to-head — who bagged more goals?', to: '/play/who-scored-more', icon: TrendingUp },
  { name: 'Who Played More', pitch: 'Two players head-to-head — who made more appearances?', to: '/play/who-played-more', icon: Footprints },
  { name: 'Know Your Club', pitch: 'Identify the club from a handful of cryptic clues.', to: '/play/know-your-club', icon: Shield },
]

export const LIST_GAMES: Game[] = [FREE_GAME, ...GATED_GAMES]
export const ALL_GAMES: Game[] = [...LIST_GAMES, ...BANTER_GAMES]
