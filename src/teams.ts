import type { TeamCode } from './supabase'

export const TEAMS: Record<TeamCode, { name: string; short: string; color: string; text: string }> = {
  FRA: { name: 'France', short: 'FRA', color: '#1d3f8f', text: '#fff' },
  ENG: { name: 'Angleterre', short: 'ANG', color: '#f4f4f4', text: '#c8102e' },
  IRL: { name: 'Irlande', short: 'IRL', color: '#14853b', text: '#fff' },
  SCO: { name: 'Écosse', short: 'ECO', color: '#0c2340', text: '#fff' },
  WAL: { name: 'Pays de Galles', short: 'GAL', color: '#c8102e', text: '#fff' },
  ITA: { name: 'Italie', short: 'ITA', color: '#2a7fd4', text: '#fff' },
}

export const TEAM_CODES = Object.keys(TEAMS) as TeamCode[]

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris',
})
const timeFmt = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
})

export function formatDate(iso: string) {
  const s = dateFmt.format(new Date(iso))
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export function formatTime(iso: string) {
  return timeFmt.format(new Date(iso)).replace(':', 'h')
}

export function timeLeft(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ${String(min % 60).padStart(2, '0')}`
  const d = Math.floor(h / 24)
  return `${d} j ${h % 24} h`
}
