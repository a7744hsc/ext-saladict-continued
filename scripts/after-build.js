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
  const chromeBuildPath = path.join(__dirname, '../build/chrome')

  if (await fs.pathExists(manifestPath)) {
    const manifest = await fs.readJson(manifestPath)

    // Fix background for MV3 - remove scripts array and create service worker with importScripts
    if (manifest.background) {
      const backgroundScripts = manifest.background.scripts || []
      delete manifest.background.scripts

      // Create a bundled service worker for MV3
      // Combine all scripts into one file to avoid webpack chunk loading issues
      if (backgroundScripts.length > 0) {
        let bundledContent = '// Bundled Service Worker for Saladict - Manifest V3\n'
        bundledContent += '// This file combines all background scripts to avoid webpack chunk loading issues\n\n'

        for (const script of backgroundScripts) {
          const scriptPath = path.join(chromeBuildPath, script)
          if (await fs.pathExists(scriptPath)) {
            const content = await fs.readFile(scriptPath, 'utf8')
            bundledContent += `// === ${script} ===\n`
            bundledContent += content + '\n\n'
          } else {
            console.warn(`Warning: Background script not found: ${script}`)
          }
        }

        // Fix window references for Service Worker compatibility
        bundledContent = fixWindowReferencesForServiceWorker(bundledContent)

        await fs.outputFile(
          path.join(chromeBuildPath, 'background.js'),
          bundledContent
        )
        console.log('Created bundled service worker with', backgroundScripts.length, 'scripts')
      }

      // Use classic service worker (not module) since we're using bundled scripts
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

/**
 * Fix window references in bundled service worker code.
 * Service Workers don't have 'window' object, need to use 'self' or 'globalThis'.
 */
function fixWindowReferencesForServiceWorker(content) {
  let modified = content

  // Replace window.saladictEntry with self.saladictEntry
  modified = modified.replace(/window\.saladictEntry/g, 'self.saladictEntry')

  // Add a global shim at the beginning to handle window/global references
  // This creates aliases for code that expects browser or Node.js globals
  const windowShim = `
// Service Worker compatibility shim
// Ensure 'self' is the global scope
var self = typeof self !== 'undefined' ? self : this;
var window = typeof window !== 'undefined' ? window : self;
var global = typeof global !== 'undefined' ? global : self;
var globalThis = typeof globalThis !== 'undefined' ? globalThis : self;

// Location polyfill - Service Workers have self.location but some code expects window.location
var location = self.location || {
  href: 'chrome-extension://placeholder/',
  protocol: 'chrome-extension:',
  host: 'placeholder',
  hostname: 'placeholder',
  port: '',
  pathname: '/',
  search: '',
  hash: '',
  origin: 'chrome-extension://placeholder'
};

// Navigator polyfill - Service Workers have self.navigator
var navigator = self.navigator || {
  userAgent: 'Mozilla/5.0 Chrome Service Worker',
  language: 'en',
  languages: ['en'],
  platform: 'Win32'
};

var document = typeof document !== 'undefined' ? document : undefined;

// Minimal document polyfill for Service Worker
// Some libraries check for document existence or use document.createElement
if (typeof document === 'undefined' || document === undefined) {
  var document = {
    createElement: function(tag) {
      var el = {
        tagName: tag.toUpperCase(),
        style: {},
        setAttribute: function(name, value) { this[name] = value; },
        getAttribute: function(name) { return this[name] || null; },
        appendChild: function() {},
        removeChild: function() {},
        innerHTML: '',
        textContent: '',
        childNodes: [],
        children: []
      };
      // Special handling for anchor elements used by axios for URL parsing
      if (tag.toLowerCase() === 'a') {
        el.href = '';
        el.protocol = '';
        el.host = '';
        el.hostname = '';
        el.port = '';
        el.pathname = '/';
        el.search = '';
        el.hash = '';
        // Override setAttribute to parse href like a real anchor
        el.setAttribute = function(name, value) {
          this[name] = value;
          if (name === 'href' && value) {
            try {
              var url = new URL(value, location.href);
              this.protocol = url.protocol;
              this.host = url.host;
              this.hostname = url.hostname;
              this.port = url.port;
              this.pathname = url.pathname;
              this.search = url.search;
              this.hash = url.hash;
            } catch(e) {
              // If URL parsing fails, keep defaults
              this.pathname = '/';
            }
          }
        };
      }
      return el;
    },
    createTextNode: function(text) {
      return { textContent: text, nodeType: 3 };
    },
    createDocumentFragment: function() {
      return { childNodes: [], appendChild: function(n) { this.childNodes.push(n); } };
    },
    body: null,
    documentElement: null,
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    getElementById: function() { return null; },
    getElementsByTagName: function() { return []; },
    getElementsByClassName: function() { return []; }
  };
}

// DOMParser - DO NOT polyfill here!
// The cheerio-based polyfill in fetch-dom.ts handles DOM parsing properly.
// If we define DOMParser here, the code will try to use it instead of cheerio.
// Leave DOMParser undefined so parseHTML() in fetch-dom.ts uses the cheerio polyfill.

// Process polyfill for libraries that expect Node.js process
var process = process || {
  env: {},
  nextTick: function(fn) { setTimeout(fn, 0); },
  browser: true,
  version: '',
  versions: {},
  platform: 'browser'
};

// Buffer polyfill for libraries that expect Node.js Buffer
var Buffer = Buffer || {
  isBuffer: function() { return false; },
  from: function(data, encoding) {
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    return new Uint8Array(data);
  },
  alloc: function(size) { return new Uint8Array(size); },
  allocUnsafe: function(size) { return new Uint8Array(size); },
  concat: function(arrays) {
    var totalLength = arrays.reduce(function(sum, arr) { return sum + arr.length; }, 0);
    var result = new Uint8Array(totalLength);
    var offset = 0;
    arrays.forEach(function(arr) {
      result.set(arr, offset);
      offset += arr.length;
    });
    return result;
  }
};

// XMLHttpRequest polyfill using fetch for Service Worker compatibility
if (typeof XMLHttpRequest === 'undefined') {
  var XMLHttpRequest = function() {
    this.readyState = 0;
    this.status = 0;
    this.statusText = '';
    this.response = null;
    this.responseText = '';
    this.responseType = '';
    this.timeout = 0;
    this.withCredentials = false;
    this._headers = {};
    this._method = 'GET';
    this._url = '';
    this._async = true;
  };
  XMLHttpRequest.UNSENT = 0;
  XMLHttpRequest.OPENED = 1;
  XMLHttpRequest.HEADERS_RECEIVED = 2;
  XMLHttpRequest.LOADING = 3;
  XMLHttpRequest.DONE = 4;
  XMLHttpRequest.prototype.open = function(method, url, async) {
    this._method = method;
    this._url = url;
    this._async = async !== false;
    this.readyState = 1;
    if (this.onreadystatechange) this.onreadystatechange();
  };
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    this._headers[name] = value;
  };
  XMLHttpRequest.prototype.getResponseHeader = function(name) {
    return this._responseHeaders ? this._responseHeaders.get(name) : null;
  };
  XMLHttpRequest.prototype.getAllResponseHeaders = function() {
    if (!this._responseHeaders) return '';
    var result = [];
    this._responseHeaders.forEach(function(value, name) {
      result.push(name + ': ' + value);
    });
    return result.join('\\r\\n');
  };
  XMLHttpRequest.prototype.send = function(body) {
    var self = this;
    var fetchOptions = {
      method: this._method,
      headers: this._headers,
      credentials: this.withCredentials ? 'include' : 'omit'
    };
    if (body && this._method !== 'GET' && this._method !== 'HEAD') {
      fetchOptions.body = body;
    }

    self.readyState = 2;
    if (self.onreadystatechange) self.onreadystatechange();

    fetch(this._url, fetchOptions)
      .then(function(response) {
        self._responseHeaders = response.headers;
        self.status = response.status;
        self.statusText = response.statusText;
        self.readyState = 3;
        if (self.onreadystatechange) self.onreadystatechange();

        if (self.responseType === 'arraybuffer') {
          return response.arrayBuffer();
        } else if (self.responseType === 'blob') {
          return response.blob();
        } else if (self.responseType === 'json') {
          return response.json();
        } else {
          return response.text();
        }
      })
      .then(function(data) {
        if (self.responseType === '' || self.responseType === 'text') {
          self.responseText = data;
          self.response = data;
        } else {
          self.response = data;
        }
        self.readyState = 4;
        if (self.onreadystatechange) self.onreadystatechange();
        if (self.onload) self.onload();
      })
      .catch(function(error) {
        self.readyState = 4;
        self.status = 0;
        if (self.onreadystatechange) self.onreadystatechange();
        if (self.onerror) self.onerror(error);
      });
  };
  XMLHttpRequest.prototype.abort = function() {
    this.readyState = 0;
    if (this.onabort) this.onabort();
  };
}
`
  modified = windowShim + modified

  console.log('Fixed window references for Service Worker compatibility')
  return modified
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
