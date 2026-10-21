const KEY = 'para-club-coins-v1'

export type GameId = 'carrom' | 'ludo' | 'snakes'

export interface Club {
  coins: number
  wins: Record<GameId, number>
  muted: boolean
}

function empty(): Club {
  return { coins: 15, wins: { carrom: 0, ludo: 0, snakes: 0 }, muted: false }
}

export function loadClub(): Club {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const data = JSON.parse(raw) as Partial<Club>
    const base = empty()
    return {
      coins: Number.isFinite(Number(data.coins)) ? Math.max(0, Number(data.coins)) : base.coins,
      wins: {
        carrom: Number(data.wins?.carrom) || 0,
        ludo: Number(data.wins?.ludo) || 0,
        snakes: Number(data.wins?.snakes) || 0,
      },
      muted: Boolean(data.muted),
    }
  } catch {
    return empty()
  }
}

export function saveClub(club: Club): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(club))
  } catch {
    /* private mode */
  }
}

/** Pay 1 coin. If the purse is empty, the club uncle lends 6 first. */
export function stakeCoin(club: Club): { club: Club; loan: boolean } {
  let loan = false
  if (club.coins < 1) {
    club.coins += 6
    loan = true
  }
  club.coins -= 1
  saveClub(club)
  return { club, loan }
}

export function prize(club: Club, game: GameId): Club {
  club.coins += 2
  club.wins[game] += 1
  saveClub(club)
  return club
}

export function refund(club: Club): Club {
  club.coins += 1
  saveClub(club)
  return club
}
