import { useState, type FormEvent } from 'react'
import { niceError, supabase } from '../supabase'

export default function JoinPage({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('join_league', { p_code: code, p_pseudo: pseudo })
    setBusy(false)
    if (error) setError(niceError(error))
    else onJoined()
  }

  return (
    <div className="center-page">
      <form className="card form" onSubmit={submit}>
        <h1>Rejoindre la ligue</h1>
        <p className="muted">Demande le code d’invitation à l’organisateur.</p>
        <label>
          Code d’invitation
          <input required value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" />
        </label>
        <label>
          Ton pseudo
          <input required minLength={2} maxLength={20} value={pseudo} onChange={(e) => setPseudo(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>C’est parti</button>
        <button className="link" type="button" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </button>
      </form>
    </div>
  )
}
