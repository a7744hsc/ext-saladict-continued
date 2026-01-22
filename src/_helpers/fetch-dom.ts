import DOMPurify from 'dompurify'
import axios, { AxiosRequestConfig } from 'axios'

// This version is for browser pages (popup, options, content scripts)
// It uses native DOMParser which is available in browser contexts
// For Service Worker, use fetch-dom-sw.ts instead

/**
 * Parse HTML string to Document using native DOMParser.
 * This only works in browser contexts, not in Service Workers.
 */
export function parseHTML(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

/**
 * Sanitize HTML using DOMPurify
 */
function sanitizeHTML(html: string): DocumentFragment {
  return DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true })
}

export async function fetchDOM(
  url: string,
  config: AxiosRequestConfig = {}
): Promise<DocumentFragment> {
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
  const { data } = await axios(url, {
    withCredentials: false,
    ...config,
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
    // axios bug https://github.com/axios/axios/issues/907
    transformResponse: [data => data],
    responseType: 'text'
  }).then(({ data }) => data)
}
