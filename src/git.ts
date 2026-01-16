import simpleGit from 'simple-git';
import { join, normalize, resolve, sep } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import type { ParsedSource } from './types.js';

export function parseSource(input: string): ParsedSource {
  // GitHub URL with path: https://github.com/owner/repo/tree/branch/path/to/skill
  const githubTreeMatch = input.match(
    /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/
  );
  if (githubTreeMatch) {
    const [, owner, repo, , subpath] = githubTreeMatch;
    return {
      type: 'github',
      url: `https://github.com/${owner}/${repo}.git`,
      subpath,
    };
  }

  // GitHub URL: https://github.com/owner/repo
  const githubRepoMatch = input.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (githubRepoMatch) {
    const [, owner, repo] = githubRepoMatch;
    const cleanRepo = repo!.replace(/\.git$/, '');
    return {
      type: 'github',
      url: `https://github.com/${owner}/${cleanRepo}.git`,
    };
  }

  // GitLab URL with path: https://gitlab.com/owner/repo/-/tree/branch/path
  const gitlabTreeMatch = input.match(
    /gitlab\.com\/([^/]+)\/([^/]+)\/-\/tree\/([^/]+)\/(.+)/
  );
  if (gitlabTreeMatch) {
    const [, owner, repo, , subpath] = gitlabTreeMatch;
    return {
      type: 'gitlab',
      url: `https://gitlab.com/${owner}/${repo}.git`,
      subpath,
    };
  }

  // GitLab URL: https://gitlab.com/owner/repo
  const gitlabRepoMatch = input.match(/gitlab\.com\/([^/]+)\/([^/]+)/);
  if (gitlabRepoMatch) {
    const [, owner, repo] = gitlabRepoMatch;
    const cleanRepo = repo!.replace(/\.git$/, '');
    return {
      type: 'gitlab',
      url: `https://gitlab.com/${owner}/${cleanRepo}.git`,
    };
  }

  // GitHub shorthand: owner/repo or owner/repo/path/to/skill
  const shorthandMatch = input.match(/^([^/]+)\/([^/]+)(?:\/(.+))?$/);
  if (shorthandMatch && !input.includes(':')) {
    const [, owner, repo, subpath] = shorthandMatch;
    return {
      type: 'github',
      url: `https://github.com/${owner}/${repo}.git`,
      subpath,
    };
  }

  // Fallback: treat as direct git URL
  return {
    type: 'git',
    url: input,
  };
}

export async function cloneRepo(url: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'add-skill-'));
  const git = simpleGit();
  await git.clone(url, tempDir, ['--depth', '1']);
  return tempDir;
}

export interface CloneResult {
  tempDir: string;
  resolvedRef: string;
}

export async function cloneRepoAtVersion(
  url: string,
  version?: string
): Promise<CloneResult> {
  const tempDir = await mkdtemp(join(tmpdir(), 'add-skill-'));
  const git = simpleGit();

  if (!version) {
    // No version specified, shallow clone default branch
    await git.clone(url, tempDir, ['--depth', '1']);
    const repoGit = simpleGit(tempDir);
    const log = await repoGit.log(['-1', '--format=%H']);
    return {
      tempDir,
      resolvedRef: log.latest?.hash || 'HEAD',
    };
  }

  // Try cloning at specific version tag
  const tagVariants = [`v${version}`, version];

  for (const tag of tagVariants) {
    try {
      await git.clone(url, tempDir, ['--depth', '1', '--branch', tag]);
      // Get the actual commit SHA, not the tag name
      const repoGit = simpleGit(tempDir);
      const log = await repoGit.log(['-1', '--format=%H']);
      return {
        tempDir,
        resolvedRef: log.latest?.hash || 'HEAD',
      };
    } catch {
      // Tag doesn't exist, try next variant
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      await mkdtemp(join(tmpdir(), 'add-skill-')).then(dir => {
        // We need to reuse the same tempDir path, so just continue
      });
    }
  }

  // Fallback: clone default branch
  const fallbackDir = await mkdtemp(join(tmpdir(), 'add-skill-'));
  await git.clone(url, fallbackDir, ['--depth', '1']);
  const repoGit = simpleGit(fallbackDir);
  const log = await repoGit.log(['-1', '--format=%H']);

  return {
    tempDir: fallbackDir,
    resolvedRef: log.latest?.hash || 'HEAD',
  };
}

export async function listRepoTags(url: string): Promise<string[]> {
  const git = simpleGit();
  try {
    const result = await git.listRemote(['--tags', url]);
    const tags: string[] = [];

    for (const line of result.split('\n')) {
      const match = line.match(/refs\/tags\/(.+)$/);
      if (match && !match[1]!.endsWith('^{}')) {
        tags.push(match[1]!);
      }
    }

    return tags;
  } catch {
    return [];
  }
}

export async function cleanupTempDir(dir: string): Promise<void> {
  // Validate that the directory path is within tmpdir to prevent deletion of arbitrary paths
  const normalizedDir = normalize(resolve(dir));
  const normalizedTmpDir = normalize(resolve(tmpdir()));
  
  if (!normalizedDir.startsWith(normalizedTmpDir + sep) && normalizedDir !== normalizedTmpDir) {
    throw new Error('Attempted to clean up directory outside of temp directory');
  }

  await rm(dir, { recursive: true, force: true });
}
