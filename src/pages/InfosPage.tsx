import { useState } from 'react'
import { niceError, supabase, type Profile } from '../supabase'

export default function InfosPage({ profile, onProfileChange }: { profile: Profile; onProfileChange: () => void }) {
  const [pseudo, setPseudo] = useState(profile.pseudo)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function savePseudo() {
    const { error } = await supabase.from('profiles').update({ pseudo: pseudo.trim() }).eq('id', profile.id)
    setMsg(error ? { ok: false, text: niceError(error) } : { ok: true, text: 'Pseudo modifié ✓' })
    if (!error) onProfileChange()
  }

  return (
    <div className="page">
      <div className="card rules">
        <h2>Règles du jeu</h2>
        <p>Pronostique le score de chaque match avant le coup d’envoi. Tu peux modifier ton prono autant que tu veux jusqu’à l’heure du match.</p>
        <table className="scale">
          <tbody>
            <tr><td>Bon vainqueur (ou match nul)</td><td>3 pts</td></tr>
            <tr><td>+ écart de points à 5 près</td><td>+2 pts</td></tr>
            <tr><td>+ score exact</td><td>+5 pts</td></tr>
            <tr><td>⚡ Booster (1 match par journée)</td><td>×2</td></tr>
            <tr><td>Bonus : vainqueur du Tournoi</td><td>10 pts</td></tr>
            <tr><td>Bonus : cuillère de bois</td><td>5 pts</td></tr>
          </tbody>
        </table>
        <p className="muted small">
          Exemple : France–Galles se termine 32–15 (écart 17). Prono 30–10 (écart 20) → bon vainqueur, écart à 3 près
          → 5 pts. Prono 25–20 → 3 pts. Prono 32–15 → 10 pts, 20 avec le booster.
        </p>
        <p className="muted small">
          Les pronos des autres joueurs deviennent visibles au coup d’envoi. Le booster peut être déplacé tant que le
          match boosté n’a pas commencé. En cas d’égalité au classement : nombre de scores exacts, puis de bons pronos.
        </p>
      </div>

      <div className="card form">
        <h2>Mon compte</h2>
        <label>
          Pseudo
          <input value={pseudo} minLength={2} maxLength={20} onChange={(e) => setPseudo(e.target.value)} />
        </label>
        <button className="btn" onClick={savePseudo} disabled={pseudo.trim() === profile.pseudo || pseudo.trim().length < 2}>
          Changer de pseudo
        </button>
        {msg && <p className={msg.ok ? 'info' : 'error'}>{msg.text}</p>}
        <button className="btn danger" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      </div>
    </div>
  )
}
