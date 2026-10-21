#!/usr/bin/env node
/**
 * NASA Space Apps 2026 — Project Diagnostics MCP Server
 * -------------------------------------------------------
 * Exposes tools for Antigravity (and any MCP-compatible client) to inspect
 * the health, structure, and git status of the NASA Space Apps 2026 projects.
 *
 * Tools:
 *   diagnose_project   — full health report for one project
 *   list_projects      — list all known projects with a summary status
 *   git_status         — git status + log for the monorepo
 *   check_deps         — verify npm / pip dependency files
 *   run_tests          — run the test suite of a project (read-only, no side effects)
 *
 * Usage (stdio transport, compatible with Antigravity MCP config):
 *   node mcp-diagnostics/index.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// ── Root of the monorepo ─────────────────────────────────────────────────────
const REPO_ROOT = resolve("D:/nasa-space-apps-2026");

const KNOWN_PROJECTS = {
  firecal: {
    dir: join(REPO_ROOT, "Harmonization-of-MODIS-and-VIIRS-hot-spots-NASA-CHALLENGE"),
    name: "FireCal Global",
    hasApp: true,
    hasPipeline: true,
    hasTests: true,
    testCmd: ".venv/Scripts/python -m pytest tests -q",
    devPort: 5178,
  },
  "mission-game": {
    dir: join(REPO_ROOT, "Space-Mission-Design-Game-NASA-CHALLENGE"),
    name: "Δv Mission Control",
    hasApp: true,
    hasPipeline: false,
    hasTests: true,
    testCmd: "npx vitest run",
    devPort: 5180,
  },
  "astronaut-trainer": {
    dir: join(REPO_ROOT, "Build-a-Junior-Astronaut-Mission-Trainer-NASA-CHALLENGE"),
    name: "Junior Astronaut Mission Trainer",
    hasApp: true,
    hasPipeline: false,
    hasTests: false,
    testCmd: null,
    devPort: 5181,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeExec(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", timeout: 15_000 }).trim();
  } catch (e) {
    return `ERROR: ${e.message.split("\n")[0]}`;
  }
}

function fileExists(path) {
  return existsSync(path);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function dirSize(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const f of readdirSync(dir, { recursive: true })) {
    try {
      const s = statSync(join(dir, f));
      if (s.isFile()) total += s.size;
    } catch {}
  }
  return total;
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// ── Project Diagnostics ──────────────────────────────────────────────────────

function diagnoseProject(key) {
  const p = KNOWN_PROJECTS[key];
  if (!p) return { error: `Unknown project: ${key}. Valid keys: ${Object.keys(KNOWN_PROJECTS).join(", ")}` };

  const d = p.dir;
  const report = {
    project: p.name,
    key,
    directory: d,
    exists: existsSync(d),
    checks: {},
    warnings: [],
    suggestions: [],
  };

  if (!report.exists) {
    report.warnings.push("Project directory not found.");
    return report;
  }

  // ── README ────────────────────────────────────────────────────────────────
  report.checks.readme = fileExists(join(d, "README.md")) ? "✅ present" : "❌ missing";

  // ── .gitignore ────────────────────────────────────────────────────────────
  report.checks.gitignore = fileExists(join(d, ".gitignore")) ? "✅ present" : "⚠️  missing (root one covers it)";

  // ── App (Node) ────────────────────────────────────────────────────────────
  if (p.hasApp) {
    const appDir = join(d, "app");
    const pkgJson = readJson(join(appDir, "package.json"));
    report.checks.app_package_json = pkgJson ? `✅ ${pkgJson.name ?? "(no name)"}@${pkgJson.version ?? "?"}` : "❌ missing";
    report.checks.app_node_modules = existsSync(join(appDir, "node_modules")) ? "✅ installed" : "❌ missing (run npm ci)";
    report.checks.app_dist = existsSync(join(appDir, "dist")) ? `✅ built (${humanSize(dirSize(join(appDir, "dist")))})` : "⚠️  not built (run npm run build)";
    report.checks.app_nvmrc = existsSync(join(appDir, ".nvmrc"))
      ? `✅ ${readFileSync(join(appDir, ".nvmrc"), "utf-8").trim()}`
      : "⚠️  no .nvmrc";
    if (!existsSync(join(appDir, "node_modules"))) report.suggestions.push("Run: cd app && npm ci");
  }

  // ── Pipeline (Python) ─────────────────────────────────────────────────────
  if (p.hasPipeline) {
    report.checks.requirements_txt = fileExists(join(d, "requirements.txt")) ? "✅ present" : "❌ missing";
    const venv = join(d, ".venv");
    report.checks.python_venv = existsSync(venv) ? "✅ present" : "⚠️  not created (run: python -m venv .venv)";
    report.checks.pipeline_scripts = readdirSync(join(d, "pipeline")).filter(f => f.endsWith(".py")).join(", ");
    if (!existsSync(venv)) report.suggestions.push("Run: python -m venv .venv && .venv/Scripts/pip install -r requirements.txt pytest");
  }

  // ── Tests ─────────────────────────────────────────────────────────────────
  if (p.hasTests) {
    report.checks.test_cmd = p.testCmd;
    report.checks.test_directory = existsSync(join(d, "tests")) || existsSync(join(d, "app/src")) ? "✅ found" : "⚠️  not found";
  }

  // ── GitHub Actions ────────────────────────────────────────────────────────
  const ciDir = join(d, ".github", "workflows");
  if (existsSync(ciDir)) {
    const workflows = readdirSync(ciDir).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
    report.checks.ci_workflows = workflows.length > 0 ? `✅ ${workflows.join(", ")}` : "⚠️  no workflows";
  } else {
    report.checks.ci_workflows = "⚠️  no .github/workflows";
    if (key === "firecal") report.suggestions.push("Consider adding CI for the NRT pipeline.");
  }

  // ── Docs ──────────────────────────────────────────────────────────────────
  const docsDir = join(d, "docs");
  if (existsSync(docsDir)) {
    const docs = readdirSync(docsDir).filter(f => f.endsWith(".md"));
    report.checks.docs = `✅ ${docs.length} markdown files`;
  } else {
    report.checks.docs = "⚠️  no docs/";
    report.suggestions.push("Add a docs/ directory with project documentation.");
  }

  return report;
}

// ── Git helpers ───────────────────────────────────────────────────────────────

function gitStatus() {
  const status = safeExec("git status --short", REPO_ROOT);
  const log = safeExec("git log --oneline -10", REPO_ROOT);
  const remote = safeExec("git remote -v", REPO_ROOT);
  const branch = safeExec("git branch --show-current", REPO_ROOT);
  return { branch, remote, status: status || "(clean)", recentCommits: log || "(no commits yet)" };
}

// ── Dep check ────────────────────────────────────────────────────────────────

function checkDeps(key) {
  const p = KNOWN_PROJECTS[key];
  if (!p) return { error: `Unknown project: ${key}` };
  const result = { project: p.name, npm: null, pip: null };

  if (p.hasApp) {
    const appDir = join(p.dir, "app");
    const pkg = readJson(join(appDir, "package.json"));
    const lock = fileExists(join(appDir, "package-lock.json"));
    result.npm = {
      name: pkg?.name,
      version: pkg?.version,
      deps: Object.keys(pkg?.dependencies ?? {}).length,
      devDeps: Object.keys(pkg?.devDependencies ?? {}).length,
      lockfile: lock ? "✅ package-lock.json" : "❌ missing lock file",
      node_modules: existsSync(join(appDir, "node_modules")) ? "✅ installed" : "❌ not installed",
    };
  }

  if (p.hasPipeline) {
    const reqFile = join(p.dir, "requirements.txt");
    if (fileExists(reqFile)) {
      const lines = readFileSync(reqFile, "utf-8").split("\n").filter(l => l.trim() && !l.startsWith("#"));
      result.pip = { packages: lines.length, requirements_txt: "✅ present", venv: existsSync(join(p.dir, ".venv")) ? "✅" : "❌ not created" };
    } else {
      result.pip = { requirements_txt: "❌ missing" };
    }
  }

  return result;
}

// ── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "nasa-space-apps-diagnostics",
  version: "1.0.0",
});

// Tool: list_projects
server.tool(
  "list_projects",
  "List all NASA Space Apps 2026 projects with a summary health status.",
  {},
  async () => {
    const results = Object.entries(KNOWN_PROJECTS).map(([key, p]) => {
      const appOk = !p.hasApp || existsSync(join(p.dir, "app", "node_modules"));
      const pipeOk = !p.hasPipeline || existsSync(join(p.dir, ".venv"));
      const readmeOk = existsSync(join(p.dir, "README.md"));
      const health = appOk && pipeOk && readmeOk ? "🟢 healthy" : "🟡 needs attention";
      return { key, name: p.name, port: p.devPort, health, directory: p.dir };
    });
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
);

// Tool: diagnose_project
server.tool(
  "diagnose_project",
  "Run a full health diagnostic for a specific NASA Space Apps 2026 project.",
  { project: z.enum(["firecal", "mission-game", "astronaut-trainer"]).describe("Project key to diagnose") },
  async ({ project }) => {
    const report = diagnoseProject(project);
    return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
  }
);

// Tool: git_status
server.tool(
  "git_status",
  "Show the git status, recent commits, and remote configuration for the NASA Space Apps 2026 monorepo.",
  {},
  async () => {
    const info = gitStatus();
    return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
  }
);

// Tool: check_deps
server.tool(
  "check_deps",
  "Verify npm and pip dependency status for a NASA Space Apps 2026 project.",
  { project: z.enum(["firecal", "mission-game", "astronaut-trainer"]).describe("Project key to check") },
  async ({ project }) => {
    const info = checkDeps(project);
    return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
  }
);

// Tool: run_tests
server.tool(
  "run_tests",
  "Run the test suite for a NASA Space Apps 2026 project and return the output. Read-only; does not modify source files.",
  { project: z.enum(["firecal", "mission-game"]).describe("Project key (only projects with tests are supported)") },
  async ({ project }) => {
    const p = KNOWN_PROJECTS[project];
    if (!p?.hasTests || !p.testCmd) {
      return { content: [{ type: "text", text: `Project '${project}' has no configured test command.` }] };
    }
    const appDir = p.hasPipeline ? p.dir : join(p.dir, "app");
    const result = spawnSync(p.testCmd, {
      shell: true,
      cwd: appDir,
      encoding: "utf-8",
      timeout: 60_000,
    });
    const output = [
      `$ ${p.testCmd}`,
      result.stdout ?? "",
      result.stderr ?? "",
      `Exit code: ${result.status}`,
    ].join("\n").trim();
    return { content: [{ type: "text", text: output }] };
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
