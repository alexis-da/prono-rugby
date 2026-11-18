import { useCallback, useEffect, useState, type FormEvent } from 'react'
import TeamBadge from '../components/TeamBadge'
import { niceError, supabase, type Match, type TeamCode } from '../supabase'
import { TEAMS, TEAM_CODES, formatDate, formatTime } from '../teams'

/** Date ISO -> valeur pour <input type="datetime-local"> en heure locale */
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ScoreRow({ match, onChanged }: { match: Match; onChanged: () => void }) {
  const [h, setH] = useState(match.home_score?.toString() ?? '')
  const [a, setA] = useState(match.away_score?.toString() ?? '')
  const [kickoff, setKickoff] = useState(toLocalInput(match.kickoff))
  const [edit, setEdit] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveScore() {
    const both = h !== '' && a !== ''
    const { error } = await supabase
      .from('matches')
      .update({ home_score: both ? Number(h) : null, away_score: both ? Number(a) : null })
      .eq('id', match.id)
    setError(error ? niceError(error) : null)
    if (!error) onChanged()
  }

  async function saveKickoff() {
    const { error } = await supabase
      .from('matches')
      .update({ kickoff: new Date(kickoff).toISOString() })
      .eq('id', match.id)
    setError(error ? niceError(error) : null)
    if (!error) {
      setEdit(false)
      onChanged()
    }
  }

  async function remove() {
    if (!confirm(`Supprimer ${TEAMS[match.home].name} – ${TEAMS[match.away].name} et tous ses pronos ?`)) return
    const { error } = await supabase.from('matches').delete().eq('id', match.id)
    setError(error ? niceError(error) : null)
    if (!error) onChanged()
  }

  const changed = h !== (match.home_score?.toString() ?? '') || a !== (match.away_score?.toString() ?? '')

  return (
    <div className="admin-row">
      <div className="admin-row-head">
        <span>J{match.round} · {formatDate(match.kickoff)} · {formatTime(match.kickoff)}</span>
        <span>
          <button className="link small" onClick={() => setEdit((e) => !e)}>Horaire</button>
          <button className="link small danger" onClick={remove}>Supprimer</button>
        </span>
      </div>
      {edit && (
        <div className="inline-form">
          <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
          <button className="btn" onClick={saveKickoff}>OK</button>
        </div>
      )}
      <div className="admin-score">
        <TeamBadge team={match.home} size={32} />
        <input inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ''))} placeholder="–" />
        <span>–</span>
        <input inputMode="numeric" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} placeholder="–" />
        <TeamBadge team={match.away} size={32} />
        <button className="btn primary" disabled={!changed || (h === '') !== (a === '')} onClick={saveScore}>
          {changed ? 'Valider' : match.home_score !== null ? '✓' : 'Score'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [result, setResult] = useState<{ winner: TeamCode | ''; wooden_spoon: TeamCode | '' }>({ winner: '', wooden_spoon: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [form, setForm] = useState({ round: '1', kickoff: '', home: 'FRA' as TeamCode, away: 'ENG' as TeamCode, venue: '' })

  const load = useCallback(async () => {
    const [m, r] = await Promise.all([
      supabase.from('matches').select('*').order('kickoff'),
      supabase.from('tournament_results').select('winner, wooden_spoon').maybeSingle(),
    ])
    setMatches(m.data ?? [])
    if (r.data) setResult({ winner: r.data.winner ?? '', wooden_spoon: r.data.wooden_spoon ?? '' })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addMatch(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('matches').insert({
      round: Number(form.round),
      kickoff: new Date(form.kickoff).toISOString(),
      home: form.home,
      away: form.away,
      venue: form.venue.trim() || null,
    })
    setMsg(error ? { ok: false, text: niceError(error) } : { ok: true, text: 'Match ajouté ✓' })
    if (!error) load()
  }

  async function saveResult() {
    const { error } = await supabase
      .from('tournament_results')
      .update({ winner: result.winner || null, wooden_spoon: result.wooden_spoon || null })
      .eq('id', 1)
    setMsg(error ? { ok: false, text: niceError(error) } : { ok: true, text: 'Résultat final enregistré ✓' })
  }

  return (
    <div className="page">
      <div className="card">
        <h2>Scores des matchs</h2>
        <p className="muted small">Saisis le score final : les points sont calculés immédiatement.</p>
        {matches.length === 0 && <p className="muted">Aucun match. Ajoute-les ci-dessous ou importe le calendrier (voir README).</p>}
        {matches.map((m) => <ScoreRow key={`${m.id}-${m.kickoff}-${m.home_score}-${m.away_score}`} match={m} onChanged={load} />)}
      </div>

      <form className="card form" onSubmit={addMatch}>
        <h2>Ajouter un match</h2>
        <div className="grid2">
          <label>
            Journée
            <select value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })}>
              {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>J{r}</option>)}
            </select>
          </label>
          <label>
            Coup d’envoi (heure locale)
            <input type="datetime-local" required value={form.kickoff} onChange={(e) => setForm({ ...form, kickoff: e.target.value })} />
          </label>
          <label>
            Domicile
            <select value={form.home} onChange={(e) => setForm({ ...form, home: e.target.value as TeamCode })}>
              {TEAM_CODES.map((c) => <option key={c} value={c}>{TEAMS[c].name}</option>)}
            </select>
          </label>
          <label>
            Extérieur
            <select value={form.away} onChange={(e) => setForm({ ...form, away: e.target.value as TeamCode })}>
              {TEAM_CODES.map((c) => <option key={c} value={c}>{TEAMS[c].name}</option>)}
            </select>
          </label>
        </div>
        <label>
          Stade (optionnel)
          <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
        </label>
        <button className="btn primary" disabled={form.home === form.away}>Ajouter</button>
      </form>

      <div className="card form">
        <h2>Classement final du Tournoi</h2>
        <p className="muted small">À remplir à la fin du Tournoi pour attribuer les points bonus.</p>
        <div className="grid2">
          <label>
            Vainqueur
            <select value={result.winner} onChange={(e) => setResult({ ...result, winner: e.target.value as TeamCode })}>
              <option value="">—</option>
              {TEAM_CODES.map((c) => <option key={c} value={c}>{TEAMS[c].name}</option>)}
            </select>
          </label>
          <label>
            Cuillère de bois
            <select value={result.wooden_spoon} onChange={(e) => setResult({ ...result, wooden_spoon: e.target.value as TeamCode })}>
              <option value="">—</option>
              {TEAM_CODES.map((c) => <option key={c} value={c}>{TEAMS[c].name}</option>)}
            </select>
          </label>
        </div>
        <button className="btn primary" onClick={saveResult}>Enregistrer</button>
      </div>

      {msg && <p className={msg.ok ? 'info' : 'error'}>{msg.text}</p>}
    </div>
  )
}
