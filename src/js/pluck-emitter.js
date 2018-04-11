import Observable from './observable'
import ActionTypes from './action-types'

const PluckEmitter = Observable((emit) => {
  const pluck = (evt) => {
    const stringMapping = {
      'B': 6,
      'N': 5,
      'M': 4,
      '¼': 3,  // comma
      '¾': 2,  // dot
      '½': 1   // dash
    }
    const key = String.fromCharCode(evt.keyCode)
    const stringNumber = stringMapping[key]
    if (stringNumber !== undefined) {
      const action = {
        type: ActionTypes.PLUCK_STRING,
        stringNumber
      }
      emit(action)
    }
  }
  document.addEventListener('keydown', pluck)
})

export default PluckEmitter