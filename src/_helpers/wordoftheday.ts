// Word of the Day feature is disabled to reduce bundle size
// The feature required cheerio which is only available in Service Worker

export async function getWordOfTheDay(): Promise<string> {
  // Return default word - actual word of the day feature is disabled
  return 'salad'
}

export async function getWebsterWordOfTheDay(): Promise<string> {
  return 'salad'
}

export async function getDictionaryWordOfTheDay(): Promise<string> {
  return 'salad'
}
