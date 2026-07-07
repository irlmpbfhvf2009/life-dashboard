// Static showcase data for the 作品展示 module. No backend — edit here to add
// projects. `i18nKey` points at portfolio.projects.<key> for name/summary so the
// cards localize with the rest of the UI.

export interface PortfolioProject {
  key: string
  i18nKey: string
  year: string
  tags: string[]
  /** Tailwind gradient classes for the card header band. */
  gradient: string
  emoji: string
  link?: string
  repo?: string
  featured?: boolean
}

export const projects: PortfolioProject[] = [
  {
    key: 'studio',
    i18nKey: 'studio',
    year: '2026',
    tags: ['Vue 3', 'Spring Boot', 'Firebase', 'Neon', 'Cloud Run'],
    gradient: 'from-violet-500 to-indigo-500',
    emoji: '🧠',
    link: 'https://life-dashboard-blue-omega.vercel.app',
    repo: 'https://github.com/irlmpbfhvf2009/life-dashboard',
    featured: true,
  },
  {
    key: 'stock-ai',
    i18nKey: 'stockAi',
    year: '2026',
    tags: ['Python', 'Claude', 'GitHub Actions', 'Chart.js'],
    gradient: 'from-amber-500 to-orange-500',
    emoji: '📈',
    link: 'https://life-dashboard-blue-omega.vercel.app/ai/stock',
  },
  {
    key: 'health',
    i18nKey: 'health',
    year: '2026',
    tags: ['Vue 3', 'Training Plan', 'TypeScript'],
    gradient: 'from-emerald-500 to-teal-500',
    emoji: '🦦',
    link: 'https://life-dashboard-blue-omega.vercel.app/health',
  },
  {
    key: 'casino',
    i18nKey: 'casino',
    year: '2026',
    tags: ['Vue 3', 'Spring Security', 'Anti-tamper'],
    gradient: 'from-rose-500 to-pink-500',
    emoji: '🎰',
    link: 'https://life-dashboard-blue-omega.vercel.app/fun/games',
  },
]
