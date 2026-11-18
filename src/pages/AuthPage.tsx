import { useState, type FormEvent } from 'react'
import { niceError, supabase } from '../supabase'

type Mode = 'login' | 'signup' | 'reset'

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(niceError(error))
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setError(niceError(error))
      else if (!data.session) setInfo('Compte créé ! Clique sur le lien reçu par email puis reviens te connecter.')
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) setError(niceError(error))
      else setInfo('Si un compte existe, un email de réinitialisation vient d’être envoyé.')
    }
    setBusy(false)
  }

  return (
    <div className="center-page">
      <div className="card auth-card">
        <div className="hero">
          <img src="/favicon.svg" alt="" width={56} height={56} />
          <h1>Prono Rugby</h1>
          <p className="muted">Le Tournoi des 6 Nations entre potes</p>
        </div>

        {mode !== 'reset' && (
          <div className="segmented">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
              Connexion
            </button>
            <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} type="button">
              Créer un compte
            </button>
          </div>
        )}

        <form onSubmit={submit} className="form">
          <label>
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {mode !== 'reset' && (
            <label>
              Mot de passe
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          {info && <p className="info">{info}</p>}
          <button className="btn primary" disabled={busy}>
            {mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
          </button>
        </form>

        <button className="link" type="button" onClick={() => setMode(mode === 'reset' ? 'login' : 'reset')}>
          {mode === 'reset' ? '← Retour à la connexion' : 'Mot de passe oublié ?'}
        </button>
      </div>
    </div>
  )
}
