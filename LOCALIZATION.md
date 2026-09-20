# Localization

Every reader-facing string in zinejs (control labels and tooltips, side-panel and loading text, and
the screen-reader page announcement) defaults to English and can be translated through the `strings`
option. You supply the translations; nothing is bundled, so a book that stays in English pays nothing.

## Basic usage

Pass only the keys you want to change. Anything you leave out keeps its English default.

```js
import { Zine } from '@zinejs/core'

new Zine(document.getElementById('book'), {
  source,
  strings: {
    nextPage: 'Page suivante',
    prevPage: 'Page précédente',
    zoomIn: 'Agrandir',
    zoomOut: 'Réduire',
  },
})
```

## Static text and dynamic text

Most entries are plain strings. Entries that mix in a number or a piece of text are **functions**, so
a translation controls word order and pluralization directly, rather than filling blanks in a fixed
template:

```js
new Zine(el, {
  source,
  strings: {
    // The screen-reader announcement on every page turn.
    pageAnnounce: (current, total) => `Page ${current} sur ${total}`,
    // Empty search result.
    noMatches: (query) => `Aucun résultat pour « ${query} »`,
    // The zoom hint names whichever gestures are enabled; build the sentence yourself.
    zoomHint: ({ doubleClick, wheel, mac }) => {
      const parts = []
      if (doubleClick) parts.push('Double-cliquez')
      if (wheel) parts.push(`${mac ? '⌘' : 'Ctrl'}+molette`)
      return `${parts.join(' ou ')} pour zoomer`
    },
  },
})
```

Page numbers handed to these functions are already 1-based (display) values.

## The full key set

The complete list of keys, with their argument shapes, is the exported `ZineStrings` type:

```ts
import type { ZineStrings } from '@zinejs/core'

const fr: Partial<ZineStrings> = {
  /* your overrides, type-checked */
}
```

`defaultStrings` is exported too, if you would rather start from the English set and adjust it:

```js
import { defaultStrings } from '@zinejs/core'

const fr = { ...defaultStrings, nextPage: 'Page suivante' }
new Zine(el, { source, strings: fr })
```

## Reading direction

Localization is only the text. To mirror the layout and the page-turn direction for right-to-left
languages, set `direction: 'rtl'` alongside your `strings`; the two are independent.

```js
new Zine(el, { source, direction: 'rtl', strings: arabic })
```

## Reusing a translation

Keep a translation in its own module and spread it into each book, so a whole site shares one set:

```js
// i18n/fr.js
export const fr = {
  nextPage: 'Page suivante',
  prevPage: 'Page précédente',
  pageAnnounce: (current, total) => `Page ${current} sur ${total}`,
  // ...
}

// elsewhere
import { fr } from './i18n/fr.js'
new Zine(el, { source, strings: fr })
```

Ready-made language packs are not part of the library today; you bring your own strings. If that
changes, the `strings` option is where any future packs would plug in, so a translation you write now
keeps working unchanged.
