# DokiWorld Storyteller

A static App launched from explicit product entry points that renders DokiWorld interactive episodes. Its deployable bundle has no runtime npm dependency because the App SDK is bundled during the build.

It supports:

- authored and generated dialogue, action, thought, and narration segments;
- image and video media with accessible controls;
- configured choices and free-text replies;
- launching the configured DokiWorld App action inside the story;
- English and Simplified Chinese UI selected by the host locale.

## Install and build

Storyteller uses the published App SDK package by default:

```json
{
  "dependencies": {
    "@dokiworld/app-sdk": "^3.1.0"
  }
}
```

```powershell
npm install
npm test
npm run build
```

The build creates the deployable `dist/` directory and bundles the SDK into the browser JavaScript.

Configured Apps launch exclusively through the SDK `apps` capability (protocol v2). Storyteller waits for long-running Apps, accepts completion from the configured output contract (including legacy `doki.game.result/1`), and forwards the complete output as `episode.gameCompleted`. Dialog and Choice modules placed after an App continue automatically when it finishes; their prompts and fixed text can use `{{app.outcome}}`, `{{app.score}}`, `{{app.maxScore}}`, and `{{app.metrics.<key>}}`. The persisted experience protocol uses the App action's single `nextBeatId` as an internal continuation link, not as a separately authored result Episode.

## Use the adjacent local SDK

When developing an unpublished App SDK change, the dependency can temporarily use a sibling checkout of `dokiworld.git`:

```json
{
  "dependencies": {
    "@dokiworld/app-sdk": "file:../../dokiworld.git/packages/app-sdk"
  }
}
```

Run `npm install` after changing the dependency so that `package-lock.json` and `node_modules` use the local package, then run the tests and build again. This path assumes `dokiworld-apps.git` and `dokiworld.git` are adjacent directories.

To switch back to the registry package after local SDK development, refresh the dependency and lockfile:

```powershell
npm install "@dokiworld/app-sdk@^3.1.0" --save
```
