// Copies the website's app into www/ for the iPhone build, leaving out server code and website-only files,
// and loads native.js first.
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "www");
const SKIP_DIRS = new Set(["ios-app", "tests", "api", ".git", ".github", "screenshots", "node_modules", "__pycache__"]);
const SKIP_FILES = /(\.py|\.pyc|\.md)$|^(requirements\.txt|vercel\.json|assetlinks\.json|robots\.txt|sitemap\.xml|test\.html|sea-test\.html|google[0-9a-f]+\.html|sw\.js|\.vercelignore|\.gitignore)$/;

fs.rmSync(OUT, { recursive: true, force: true });
function copy(dir, rel) {
  fs.mkdirSync(path.join(OUT, rel), { recursive: true });
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) copy(path.join(dir, e.name), r); }
    else if (!SKIP_FILES.test(e.name)) fs.copyFileSync(path.join(dir, e.name), path.join(OUT, r));
  }
}
copy(SRC, "");
fs.copyFileSync(path.join(__dirname, "native.js"), path.join(OUT, "native.js"));
// Capacitor's own script (adds registerPlugin, which native.js uses for the iPhone's location permission).
fs.copyFileSync(require.resolve("@capacitor/core/dist/capacitor.js"), path.join(OUT, "capacitor.js"));
// SHOTS=1: the cloud Mac's test build, which steps through the main screens for screenshots.
const SHOTS = process.env.SHOTS === "1";
if (SHOTS) fs.copyFileSync(path.join(__dirname, "shots.js"), path.join(OUT, "shots.js"));

// Every HTML page: native.js first; no website visitor counter (it only exists on the website).
let pages = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { walk(f); continue; }
    if (!e.name.endsWith(".html")) continue;
    let h = fs.readFileSync(f, "utf8");
    const depth = path.relative(OUT, dir).split(path.sep).filter(Boolean).length;
    h = h.replace(/<meta charset="utf-8">/i, (m) => m + '\n  <script src="' + "../".repeat(depth) + 'capacitor.js"></script>\n  <script src="' + "../".repeat(depth) + 'native.js"></script>');
    if (SHOTS && e.name === "index.html" && depth === 0) h = h.replace("native.js\"></script>", "native.js\"></script>\n  <script src=\"shots.js\"></script>");
    h = h.replace(/\s*<script[^>]*src="\/_vercel\/insights\/script\.js"><\/script>/g, "");
    fs.writeFileSync(f, h);
    pages++;
  }
})(OUT);
console.log("www ready: " + pages + " pages");
