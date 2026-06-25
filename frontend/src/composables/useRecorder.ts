// Voice-clip recording via MediaRecorder. Records to a webm/opus blob (with an mp4
// fallback for Safari), then transcodes to WAV (16 kHz mono) before returning so the
// clip plays on every platform — iOS Safari cannot play webm/opus in <audio>, and no
// single MediaRecorder format is both recordable and playable across Chrome + Safari.
// The conversion runs on the recorder's own device, which can always decode what it
// just recorded. The blob is uploaded to Firebase Storage by the caller.

import { onBeforeUnmount, ref } from 'vue'

export interface Recording {
  blob: Blob
  ext: string
  durationSec: number
}

const WAV_SAMPLE_RATE = 16000

/** Decode a recorded clip and re-encode it as 16 kHz mono 16-bit WAV. */
async function toWav(input: Blob): Promise<Blob> {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const decodeCtx = new AC()
  let decoded: AudioBuffer
  try {
    decoded = await decodeCtx.decodeAudioData(await input.arrayBuffer())
  } finally {
    void decodeCtx.close()
  }
  // Resample + downmix to mono via an offline render.
  const OAC = window.OfflineAudioContext
    || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
  const frames = Math.max(1, Math.ceil(decoded.duration * WAV_SAMPLE_RATE))
  const offline = new OAC(1, frames, WAV_SAMPLE_RATE)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  return encodeWav(rendered.getChannelData(0), rendered.sampleRate)
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const dataSize = samples.length * 2
  const buf = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buf)
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)        // PCM chunk size
  view.setUint16(20, 1, true)         // format = PCM
  view.setUint16(22, 1, true)         // channels = mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)         // block align
  view.setUint16(34, 16, true)        // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  let off = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    off += 2
  }
  return new Blob([buf], { type: 'audio/wav' })
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
    recorder.onstop = async () => {
      const type = recorder?.mimeType || 'audio/webm'
      const rawExt = (recorder as (MediaRecorder & { _ext?: string }) | null)?._ext || 'webm'
      const raw = new Blob(chunks, { type })
      const dur = seconds.value
      cleanup()
      const resolve = resolveStop
      resolveStop = null
      if (!raw.size) { resolve?.(null); return }
      try {
        const wav = await toWav(raw)
        resolve?.({ blob: wav, ext: 'wav', durationSec: dur })
      } catch {
        // Couldn't transcode — fall back to the raw clip (plays where the codec is
        // supported, e.g. same-browser, rather than failing the send entirely).
        resolve?.({ blob: raw, ext: rawExt, durationSec: dur })
      }
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
