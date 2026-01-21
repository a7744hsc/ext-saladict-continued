# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Saladict is a Chrome/Firefox WebExtension for inline translation, powered by multiple online dictionaries (Baidu, Caiyun, Google, Sogou, Tencent, Youdao, etc.) with PDF support.

## Common Commands

```bash
# Development
yarn start          # Webpack dev-server with hot reload
yarn storybook      # Start Storybook for component development
yarn fixtures       # Download test fixtures for dictionaries (run before storybook)

# Testing & Quality
yarn test           # Run Jest tests
yarn test:watch     # Jest in watch mode
yarn lint           # ESLint check
yarn type-check     # TypeScript compiler check

# Building (requires NODE_OPTIONS for Node.js 17+)
export NODE_OPTIONS=--openssl-legacy-provider
npm run build       # Production build
npm run devbuild    # Development build (no minification)
yarn zip            # Create WebExtension zip file

# Build Flags
# --debug: Remove compression, generate sourcemaps
# --analyze: Show webpack bundle analyzer
# --wextentry [entry-id]: Build specific entry only
```

## Initial Setup

```bash
git clone <repo>
yarn install
yarn pdf            # Generate PDF-related assets (required)
cp .env.example .env  # Add API keys if needed
```

**Note**: May require `NODE_OPTIONS=--openssl-legacy-provider` for older Node.js compatibility.

## Architecture

### Tech Stack
- **Language**: TypeScript + React 16
- **State Management**: Redux + Redux-Observable (RxJS)
- **UI**: Ant Design 4.x, SCSS with CSS Modules
- **Build**: Webpack 4 via Neutrino 9 with WebExtension preset
- **Database**: Dexie.js (IndexedDB wrapper)
- **Testing**: Jest with sinon-chrome for browser API mocking

### WebExtension Entry Points

The `.neutrinorc.js` defines 11 entry points built independently:

| Entry | Purpose |
|-------|---------|
| `background` | Service worker, event handling, message routing |
| `content` | Injected into all webpages |
| `selection` | Text selection handling (all frames) |
| `popup` | Browser action popup UI |
| `options` | Settings page |
| `notebook` | Word notebook/list view |
| `history` | Search history page |
| `quick-search` | Quick search interface |
| `word-editor` | Word editing interface |
| `audio-control` | Audio control page |
| `offscreen` | Audio processing (MV3 compatible) |

### Key Directories

```
src/
├── _helpers/           # Browser API helpers, utilities
├── _locales/           # i18n translations (en, es, ne, zh-CN, zh-TW)
├── app-config/         # App and dictionary configuration
├── background/         # Background script + database, sync
├── components/
│   └── dictionaries/   # Dictionary implementations
├── content/            # Content script entry
└── [entry-name]/       # Other entry points (popup, options, etc.)
```

## Adding a Dictionary

Each dictionary in `src/components/dictionaries/[dictID]/` requires:

1. **config.ts** - Default options, selectors, profiles
2. **engine.ts** - Must implement:
   - `getSrcPage(text, config, profile)` - Returns source URL
   - `search(text, config, profile, payload)` - Returns search result
3. **View.tsx** - React presentational component (dumb component)
4. **_style.scss** - ECSS-style selectors (prefix with dictionary name)
5. **favicon.png** - Dictionary logo
6. **_locales.json** - Localized strings

**Important**: Dictionary IDs must be added in alphabetical order in configuration files.

Register audio support in `src/components/dictionaries/helpers.ts` if the dictionary supports audio playback.

## Code Conventions

- **Style**: Standard.js + Prettier (single quotes, no semicolons)
- **Commits**: Conventional Commits format (use `yarn commit` for interactive commit)
- **SCSS Naming**: ECSS-style selectors prefixed with component/dictionary name
- **Components**: React PureComponents for presentational components
- **Shadow DOM**: Uses react-shadow for component isolation in web pages
