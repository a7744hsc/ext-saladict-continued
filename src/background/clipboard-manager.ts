import { openUrl } from '@/_helpers/browser-api'

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

export async function copyTextToClipboard(text: string): Promise<void> {
  if (
    !(await browser.permissions.contains({ permissions: ['clipboardWrite'] }))
  ) {
    openUrl(
      '/options.html?menuselected=Permissions&missing_permission=clipboardWrite',
      true
    )
    return
  }

  await setupOffscreenDocument()
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'OFFSCREEN_SET_CLIPBOARD',
    payload: text
  })
}

export async function getTextFromClipboard(): Promise<string> {
  if (
    !(await browser.permissions.contains({ permissions: ['clipboardRead'] }))
  ) {
    openUrl(
      '/options.html?menuselected=Permissions&missing_permission=clipboardRead',
      true
    )
    return ''
  }

  if (process.env.NODE_ENV === 'development') {
    return 'clipboard content'
  }

  await setupOffscreenDocument()
  return await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'OFFSCREEN_GET_CLIPBOARD'
  }) || ''
}
