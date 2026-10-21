import './style.css'
import { SnakesGame } from './game'

const canvas = document.querySelector<HTMLCanvasElement>('#board')
const hud = document.querySelector<HTMLElement>('#hud')
const layer = document.querySelector<HTMLElement>('#layer')
if (!canvas || !hud || !layer) throw new Error('Missing shell')

new SnakesGame(canvas, hud, layer)
