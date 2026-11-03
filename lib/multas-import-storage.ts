import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  describeDriveError,
  ensureFolder,
  findFile,
  getDriveClients,
  getDriveRootFolderId,
  readJsonFile,
  upsertBinaryFile,
  upsertJsonFile,
} from "@/lib/google-drive"
import { normalizeMultasImportStore, type MultaFonte, type MultasImportStore } from "@/lib/multas-import-shared"

const MULTAS_DATA_DIR = path.join(process.cwd(), "data", "multas")
const MULTAS_IMPORT_FILE = "multas_importadas.json"
const MULTAS_DRIVE_FOLDER = "multas"

function isReadonlyFilesystemError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false

  const code = (error as NodeJS.ErrnoException).code
  return code === "EROFS" || code === "EPERM" || code === "EACCES" || code === "ENOENT"
}

async function readLocalStore(): Promise<MultasImportStore> {
  try {
    const text = await readFile(path.join(MULTAS_DATA_DIR, MULTAS_IMPORT_FILE), "utf-8")
    return normalizeMultasImportStore(JSON.parse(text))
  } catch {
    return normalizeMultasImportStore(null)
  }
}

async function saveLocalStore(store: MultasImportStore): Promise<boolean> {
  try {
    await mkdir(MULTAS_DATA_DIR, { recursive: true })
    await writeFile(path.join(MULTAS_DATA_DIR, MULTAS_IMPORT_FILE), JSON.stringify(store, null, 2), "utf-8")
    return true
  } catch (error) {
    if (isReadonlyFilesystemError(error)) return false
    throw error
  }
}

export async function loadMultasImportStore(): Promise<{ store: MultasImportStore; loadedFromDrive: boolean }> {
  let store = await readLocalStore()
  let loadedFromDrive = false

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const folderId = await ensureFolder(drive, MULTAS_DRIVE_FOLDER, rootId)
        const file = await findFile(drive, MULTAS_IMPORT_FILE, folderId)

        if (file?.id) {
          store = normalizeMultasImportStore(await readJsonFile<MultasImportStore>(drive, file.id))
          await saveLocalStore(store)
          loadedFromDrive = true
        }
        break
      } catch {
        // Tenta o próximo cliente de autenticação.
      }
    }
  } catch {
    // Mantém o espelho local como fallback.
  }

  return { store, loadedFromDrive }
}

export async function persistMultasImportStore(
  store: MultasImportStore,
  original?: { fonte: MultaFonte; buffer: Buffer; fileName: string },
) {
  let drivePersisted = false
  let driveError: string | null = null

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const folderId = await ensureFolder(drive, MULTAS_DRIVE_FOLDER, rootId)
        await upsertJsonFile(drive, folderId, MULTAS_IMPORT_FILE, store)

        if (original) {
          // Guarda a última planilha original de cada fonte para auditoria.
          const extension = path.extname(original.fileName) || ".xlsx"
          await upsertBinaryFile(
            drive,
            folderId,
            `ultima_importacao_${original.fonte}${extension}`,
            original.buffer,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          )
        }

        drivePersisted = true
        driveError = null
        break
      } catch (error) {
        driveError = describeDriveError(error)
      }
    }
  } catch (error) {
    driveError = describeDriveError(error)
  }

  const localPersisted = await saveLocalStore(store)

  return { drivePersisted, driveError, localPersisted }
}
