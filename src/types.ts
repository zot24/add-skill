export type AgentType = 'opencode' | 'claude-code' | 'codex' | 'cursor' | 'amp' | 'kilo' | 'roo' | 'goose' | 'antigravity';

export interface Skill {
  name: string;
  description: string;
  path: string;
  metadata?: Record<string, string>;
  version?: SkillVersion;
}

export interface AgentConfig {
  name: string;
  displayName: string;
  skillsDir: string;
  globalSkillsDir: string;
  detectInstalled: () => Promise<boolean>;
}

export interface ParsedSource {
  type: 'github' | 'gitlab' | 'git';
  url: string;
  subpath?: string;
}

// Version information for a skill
export interface SkillVersion {
  version: string;
  source: 'frontmatter' | 'git-tag' | 'unversioned';
}

// Manifest skill entry (from TOML file)
export interface ManifestSkillEntry {
  source: string;    // Repository: "owner/repo" or full URL
  name: string;      // Skill name to install
  version?: string;  // Optional: requested version
}

// Parsed manifest file
export interface SkillManifest {
  skills: ManifestSkillEntry[];
}

// Lock file entry for reproducibility
export interface LockFileEntry {
  source: string;
  name: string;
  version: string;
  resolvedRef: string;    // Actual git commit/tag used
  installedAt: string;    // ISO timestamp
}

// Lock file structure
export interface SkillLockFile {
  lockVersion: number;
  skills: LockFileEntry[];
}
