import { useCallback, useEffect, useMemo, useState } from 'react'
import MatchCard from '../components/MatchCard'
import { niceError, supabase, type Booster, type Match, type PredictionPoints, type Profile } from '../supabase'
import { formatDate } from '../teams'
import { useNow } from '../useNow'

const ROUNDS = [1, 2, 3, 4, 5]

export default function PronosPage({ profile }: { profile: Profile }) {
  const now = useNow()
  const [matches, setMatches] = useState<Match[]>([])
  const [preds, setPreds] = useState<PredictionPoints[]>([])
  const [boosters, setBoosters] = useState<Booster[]>([])
  const [pseudos, setPseudos] = useState<Record<string, string>>({})
  const [round, setRound] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [m, p, b, pr] = await Promise.all([
      supabase.from('matches').select('*').order('kickoff'),
      supabase.from('prediction_points').select('*'),
      supabase.from('boosters').select('*'),
      supabase.from('profiles').select('id, pseudo'),
    ])
    const err = m.error ?? p.error ?? b.error ?? pr.error
    if (err) setError(niceError(err))
    setMatches(m.data ?? [])
    setPreds(p.data ?? [])
    setBoosters(b.data ?? [])
    setPseudos(Object.fromEntries((pr.data ?? []).map((x) => [x.id, x.pseudo])))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Par défaut : la première journée qui a encore un match à venir.
  useEffect(() => {
    if (round !== null || matches.length === 0) return
    const next = matches.find((x) => new Date(x.kickoff).getTime() > Date.now())
    setRound(next?.round ?? matches[matches.length - 1].round)
  }, [matches, round])

  const roundMatches = useMemo(() => matches.filter((x) => x.round === round), [matches, round])

  const byDay = useMemo(() => {
    const groups: { day: string; items: Match[] }[] = []
    for (const m of roundMatches) {
      const day = formatDate(m.kickoff)
      const last = groups[groups.length - 1]
      if (last && last.day === day) last.items.push(m)
      else groups.push({ day, items: [m] })
    }
    return groups
  }, [roundMatches])

  const myBooster = boosters.find((b) => b.user_id === profile.id && b.round === round)
  const myBoosterMatch = matches.find((m) => m.id === myBooster?.match_id)
  const boosterLocked = myBoosterMatch ? new Date(myBoosterMatch.kickoff).getTime() <= now : false

  const roundPoints = preds
    .filter((p) => p.user_id === profile.id && p.round === round && p.points != null)
    .reduce((s, p) => s + (p.points ?? 0), 0)
  const toPlay = roundMatches.filter(
    (m) => new Date(m.kickoff).getTime() > now && !preds.some((p) => p.match_id === m.id && p.user_id === profile.id),
  ).length

  async function save(match: Match, home: number, away: number) {
    const { error } = await supabase
      .from('predictions')
      .upsert({ user_id: profile.id, match_id: match.id, home_score: home, away_score: away })
    if (error) return niceError(error)
    await load()
    return null
  }

  async function toggleBoost(match: Match) {
    const isOn = myBooster?.match_id === match.id
    const { error } = isOn
      ? await supabase.from('boosters').delete().eq('user_id', profile.id).eq('round', match.round)
      : await supabase
          .from('boosters')
          .upsert({ user_id: profile.id, round: match.round, match_id: match.id }, { onConflict: 'user_id,round' })
    if (error) return niceError(error)
    await load()
    return null
  }

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="round-tabs" role="tablist">
        {ROUNDS.map((r) => (
          <button key={r} className={round === r ? 'active' : ''} onClick={() => setRound(r)} role="tab">
            J{r}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {matches.length === 0 ? (
        <div className="empty">Aucun match pour l’instant. L’admin doit ajouter le calendrier.</div>
      ) : (
        <>
          <div className="round-summary">
            <span>Journée {round}</span>
            <span>
              {toPlay > 0 && <span className="pill warn">{toPlay} prono{toPlay > 1 ? 's' : ''} à faire</span>}{' '}
              <strong>{roundPoints} pts</strong>
            </span>
          </div>

          {byDay.map((g) => (
            <section key={g.day}>
              <h2 className="day-title">{g.day}</h2>
              {g.items.map((m) => {
                const isBoosted = myBooster?.match_id === m.id
                return (
                  <MatchCard
                    key={m.id}
                    match={m}
                    now={now}
                    mine={preds.find((p) => p.match_id === m.id && p.user_id === profile.id)}
                    boosted={isBoosted}
                    boostBlocked={
                      boosterLocked && !isBoosted ? 'Ton booster de la journée est déjà joué' : null
                    }
                    others={preds
                      .filter((p) => p.match_id === m.id && p.user_id !== profile.id)
                      .map((p) => ({ ...p, pseudo: pseudos[p.user_id] ?? '?' }))}
                    onSave={(h, a) => save(m, h, a)}
                    onToggleBoost={() => toggleBoost(m)}
                  />
                )
              })}
            </section>
          ))}
        </>
      )}
    </div>
  )
}
