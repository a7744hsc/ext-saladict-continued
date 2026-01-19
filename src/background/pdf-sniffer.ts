/**
 * Open pdf link directly
 * Uses declarativeNetRequest for MV3 instead of webRequest blocking
 */

import { AppConfig } from '@/app-config'
import { addConfigListener } from '@/_helpers/config-manager'
import { openUrl } from '@/_helpers/browser-api'
import { getAppConfig } from './index'

const PDF_REDIRECT_RULE_ID = 1

export function init(config: AppConfig) {
  if (config.pdfSniff) {
    startListening()
  }

  addConfigListener(({ newConfig, oldConfig }) => {
    if (newConfig) {
      if (!oldConfig || newConfig.pdfSniff !== oldConfig.pdfSniff) {
        if (newConfig.pdfSniff) {
          startListening()
        } else {
          stopListening()
        }
      }
    }
  })
}

/**
 * @param url provide a url
 * @param force load the current tab anyway
 */
export async function openPDF(url?: string, force?: boolean) {
  const appConfig = getAppConfig()
  let pdfURL = browser.runtime.getURL('assets/pdf/web/viewer.html')

  if (url) {
    pdfURL += '?file=' + encodeURIComponent(url)
  } else {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    if (tabs.length > 0 && tabs[0].url) {
      const curURL = tabs[0].url
      if (curURL.startsWith(pdfURL)) {
        if (appConfig?.pdfStandalone) {
          if (tabs[0].id != null) {
            await browser.tabs.remove(tabs[0].id)
          }
          pdfURL = curURL
        } else {
          return // ignore pdf viewer url
        }
      } else if (force || curURL.endsWith('pdf')) {
        pdfURL += '?file=' + encodeURIComponent(curURL)
      }
    }
  }

  return appConfig?.pdfStandalone
    ? openPDFStandalone(pdfURL)
    : openUrl({ url: pdfURL, unique: false })
}

export function extractPDFUrl(fullurl?: string): string | void {
  if (!fullurl) {
    return
  }
  const searchURL = new URL(fullurl)
  return decodeURIComponent(searchURL.searchParams.get('file') || '')
}

async function startListening() {
  const appConfig = getAppConfig()
  const pdfViewerUrl = browser.runtime.getURL('assets/pdf/web/viewer.html')

  // Build regex patterns for blacklist/whitelist
  const blacklistPatterns = appConfig?.pdfBlacklist?.map(([r]) => r) || []
  const whitelistPatterns = appConfig?.pdfWhitelist?.map(([r]) => r) || []

  // Create declarativeNetRequest rules for PDF redirection
  // Note: MV3 declarativeNetRequest has limitations compared to webRequest
  // We can only do static redirects, not dynamic ones based on content-type headers
  // For HTTP PDFs detected by content-type, we'll use a different approach

  const rules: chrome.declarativeNetRequest.Rule[] = [
    {
      id: PDF_REDIRECT_RULE_ID,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: {
          regexSubstitution: `${pdfViewerUrl}?file=\\0`
        }
      },
      condition: {
        regexFilter: '^(ftp|file)://.*\\.pdf$',
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
          chrome.declarativeNetRequest.ResourceType.SUB_FRAME
        ]
      }
    }
  ]

  // Remove existing rules and add new ones
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
    const existingRuleIds = existingRules.map(rule => rule.id)

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: rules
    })
  } catch (error) {
    console.error('Failed to update declarativeNetRequest rules:', error)
  }

  // For HTTP/HTTPS PDFs, we need to use a different approach
  // Listen for tab updates and check for PDF content
  if (!chrome.tabs.onUpdated.hasListener(pdfTabListener)) {
    chrome.tabs.onUpdated.addListener(pdfTabListener)
  }
}

async function stopListening() {
  // Remove declarativeNetRequest rules
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
    const existingRuleIds = existingRules.map(rule => rule.id)

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: []
    })
  } catch (error) {
    console.error('Failed to remove declarativeNetRequest rules:', error)
  }

  // Remove tab listener
  if (chrome.tabs.onUpdated.hasListener(pdfTabListener)) {
    chrome.tabs.onUpdated.removeListener(pdfTabListener)
  }
}

async function pdfTabListener(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
) {
  // Only check when the page is fully loaded
  if (changeInfo.status !== 'complete' || !tab.url) {
    return
  }

  const appConfig = getAppConfig()
  if (!appConfig?.pdfSniff) {
    return
  }

  const url = tab.url

  // Check blacklist/whitelist
  const matchURL = ([r]: ReadonlyArray<string>) => new RegExp(r).test(url)
  if (
    appConfig.pdfBlacklist?.some(matchURL) &&
    !appConfig.pdfWhitelist?.some(matchURL)
  ) {
    return
  }

  // Check if URL ends with .pdf (case insensitive)
  if (/\.pdf$/i.test(url) && !url.includes('viewer.html')) {
    const pdfViewerUrl = browser.runtime.getURL('assets/pdf/web/viewer.html')
    const redirectUrl = `${pdfViewerUrl}?file=${encodeURIComponent(url)}`

    if (appConfig.pdfStandalone === 'always') {
      await browser.tabs.remove(tabId)
      openPDFStandalone(redirectUrl)
    } else {
      await browser.tabs.update(tabId, { url: redirectUrl })
    }
  }
}

function openPDFStandalone(url: string) {
  return browser.windows.create({ type: 'popup', url })
}
