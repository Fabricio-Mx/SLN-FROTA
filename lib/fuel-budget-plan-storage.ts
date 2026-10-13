import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { normalizeFuelBudgetPlan, type FuelBudgetPlan } from "@/lib/fuel-budget-plan-shared"

const FUEL_DATA_DIR = path.join(process.cwd(), "data", "fuel")
const FUEL_BUDGET_PLAN_FILE = path.join(FUEL_DATA_DIR, "fuel_budget_plan.json")

function isReadonlyFilesystemError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false

  const code = (error as NodeJS.ErrnoException).code
  return code === "EROFS" || code === "EPERM" || code === "EACCES" || code === "ENOENT"
}

export async function readLocalFuelBudgetPlan(): Promise<{ plan: FuelBudgetPlan; exists: boolean }> {
  try {
    const text = await readFile(FUEL_BUDGET_PLAN_FILE, "utf-8")
    return { plan: normalizeFuelBudgetPlan(JSON.parse(text)), exists: true }
  } catch {
    return { plan: normalizeFuelBudgetPlan(null), exists: false }
  }
}

export async function saveLocalFuelBudgetPlan(plan: FuelBudgetPlan): Promise<boolean> {
  try {
    await mkdir(FUEL_DATA_DIR, { recursive: true })
    await writeFile(FUEL_BUDGET_PLAN_FILE, JSON.stringify(normalizeFuelBudgetPlan(plan), null, 2), "utf-8")
    return true
  } catch (error) {
    if (isReadonlyFilesystemError(error)) return false
    throw error
  }
}
