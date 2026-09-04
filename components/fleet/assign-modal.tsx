"use client"

import { useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { Vehicle, Colaborador } from "@/lib/types"

interface AssignModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle: Vehicle | null
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
  onAssign: (vehicleId: string, colaboradorId: string) => void
}

export function AssignModal({
  open,
  onOpenChange,
  vehicle,
  vehicles,
  colaboradores,
  onAssign,
}: AssignModalProps) {
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>("")

  // Cada colaborador pode ficar com um veiculo so.
  const vehicleByColaboradorId = useMemo(() => {
    const map = new Map<string, Vehicle>()
    for (const item of vehicles) {
      if (item.colaboradorId && item.id !== vehicle?.id) map.set(item.colaboradorId, item)
    }
    return map
  }, [vehicles, vehicle?.id])

  const colaboradorAtual = vehicle?.colaboradorId
    ? colaboradores.find((item) => item.id === vehicle.colaboradorId) ?? null
    : null

  const selectedBlocker = selectedColaboradorId ? vehicleByColaboradorId.get(selectedColaboradorId) ?? null : null

  const handleAssign = () => {
    if (!vehicle || !selectedColaboradorId || selectedBlocker || colaboradorAtual) return

    onAssign(vehicle.id, selectedColaboradorId)
    setSelectedColaboradorId("")
    onOpenChange(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedColaboradorId("")
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atribuir Veículo ao Colaborador</DialogTitle>
          <DialogDescription>
            Selecione um colaborador para atribuir o veículo{" "}
            <span className="font-semibold">{vehicle?.placa}</span> ({vehicle?.modelo}).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {colaboradorAtual ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-[0.82rem] text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Este veículo já está atribuído a outro colaborador (
                <span className="font-semibold">{colaboradorAtual.nome}</span>). Remova o vínculo atual antes de
                atribuir a outra pessoa.
              </span>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="colaborador">Colaborador</Label>
            <Select
              value={selectedColaboradorId}
              onValueChange={setSelectedColaboradorId}
              disabled={Boolean(colaboradorAtual)}
            >
              <SelectTrigger id="colaborador">
                <SelectValue placeholder="Selecione um colaborador" />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum colaborador cadastrado
                  </SelectItem>
                ) : (
                  colaboradores.map((colaborador) => {
                    const ocupado = vehicleByColaboradorId.get(colaborador.id)

                    return (
                      <SelectItem key={colaborador.id} value={colaborador.id} disabled={Boolean(ocupado)}>
                        {colaborador.nome} - {colaborador.departamento}
                        {ocupado ? ` (já possui ${ocupado.placa})` : ""}
                      </SelectItem>
                    )
                  })
                )}
              </SelectContent>
            </Select>
            {selectedBlocker ? (
              <p className="text-sm text-destructive">
                Este colaborador já possui o veículo {selectedBlocker.placa}. Cada colaborador pode ter apenas um
                veículo.
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAssign}
            disabled={
              !selectedColaboradorId ||
              colaboradores.length === 0 ||
              Boolean(selectedBlocker) ||
              Boolean(colaboradorAtual)
            }
          >
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
