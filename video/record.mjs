// Records real product footage for the launch video by driving the web app with Playwright.
// Usage: node record.mjs <baseUrl> <pdfPath> [--only agents,project]
// baseUrl is the deployed CloudFront URL (or http://localhost:5173/?mock for a dry run).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [, , BASE = "http://localhost:5173/?mock", PDF = "../sample_data/filing_01.pdf", ...rest] = process.argv;
const only = (rest.find((a) => a.startsWith("--only=")) || "").replace("--only=", "").split(",").filter(Boolean);
const OUT = path.resolve("public/clips");
const W = 1600;
const H = 900;
const manifestPath = path.join(OUT, "manifest.json");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const url = (hash) => `${BASE}${hash}`;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function smoothScroll(page, dy, steps = 30, delay = 16) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await pause(delay);
  }
}

async function typeSlow(locator, text, delay = 55) {
  await locator.click();
  await locator.pressSequentially(text, { delay });
}

async function record(name, fn) {
  if (only.length && !only.includes(name)) return;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } }, colorScheme: "dark" });
  const page = await context.newPage();
  const started = Date.now();
  let state = {};
  try {
    state = (await fn(page)) || {};
  } finally {
    const seconds = (Date.now() - started) / 1000;
    const video = page.video();
    await context.close();
    await browser.close();
    const file = path.join(OUT, `${name}.webm`);
    fs.rmSync(file, { force: true });
    fs.renameSync(await video.path(), file);
    manifest[name] = { seconds: Math.round(seconds * 10) / 10, url: new URL(BASE).host };
    Object.assign(manifest, state);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`recorded ${name}: ${seconds.toFixed(1)}s`);
  }
}

let docHash = manifest.docHash || "";

await record("agents", async (page) => {
  await page.goto(url("#/"));
  await page.waitForLoadState("networkidle");
  await pause(1500);
  await page.locator('input[type="file"]').setInputFiles(PDF);
  await page.waitForURL(/#\/doc\//, { timeout: 60000 });
  docHash = new URL(page.url()).hash;
  await page.getByText(/Finished\./).waitFor({ timeout: 300000 });
  await pause(1500);
  await smoothScroll(page, 900, 60, 20);
  await pause(2500);
  return { docHash };
});

await record("verify", async (page) => {
  await page.goto(url(docHash || "#/doc/demo"));
  await page.getByText(/Finished\./).first().waitFor({ timeout: 60000 }).catch(() => {});
  await pause(1500);
  const rejected = page.getByText(/rejected [1-9]/).first();
  await rejected.scrollIntoViewIfNeeded().catch(() => {});
  await rejected.evaluate((el) => {
    el.style.transition = "background 0.4s";
    el.style.background = "rgba(245,184,61,0.18)";
  }).catch(() => {});
  await pause(2500);
  await page.goto(url(`${docHash || "#/doc/demo"}/p/1`));
  await page.getByText("What Vakeel refused to tell you").waitFor();
  await page.getByText("What Vakeel refused to tell you").scrollIntoViewIfNeeded();
  await smoothScroll(page, -200, 10);
  await pause(3500);
});

await record("project", async (page) => {
  await page.goto(url(`${docHash || "#/doc/demo"}/p/1`));
  await page.getByRole("button", { name: "Object to this proposal" }).waitFor();
  await pause(2500);
  const hindi = page.getByRole("button", { name: "हिंदी" });
  if (await hindi.count()) {
    await hindi.click();
    await pause(2600);
    await page.getByRole("button", { name: "English" }).click();
    await pause(1200);
  }
  await smoothScroll(page, 420, 30);
  await pause(1500);
  await page.getByText("How we calculated this").first().click();
  await pause(3000);
  await page.locator('button[title^="This figure"]').first().click();
  await pause(4500);
  await page.getByRole("button", { name: "Close" }).click();
  await pause(800);
  await smoothScroll(page, 700, 40);
  await pause(2500);
});

await record("object", async (page) => {
  await page.goto(url(`${docHash || "#/doc/demo"}/p/1`));
  await page.getByRole("button", { name: "Object to this proposal" }).click();
  await pause(900);
  await typeSlow(page.locator("form input").first(), "Tamil Adhavan S K");
  await pause(400);
  const place = page.locator("form input").nth(1);
  await place.fill("");
  await typeSlow(place, "Pathadi, Korba");
  await pause(600);
  await page.getByRole("button", { name: "Draft my objection" }).click();
  await page.getByText("Human signature required").waitFor({ timeout: 120000 });
  await pause(1500);
  await smoothScroll(page, 500, 40);
  await pause(1200);
  await smoothScroll(page, -500, 30);
  const phrase = (await page.locator("aside p.serif").first().innerText()).trim();
  await typeSlow(page.getByPlaceholder("Type the sentence above"), phrase, 45);
  await pause(700);
  await page.getByRole("button", { name: "Sign this objection" }).click();
  await page.getByText(/^Signed /).waitFor({ timeout: 60000 });
  await pause(3500);
});

console.log("done", manifest);
