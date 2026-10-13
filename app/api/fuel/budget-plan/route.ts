import { NextResponse } from "next/server"
import { verifySession } from "@/lib/auth"
import { normalizeFuelBudgetPlan, type FuelBudgetPlan } from "@/lib/fuel-budget-plan-shared"
import { readLocalFuelBudgetPlan, saveLocalFuelBudgetPlan } from "@/lib/fuel-budget-plan-storage"
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
const FUEL_BUDGET_PLAN_FILE = "fuel_budget_plan.json"

async function loadFuelBudgetPlan(): Promise<{ plan: FuelBudgetPlan; loadedFromDrive: boolean }> {
  let { plan } = await readLocalFuelBudgetPlan()
  let loadedFromDrive = false

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
        const planFile = await findFile(drive, FUEL_BUDGET_PLAN_FILE, fuelFolderId)

        if (planFile?.id) {
          plan = normalizeFuelBudgetPlan(await readJsonFile<FuelBudgetPlan>(drive, planFile.id))
          await saveLocalFuelBudgetPlan(plan)
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

  return { plan, loadedFromDrive }
}

async function persistFuelBudgetPlan(plan: FuelBudgetPlan) {
  let drivePersisted = false
  let driveError: string | null = null

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
        await upsertJsonFile(drive, fuelFolderId, FUEL_BUDGET_PLAN_FILE, plan)
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

  const localPersisted = await saveLocalFuelBudgetPlan(plan)

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
    const { plan, loadedFromDrive } = await loadFuelBudgetPlan()
    const hasCollaborators = plan.centers.some((center) => center.collaborators.length > 0)
    const warning =
      driveConfigured && !loadedFromDrive && hasCollaborators
        ? "Orçamento carregado do espelho local. Verifique o acesso da conta de serviço ao Drive."
        : undefined

    return NextResponse.json({ plan, warning })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await verifySession()
    if (!session || session.role !== "mestre") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as { plan?: unknown } | null
    if (!body?.plan || typeof body.plan !== "object") {
      return NextResponse.json({ error: "Plano de orçamento inválido." }, { status: 400 })
    }

    const nextPlan: FuelBudgetPlan = {
      ...normalizeFuelBudgetPlan(body.plan),
      updatedAt: new Date().toISOString(),
    }

    const { drivePersisted, driveError, localPersisted, storage } = await persistFuelBudgetPlan(nextPlan)

    if (!drivePersisted && !localPersisted) {
      return NextResponse.json(
        {
          error: "Não foi possível salvar o orçamento nem no Drive nem no armazenamento local.",
          driveError,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, plan: nextPlan, storage, driveError: drivePersisted ? null : driveError })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
