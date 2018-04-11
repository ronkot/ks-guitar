import Observable from './observable'
import ActionTypes from './action-types'

const StrokeEmitter = Observable((emit) => {
  const ARROWS = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40
  }
  const detectStroke = (evt) => {
    if (evt.keyCode === ARROWS.UP) {
      const action = {
        type: ActionTypes.PLAY_CHORD,
        downstroke: false
      }
      emit(action)
    } else if (evt.keyCode === ARROWS.DOWN) {
      const action = {
        type: ActionTypes.PLAY_CHORD,
        downstroke: true
      }
      emit(action)
    }
  }
  document.addEventListener('keydown', detectStroke)
})

export default StrokeEmitter