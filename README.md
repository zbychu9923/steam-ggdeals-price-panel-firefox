# Steam GG.deals price panel for Firefox

A Firefox extension that adds a Steam-styled price comparison panel to Steam game pages and displays the lowest current price from official stores and keyshops using the GG.deals API.

## Disclaimer

This is an independent third-party project.

This extension is **not affiliated with, endorsed by, sponsored by, or associated with** Valve, Steam, or GG.deals in any way.

"Steam", "Valve", and "GG.deals" are trademarks or property of their respective owners. All such names are used strictly for descriptive, informational, and compatibility purposes only.

## Features

- Works on Steam game pages:
  - `https://store.steampowered.com/app/*`
  - `https://store.steampowered.com/agecheck/app/*`
- Inserts a custom panel into the right sidebar (`.rightcol.game_meta_data`)
- Shows:
  - lowest current price in official stores
  - lowest current price in keyshops
  - historical minimum prices when available
- Opens the matching GG.deals page in a new tab when a price card is clicked
- Steam-inspired styling for both the page widget and the popup
- User-provided GG.deals API key stored locally in the browser
- Local caching to reduce API usage
- Automatic language selection based on browser UI language
- Built-in translations with manual language override
- Optional custom per-game footer messages just because it can be fun :)

## Supported languages

- English
- Polish

Default language selection order:
1. saved extension setting
2. browser UI language
3. English fallback

## Installation

Install the extension from Firefox Add-ons when a public release is available.

## Extension setup

1. Open the extension popup from the Firefox toolbar.
2. Get your personal [API key from GG.deals](https://gg.deals/api) .
3. Paste the API key into the extension settings.
4. Select your GG.deals currency / region.
5. Select the extension language or keep automatic detection.
6. Save the settings.
7. Refresh any already-open Steam game page if needed.

## How it works

The extension reads the Steam App ID from the current Steam product page URL and requests pricing data from the GG.deals API endpoint for Steam app IDs.

It then renders a custom panel in the Steam sidebar and links the price cards to the corresponding GG.deals page for that game.

## Project structure

```text
icons/
  icon48.png
  icon96.png
src/
  background.js
  content.js
  content.css
  custom-messages.js
  i18n.js
  popup.html
  popup.css
  popup.js
  locales/
    en.json
    pl.json
manifest.json
README.md
LICENSE