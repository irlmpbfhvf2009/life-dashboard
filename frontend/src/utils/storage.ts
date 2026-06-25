// Travel-journal photo storage. Photos are too big for localStorage / the synced
// travel_state document, so we upload them to Firebase Storage and keep only the
// download URL in state. Compression happens before upload (utils/image.ts).

import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage, auth } from '@/firebase'
import { fileToCompressedBlob } from '@/utils/image'

/** Upload a journal photo and return its public download URL. */
export async function uploadJournalPhoto(file: File, destinationId: string): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('not signed in')
  const blob = await fileToCompressedBlob(file)
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const path = `journal/${uid}/${destinationId}/${name}`
  const r = storageRef(storage, path)
  await uploadBytes(r, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(r)
}

/** Upload a chat photo (compressed) and return its public download URL. */
export async function uploadChatImage(file: File): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('not signed in')
  const blob = await fileToCompressedBlob(file)
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const path = `chat/${uid}/img/${name}`
  const r = storageRef(storage, path)
  await uploadBytes(r, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(r)
}

/** Upload a recorded voice clip and return its public download URL. */
export async function uploadChatAudio(blob: Blob, ext = 'webm'): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('not signed in')
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `chat/${uid}/audio/${name}`
  const r = storageRef(storage, path)
  await uploadBytes(r, blob, { contentType: blob.type || 'audio/webm' })
  return getDownloadURL(r)
}

/** Best-effort delete of a previously-uploaded photo by its download URL. */
export async function deleteJournalPhoto(url: string): Promise<void> {
  try {
    await deleteObject(storageRef(storage, url))
  } catch {
    // The object may already be gone, or the URL may not map to our bucket —
    // either way, dropping the reference from state is what matters.
  }
}
