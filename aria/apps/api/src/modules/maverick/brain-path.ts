import fs from 'fs';
import path from 'path';

function isDirectory(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

export function resolveMaverickBrainPath(currentDir: string): string {
  const fromEnv = process.env.MAVERICK_BRAIN_PATH;

  const candidates = [
    fromEnv,
    // Preferred for production: bundled with API source (inside Docker image).
    path.resolve(currentDir, 'brain'),
    // Local development fallback: original source of truth.
    path.resolve(currentDir, '../../../../../../squads/maverick/data/knowledge/brain'),
    // Extra fallback for different run contexts.
    path.resolve(process.cwd(), 'src/modules/maverick/brain'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (isDirectory(candidate)) return candidate;
  }

  throw new Error(
    `MAVERICK brain path nao encontrado. Verifique MAVERICK_BRAIN_PATH ou o diretorio src/modules/maverick/brain. Tentativas: ${candidates.join(' | ')}`
  );
}

