import { Guitar } from 'ks-guitar-synth'
import GuitarPlayer from './guitar-player'
import strokeEmitter from './stroke-emitter'
import pluckEmitter from './pluck-emitter'
import chordEmitter from './chord-emitter'
import initUi from './ui'

const main = () => {
  const guitar = new Guitar()
  const guitarPlayer = GuitarPlayer(guitar)
  chordEmitter.subscribe(guitarPlayer)
  strokeEmitter.subscribe(guitarPlayer)
  pluckEmitter.subscribe(guitarPlayer)
  
  const $root = document.querySelector('.ksguitar-app')
  const ui = initUi($root)
  chordEmitter.subscribe(ui)
}

window.onload = main