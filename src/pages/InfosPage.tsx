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
        <p>
          Pour chaque match, pronostique le score et, si tu veux, le nombre d’essais et de cartons jaunes de chaque
          équipe. Tu peux tout modifier jusqu’au coup d’envoi.
        </p>
        <table className="scale">
          <tbody>
            <tr><td>Bon vainqueur (ou match nul)</td><td>3 pts</td></tr>
            <tr><td>+ écart de points à 5 près</td><td>+2 pts</td></tr>
            <tr><td>+ score exact</td><td>+5 pts</td></tr>
            <tr><td>Nombre d’essais exact (par équipe)</td><td>+2 pts</td></tr>
            <tr><td>Nombre de cartons jaunes exact (par équipe)</td><td>+1 pt</td></tr>
            <tr><td>⚡ Booster : 1 seul match dans tout le Tournoi</td><td>×2</td></tr>
            <tr><td>Bonus : vainqueur du Tournoi</td><td>10 pts</td></tr>
            <tr><td>Bonus : cuillère de bois</td><td>5 pts</td></tr>
          </tbody>
        </table>
        <p className="muted small">
          Exemple : France–Galles se termine 32–15, 4 essais à 2, 1 carton jaune à 0. Prono 30–10 avec 4–1 essais et
          1–0 cartons → bon vainqueur et écart à 3 près (5) + essais France (2) + cartons (1 + 1) = 9 pts, 18 avec le
          booster. Les essais et cartons rapportent des points même si le vainqueur est faux. Maximum par match :
          16 pts (32 boosté).
        </p>
        <p className="muted small">
          Pendant les matchs, le score, les essais, les cartons et tes points s’affichent en direct (provisoires,
          mis à jour toutes les 30 s) ; ils deviennent définitifs au coup de sifflet final. Les pronos des autres
          joueurs deviennent visibles au coup d’envoi. Le booster peut être déplacé tant que le
          match boosté n’a pas commencé ; ensuite il est consommé. En cas d’égalité au classement : nombre de scores
          exacts, puis de bons vainqueurs.
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
