import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { dedupeCostCenterRecords, normalizeCostCenterDataset, type CostCenterDataset } from "@/lib/cost-center-shared"

const COST_CENTER_DATA_DIR = path.join(process.cwd(), "data", "fuel")
const COST_CENTER_DATA_FILE = path.join(COST_CENTER_DATA_DIR, "cost_center_data.json")

function isReadonlyFilesystemError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false

  const code = (error as NodeJS.ErrnoException).code
  return code === "EROFS" || code === "EPERM" || code === "EACCES"
}

function normalizePersistedDataset(dataset: CostCenterDataset): CostCenterDataset {
  return {
    updatedAt: dataset.updatedAt,
    records: dedupeCostCenterRecords(dataset.records),
  }
}

export async function readLocalCostCenterData(): Promise<CostCenterDataset> {
  try {
    const text = await readFile(COST_CENTER_DATA_FILE, "utf-8")
    return normalizeCostCenterDataset(JSON.parse(text))
  } catch {
    return { updatedAt: null, records: [] }
  }
}

export async function saveLocalCostCenterData(dataset: CostCenterDataset): Promise<boolean> {
  try {
    await mkdir(COST_CENTER_DATA_DIR, { recursive: true })
    await writeFile(COST_CENTER_DATA_FILE, JSON.stringify(normalizePersistedDataset(dataset), null, 2), "utf-8")
    return true
  } catch (error) {
    if (isReadonlyFilesystemError(error)) return false
    throw error
  }
}