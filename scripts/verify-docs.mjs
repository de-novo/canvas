import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const requiredFiles = [
  "AGENTS.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "CONTRIBUTING.md",
  "README.md",
  "docs/README.md",
  "docs/contributor-automation.md",
  "docs/contributor-operating-policy.md",
  "docs/contributor-rules.md",
  "docs/history/README.md",
  "docs/project-status.md"
];
const contributorEntrypoints = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "README.md",
  "docs/README.md"
];
const canonicalContributorPaths = [
  "contributor-automation.md",
  "contributor-operating-policy.md",
  "contributor-rules.md"
];
const legacyContributorPaths = ["agent-operating-policy.md", "agent-rules.md"];
const skillPathPattern = /^\.agents\/skills\/([^/]+)\/SKILL\.md$/u;

function listMarkdownFiles() {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", "*.md"],
    { cwd: rootDir, encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)
    .sort();
}

function withoutFencedCode(markdown) {
  const output = [];
  let fence = null;

  for (const line of markdown.split("\n")) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/u)?.[1];
    if (marker) {
      const markerKind = marker[0];
      if (fence === null) {
        fence = markerKind;
      } else if (fence === markerKind) {
        fence = null;
      }
      output.push("");
      continue;
    }
    output.push(fence === null ? line : "");
  }

  return output.join("\n");
}

function normalizeLinkTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1);
  } else {
    target = target.split(/\s+(?=["'])/u, 1)[0];
  }
  const pathTarget = target.split("#", 1)[0];
  try {
    return decodeURIComponent(pathTarget);
  } catch {
    return pathTarget;
  }
}

function readFrontmatterValue(frontmatter, key) {
  const prefix = `${key}:`;
  const line = frontmatter.split("\n").find((candidate) => candidate.startsWith(prefix));
  if (!line) {
    return undefined;
  }

  let value = line.slice(prefix.length).trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value || undefined;
}

const errors = [];
let localTargetCount = 0;
let symlinkCount = 0;
let conflictMarkerCount = 0;

for (const requiredFile of requiredFiles) {
  if (!existsSync(resolve(rootDir, requiredFile))) {
    errors.push(`${requiredFile}: required source-of-truth file is missing`);
  }
}

const markdownFiles = listMarkdownFiles();
const skillFiles = [];
const skillNames = new Map();

for (const file of markdownFiles) {
  const absoluteFile = resolve(rootDir, file);
  const fileStat = lstatSync(absoluteFile);
  if (fileStat.isSymbolicLink()) {
    symlinkCount += 1;
    errors.push(`${file}: repository Markdown must not be a symbolic link`);
    continue;
  }

  const markdown = readFileSync(absoluteFile, "utf8");

  if (file.endsWith("/SKILL.md")) {
    const skillPathMatch = file.match(skillPathPattern);
    if (!skillPathMatch) {
      errors.push(`${file}: repository skills must live at .agents/skills/<name>/SKILL.md`);
    } else {
      const directoryName = skillPathMatch[1];
      skillFiles.push(file);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(directoryName) || directoryName.length >= 64) {
        errors.push(`${file}: skill directory must be lowercase hyphenated text under 64 characters`);
      }

      const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n/u);
      if (!frontmatterMatch) {
        errors.push(`${file}: missing YAML frontmatter`);
      } else {
        const name = readFrontmatterValue(frontmatterMatch[1], "name");
        const description = readFrontmatterValue(frontmatterMatch[1], "description");
        if (!name) {
          errors.push(`${file}: frontmatter name is required`);
        } else {
          if (name !== directoryName) {
            errors.push(`${file}: frontmatter name ${name} must match directory ${directoryName}`);
          }
          const priorFile = skillNames.get(name);
          if (priorFile) {
            errors.push(`${file}: duplicate skill name ${name}; first defined in ${priorFile}`);
          } else {
            skillNames.set(name, file);
          }
        }
        if (
          !description ||
          description.length > 1024 ||
          /(?:TODO|placeholder)/iu.test(description)
        ) {
          errors.push(`${file}: frontmatter description must be concrete and complete`);
        }
        const body = markdown.slice(frontmatterMatch[0].length).trim();
        if (!body || /(?:TODO|placeholder)/iu.test(body)) {
          errors.push(`${file}: skill instructions must be concrete and complete`);
        }
      }
    }
  }

  const inspectableMarkdown = withoutFencedCode(markdown);
  const conflictMarkers = inspectableMarkdown.match(/^(?:<{7}|={7}|>{7})(?:\s|$)/gmu) ?? [];
  conflictMarkerCount += conflictMarkers.length;
  if (conflictMarkers.length > 0) {
    errors.push(`${file}: contains ${conflictMarkers.length} conflict marker(s)`);
  }

  for (const match of inspectableMarkdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) {
    const target = normalizeLinkTarget(match[1]);
    if (
      target.length === 0 ||
      target.startsWith("#") ||
      target.startsWith("/") ||
      /^[a-z][a-z0-9+.-]*:/iu.test(target)
    ) {
      continue;
    }

    localTargetCount += 1;
    const resolvedTarget = resolve(rootDir, dirname(file), target);
    if (!existsSync(resolvedTarget)) {
      errors.push(`${file}: missing local Markdown target ${target}`);
    }
  }
}

if (skillFiles.length === 0) {
  errors.push(".agents/skills: expected at least one repository skill");
}

for (const entrypoint of contributorEntrypoints) {
  const content = readFileSync(resolve(rootDir, entrypoint), "utf8");
  for (const canonicalPath of canonicalContributorPaths) {
    if (!content.includes(canonicalPath)) {
      errors.push(`${entrypoint}: does not reference canonical ${canonicalPath}`);
    }
  }
  for (const legacyPath of legacyContributorPaths) {
    if (content.includes(legacyPath)) {
      errors.push(`${entrypoint}: must not use legacy ${legacyPath} as canonical policy`);
    }
  }
}

const status = readFileSync(resolve(rootDir, "docs/project-status.md"), "utf8");
for (const heading of ["Current Phase", "Active", "Next", "Blocked", "Evidence"]) {
  const count = status.match(new RegExp(`^## ${heading}$`, "gmu"))?.length ?? 0;
  if (count !== 1) {
    errors.push(`docs/project-status.md: expected one ## ${heading} heading, found ${count}`);
  }
}
if (!/^Last updated: \d{4}-\d{2}-\d{2}\.$/mu.test(status)) {
  errors.push("docs/project-status.md: Last updated must use YYYY-MM-DD.");
}

const pullRequestTemplate = readFileSync(
  resolve(rootDir, ".github/PULL_REQUEST_TEMPLATE.md"),
  "utf8"
);
for (const heading of [
  "Scope",
  "Contract And Compatibility",
  "Verification",
  "Not Measured",
  "Documentation And Evidence",
  "Checklist"
]) {
  const count = pullRequestTemplate.match(new RegExp(`^## ${heading}$`, "gmu"))?.length ?? 0;
  if (count !== 1) {
    errors.push(
      `.github/PULL_REQUEST_TEMPLATE.md: expected one ## ${heading} heading, found ${count}`
    );
  }
}

if (errors.length > 0) {
  console.error(`verify:docs failed with ${errors.length} error(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `verify:docs passed: ${markdownFiles.length} Markdown files, ` +
      `${localTargetCount}/${localTargetCount} local targets, ` +
      `${symlinkCount} symlinks, ${conflictMarkerCount} conflict markers, ` +
      `${contributorEntrypoints.length}/${contributorEntrypoints.length} contributor entrypoints, ` +
      `${skillFiles.length}/${skillFiles.length} repository skills, ` +
      "5/5 project-status headings, 6/6 pull-request headings"
  );
}
