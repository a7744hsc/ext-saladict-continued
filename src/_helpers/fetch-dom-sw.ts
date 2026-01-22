import axios, { AxiosRequestConfig } from 'axios'
// Static import for cheerio polyfill - required for Service Worker DOM parsing
import { parseHTMLToDocument } from './dom-parser-polyfill'

// This version is for Service Worker (background script in MV3)
// It uses cheerio-based polyfill since DOMParser is not available in Service Workers

// Default headers to mimic browser requests
// Some sites (like Google) return different content based on User-Agent
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
}

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
    headers: {
      ...DEFAULT_HEADERS,
      ...config.headers
    },
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
  const { data } = await axios(url, {
    withCredentials: false,
    ...config,
    headers: {
      ...DEFAULT_HEADERS,
      ...config.headers
    },
    transformResponse: [data => data],
    responseType: 'text'
  })
  return parseHTML(data)
}

export function fetchPlainText(
  url: string,
  config: AxiosRequestConfig = {}
): Promise<string> {
  return axios(url, {
    withCredentials: false,
    ...config,
    headers: {
      ...DEFAULT_HEADERS,
      ...config.headers
    },
    // axios bug https://github.com/axios/axios/issues/907
    transformResponse: [data => data],
    responseType: 'text'
  }).then(({ data }) => data)
}
