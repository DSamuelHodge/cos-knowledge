#!/usr/bin/env node
// Knowledge-graph export: walks docs/, parses the frontmatter contract
// (id/type/category/status/tags/tools) + relative .md links, and writes
// {nodes, edges} JSON next to the other agent artifacts in dist/client.
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DOCS = path.join(ROOT, "docs");
const OUT = path.join(ROOT, "dist", "client", "knowledge-graph.json");
const SITE = "https://cos.hodgederrick.com";

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(path.join(dir, e.name))
      : e.name.endsWith(".md")
        ? [path.join(dir, e.name)]
        : [],
  );

const yamlLite = (block) => {
  const out = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const [, k, raw] = m;
    let v = raw.trim();
    if (v.startsWith("[") && v.endsWith("]")) {
      v = v.slice(1, -1).split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
    } else {
      v = v.replace(/^['"]|['"]$/g, "");
    }
    out[k] = v;
  }
  return out;
};

const FINAL_SLUG = /^\d+[-_]/;

const routeOf = (file) => {
  const rel = path.relative(DOCS, file).split(path.sep).join("/");
  const parts = rel.split("/");
  const base = parts.pop();
  if (base === "index.md") {
    const dir = parts.join("/");
    return dir ? `/${dir}/` : "/";
  }
  const stem = base.replace(/\.md$/, "").replace(FINAL_SLUG, "");
  return `/${parts.concat(stem).join("/")}`;
};

const docs = walk(DOCS).sort();
const nodeMap = new Map();
const byRoute = new Map();

for (const file of docs) {
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) continue;
  const fm = yamlLite(m[1]);
  const route = routeOf(file);
  const node = {
    id: fm.id || route,
    type: fm.type || "doc",
    title: fm.title || route.split("/").filter(Boolean).pop() || "Home",
    route,
    url: SITE + route,
  };
  for (const k of ["category", "status", "updated"]) if (fm[k]) node[k] = fm[k];
  for (const k of ["tags", "tools"]) if (Array.isArray(fm[k]) && fm[k].length) node[k] = fm[k];
  nodeMap.set(node.id, node);
  byRoute.set(route, node.id);
}

const edges = [];
for (const file of docs) {
  const raw = readFileSync(file, "utf8");
  const fmBlock = raw.match(/^---\n([\s\S]*?)\n---\n/)?.[1] || "";
  const srcId = yamlLite(fmBlock).id;
  if (!srcId || !nodeMap.has(srcId)) continue;
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let hit;
  while ((hit = re.exec(raw))) {
    const link = hit[1].trim().split(/[?#]/, 1)[0];
    if (!link || /^(https?:|mailto:|tel:|#)/.test(link)) continue;
    let tid = null;
    if (link.endsWith(".md") || link.endsWith(".mdx")) {
      const target = path.resolve(path.dirname(file), link);
      const tRel = path.relative(DOCS, target);
      if (tRel && !tRel.startsWith("..") && existsSync(target)) {
        const tRoute = routeOf(target);
        tid = byRoute.get(tRoute);
        if (!tid) {
          const tFm = readFileSync(target, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] || "";
          tid = yamlLite(tFm).id;
        }
      }
    } else {
      // folder/route-style link: resolve relative to the file's dir, try leaf + index routes
      const norm = (p) => path.posix.normalize(p).replace(/\/+$/, "");
      const base = norm(path.posix.join(path.posix.dirname(path.relative(DOCS, file)), link));
      tid = byRoute.get(`/${base}`) || byRoute.get(`/${base}/`);
    }
    if (tid && nodeMap.has(tid) && tid !== srcId) {
      edges.push({ source: srcId, target: tid });
    }
  }
}

const byId = (a, b) => a.localeCompare(b);
const payload = {
  $schema: "https://cos.hodgederrick.com/knowledge-graph.json",
  generatedAt: new Date().toISOString(),
  site: SITE,
  nodes: [...nodeMap.values()].sort((a, b) => byId(a.id, b.id)),
  edges: edges.sort((a, b) => byId(a.source, b.source) || byId(a.target, b.target)),
};

mkdirSync(path.dirname(OUT), { recursive: true });

// ---- health stats (Karpathy-style lint: orphans, degree, type spread) ----
const ids = new Set(payload.nodes.map((n) => n.id));
const typeCounts = {};
const categoryCounts = {};
const degree = new Map();
for (const n of payload.nodes) {
  typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  if (n.category) categoryCounts[n.category] = (categoryCounts[n.category] || 0) + 1;
  degree.set(n.id, 0);
}
for (const e of payload.edges) {
  degree.set(e.source, (degree.get(e.source) || 0) + 1);
  degree.set(e.target, (degree.get(e.target) || 0) + 1);
}
const degVals = [...degree.values()];
const orphans = payload.nodes.filter((n) => !degree.get(n.id)).map((n) => n.id);
payload.stats = {
  nodeCount: payload.nodes.length,
  edgeCount: payload.edges.length,
  typeCounts,
  categoryCounts,
  degree: {
    min: Math.min(...degVals),
    max: Math.max(...degVals),
    mean: Number((degVals.reduce((a, b) => a + b, 0) / Math.max(degVals.length, 1)).toFixed(2)),
    orphanCount: orphans.length,
    orphans,
  },
};
const dangling = edges.filter((e) => !ids.has(e.source) || !ids.has(e.target)).length;
writeFileSync(OUT, JSON.stringify(payload, null, 1));

// ---- log.md: append-only chronological index, greppable from git ----
const { execFileSync } = await import("node:child_process");
try {
  const gitLog = execFileSync("git", ["log", "-30", "--format=## [%ad] %s", "--date=format:%Y-%m-%d", "--", "docs"], { cwd: ROOT, encoding: "utf8" });
  writeFileSync(path.join(ROOT, "dist", "client", "log.md"), "# CoS KB change log (git-derived)\n\n" + gitLog);
} catch (e) {
  console.warn("log.md generation skipped:", e.message);
}

console.log(
  `knowledge-graph: ${payload.nodes.length} nodes, ${payload.edges.length} edges ` +
    `(dangling: ${dangling}, orphans: ${orphans.length}) -> ${path.relative(ROOT, OUT)}`,
);
process.exit(dangling ? 1 : 0);