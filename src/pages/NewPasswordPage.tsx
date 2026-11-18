import { useState, type FormEvent } from 'react'
import { niceError, supabase } from '../supabase'

export default function NewPasswordPage({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(niceError(error))
    else onDone()
  }

  return (
    <div className="center-page">
      <form className="card form" onSubmit={submit}>
        <h1>Nouveau mot de passe</h1>
        <label>
          Mot de passe
          <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary">Enregistrer</button>
      </form>
    </div>
  )
}
