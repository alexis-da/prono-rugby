import { useEffect, useMemo, useState } from 'react'
import { niceError, supabase, type LeaderRow, type PredictionPoints, type Profile } from '../supabase'

interface Row {
  user_id: string
  pseudo: string
  total: number
  good: number
  exact: number
}

export default function ClassementPage({ profile }: { profile: Profile }) {
  const [general, setGeneral] = useState<LeaderRow[]>([])
  const [preds, setPreds] = useState<PredictionPoints[]>([])
  const [scope, setScope] = useState<'general' | number>('general')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('leaderboard').select('*'),
      supabase.from('prediction_points').select('*').not('points', 'is', null),
    ]).then(([l, p]) => {
      const err = l.error ?? p.error
      if (err) setError(niceError(err))
      setGeneral(l.data ?? [])
      setPreds(p.data ?? [])
      setLoading(false)
    })
  }, [])

  const rows: Row[] = useMemo(() => {
    let list: Row[]
    if (scope === 'general') {
      list = general.map((g) => ({
        user_id: g.user_id, pseudo: g.pseudo, total: g.total, good: g.good_results, exact: g.exact_scores,
      }))
    } else {
      list = general.map((g) => {
        const mine = preds.filter((p) => p.user_id === g.user_id && p.round === scope)
        return {
          user_id: g.user_id,
          pseudo: g.pseudo,
          total: mine.reduce((s, p) => s + (p.points ?? 0), 0),
          good: mine.filter((p) => p.good).length,
          exact: mine.filter((p) => p.exact).length,
        }
      })
    }
    return list.sort((a, b) => b.total - a.total || b.exact - a.exact || b.good - a.good || a.pseudo.localeCompare(b.pseudo))
  }, [general, preds, scope])

  const playedRounds = [...new Set(preds.map((p) => p.round))].sort()

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="round-tabs">
        <button className={scope === 'general' ? 'active' : ''} onClick={() => setScope('general')}>Général</button>
        {playedRounds.map((r) => (
          <button key={r} className={scope === r ? 'active' : ''} onClick={() => setScope(r)}>J{r}</button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <table className="leaderboard">
        <thead>
          <tr>
            <th>#</th>
            <th>Joueur</th>
            <th title="Bons pronos">✓</th>
            <th title="Scores exacts">🎯</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const rank = i > 0 && rows[i - 1].total === r.total ? null : i + 1
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank
            return (
              <tr key={r.user_id} className={r.user_id === profile.id ? 'me-row' : ''}>
                <td className="rank">{r.total > 0 ? medal : rank}</td>
                <td>{r.pseudo}</td>
                <td>{r.good}</td>
                <td>{r.exact}</td>
                <td className="total">{r.total}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {scope === 'general' && (
        <p className="muted small">Le général inclut les points des pronos bonus (vainqueur et cuillère de bois).</p>
      )}
    </div>
  )
}
