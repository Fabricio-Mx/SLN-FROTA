import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { normalizeFuelDailyBudgetDataset, type FuelDailyBudgetDataset } from "@/lib/fuel-daily-budget-shared"

const FUEL_DATA_DIR = path.join(process.cwd(), "data", "fuel")
const FUEL_DAILY_BUDGET_FILE = path.join(FUEL_DATA_DIR, "fuel_daily_budget.json")

function isReadonlyFilesystemError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false

  const code = (error as NodeJS.ErrnoException).code
  // ENOENT covers serverless read-only FS (e.g. Vercel /var/task) where mkdir fails
  return code === "EROFS" || code === "EPERM" || code === "EACCES" || code === "ENOENT"
}

export async function readLocalFuelDailyBudgetData(): Promise<FuelDailyBudgetDataset> {
  try {
    const text = await readFile(FUEL_DAILY_BUDGET_FILE, "utf-8")
    return normalizeFuelDailyBudgetDataset(JSON.parse(text))
  } catch {
    return normalizeFuelDailyBudgetDataset(null)
  }
}

export async function saveLocalFuelDailyBudgetData(dataset: FuelDailyBudgetDataset): Promise<boolean> {
  try {
    await mkdir(FUEL_DATA_DIR, { recursive: true })
    await writeFile(FUEL_DAILY_BUDGET_FILE, JSON.stringify(normalizeFuelDailyBudgetDataset(dataset), null, 2), "utf-8")
    return true
  } catch (error) {
    if (isReadonlyFilesystemError(error)) return false
    throw error
  }
}
