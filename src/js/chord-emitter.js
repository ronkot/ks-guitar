import Observable from './observable'
import Chords from './chords'
import ActionTypes from './action-types'

const ChordEmitter = Observable((emit) => {
  let keys = []
  let chord = 'none'
  const handleKeys = (keys) => {
    const nextChord = getChord(keys)
    if (nextChord !== chord) {
      chord = nextChord
      const action = {
        type: ActionTypes.NEW_CHORD,
        chord
      }
      emit(action)
    }
  }
  const unique = (arr) => [...new Set(arr)]
  const addKey = (evt) => {
    keys = unique([...keys, String.fromCharCode(evt.keyCode)])
    handleKeys(keys)
  }
  const removeKey = (evt) => {
    const evtKey = String.fromCharCode(evt.keyCode)
    keys = keys.filter((key) => key !== evtKey)
    handleKeys(keys)
  }
  document.addEventListener('keydown', addKey)
  document.addEventListener('keyup', removeKey)
})

const getChord = (keys) => {
  const baseNoteMapping = {
    Q: 'C',
    W: 'D',
    E: 'E',
    R: 'F',
    T: 'G',
    Y: 'A',
    U: 'H',
    2: 'C#',
    3: 'D#',
    5: 'F#',
    6: 'G#',
    7: 'A#'
  }
  const upperRow = ['2', '3', '4', '5', '6', '7', '8', '9', '0']
  const lowerRow = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']

  const upperRowPresses = keys
    .map(key => upperRow.indexOf(key))
    .filter(index => index > -1)

  const lowerRowPresses = keys
    .map(key => lowerRow.indexOf(key))
    .filter(index => index > -1)

  let row, presses
  if (upperRowPresses.length > 0) {
    row = upperRow
    presses = upperRowPresses
  } else if (lowerRowPresses.length > 0) {
    row = lowerRow
    presses = lowerRowPresses
  } else {
    return 'none'
  }

  const MINOR_OFFSET = 1
  const SEVEN_OFFSET = 2
  const minPress = Math.min(...presses)
  const isMinor = presses.includes(minPress + MINOR_OFFSET)
  const is7 = presses.includes(minPress + SEVEN_OFFSET)
  const base = baseNoteMapping[row[minPress]]
  const chord = `${base}${isMinor ? 'm' : ''}${is7 ? '7' : ''}`
  return chord
}

export default ChordEmitter