"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { useFuelData } from "@/hooks/use-fuel-data"

type FuelImportPanelProps = {
  isMaster?: boolean
}

export function FuelImportPanel({ isMaster = false }: FuelImportPanelProps) {
  const [uploading, setUploading] = useState(false)
  const { mutate } = useFuelData()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]

    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)

      const res = await fetch("/api/fuel/import", {
        method: "POST",
        body,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao enviar planilha.")
      }

      toast({
        title: "Importação concluída",
        description: `Registros importados: ${data?.imported ?? 0}`,
      })
      mutate()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar planilha."
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
    <Card>
      <CardHeader>
        <CardTitle>Importar relatório VELOE GO</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {isMaster
            ? "Envie o arquivo CSV do relatório para atualizar o painel."
            : "Somente o usuário mestre pode importar relatórios."}
        </div>
        <label className="inline-flex">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
            disabled={uploading || !isMaster}
            ref={inputRef}
          />
          <Button
            type="button"
            disabled={uploading || !isMaster}
            className="gap-2 bg-violet-500 text-white hover:bg-violet-600"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Enviando..." : "Enviar planilha"}
          </Button>
        </label>
      </CardContent>
    </Card>
  )
}
