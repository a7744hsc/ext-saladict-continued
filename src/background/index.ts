import './env'
import './initialization'
import { getConfig, addConfigListener } from '@/_helpers/config-manager'
import {
  createActiveProfileStream,
  createProfileIDListStream
} from '@/_helpers/profile-manager'
import { message } from '@/_helpers/browser-api'
import { startSyncServiceInterval } from './sync-manager'
import { init as initPdf } from './pdf-sniffer'
import { ContextMenus } from './context-menus'
import { BackgroundServer } from './server'
import { initBadge } from './badge'
import { setupCaiyunTrsBackend } from './page-translate/caiyun'
import { setupRequestGAListener } from '@/_helpers/analytics'
import './types'
import { AppConfig } from '@/app-config'
import { Profile, ProfileIDList } from '@/app-config/profiles'

console.log('[SALADICT] Background script starting...')

// Global state for service worker (stored in memory, will be lost on worker restart)
let appConfig: AppConfig | null = null
let activeProfile: Profile | null = null
let profileIDList: ProfileIDList | null = null

// Export getters for global state
export function getAppConfig(): AppConfig | null {
  return appConfig
}

export function getActiveProfile(): Profile | null {
  return activeProfile
}

export function getProfileIDList(): ProfileIDList | null {
  return profileIDList
}

// init first to receive self messaging
message.self.initServer()

console.log('[SALADICT] initServer done')

startSyncServiceInterval()

ContextMenus.init()
BackgroundServer.init()

console.log('[SALADICT] BackgroundServer initialized')

setupCaiyunTrsBackend()

setupRequestGAListener()

getConfig().then(async config => {
  appConfig = config
  initPdf(config)
  initBadge()

  addConfigListener(({ newConfig }) => {
    appConfig = newConfig
  })
})

createActiveProfileStream().subscribe(profile => {
  activeProfile = profile
})

createProfileIDListStream().subscribe(list => {
  profileIDList = list
})
