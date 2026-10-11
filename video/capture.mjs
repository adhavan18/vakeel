// Captures every state of the live app as crisp 2x screenshots, plus the on-screen
// box of every element the virtual cursor will click. Remotion animates these into
// smooth product scenes (no screen-recording stutter).
// Usage: node capture.mjs <baseUrl> <pdf>
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [, , BASE = "https://d4i9n8m04ddaa.cloudfront.net/", PDF] = process.argv;
const OUT = path.resolve("public/screens");
fs.rmSync(OUT, { recursive: true, force: true });
const W = 1440, H = 900;
const shots = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

async function shot(scene, extra = {}) {
  const dir = path.join(OUT, scene);
  fs.mkdirSync(dir, { recursive: true });
  const n = (shots[scene] ||= []).length;
  const file = `${scene}/${String(n).padStart(3, "0")}.jpg`;
  await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 90 });
  const scrollY = await page.evaluate(() => window.scrollY);
  shots[scene].push({ file, t: Date.now(), scrollY, ...extra });
}

async function box(locator) {
  const b = await locator.boundingBox();
  return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height } : null;
}

async function smoothScrollTo(y) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
  await wait(400);
}

// ---------- home ----------
await page.goto(BASE + "#/");
await page.waitForLoadState("networkidle");
await wait(2500);
await shot("home", { target: await box(page.getByRole("button", { name: "Read a filing" }).first()) });
const choose = page.getByRole("button", { name: "Choose PDF" });
await choose.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -160));
await wait(600);
await shot("home", { target: await box(choose), click: true });

// ---------- agents (live run) ----------
await page.locator('input[type="file"]').setInputFiles(PDF);
await page.waitForURL(/#\/doc\//, { timeout: 60000 });
const docHash = new URL(page.url()).hash;
const started = Date.now();
while (Date.now() - started < 240000) {
  await shot("agents");
  if (await page.getByText(/Finished\./).count()) break;
  await wait(700);
}
await wait(1200);
await shot("agents");
const approves = page.getByText("What this filing approves");
await approves.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -80));
await wait(2500);
await shot("agents");
await page.evaluate(() => window.scrollBy(0, 420));
await wait(1200);
const firstCard = page.locator('a[href*="/p/1"]').first();
await shot("agents", { target: await box(firstCard), click: true });

// ---------- verify ----------
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await wait(800);
const rejectedLine = page.getByText(/rejected [1-9]/).first();
await shot("verify", { target: await box(rejectedLine) });
await page.goto(BASE + docHash + "/p/1");
await page.getByRole("button", { name: "Object to this proposal" }).waitFor();
await wait(1500);
const refused = page.getByText("What Vakeel refused to tell you");
await refused.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -120));
await wait(800);
await shot("verify", { target: await box(refused) });

// ---------- project ----------
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await wait(1200);
const hindi = page.getByRole("button", { name: "हिंदी" });
await shot("project", { target: await box(hindi) });
if (await hindi.count()) {
  await hindi.click();
  await wait(900);
  await shot("project", { target: await box(hindi), click: true });
  await page.getByRole("button", { name: "English" }).click();
  await wait(900);
}
await page.evaluate(() => window.scrollBy(0, 470));
await wait(1300);
const calc = page.getByText("How we calculated this").nth(1);
await shot("project", { target: await box(calc) });
await calc.click();
await wait(900);
await shot("project", { target: await box(calc), click: true });
await page.evaluate(() => window.scrollBy(0, 520));
await wait(1200);
await shot("project");

// ---------- evidence ----------
const tick = page.locator('button[title^="This figure"]').first();
await tick.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -200));
await wait(700);
await shot("evidence", { target: await box(tick) });
await tick.click();
await page.getByText("Found word-for-word").waitFor();
await wait(1500);
await shot("evidence", { target: await box(page.locator("mark.vk").first()), click: true });
await page.getByRole("button", { name: "Close" }).click();
await wait(600);

// ---------- object ----------
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await wait(600);
const objectBtn = page.getByRole("button", { name: "Object to this proposal" });
await shot("object", { target: await box(objectBtn) });
await objectBtn.click();
await wait(700);
const nameInput = page.locator("form input").first();
await shot("object", { target: await box(nameInput), click: true });
const name = "Tamil Adhavan S K";
for (let i = 1; i <= name.length; i += 3) {
  await nameInput.fill(name.slice(0, i));
  await shot("object", { typing: true });
}
await nameInput.fill(name);
const place = page.locator("form input").nth(1);
await place.fill("Pathadi, Korba");
await wait(300);
const draftBtn = page.getByRole("button", { name: "Draft my objection" });
await shot("object", { target: await box(draftBtn) });
await draftBtn.click();
await page.waitForURL(/#\/objection\//);
await wait(1200);
await shot("object", { drafting: true });
await page.getByText("Human signature required").waitFor({ timeout: 120000 });
await wait(1500);
await shot("object");
const phraseText = (await page.locator("aside p.serif").first().innerText()).trim();
const phrase = page.getByPlaceholder("Type the sentence above");
await shot("object", { target: await box(phrase), click: true });
for (let i = 2; i <= phraseText.length; i += 3) {
  await phrase.fill(phraseText.slice(0, i));
  await shot("object", { typing: true });
}
await phrase.fill(phraseText);
await wait(300);
const signBtn = page.getByRole("button", { name: "Sign this objection" });
await shot("object", { target: await box(signBtn) });
await signBtn.click();
await page.getByText(/^Signed /).waitFor({ timeout: 60000 });
await wait(1500);
await shot("object", { target: await box(page.getByText(/^Signed /)), click: true });

fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ viewport: { w: W, h: H }, url: new URL(BASE).host, docHash, shots }, null, 2));
console.log(Object.fromEntries(Object.entries(shots).map(([k, v]) => [k, v.length])));
await browser.close();
