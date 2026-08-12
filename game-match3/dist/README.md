# Heartline Match

This directory is the maintained source for the `game-match3` external App.
It bundles `@dokiworld/app-sdk` and uses `createAppClient` with the
`dokiworld.app/2` runtime protocol.

- Run `npm install` and `npm run build` before publishing.
- Publish `dist/` as the static App directory.
- The host input contract is `doki.game.match3-input/1`; completion uses
  `doki.game.result/1`.
- Closing an unfinished run returns an `exited` result containing the current
  normalized score and metrics, so Episode settlement does not lose progress.

## SDK dependency source

The project uses the published `@dokiworld/app-sdk@^2.1.0` package by default. When developing an unpublished SDK change, it can temporarily use a sibling checkout of `dokiworld.git`:

```json
{
  "dependencies": {
    "@dokiworld/app-sdk": "file:../../dokiworld.git/packages/app-sdk"
  }
}
```

Run `npm install` after changing the dependency so that `package-lock.json` and `node_modules` use the local package. This path assumes `dokiworld-apps.git` and `dokiworld.git` are adjacent directories.

Before committing or publishing the App, restore the public package and refresh the lockfile:

```powershell
npm install "@dokiworld/app-sdk@^2.1.0" --save
```

