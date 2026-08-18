"use client"

import { useRef, useState } from "react"
import { RefreshCcw, Upload } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"

type ColaboradoresImportButtonProps = {
  isMaster?: boolean
  onImported?: () => void | Promise<void>
}

export function ColaboradoresImportButton({ isMaster = false, onImported }: ColaboradoresImportButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    setUploading(true)

    try {
      const body = new FormData()
      body.append("file", file)

      const res = await fetch("/api/colaboradores/import", {
        method: "POST",
        body,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao importar colaboradores.")
      }

      await onImported?.()

      const detalhes = [
        `${data?.inserted ?? 0} novos`,
        `${data?.updated ?? 0} atualizados`,
        data?.duplicates ? `${data.duplicates} duplicados ignorados` : null,
        data?.skipped ? `${data.skipped} linhas sem nome ignoradas` : null,
      ].filter(Boolean)

      toast({
        title: "Colaboradores importados",
        description: `${data?.imported ?? 0} registros processados: ${detalhes.join(", ")}.`,
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao importar colaboradores.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  if (!isMaster) {
    return null
  }

  return (
    <label className="inline-flex">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="hidden"
        disabled={uploading}
        onChange={(event) => handleUpload(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={uploading}
        title="Planilha com colunas A (Tipo), B (Segmento), C (Nome), D (CPF/CNPJ) e E (Centro de Custo)"
        className="gap-2"
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "Importando..." : "Importar planilha"}
      </Button>
    </label>
  )
}