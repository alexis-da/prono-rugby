import { useCallback, useEffect, useMemo, useState } from 'react'
import MatchCard from '../components/MatchCard'
import {
  niceError, supabase, type Booster, type Match, type PredictionInput, type PredictionPoints, type Profile,
} from '../supabase'
import { TEAMS, formatDate } from '../teams'
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

  // Pendant un match (ou juste après le coup d'envoi), on rafraîchit toutes les 30 s.
  const hasLive = matches.some((m) => {
    const k = new Date(m.kickoff).getTime()
    return m.status === 'live' || (m.status === 'scheduled' && k <= now && k > now - 3 * 3600_000)
  })
  useEffect(() => {
    if (!hasLive) return
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [hasLive, load])

  // Par défaut : la première journée qui a encore un match à venir.
  useEffect(() => {
    if (round !== null || matches.length === 0) return
    const next = matches.find((x) => x.status === 'live' || new Date(x.kickoff).getTime() > Date.now())
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

  // Un seul booster pour tout le Tournoi
  const myBooster = boosters.find((b) => b.user_id === profile.id)
  const myBoosterMatch = matches.find((m) => m.id === myBooster?.match_id)
  const boosterLocked = myBoosterMatch ? new Date(myBoosterMatch.kickoff).getTime() <= now : false
  const boosterLabel = myBoosterMatch
    ? `${TEAMS[myBoosterMatch.home].name} – ${TEAMS[myBoosterMatch.away].name} (J${myBoosterMatch.round})`
    : null

  const roundPreds = preds.filter((p) => p.user_id === profile.id && p.round === round && p.points != null)
  const roundPoints = roundPreds.reduce((s, p) => s + (p.points ?? 0), 0)
  const roundLive = roundPreds.some((p) => p.provisional)
  const toPlay = roundMatches.filter(
    (m) => new Date(m.kickoff).getTime() > now && !preds.some((p) => p.match_id === m.id && p.user_id === profile.id),
  ).length

  async function save(match: Match, p: PredictionInput) {
    const { error } = await supabase
      .from('predictions')
      .upsert({ user_id: profile.id, match_id: match.id, ...p })
    if (error) return niceError(error)
    await load()
    return null
  }

  async function toggleBoost(match: Match) {
    const isOn = myBooster?.match_id === match.id
    if (!isOn && boosterLabel && !confirm(`Déplacer ton booster depuis ${boosterLabel} ?`)) return null
    const { error } = isOn
      ? await supabase.from('boosters').delete().eq('user_id', profile.id)
      : await supabase
          .from('boosters')
          .upsert({ user_id: profile.id, match_id: match.id }, { onConflict: 'user_id' })
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
          <div className={`booster-banner${boosterLocked ? ' used' : myBooster ? ' placed' : ''}`}>
            ⚡{' '}
            {boosterLocked
              ? <>Booster utilisé sur <strong>{boosterLabel}</strong></>
              : myBooster
                ? <>Booster placé sur <strong>{boosterLabel}</strong> — déplaçable jusqu’au coup d’envoi</>
                : <>Booster ×2 disponible : <strong>1 seul pour tout le Tournoi</strong></>}
          </div>

          <div className="round-summary">
            <span>Journée {round}</span>
            <span>
              {toPlay > 0 && <span className="pill warn">{toPlay} prono{toPlay > 1 ? 's' : ''} à faire</span>}{' '}
              <strong>{roundPoints} pts{roundLive && <span className="live-dot" title="Points provisoires (match en cours)" />}</strong>
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
                    boostBlocked={boosterLocked && !isBoosted ? 'Ton booster est déjà utilisé' : null}
                    others={preds
                      .filter((p) => p.match_id === m.id && p.user_id !== profile.id)
                      .map((p) => ({ ...p, pseudo: pseudos[p.user_id] ?? '?' }))}
                    onSave={(p) => save(m, p)}
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
