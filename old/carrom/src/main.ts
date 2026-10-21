import './style.css'
import { CarromGame } from './game'

const canvas = document.querySelector<HTMLCanvasElement>('#board')
const hud = document.querySelector<HTMLElement>('#hud')
const layer = document.querySelector<HTMLElement>('#layer')
if (!canvas || !hud || !layer) throw new Error('Missing shell')

new CarromGame(canvas, hud, layer)
