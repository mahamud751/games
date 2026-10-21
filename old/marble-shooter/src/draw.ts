import { RING, WORLD_H, WORLD_W } from './world'

export interface Swatch {
  body: string
  deep: string
  swirl: string
}

export const SWATCH: Swatch[] = [
  { body: '#e23b3b', deep: '#8d1616', swirl: '#ffd0cc' },
  { body: '#1f8a84', deep: '#0c4c49', swirl: '#d4fffb' },
  { body: '#e2a31a', deep: '#8a6410', swirl: '#fff1c2' },
  { body: '#3a6fe0', deep: '#1a3c8c', swirl: '#d9e4ff' },
  { body: '#2f9d64', deep: '#14643c', swirl: '#d8ffe9' },
  { body: '#7a4fd0', deep: '#432484', swirl: '#eadfff' },
  { body: '#ee7a2f', deep: '#8a3d0e', swirl: '#ffe3d0' },
  { body: '#d43b78', deep: '#7a1844', swirl: '#ffd6e8' },
]

export const SHOOTERS: (Swatch & { ring: string })[] = [
  { body: '#f5f8fc', deep: '#8ea0b8', swirl: '#2f6fe0', ring: '#2f6fe0' },
  { body: '#fff7f4', deep: '#c98b86', swirl: '#e24b3c', ring: '#e24b3c' },
]

export function swatch(index: number): Swatch {
  const list = SWATCH
  const i = ((index % list.length) + list.length) % list.length
  return list[i] ?? list[0]!
}

export function makeNoise(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const image = ctx.createImageData(160, 160)
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 80 + Math.random() * 90
    image.data[i] = v
    image.data[i + 1] = v * 0.82
    image.data[i + 2] = v * 0.55
    image.data[i + 3] = 46
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function chalkPath(radius: number, wobble: number, phase: number): Path2D {
  const path = new Path2D()
  const steps = 140
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2
    const w = 1 + Math.sin(a * 6 + phase) * wobble + Math.sin(a * 17 + phase * 2) * wobble * 0.55
    const x = RING.x + Math.cos(a) * radius * w
    const y = RING.y + Math.sin(a) * radius * w
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  path.closePath()
  return path
}

const CHALK = chalkPath(RING.r, 0.012, 0.4)
const CHALK_SOFT = chalkPath(RING.r + 14, 0.016, 1.4)

const PEBBLES = [
  { x: 78, y: 210, rx: 16, ry: 9 },
  { x: 820, y: 250, rx: 20, ry: 11 },
  { x: 96, y: 990, rx: 18, ry: 10 },
  { x: 808, y: 960, rx: 14, ry: 8 },
  { x: 150, y: 140, rx: 10, ry: 6 },
]

export interface Knuckle {
  x: number
  y: number
  active: boolean
  outward: number
}

export function drawCourt(ctx: CanvasRenderingContext2D, noise: CanvasPattern | null, knuckles: Knuckle[]): void {
  const ground = ctx.createRadialGradient(RING.x, RING.y, 30, RING.x, RING.y, 760)
  ground.addColorStop(0, '#f3ddb4')
  ground.addColorStop(0.42, '#e6c28c')
  ground.addColorStop(1, '#c48a52')
  ctx.fillStyle = ground
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)

  if (noise) {
    ctx.save()
    ctx.globalAlpha = 0.28
    ctx.fillStyle = noise
    ctx.fillRect(0, 0, WORLD_W, WORLD_H)
    ctx.restore()
  }

  ctx.save()
  ctx.beginPath()
  ctx.arc(RING.x, RING.y, RING.r - 2, 0, Math.PI * 2)
  ctx.clip()
  const bowl = ctx.createRadialGradient(RING.x, RING.y, RING.r * 0.2, RING.x, RING.y, RING.r)
  bowl.addColorStop(0, 'rgba(92, 54, 24, 0.06)')
  bowl.addColorStop(0.7, 'rgba(80, 44, 16, 0.05)')
  bowl.addColorStop(1, 'rgba(48, 22, 8, 0.32)')
  ctx.fillStyle = bowl
  ctx.fillRect(RING.x - RING.r, RING.y - RING.r, RING.r * 2, RING.r * 2)
  ctx.restore()

  for (const pebble of PEBBLES) {
    ctx.beginPath()
    ctx.ellipse(pebble.x, pebble.y, pebble.rx, pebble.ry, 0.4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(92, 58, 32, 0.28)'
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(pebble.x - 2, pebble.y - 2, pebble.rx * 0.72, pebble.ry * 0.62, 0.4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(214, 176, 130, 0.45)'
    ctx.fill()
  }

  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(255, 250, 240, 0.28)'
  ctx.lineWidth = 10
  ctx.stroke(CHALK_SOFT)
  ctx.strokeStyle = 'rgba(255, 250, 240, 0.94)'
  ctx.lineWidth = 6
  ctx.stroke(CHALK)
  ctx.strokeStyle = 'rgba(90, 60, 30, 0.18)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(RING.x - 16, RING.y)
  ctx.lineTo(RING.x + 16, RING.y)
  ctx.moveTo(RING.x, RING.y - 16)
  ctx.lineTo(RING.x, RING.y + 16)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 0.38
  ctx.fillStyle = '#fff8ee'
  ctx.font = '600 18px "Hind Siliguri", "Kohinoor Bangla", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('বাইরে', RING.x - RING.r - 62, RING.y)
  ctx.fillText('বাইরে', RING.x + RING.r + 62, RING.y)
  ctx.restore()

  for (const mark of knuckles) drawKnuckle(ctx, mark)
}

function drawKnuckle(ctx: CanvasRenderingContext2D, mark: Knuckle): void {
  ctx.save()
  ctx.translate(mark.x, mark.y + mark.outward * 34)
  ctx.strokeStyle = mark.active ? 'rgba(255, 250, 240, 0.95)' : 'rgba(255, 250, 240, 0.3)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-34, 0)
  ctx.lineTo(34, 0)
  ctx.moveTo(0, -8 * mark.outward)
  ctx.lineTo(0, 8 * mark.outward)
  ctx.stroke()
  ctx.restore()
}

export function drawMarble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  look: Swatch,
  angle: number,
  ring?: string,
): void {
  ctx.save()
  ctx.translate(x, y)

  ctx.beginPath()
  ctx.ellipse(r * 0.15, r * 0.62, r * 0.86, r * 0.3, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(70, 36, 14, 0.3)'
  ctx.fill()

  const body = ctx.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.08, r * 0.1, r * 0.15, r)
  body.addColorStop(0, '#ffffff')
  body.addColorStop(0.15, look.swirl)
  body.addColorStop(0.45, look.body)
  body.addColorStop(1, look.deep)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()

  ctx.save()
  ctx.rotate(angle)
  ctx.strokeStyle = look.swirl
  ctx.globalAlpha = 0.9
  ctx.lineWidth = Math.max(2, r * 0.16)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.4, 0.15, 2.55)
  ctx.stroke()
  ctx.strokeStyle = look.deep
  ctx.globalAlpha = 0.35
  ctx.lineWidth = Math.max(1.5, r * 0.07)
  ctx.beginPath()
  ctx.arc(r * 0.08, r * 0.02, r * 0.25, 2.2, 5.1)
  ctx.stroke()
  ctx.restore()

  ctx.beginPath()
  ctx.arc(0, 0, r - 0.7, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 1.4
  ctx.stroke()

  ctx.beginPath()
  ctx.ellipse(-r * 0.32, -r * 0.36, r * 0.28, r * 0.15, -0.7, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fill()

  if (ring) {
    ctx.beginPath()
    ctx.arc(0, 0, r + 3.5, 0, Math.PI * 2)
    ctx.strokeStyle = ring
    ctx.lineWidth = 2.6
    ctx.stroke()
  }

  ctx.restore()
}

export function drawAim(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ux: number,
  uy: number,
  length: number,
  power: number,
): void {
  const color = power > 0.84 ? '#e4583c' : power > 0.48 ? '#e3a31a' : '#2e6b4f'
  const endX = x + ux * length
  const endY = y + uy * length
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.setLineDash([1, 11])
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(endX, endY)
  ctx.stroke()
  ctx.setLineDash([])
  const angle = Math.atan2(uy, ux)
  ctx.beginPath()
  ctx.moveTo(endX, endY)
  ctx.lineTo(endX - Math.cos(angle - 0.42) * 16, endY - Math.sin(angle - 0.42) * 16)
  ctx.lineTo(endX - Math.cos(angle + 0.42) * 16, endY - Math.sin(angle + 0.42) * 16)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
