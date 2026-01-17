# add-skill

> **Fork Notice:** This is a fork of [vercel-labs/add-skill](https://github.com/vercel-labs/add-skill/).
>
> **Install this fork:**
> ```bash
> bunx @zot24/add-skill vercel-labs/agent-skills
> ```
>
> **Why this fork exists:** The original repository lacks skill management features for batch installation. This fork adds the `--from-file` option to install skills from a TOML manifest file, enabling easier skill synchronization across teams and projects.

Install agent skills onto your coding agents from any git repository.

Supports [OpenCode](https://opencode.ai), [Claude Code](https://claude.ai/code), [Codex](https://developers.openai.com/codex), [Cursor](https://cursor.com), and [Antigravity](https://antigravity.google).

## Quick Start

```bash
npx add-skill vercel-labs/agent-skills
```

## What are Agent Skills?

Agent skills are reusable instruction sets that extend your coding agent's capabilities. They're defined in `SKILL.md` files with YAML frontmatter containing a `name` and `description`.

Skills let agents perform specialized tasks like:
- Generating release notes from git history
- Creating PRs following your team's conventions
- Integrating with external tools (Linear, Notion, etc.)

## Usage

### Source Formats

The `<source>` argument accepts multiple formats:

```bash
# GitHub shorthand
npx add-skill vercel-labs/agent-skills

# Full GitHub URL
npx add-skill https://github.com/vercel-labs/agent-skills

# Direct path to a skill in a repo
npx add-skill https://github.com/vercel-labs/agent-skills/tree/main/skills/frontend-design

# GitLab URL
npx add-skill https://gitlab.com/org/repo

# Any git URL
npx add-skill git@github.com:vercel-labs/agent-skills.git
```

### Options

| Option | Description |
|--------|-------------|
| `-g, --global` | Install to user directory instead of project |
| `-a, --agent <agents...>` | Target specific agents: `opencode`, `claude-code`, `codex`, `cursor`, `antigravity` |
| `-s, --skill <skills...>` | Install specific skills by name |
| `-f, --from-file <path>` | Install skills from a manifest file |
| `--no-lock` | Skip generating lock file when using `--from-file` |
| `-l, --list` | List available skills without installing |
| `-y, --yes` | Skip all confirmation prompts |
| `-V, --version` | Show version number |
| `-h, --help` | Show help |

### Examples

```bash
# List skills in a repository
npx add-skill vercel-labs/agent-skills --list

# Install multiple specific skills
npx add-skill vercel-labs/agent-skills --skill frontend-design --skill skill-creator

# Install to specific agents
npx add-skill vercel-labs/agent-skills -a claude-code -a opencode

# Non-interactive installation (CI/CD friendly)
npx add-skill vercel-labs/agent-skills --skill frontend-design -g -a claude-code -y

# Install all skills from a repo
npx add-skill vercel-labs/agent-skills -y -g

# Install skills from a manifest file
npx add-skill --from-file skills.toml

# Manifest with options
npx add-skill -f skills.toml -g -a claude-code -y
```

## Installation Paths

Skills are installed to different locations depending on the agent and scope:

### Project-level (default)

Installed in your current working directory. Commit these to share with your team.

| Agent | Path |
|-------|------|
| OpenCode | `.opencode/skill/<name>/` |
| Claude Code | `.claude/skills/<name>/` |
| Codex | `.codex/skills/<name>/` |
| Cursor | `.cursor/skills/<name>/` |
| Antigravity | `.agent/skills/<name>/` |

### Global (`--global`)

Installed in your home directory. Available across all projects.

| Agent | Path |
|-------|------|
| OpenCode | `~/.config/opencode/skill/<name>/` |
| Claude Code | `~/.claude/skills/<name>/` |
| Codex | `~/.codex/skills/<name>/` |
| Cursor | `~/.cursor/skills/<name>/` |
| Antigravity | `~/.gemini/antigravity/skills/<name>/` |

## Agent Detection

The CLI automatically detects which coding agents you have installed by checking for their configuration directories. If none are detected, you'll be prompted to select which agents to install to.

## Manifest Files (Fork Feature)

The `--from-file` option allows you to install multiple skills from a TOML manifest file. This is useful for:
- Sharing a consistent skill set across a team
- Automating skill setup in CI/CD pipelines
- Installing skills from multiple repositories

### Manifest Format

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

### Lock File

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

## Creating Skills

Skills are directories containing a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: my-skill
description: What this skill does and when to use it
version: 1.0.0
---

# My Skill

Instructions for the agent to follow when this skill is activated.

## When to Use

Describe the scenarios where this skill should be used.

## Steps

1. First, do this
2. Then, do that
```

### Required Fields

- `name`: Unique identifier (lowercase, hyphens allowed)
- `description`: Brief explanation of what the skill does

### Optional Fields

- `version`: Semantic version for the skill (e.g., `1.0.0`). Used for version validation when installing from a manifest.

### Skill Discovery

The CLI searches for skills in these locations within a repository:

- Root directory (if it contains `SKILL.md`)
- `skills/`
- `skills/.curated/`
- `skills/.experimental/`
- `skills/.system/`
- `.codex/skills/`
- `.claude/skills/`
- `.opencode/skill/`
- `.cursor/skills/`
- `.agent/skills/`

If no skills are found in standard locations, a recursive search is performed.

## Compatibility

Skills are generally compatible across agents since they follow a shared [Agent Skills specification](https://agentskills.io). However, some features may be agent-specific:

| Feature | OpenCode | Claude Code | Codex | Cursor | Antigravity |
|---------|----------|-------------|-------|--------|-------------|
| Basic skills | Yes | Yes | Yes | Yes | Yes |
| `allowed-tools` | Yes | Yes | Yes | Yes | Yes |
| `context: fork` | No | Yes | No | No | No |
| Hooks | No | Yes | No | No | No |

## Troubleshooting

### "No skills found"

Ensure the repository contains valid `SKILL.md` files with both `name` and `description` in the frontmatter.

### Skill not loading in agent

- Verify the skill was installed to the correct path
- Check the agent's documentation for skill loading requirements
- Ensure the `SKILL.md` frontmatter is valid YAML

### Permission errors

Ensure you have write access to the target directory.

## Related Links

- [Vercel Agent Skills Repository](https://github.com/vercel-labs/agent-skills)
- [Agent Skills Specification](https://agentskills.io)
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Codex Skills Documentation](https://developers.openai.com/codex/skills)
- [Cursor Skills Documentation](https://cursor.com/docs/context/skills)
- [Antigravity Skills Documentation](https://antigravity.google/docs/skills)

## License

MIT
