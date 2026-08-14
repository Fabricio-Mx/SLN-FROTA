import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

export type FuelFinancialInvoice = {
  id: string
  cycleMonth: string
  cycleStart: string
  cycleEnd: string
  uploadedAt: string
  originalFileName: string
  storedFileName: string
  mimeType: string
  size: number
  driveFileId?: string | null
}

const FUEL_FINANCIAL_DIR = path.join(process.cwd(), "data", "fuel", "financial")
const FUEL_FINANCIAL_FILES_DIR = path.join(FUEL_FINANCIAL_DIR, "files")
const FUEL_FINANCIAL_MANIFEST_FILE = path.join(FUEL_FINANCIAL_DIR, "fuel_financial_invoices.json")

function isReadonlyFilesystemError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false

  const code = (error as NodeJS.ErrnoException).code
  return code === "EROFS" || code === "EPERM" || code === "EACCES" || code === "ENOENT"
}

function normalizeInvoice(invoice: FuelFinancialInvoice): FuelFinancialInvoice | null {
  if (!invoice || typeof invoice !== "object") return null
  if (typeof invoice.id !== "string" || typeof invoice.cycleMonth !== "string") return null
  if (typeof invoice.cycleStart !== "string" || typeof invoice.cycleEnd !== "string") return null
  if (typeof invoice.uploadedAt !== "string") return null
  if (typeof invoice.originalFileName !== "string" || typeof invoice.storedFileName !== "string") return null
  if (typeof invoice.mimeType !== "string" || typeof invoice.size !== "number") return null

  return {
    id: invoice.id,
    cycleMonth: invoice.cycleMonth,
    cycleStart: invoice.cycleStart,
    cycleEnd: invoice.cycleEnd,
    uploadedAt: invoice.uploadedAt,
    originalFileName: invoice.originalFileName,
    storedFileName: invoice.storedFileName,
    mimeType: invoice.mimeType,
    size: invoice.size,
    driveFileId: typeof invoice.driveFileId === "string" ? invoice.driveFileId : null,
  }
}

function sortInvoices(invoices: FuelFinancialInvoice[]): FuelFinancialInvoice[] {
  return [...invoices].sort((left, right) => {
    if (left.cycleMonth !== right.cycleMonth) {
      return right.cycleMonth.localeCompare(left.cycleMonth)
    }

    return right.uploadedAt.localeCompare(left.uploadedAt)
  })
}

export function getFuelFinancialInvoiceStoredFileName(cycleMonth: string, originalFileName: string): string {
  const extension = path.extname(originalFileName).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin"
  return `veloe-fatura-${cycleMonth}${extension}`
}

export async function readLocalFuelFinancialInvoices(): Promise<FuelFinancialInvoice[]> {
  try {
    const text = await readFile(FUEL_FINANCIAL_MANIFEST_FILE, "utf-8")
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []

    return sortInvoices(parsed.map((item) => normalizeInvoice(item)).filter((item): item is FuelFinancialInvoice => Boolean(item)))
  } catch {
    return []
  }
}

export async function saveLocalFuelFinancialInvoices(invoices: FuelFinancialInvoice[]): Promise<boolean> {
  try {
    await mkdir(FUEL_FINANCIAL_DIR, { recursive: true })
    await writeFile(FUEL_FINANCIAL_MANIFEST_FILE, JSON.stringify(sortInvoices(invoices), null, 2), "utf-8")
    return true
  } catch (error) {
    if (isReadonlyFilesystemError(error)) return false
    throw error
  }
}

export async function saveLocalFuelFinancialInvoiceFile(fileName: string, content: Buffer): Promise<boolean> {
  try {
    await mkdir(FUEL_FINANCIAL_FILES_DIR, { recursive: true })
    await writeFile(path.join(FUEL_FINANCIAL_FILES_DIR, fileName), content)
    return true
  } catch (error) {
    if (isReadonlyFilesystemError(error)) return false
    throw error
  }
}

export async function readLocalFuelFinancialInvoiceFile(fileName: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(FUEL_FINANCIAL_FILES_DIR, fileName))
  } catch {
    return null
  }
}
