import { mkdir, cp, access, readdir } from 'fs/promises';
import { join, basename, normalize, resolve, sep } from 'path';
import { homedir } from 'os';
import type { Skill, AgentType } from './types.js';
import { agents } from './agents.js';

interface InstallResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * Sanitizes a filename/directory name to prevent path traversal attacks
 * @param name - The name to sanitize
 * @returns Sanitized name safe for use in file paths
 */
function sanitizeName(name: string): string {
  // Remove any path separators and null bytes
  let sanitized = name.replace(/[\/\\:\0]/g, '');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
  
  // Replace any remaining dots at the start (to prevent ..)
  sanitized = sanitized.replace(/^\.+/, '');
  
  // If the name becomes empty after sanitization, use a default
  if (!sanitized || sanitized.length === 0) {
    sanitized = 'unnamed-skill';
  }
  
  // Limit length to prevent issues
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }
  
  return sanitized;
}

/**
 * Validates that a path is within an expected base directory
 * @param basePath - The expected base directory
 * @param targetPath - The path to validate
 * @returns true if targetPath is within basePath
 */
function isPathSafe(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalize(resolve(basePath));
  const normalizedTarget = normalize(resolve(targetPath));
  
  return normalizedTarget.startsWith(normalizedBase + sep) || 
         normalizedTarget === normalizedBase;
}

export async function installSkillForAgent(
  skill: Skill,
  agentType: AgentType,
  options: { global?: boolean; cwd?: string } = {}
): Promise<InstallResult> {
  const agent = agents[agentType];
  
  // Sanitize skill name to prevent directory traversal
  const rawSkillName = skill.name || basename(skill.path);
  const skillName = sanitizeName(rawSkillName);
  
  const targetBase = options.global
    ? agent.globalSkillsDir
    : join(options.cwd || process.cwd(), agent.skillsDir);

  const targetDir = join(targetBase, skillName);
  
  // Validate that the target directory is within the expected base
  if (!isPathSafe(targetBase, targetDir)) {
    return {
      success: false,
      path: targetDir,
      error: 'Invalid skill name: potential path traversal detected',
    };
  }

  try {
    await mkdir(targetDir, { recursive: true });
    await copyDirectory(skill.path, targetDir);

    return { success: true, path: targetDir };
  } catch (error) {
    return {
      success: false,
      path: targetDir,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

const EXCLUDE_FILES = new Set([
  'README.md',
  'metadata.json',
]);

const isExcluded = (name: string): boolean => {
  if (EXCLUDE_FILES.has(name)) return true;
  if (name.startsWith('_')) return true; // Templates, section definitions
  return false;
};

async function copyDirectory(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });

  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (isExcluded(entry.name)) {
      continue;
    }

    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await cp(srcPath, destPath);
    }
  }
}

export async function isSkillInstalled(
  skillName: string,
  agentType: AgentType,
  options: { global?: boolean; cwd?: string } = {}
): Promise<boolean> {
  const agent = agents[agentType];
  
  // Sanitize skill name
  const sanitized = sanitizeName(skillName);
  
  const targetBase = options.global
    ? agent.globalSkillsDir
    : join(options.cwd || process.cwd(), agent.skillsDir);
  
  const skillDir = join(targetBase, sanitized);
  
  // Validate path safety
  if (!isPathSafe(targetBase, skillDir)) {
    return false;
  }

  try {
    await access(skillDir);
    return true;
  } catch {
    return false;
  }
}

export function getInstallPath(
  skillName: string,
  agentType: AgentType,
  options: { global?: boolean; cwd?: string } = {}
): string {
  const agent = agents[agentType];

  // Sanitize skill name
  const sanitized = sanitizeName(skillName);

  const targetBase = options.global
    ? agent.globalSkillsDir
    : join(options.cwd || process.cwd(), agent.skillsDir);

  const installPath = join(targetBase, sanitized);

  // Validate path safety
  if (!isPathSafe(targetBase, installPath)) {
    throw new Error('Invalid skill name: potential path traversal detected');
  }

  return installPath;
}

/**
 * Resolves a location string to an actual file system path for a skill.
 * @param skillName - The skill name
 * @param agentType - The agent type
 * @param options.location - "global", "project", or a relative path
 * @param options.cwd - Current working directory (defaults to process.cwd())
 * @returns The resolved path for the skill
 */
export function resolveLocationPath(
  skillName: string,
  agentType: AgentType,
  options: { location: string; cwd?: string }
): string {
  const agent = agents[agentType];
  const sanitized = sanitizeName(skillName);
  const cwd = options.cwd || process.cwd();

  let targetBase: string;

  if (options.location === 'global') {
    // Global: use agent's global skills directory
    targetBase = agent.globalSkillsDir;
  } else if (options.location === 'project') {
    // Project: use agent's skills directory relative to cwd
    targetBase = join(cwd, agent.skillsDir);
  } else {
    // Custom path: use the relative path within cwd
    targetBase = join(cwd, options.location, agent.skillsDir);
  }

  const installPath = join(targetBase, sanitized);

  // For custom paths, validate that the final path is within cwd (except for global)
  if (options.location !== 'global') {
    if (!isPathSafe(cwd, installPath)) {
      throw new Error(`Invalid location: path escapes current working directory`);
    }
  }

  // Validate path safety within target base
  if (!isPathSafe(targetBase, installPath)) {
    throw new Error('Invalid skill name: potential path traversal detected');
  }

  return installPath;
}

/**
 * Gets the install path for a specific location.
 * @param skillName - The skill name
 * @param agentType - The agent type
 * @param options.location - "global", "project", or a relative path
 * @param options.cwd - Current working directory
 */
export function getInstallPathForLocation(
  skillName: string,
  agentType: AgentType,
  options: { location: string; cwd?: string }
): string {
  return resolveLocationPath(skillName, agentType, options);
}

/**
 * Checks if a skill is installed at a specific location.
 * @param skillName - The skill name
 * @param agentType - The agent type
 * @param options.location - "global", "project", or a relative path
 * @param options.cwd - Current working directory
 */
export async function isSkillInstalledAtLocation(
  skillName: string,
  agentType: AgentType,
  options: { location: string; cwd?: string }
): Promise<boolean> {
  try {
    const installPath = resolveLocationPath(skillName, agentType, options);
    await access(installPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Installs a skill to a specific location.
 * @param skill - The skill to install
 * @param agentType - The agent type
 * @param options.location - "global", "project", or a relative path
 * @param options.cwd - Current working directory
 */
export async function installSkillToLocation(
  skill: Skill,
  agentType: AgentType,
  options: { location: string; cwd?: string }
): Promise<InstallResult> {
  const rawSkillName = skill.name || basename(skill.path);
  const skillName = sanitizeName(rawSkillName);

  let targetDir: string;
  try {
    targetDir = resolveLocationPath(skillName, agentType, options);
  } catch (error) {
    return {
      success: false,
      path: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  try {
    await mkdir(targetDir, { recursive: true });
    await copyDirectory(skill.path, targetDir);

    return { success: true, path: targetDir };
  } catch (error) {
    return {
      success: false,
      path: targetDir,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Returns a display label for a location.
 * @param location - "global", "project", or a relative path
 */
export function getLocationLabel(location: string): string {
  if (location === 'global') {
    return '[global]';
  } else if (location === 'project') {
    return '[project]';
  } else {
    return `[${location}]`;
  }
}
