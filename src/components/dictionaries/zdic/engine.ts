import { fetchDirtyDOM } from '@/_helpers/fetch-dom'
import {
  HTMLString,
  getInnerHTML,
  handleNoResult,
  handleNetWorkError,
  SearchFunction,
  GetSrcPageFunction,
  DictSearchResult
} from '../helpers'
import { getStaticSpeaker } from '@/components/Speaker'

export const getSrcPage: GetSrcPageFunction = text => {
  return `https://www.zdic.net/hans/${text}`
}

const HOST = 'https://www.zdic.net'

export type ZdicResult = Array<{
  title: string
  content: HTMLString
}>

type ZdicSearchResult = DictSearchResult<ZdicResult>

const ZDIC_REFERER_RULE_ID = 100

let isRefererModified = false

export const search: SearchFunction<ZdicResult> = (
  text,
  config,
  profile,
  payload
) => {
  const isAudio = profile.dicts.all.zdic.options.audio
  if (!isRefererModified && isAudio) {
    isRefererModified = true
    modifyReferer()
  }

  return fetchDirtyDOM(
    'https://www.zdic.net/hans/' + encodeURIComponent(text.replace(/\s+/g, ' '))
  )
    .catch(handleNetWorkError)
    .then(doc => handleDOM(doc, isAudio))
}

function handleDOM(
  doc: Document,
  isAudio: boolean
): ZdicSearchResult | Promise<ZdicSearchResult> {
  const response: ZdicSearchResult = {
    result: []
  }

  for (const $entry of doc.querySelectorAll<HTMLDivElement>(
    '[data-type-block]'
  )) {
    const title = $entry.dataset.typeBlock || ''
    if (!/基本解释|词语解释|详细解释/.test(title)) {
      continue
    }

    for (const $a of $entry.querySelectorAll<HTMLAnchorElement>(
      '[data-src-mp3]'
    )) {
      if (isAudio) {
        if (!response.audio) {
          response.audio = {
            py: $a.dataset.srcMp3
          }
        }
        $a.replaceWith(getStaticSpeaker($a.dataset.srcMp3))
      } else {
        $a.remove()
      }
    }

    response.result.push({
      title,
      content: getInnerHTML(HOST, $entry, '.content')
    })
  }

  return response.result.length > 0 ? response : handleNoResult()
}

async function modifyReferer() {
  // In MV3, use declarativeNetRequest to modify headers
  try {
    // First remove any existing rule with this ID
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ZDIC_REFERER_RULE_ID]
    })

    // Add the new rule
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [
        {
          id: ZDIC_REFERER_RULE_ID,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: 'Referer',
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: 'https://www.zdic.net'
              }
            ]
          },
          condition: {
            urlFilter: 'https://img.zdic.net/audio/*',
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MEDIA,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.OTHER
            ]
          }
        }
      ]
    })
  } catch (error) {
    console.warn('Failed to set up declarativeNetRequest rule for zdic:', error)
  }
}
