import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STANDARD_FILES = [
  'instruction-conflict-resolution.md',
  'ai-collaboration-policy.md',
];

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function syncCommonStandards(repoRoot = defaultRoot) {
  const standardsDir = path.join(repoRoot, 'standards');
  const skillsDir = path.join(repoRoot, 'skills');
  const sources = new Map();

  for (const file of STANDARD_FILES) {
    sources.set(file, await readFile(path.join(standardsDir, file)));
  }

  const entries = await readdir(skillsDir, { withFileTypes: true });
  const skillDirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(skillsDir, entry.name);
    try {
      await readFile(path.join(skillDir, 'SKILL.md'));
      skillDirs.push(skillDir);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  if (skillDirs.length === 0) {
    throw new Error(`No Skill directories containing SKILL.md found under ${skillsDir}`);
  }

  const changedFiles = [];
  for (const skillDir of skillDirs) {
    const referencesDir = path.join(skillDir, 'references');
    await mkdir(referencesDir, { recursive: true });

    for (const [file, contents] of sources) {
      const destination = path.join(referencesDir, file);
      let current;
      try {
        current = await readFile(destination);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (current?.equals(contents)) continue;
      await writeFile(destination, contents);
      changedFiles.push(path.relative(repoRoot, destination).replaceAll(path.sep, '/'));
    }
  }

  return { skillCount: skillDirs.length, changedFiles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await syncCommonStandards();
    console.log(`Checked ${result.skillCount} Skills; updated ${result.changedFiles.length} files.`);
    for (const file of result.changedFiles) console.log(`Updated ${file}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
