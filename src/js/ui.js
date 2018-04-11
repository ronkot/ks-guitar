const initializeUI = ($root) => {
  const $toggleHelp = $root.querySelector('.toggle-help')
  const $helpText = $root.querySelector('.help-text')
  const $chordInfo = $root.querySelector('.chord-info')

  // Event handling
  const onToggleHelp = () => $helpText.style.display = ($helpText.style.display || 'none') == 'none' ? 'block' : 'none'
  $toggleHelp.addEventListener('click', onToggleHelp)


  // Action handling
  const onNewChord = (chord) => $chordInfo.innerHTML = chord
  const actionHandler = (action) => {
    if (action.type === 'NEW_CHORD') {
      onNewChord(action.chord)
    }
  }
  return actionHandler
}

export default initializeUI