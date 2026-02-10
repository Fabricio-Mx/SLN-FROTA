"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Vehicle, VehicleFormData } from "@/lib/types"

interface AgregadoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: Vehicle | null
  onSave: (data: VehicleFormData) => void
}

const initialFormData: VehicleFormData = {
  placa: "",
  chassi: "",
  modelo: "",
  km: 0,
  mensalidade: 0,
  dataVencimentoContrato: "",
  tipoPropriedade: "proprio",
  empresaLocacao: null,
  cartaoCombustivel: "veloe",
  frota: false,
  naOficina: false,
  paraRevisao: false,
  tipoContratacao: null,
  cpfAgregado: null,
  dataVencimentoCNHAgregado: null,
  colaboradorId: null,
}

const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, "")
  return numbers
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .replace(/(-\d{2})\d+?$/, "$1")
}

export function AgregadoModal({
  open,
  onOpenChange,
  vehicle,
  onSave,
}: AgregadoModalProps) {
  const [formData, setFormData] = useState<VehicleFormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof VehicleFormData, string>>>({})

  useEffect(() => {
    if (vehicle) {
      setFormData({
        placa: vehicle.placa || "",
        chassi: vehicle.chassi || "",
        modelo: vehicle.modelo || "",
        km: vehicle.km ?? 0,
        mensalidade: vehicle.mensalidade ?? 0,
        dataVencimentoContrato: vehicle.dataVencimentoContrato || "",
        tipoPropriedade: vehicle.tipoPropriedade || "proprio",
        empresaLocacao: vehicle.empresaLocacao || null,
        cartaoCombustivel: vehicle.cartaoCombustivel || "veloe",
        frota: false, // Sempre false para agregados
        naOficina: vehicle.naOficina ?? false,
        paraRevisao: vehicle.paraRevisao ?? false,
        tipoContratacao: vehicle.tipoContratacao || null,
        cpfAgregado: vehicle.cpfAgregado || null,
        dataVencimentoCNHAgregado: vehicle.dataVencimentoCNHAgregado || null,
        colaboradorId: vehicle.colaboradorId || null,
      })
    } else {
      setFormData(initialFormData)
    }
    setErrors({})
  }, [vehicle, open])

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof VehicleFormData, string>> = {}

    // Validação de placa (padrão brasileiro: ABC-1234 ou ABC1D23)
    const placaRegex = /^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/i
    if (!formData.placa) {
      newErrors.placa = "Placa é obrigatória"
    } else if (!placaRegex.test(formData.placa.replace("-", ""))) {
      newErrors.placa = "Formato inválido (ex: ABC-1234 ou ABC1D23)"
    }

    if (!formData.modelo) {
      newErrors.modelo = "Modelo é obrigatório"
    }

    // Validação de CPF
    const cpfNumbers = formData.cpfAgregado?.replace(/\D/g, "") || ""
    if (!cpfNumbers) {
      newErrors.cpfAgregado = "CPF é obrigatório"
    } else if (cpfNumbers.length !== 11) {
      newErrors.cpfAgregado = "CPF deve ter 11 dígitos"
    }

    if (!formData.dataVencimentoCNHAgregado) {
      newErrors.dataVencimentoCNHAgregado = "Data de vencimento da CNH é obrigatória"
    }

    if (!formData.tipoContratacao) {
      newErrors.tipoContratacao = "Tipo de contratação é obrigatório"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSave({
        ...formData,
        placa: formData.placa.toUpperCase(),
        chassi: "", // Sem chassi para agregados
        frota: false, // Sempre false para agregados
      })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {vehicle ? "Editar Veículo Agregado" : "Adicionar Veículo Agregado"}
          </DialogTitle>
          <DialogDescription>
            {vehicle
              ? "Atualize as informações do veículo agregado."
              : "Preencha os dados do novo veículo agregado."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="placa">Placa</Label>
              <Input
                id="placa"
                placeholder="ABC-1234 ou ABC1D23"
                value={formData.placa}
                onChange={(e) =>
                  setFormData({ ...formData, placa: e.target.value.toUpperCase() })
                }
                maxLength={8}
              />
              {errors.placa && (
                <p className="text-sm text-destructive">{errors.placa}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="modelo">Modelo do Veículo</Label>
              <Input
                id="modelo"
                placeholder="Ex: Honda Civic 2024"
                value={formData.modelo}
                onChange={(e) =>
                  setFormData({ ...formData, modelo: e.target.value })
                }
              />
              {errors.modelo && (
                <p className="text-sm text-destructive">{errors.modelo}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="km">Quilometragem (KM)</Label>
              <Input
                id="km"
                type="number"
                min="0"
                placeholder="0"
                value={formData.km || ""}
                onChange={(e) =>
                  setFormData({ ...formData, km: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cpfAgregado">CPF</Label>
              <Input
                id="cpfAgregado"
                placeholder="000.000.000-00"
                value={formData.cpfAgregado || ""}
                onChange={(e) =>
                  setFormData({ ...formData, cpfAgregado: formatCPF(e.target.value) })
                }
                maxLength={14}
              />
              {errors.cpfAgregado && (
                <p className="text-sm text-destructive">{errors.cpfAgregado}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dataVencimentoCNHAgregado">Data de Vencimento da CNH</Label>
              <Input
                id="dataVencimentoCNHAgregado"
                type="date"
                value={formData.dataVencimentoCNHAgregado || ""}
                onChange={(e) =>
                  setFormData({ ...formData, dataVencimentoCNHAgregado: e.target.value })
                }
              />
              {errors.dataVencimentoCNHAgregado && (
                <p className="text-sm text-destructive">
                  {errors.dataVencimentoCNHAgregado}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mensalidade">Valor da Mensalidade (R$)</Label>
              <Input
                id="mensalidade"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={formData.mensalidade || ""}
                onChange={(e) =>
                  setFormData({ ...formData, mensalidade: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tipoContratacao">Tipo de Contratação</Label>
              <Select
                value={formData.tipoContratacao || ""}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    tipoContratacao: value as "clt" | "pj",
                  })
                }
              >
                <SelectTrigger id="tipoContratacao">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clt">CLT</SelectItem>
                  <SelectItem value="pj">PJ</SelectItem>
                </SelectContent>
              </Select>
              {errors.tipoContratacao && (
                <p className="text-sm text-destructive">{errors.tipoContratacao}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cartaoCombustivel">Cartão Combustível</Label>
              <Select
                value={formData.cartaoCombustivel}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    cartaoCombustivel: value as "veloe" | "ticket" | "ambos",
                  })
                }
              >
                <SelectTrigger id="cartaoCombustivel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veloe">Veloe</SelectItem>
                  <SelectItem value="ticket">Ticket</SelectItem>
                  <SelectItem value="ambos">Veloe/Ticket</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">
              {vehicle ? "Salvar Alterações" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
