// Voice-clip recording via MediaRecorder. Records to a webm/opus blob (with an mp4
// fallback for Safari), exposing live duration so the UI can show a timer. The blob
// is uploaded to Firebase Storage by the caller and sent as an AUDIO message.

import { onBeforeUnmount, ref } from 'vue'

export interface Recording {
  blob: Blob
  ext: string
  durationSec: number
}

export function useRecorder() {
  const recording = ref(false)
  const seconds = ref(0)
  const supported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined'

  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: Blob[] = []
  let timer: ReturnType<typeof setInterval> | null = null
  let resolveStop: ((r: Recording | null) => void) | null = null

  function pickMime(): { mime: string; ext: string } {
    const candidates = [
      { mime: 'audio/webm;codecs=opus', ext: 'webm' },
      { mime: 'audio/webm', ext: 'webm' },
      { mime: 'audio/mp4', ext: 'mp4' },
    ]
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported?.(c.mime)) return c
    }
    return { mime: '', ext: 'webm' }
  }

  async function start(): Promise<boolean> {
    if (!supported || recording.value) return false
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return false // permission denied / no mic
    }
    const { mime, ext } = pickMime()
    chunks = []
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    ;(recorder as MediaRecorder & { _ext?: string })._ext = ext
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    recorder.onstop = () => {
      const type = recorder?.mimeType || 'audio/webm'
      const blob = new Blob(chunks, { type })
      const result: Recording = {
        blob,
        ext: (recorder as (MediaRecorder & { _ext?: string }) | null)?._ext || 'webm',
        durationSec: seconds.value,
      }
      cleanup()
      resolveStop?.(blob.size ? result : null)
      resolveStop = null
    }
    recorder.start()
    recording.value = true
    seconds.value = 0
    timer = setInterval(() => { seconds.value += 1 }, 1000)
    return true
  }

  /** Stop and return the recording (null if empty). */
  function stop(): Promise<Recording | null> {
    return new Promise((resolve) => {
      if (!recorder || !recording.value) { resolve(null); return }
      resolveStop = resolve
      recorder.stop()
    })
  }

  /** Abort without producing a clip. */
  function cancel() {
    resolveStop = null
    if (recorder && recording.value) {
      recorder.onstop = null
      try { recorder.stop() } catch { /* already stopped */ }
    }
    cleanup()
  }

  function cleanup() {
    if (timer) { clearInterval(timer); timer = null }
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    recorder = null
    recording.value = false
  }

  onBeforeUnmount(cancel)

  return { supported, recording, seconds, start, stop, cancel }
}
