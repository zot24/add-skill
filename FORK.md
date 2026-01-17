# Fork: @zot24/add-skill

This is a fork of [vercel-labs/add-skill](https://github.com/vercel-labs/add-skill/).

## Installation

```bash
bunx @zot24/add-skill vercel-labs/agent-skills
```

## Why This Fork?

The original repository lacks skill management features for batch installation. This fork adds the `--from-file` option to install skills from a TOML manifest file, enabling easier skill synchronization across teams and projects.

## Fork Features

### Manifest Files (`--from-file`)

Install multiple skills from a TOML manifest file. Useful for:
- Sharing a consistent skill set across a team
- Automating skill setup in CI/CD pipelines
- Installing skills from multiple repositories

#### Manifest Format

Create a `skills.toml` file:

```toml
# My project skills

[[skills]]
source = "vercel-labs/agent-skills"
name = "frontend-design"
version = "1.0.0"

[[skills]]
source = "vercel-labs/agent-skills"
name = "code-review"

[[skills]]
source = "other-org/custom-skills"
name = "my-skill"
version = "2.0.0"
```

Each `[[skills]]` entry requires:
- `source`: Repository in `owner/repo` format or full git URL
- `name`: Name of the skill to install

Optional fields:
- `version`: Semantic version (e.g., `1.0.0`) - defaults to latest

#### Usage

```bash
# Install skills from a manifest file
npx add-skill --from-file skills.toml

# Manifest with options
npx add-skill -f skills.toml -g -a claude-code -y
```

#### Lock File

A `-lock.toml` file is generated alongside the manifest (e.g., `skills-lock.toml`), recording:
- Exact commit SHA for reproducibility
- Installation timestamps

```toml
lockVersion = 1

[[skills]]
source = "vercel-labs/agent-skills"
name = "frontend-design"
version = "1.0.0"
resolvedRef = "a1b2c3d4e5f6789abc0123456789def012345678"
installedAt = "2026-01-16T12:00:00.000Z"
```

Use `--no-lock` to skip lock file generation.

### Reproducible Installations (`--frozen`)

Use the `--frozen` flag for reproducible installations that use exact commit SHAs from the lock file:

```bash
# First, generate a lock file with a normal install
npx add-skill --from-file skills.toml

# Then use --frozen for reproducible installations
npx add-skill --from-file skills.toml --frozen
```

**How it works:**
1. **Normal install** (`--from-file skills.toml`):
   - Resolves versions to commit SHAs
   - Clones repositories at those commits
   - Writes the lock file with resolved refs

2. **Frozen install** (`--from-file skills.toml --frozen`):
   - Reads the existing lock file (fails if missing)
   - Clones repositories at exact commit SHAs from lock file
   - Fails if any skill in manifest is not in lock file
   - Does not update the lock file

This is useful for:
- CI/CD pipelines requiring deterministic builds
- Ensuring all team members have identical skill versions
- Reproducing exact environments across machines

### Skill Versioning

Skills can include an optional `version` field in their YAML frontmatter:

```markdown
---
name: my-skill
description: What this skill does
version: 1.0.0
---
```

This enables version validation when installing from a manifest file.
