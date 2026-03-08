import * as fs from "node:fs/promises";
import * as path from "node:path";

export const OUTPUT_DIR = path.join(process.cwd(), "output");

interface PptxFileInfo {
  name: string;
  absolutePath: string;
  modifiedMs: number;
}

async function readPptxFiles(): Promise<PptxFileInfo[]> {
  const entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pptx"))
      .map(async (entry) => {
        const absolutePath = path.join(OUTPUT_DIR, entry.name);
        const stats = await fs.stat(absolutePath);
        return {
          name: entry.name,
          absolutePath,
          modifiedMs: stats.mtimeMs,
        } satisfies PptxFileInfo;
      }),
  );

  return files.sort((left, right) => right.modifiedMs - left.modifiedMs);
}

export async function snapshotPptxNames(): Promise<Set<string>> {
  try {
    return new Set((await readPptxFiles()).map((file) => file.name));
  } catch {
    return new Set();
  }
}

export async function findGeneratedPptx(options: {
  previousNames: Set<string>;
  startedAtMs: number;
}): Promise<PptxFileInfo | null> {
  const files = await readPptxFiles();

  const createdAfterStart = files.find(
    (file) => !options.previousNames.has(file.name) && file.modifiedMs >= options.startedAtMs - 2_000,
  );
  if (createdAfterStart) {
    return createdAfterStart;
  }

  const updatedAfterStart = files.find((file) => file.modifiedMs >= options.startedAtMs - 2_000);
  return updatedAfterStart ?? null;
}

export function resolveDownloadPath(fileName: string): string {
  const safeName = path.basename(fileName);
  if (!safeName.toLowerCase().endsWith(".pptx")) {
    throw new Error("Only .pptx files can be downloaded.");
  }

  const absolutePath = path.join(OUTPUT_DIR, safeName);
  const normalizedOutputDir = path.resolve(OUTPUT_DIR);
  const normalizedFilePath = path.resolve(absolutePath);

  if (!normalizedFilePath.startsWith(normalizedOutputDir + path.sep) && normalizedFilePath !== normalizedOutputDir) {
    throw new Error("Invalid file path.");
  }

  return normalizedFilePath;
}