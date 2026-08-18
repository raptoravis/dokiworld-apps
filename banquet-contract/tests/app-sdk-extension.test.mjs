import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Banquet Contract uses the non-duplicated World manifest v2 protocol shape", async () => {
  const manifest = await readFile(new URL("../manifest.json", import.meta.url), "utf8").then(JSON.parse);

  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.protocolVersion, undefined);
  assert.equal(manifest.runtime.protocol, "dokiworld.app");
  assert.equal(manifest.runtime.protocolVersion, 2);
  assert.deepEqual(manifest.context, { requiredScopes: [], optionalScopes: [] });
});

test("Banquet Contract routes episode traffic through the typed SDK extension", async () => {
  const source = await readFile(new URL("../world.js", import.meta.url), "utf8");
  assert.match(source, /createEpisodeClientExtension/);
  assert.doesNotMatch(source, /dokiworld-app-episode/);
  assert.match(source, /message\.type === "episode\.gameResolved"/);
  assert.match(
    source,
    /if \(episodeMode && !secondActActive\) \{\s+showResult\(result, \{ persist: false \}\);\s+postEpisodeEvent\(\{/,
    "the configured Act One app must leave the nested game before waiting for episode resolution",
  );
});

test("video two hands off directly to match-three without the retired text transition", async () => {
  const source = await readFile(new URL("../world.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../world.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /function showLilyTransition/);
  assert.doesNotMatch(styles, /data-lily-transition/);
  assert.match(source, /item\.segment\.id !== "episode-two-lily-narration"/);
  assert.match(source, /if \(visibleLines\.length === 0\) \{\s*renderNextEpisodeSegment\(\)/);
  assert.match(source, /if \(candidate\.kind === "lily-transition"\) \{\s*startGame\(\)/);
  assert.match(source, /\} else \{\s*startGame\(\);\s*\}\s*\}\s*\n\s*async function playScene/);
});

test("Act Two subtitles reuse the Act One runtime dialogue frame", async () => {
  const source = await readFile(new URL("../world.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../world.css", import.meta.url), "utf8");

  assert.match(styles, /\.story-overlay \.subtitle[\s\S]*subtitle-frame\.png/);
  assert.match(source, /const SECOND_ACT_VIDEO_ONE_SUBTITLES = \[/);
  assert.match(source, /const SECOND_ACT_VIDEO_TWO_SUBTITLES = \[/);
  assert.match(source, /copy\.secondActVideo1\[segment\[2\]\]/);
  assert.match(source, /copy\.secondActVideo2\[segment\[2\]\]/);
  assert.match(source, /if \(!videoChoiceOverlay\.classList\.contains\("is-hidden"\)\) \{\s*storyOverlay\.replaceChildren\(\)/);
});

test("the result continues into the planner-aligned 1280 by 718 main interface", async () => {
  const source = await readFile(new URL("../world.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../world.css", import.meta.url), "utf8");
  const background = await readFile(new URL("../ui/main-home-background-placeholder.svg", import.meta.url), "utf8");
  const character = await readFile(new URL("../ui/main-home-character-placeholder.svg", import.meta.url), "utf8");

  assert.match(html, /id="result-continue"/);
  assert.match(html, /id="home-screen"/);
  assert.match(html, /src="\.\/ui\/main-home-background-placeholder\.svg"/);
  assert.match(html, /src="\.\/ui\/main-home-character-placeholder\.svg"/);
  assert.match(html, /id="home-continue-story"/);
  assert.equal((html.match(/data-home-action=/g) || []).length, 6);
  assert.match(source, /function showHome\(/);
  assert.doesNotMatch(source, /function showChapterTwoIntro\(/);
  assert.doesNotMatch(source, /chapter-two-intro/);
  assert.match(source, /checkpointEnvelope\("home", normalized\)/);
  assert.match(source, /resultRestart: "Restart"/);
  assert.match(source, /resultRestart: "重新开始"/);
  assert.match(source, /secondActFeedbackPerfect: "Ryan reads it once/);
  assert.match(source, /secondActFeedbackPerfect: "Ryan读完后满意地点头/);
  assert.match(source, /function syncResultFeedback\(gradeKey\)[\s\S]*resultMessage\.dataset\.speaker = "ryan"[\s\S]*resultFeedbackAvatar\.textContent = "R"[\s\S]*resultFeedbackText\.textContent = copy\[feedbackKey\]/);
  assert.doesNotMatch(source, /resultMessage\.classList\.toggle\("is-hidden", secondActActive\)/);
  assert.match(source, /function handleResultAction\(\)[\s\S]*if \(secondActActive\)[\s\S]*restartStory\(\)[\s\S]*showHome\(\)/);
  assert.match(source, /function restartStory\(\)[\s\S]*postEpisodeEvent\(\{ type: "episode\.restart" \}\)[\s\S]*setPhase\("cover"\)/);
  assert.match(source, /resultActionButton\.addEventListener\("click", handleResultAction\)/);
  assert.match(source, /homeContinueStory\.addEventListener\("click", continueStory\)/);
  assert.match(source, /const SECOND_ACT_VIDEO_ONE_SCENE = 3/);
  assert.match(source, /const SECOND_ACT_VIDEO_TWO_SCENE = 4/);
  assert.match(source, /secondActVideo1 \? \{ secondActVideo1 \} : \{\}/);
  assert.match(source, /secondActVideo2 \? \{ secondActVideo2 \} : \{\}/);
  assert.match(source, /function continueStory\(\)[\s\S]*void playScene\(SECOND_ACT_VIDEO_ONE_SCENE\)/);
  assert.match(source, /function renderSecondActChoices\(/);
  assert.match(source, /copy\.secondActChoiceA, copy\.secondActChoiceB/);
  assert.match(source, /void playScene\(SECOND_ACT_VIDEO_TWO_SCENE\)/);
  assert.match(source, /function startSecondActGame\(/);
  assert.match(source, /banquetLevel: "ryan-speech"/);
  assert.match(source, /matchTitle\.textContent = copy\.secondActMatchTitle/);
  assert.match(source, /matchGoal\.textContent = copy\.secondActMatchGoal/);
  assert.match(source, /if \(episodeMode && !secondActActive\)/);
  assert.match(source, /if \(media\?\.secondActVideo1\) prepareStoryVideo\(media\.secondActVideo1\)/);
  assert.match(source, /prepareStoryVideo\(media\.secondActVideo2\)/);
  assert.match(source, /if \(phase === "video" && video === storyVideo\)/);
  assert.match(source, /secondAct: value\.secondAct === true/);
  assert.match(source, /secondActActive = result\.secondAct/);
  assert.match(source, /secondAct: secondActActive/);
  assert.match(source, /if \(!src\) \{\s*postWorldError\("world_media_unavailable"\);\s*return/);
  assert.match(styles, /\.world-story-stage \.result-message\.is-hidden \{\s*display: none/);
  assert.match(styles, /1280 × 718 planner layout/);
  assert.match(styles, /left: 33\.2%/);
  assert.match(styles, /width: 33\.7%/);
  assert.match(styles, /left: 5\.9%/);
  assert.match(styles, /left: 82%/);
  assert.match(styles, /\.world\[data-phase="home"\] \.world-character-panel \{\s*display: none/);
  assert.match(styles, /aspect-ratio: 1280 \/ 718/);
  assert.match(background, /viewBox="0 0 1280 718"/);
  assert.match(character, /viewBox="0 0 432 630"/);
  assert.doesNotMatch(background, /<text/);
  assert.doesNotMatch(character, /<text/);
});
