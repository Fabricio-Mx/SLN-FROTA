import { NextResponse } from "next/server"
import { verifySession } from "@/lib/auth"
import {
  normalizeFuelDailyBudgetDataset,
  upsertFuelDailyBudgetItem,
  type FuelDailyBudgetDataset,
} from "@/lib/fuel-daily-budget-shared"
import { readLocalFuelDailyBudgetData, saveLocalFuelDailyBudgetData } from "@/lib/fuel-daily-budget-storage"
import {
  describeDriveError,
  ensureFolder,
  findFile,
  getDriveClients,
  getDriveRootFolderId,
  isDriveConfigured,
  readJsonFile,
  upsertJsonFile,
} from "@/lib/google-drive"

export const runtime = "nodejs"

const FUEL_FOLDER_NAME = "combustivel"
const FUEL_DAILY_BUDGET_FILE = "fuel_daily_budget.json"

function normalizeCenterCode(value: string): string {
  return value.replace(/\D+/g, "").trim()
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }

  return Number.NaN
}

async function loadFuelDailyBudgetDataset(): Promise<{
  dataset: FuelDailyBudgetDataset
  loadedFromDrive: boolean
}> {
  let dataset = await readLocalFuelDailyBudgetData()
  let loadedFromDrive = false

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
        const budgetFile = await findFile(drive, FUEL_DAILY_BUDGET_FILE, fuelFolderId)
        const driveDataset = budgetFile?.id
          ? await readJsonFile<FuelDailyBudgetDataset>(drive, budgetFile.id)
          : null

        if (budgetFile?.id) {
          dataset = normalizeFuelDailyBudgetDataset(driveDataset)
          await saveLocalFuelDailyBudgetData(dataset)
          loadedFromDrive = true
          break
        }
      } catch {
        // Tenta o proximo cliente.
      }
    }
  } catch {
    // Mantem o espelho local como fallback.
  }

  return { dataset, loadedFromDrive }
}

async function persistFuelDailyBudgetDataset(dataset: FuelDailyBudgetDataset) {
  let drivePersisted = false
  let driveError: string | null = null

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
        await upsertJsonFile(drive, fuelFolderId, FUEL_DAILY_BUDGET_FILE, dataset)
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

  const localPersisted = await saveLocalFuelDailyBudgetData(dataset)

  return {
    drivePersisted,
    driveError,
    localPersisted,
    storage: drivePersisted && localPersisted ? "drive+local" : drivePersisted ? "drive" : "local",
  }
}

export async function GET() {
  try {
    const driveConfigured = isDriveConfigured()
    const { dataset, loadedFromDrive } = await loadFuelDailyBudgetDataset()
    const warning =
      driveConfigured && !loadedFromDrive && dataset.items.length > 0
        ? "Orçamento diário carregado do espelho local. Verifique o acesso da conta de serviço ao Drive."
        : undefined

    return NextResponse.json({
      items: dataset.items,
      updatedAt: dataset.updatedAt,
      warning,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await verifySession()
    if (!session || session.role !== "mestre") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as
      | {
          centerCode?: string
          centerLabel?: string
          dailyBudget?: number | string
        }
      | null

    const centerCode = normalizeCenterCode(body?.centerCode?.trim() ?? "")
    const centerLabel = body?.centerLabel?.trim() ?? ""
    const dailyBudget = toNumber(body?.dailyBudget)

    if (!centerCode) {
      return NextResponse.json({ error: "Informe o código do centro de custo." }, { status: 400 })
    }

    if (!Number.isFinite(dailyBudget) || dailyBudget < 0) {
      return NextResponse.json({ error: "Informe um orçamento diário válido." }, { status: 400 })
    }

    const { dataset } = await loadFuelDailyBudgetDataset()
    const nextDataset: FuelDailyBudgetDataset = {
      updatedAt: new Date().toISOString(),
      items: upsertFuelDailyBudgetItem(dataset.items, {
        centerCode,
        centerLabel: centerLabel || centerCode,
        dailyBudget: Number(dailyBudget.toFixed(2)),
      }),
    }

    const { drivePersisted, driveError, localPersisted, storage } = await persistFuelDailyBudgetDataset(nextDataset)

    if (!drivePersisted && !localPersisted) {
      return NextResponse.json(
        {
          error: "Não foi possível salvar o orçamento diário nem no Drive nem no armazenamento local.",
          driveError,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      updatedAt: nextDataset.updatedAt,
      storage,
      items: nextDataset.items,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
