import ActionTypes from './action-types'
import chords from './chords'

const GuitarPlayer = (guitar) => {
  let chord = chords['none']

  return (action) => {
    if (action.type === ActionTypes.NEW_CHORD) {
      chord = chords[action.chord] || chords['none']
    } else if (action.type === ActionTypes.PLAY_CHORD) {
      guitar.strum(chord)
    } else if (action.type === ActionTypes.PLUCK_STRING && chord) {
      guitar.pluck(action.stringNumber, chord[Math.abs(action.stringNumber - 6)])
    }
  }
}

export default GuitarPlayer