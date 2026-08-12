# Heartline Match

This directory is the maintained source for the `game-match3` external App.
It bundles `@dokiworld/app-sdk` and uses `createAppClient` with the
`dokiworld.app/2` runtime protocol.

- Run `npm install` and `npm run build` before publishing.
- Publish `dist/` as the static App directory.
- The host input contract is `doki.game.match3-input/1`; completion uses
  `doki.game.result/1`.

