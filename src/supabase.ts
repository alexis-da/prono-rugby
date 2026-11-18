import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configMissing = !url || !key

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing')

export type TeamCode = 'FRA' | 'ENG' | 'IRL' | 'SCO' | 'WAL' | 'ITA'

export interface Profile {
  id: string
  pseudo: string
  is_admin: boolean
}

export interface Match {
  id: number
  round: number
  kickoff: string
  home: TeamCode
  away: TeamCode
  venue: string | null
  home_score: number | null
  away_score: number | null
  home_tries: number | null
  away_tries: number | null
  home_yellows: number | null
  away_yellows: number | null
}

export interface PredictionPoints {
  user_id: string
  match_id: number
  round: number
  home_score: number
  away_score: number
  home_tries: number | null
  away_tries: number | null
  home_yellows: number | null
  away_yellows: number | null
  boosted: boolean
  points: number | null
  good: boolean
  exact: boolean
}

export interface Booster {
  user_id: string
  match_id: number
}

/** Ce que le joueur saisit pour un match (les essais et cartons sont facultatifs). */
export interface PredictionInput {
  home_score: number
  away_score: number
  home_tries: number | null
  away_tries: number | null
  home_yellows: number | null
  away_yellows: number | null
}

export interface LeaderRow {
  user_id: string
  pseudo: string
  total: number
  match_points: number
  bonus_points: number
  good_results: number
  exact_scores: number
}

/** Transforme une erreur Supabase/Postgres en message lisible. */
export function niceError(e: { message?: string } | null | undefined): string {
  const msg = e?.message ?? 'Erreur inconnue'
  if (msg.includes('row-level security')) return 'Trop tard : le match a déjà commencé.'
  if (msg.includes('boosters_pkey')) return 'Tu as déjà utilisé ton booster.'
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (msg.includes('User already registered')) return 'Un compte existe déjà avec cet email.'
  if (msg.includes('Password should be')) return 'Le mot de passe doit faire au moins 6 caractères.'
  if (msg.includes('Email not confirmed')) return 'Confirme d’abord ton adresse email (regarde tes mails).'
  if (msg.includes('profiles_pseudo')) return 'Ce pseudo est déjà pris.'
  if (msg.includes('pseudo_check')) return 'Le pseudo doit faire entre 2 et 20 caractères.'
  return msg
}
