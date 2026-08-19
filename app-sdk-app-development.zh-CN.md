# DokiWorld App SDK：Game / World 开发、协议与交付指南

本文是使用 `@dokiworld/app-sdk` 开发 DokiWorld iframe App 的规范指南。适用于 Game、World 和操作型 App。可运行示例参考 [dokiworld-apps](https://github.com/raptoravis/dokiworld-apps)；仓库中的 `game-match3`、`storyteller` 与 `banquet-contract` 分别展示 Game、通用 Episode World 和定制 World。

UI Extension 不属于 iframe App。它使用 `@dokiworld/extension-sdk`，安装和运行模型见 [`ui-extension-system.zh-CN.md`](ui-extension-system.zh-CN.md)。

## 1. 架构与事实来源

App 是独立构建、独立部署的浏览器静态包，通过 `dokiworld.app/2` 与 Host 通信：

```text
App source
  ├─ package.json                 npm 依赖与唯一版本来源
  ├─ manifest source/generator   App 身份、选择语义、contract、capability
  └─ source assets
          │ npm run build
          ▼
dist/
  ├─ manifest.json
  ├─ index.html
  ├─ bundled JavaScript/CSS
  └─ runtime assets
          │ sync / upload / publish
          ▼
DokiWorld catalog → iframe Host ↔ @dokiworld/app-sdk ↔ App
```

规则：

- App 不导入 DokiWorld `frontend/src` 或 backend 内部模块。
- `package.json.version` 是发布版本的唯一事实来源；manifest 生成器把它写入 manifest。
- `dist/manifest.json` 是交付清单，不手工编辑 `dist/`。
- Game manifest 自包含启停状态、选择提示、context scopes 和 runtime contract，不需要额外的 `external-apps.json`。
- World manifest 不包含 `selection`；World 由用户从 World card 或明确入口启动，不参与 Game 的 LLM 自动选择。
- 英文是规范产品语言，同时维护对应的简体中文内容。

## 2. 建立项目

推荐结构：

```text
my-app/
├─ package.json
├─ package-lock.json
├─ src/
│  ├─ index.html
│  ├─ app.js
│  └─ manifest.json              # 或由生成脚本输出
├─ scripts/
│  ├─ generate-manifest.mjs
│  └─ build.mjs
├─ tests/
└─ dist/
```

从公共 npm registry 安装 SDK：

```powershell
npm install "@dokiworld/app-sdk@^3.0.0" --save
```

只有联合开发尚未发布的 SDK 变更时，才临时使用相邻仓库：

```json
{
  "dependencies": {
    "@dokiworld/app-sdk": "file:../../dokiworld.git/packages/app-sdk"
  }
}
```

提交或发布 App 前恢复公共 semver 依赖并刷新 lockfile。构建器应把 SDK 打入浏览器 bundle，因此部署环境无需安装 npm 包。

`package.json` 至少提供：

```json
{
  "type": "module",
  "scripts": {
    "generate:manifest": "node scripts/generate-manifest.mjs",
    "test": "node --test tests/*.test.mjs",
    "build": "node scripts/build.mjs"
  },
  "dependencies": {
    "@dokiworld/app-sdk": "^3.0.0"
  }
}
```

## 3. 可由对话拉起的 App manifest

新 Game 使用 `schemaVersion: 2`。下面是可直接作为生成目标的完整形状：

```json
{
  "schemaVersion": 2,
  "version": "1.0.0",
  "id": "my-game",
  "chatLaunchable": true,
  "status": "active",
  "capability": "game.puzzle.example",
  "entry": "index.html",
  "cover": "assets/cover.webp",
  "launchRequirements": {
    "minPlayers": 2
  },
  "context": {
    "requiredScopes": [],
    "optionalScopes": ["character.identity", "character.avatar"]
  },
  "locales": {
    "en": {
      "name": "Example Game",
      "description": "A short cooperative puzzle.",
      "aliases": ["Example Puzzle"]
    },
    "zh-cn": {
      "name": "示例游戏",
      "description": "一个简短的合作解谜游戏。",
      "aliases": ["示例解谜"]
    }
  },
  "selection": {
    "activationPolicy": "explicit-or-contextual",
    "promptHint": {
      "en": "Use for an explicit request or a genuine short puzzle challenge.",
      "zh-cn": "玩家明确请求，或剧情确实需要简短解谜挑战时使用。"
    },
    "avoidHint": {
      "en": "Do not launch for casual mentions of puzzles.",
      "zh-cn": "仅随口提到解谜时不要拉起。"
    }
  },
  "result": {
    "metrics": ["points", "moves", "cleared", "bestCascade"]
  },
  "runtime": {
    "protocol": "dokiworld.app",
    "protocolVersion": 2,
    "input": {
      "contract": "doki.game.my-game-input",
      "version": 1
    },
    "outputs": [
      {
        "contract": "doki.game.result",
        "version": 1
      }
    ],
    "extensions": ["resize", "progress", "checkpoint"]
  }
}
```

Game 特有规则：

- `status` 必须是 `active`、`deprecated` 或 `disabled`。
- `capability` 是稳定、语言无关的能力标识。
- `selection.promptHint.en` 与 `selection.promptHint.zh-cn` 必填，并会进入 LLM 的候选 App 提示。
- `activationPolicy` 为 `explicit` 或 `explicit-or-contextual`。
- `avoidHint`、tags、intents 和正反 examples 可选，用于降低误触发。
- aliases 用于玩家明确点名匹配。
- `launchRequirements.minPlayers` 是总参与方数量，不是 AI 座位数或最大人数。
- `result.metrics` 声明 `doki.game.result/1` 可能返回的 metric 名称。创建 Episode 时，编辑器会根据所选 Game 将它们列为 `{{app.metrics.<name>}}` 可用变量；不要声明运行时永远不会返回的名称。

## 4. 不由对话拉起的 Episode Renderer App manifest

World manifest 使用 `schemaVersion: 2`，运行协议只在 `runtime` 中声明：

```json
{
  "schemaVersion": 2,
  "version": "1.0.0",
  "id": "my-world",
  "status": "active",
  "entry": "index.html",
  "cover": "assets/cover.webp",
  "runtime": {
    "protocol": "dokiworld.app",
    "protocolVersion": 2,
    "input": {
      "contract": "doki.world.my-world-input",
      "version": 1
    },
    "outputs": [
      {
        "contract": "doki.world.session-result",
        "version": 1
      }
    ],
    "extensions": ["episode", "chat", "checkpoint", "apps"]
  },
  "episodeRenderer": true,
  "chatLaunchable": false,
  "launchRequirements": {
    "minPlayers": 1
  },
  "context": {
    "requiredScopes": [],
    "optionalScopes": ["character.identity", "character.avatar", "character.card", "player_persona"]
  },
  "locales": {
    "en": {
      "name": "Example World",
      "description": "An interactive episode World."
    },
    "zh-cn": {
      "name": "示例世界",
      "description": "一个互动剧集世界。"
    }
  }
}
```

支持 Episode 的 App 规则：

- 不得声明顶层 `protocolVersion`；catalog 从 `runtime.protocolVersion` 派生兼容字段。
- `episodeRenderer: true` 是 World catalog 能力，表示它可以渲染世界卡中的 Episode 配置；它不属于 `runtime.extensions`，也不能替代 `episode` 扩展声明。
- App manifest 不内嵌角色副本。当前角色、World card 和 persona 来自 Host init 中实际授权的 context/input。
- 所有 App 都同步到 `frontend/public/apps/<id>`，manifest 不再声明 `kind`。
- `chatLaunchable` 为必填布尔值。设为 `true` 时 App 可成为对话拉起候选；设为 `false` 时只能从其他产品入口打开。

### 4.1 已知扩展与 Host capability profile

App SDK 只维护语言无关的已知扩展注册表，不按 Game/World 分类：

```js
import { RUNTIME_EXTENSIONS } from "@dokiworld/app-sdk/runtime-extensions";
```

当前已知扩展为：`apps`、`character`、`chat`、`checkpoint`、`dialogue`、`episode`、`footprint`、`media`、`memory`、`persona`、`progress`、`resize`、`resume`、`speech`、`storage`、`world`。

清单生成器和浏览器 catalog 加载器会拒绝未知扩展。真正启动 App 时，当前 Host 会把 manifest 声明与自己的 capability profile 比较；缺少任一能力就拒绝启动，并且不会把未实现能力暴露给 iframe。

| 当前 Host profile | 当前提供的 `runtime.extensions` |
| --- | --- |
| Chat Game Host | `character`、`checkpoint`、`dialogue`、`footprint`、`media`、`memory`、`persona`、`progress`、`resize`、`resume`、`speech`、`storage` |
| World Page Host | `apps`、`character`、`chat`、`checkpoint`、`dialogue`、`episode`、`footprint`、`media`、`memory`、`persona`、`speech`、`storage`、`world` |
| World Nested App Host | `checkpoint`、`progress`、`resize` |

这些 profile 属于 DokiWorld Host 实现，不属于 App SDK 的 Game/World 类型系统。未来任一 Host 增加能力时，只需升级 Host profile 和 adapter。

只声明 App 实际使用的能力：

- `episode` 对应 Episode 选择、回复、动作和游戏结果等 `dokiworld-app-episode-*` 消息；
- `chat` 对应 Episode 兼容层中的重新生成、建议与媒体等 `dokiworld-app-chat-*` 消息；
- `world` 对应 World 自有控制消息，例如 `dokiworld-app-world-error`；
- `checkpoint` 在 Game 中用于游戏 checkpoint，在 World 中用于 World 会话 checkpoint；
- `memory` 读取当前人物卡与已登录用户之间的长期记忆，`footprint` 读取同一关系下的互动足迹；两者都需要同名 context scope；
- `memory.list()` 与 `footprint.list()` 由 Host 固定当前人物卡，App 不传 `characterId`，返回值不包含账号 ID 或来源会话 ID；
- `apps` 当前由 World Page Host 提供，用于列出和启动嵌套 v2 App；若未来 Chat Game Host 实现该能力，同一个扩展无需修改 SDK 即可使用；
- World Page Host 的 `apps.list()` 只返回与 World Nested App Host 兼容的 App，`apps.launch()` 也会再次校验；
- `progress` 与 `resize` 当前由 Chat Game Host 和 World Nested App Host 提供，World Page Host 本身会在启动时报告不兼容。

## 5. Manifest 生成

生成器应读取 `package.json`，构造或校验 manifest，并写入源码 manifest；build 再把同一文件复制到 `dist/manifest.json`。

```js
import { readFile, writeFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const manifest = {
  // 固定字段与完整 runtime/locales 配置
  schemaVersion: 2,
  version: packageJson.version,
  id: "my-game",
  status: "active"
};

await writeFile("src/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
```

生成时至少验证：

- `id` 与目录名、Client `appId` 一致，且只含小写字母、数字和连字符；
- package 与 manifest 版本一致并符合 semver；
- `entry`、`cover` 和所有运行资源位于 App 包内；
- 英文与简体中文字段完整；
- runtime input/output contract 与版本完整；
- Game 的 `result.metrics` 名称唯一、与实际结算结果一致，并且最多 12 项；
- Game 有双语 `selection.promptHint`，World 没有 `selection`；
- 声明的 extension 与业务代码实际创建的 SDK extension 一致。

## 6. `dokiworld.app/2` 生命周期

App 入口使用 `createAppClient()`，不手写 `postMessage` wire 字符串：

```js
import { createAppClient } from "@dokiworld/app-sdk";

const app = createAppClient({
  appId: "my-game",
  extensions: ["progress", "checkpoint"],
});

app.connect({
  onInit: async ({ locale, context, input }) => {
    await startGame({ locale, context, options: input.data });
  },
  onPrepareExit: () => ({ isDirty: false, canSuspend: true }),
  onExitDecision: (decision) => handleExitDecision(decision),
});
```

协议保证：

- App ready 携带 `appId` 和 App 生成的 `instanceId`；Host init 建立 `runId`。
- 会话消息绑定 `appId + instanceId + runId + messageId`。
- `connect()` 重试 ready、合并重复 init，并在 `onInit` 成功后确认初始化。
- `complete()` 使用稳定 `resultId` 重试，只有收到 `complete-ack` 后结果才成为权威结果。
- Host 按 `resultId` 去重，不重复持久化完成结果。
- App 和 Host 退出使用显式协商；挂起后保持 `runId`，恢复时创建新 `instanceId`。
- Host 校验精确 iframe Window、消息 origin、运行身份、payload 大小和声明的 output contract。

App 不读取 DokiWorld token、Cookie 或内部 HTTP 接口。认证、API key、用户数据访问和后端调用留在 Host；App 只使用 init 中的 `grantedScopes` 和 SDK capability。

## 7. 类型化 capability

每项能力需要同时完成：

1. 在 manifest 的 `runtime.extensions` 声明名称；
2. 在 `createAppClient({ extensions })` 声明名称；
3. 创建对应 Client extension；
4. 确认 Host 为本次 App 注册了相应 Host extension；
5. 在结束或卸载时释放 subscription、listener、timer 和嵌套 Host。

常用模块：

| 模块 | 用途 |
| --- | --- |
| `@dokiworld/app-sdk/dialogue` | 对话、开场、重新生成、回复建议、tagline |
| `@dokiworld/app-sdk/media` | 图片和视频生成任务 |
| `@dokiworld/app-sdk/speech` | 角色语音合成 |
| `@dokiworld/app-sdk/storage` | App 隔离 checkpoint、命名空间 key-value 与分页列表 |
| `@dokiworld/app-sdk/character` | 当前授权角色资料 |
| `@dokiworld/app-sdk/persona` | 玩家 persona 与可信选择 UI |
| `@dokiworld/app-sdk/memory` | 当前人物卡的 owner-scoped 长期记忆分页读取 |
| `@dokiworld/app-sdk/footprint` | 当前人物卡的 owner-scoped 互动足迹分页读取 |
| `@dokiworld/app-sdk/apps` | 查询并启动嵌套 v2 App |
| `@dokiworld/app-sdk/episode` | Episode 语义事件与游戏结果路由 |
| `@dokiworld/app-sdk/game-result` | `doki.game.result/1` 创建、解析和校验 |
| `@dokiworld/app-sdk/runtime-extensions` | 已知扩展名常量 `RUNTIME_EXTENSIONS` 与 `RuntimeExtension` 联合类型 |

未声明的扩展消息会被拒绝；Host 没有实现的 operation 返回稳定的 `unsupported-operation`。具体调用方式见 [`packages/app-sdk/README.zh-CN.md`](../packages/app-sdk/README.zh-CN.md)，Episode 专属机制见 [`episode-app-sdk-integration.zh-CN.md`](episode-app-sdk-integration.zh-CN.md)。

## 8. Game 结算与中途退出

Game 使用 SDK 创建规范结果：

```js
import { createGameResult } from "@dokiworld/app-sdk/game-result";

await app.complete(createGameResult({
  normalizedScore: 82,
  outcome: "win",
  metrics: { points: 300, moves: 4 },
}));
```

`normalizedScore` 是 `0..100` 整数；正常结束 outcome 为 `win | loss | draw | completed`。玩家中途退出时通过 `onPrepareExit` 返回当时分数和 `exited` outcome：

```js
onPrepareExit: () => ({
  isDirty: false,
  canSuspend: false,
  output: createGameResult({
    normalizedScore: currentScore,
    outcome: "exited",
    metrics: currentMetrics,
  }),
})
```

消费方使用 `parseGameResult()` 解析不可信 output。Episode World 使用 `episode.gameCompleted` 转发完整、带版本的 output，并可按 outcome、分数和 metrics 配置不同后续分支。

## 9. 构建与打包

建议 build 顺序：

1. 运行 manifest 生成与校验；
2. 清理并重建 `dist/`；
3. 使用 esbuild/Vite 等把 App 源码与 SDK 打成浏览器 bundle；
4. 复制 HTML、CSS、manifest 和全部运行资源；
5. 校验 `dist/manifest.json.entry` 存在且资源路径没有逃出 `dist/`。

最终包应自包含：

```text
dist/
├─ manifest.json
├─ index.html
├─ app.js
├─ styles.css
└─ assets/
```

资源 URL 使用相对路径（Vite 通常设置 `base: "./"`）。不要只发布 HTML/JavaScript 而遗漏字体、图片、视频或动态分包；不要把源码、token、`.env`、API key、测试凭据或私有 DokiWorld 模块放入 `dist/`。

## 10. 本地同步与 Host 验证

从 DokiWorld 主仓库显式指定 App 仓库：

```powershell
cd D:\dev\dokiworld.git
$env:DOKIWORLD_APPS_ROOT = "D:\dev\dokiworld-apps.git"
npm run sync:local-apps
```

同步脚本会构建每个具有 `package.json` 的 App，读取 `dist/manifest.json`，复制到 `frontend/public/apps/<id>`，然后重新生成统一的 `apps/catalog.json`。生成的 public App 与 catalog 是本地构建产物，不手工编辑。

打开 Developer Mode 后验证本地 App。需要清除同步产物时执行：

```powershell
npm run sync:clean-apps
```

如果只需重新生成 catalog：

```powershell
npm run generate:catalogs --workspace dokiworld-chat-mvp
```

## 11. 发布与升级

发布一次 App 变更时：

1. 提升 `package.json.version`；
2. 更新 contract version（仅当 contract 结构发生不兼容变化）；
3. 安装锁定的 SDK 版本并提交 lockfile；
4. 运行 manifest 生成、测试和 build；
5. 检查 `package.json`、源码 manifest、`dist/manifest.json` 和资源查询版本一致；
6. 发布完整 `dist/` 到 App 静态源，或按管理端要求上传完整包；
7. 更新部署 catalog/静态资源版本，并在真实 Host 完成一次启动、完成和退出。

App 版本、manifest schema、runtime protocol 和业务 contract version 是四个不同维度，不应联动硬编码。

## 12. 验收清单

- [ ] ID 在目录、manifest 和 `createAppClient({ appId })` 中一致。
- [ ] manifest 与 package 版本一致，`dist/manifest.json` 由构建生成。
- [ ] Game 有 `status`、双语 `selection.promptHint` 和声明的结果 contract。
- [ ] World 没有 `selection`，也没有角色资料副本。
- [ ] manifest extension、Client extension 和真实业务调用一致；目标 Host profile 提供全部声明能力。
- [ ] required/optional scope 缺失场景有测试和降级行为。
- [ ] completion、重复 ack、退出、中途得分和 cleanup 有测试。
- [ ] 英文与简体中文名称、描述、提示和 UI 文案一致维护。
- [ ] `dist/` 自包含且不含 secret、私有源码引用或绝对本机路径。
- [ ] 本地同步、catalog 生成、App 测试和 DokiWorld 前端生产构建通过。
