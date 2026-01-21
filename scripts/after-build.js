const fs = require('fs-extra')
const path = require('path')

module.exports = class AfterBuildPlugin {
  apply(compiler) {
    compiler.hooks.done.tapAsync(
      'AfterBuildPlugin',
      (compilation, callback) => {
        Promise.all([firefoxFix(), chromeMV3Fix()]).then(() => callback())
      }
    )
  }
}

async function firefoxFix() {
  await removeYoudaoFanyi()
  await removeCaiyun()
}

async function removeYoudaoFanyi() {
  // FF policy
  await fs.remove(
    path.join(__dirname, '../build/firefox/assets/fanyi.youdao.2.0')
  )
  // Stop FF extension check errors
  await fs.outputFile(
    path.join(__dirname, '../build/firefox/assets/fanyi.youdao.2.0/main.js'),
    ''
  )
}

async function removeCaiyun() {
  // FF policy
  // caiyun trs is close-sourced
  await fs.remove(path.join(__dirname, '../build/firefox/assets/trs.js'))
}

async function chromeMV3Fix() {
  const manifestPath = path.join(__dirname, '../build/chrome/manifest.json')
  const chromeAssetsPath = path.join(__dirname, '../build/chrome/assets')

  if (await fs.pathExists(manifestPath)) {
    const manifest = await fs.readJson(manifestPath)

    // Fix background for MV3 - remove scripts array and create service worker with importScripts
    if (manifest.background) {
      const backgroundScripts = manifest.background.scripts || []
      delete manifest.background.scripts

      // Create a service worker that uses importScripts (classic mode, not module)
      if (backgroundScripts.length > 0) {
        const scriptsList = backgroundScripts
          .map(script => `'${script}'`)
          .join(',\n  ')

        const serviceWorkerContent = `// Service worker for Saladict - Manifest V3
try {
  importScripts(
    ${scriptsList}
  );
} catch (e) {
  console.error('Service worker importScripts failed:', e);
}
`

        await fs.outputFile(
          path.join(__dirname, '../build/chrome/background.js'),
          serviceWorkerContent
        )
      }

      // Use classic service worker (not module) since we're using importScripts
      manifest.background = {
        service_worker: 'background.js'
      }
    }

    // Update action manifest if needed (browser_action -> action)
    if (manifest.browser_action && !manifest.action) {
      manifest.action = manifest.browser_action
      delete manifest.browser_action
    }

    // Ensure action is defined for MV3 (popup button)
    if (!manifest.action) {
      manifest.action = {
        default_icon: {
          '16': 'assets/icon-16.png',
          '19': 'assets/icon-19.png',
          '24': 'assets/icon-24.png',
          '38': 'assets/icon-38.png',
          '48': 'assets/icon-48.png',
          '128': 'assets/icon-128.png'
        },
        default_popup: 'popup.html'
      }
      console.log('Added action config to manifest')
    }

    await fs.writeJson(manifestPath, manifest, { spaces: 2 })

    // Fix window references in runtime chunk for service worker compatibility
    // Service workers don't have 'window' object, need to use 'globalThis' or 'self'
    await fixWindowReferencesInChrome(chromeAssetsPath)
  }
}

async function fixWindowReferencesInChrome(assetsPath) {
  const files = await fs.readdir(assetsPath)

  for (const file of files) {
    // Fix all JS files that may contain window.saladictEntry (webpack chunks)
    if (file.endsWith('.js')) {
      const filePath = path.join(assetsPath, file)
      let content = await fs.readFile(filePath, 'utf8')
      let modified = false

      // Check if file contains window.saladictEntry
      if (content.includes('window.saladictEntry')) {
        // Replace window.saladictEntry with self.saladictEntry
        // 'self' works in both service workers and regular pages
        content = content.replace(/window\.saladictEntry/g, 'self.saladictEntry')
        modified = true
        console.log(`Fixed window.saladictEntry references in ${file}`)
      }

      // Fix dynamic import() for service worker compatibility in runtime chunk
      // We need to detect at runtime if we're in a service worker or content script
      // Service workers use importScripts(), content scripts use import()
      if (file.startsWith('runtime.') && content.includes('import(o)')) {
        // Replace with runtime detection that uses importScripts in service worker
        // and import() in content scripts
        // ServiceWorkerGlobalScope has 'ServiceWorkerGlobalScope' in self
        content = content.replace(
          /import\(o\)\.catch\(\(\)=>\(\{type:"missing"\}\)\)/g,
          `(typeof ServiceWorkerGlobalScope!=='undefined'&&self instanceof ServiceWorkerGlobalScope?(function(){try{importScripts(o);return Promise.resolve()}catch(e){return Promise.reject({type:"missing"})}})():import(o).catch(function(){return{type:"missing"}}))`
        )
        modified = true
        console.log(`Fixed dynamic import() in ${file} for service worker compatibility`)
      }

      if (modified) {
        await fs.writeFile(filePath, content)
      }
    }
  }
}
