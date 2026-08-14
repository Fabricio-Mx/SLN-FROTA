"use client"

import { useEffect, useState } from "react"
import { useSWRConfig } from "swr"
import type { CostCenterRecord } from "@/lib/cost-center-shared"
import { FUEL_COST_CENTER_SWR_KEY } from "@/hooks/use-fuel-cost-centers"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type FuelCostCenterEditorProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialRecord?: Partial<CostCenterRecord> | null
}

type FormState = {
  motorista: string
  centroCusto: string
  supervisor: string
  coordenador: string
}

function buildFormState(initialRecord?: Partial<CostCenterRecord> | null): FormState {
  return {
    motorista: initialRecord?.motorista ?? "",
    centroCusto: initialRecord?.centroCusto ?? "",
    supervisor: initialRecord?.supervisor ?? "",
    coordenador: initialRecord?.coordenador ?? "",
  }
}

export function FuelCostCenterEditor({ open, onOpenChange, initialRecord }: FuelCostCenterEditorProps) {
  const { mutate } = useSWRConfig()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<FormState>(() => buildFormState(initialRecord))

  useEffect(() => {
    if (!open) return
    setForm(buildFormState(initialRecord))
  }, [initialRecord, open])

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const res = await fetch("/api/fuel/cost-center", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          previousMotorista: initialRecord?.motorista ?? null,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao salvar ajuste manual.")
      }

      await mutate(FUEL_COST_CENTER_SWR_KEY)
      toast({
        title: "Centro de custo salvo",
        description: `O cadastro de ${form.motorista} foi atualizado com sucesso.`,
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao salvar ajuste manual."
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initialRecord?.motorista) return

    setDeleting(true)

    try {
      const res = await fetch(`/api/fuel/cost-center?motorista=${encodeURIComponent(initialRecord.motorista)}`, {
        method: "DELETE",
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao excluir cadastro.")
      }

      await mutate(FUEL_COST_CENTER_SWR_KEY)
      toast({
        title: "Cadastro removido",
        description: `O vínculo de ${initialRecord.motorista} foi excluído com sucesso.`,
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao excluir cadastro."
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{initialRecord?.motorista ? "Editar centro de custo" : "Adicionar ajuste manual"}</DialogTitle>
          <DialogDescription>
            Cadastre ou ajuste manualmente o centro de custo para que ele apareça sem depender de nova importação.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cc-motorista">Motorista</Label>
            <Input
              id="cc-motorista"
              value={form.motorista}
              onChange={(event) => handleChange("motorista", event.target.value)}
              placeholder="Nome do motorista"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-centro">Centro de custo</Label>
            <Input
              id="cc-centro"
              value={form.centroCusto}
              onChange={(event) => handleChange("centroCusto", event.target.value)}
              placeholder="Ex.: 32-CASA CLIENTE VIP"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cc-supervisor">Supervisor</Label>
              <Input
                id="cc-supervisor"
                value={form.supervisor}
                onChange={(event) => handleChange("supervisor", event.target.value)}
                placeholder="Nome do supervisor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-coordenador">Coordenação</Label>
              <Input
                id="cc-coordenador"
                value={form.coordenador}
                onChange={(event) => handleChange("coordenador", event.target.value)}
                placeholder="Nome da coordenação"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          {initialRecord?.motorista ? (
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving || deleting}>
              {deleting ? "Excluindo..." : "Excluir cadastro"}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || deleting} className="bg-[#4f8f57] text-white hover:bg-[#447b4b]">
            {saving ? "Salvando..." : "Salvar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}