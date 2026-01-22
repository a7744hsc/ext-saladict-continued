import {
  HTMLString,
  handleNoResult,
  getInnerHTML,
  removeChildren,
  handleNetWorkError,
  SearchFunction,
  GetSrcPageFunction,
  DictSearchResult,
  getFullLink,
  getText,
  removeChild
} from '../helpers'
import { getStaticSpeaker } from '@/components/Speaker'
import { fetchPlainText, parseHTML } from '@/_helpers/fetch-dom-sw'
import axios from 'axios'

export const getSrcPage: GetSrcPageFunction = text => {
  return (
    'https://www.google.com.hk/search?hl=en&safe=off&q=meaning:' +
    encodeURIComponent(text.toLowerCase().replace(/\s+/g, '+'))
  )
}

export interface GoogleDictResult {
  entry: HTMLString
  styles: string[]
}

type GoogleDictSearchResult = DictSearchResult<GoogleDictResult>

// Free Dictionary API response types
interface FreeDictPhonetic {
  text?: string
  audio?: string
}

interface FreeDictDefinition {
  definition: string
  example?: string
  synonyms?: string[]
  antonyms?: string[]
}

interface FreeDictMeaning {
  partOfSpeech: string
  definitions: FreeDictDefinition[]
  synonyms?: string[]
  antonyms?: string[]
}

interface FreeDictEntry {
  word: string
  phonetics: FreeDictPhonetic[]
  meanings: FreeDictMeaning[]
}

/**
 * Convert Free Dictionary API response to HTML format
 * This is used as a fallback when Google Dictionary fails
 */
function convertFreeDictToHTML(entries: FreeDictEntry[]): GoogleDictResult {
  const entry = entries[0]
  if (!entry) {
    throw new Error('NO_RESULT')
  }

  let html = '<div class="lr_container fallback-dict">'

  // Word and phonetics
  html += `<div class="vkc_np"><div class="headword">${entry.word}</div>`

  // Phonetics
  const phonetic = entry.phonetics.find(p => p.text) || entry.phonetics[0]
  if (phonetic?.text) {
    html += `<div class="phonetic">${phonetic.text}</div>`
  }
  html += '</div>'

  // Meanings
  entry.meanings.forEach(meaning => {
    html += `<div class="vkc_np meaning-block">`
    html += `<div class="pos"><i>${meaning.partOfSpeech}</i></div>`
    html += '<ol class="definitions">'

    meaning.definitions.slice(0, 5).forEach(def => {
      html += '<li class="definition">'
      html += `<div class="def-text">${def.definition}</div>`
      if (def.example) {
        html += `<div class="example">"${def.example}"</div>`
      }
      html += '</li>'
    })

    html += '</ol>'

    // Synonyms
    if (meaning.synonyms && meaning.synonyms.length > 0) {
      html += `<div class="synonyms"><strong>syn:</strong> ${meaning.synonyms.slice(0, 5).join(', ')}</div>`
    }

    // Antonyms
    if (meaning.antonyms && meaning.antonyms.length > 0) {
      html += `<div class="antonyms"><strong>ant:</strong> ${meaning.antonyms.slice(0, 5).join(', ')}</div>`
    }

    html += '</div>'
  })

  html += '</div>'

  // Basic styles for the fallback dictionary
  const styles = [`
    .fallback-dict { font-family: Arial, sans-serif; padding: 10px; }
    .fallback-dict .headword { font-size: 1.5em; font-weight: bold; margin-bottom: 5px; }
    .fallback-dict .phonetic { color: #666; margin-bottom: 10px; }
    .fallback-dict .meaning-block { margin-bottom: 15px; }
    .fallback-dict .pos { color: #1a73e8; margin-bottom: 5px; }
    .fallback-dict .definitions { margin: 0; padding-left: 20px; }
    .fallback-dict .definition { margin-bottom: 8px; }
    .fallback-dict .def-text { margin-bottom: 3px; }
    .fallback-dict .example { color: #666; font-style: italic; margin-left: 10px; }
    .fallback-dict .synonyms, .fallback-dict .antonyms { color: #666; font-size: 0.9em; margin-top: 5px; }
  `]

  return { entry: html, styles }
}

/**
 * Fallback to Free Dictionary API when Google Dictionary fails
 */
async function fetchFromFreeDictAPI(text: string): Promise<GoogleDictSearchResult> {
  try {
    const response = await axios.get<FreeDictEntry[]>(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`,
      { timeout: 10000 }
    )

    if (response.data && response.data.length > 0) {
      const result = convertFreeDictToHTML(response.data)

      // Add audio if available
      const audioEntry = response.data[0].phonetics.find(p => p.audio)
      if (audioEntry?.audio) {
        return {
          result,
          audio: {
            us: audioEntry.audio
          }
        }
      }

      return { result }
    }
  } catch (e) {
    // Free Dictionary API failed, return no result
  }

  return handleNoResult<GoogleDictSearchResult>()
}

export const search: SearchFunction<GoogleDictResult> = async (
  text,
  config,
  profile,
  payload
) => {
  const isen = profile.dicts.all.googledict.options.enresult
    ? 'hl=en&gl=en&'
    : ''

  const encodedText = encodeURIComponent(
    text.toLowerCase().replace(/\s+/g, '+')
  )

  // Try Google first, then fallback to Free Dictionary API
  try {
    const googleResult = await fetchPlainText(
      `https://www.google.com/search?hl=en&safe=off&${isen}q=meaning:${encodedText}`
    )
      .catch(handleNetWorkError)
      .then(handleDOM)

    // If Google returns a valid result, use it
    if (googleResult.result) {
      return googleResult
    }
  } catch (e) {
    // Google search failed, will try fallback
  }

  // Try define: query
  try {
    const googleResult = await fetchPlainText(
      `https://www.google.com/search?hl=en&safe=off&${isen}q=define:${encodedText}`
    )
      .catch(handleNetWorkError)
      .then(handleDOM)

    if (googleResult.result) {
      return googleResult
    }
  } catch (e) {
    // Google define: search failed, will try fallback
  }

  // Fallback to Free Dictionary API
  return fetchFromFreeDictAPI(text)

  function handleDOM(
    bodyText: string
  ): GoogleDictSearchResult {
    const doc = parseHTML(bodyText)

    // mend fragments
    extFragements(bodyText).forEach(({ id, innerHTML }) => {
      try {
        const el = doc.querySelector(`#${id}`)
        if (el) {
          el.innerHTML = innerHTML
        }
      } catch (e) {
        // ignore
      }
    })

    // Note: Google may have changed their page structure.
    // If lr_container is not found, the dictionary result parsing will fail.
    const $obcontainer = doc.querySelector('.lr_container')
    if ($obcontainer) {
      $obcontainer
        .querySelectorAll<HTMLDivElement>('.vkc_np')
        .forEach($block => {
          if (
            $block.querySelector('.zbA8Me') || // Dictionary title
            $block.querySelector('#dw-siw') || // Search box
            $block.querySelector('#tl_select') // Translate to
          ) {
            $block.remove()
          }
        })

      removeChildren($obcontainer, '.lr_dct_trns_h') // other Translate to blocks
      removeChildren($obcontainer, '.S5TwIf') // Learn to pronounce
      removeChildren($obcontainer, '.VZVCid') // From Oxford
      removeChildren($obcontainer, '.u7XA4b') // footer
      removeChild($obcontainer, '[jsname=L4Nn5e]') // remove translate to

      // tts
      $obcontainer.querySelectorAll('audio').forEach($audio => {
        const $source = $audio.querySelector('source')

        let src =
          $source && getFullLink('https://ssl.gstatic.com', $source, 'src')

        if (!src) {
          src =
            'https://www.google.com/speech-api/v1/synthesize?enc=mpeg&lang=zh-cn&speed=0.4&client=lr-language-tts&use_google_only_voices=1&text=' +
            encodeURIComponent(text)
        }

        $audio.replaceWith(getStaticSpeaker(src))
      })

      $obcontainer
        .querySelectorAll('[role=listitem] > [jsname=F457ec]')
        .forEach($word => {
          // let saladict jump into the words
          // Use doc.createElement instead of document.createElement for Service Worker compatibility
          const $a = doc.createElement('a')
          $a.textContent = getText($word)
          Array.from($word.childNodes).forEach($child => {
            $child.remove()
          })
          $word.appendChild($a)
          // always appeared available
          $word.removeAttribute('style')
          $word.classList.add('MR2UAc')
          $word.classList.add('I6a0ee')
          $word.classList.remove('cO53qb')
        })

      $obcontainer.querySelectorAll('g-img > img').forEach($img => {
        const src = $img.getAttribute('title')
        if (src) {
          $img.setAttribute('src', src)
        }
      })

      extractImg(bodyText).forEach(({ id, src }) => {
        try {
          const el = $obcontainer.querySelector(`#${id}`)
          if (el) {
            el.setAttribute('src', src)
          }
        } catch (e) {
          // ignore
        }
      })

      const cleanText = getInnerHTML('https://www.google.com', $obcontainer, {
        config: {
          ADD_TAGS: ['g-img'],
          ADD_ATTR: ['jsname', 'jsaction']
        }
      })
        .replace(/synonyms:/g, 'syn:')
        .replace(/antonyms:/g, 'ant:')

      const styles: string[] = []
      doc.querySelectorAll('style').forEach($style => {
        const textContent = getText($style)
        if (textContent && /\.xpdxpnd|\.lr_container/.test(textContent)) {
          styles.push(textContent)
        }
      })

      return { result: { entry: cleanText, styles } }
    }

    // Return empty result instead of throwing, so we can fallback
    return { result: undefined as any }
  }
}

function extFragements(text: string): Array<{ id: string; innerHTML: string }> {
  const result: Array<{ id: string; innerHTML: string }> = []
  const matcher = /\(function\(\)\{window\.jsl\.dh\('([^']+)','([^']+)'\);\}\)\(\);/g
  let match: RegExpExecArray | null | undefined
  while ((match = matcher.exec(text))) {
    result.push({
      id: match[1],
      innerHTML: match[2]
        // escape \x
        .replace(/\\x([\da-f]{2})/gi, decodeHex)
        // escape \u
        .replace(/\\[u]([\da-f]{4})/gi, decodeHex)
    })
  }
  return result
}

function extractImg(text: string): Array<{ id: string; src: string }> {
  const kvPairMatch = /google.ldi={([^}]+)}/.exec(text)
  if (kvPairMatch) {
    try {
      const json = JSON.parse(`{${kvPairMatch[1]}}`)
      return Object.keys(json).map(key => ({ id: key, src: json[key] }))
    } catch (e) {
      // ignore
    }
  }
  return []
}

function decodeHex(m: string, code: string): string {
  return String.fromCharCode(parseInt(code, 16))
}
