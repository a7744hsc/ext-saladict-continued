/**
 * Offscreen document for operations that require DOM access
 * (audio playback, clipboard operations)
 */

let currentAudio: HTMLAudioElement | null = null
let currentSrc = ''

// Handle messages from the service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') {
    return false
  }

  switch (message.type) {
    case 'OFFSCREEN_PLAY_AUDIO':
      playAudio(message.payload).then(sendResponse)
      return true
    case 'OFFSCREEN_STOP_AUDIO':
      stopAudio()
      sendResponse()
      return false
    case 'OFFSCREEN_GET_CLIPBOARD':
      getClipboard().then(sendResponse)
      return true
    case 'OFFSCREEN_SET_CLIPBOARD':
      setClipboard(message.payload).then(sendResponse)
      return true
    default:
      return false
  }
})

async function playAudio(src: string): Promise<void> {
  if (!src || src === currentSrc) {
    stopAudio()
    return
  }

  stopAudio()
  currentSrc = src
  currentAudio = new Audio(src)

  const onEnd = Promise.race([
    new Promise<void>(resolve => {
      if (currentAudio) {
        currentAudio.onended = () => resolve()
      }
    }),
    new Promise<void>(resolve => setTimeout(resolve, 20000))
  ])

  await currentAudio.play()
  await onEnd

  currentSrc = ''
}

function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio.src = ''
    currentAudio.onended = null
    currentAudio = null
  }
  currentSrc = ''
}

async function getClipboard(): Promise<string> {
  try {
    // Try the modern Clipboard API first
    const text = await navigator.clipboard.readText()
    return text
  } catch {
    // Fallback to execCommand for older browsers or when Clipboard API is not available
    const el = document.getElementById('saladict-paste') as HTMLTextAreaElement
    if (el) {
      el.value = ''
      el.focus()
      document.execCommand('paste')
      return el.value || ''
    }
    return ''
  }
}

async function setClipboard(text: string): Promise<void> {
  try {
    // Try the modern Clipboard API first
    await navigator.clipboard.writeText(text)
  } catch {
    // Fallback to execCommand
    const copyFrom = document.createElement('textarea')
    copyFrom.textContent = text
    document.body.appendChild(copyFrom)
    copyFrom.select()
    document.execCommand('copy')
    copyFrom.blur()
    document.body.removeChild(copyFrom)
  }
}

export {}
