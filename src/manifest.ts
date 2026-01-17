import { readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { parse, stringify } from 'smol-toml';
import type { ManifestSkillEntry, SkillManifest, LockFileEntry, SkillLockFile } from './types.js';

export class ManifestParseError extends Error {
  constructor(message: string, public filePath: string) {
    super(message);
    this.name = 'ManifestParseError';
  }
}

export class VersionNotFoundError extends Error {
  constructor(
    public source: string,
    public version: string,
    public availableVersions: string[]
  ) {
    super(`Version ${version} not found for ${source}. Available: ${availableVersions.join(', ') || 'none'}`);
    this.name = 'VersionNotFoundError';
  }
}

export class SkillNotFoundError extends Error {
  constructor(
    public skillName: string,
    public source: string,
    public availableSkills: string[]
  ) {
    super(`Skill "${skillName}" not found in ${source}. Available: ${availableSkills.join(', ') || 'none'}`);
    this.name = 'SkillNotFoundError';
  }
}

interface TomlSkillEntry {
  source: string;
  name: string;
  version?: string;
}

interface TomlManifest {
  skills?: TomlSkillEntry[];
}

interface TomlLockEntry {
  source: string;
  name: string;
  version: string;
  resolvedRef: string;
  installedAt: string;
}

interface TomlLockFile {
  lockVersion?: number;
  skills?: TomlLockEntry[];
}

export async function parseManifestFile(filePath: string): Promise<SkillManifest> {
  let content: string;

  try {
    content = await readFile(filePath, 'utf-8');
  } catch (error) {
    throw new ManifestParseError(
      `Could not read manifest file: ${(error as Error).message}`,
      filePath
    );
  }

  let parsed: TomlManifest;
  try {
    parsed = parse(content) as TomlManifest;
  } catch (error) {
    throw new ManifestParseError(
      `Invalid TOML: ${(error as Error).message}`,
      filePath
    );
  }

  if (!parsed.skills || !Array.isArray(parsed.skills)) {
    throw new ManifestParseError(
      'Manifest must contain a [[skills]] array',
      filePath
    );
  }

  const skills: ManifestSkillEntry[] = [];

  for (let i = 0; i < parsed.skills.length; i++) {
    const entry = parsed.skills[i];

    if (!entry || typeof entry !== 'object') {
      throw new ManifestParseError(
        `Invalid skill entry at index ${i}`,
        filePath
      );
    }

    if (!entry.source || typeof entry.source !== 'string') {
      throw new ManifestParseError(
        `Skill entry ${i} missing required "source" field`,
        filePath
      );
    }

    if (!entry.name || typeof entry.name !== 'string') {
      throw new ManifestParseError(
        `Skill entry ${i} missing required "name" field`,
        filePath
      );
    }

    const manifestEntry: ManifestSkillEntry = {
      source: entry.source,
      name: entry.name,
    };

    if (entry.version && typeof entry.version === 'string') {
      manifestEntry.version = entry.version;
    }

    validateManifestEntry(manifestEntry);
    skills.push(manifestEntry);
  }

  if (skills.length === 0) {
    throw new ManifestParseError(
      'Manifest file contains no skill entries',
      filePath
    );
  }

  return { skills };
}

export function validateManifestEntry(entry: ManifestSkillEntry): void {
  // Validate source format (owner/repo or URL)
  const isShorthand = /^[^/]+\/[^/]+$/.test(entry.source);
  const isUrl = entry.source.includes('://') || entry.source.startsWith('git@');

  if (!isShorthand && !isUrl) {
    throw new Error(
      `Invalid source "${entry.source}". Use "owner/repo" or a full git URL.`
    );
  }

  // Validate version format if present (basic semver check or 'latest')
  if (entry.version && entry.version !== 'latest') {
    const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
    if (!semverRegex.test(entry.version)) {
      throw new Error(
        `Invalid version "${entry.version}" for skill "${entry.name}". Use semantic versioning (e.g., 1.0.0) or "latest".`
      );
    }
  }
}

export function getLockFilePath(manifestPath: string): string {
  const dir = dirname(manifestPath);
  // Replace .toml extension with -lock.toml
  const baseName = manifestPath.replace(/\.toml$/, '');
  return `${baseName}-lock.toml`;
}

export async function readLockFile(lockPath: string): Promise<SkillLockFile | null> {
  try {
    const content = await readFile(lockPath, 'utf-8');
    const parsed = parse(content) as TomlLockFile;

    if (!parsed.lockVersion || typeof parsed.lockVersion !== 'number') {
      return null;
    }

    if (!parsed.skills || !Array.isArray(parsed.skills)) {
      return { lockVersion: parsed.lockVersion, skills: [] };
    }

    const skills: LockFileEntry[] = parsed.skills.map(entry => ({
      source: entry.source,
      name: entry.name,
      version: entry.version,
      resolvedRef: entry.resolvedRef,
      installedAt: entry.installedAt,
    }));

    return { lockVersion: parsed.lockVersion, skills };
  } catch {
    return null;
  }
}

export async function writeLockFile(
  lockPath: string,
  entries: LockFileEntry[]
): Promise<void> {
  const lockFile: TomlLockFile = {
    lockVersion: 1,
    skills: entries.map(entry => ({
      source: entry.source,
      name: entry.name,
      version: entry.version,
      resolvedRef: entry.resolvedRef,
      installedAt: entry.installedAt,
    })),
  };

  const tomlContent = stringify(lockFile);
  await writeFile(lockPath, tomlContent, 'utf-8');
}

// Group manifest entries by source for efficient cloning
export function groupSkillsBySource(
  skills: ManifestSkillEntry[]
): Map<string, ManifestSkillEntry[]> {
  const grouped = new Map<string, ManifestSkillEntry[]>();

  for (const skill of skills) {
    // Create a unique key combining source and version
    // Skills from the same source with the same version can share a clone
    const key = skill.version ? `${skill.source}@${skill.version}` : skill.source;

    const existing = grouped.get(key) || [];
    existing.push(skill);
    grouped.set(key, existing);
  }

  return grouped;
}

// Group manifest entries by source and resolved ref (for frozen mode)
// Uses the lock file to determine the exact ref for each skill
export function groupSkillsBySourceAndRef(
  skills: ManifestSkillEntry[],
  lockEntries: LockFileEntry[]
): Map<string, ManifestSkillEntry[]> {
  const grouped = new Map<string, ManifestSkillEntry[]>();

  for (const skill of skills) {
    // Find the lock entry to get the resolved ref
    const lockEntry = lockEntries.find(
      l => l.source === skill.source && l.name.toLowerCase() === skill.name.toLowerCase()
    );

    // Key by source and resolved ref (or source alone if not found)
    const key = lockEntry
      ? `${skill.source}@${lockEntry.resolvedRef}`
      : skill.source;

    const existing = grouped.get(key) || [];
    existing.push(skill);
    grouped.set(key, existing);
  }

  return grouped;
}
