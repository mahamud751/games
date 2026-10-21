export type Kind = 'w' | 'b' | 'q' | 's'
export type Seat = 0 | 1
export type Queen = 'board' | 'p0' | 'p1' | 'c0' | 'c1'

export interface Table {
  pocket: { w: number; b: number }
  queen: Queen
  turn: Seat
}

export interface Outcome {
  table: Table
  again: boolean
  winner: Seat | null
  back: Kind[]
  foul: boolean
  note: string
}

export function freshTable(): Table {
  return { pocket: { w: 0, b: 0 }, queen: 'board', turn: 0 }
}

/** House rules kids actually play: cover the queen, then clear your nine. */
export function settle(table: Table, fallen: Kind[]): Outcome {
  const me = table.turn
  const mine: Kind = me === 0 ? 'w' : 'b'
  const opp: Kind = me === 0 ? 'b' : 'w'
  const ownN = fallen.filter((kind) => kind === mine).length
  const oppN = fallen.filter((kind) => kind === opp).length
  const gotQueen = fallen.includes('q')
  const pocket = { w: table.pocket.w, b: table.pocket.b }
  let queen = table.queen
  const back: Kind[] = []

  if (fallen.includes('s')) {
    if (queen === `p${me}`) {
      queen = 'board'
      back.push('q')
    }
    if (pocket[mine] > 0) {
      pocket[mine] -= 1
      back.push(mine)
    }
    for (let i = 0; i < ownN; i += 1) back.push(mine)
    for (let i = 0; i < oppN; i += 1) back.push(opp)
    if (gotQueen) back.push('q')
    return {
      table: { pocket, queen, turn: me === 0 ? 1 : 0 },
      again: false,
      winner: null,
      back,
      foul: true,
      note: 'ফাউল — স্ট্রাইকার পকেটে',
    }
  }

  pocket[mine] += ownN
  pocket[opp] += oppN
  const queenJust = gotQueen && table.queen === 'board'
  if (ownN > 0 && (table.queen === `p${me}` || queenJust)) queen = me === 0 ? 'c0' : 'c1'
  else if (queenJust) queen = me === 0 ? 'p0' : 'p1'

  if (pocket[mine] > 8 && queen !== (me === 0 ? 'c0' : 'c1')) {
    const extra = pocket[mine] - 8
    pocket[mine] = 8
    for (let i = 0; i < extra; i += 1) back.push(mine)
  }

  let winner: Seat | null = null
  if (pocket.w === 9 && queen === 'c0') winner = 0
  else if (pocket.b === 9 && queen === 'c1') winner = 1

  let again = winner === null && !back.includes(mine) && (ownN > 0 || queenJust)
  if (winner !== null) again = false
  if (!again && (queen === 'p0' && me === 0 || queen === 'p1' && me === 1)) {
    queen = 'board'
    if (!back.includes('q')) back.push('q')
  }

  let note = 'এই শটে কিছু পড়েনি'
  if (winner === 0) note = 'সাদা জিতেছে!'
  else if (winner === 1) note = 'কালো জিতেছে!'
  else if (back.includes(mine)) note = 'শেষ গুটি ফেরত — আগে রাণী ঢাকো'
  else if (queenJust && ownN > 0) note = 'রাণী ঢাকা পড়েছে!'
  else if (queenJust) note = 'রাণী পড়েছে — পরের শটে ঢাকো'
  else if (ownN > 1) note = 'একসাথে কয়েকটা!'
  else if (ownN === 1) note = mine === 'w' ? 'সাদা গুটি পড়েছে' : 'কালো গুটি পড়েছে'
  else if (oppN > 0) note = 'প্রতিপক্ষের গুটি পড়েছে'

  return {
    table: { pocket, queen, turn: again ? me : me === 0 ? 1 : 0 },
    again,
    winner,
    back,
    foul: false,
    note,
  }
}
