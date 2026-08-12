# DokiWorld Banquet Contract

A static DokiWorld World App built on the `dokiworld.app/2` runtime protocol. It uses the App SDK lifecycle and Episode extension, and retains a compatibility bridge for launching its nested Game.

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

Run `npm install` after changing the dependency so that `package-lock.json` and `node_modules` use the local package. This path assumes `dokiworld-apps.git` and `dokiworld.git` are adjacent directories.

Before committing or publishing the App, restore the public package and refresh the lockfile:

```powershell
npm install "@dokiworld/app-sdk@^2.0.0" --save
```
