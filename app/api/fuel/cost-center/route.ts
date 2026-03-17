import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { verifySession } from "@/lib/auth"
import {
  dedupeCostCenterRecords,
  normalizeCostCenterDataset,
  normalizeCostCenterDriverName,
  type CostCenterDataset,
  type CostCenterRecord,
} from "@/lib/cost-center-shared"
import { readLocalCostCenterData, saveLocalCostCenterData } from "@/lib/cost-center-storage"
import {
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
const COST_CENTER_DATA_FILE = "cost_center_data.json"

function normalizeHeaderToken(value: string): string {
  return normalizeCostCenterDriverName(value).replace(/[^a-z0-9]/g, "")
}

function isHeaderRow(values: string[]): boolean {
  const [motorista = "", centroCusto = "", supervisor = "", coordenador = ""] = values.map(normalizeHeaderToken)

  return (
    motorista.includes("motorista") &&
    (centroCusto.includes("centrodecusto") || centroCusto.includes("centrocusto")) &&
    supervisor.includes("supervisor") &&
    (coordenador.includes("coordenador") || coordenador.includes("coordenacao"))
  )
}

function parseCostCenterSpreadsheet(buffer: Buffer): CostCenterRecord[] {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    return []
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  })

  const records: CostCenterRecord[] = []

  for (const row of rows) {
    const values = row.slice(0, 4).map((value) => (typeof value === "string" ? value : String(value ?? "")))
    const nonEmptyCount = values.filter((value) => value.trim() !== "").length

    if (nonEmptyCount === 0 || isHeaderRow(values)) {
      continue
    }

    const [motorista = "", centroCusto = "", supervisor = "", coordenador = ""] = values
    if (!normalizeCostCenterDriverName(motorista) || nonEmptyCount < 2) {
      continue
    }

    records.push({ motorista, centroCusto, supervisor, coordenador })
  }

  return dedupeCostCenterRecords(records)
}

async function loadCostCenterDataset(): Promise<{
  dataset: CostCenterDataset
  loadedFromDrive: boolean
}> {
  let dataset = await readLocalCostCenterData()
  let loadedFromDrive = false

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
        const costCenterFile = await findFile(drive, COST_CENTER_DATA_FILE, fuelFolderId)
        const driveDataset = costCenterFile?.id
          ? await readJsonFile<CostCenterDataset | CostCenterRecord[]>(drive, costCenterFile.id)
          : null

        if (costCenterFile?.id) {
          dataset = normalizeCostCenterDataset(driveDataset)
          await saveLocalCostCenterData(dataset)
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

async function persistCostCenterDataset(dataset: CostCenterDataset) {
  let drivePersisted = false

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
        await upsertJsonFile(drive, fuelFolderId, COST_CENTER_DATA_FILE, dataset)
        drivePersisted = true
        break
      } catch {
        // Tenta o proximo cliente.
      }
    }
  } catch {
    // Mantem apenas local se o Drive nao estiver acessivel.
  }

  const localPersisted = await saveLocalCostCenterData(dataset)

  return {
    drivePersisted,
    localPersisted,
    storage: drivePersisted && localPersisted ? "drive+local" : drivePersisted ? "drive" : "local",
  }
}

function upsertManualCostCenterRecord(
  records: CostCenterRecord[],
  nextRecord: CostCenterRecord,
  previousDriverName?: string | null
): CostCenterRecord[] {
  const previousKey = previousDriverName ? normalizeCostCenterDriverName(previousDriverName) : null
  const nextKey = normalizeCostCenterDriverName(nextRecord.motorista)

  const filtered = records.filter((record) => {
    const recordKey = normalizeCostCenterDriverName(record.motorista)
    if (previousKey && recordKey === previousKey) return false
    if (recordKey === nextKey) return false
    return true
  })

  return dedupeCostCenterRecords([...filtered, nextRecord])
}

export async function GET() {
  try {
    const driveConfigured = isDriveConfigured()
    const { dataset, loadedFromDrive } = await loadCostCenterDataset()
    const warning =
      driveConfigured && !loadedFromDrive && dataset.records.length > 0
        ? "Centro de custo carregado do espelho local. Verifique o acesso da conta de serviço ao Drive."
        : undefined

    return NextResponse.json({
      records: dataset.records,
      updatedAt: dataset.updatedAt,
      warning,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifySession()
    if (!session || session.role !== "mestre") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const records = parseCostCenterSpreadsheet(buffer)

    if (records.length === 0) {
      return NextResponse.json(
        { error: "Nenhum registro válido encontrado. Confira se a planilha tem Motorista, Centro de Custo, Supervisor e Coordenador." },
        { status: 400 }
      )
    }

    const dataset: CostCenterDataset = {
      updatedAt: new Date().toISOString(),
      records,
    }

    const { drivePersisted, localPersisted, storage } = await persistCostCenterDataset(dataset)

    if (!drivePersisted && !localPersisted) {
      return NextResponse.json(
        {
          error: "Não foi possível salvar o centro de custo nem no Drive nem no armazenamento local. Verifique a configuração do Drive.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      imported: records.length,
      updatedAt: dataset.updatedAt,
      storage,
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
          motorista?: string
          centroCusto?: string
          supervisor?: string
          coordenador?: string
          previousMotorista?: string | null
        }
      | null

    const motorista = body?.motorista?.trim() ?? ""
    const centroCusto = body?.centroCusto?.trim() ?? ""
    const supervisor = body?.supervisor?.trim() ?? ""
    const coordenador = body?.coordenador?.trim() ?? ""
    const previousMotorista = body?.previousMotorista?.trim() ?? null

    if (!motorista) {
      return NextResponse.json({ error: "Informe o nome do motorista." }, { status: 400 })
    }

    if (!centroCusto) {
      return NextResponse.json({ error: "Informe o centro de custo." }, { status: 400 })
    }

    const { dataset } = await loadCostCenterDataset()
    const nextDataset: CostCenterDataset = {
      updatedAt: new Date().toISOString(),
      records: upsertManualCostCenterRecord(
        dataset.records,
        {
          motorista,
          centroCusto,
          supervisor,
          coordenador,
        },
        previousMotorista
      ),
    }

    const { drivePersisted, localPersisted, storage } = await persistCostCenterDataset(nextDataset)

    if (!drivePersisted && !localPersisted) {
      return NextResponse.json(
        { error: "Não foi possível salvar a edição manual nem no Drive nem no armazenamento local." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      updatedAt: nextDataset.updatedAt,
      storage,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await verifySession()
    if (!session || session.role !== "mestre") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const url = new URL(req.url)
    const motorista = url.searchParams.get("motorista")?.trim() ?? ""

    if (!motorista) {
      return NextResponse.json({ error: "Informe o nome do motorista para excluir." }, { status: 400 })
    }

    const { dataset } = await loadCostCenterDataset()
    const motoristaKey = normalizeCostCenterDriverName(motorista)
    const nextRecords = dataset.records.filter(
      (record) => normalizeCostCenterDriverName(record.motorista) !== motoristaKey
    )

    if (nextRecords.length === dataset.records.length) {
      return NextResponse.json({ error: "Motorista não encontrado no cadastro." }, { status: 404 })
    }

    const nextDataset: CostCenterDataset = {
      updatedAt: new Date().toISOString(),
      records: nextRecords,
    }

    const { drivePersisted, localPersisted, storage } = await persistCostCenterDataset(nextDataset)

    if (!drivePersisted && !localPersisted) {
      return NextResponse.json(
        { error: "Não foi possível excluir o cadastro nem no Drive nem no armazenamento local." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, updatedAt: nextDataset.updatedAt, storage })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}