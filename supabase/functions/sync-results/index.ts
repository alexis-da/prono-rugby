// =====================================================================
//  Edge Function Supabase : sync-results
//  Récupère automatiquement les résultats des matchs terminés sur l'API
//  publique d'ESPN (score, essais, cartons jaunes) et les écrit en base.
//
//  - Ne touche jamais un résultat saisi à la main par l'admin (result_source = 'manual').
//  - Repasse sur les matchs des 3 derniers jours pour prendre en compte
//    les corrections tardives d'ESPN.
//  - Fichier autonome, sans dépendance : il peut être collé tel quel dans
//    l'éditeur d'Edge Functions du tableau de bord Supabase.
// =====================================================================

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/rugby/180659' // 180659 = Six Nations
const ESPN_TEAMS: Record<string, string> = { FRA: 'FRA', ENG: 'ENG', IRE: 'IRL', IRL: 'IRL', SCO: 'SCO', WAL: 'WAL', ITA: 'ITA' }
const WAIT_AFTER_KICKOFF_MIN = 100 // on ne cherche le résultat qu'1h40 après le coup d'envoi
const LOOKBACK_DAYS = 3
const MIN_INTERVAL_MS = 60_000 // anti-spam : au plus une synchro par minute

type Fetch = typeof fetch

interface DbMatch {
  id: number
  kickoff: string
  home: string
  away: string
  result_source: 'auto' | 'manual' | null
}

export interface SyncOptions {
  supabaseUrl: string
  serviceKey: string
  now?: Date
  force?: boolean
  fetchFn?: Fetch
}

export interface SyncResult {
  skipped?: boolean
  checked: number
  updated: number
  messages: string[]
}

function restClient(url: string, key: string, fetchFn: Fetch) {
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' }
  // Clé "service_role" historique (JWT) : à passer aussi en Authorization.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`
  return {
    async get<T>(path: string): Promise<T> {
      const r = await fetchFn(`${url}/rest/v1/${path}`, { headers })
      if (!r.ok) throw new Error(`GET ${path} : ${r.status} ${await r.text()}`)
      return r.json()
    },
    async patch(path: string, body: unknown) {
      const r = await fetchFn(`${url}/rest/v1/${path}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(`PATCH ${path} : ${r.status} ${await r.text()}`)
    },
  }
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

// deno-lint-ignore no-explicit-any
type Json = any

export async function syncResults(opts: SyncOptions): Promise<SyncResult> {
  const fetchFn = opts.fetchFn ?? fetch
  const now = opts.now ?? new Date()
  const db = restClient(opts.supabaseUrl, opts.serviceKey, fetchFn)
  const messages: string[] = []

  const [status] = await db.get<{ last_run_at: string | null }[]>('sync_status?select=last_run_at&id=eq.1')
  if (!opts.force && status?.last_run_at && Date.now() - new Date(status.last_run_at).getTime() < MIN_INTERVAL_MS) {
    return { skipped: true, checked: 0, updated: 0, messages: ['Synchro déjà lancée il y a moins d’une minute'] }
  }

  const from = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString()
  const to = new Date(now.getTime() - WAIT_AFTER_KICKOFF_MIN * 60_000).toISOString()
  const matches = await db.get<DbMatch[]>(
    `matches?select=id,kickoff,home,away,result_source&kickoff=gte.${encodeURIComponent(from)}&kickoff=lte.${encodeURIComponent(to)}&order=kickoff.asc`,
  )
  const todo = matches.filter((m) => m.result_source !== 'manual')

  const espn = async (path: string): Promise<Json> => {
    const r = await fetchFn(`${ESPN}/${path}`)
    if (!r.ok) throw new Error(`ESPN ${path} : ${r.status}`)
    return r.json()
  }
  const boards = new Map<string, Json[]>()
  const eventsOn = async (day: string) => {
    if (!boards.has(day)) boards.set(day, (await espn(`scoreboard?dates=${day}`)).events ?? [])
    return boards.get(day)!
  }

  let updated = 0
  for (const m of todo) {
    const label = `${m.home}–${m.away}`
    try {
      const k = new Date(m.kickoff)
      const days = [ymd(k), ymd(new Date(k.getTime() - 86_400_000)), ymd(new Date(k.getTime() + 86_400_000))]
      let event: Json = null
      for (const day of days) {
        event = (await eventsOn(day)).find((e: Json) => {
          const codes = e.competitions[0].competitors.map((c: Json) => ESPN_TEAMS[c.team.abbreviation])
          return codes.includes(m.home) && codes.includes(m.away)
        })
        if (event) break
      }
      if (!event) { messages.push(`${label} : introuvable chez ESPN`); continue }
      if (!event.status?.type?.completed) { messages.push(`${label} : pas encore terminé`); continue }

      const score: Record<string, number> = {}
      for (const c of event.competitions[0].competitors) score[ESPN_TEAMS[c.team.abbreviation]] = Number(c.score)

      const summary = await espn(`summary?event=${event.id}`)
      const stats: Record<string, Record<string, string>> = {}
      for (const t of summary.boxscore?.teams ?? []) {
        const code = ESPN_TEAMS[t.team.abbreviation]
        stats[code] = Object.fromEntries(
          (t.statistics?.[0]?.stats ?? []).map((s: Json) => [s.name, s.displayValue]),
        )
      }
      const stat = (team: string, name: string) => {
        const v = Number(stats[team]?.[name])
        return Number.isInteger(v) && v >= 0 ? v : null
      }
      let homeTries = stat(m.home, 'tries')
      let awayTries = stat(m.away, 'tries')
      // Garde-fou : 5 points par essai minimum
      if (homeTries !== null && homeTries * 5 > score[m.home]) homeTries = null
      if (awayTries !== null && awayTries * 5 > score[m.away]) awayTries = null

      if (!Number.isInteger(score[m.home]) || !Number.isInteger(score[m.away])) {
        messages.push(`${label} : score illisible`)
        continue
      }
      // Le filtre or=() protège une saisie manuelle faite pendant la synchro.
      await db.patch(`matches?id=eq.${m.id}&or=(result_source.is.null,result_source.eq.auto)`, {
        home_score: score[m.home],
        away_score: score[m.away],
        home_tries: homeTries,
        away_tries: awayTries,
        home_yellows: stat(m.home, 'yellowCards'),
        away_yellows: stat(m.away, 'yellowCards'),
        result_source: 'auto',
        espn_event_id: String(event.id),
      })
      updated++
      messages.push(`${label} : ${score[m.home]}–${score[m.away]} (essais ${homeTries ?? '?'}–${awayTries ?? '?'}, cartons ${stat(m.home, 'yellowCards') ?? '?'}–${stat(m.away, 'yellowCards') ?? '?'})`)
    } catch (e) {
      messages.push(`${label} : erreur ${(e as Error).message}`)
    }
  }

  if (todo.length === 0) messages.push('Aucun match à synchroniser')
  await db.patch('sync_status?id=eq.1', {
    last_run_at: new Date().toISOString(),
    last_updated: updated,
    last_message: messages.join(' · ').slice(0, 1000),
  })
  return { checked: todo.length, updated, messages }
}

// ---------------------------------------------------------------------
//  Point d'entrée HTTP (exécuté uniquement dans l'environnement Supabase/Deno)
// ---------------------------------------------------------------------
// deno-lint-ignore no-explicit-any
declare const Deno: any

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

if (typeof Deno !== 'undefined') {
  Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    try {
      const result = await syncResults({
        supabaseUrl: Deno.env.get('SUPABASE_URL'),
        serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY'),
      })
      return new Response(JSON.stringify(result), { headers: { ...cors, 'Content-Type': 'application/json' } })
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
  })
}
