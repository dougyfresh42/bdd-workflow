---
date: 2026-04-03
slug: update-manifest-three-way-diff
status: approved
---

# Proposal: Manifest-Based Three-Way Diff for `bdd-workflow update`

## 1. Summary

The current `update` command uses a two-way diff: if a file on disk differs from the current
template, it is conservatively classified as `modifiedByUser` and skipped (unless `--force` is
passed). This means a framework file that was never touched by the user but has since been
updated upstream will also be skipped — the user has to run `--force` to get the new version,
risking overwriting their own customizations.

The correct behavior is a **three-way diff**:
- If the disk content matches the **original content the package wrote** (tracked in a manifest),
  then the file was not modified by the user — it is safe to update it to the current template.
- If the disk content differs from the original written content, then the user modified it —
  skip (or prompt, or merge).

This proposal also adds **frontmatter key preservation** for agent and command files. These files
have YAML frontmatter with provider-specific fields (`model:`, `temperature:`) that users
legitimately customize to match their LLM provider. Rather than treating the whole file as
user-modified (and skipping it) or blindly overwriting the user's model choice, `update` performs
a structured merge: user-owned frontmatter keys are preserved from the on-disk version while
framework-owned frontmatter keys and the file body are updated from the template.

**User-owned frontmatter keys** (preserved during update):
- `model:` — the LLM provider/model string (e.g. `openai/gpt-4o`, `anthropic/claude-opus-4-5`)
- `temperature:` — sampling temperature

**Framework-owned frontmatter keys** (always updated from template):
- `description:` — command description shown in the UI
- `mode:` — agent execution mode (`subagent`, etc.)
- `agent:` — named agent routing
- `permission:` — bash permission rules

Files with no frontmatter (e.g. skill `SKILL.md` files) continue to use the standard three-way
hash diff with no merging.

This proposal implements:
1. A manifest file at `.opencode/.bdd-workflow-manifest.json` recording SHA-256 hashes of every
   framework file at write time, enabling three-way diff.
2. Frontmatter-aware merge for `.md` files containing YAML frontmatter, preserving user-owned keys.

**User-visible impact:** Running `npx bdd-workflow update` will automatically refresh framework
files the user has not customized; and for files where only `model:` or `temperature:` differ, it
will merge the body and framework frontmatter from the template while keeping the user's model
choice. The `--force` flag still exists to override all merge logic and overwrite completely.

---

## 2. Doc Updates (the WHY layer)

### New module: `src/scaffold/manifest.ts`

```typescript
/**
 * @module scaffold/manifest
 * @description Manages the bdd-workflow write manifest at
 * `.opencode/.bdd-workflow-manifest.json`. The manifest records the SHA-256
 * hash of each framework-layer file at the time it was last written by
 * `bdd-workflow init` or `bdd-workflow update`. This enables `update` to
 * perform a true three-way diff: if the on-disk content's hash matches the
 * recorded hash, the file was not modified by the user and can be safely
 * overwritten with the new template version. If the hashes differ, the user
 * has customized the file and the update is skipped (or merged, for
 * frontmatter-bearing files).
 *
 * Does NOT track user-owned files. Does NOT perform file I/O beyond reading
 * and writing the single manifest JSON file.
 */
```

#### `Manifest` type

```typescript
/**
 * The shape of `.opencode/.bdd-workflow-manifest.json`.
 * Maps relative file paths (from project root) to the SHA-256 hex digest of
 * the content that `bdd-workflow` last wrote to that path.
 */
export type Manifest = Record<string, string>;
```

#### `readManifest(targetDir)`

```typescript
/**
 * Read the bdd-workflow manifest from a project directory.
 * Returns an empty object if the manifest file does not exist (e.g. project
 * was initialized before manifests were introduced).
 *
 * @param targetDir - Absolute path to the project root.
 * @returns The manifest, or `{}` if absent.
 */
```

#### `writeManifest(targetDir, manifest)`

```typescript
/**
 * Write the bdd-workflow manifest to a project directory, creating the
 * `.opencode/` directory if necessary.
 *
 * @param targetDir - Absolute path to the project root.
 * @param manifest - The manifest to persist.
 */
```

#### `hashContent(content)`

```typescript
/**
 * Compute the SHA-256 hex digest of a UTF-8 string.
 * Used to record file content at write time and compare at update time.
 *
 * @param content - UTF-8 string to hash.
 * @returns Lowercase hex SHA-256 digest.
 */
```

### New module: `src/scaffold/frontmatter.ts`

```typescript
/**
 * @module scaffold/frontmatter
 * @description Utilities for parsing, merging, and serializing YAML frontmatter
 * in OpenCode agent and command markdown files. Enables `update` to refresh
 * framework-owned content (body text, structural frontmatter keys like
 * `description`, `mode`, `agent`, `permission`) while preserving user-owned
 * keys (`model`, `temperature`) that users legitimately customize to match
 * their LLM provider.
 *
 * Uses the already-present `gray-matter` dependency for frontmatter parsing.
 * Does NOT perform any file I/O — callers are responsible for reading and
 * writing files.
 */
```

#### `USER_OWNED_FRONTMATTER_KEYS` constant

```typescript
/**
 * Frontmatter keys that belong to the user, not the framework.
 * During `update`, these keys are taken from the on-disk file (preserving
 * user customizations) rather than from the template.
 *
 * - `model`: LLM provider/model string (e.g. "openai/gpt-4o")
 * - `temperature`: Sampling temperature (0.0–2.0)
 *
 * All other frontmatter keys (`description`, `mode`, `agent`, `permission`,
 * etc.) are framework-owned and always updated from the template.
 */
export const USER_OWNED_FRONTMATTER_KEYS = ['model', 'temperature'] as const;
```

#### `mergeFrontmatter(templateContent, diskContent)`

```typescript
/**
 * Merge a template file's content with an on-disk file's user-owned
 * frontmatter keys.
 *
 * Takes the template as the base (body + framework frontmatter), then
 * overlays any user-owned keys that are present in the on-disk version.
 * If the on-disk file has no frontmatter, or if the template has no
 * frontmatter, returns the template content unchanged.
 *
 * Example: if the template has `model: anthropic/claude-sonnet-4-5` and the
 * user's file has `model: openai/gpt-4o`, the merged result uses the
 * template body and framework keys but retains `model: openai/gpt-4o`.
 *
 * @param templateContent - Raw content of the template file.
 * @param diskContent - Raw content of the on-disk file.
 * @returns Merged content string.
 */
export function mergeFrontmatter(templateContent: string, diskContent: string): string;
```

#### `hasFrontmatter(content)`

```typescript
/**
 * Return true if the given file content begins with a YAML frontmatter block
 * (i.e. starts with `---\n`).
 *
 * @param content - Raw file content to inspect.
 */
export function hasFrontmatter(content: string): boolean;
```

### `src/scaffold/index.ts` — update `scaffoldProject` JSDoc

```typescript
/**
 * Scaffold a project with bdd-workflow structure.
 * After writing all files, writes a manifest of SHA-256 hashes for all
 * framework-layer files to `.opencode/.bdd-workflow-manifest.json`.
 *
 * @param targetDir - Target directory to scaffold into
 * @param opts - Scaffolding options
 */
```

### `src/scaffold/update.ts` — update `updateScaffold` JSDoc

```typescript
/**
 * Update framework-owned scaffold files in an existing project.
 *
 * Reads the write manifest from `.opencode/.bdd-workflow-manifest.json` to
 * perform a three-way diff for each framework-layer file:
 *
 * - Absent on disk → ADDED: write template content, record hash in manifest.
 * - On disk matches current template → IDENTICAL: no-op.
 * - On disk differs from template, disk hash matches manifest hash (user did
 *   not modify it):
 *   - File has frontmatter → MERGED: apply `mergeFrontmatter` to preserve
 *     user-owned keys (`model`, `temperature`) while updating body and
 *     framework frontmatter from template. Record hash of merged content.
 *   - File has no frontmatter → UPDATED: write template content directly.
 *     Record hash in manifest.
 * - On disk differs from template, disk hash differs from manifest hash (user
 *   modified it):
 *   - File has frontmatter and only user-owned keys differ → MERGED: same
 *     frontmatter merge as above; body and framework keys are refreshed.
 *   - Otherwise → MODIFIED_BY_USER: skip unless `--force`.
 * - No manifest entry (project predates manifest feature) → same as
 *   MODIFIED_BY_USER: conservatively skip unless `--force`.
 *
 * After processing all files, writes the updated manifest.
 *
 * @param targetDir - Absolute path to the project root to update.
 * @param opts - Update options.
 * @returns A structured `UpdateResult` describing what changed.
 */
```

#### New `UpdateResult` field: `merged`

```typescript
/**
 * Structured result of an `updateScaffold` run.
 */
export interface UpdateResult {
  /** Files written because they were absent. */
  added: string[];
  /** Files whose on-disk content already matches the template. */
  identical: string[];
  /** Files updated because the package changed and user did not modify them. */
  updated: string[];
  /** Files where only user-owned frontmatter keys differed; body+framework
   *  frontmatter refreshed, user keys preserved. */
  merged: string[];
  /** Files that appear to have been customized by the user (body or framework
   *  frontmatter changed) and were skipped. */
  modifiedByUser: string[];
}
```

### `features/update.feature` — two new scenarios, update Scenario 1

Scenario 1 reverts to no-`--force`. Two new scenarios cover the frontmatter merge cases.

---

## 3. BDD Specs (the WHAT layer)

### Modified file: `features/update.feature`

```gherkin
Feature: bdd-workflow update command

  As a developer using bdd-workflow in an existing project,
  I want to run `npx bdd-workflow update` to get the latest framework files,
  So that my agents, commands, skills, and templates stay current without losing my customizations.

  Background:
    Given a project directory initialized with bdd-workflow

  Scenario: Update refreshes an outdated framework file that the user has not modified
    Given the file ".opencode/skills/bdd-workflow/SKILL.md" on disk is outdated but unmodified
    When I run "bdd-workflow update"
    Then the file ".opencode/skills/bdd-workflow/SKILL.md" matches the current template
    And the output reports "1 updated"

  Scenario: Update skips a file that already matches the template
    Given the file ".opencode/commands/propose.md" on disk matches the current template
    When I run "bdd-workflow update"
    Then the file ".opencode/commands/propose.md" is unchanged
    And the output reports "1 identical"

  Scenario: Update adds a new framework file that did not exist
    Given the file ".opencode/agents/review.md" does not exist on disk
    When I run "bdd-workflow update"
    Then the file ".opencode/agents/review.md" exists on disk
    And the output reports "1 added"

  Scenario: Update merges a file where the user has only changed the model
    Given the file ".opencode/commands/apply.md" has a user-customized model
    When I run "bdd-workflow update"
    Then the file ".opencode/commands/apply.md" body matches the current template body
    And the file ".opencode/commands/apply.md" retains the user-customized model
    And the output reports "1 merged"

  Scenario: Update merges an outdated file preserving the user's model choice
    Given the file ".opencode/commands/apply.md" on disk is outdated but unmodified except for model
    When I run "bdd-workflow update"
    Then the file ".opencode/commands/apply.md" body matches the current template body
    And the file ".opencode/commands/apply.md" retains the user-customized model
    And the output reports "1 merged"

  Scenario: Update skips a user-modified framework file without --force
    Given the file ".opencode/commands/apply.md" has been modified by the user
    When I run "bdd-workflow update"
    Then the file ".opencode/commands/apply.md" is unchanged
    And the output reports "1 modified by user (skipped)"
    And the output includes a hint to use "--force" to overwrite

  Scenario: Update overwrites a user-modified file when --force is given
    Given the file ".opencode/commands/apply.md" has been modified by the user
    When I run "bdd-workflow update --force"
    Then the file ".opencode/commands/apply.md" matches the current template
    And the output reports "1 updated"

  Scenario: Update fails when run outside an initialized project
    Given a directory that has not been initialized with bdd-workflow
    When I run "bdd-workflow update"
    Then the command exits with a non-zero status
    And the output includes "not an initialized bdd-workflow project"
```

### Modified file: `features/support/steps/update.steps.ts`

New and modified step definitions required:

**New Given: "outdated but unmodified"** — writes old content to disk and records its hash in
the manifest, simulating a package that wrote old content and was then updated upstream.

**New Given: "has a user-customized model"** — changes only the `model:` frontmatter key in the
on-disk file, leaving the body and all other keys matching the template.

**New Given: "outdated but unmodified except for model"** — combines both: writes old body
content, records its hash, AND changes the `model:` key. The update must both refresh the body
and preserve the model.

**New Then: "body matches the current template body"** — asserts that the body portion of the
on-disk file (everything after the frontmatter) matches the template body.

**New Then: "retains the user-customized model"** — asserts that the `model:` value in the
on-disk frontmatter matches the value the test set, not the template value.

**Output assertion update** — add `"1 merged"` as a valid substring for `the output reports`.
The summary line in `printUpdateSummary` must emit `"N merged"` as one of its parts.

---

## 4. Implementation Plan (the HOW layer)

### Files to create

| File | Purpose |
|------|---------|
| `src/scaffold/manifest.ts` | Manifest read/write/hash utilities |
| `src/scaffold/frontmatter.ts` | Frontmatter parse/merge/serialize utilities |

### Files to modify

| File | Change |
|------|--------|
| `src/scaffold/index.ts` | After writing framework-layer files in `scaffoldProject`, compute and write a manifest |
| `src/scaffold/update.ts` | Read manifest, use three-way diff + frontmatter merge logic, write updated manifest; add `merged` to `UpdateResult`; update `printUpdateSummary` |
| `features/update.feature` | Restore Scenario 1; add two merge scenarios |
| `features/support/steps/update.steps.ts` | Add new Given/Then step definitions for manifest and frontmatter scenarios |

### Approach

**1. `src/scaffold/manifest.ts`**

```
MANIFEST_PATH = '.opencode/.bdd-workflow-manifest.json'

readManifest(targetDir):
  path = join(targetDir, MANIFEST_PATH)
  if (!existsSync(path)) return {}
  return JSON.parse(readFileSync(path, 'utf-8'))

writeManifest(targetDir, manifest):
  path = join(targetDir, MANIFEST_PATH)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')

hashContent(content):
  return createHash('sha256').update(content, 'utf-8').digest('hex')
```

Uses Node's built-in `node:crypto` — no new dependencies.

**2. `src/scaffold/frontmatter.ts`**

Uses the already-present `gray-matter` dependency.

```
USER_OWNED_FRONTMATTER_KEYS = ['model', 'temperature']

hasFrontmatter(content):
  return content.startsWith('---\n') || content.startsWith('---\r\n')

mergeFrontmatter(templateContent, diskContent):
  if !hasFrontmatter(templateContent) || !hasFrontmatter(diskContent):
    return templateContent  // no merge possible; caller decides

  templateParsed = matter(templateContent)
  diskParsed = matter(diskContent)

  // Start with all template frontmatter keys
  mergedData = { ...templateParsed.data }

  // Overlay user-owned keys from disk (if present in disk)
  for key of USER_OWNED_FRONTMATTER_KEYS:
    if key in diskParsed.data:
      mergedData[key] = diskParsed.data[key]

  // Reconstruct: template body + merged frontmatter
  // gray-matter stringify: matter.stringify(body, data)
  return matter.stringify(templateParsed.content, mergedData)
```

Note on key ordering: `gray-matter` does not guarantee frontmatter key order.
For a stable result, apply a custom stringify that preserves the template's key
order and appends user-owned keys at the end if they were absent in the template.
This avoids spurious diffs in git. Implementation detail: iterate template keys
first, then any user-owned keys not in the template.

**3. `src/scaffold/index.ts` — write manifest after init**

After the main file-writing loop in `scaffoldProject`, accumulate framework-layer
files and write a manifest:

```typescript
// After the loop: record hashes for framework-layer files
const manifest: Manifest = {};
for (const relPath of frameworkLayerFiles) {
  const diskPath = join(targetDir, relPath);
  if (existsSync(diskPath)) {
    manifest[relPath] = hashContent(readFileSync(diskPath, 'utf-8'));
  }
}
writeManifest(targetDir, manifest);
```

`frameworkLayerFiles` = files written that match `FRAMEWORK_LAYER_GLOBS`.
Accumulate during the existing loop to avoid a second glob pass.

**4. `src/scaffold/update.ts` — three-way diff + frontmatter merge**

Decision tree for each framework file:

```
templateContent = readFile(templatePath)
diskExists = existsSync(diskPath)

if !diskExists:
  → ADDED: write templateContent, manifest[rel] = hash(templateContent)

else:
  diskContent = readFile(diskPath)

  if diskContent == templateContent:
    → IDENTICAL: no-op

  else:
    diskHash = hash(diskContent)
    manifestHash = manifest[rel]   // undefined if pre-manifest project

    userDidNotModify = (manifestHash !== undefined && diskHash === manifestHash)

    if hasFrontmatter(templateContent):
      merged = mergeFrontmatter(templateContent, diskContent)
      // merged has template body + template framework keys + user's model/temperature

      onlyUserKeysChanged = (merged === templateContent)
        // i.e. after merging, result equals template → user only changed model/temp

      if userDidNotModify || onlyUserKeysChanged:
        → MERGED: write merged, manifest[rel] = hash(merged)

      elif opts.force:
        → UPDATED: write templateContent (complete overwrite), manifest[rel] = hash(templateContent)

      else:
        → MODIFIED_BY_USER: skip

    else:
      // No frontmatter: standard three-way diff
      if userDidNotModify:
        → UPDATED: write templateContent, manifest[rel] = hash(templateContent)
      elif opts.force:
        → UPDATED: write templateContent, manifest[rel] = hash(templateContent)
      else:
        → MODIFIED_BY_USER: skip

writeManifest(targetDir, manifest)
```

Key insight on the merge classification:
- `onlyUserKeysChanged`: the disk file differs from the template only in `model`/`temperature`.
  Whether or not the manifest agrees, this is safe to merge — we know exactly what changed and
  what to preserve. The user gets the updated body without losing their model choice.
- `userDidNotModify && hasFrontmatter`: same merge path — the user never touched it, so merge
  is safe even if the body changed upstream.
- Body or framework-frontmatter modified + no manifest → `MODIFIED_BY_USER` (safe default).

**5. `printUpdateSummary` update**

Add `merged` to the summary line:

```
  1 updated  1 merged  1 added  4 identical  0 modified by user (skipped)
```

The step assertion `the output reports "1 merged"` will match as a substring.

**6. Step definitions for new Given/Then steps**

```typescript
// "has a user-customized model"
// Changes only model: in frontmatter on disk. Does NOT touch body or other keys.
// Does NOT record anything in manifest (simulating normal init then user edit).
Given('the file {string} has a user-customized model', function(filePath) {
  const diskContent = readFileSync(diskPath, 'utf-8');
  const parsed = matter(diskContent);
  parsed.data.model = 'openai/gpt-4o';  // a value different from template default
  writeFileSync(diskPath, matter.stringify(parsed.content, parsed.data), 'utf-8');
  // Store the custom model value in world for assertion
  this.customModel = 'openai/gpt-4o';
});

// "outdated but unmodified except for model"
// Writes old body content + custom model, records hash(old body + custom model) in manifest.
// So manifest says "we wrote this", but disk differs from template in both body AND model.
// Update must: detect outdated (manifest match) OR only-user-keys-differ → merge.
Given('the file {string} on disk is outdated but unmodified except for model', function(filePath) {
  const diskContent = readFileSync(diskPath, 'utf-8');
  const parsed = matter(diskContent);
  parsed.data.model = 'openai/gpt-4o';
  const oldContent = matter.stringify(parsed.content + '\n<!-- outdated -->', parsed.data);
  writeFileSync(diskPath, oldContent, 'utf-8');
  const manifest = readManifest(this.tempDir);
  manifest[filePath] = hashContent(oldContent);
  writeManifest(this.tempDir, manifest);
  this.customModel = 'openai/gpt-4o';
});

// "body matches the current template body"
Then('the file {string} body matches the current template body', function(filePath) {
  const templateContent = readFileSync(join(templatesDir, filePath), 'utf-8');
  const diskContent = readFileSync(diskPath, 'utf-8');
  assert.equal(matter(diskContent).content, matter(templateContent).content);
});

// "retains the user-customized model"
Then('the file {string} retains the user-customized model', function(filePath) {
  const diskContent = readFileSync(diskPath, 'utf-8');
  const parsed = matter(diskContent);
  assert.equal(parsed.data.model, this.customModel);
});
```

The `BddWorkflowWorld` interface must gain a `customModel?: string` field.

---

## 5. Risks and Considerations

### Projects initialized before this change have no manifest
`readManifest` returns `{}`. In `updateScaffold`, `manifest[relPath]` is `undefined` for all
files. For files with frontmatter, the `onlyUserKeysChanged` check still fires independently of
the manifest — so a user who only changed `model:` will still get a merge. For files without
frontmatter, all files fall into `MODIFIED_BY_USER` (safe default, same as current behavior).
Users can `--force` once to refresh everything and write a clean manifest.

### `gray-matter` key ordering
`gray-matter` serializes frontmatter keys in insertion order. To avoid unnecessary git noise,
`mergeFrontmatter` should insert keys in the same order as the template, then append any
user-owned keys that weren't in the template. This produces stable output across updates.

### `--force` completely overwrites (including model)
With `--force`, the template content is written verbatim — the user's `model:` is lost.
This is intentional and documented. `--force` means "I want the exact template, no merging."
The output should note that `--force` overwrites user-owned frontmatter keys.

### Hash stored is hash of what was written (post-merge for merged files)
The manifest records `hash(merged)` after a merge, not `hash(template)`. This is correct:
the manifest should reflect what's actually on disk. On the next update, the disk hash will
still match the manifest hash (user didn't change anything after the merge), so the file
will be classified as IDENTICAL (if template hasn't changed) or MERGED again (if it has).

### Manifest file should not appear in `FRAMEWORK_LAYER_GLOBS`
The manifest at `.opencode/.bdd-workflow-manifest.json` must not be treated as a framework
file subject to update. It is never in `FRAMEWORK_LAYER_GLOBS` and is managed exclusively
by `manifest.ts`. This is naturally satisfied by the existing glob patterns.

### `init --force` rewrites the manifest
`scaffoldProject` always writes the manifest after scaffolding. `--force` on init means all
files are overwritten; the manifest is then rewritten to reflect the newly written content.
This is correct.

### Crash safety
If `update` crashes mid-run, the manifest is stale. On the next run, already-updated files
will be IDENTICAL (disk == template) and will not be double-written. The manifest is corrected
at the end of the next successful run. No data loss.

