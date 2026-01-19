import { message } from '@/_helpers/browser-api'
import { Subject } from 'rxjs'
import { switchMapBy } from '@/_helpers/observables'
import { timer } from '@/_helpers/promise-more'
import { getAppConfig } from './index'

// Static imports for locales - dynamic import() doesn't work in service workers
import { locale as localeEn } from '@/_locales/en/background'
import { locale as localeZhCN } from '@/_locales/zh-CN/background'
import { locale as localeZhTW } from '@/_locales/zh-TW/background'

// Locale map for service worker compatibility
const locales: Record<string, typeof localeEn> = {
  'en': localeEn,
  'zh-CN': localeZhCN,
  'zh-TW': localeZhTW,
}

function getLocale(langCode: string) {
  return locales[langCode] || locales['en']
}

// Use chrome.action for MV3, fallback to chrome.browserAction for MV2
function getActionAPI() {
  return chrome.action || (chrome as any).browserAction
}

interface UpdateBadgeOptions {
  active: boolean
  tempDisable: boolean
  unsupported: boolean
}

const onUpdated$ = new Subject<{
  delay?: boolean
  tabId: number
  options?: UpdateBadgeOptions
}>()

onUpdated$
  .pipe(
    switchMapBy('tabId', async o => {
      if (o.options) {
        return o as Required<typeof o>
      }

      if (o.delay) {
        await timer(1000)
      }

      const appConfig = getAppConfig()
      return {
        tabId: o.tabId,
        options: (await message
          .send<'GET_TAB_BADGE_INFO'>(o.tabId, {
            type: 'GET_TAB_BADGE_INFO'
          })
          .catch(() => {})) || {
          active: appConfig?.active ?? true,
          tempDisable: false,
          unsupported: true
        }
      }
    })
  )
  .subscribe(({ tabId, options }) => {
    if (!options.active) {
      return setOff(tabId)
    }

    if (options.tempDisable) {
      return setTempOff(tabId)
    }

    if (options.unsupported) {
      return setUnsupported(tabId)
    }

    return setDefault(tabId)
  })

export function initBadge() {
  /** Sent when content script loaded */
  message.addListener('SEND_TAB_BADGE_INFO', ({ payload }, sender) => {
    if (sender.tab && sender.tab.id) {
      onUpdated$.next({ tabId: sender.tab.id, options: payload })
    }
  })

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      onUpdated$.next({ tabId, delay: true })
    }
  })
}

function setOff(tabId: number) {
  const appConfig = getAppConfig()
  setIcon(true, tabId)
  const langCode = appConfig?.langCode || 'en'
  const locale = getLocale(langCode)
  const actionAPI = getActionAPI()
  if (actionAPI) {
    actionAPI.setTitle({
      title: locale.app.off,
      tabId
    })
  }
}

function setTempOff(tabId: number) {
  const appConfig = getAppConfig()
  setIcon(true, tabId)
  const langCode = appConfig?.langCode || 'en'
  const locale = getLocale(langCode)
  const actionAPI = getActionAPI()
  if (actionAPI) {
    actionAPI.setTitle({
      title: locale.app.tempOff,
      tabId
    })
  }
}

function setUnsupported(tabId: number) {
  const appConfig = getAppConfig()
  setIcon(true, tabId)
  const langCode = appConfig?.langCode || 'en'
  const locale = getLocale(langCode)
  const actionAPI = getActionAPI()
  if (actionAPI) {
    actionAPI.setTitle({
      title: locale.app.unsupported,
      tabId
    })
  }
}

function setDefault(tabId: number) {
  setIcon(false, tabId)
  // chrome.action.setBadgeText({ text: '', tabId })
  // chrome.action.setTitle({ title: '', tabId })
}

function setIcon(gray: boolean, tabId: number) {
  const actionAPI = getActionAPI()
  if (!actionAPI) {
    console.warn('Neither chrome.action nor chrome.browserAction available')
    return
  }
  actionAPI.setIcon({
    tabId,
    path: gray
      ? {
          16: 'assets/icon-gray-16.png',
          19: 'assets/icon-gray-19.png',
          24: 'assets/icon-gray-24.png',
          38: 'assets/icon-gray-38.png',
          48: 'assets/icon-gray-48.png',
          128: 'assets/icon-gray-128.png'
        }
      : {
          16: 'assets/icon-16.png',
          19: 'assets/icon-19.png',
          24: 'assets/icon-24.png',
          38: 'assets/icon-38.png',
          48: 'assets/icon-48.png',
          128: 'assets/icon-128.png'
        }
  })
}
