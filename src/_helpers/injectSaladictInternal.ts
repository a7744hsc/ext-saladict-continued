export async function injectDictPanel(tab: browser.tabs.Tab | undefined) {
  if (tab && tab.id) {
    const tabId = tab.id
    const manifest = browser.runtime.getManifest()
    if (manifest.content_scripts) {
      for (const script of manifest.content_scripts) {
        if (script.js) {
          for (const js of script.js) {
            try {
              await chrome.scripting.executeScript({
                target: {
                  tabId,
                  allFrames: script.all_frames
                },
                files: [js[0] === '/' ? js : `/${js}`]
              })
            } catch (e) {
              // Script injection may fail on some pages (e.g., chrome:// pages)
              console.warn('Failed to inject script:', e)
            }
          }
        }
        if (script.css) {
          for (const css of script.css) {
            try {
              await chrome.scripting.insertCSS({
                target: {
                  tabId,
                  allFrames: script.all_frames
                },
                files: [css[0] === '/' ? css : `/${css}`]
              })
            } catch (e) {
              // CSS injection may fail on some pages
              console.warn('Failed to inject CSS:', e)
            }
          }
        }
      }
    }
  }
}
