"use client"

import { useState } from "react"
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
  colaboradores: Colaborador[]
  onAssign: (vehicleId: string, colaboradorId: string) => void
}

export function AssignModal({
  open,
  onOpenChange,
  vehicle,
  colaboradores,
  onAssign,
}: AssignModalProps) {
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>("")

  const handleAssign = () => {
    if (vehicle && selectedColaboradorId) {
      onAssign(vehicle.id, selectedColaboradorId)
      setSelectedColaboradorId("")
      onOpenChange(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedColaboradorId("")
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Atribuir Veículo ao Colaborador</DialogTitle>
          <DialogDescription>
            Selecione um colaborador para atribuir o veículo{" "}
            <span className="font-semibold">{vehicle?.placa}</span> ({vehicle?.modelo}).
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="grid gap-2">
            <Label htmlFor="colaborador">Colaborador</Label>
            <Select
              value={selectedColaboradorId}
              onValueChange={setSelectedColaboradorId}
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
                  colaboradores.map((colaborador) => (
                    <SelectItem key={colaborador.id} value={colaborador.id}>
                      {colaborador.nome} - {colaborador.departamento}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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
            disabled={!selectedColaboradorId || colaboradores.length === 0}
          >
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
