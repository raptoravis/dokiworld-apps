import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Banquet Contract keeps separate planner-authored scoring for both acts", async () => {
  const [source, html, styles] = await Promise.all([
    readFile(new URL("../index.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /const BANQUET_THRESHOLDS = \[10, 20, 40\]/);
  assert.match(source, /const RYAN_SPEECH_THRESHOLDS = \[15, 25, 50\]/);
  assert.match(source, /options\.banquetLevel === "ryan-speech"/);
  assert.match(source, /ryanSpeechGoal: "Complete the “perfect” speech Ryan will use tonight\."/);
  assert.match(source, /ryanSpeechGoal: "完成Ryan今晚使用的“完美”演讲稿。"/);
  assert.match(source, /goalLabel: "Goal:"/);
  assert.match(source, /goalLabel: "目标："/);
  assert.match(source, /tier\.dataset\.threshold = String\(threshold\)/);
  assert.match(source, /image\.src = "\.\/banquet-booster-locked\.png"/);
  assert.match(source, /button\.className = "match3-booster is-locked"/);
  assert.match(source, /button\.disabled = true/);
  assert.match(html, /id="banquet-booster-list"/);
  assert.match(html, /id="banquet-goal-label">Goal:<\/span>/);
  assert.doesNotMatch(html, /🔒/);
  assert.match(html, /data-threshold="10"[\s\S]*data-threshold="20"[\s\S]*data-threshold="40"/);
  assert.match(styles, /#banquet-goal-label\s*\{[^}]*font-size:\s*3\.2cqh/s);
  assert.match(styles, /#banquet-goal\s*\{[^}]*font-size:\s*3\.2cqh/s);
  assert.match(styles, /\.match3-score-track span\s*\{[^}]*top:\s*0/s);
  assert.match(styles, /\.match3-score-ladder ol\s*\{[^}]*flex-direction:\s*column;/s);
  assert.doesNotMatch(styles, /flex-direction:\s*column-reverse/);
  assert.match(
    styles,
    /\.match3-score-track\s*\{[^}]*left:\s*calc\(50% - 2\.5px\)/s,
  );
  assert.match(
    styles,
    /\.match3-score-ladder ol\s*\{[^}]*left:\s*calc\(50% - var\(--ladder-marker-size\) \/ 2\)/s,
  );
});
