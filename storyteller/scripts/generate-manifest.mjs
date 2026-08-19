// 按 docs/external-game-provider-integration.zh-CN.md 生成 storyteller 的 manifest。
//
// storyteller 是 schema v2 manifest、dokiworld.app/2 runtime 的 App（episodeRenderer）。
// 本脚本以模块内的 JS 对象作为单一事实来源，校验后输出 src/manifest.json，
// 让 manifest 不再手写、始终与文档规范一致。build.mjs 会在生成 dist 前调用它。
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(root, "src");
const defaultOutput = resolve(srcDir, "manifest.json");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const REQUIRED_LOCALES = ["en", "zh-cn"];

// —— manifest 单一事实来源 ——
// 字段顺序即输出顺序，与原 src/manifest.json 保持一致。
const manifest = {
  schemaVersion: 2,
  version: packageJson.version,
  id: "storyteller",
  chatLaunchable: false,
  status: "active",
  entry: "index.html",
  runtime: {
    protocol: "dokiworld.app",
    protocolVersion: 2,
    input: { contract: "doki.world.storyteller-input", version: 1 },
    outputs: [{ contract: "doki.world.session-result", version: 1 }],
    extensions: ["world", "episode", "chat", "dialogue", "media", "speech", "storage", "character", "persona", "apps", "checkpoint"],
  },
  episodeRenderer: true,
  launchRequirements: { minPlayers: 1 },
  context: {
    requiredScopes: [],
    optionalScopes: ["character.identity", "character.avatar", "character.card", "player_persona"],
  },
  locales: {
    en: {
      name: "Storyteller",
      description:
        "A cinematic player for interactive episodes with dialogue, media, choices, and app launches.",
    },
    "zh-cn": {
      name: "故事演绎",
      description: "用于演绎互动剧集的电影式播放器，支持对话、媒体、选择与应用拉起。",
    },
  },
};

function validate(target, src = srcDir) {
  const errors = [];
  if (!ID_PATTERN.test(target.id)) {
    errors.push(`id "${target.id}" 不合法（仅小写字母/数字/连字符，须等于目录名）`);
  }
  if (!existsSync(resolve(src, target.entry))) {
    errors.push(`entry "${target.entry}" 在 src/ 下不存在`);
  }
  if (target.schemaVersion !== 2) errors.push("schemaVersion 必须为 2");
  if (!SEMVER_PATTERN.test(target.version)) errors.push("version 必须来自 package.json 且符合 semver");
  if (target.chatLaunchable !== false) errors.push("chatLaunchable 必须为 false");
  if (target.protocolVersion !== undefined) errors.push("schemaVersion 2 不得声明顶层 protocolVersion");
  if (target.runtime?.protocol !== "dokiworld.app" || target.runtime?.protocolVersion !== 2) {
    errors.push("runtime 必须使用 dokiworld.app v2");
  }
  for (const locale of REQUIRED_LOCALES) {
    const block = target.locales?.[locale];
    if (!block?.name || !block?.description) {
      errors.push(`locales.${locale} 缺少 name 或 description`);
    }
  }
  const context = target.context ?? {};
  if (!Array.isArray(context.requiredScopes) || !Array.isArray(context.optionalScopes)) {
    errors.push("context.requiredScopes / optionalScopes 必须为数组");
  }
  if (typeof target.launchRequirements?.minPlayers !== "number") {
    errors.push("launchRequirements.minPlayers 必须为数字");
  }
  if (errors.length) {
    throw new Error(`manifest.json 校验失败：\n  - ${errors.join("\n  - ")}`);
  }
}

/** 生成并写回 manifest.json，返回输出路径。 */
export function generateManifest(output = defaultOutput) {
  validate(manifest);
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(output, json, "utf-8");
  return output;
}

export { manifest };

// 直接运行：node scripts/generate-manifest.mjs [--output <path>]
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isMain) {
  const idx = process.argv.indexOf("--output");
  const output = idx > -1 ? resolve(process.argv[idx + 1]) : defaultOutput;
  const written = generateManifest(output);
  console.log(`Generated ${written}`);
}
