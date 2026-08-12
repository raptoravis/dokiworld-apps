# DokiWorld Storyteller

A static World app that renders DokiWorld interactive episodes. Its deployable bundle has no runtime npm dependency because the App SDK is bundled during the build.

It supports:

- authored and generated dialogue, action, thought, and narration segments;
- image and video media with accessible controls;
- configured choices and free-text replies;
- launching the configured DokiWorld game/app action inside the story;
- English and Simplified Chinese UI selected by the host locale.

## Install and build

The project uses the public npm package by default:

```json
{
  "dependencies": {
    "@dokiworld/app-sdk": "^2.0.0"
  }
}
```

```powershell
npm install
npm test
npm run build
```

The build creates the deployable `dist/` directory and bundles the SDK into the browser JavaScript.

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

Before committing or publishing Storyteller, restore the public package and refresh the lockfile:

```powershell
npm install "@dokiworld/app-sdk@^2.0.0" --save
```
