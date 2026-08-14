import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

const AVATAR_STORAGE_DIR = path.join(process.cwd(), "data", "avatars")

function isReadonlyFilesystemError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false

  const code = (error as NodeJS.ErrnoException).code
  return code === "EROFS" || code === "EPERM" || code === "EACCES" || code === "ENOENT"
}

export async function saveLocalAvatar(fileName: string, content: Buffer): Promise<boolean> {
  try {
    await mkdir(AVATAR_STORAGE_DIR, { recursive: true })
    await writeFile(path.join(AVATAR_STORAGE_DIR, fileName), content)
    return true
  } catch (error) {
    if (isReadonlyFilesystemError(error)) return false
    throw error
  }
}

export async function readLocalAvatar(fileName: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(AVATAR_STORAGE_DIR, fileName))
  } catch {
    return null
  }
}

export async function deleteLocalAvatar(fileName: string): Promise<void> {
  try {
    await unlink(path.join(AVATAR_STORAGE_DIR, fileName))
  } catch {
    // Ignora limpeza ausente ou indisponivel.
  }
}