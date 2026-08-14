import { NextResponse } from "next/server"
import {
  readLocalFuelFinancialInvoiceFile,
  readLocalFuelFinancialInvoices,
  type FuelFinancialInvoice,
} from "@/lib/fuel-financial-storage"
import {
  ensureFolder,
  findFile,
  getDriveClients,
  getDriveRootFolderId,
  readDriveFileContent,
} from "@/lib/google-drive"

export const runtime = "nodejs"

const FUEL_FOLDER_NAME = "combustivel"
const FUEL_FINANCE_FOLDER_NAME = "financeiro"
const FUEL_FINANCE_MANIFEST_FILE = "fuel_financial_invoices.json"

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

        const content = await readDriveFileContent(drive, manifestFile.id)
        const parsed = JSON.parse(content.toString("utf-8"))
        if (!Array.isArray(parsed)) continue

        invoices = parsed
        break
      } catch {
        // Tenta o proximo cliente do Drive.
      }
    }
  } catch {
    // Mantem espelho local.
  }

  return invoices
}

function buildDownloadHeaders(invoice: FuelFinancialInvoice) {
  return {
    "Content-Type": invoice.mimeType || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${invoice.storedFileName}"`,
    "Cache-Control": "private, no-store",
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  try {
    const { invoiceId } = await params
    const invoices = await loadFuelFinancialInvoices()
    const invoice = invoices.find((item) => item.id === invoiceId)

    if (!invoice) {
      return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 })
    }

    const localFile = await readLocalFuelFinancialInvoiceFile(invoice.storedFileName)
    if (localFile) {
      return new NextResponse(localFile, { headers: buildDownloadHeaders(invoice) })
    }

    const driveClients = await getDriveClients()
    for (const drive of driveClients) {
      try {
        let fileId = invoice.driveFileId ?? null

        if (!fileId) {
          const financeFolderId = await getFuelFinanceFolderId(drive)
          const driveFile = await findFile(drive, invoice.storedFileName, financeFolderId)
          fileId = driveFile?.id ?? null
        }

        if (!fileId) {
          continue
        }

        const content = await readDriveFileContent(drive, fileId)
        return new NextResponse(content, { headers: buildDownloadHeaders(invoice) })
      } catch {
        // Tenta o proximo cliente do Drive.
      }
    }

    return NextResponse.json({ error: "Arquivo da fatura não encontrado." }, { status: 404 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
