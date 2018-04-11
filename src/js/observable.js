const Observable = (emitter) => {
  const subscribers = []
  const emit = (...args) => subscribers.forEach((subscriber) => subscriber(...args))
  let started = false
  const subscribe = (subscriber) => {
    subscribers.push(subscriber)
    if (!started) {
      started = true
      emitter(emit)
    }
  }
  return { subscribe }
}

export default Observable