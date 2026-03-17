"use client"

import { useRef, useState } from "react"
import { RefreshCcw, Upload } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"

type FuelCostCenterPanelProps = {
  isMaster?: boolean
}

export function FuelCostCenterPanel({ isMaster = false }: FuelCostCenterPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    setUploading(true)

    try {
      const body = new FormData()
      body.append("file", file)

      const res = await fetch("/api/fuel/cost-center", {
        method: "POST",
        body,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao enviar a planilha de centro de custo.")
      }

      toast({
        title: "Centro de custo atualizado",
        description: `Cadastro substituído com ${data?.imported ?? 0} motoristas.`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar a planilha de centro de custo."
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fbfdf9_0%,#f3f8ed_100%)] shadow-sm">
      <CardHeader className="py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl text-slate-900">Centro de custo do combustível</CardTitle>

          <label className="inline-flex">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              disabled={!isMaster || uploading}
              onChange={(event) => handleUpload(event.target.files)}
            />
            <Button
              type="button"
              disabled={!isMaster || uploading}
              className="gap-2 bg-[#4f8f57] text-white hover:bg-[#447b4b]"
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Atualizando..." : "Importar centro de custo"}
            </Button>
          </label>
        </div>
      </CardHeader>
    </Card>
  )
}