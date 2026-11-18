import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configMissing, supabase, type Profile } from './supabase'
import AuthPage from './pages/AuthPage'
import JoinPage from './pages/JoinPage'
import PronosPage from './pages/PronosPage'
import ClassementPage from './pages/ClassementPage'
import BonusPage from './pages/BonusPage'
import InfosPage from './pages/InfosPage'
import AdminPage from './pages/AdminPage'
import NewPasswordPage from './pages/NewPasswordPage'

type Tab = 'pronos' | 'classement' | 'bonus' | 'infos' | 'admin'

const TABS: { id: Tab; label: string; icon: string; admin?: boolean }[] = [
  { id: 'pronos', label: 'Pronos', icon: '🏉' },
  { id: 'classement', label: 'Classement', icon: '🏆' },
  { id: 'bonus', label: 'Bonus', icon: '⭐' },
  { id: 'infos', label: 'Infos', icon: 'ℹ️' },
  { id: 'admin', label: 'Admin', icon: '🛠️', admin: true },
]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const [tab, setTab] = useState<Tab>('pronos')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
      if (!s) {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadProfile = useCallback(async () => {
    if (!session) return
    const { data } = await supabase
      .from('profiles')
      .select('id, pseudo, is_admin')
      .eq('id', session.user.id)
      .maybeSingle()
    setProfile(data)
    setLoading(false)
  }, [session])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  if (configMissing) {
    return (
      <div className="center-page">
        <div className="card">
          <h1>Configuration manquante</h1>
          <p>
            Les variables <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> ne
            sont pas définies. Voir le README.
          </p>
        </div>
      </div>
    )
  }

  if (loading) return <div className="center-page"><div className="spinner" /></div>
  if (recovery && session) return <NewPasswordPage onDone={() => setRecovery(false)} />
  if (!session) return <AuthPage />
  if (!profile) return <JoinPage onJoined={loadProfile} />

  const visibleTabs = TABS.filter((t) => !t.admin || profile.is_admin)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Prono Rugby</span>
        </div>
        <span className="me">{profile.pseudo}</span>
      </header>

      <main className="content">
        {tab === 'pronos' && <PronosPage profile={profile} />}
        {tab === 'classement' && <ClassementPage profile={profile} />}
        {tab === 'bonus' && <BonusPage profile={profile} />}
        {tab === 'infos' && <InfosPage profile={profile} onProfileChange={loadProfile} />}
        {tab === 'admin' && profile.is_admin && <AdminPage />}
      </main>

      <nav className="tabbar">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon" aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
