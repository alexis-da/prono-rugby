import { useEffect, useState } from 'react'

/** Heure courante rafraîchie toutes les 30 s (pour les comptes à rebours). */
export function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}
