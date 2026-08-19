# dokiworld-apps

DokiWorld 的外部 App 集合。各 App 通过自己的 `package.json` 引用公共 npm 包 `@dokiworld/app-sdk`，并使用 esbuild 将 SDK 与 App 源码打包成可部署的静态产物。默认开发和构建不需要访问私有 DokiWorld 仓库，也不依赖仓库之间的相对目录位置。

当前统一使用 `dokiworld.app/2` 协议。SDK 负责 iframe App 与 DokiWorld Host 之间的身份校验、初始化确认、消息关联、重试、退出协商以及类型化 capability 通信；外部 App 不直接访问 DokiWorld 的令牌或内部 HTTP 接口。

## 项目结构

| 目录 | 版本 | 类型 | SDK 集成 |
|---|---:|---|---|
| `game-match3` | `1.0.5` | Game App | 使用 `createAppClient` 接收初始化数据，并通过 `doki.game.result/1` 提交完整结算或中途退出得分 |
| `banquet-contract` | `1.0.6` | World App | 使用 `createAppClient`、Episode extension，并通过 `createAppHost` 兼容嵌套 Game |
| `storyteller` | `1.1.11` | World App | 使用 Episode、Dialogue 及类型化 capabilities 渲染互动剧集和消费 Game 结算 |
| `tower-confessions` | `0.1.0` | Game App | 使用角色、对话、媒体、Persona、语音与存储能力实现叠叠乐互动体验 |

每个 App 的源码、manifest 生成脚本、测试和 `dist/` 构建产物都在其目录内维护。manifest、`package.json` 与静态资源引用的版本必须同步更新。

## App SDK 集成

SDK 已发布到公共 npm registry：

```text
@dokiworld/app-sdk
```

Storyteller、Banquet Contract 和 Heartline Match 均通过以下依赖引用它：

```json
{
  "dependencies": {
    "@dokiworld/app-sdk": "^3.1.0"
  }
}
```

构建后的 bundle 会内联 SDK，不要求部署环境单独安装 npm 包。

### 使用相邻 DokiWorld 仓库中的 SDK

只有在联合开发尚未发布的 SDK 变更时，才需要把依赖临时切换到与本仓库相邻的 `dokiworld.git`：

```json
{
  "dependencies": {
    "@dokiworld/app-sdk": "file:../../dokiworld.git/packages/app-sdk"
  }
}
```

在具体 App 目录运行 `npm install`，让 `package-lock.json` 和 `node_modules` 一起切换到本地 SDK。例如 Storyteller：

```powershell
cd D:\dev\dokiworld-apps.git\storyteller
npm install
npm test
npm run build
```

本地 `file:` 形式要求三个仓库保持当前相邻目录结构，仅适用于本地联调。完成联调后，用下面的命令恢复公共 npm 包并刷新 lockfile：

```powershell
npm install "@dokiworld/app-sdk@^3.1.0" --save
```

提交和发布 App 时默认应保留公共 semver 依赖；不要提交指向开发者本机目录结构的 `file:` lockfile。

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

### 类型化 capabilities

Storyteller `1.1.11` 已在 manifest 中声明并在 `src/app.js` 中实际使用以下能力：

| 扩展名 | SDK 入口 | Storyteller 中的用途 |
|---|---|---|
| `media` | `@dokiworld/app-sdk/media` | `generateImage()`、`generateVideo()` 和 `getJob()`；替代旧的 `chat.generateMedia` 业务消息 |
| `speech` | `@dokiworld/app-sdk/speech` | `synthesize()`；替代直接调用浏览器 `speechSynthesis` |
| `storage` | `@dokiworld/app-sdk/storage` | checkpoint、命名空间 key-value 与 cursor 分页列表 |
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

App SDK 维护统一的已知扩展注册表；App 的 `kind` 不决定 extension 是否合法。Catalog 只拒绝未知扩展，真正启动时由当前 Host capability profile 判断是否兼容：

| 当前 Host profile | 当前提供的 `runtime.extensions` |
|---|---|
| Chat Game Host | `character`、`checkpoint`、`dialogue`、`footprint`、`media`、`memory`、`persona`、`progress`、`resize`、`resume`、`speech`、`storage` |
| World Page Host | `apps`、`character`、`chat`、`checkpoint`、`dialogue`、`episode`、`footprint`、`media`、`memory`、`persona`、`speech`、`storage`、`world` |
| World Nested App Host | `checkpoint`、`progress`、`resize` |

`episodeRenderer` 是 World catalog 能力，不是 runtime extension；使用 Episode 消息的 App 仍须声明 `episode`，使用 Episode 兼容 chat 消息时还须声明 `chat`。例如 `apps` 目前只能在 World Page Host 启动，但这属于当前 Host 实现，不是 SDK 对 Game 的永久限制。World Page Host 的 `apps.list()` 只返回与 World Nested App Host 兼容的 App，`apps.launch()` 也会再次校验。

`memory` 和 `footprint` 分别读取当前人物卡的长期记忆与互动足迹。App 必须同时声明同名 runtime extension 和 context scope；Host 会把读取固定到当前人物卡与已登录用户，App 不传 `characterId`，也不会收到账号 ID 或来源会话 ID。

Storyteller 和 Banquet Contract 仍保留必要的旧版嵌套 Game 兼容桥，但新的 v2 App 启动应优先使用 SDK 生命周期或 `apps.launch()`。Storyteller 的 `apps` capability 只列出能够通过统一 v2 生命周期安全启动的 App。

## 新增 App（Game / World）

新增 App 不只是复制一份静态页面。一个可被 DokiWorld 发现并安全启动的 App，需要同时完成目录、manifest contract、SDK 生命周期、权限、本地化、构建、测试和 catalog 接入。

### 1. 创建独立目录

目录名就是 App ID，必须使用小写字母、数字和连字符，并与 manifest 的 `id` 完全一致，例如：

```text
dokiworld-apps.git/
└── my-new-app/
    ├── package.json
    ├── package-lock.json
    ├── manifest.json          # 也可以由 scripts/generate-manifest.mjs 生成
    ├── index.html
    ├── src/                   # 是否使用 src/ 由 App 自己决定
    ├── scripts/
    │   ├── build.mjs
    │   └── generate-manifest.mjs
    ├── tests/
    └── README.md
```

可以分别参考：

- Game：`game-match3`；
- 通用 World：`storyteller`；
- 使用 Episode、Dialogue、媒体及嵌套 App 的 World：`storyteller`。

`package.json` 至少应提供 `build`、`test` 和 `generate:manifest` 脚本，并通过公共 semver 版本引用 `@dokiworld/app-sdk`。构建必须生成完整的 `dist/`，其中包含可直接加载的入口文件和 `dist/manifest.json`。

### 2. 定义 App contract

Game 与 World 都使用 `dokiworld.app/2`，但 catalog 当前接受的 manifest 形状不同：

| 项目 | Game | World |
|---|---|---|
| `kind` | `game` | `world` |
| manifest schema | `schemaVersion: 2` | `schemaVersion: 2` |
| 最小玩家数 | `launchRequirements.minPlayers` 至少为 `2` | 通常为 `1` |
| input contract | 例如 `doki.game.<id>-input` | 例如 `doki.world.<id>-input` |
| output contract | 通常为 `doki.game.result` 或专用结果 | 通常为 `doki.world.session-result` |
| context scopes | `context.requiredScopes` / `optionalScopes` | `context.requiredScopes` / `optionalScopes` |
| catalog 注册 | 无需额外注册文件，由 Game manifest 自动发现 | 本地同步后由 World catalog 自动发现 |

两类 App 的 `runtime` 都必须声明：

```json
{
  "runtime": {
    "protocol": "dokiworld.app",
    "protocolVersion": 2,
    "input": {
      "contract": "doki.game.my-new-app-input",
      "version": 1
    },
    "outputs": [
      {
        "contract": "doki.game.result",
        "version": 1
      }
    ],
    "extensions": ["progress", "checkpoint"]
  }
}
```

World 应把示例中的 `doki.game.*` 换成自己的 `doki.world.*` contract。contract 名和版本属于 Host 与 App 之间的公开协议；修改已有 contract 的结构时应提升 contract version，并同步更新 Host adapter 和测试。

manifest 的版本应以 `package.json.version` 为单一事实来源，由生成脚本写入。App ID、`package.json` 版本、源码 manifest 和 `dist/manifest.json` 必须保持一致。

### 3. 接入 App SDK 生命周期

App 入口应通过 `createAppClient` 完成 ready/init/initialized、运行消息、completion 和退出协商。不要自行拼装 `postMessage` 协议，也不要从 iframe 读取 DokiWorld token 或直接调用内部 API。

每个可选 capability 都必须完成四处接线：

1. 在 manifest 的 `runtime.extensions` 中声明；
2. 在 `createAppClient({ extensions })` 中声明；
3. 创建对应的 SDK client extension，并调用其公开方法；
4. 确认 DokiWorld Host 已注册对应的 host extension。

只改 manifest 不会让 capability 生效。listener、extension subscription、timer 和嵌套 App Host 都应在结束或卸载时释放。

Game 至少应提交符合 output contract 的结构化结果。World 应提交 session result；如果 World 内会启动 Game 或其他 App，优先使用 `apps.launch()`，只有需要兼容旧 App 时才保留 `createAppHost` 桥。

### 4. 声明权限与双语内容

只申请实际使用的 scope。需要角色身份、头像、角色卡或玩家角色卡时，在对应的 required/optional scope 中声明，并确认 Host 允许该 scope；App 必须能处理 optional scope 未授权或 capability 不可用的情况。

manifest 至少提供 `locales.en` 和 `locales.zh-cn` 的 `name`、`description`。英文是规范产品语言，新增用户可见文案必须在同一变更中提供简体中文翻译。Game 的别名、`selection.promptHint` 以及可选的 `selection.avoidHint` 也必须同时维护两种语言；World 不应声明 `selection`。

### 5. 完成自包含 Game manifest

新的 schema v2 Game 不需要额外的平台注册文件。manifest 自身应完整声明：

- `status`，值为 `active`、`deprecated` 或 `disabled`；
- 实际使用的 required/optional context scopes；
- `selection`，其中双语 `promptHint` 必填；
- 如果输出 `doki.game.result/1`，通过 `result.metrics` 声明运行时可能返回的指标名称，使 Episode 编辑器能针对所选 Game 列出对应的 `{{app.metrics.*}}` 变量。

`selection` 还可包含 `avoidHint`、`activationPolicy`、tags、intents 和 examples。context scope 必须属于 Host 支持的公开 scope，否则 Game catalog 生成会失败。World manifest 会拒绝 `selection`。

### 6. 构建与测试

在新 App 目录执行：

```powershell
npm install
npm run generate:manifest
npm test
npm run build
```

测试至少应覆盖：

- manifest ID、kind、版本、runtime contract 和 extension 声明；
- SDK 初始化、输入校验、completion acknowledgement 和退出 cleanup；
- 每项声明 capability 的真实 SDK 调用，而不只是 manifest 字符串；
- required/optional scope 缺失时的降级行为；
- 英文和简体中文关键文案；
- `dist/manifest.json` 的入口和静态资源确实存在。

如果改动了 App SDK，还应先在 DokiWorld 主仓库运行 SDK 测试和类型检查，再重新安装或构建 App，使最新 SDK 被内联进 bundle。

### 7. 同步并验证 DokiWorld

本地联调时，在 DokiWorld 主仓库明确指定本仓库位置并运行同步：

```powershell
cd D:\dev\dokiworld.git
$env:DOKIWORLD_EXT_ROOT = "D:\dev\dokiworld-apps.git"
npm run sync:local-apps
```

同步脚本会扫描本仓库中带 `package.json` 的目录、执行各自的 `npm run build`，再根据 manifest 的 `kind` 把产物复制到 `frontend/public/games/<id>/` 或 `frontend/public/worlds/<id>/`，并重新生成 catalog；不需要手工编辑 `frontend/.local-apps-sync.json` 或生成后的 `catalog.json`。

最后至少检查：

- Game 出现在 Game catalog，并能从真实 Host 流程启动和返回结果；
- World 出现在 World catalog，并可通过 `/worlds/<id>` 和 `/zh-cn/worlds/<id>` 打开；
- Developer Mode 加载的是本地同步产物，而不是远程 CDN 版本；
- 浏览器控制台没有 origin、protocol、contract、scope 或 capability 错误；
- 英文与简体中文入口都能完成一次完整运行和退出。

准备发布时，应提升 App 版本、重新构建并发布完整 `dist/`，然后更新部署环境所使用的 App catalog 或静态资源源。不要只上传修改后的 JavaScript 而保留旧 manifest 版本。

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

升级 `@dokiworld/app-sdk` 依赖后，必须重新安装并构建受影响的 App，确保 bundle 内联的是 lockfile 锁定的 SDK 实现。若 App 的 JavaScript 或 manifest 有可部署变化，还应提升 App 版本，避免浏览器继续使用旧的带版本查询参数的资源。

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
