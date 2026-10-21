import './style.css'
import { BookGame } from './game'

const app = document.querySelector<HTMLElement>('#app')
if (!app) throw new Error('Missing #app')

new BookGame(app)
