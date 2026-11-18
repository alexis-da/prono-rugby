import { useEffect, useState } from 'react'
import type { Match, PredictionPoints } from '../supabase'
import { TEAMS, formatTime, timeLeft } from '../teams'
import TeamBadge from './TeamBadge'

interface Props {
  match: Match
  now: number
  mine?: PredictionPoints
  boosted: boolean
  /** null = booster disponible ; sinon raison pour laquelle on ne peut pas le poser ici */
  boostBlocked: string | null
  others: (PredictionPoints & { pseudo: string })[]
  onSave: (home: number, away: number) => Promise<string | null>
  onToggleBoost: () => Promise<string | null>
}

function scoreInput(v: string) {
  return v.replace(/[^0-9]/g, '').slice(0, 3)
}

export default function MatchCard({ match, now, mine, boosted, boostBlocked, others, onSave, onToggleBoost }: Props) {
  const started = new Date(match.kickoff).getTime() <= now
  const finished = match.home_score !== null
  const [home, setHome] = useState(mine ? String(mine.home_score) : '')
  const [away, setAway] = useState(mine ? String(mine.away_score) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOthers, setShowOthers] = useState(false)

  useEffect(() => {
    setHome(mine ? String(mine.home_score) : '')
    setAway(mine ? String(mine.away_score) : '')
  }, [mine?.home_score, mine?.away_score])

  const dirty = home !== (mine ? String(mine.home_score) : '') || away !== (mine ? String(mine.away_score) : '')
  const valid = home !== '' && away !== ''

  async function save() {
    setBusy(true)
    setError(await onSave(Number(home), Number(away)))
    setBusy(false)
  }
  async function toggleBoost() {
    setBusy(true)
    setError(await onToggleBoost())
    setBusy(false)
  }

  const left = timeLeft(match.kickoff, now)

  return (
    <article className={`match-card${boosted ? ' boosted' : ''}`}>
      <div className="match-meta">
        <span>{formatTime(match.kickoff)}{match.venue ? ` · ${match.venue}` : ''}</span>
        {finished ? (
          <span className="pill done">Terminé</span>
        ) : started ? (
          <span className="pill live">En cours</span>
        ) : (
          <span className="pill open">Ferme dans {left}</span>
        )}
      </div>

      <div className="match-row">
        <div className="team">
          <TeamBadge team={match.home} />
          <span className="team-name">{TEAMS[match.home].name}</span>
        </div>

        <div className="score-zone">
          {started ? (
            finished ? (
              <div className="final-score">
                {match.home_score} <span>–</span> {match.away_score}
              </div>
            ) : (
              <div className="final-score pending">vs</div>
            )
          ) : (
            <div className="inputs">
              <input
                inputMode="numeric"
                aria-label={`Score ${TEAMS[match.home].name}`}
                value={home}
                onChange={(e) => setHome(scoreInput(e.target.value))}
                placeholder="–"
              />
              <span>–</span>
              <input
                inputMode="numeric"
                aria-label={`Score ${TEAMS[match.away].name}`}
                value={away}
                onChange={(e) => setAway(scoreInput(e.target.value))}
                placeholder="–"
              />
            </div>
          )}
        </div>

        <div className="team right">
          <TeamBadge team={match.away} />
          <span className="team-name">{TEAMS[match.away].name}</span>
        </div>
      </div>

      {!started && (
        <div className="match-actions">
          <button
            className={`btn boost${boosted ? ' on' : ''}`}
            onClick={toggleBoost}
            disabled={busy || (!boosted && boostBlocked !== null)}
            title={boostBlocked ?? 'Double les points de ce match'}
          >
            ⚡ {boosted ? 'Boosté ×2' : 'Booster'}
          </button>
          <button className="btn primary" onClick={save} disabled={busy || !valid || !dirty}>
            {mine && !dirty ? 'Enregistré ✓' : 'Valider'}
          </button>
        </div>
      )}

      {started && (
        <div className="my-result">
          <span>
            Mon prono :{' '}
            {mine ? <strong>{mine.home_score} – {mine.away_score}</strong> : <em>aucun</em>}
            {boosted && ' ⚡'}
          </span>
          {mine?.points != null && (
            <span className={`points${mine.points > 0 ? ' plus' : ''}`}>
              {mine.points > 0 ? `+${mine.points}` : '0'} pt{mine.points > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {started && others.length > 0 && (
        <>
          <button className="link small" onClick={() => setShowOthers((s) => !s)}>
            {showOthers ? 'Masquer' : 'Voir'} les pronos de la ligue ({others.length})
          </button>
          {showOthers && (
            <ul className="others">
              {others
                .slice()
                .sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || a.pseudo.localeCompare(b.pseudo))
                .map((o) => (
                  <li key={o.user_id}>
                    <span>{o.pseudo}{o.boosted ? ' ⚡' : ''}</span>
                    <span>{o.home_score} – {o.away_score}</span>
                    <span className="pts">{o.points != null ? `${o.points} pts` : ''}</span>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </article>
  )
}
