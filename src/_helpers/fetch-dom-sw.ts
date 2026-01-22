import axios, { AxiosRequestConfig } from 'axios'
// Static import for cheerio polyfill - required for Service Worker DOM parsing
import { parseHTMLToDocument } from './dom-parser-polyfill'

// This version is for Service Worker (background script in MV3)
// It uses cheerio-based polyfill since DOMParser is not available in Service Workers

console.log('[SALADICT fetch-dom-sw] Service Worker fetch-dom loaded')

/**
 * Parse HTML string to Document using cheerio polyfill.
 * This works in Service Worker where native DOMParser is not available.
 */
export function parseHTML(html: string): Document {
  return parseHTMLToDocument(html) as unknown as Document
}

/**
 * In Service Worker, DOMPurify won't work (needs real DOM).
 * Return parsed document instead - HTML is from trusted dictionary sources.
 */
function sanitizeHTML(html: string): Document {
  return parseHTMLToDocument(html) as unknown as Document
}

export async function fetchDOM(
  url: string,
  config: AxiosRequestConfig = {}
): Promise<Document> {
  const { data } = await axios(url, {
    ...config,
    transformResponse: [data => data],
    responseType: 'text'
  })
  return sanitizeHTML(data)
}

/** about 6 time faster as it typically takes less than 5ms to parse a DOM */
export async function fetchDirtyDOM(
  url: string,
  config: AxiosRequestConfig = {}
): Promise<Document> {
  console.log('[SALADICT fetch-dom-sw] fetchDirtyDOM start:', url)
  try {
    const { data } = await axios(url, {
      withCredentials: false,
      ...config,
      transformResponse: [data => data],
      responseType: 'text'
    })
    console.log('[SALADICT fetch-dom-sw] fetchDirtyDOM got data, length:', data?.length)

    const doc = parseHTML(data)
    console.log('[SALADICT fetch-dom-sw] fetchDirtyDOM parsed')
    return doc
  } catch (e) {
    console.error('[SALADICT fetch-dom-sw] fetchDirtyDOM error:', e)
    throw e
  }
}

export function fetchPlainText(
  url: string,
  config: AxiosRequestConfig = {}
): Promise<string> {
  console.log('[SALADICT fetch-dom-sw] fetchPlainText start:', url)
  return axios(url, {
    withCredentials: false,
    ...config,
    // axios bug https://github.com/axios/axios/issues/907
    transformResponse: [data => data],
    responseType: 'text'
  }).then(({ data }) => {
    console.log('[SALADICT fetch-dom-sw] fetchPlainText got data, length:', data?.length)
    return data
  }).catch(e => {
    console.error('[SALADICT fetch-dom-sw] fetchPlainText error:', e)
    throw e
  })
}
