import type { Body } from 'matter-js'
import { BASE_X0, BASE_X1, PIECE_R, POCKETS, SIZE, STRIKER_R, baselineY } from './table'
import type { Kind } from './rules'

export interface CoinView {
  body: Body
  kind: Kind
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  coins: CoinView[],
  striker: Body | null,
  aim: { x: number; y: number } | null,
): void {
  ctx.clearRect(0, 0, SIZE, SIZE)
  const wood = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  wood.addColorStop(0, '#8a4e28')
  wood.addColorStop(0.5, '#5b3018')
  wood.addColorStop(1, '#3d2112')
  ctx.fillStyle = wood
  ctx.fillRect(0, 0, SIZE, SIZE)

  round(ctx, 36, 36, SIZE - 72, SIZE - 72, 28)
  const felt = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 80, SIZE / 2, SIZE / 2, 520)
  felt.addColorStop(0, '#f8e7c4')
  felt.addColorStop(1, '#e4c48a')
  ctx.fillStyle = felt
  ctx.fill()

  ctx.strokeStyle = 'rgba(92, 48, 18, 0.35)'
  ctx.lineWidth = 3
  ctx.stroke()

  for (const pocket of POCKETS) {
    ctx.beginPath()
    ctx.arc(pocket.x, pocket.y, 58, 0, Math.PI * 2)
    const hole = ctx.createRadialGradient(pocket.x - 8, pocket.y - 8, 4, pocket.x, pocket.y, 58)
    hole.addColorStop(0, '#4a4038')
    hole.addColorStop(1, '#16120f')
    ctx.fillStyle = hole
    ctx.fill()
  }

  ctx.save()
  ctx.strokeStyle = 'rgba(120, 36, 28, 0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(SIZE / 2, SIZE / 2, 118, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(SIZE / 2, SIZE / 2, 18, 0, Math.PI * 2)
  ctx.stroke()

  for (const y of [baselineY(0), baselineY(1)]) {
    ctx.beginPath()
    ctx.moveTo(BASE_X0, y)
    ctx.lineTo(BASE_X1, y)
    ctx.stroke()
    for (const x of [BASE_X0, BASE_X1]) {
      ctx.beginPath()
      ctx.arc(x, y, 22, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.restore()

  const guide = striker ? striker.position.y : baselineY(0)
  ctx.fillStyle = 'rgba(70, 110, 180, 0.18)'
  round(ctx, BASE_X0 - 28, guide - 18, BASE_X1 - BASE_X0 + 56, 36, 18)
  ctx.fill()

  for (const coin of coins) drawCoin(ctx, coin.body.position.x, coin.body.position.y, coin.kind)
  if (striker) drawStriker(ctx, striker.position.x, striker.position.y)

  if (striker && aim) {
    const from = striker.position
    const angle = Math.atan2(aim.y - from.y, aim.x - from.x)
    const dist = Math.min(220, Math.hypot(aim.x - from.x, aim.y - from.y))
    const power = dist / 220
    ctx.save()
    ctx.translate(from.x, from.y)
    ctx.rotate(angle)
    ctx.strokeStyle = power > 0.72 ? '#9d1c1c' : '#1d4e89'
    ctx.lineWidth = 4
    ctx.setLineDash([8, 8])
    ctx.beginPath()
    ctx.moveTo(STRIKER_R + 6, 0)
    ctx.lineTo(STRIKER_R + 16 + dist, 0)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = ctx.strokeStyle
    ctx.beginPath()
    ctx.moveTo(STRIKER_R + 28 + dist, 0)
    ctx.lineTo(STRIKER_R + 12 + dist, -9)
    ctx.lineTo(STRIKER_R + 12 + dist, 9)
    ctx.fill()
    ctx.restore()
  }
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, kind: Kind): void {
  const radius = PIECE_R
  ctx.save()
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.arc(2, 3, radius, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(40, 20, 8, 0.25)'
  ctx.fill()
  const grad = ctx.createRadialGradient(-5, -6, 2, 0, 0, radius)
  if (kind === 'q') {
    grad.addColorStop(0, '#ff8d8d')
    grad.addColorStop(1, '#b42318')
  } else if (kind === 'w') {
    grad.addColorStop(0, '#fffaf2')
    grad.addColorStop(1, '#d9d0c2')
  } else {
    grad.addColorStop(0, '#5c534c')
    grad.addColorStop(1, '#1a1614')
  }
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.lineWidth = kind === 'q' ? 3 : 1.5
  ctx.strokeStyle = kind === 'q' ? '#f6d36b' : 'rgba(0,0,0,0.25)'
  ctx.stroke()
  if (kind === 'q') {
    ctx.fillStyle = '#f6d36b'
    ctx.beginPath()
    ctx.arc(0, 0, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawStriker(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.arc(2, 4, STRIKER_R, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(40, 20, 8, 0.28)'
  ctx.fill()
  const grad = ctx.createRadialGradient(-6, -8, 3, 0, 0, STRIKER_R)
  grad.addColorStop(0, '#fff')
  grad.addColorStop(1, '#d5dde8')
  ctx.beginPath()
  ctx.arc(0, 0, STRIKER_R, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = '#2458c5'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, 6, 0, Math.PI * 2)
  ctx.fillStyle = '#9d1c1c'
  ctx.fill()
  ctx.restore()
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
