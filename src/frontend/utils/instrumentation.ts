
// window.location.pathname.replace('.ipynb','').replace('/notebooks','') + '/' + (new Date()).toISOString().replace(':','-')

export function log_event(mode: 'code' | 'gui' | 'ai' | 'other', kind: string, extra?: Object): void {

  (window as any).plottery_instrumentation_eventno = ((window as any).plottery_instrumentation_eventno || 0) + 1
  const n: number = (window as any).plottery_instrumentation_eventno // Milliseconds might still have collisions in rare cases, so add n
  const t = new Date();

  const event = {
    timestamp: t.toISOString(),
    n,
    local_time: t.toLocaleTimeString(),
    mode,
    kind
  }

  extra ||= {}
  for (const key in extra) {
    (event as any)[key] = (extra as any)[key]
  }

  console.log(event.timestamp, n, mode, kind, extra)

  const path = window.location.pathname.replace('.ipynb', '').replace('/notebooks/', '/') + '/' + (new Date()).toISOString().replaceAll(':', '-') + '_' + n.toString()

  // POST the JSON event blob to localhost:7777/dirs/notebook_name/2024-01-01T12-34-56.789Z_1234
  // which will be saved in the local file usage_events/dirs/notebook_name/2024-01-01T12-34-56.789Z_1234
  const xhr = new XMLHttpRequest()
  xhr.open('POST', 'http://localhost:7777' + path, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.send(JSON.stringify(event))
}

export function rate_limit(key: string, milliseconds: number, f: () => void): void {
  const time_key = 'plottery_instrumentation_debounce_' + key + '_last_time'
  const last_time = (window as any)[time_key] || 0
  const now = Date.now().valueOf()

  if (now - last_time >= milliseconds) {
    (window as any)[time_key] = now
    f()
  }
}

// Same as rate_limit, but make sure the last event is always triggered (albiet late by `milliseconds`)
export function debounce(key: string, milliseconds: number, f: () => void): void {
  const timeout_key = 'plottery_instrumentation_debounce_' + key + '_timeout'
  const time_key = 'plottery_instrumentation_debounce_' + key + '_last_time'

  const last_time = (window as any)[time_key] || 0
  const now = Date.now().valueOf()

  clearTimeout((window as any)[timeout_key]);
  if (now - last_time >= milliseconds) {
    (window as any)[time_key] = now;
    f();
  } else {
    (window as any)[timeout_key] = setTimeout(() => {
      (window as any)[time_key] = Date.now().valueOf();
      f();
    }, Math.max(milliseconds - (now - last_time), 10))
  }
}
