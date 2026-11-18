import type { TeamCode } from '../supabase'
import { TEAMS } from '../teams'

export default function TeamBadge({ team, size = 40 }: { team: TeamCode; size?: number }) {
  const t = TEAMS[team]
  return (
    <span
      className="team-badge"
      style={{ background: t.color, color: t.text, width: size, height: size, fontSize: size * 0.3 }}
      title={t.name}
    >
      {t.short}
    </span>
  )
}
