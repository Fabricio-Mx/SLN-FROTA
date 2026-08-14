import { NextResponse } from "next/server"
import { verifySession } from "@/lib/auth"
import { getFuelFinancialPostingCycleBoundsForClosingMonth, isFuelBillingMonthKey } from "@/lib/fuel-billing"
import {
  getFuelFinancialInvoiceStoredFileName,
  readLocalFuelFinancialInvoices,
  saveLocalFuelFinancialInvoiceFile,
  saveLocalFuelFinancialInvoices,
  type FuelFinancialInvoice,
} from "@/lib/fuel-financial-storage"
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

export const runtime = "nodejs"

const FUEL_FOLDER_NAME = "combustivel"
const FUEL_FINANCE_FOLDER_NAME = "financeiro"
const FUEL_FINANCE_MANIFEST_FILE = "fuel_financial_invoices.json"

function formatDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

async function getFuelFinanceFolderId(drive: Awaited<ReturnType<typeof getDriveClients>>[number]) {
  const rootId = getDriveRootFolderId()
  const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
  return ensureFolder(drive, FUEL_FINANCE_FOLDER_NAME, fuelFolderId)
}

async function loadFuelFinancialInvoices(): Promise<FuelFinancialInvoice[]> {
  let invoices = await readLocalFuelFinancialInvoices()

  try {
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const financeFolderId = await getFuelFinanceFolderId(drive)
        const manifestFile = await findFile(drive, FUEL_FINANCE_MANIFEST_FILE, financeFolderId)
        if (!manifestFile?.id) continue

        const driveInvoices = await readJsonFile<FuelFinancialInvoice[]>(drive, manifestFile.id)
        if (!Array.isArray(driveInvoices)) continue

        invoices = driveInvoices
        await saveLocalFuelFinancialInvoices(driveInvoices)
        break
      } catch {
        // Tenta o proximo cliente do Drive.
      }
    }
  } catch {
    // Mantem espelho local como fallback.
  }

  return invoices
}

export async function GET() {
  try {
    const invoices = await loadFuelFinancialInvoices()
    return NextResponse.json({ invoices })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
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
    const cycleMonth = `${formData.get("cycleMonth") ?? ""}`.trim()

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 })
    }

    if (!isFuelBillingMonthKey(cycleMonth)) {
      return NextResponse.json({ error: "Fechamento da fatura inválido." }, { status: 400 })
    }

    const cycleBounds = getFuelFinancialPostingCycleBoundsForClosingMonth(cycleMonth)
    if (!cycleBounds) {
      return NextResponse.json({ error: "Não foi possível identificar o ciclo da fatura." }, { status: 400 })
    }

    const content = Buffer.from(await file.arrayBuffer())
    const storedFileName = getFuelFinancialInvoiceStoredFileName(cycleMonth, file.name)
    const uploadedAt = new Date().toISOString()
    let driveFileId: string | null = null
    let drivePersisted = false
    let driveError: string | null = null

    const existingInvoices = await loadFuelFinancialInvoices()
    const nextInvoice: FuelFinancialInvoice = {
      id: cycleMonth,
      cycleMonth,
      cycleStart: formatDateOnly(cycleBounds.start),
      cycleEnd: formatDateOnly(cycleBounds.end),
      uploadedAt,
      originalFileName: file.name,
      storedFileName,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      driveFileId: null,
    }

    let nextInvoices = [
      nextInvoice,
      ...existingInvoices.filter((invoice) => invoice.id !== cycleMonth),
    ]

    try {
      const driveClients = await getDriveClients()

      for (const drive of driveClients) {
        try {
          const financeFolderId = await getFuelFinanceFolderId(drive)
          const response = await upsertBinaryFile(
            drive,
            financeFolderId,
            storedFileName,
            content,
            nextInvoice.mimeType,
          )

          driveFileId = response.data.id ?? null
          nextInvoices = nextInvoices.map((invoice) =>
            invoice.id === cycleMonth
              ? {
                  ...invoice,
                  driveFileId,
                }
              : invoice,
          )

          await upsertJsonFile(drive, financeFolderId, FUEL_FINANCE_MANIFEST_FILE, nextInvoices)
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

    const localFilePersisted = await saveLocalFuelFinancialInvoiceFile(storedFileName, content)
    const localManifestPersisted = await saveLocalFuelFinancialInvoices(nextInvoices)
    const localPersisted = localFilePersisted && localManifestPersisted

    if (!drivePersisted && !localPersisted) {
      return NextResponse.json(
        {
          error: "Não foi possível salvar a fatura nem no Drive nem no armazenamento local.",
          driveError,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      invoice: nextInvoices.find((invoice) => invoice.id === cycleMonth),
      replacedExisting: existingInvoices.some((invoice) => invoice.id === cycleMonth),
      storage: drivePersisted && localPersisted ? "drive+local" : drivePersisted ? "drive" : "local",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
