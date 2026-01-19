/**
 * To make sure only one audio plays at a time
 * Uses offscreen document for audio playback in MV3 service worker
 */

let creatingOffscreen: Promise<void> | null = null

async function setupOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html')

  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [offscreenUrl]
  })

  if (existingContexts.length > 0) {
    return
  }

  // Create offscreen document if it doesn't exist
  if (creatingOffscreen) {
    await creatingOffscreen
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [
        chrome.offscreen.Reason.AUDIO_PLAYBACK,
        chrome.offscreen.Reason.CLIPBOARD
      ],
      justification: 'Audio playback and clipboard access for dictionary lookups'
    })
    await creatingOffscreen
    creatingOffscreen = null
  }
}

export class AudioManager {
  private static instance: AudioManager

  static getInstance() {
    return AudioManager.instance || (AudioManager.instance = new AudioManager())
  }

  // singleton
  // eslint-disable-next-line no-useless-constructor
  private constructor() {}

  currentSrc?: string

  reset() {
    setupOffscreenDocument().then(() => {
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'OFFSCREEN_STOP_AUDIO'
      })
    })
    this.currentSrc = ''
  }

  async play(src?: string): Promise<void> {
    if (!src || src === this.currentSrc) {
      this.reset()
      return
    }

    this.currentSrc = src
    await setupOffscreenDocument()
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'OFFSCREEN_PLAY_AUDIO',
      payload: src
    })
    this.currentSrc = ''
  }
}

