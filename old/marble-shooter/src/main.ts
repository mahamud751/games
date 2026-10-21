import './style.css'
import { MarbleGame } from './game'

const app = document.querySelector<HTMLElement>('#app')
if (!app) throw new Error('Missing #app')

new MarbleGame(app)
