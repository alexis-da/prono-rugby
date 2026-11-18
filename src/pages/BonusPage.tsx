import { useEffect, useState } from 'react'
import TeamBadge from '../components/TeamBadge'
import { niceError, supabase, type Profile, type TeamCode } from '../supabase'
import { TEAMS, TEAM_CODES, formatDate, formatTime } from '../teams'
import { useNow } from '../useNow'

interface BonusRow {
  user_id: string
  winner: TeamCode | null
  wooden_spoon: TeamCode | null
}

export default function BonusPage({ profile }: { profile: Profile }) {
  const now = useNow()
  const [lockAt, setLockAt] = useState<string | null>(null)
  const [rows, setRows] = useState<BonusRow[]>([])
  const [pseudos, setPseudos] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ winner: TeamCode | null; wooden_spoon: TeamCode | null } | null>(null)
  const [winner, setWinner] = useState<TeamCode | ''>('')
  const [spoon, setSpoon] = useState<TeamCode | ''>('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.rpc('bonus_lock_at'),
      supabase.from('bonus_predictions').select('user_id, winner, wooden_spoon'),
      supabase.from('profiles').select('id, pseudo'),
      supabase.from('tournament_results').select('winner, wooden_spoon').maybeSingle(),
    ]).then(([l, b, p, r]) => {
      setLockAt(typeof l.data === 'string' && l.data !== 'infinity' ? l.data : null)
      setRows(b.data ?? [])
      setPseudos(Object.fromEntries((p.data ?? []).map((x) => [x.id, x.pseudo])))
      setResult(r.data)
      const mine = (b.data ?? []).find((x) => x.user_id === profile.id)
      setWinner(mine?.winner ?? '')
      setSpoon(mine?.wooden_spoon ?? '')
      setLoading(false)
    })
  }, [profile.id])

  const locked = lockAt !== null && new Date(lockAt).getTime() <= now

  async function save() {
    const { error } = await supabase.from('bonus_predictions').upsert({
      user_id: profile.id,
      winner: winner || null,
      wooden_spoon: spoon || null,
    })
    setMsg(error ? { ok: false, text: niceError(error) } : { ok: true, text: 'Enregistré ✓' })
  }

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="card">
        <h2>Pronos bonus</h2>
        <p className="muted">
          Vainqueur du Tournoi : <strong>10 pts</strong> · Cuillère de bois (dernier) : <strong>5 pts</strong>
          <br />
          {lockAt
            ? locked
              ? 'Fermé depuis le premier coup d’envoi.'
              : `Modifiable jusqu’au ${formatDate(lockAt).toLowerCase()} à ${formatTime(lockAt)}.`
            : 'Ouvert jusqu’au premier match.'}
        </p>

        <div className="form">
          <label>
            Vainqueur du Tournoi
            <select value={winner} disabled={locked} onChange={(e) => setWinner(e.target.value as TeamCode)}>
              <option value="">—</option>
              {TEAM_CODES.map((c) => <option key={c} value={c}>{TEAMS[c].name}</option>)}
            </select>
          </label>
          <label>
            Cuillère de bois
            <select value={spoon} disabled={locked} onChange={(e) => setSpoon(e.target.value as TeamCode)}>
              <option value="">—</option>
              {TEAM_CODES.map((c) => <option key={c} value={c}>{TEAMS[c].name}</option>)}
            </select>
          </label>
          {!locked && (
            <button className="btn primary" onClick={save} disabled={!winner && !spoon}>Valider</button>
          )}
          {msg && <p className={msg.ok ? 'info' : 'error'}>{msg.text}</p>}
        </div>
      </div>

      {(result?.winner || result?.wooden_spoon) && (
        <div className="card">
          <h2>Résultat final</h2>
          {result.winner && <p className="team-line"><TeamBadge team={result.winner} size={28} /> Vainqueur : {TEAMS[result.winner].name}</p>}
          {result.wooden_spoon && <p className="team-line"><TeamBadge team={result.wooden_spoon} size={28} /> Cuillère de bois : {TEAMS[result.wooden_spoon].name}</p>}
        </div>
      )}

      {locked && (
        <div className="card">
          <h2>Les choix de la ligue</h2>
          <table className="leaderboard">
            <thead><tr><th>Joueur</th><th>Vainqueur</th><th>Cuillère</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className={r.user_id === profile.id ? 'me-row' : ''}>
                  <td>{pseudos[r.user_id] ?? '?'}</td>
                  <td>{r.winner ? TEAMS[r.winner].name : '—'}</td>
                  <td>{r.wooden_spoon ? TEAMS[r.wooden_spoon].name : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
