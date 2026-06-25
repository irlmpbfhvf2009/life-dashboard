// Downscale + re-encode an image File to keep the receipt upload small (faster,
// cheaper for the vision model). Returns raw base64 (no data: prefix) + mime type.

export interface CompressedImage {
  base64: string
  mimeType: string
}

export async function fileToCompressedBase64(
  file: File,
  maxDim = 1280,
  quality = 0.7,
): Promise<CompressedImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('decode failed'))
    el.src = dataUrl
  })

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    // Fall back to the original data URL if canvas is unavailable.
    const comma = dataUrl.indexOf(',')
    return { base64: dataUrl.slice(comma + 1), mimeType: file.type || 'image/jpeg' }
  }
  ctx.drawImage(img, 0, 0, w, h)
  const out = canvas.toDataURL('image/jpeg', quality)
  return { base64: out.slice(out.indexOf(',') + 1), mimeType: 'image/jpeg' }
}
