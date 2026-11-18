import { useEffect, useState } from 'react'
import type { Match, PredictionInput, PredictionPoints } from '../supabase'
import { TEAMS, formatTime, timeLeft } from '../teams'
import TeamBadge from './TeamBadge'

interface Props {
  match: Match
  now: number
  mine?: PredictionPoints
  boosted: boolean
  /** null = booster utilisable ici ; sinon raison pour laquelle on ne peut pas le poser */
  boostBlocked: string | null
  others: (PredictionPoints & { pseudo: string })[]
  onSave: (p: PredictionInput) => Promise<string | null>
  onToggleBoost: () => Promise<string | null>
}

const FIELDS = ['home_score', 'away_score', 'home_tries', 'away_tries', 'home_yellows', 'away_yellows'] as const
type Field = (typeof FIELDS)[number]
type Form = Record<Field, string>

const toForm = (p?: PredictionPoints): Form =>
  Object.fromEntries(FIELDS.map((f) => [f, p?.[f] == null ? '' : String(p[f])])) as Form

const digits = (v: string, max: number) => v.replace(/[^0-9]/g, '').slice(0, max)

const pair = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? '–' : `${a} – ${b}`

export default function MatchCard({ match, now, mine, boosted, boostBlocked, others, onSave, onToggleBoost }: Props) {
  const started = new Date(match.kickoff).getTime() <= now
  const finished = match.status === 'final'
  const live = match.status === 'live'
  const [form, setForm] = useState<Form>(() => toForm(mine))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOthers, setShowOthers] = useState(false)

  const saved = toForm(mine)
  const savedKey = JSON.stringify(saved)
  useEffect(() => {
    setForm(JSON.parse(savedKey))
  }, [savedKey])

  const dirty = FIELDS.some((f) => form[f] !== saved[f])
  const valid = form.home_score !== '' && form.away_score !== ''
  const set = (f: Field, max: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [f]: digits(e.target.value, max) })
  const num = (v: string) => (v === '' ? null : Number(v))

  async function save() {
    setBusy(true)
    setError(
      await onSave({
        home_score: Number(form.home_score),
        away_score: Number(form.away_score),
        home_tries: num(form.home_tries),
        away_tries: num(form.away_tries),
        home_yellows: num(form.home_yellows),
        away_yellows: num(form.away_yellows),
      }),
    )
    setBusy(false)
  }
  async function toggleBoost() {
    setBusy(true)
    setError(await onToggleBoost())
    setBusy(false)
  }

  const home = TEAMS[match.home].name
  const away = TEAMS[match.away].name

  return (
    <article className={`match-card${boosted ? ' boosted' : ''}`}>
      <div className="match-meta">
        <span>{formatTime(match.kickoff)}{match.venue ? ` · ${match.venue}` : ''}</span>
        {finished ? (
          <span className="pill done">Terminé</span>
        ) : live ? (
          <span className="pill live"><span className="live-dot" aria-hidden /> En direct · {match.live_clock ?? ''}</span>
        ) : started ? (
          <span className="pill live">En cours</span>
        ) : (
          <span className="pill open">Ferme dans {timeLeft(match.kickoff, now)}</span>
        )}
      </div>

      <div className="match-row">
        <div className="team">
          <TeamBadge team={match.home} />
          <span className="team-name">{home}</span>
        </div>
        <div className="score-zone">
          {started ? (
            finished || live ? (
              <div className={`final-score${live ? ' is-live' : ''}`}>{match.home_score} <span>–</span> {match.away_score}</div>
            ) : (
              <div className="final-score pending">vs</div>
            )
          ) : (
            <div className="inputs">
              <input inputMode="numeric" aria-label={`Score ${home}`} value={form.home_score} onChange={set('home_score', 3)} placeholder="–" />
              <span>–</span>
              <input inputMode="numeric" aria-label={`Score ${away}`} value={form.away_score} onChange={set('away_score', 3)} placeholder="–" />
            </div>
          )}
        </div>
        <div className="team right">
          <TeamBadge team={match.away} />
          <span className="team-name">{away}</span>
        </div>
      </div>

      {!started && (
        <div className="extras">
          <input inputMode="numeric" aria-label={`Essais ${home}`} value={form.home_tries} onChange={set('home_tries', 2)} placeholder="–" />
          <span className="extras-label">Essais</span>
          <input inputMode="numeric" aria-label={`Essais ${away}`} value={form.away_tries} onChange={set('away_tries', 2)} placeholder="–" />
          <input inputMode="numeric" aria-label={`Cartons jaunes ${home}`} value={form.home_yellows} onChange={set('home_yellows', 2)} placeholder="–" />
          <span className="extras-label"><span className="yellow-card" aria-hidden /> Cartons jaunes</span>
          <input inputMode="numeric" aria-label={`Cartons jaunes ${away}`} value={form.away_yellows} onChange={set('away_yellows', 2)} placeholder="–" />
        </div>
      )}

      {!started && (
        <div className="match-actions">
          <button
            className={`btn boost${boosted ? ' on' : ''}`}
            onClick={toggleBoost}
            disabled={busy || (!boosted && boostBlocked !== null)}
            title={boostBlocked ?? 'Double tous les points de ce match'}
          >
            ⚡ {boosted ? 'Boosté ×2' : 'Booster'}
          </button>
          <button className="btn primary" onClick={save} disabled={busy || !valid || !dirty}>
            {mine && !dirty ? 'Enregistré ✓' : 'Valider'}
          </button>
        </div>
      )}

      {started && (
        <div className="recap">
          <table>
            <thead>
              <tr><th /><th>Mon prono{boosted ? ' ⚡' : ''}</th>{(finished || live) && <th>{live ? 'En direct' : 'Réel'}</th>}</tr>
            </thead>
            <tbody>
              <tr>
                <td>Score</td>
                <td>{mine ? pair(mine.home_score, mine.away_score) : <em>aucun</em>}</td>
                {(finished || live) && <td>{pair(match.home_score, match.away_score)}</td>}
              </tr>
              <tr>
                <td>Essais</td>
                <td>{pair(mine?.home_tries, mine?.away_tries)}</td>
                {(finished || live) && <td>{pair(match.home_tries, match.away_tries)}</td>}
              </tr>
              <tr>
                <td>Cartons jaunes</td>
                <td>{pair(mine?.home_yellows, mine?.away_yellows)}</td>
                {(finished || live) && <td>{pair(match.home_yellows, match.away_yellows)}</td>}
              </tr>
            </tbody>
          </table>
          {mine?.points != null && (
            <span className={`points${mine.points > 0 ? ' plus' : ''}${live ? ' provisional' : ''}`}>
              {mine.points > 0 ? `+${mine.points}` : '0'} pt{mine.points > 1 ? 's' : ''}
              {live && <small>provisoire</small>}
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
                    <span className="other-pick">
                      <strong>{pair(o.home_score, o.away_score)}</strong>
                      <small>Essais {pair(o.home_tries, o.away_tries)} · 🟨 {pair(o.home_yellows, o.away_yellows)}</small>
                    </span>
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
