# dokiworld-ext

DokiWorld 的外部 App 集合。每个 App 通过本地 `file:` 依赖引用 `@dokiworld/app-sdk`（位于 `../../dokiworld.git/packages/app-sdk`），用 esbuild 将其打包为静态产物。

## 项目结构

| 目录 | 类型 | 说明 |
|---|---|---|
| `game-match3` | Game App | 三消游戏，使用 `createAppClient` 对接 `dokiworld.app/2` 协议 |
| `banquet-contract` | World App | 宴会契约，作为 World 使用 `createAppHost` 嵌套运行 Game |
| `storyteller` | World App | 纯静态交互叙事 World，渲染对话/动作/选择等 episode 内容 |
| `extension-bg` | Chrome 扩展 Background | 浏览器扩展后台脚本 |

## 构建

```sh
npm install --prefix game-match3 && npm run build --prefix game-match3
npm install --prefix banquet-contract && npm run build --prefix banquet-contract
npm install --prefix storyteller && npm run build --prefix storyteller
```

每个 App 构建后在 `dist/` 输出可部署的静态文件，包含 `manifest.json`（兼容旧版 `game.json` 文件名）。

## App SDK 集成

SDK 位于仓库外的本地路径 `../../dokiworld.git/packages/app-sdk`。打包后的 bundle 中会内联以下模块：

- **`createAppClient`** — Game/World 向 Host 注册、收发协议消息
- **`createAppHost`** — World 嵌套运行子 Game 时的 Host 侧接口
- **`onMessage`** — Client / Host 的扩展消息监听器，支持多对多订阅与取消
- **Episode wire types** — Client 与 Host 之间的 episode 协议消息类型（`episode.start`、`episode.message` 等）

协议版本：`dokiworld.app/2`
