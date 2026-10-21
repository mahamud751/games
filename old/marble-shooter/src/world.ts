export const WORLD_W = 900
export const WORLD_H = 1200

export const RING = {
  x: WORLD_W / 2,
  y: WORLD_H / 2,
  r: 268,
}

const HOME = 448

/** Player 1 always stands at the bottom of the table. */
export const P1 = { x: RING.x, y: RING.y + HOME }
/** Player 2 stands across the ring. The camera flips so they also shoot from the bottom. */
export const P2 = { x: RING.x, y: RING.y - HOME }

export const TARGET_R = 22
export const SHOOTER_R = 29

export const MAX_PULL = 210
export const MIN_PULL = 26
export const MAX_SPEED = 18
