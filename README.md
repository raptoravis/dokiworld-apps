# dokiworld-apps

DokiWorld 的外部 App 集合。每个 App 通过本地 `file:` 依赖引用 `@dokiworld/app-sdk`（位于相邻仓库 `../dokiworld.git/packages/app-sdk`），并使用 esbuild 将 SDK 与 App 源码打包成可部署的静态产物。

当前统一使用 `dokiworld.app/2` 协议。SDK 负责 iframe App 与 DokiWorld Host 之间的身份校验、初始化确认、消息关联、重试、退出协商以及类型化 capability 通信；外部 App 不直接访问 DokiWorld 的令牌或内部 HTTP 接口。

## 项目结构

| 目录 | 版本 | 类型 | SDK 集成 |
|---|---:|---|---|
| `game-match3` | `1.0.0` | Game App | 使用 `createAppClient` 接收初始化数据并提交结构化游戏结果 |
| `banquet-contract` | `1.0.1` | World App | 使用 `createAppClient`、Episode extension，并通过 `createAppHost` 兼容嵌套 Game |
| `storyteller` | `1.1.1` | World App | 使用 Episode、Dialogue 及 SDK 1.2 的 P0/P1 capabilities 渲染互动剧集 |

每个 App 的源码、manifest 生成脚本、测试和 `dist/` 构建产物都在其目录内维护。manifest、`package.json` 与静态资源引用的版本必须同步更新。

## App SDK 集成

SDK 位于相邻仓库：

```text
D:\dev\dokiworld.git\packages\app-sdk
```

各 App 通过以下依赖引用它：

```json
{
  "dependencies": {
    "@dokiworld/app-sdk": "file:../../dokiworld.git/packages/app-sdk"
  }
}
```

构建后的 bundle 会内联 SDK，不要求部署环境单独安装 npm 包。

### 生命周期接口

- `createAppClient`：App 向 Host 发送 ready、接收 init、确认 initialized、提交 completion，并参与退出协商。
- `createAppHost`：World 或 DokiWorld 宿主启动嵌套 App，校验运行身份、输入输出 contract 和 completion acknowledgement。
- `onMessage`：允许多个类型化 extension 同时订阅会话消息，并在运行结束时独立释放。
- `createEpisodeClientExtension`：隐藏 Episode wire message 名称，为互动内容、选择、动作及游戏结果提供类型化事件。

### Dialogue capability

Storyteller 使用 `@dokiworld/app-sdk/dialogue`，不再直接依赖 DokiWorld 前端实现：

- `generateDialogue()`：根据玩家输入继续对话。
- `regenerateDialogue()`：重新生成最近一轮内容。
- `generateSuggestions()`：生成推荐回复。
- SDK 同时支持 `generateOpening()` 和 `generateTagline()`，是否开放由 Host adapter 决定。

SDK 负责请求 ID、并发响应关联、运行时校验、超时和稳定错误码；认证及后端访问保留在 DokiWorld Host 内。

### SDK 1.2 P0/P1 capabilities

Storyteller `1.1.1` 已在 manifest 中声明并在 `src/app.js` 中实际使用以下能力：

| 扩展名 | SDK 入口 | Storyteller 中的用途 |
|---|---|---|
| `media` | `@dokiworld/app-sdk/media` | `generateImage()`、`generateVideo()` 和 `getJob()`；替代旧的 `chat.generateMedia` 业务消息 |
| `speech` | `@dokiworld/app-sdk/speech` | `synthesize()`；替代直接调用浏览器 `speechSynthesis` |
| `storage` | `@dokiworld/app-sdk/storage` | 加载、保存和清除隔离的 Storyteller checkpoint |
| `character` | `@dokiworld/app-sdk/character` | 初始化时通过 `getCurrent()` 获取当前公开角色资料 |
| `persona` | `@dokiworld/app-sdk/persona` | 读取当前角色卡，并通过 `requestSelection()` 请求 DokiWorld 的可信选择界面 |
| `apps` | `@dokiworld/app-sdk/apps` | 查询可用 v2 App，并通过 `launch()` 启动嵌套 App、接收结构化 completion |

每项 capability 必须同时满足：

1. App 在 manifest 的 `runtime.extensions` 中声明扩展名。
2. `createAppClient({ extensions })` 声明同一扩展名。
3. App 创建对应的 client extension 并实际调用其语义方法。
4. DokiWorld Host 为该运行创建对应的 host extension。

只修改 manifest 不会自动获得能力。未声明的消息会被 SDK 拒绝；Host 未实现的操作会返回稳定的 `unsupported-operation` 错误。

角色与角色卡等数据仍受 `grantedScopes` 控制。Storyteller manifest 当前把以下 scope 声明为 optional：

- `character.identity`
- `character.avatar`
- `character.card`
- `player_persona`

## Manifest 与兼容性

所有 App 均声明：

```json
{
  "runtime": {
    "protocol": "dokiworld.app",
    "protocolVersion": 2
  }
}
```

`runtime.input` 和 `runtime.outputs` 是版本化 contract；`runtime.extensions` 只声明 App 确实消费的可选能力。

Storyteller 和 Banquet Contract 仍保留必要的旧版嵌套 Game 兼容桥，但新的 v2 App 启动应优先使用 SDK 生命周期或 `apps.launch()`。Storyteller 的 `apps` capability 只列出能够通过统一 v2 生命周期安全启动的 App。

## 安装与构建

分别构建三个 App：

```sh
npm install --prefix game-match3
npm run build --prefix game-match3

npm install --prefix banquet-contract
npm run build --prefix banquet-contract

npm install --prefix storyteller
npm run build --prefix storyteller
```

构建流程会生成 manifest，并在各自的 `dist/` 中输出 HTML、CSS、JavaScript、资源和 `manifest.json`。不要手工编辑 `dist/`；应修改源码或 manifest 生成脚本后重新构建。

修改 `@dokiworld/app-sdk` 后，必须重新构建受影响的 App，确保 bundle 内联的是最新 SDK 实现。若 App 的 JavaScript 或 manifest 有可部署变化，还应提升 App 版本，避免浏览器继续使用旧的带版本查询参数的资源。

## 同步到 DokiWorld 本地开发环境

在 DokiWorld 主仓库执行：

```sh
cd D:\dev\dokiworld.git
npm run sync:local-apps
```

该命令会重新构建本仓库的 App，将产物同步到 DokiWorld 的 `frontend/public/games/` 或 `frontend/public/worlds/`，并重新生成本地 catalog。Developer Mode 使用这些同步后的本地产物。

## 测试

运行各 App 测试：

```sh
npm test --prefix game-match3
npm test --prefix banquet-contract
npm test --prefix storyteller
```

Storyteller 的测试还会校验：

- manifest 中声明的 P0/P1 capability 在 `src/app.js` 中存在对应 SDK import、client extension 和真实方法调用；
- 不再通过旧的 `chat.generateMedia` 业务消息生成媒体；
- `package.json`、manifest 和构建产物版本一致；
- 嵌套 App sandbox 与 v1 兼容路径保持有效。

SDK 本身的测试和类型检查在 DokiWorld 主仓库执行：

```sh
cd D:\dev\dokiworld.git
npm test --workspace @dokiworld/app-sdk
npm run typecheck --workspace @dokiworld/app-sdk
```
