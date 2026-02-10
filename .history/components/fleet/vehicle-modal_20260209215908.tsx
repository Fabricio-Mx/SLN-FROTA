"use client"

import React from "react"

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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Vehicle, VehicleFormData } from "@/lib/types"

interface VehicleModalProps {
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
  frota: true,
  naOficina: false,
  paraRevisao: false,
  semParar: false,
  tipoContratacao: null,
  colaboradorId: null,
}

export function VehicleModal({
  open,
  onOpenChange,
  vehicle,
  onSave,
}: VehicleModalProps) {
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
        frota: vehicle.frota ?? true,
        naOficina: vehicle.naOficina ?? false,
        paraRevisao: vehicle.paraRevisao ?? false,
        semParar: vehicle.semParar ?? false,
        tipoContratacao: vehicle.tipoContratacao || null,
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

    // Validação de chassi (17 caracteres alfanuméricos)
    if (!formData.chassi) {
      newErrors.chassi = "Chassi é obrigatório"
    } else if (formData.chassi.length !== 17) {
      newErrors.chassi = "Chassi deve ter 17 caracteres"
    }

    if (!formData.modelo) {
      newErrors.modelo = "Modelo é obrigatório"
    }

    if (formData.mensalidade < 0) {
      newErrors.mensalidade = "Mensalidade não pode ser negativa"
    }

    if (!formData.dataVencimentoContrato) {
      newErrors.dataVencimentoContrato = "Data de vencimento é obrigatória"
    }

    if (formData.tipoPropriedade === "alugado" && !formData.empresaLocacao) {
      newErrors.empresaLocacao = "Selecione a empresa de locação"
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
        chassi: formData.chassi.toUpperCase(),
      })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {vehicle ? "Editar Veículo" : "Adicionar Veículo"}
          </DialogTitle>
          <DialogDescription>
            {vehicle
              ? "Atualize as informações do veículo."
              : "Preencha os dados do novo veículo."}
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
              <Label htmlFor="chassi">Chassi</Label>
              <Input
                id="chassi"
                placeholder="17 caracteres"
                value={formData.chassi}
                onChange={(e) =>
                  setFormData({ ...formData, chassi: e.target.value.toUpperCase() })
                }
                maxLength={17}
              />
              {errors.chassi && (
                <p className="text-sm text-destructive">{errors.chassi}</p>
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
              {errors.mensalidade && (
                <p className="text-sm text-destructive">{errors.mensalidade}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dataVencimento">Data de Vencimento do Contrato</Label>
              <Input
                id="dataVencimento"
                type="date"
                value={formData.dataVencimentoContrato}
                onChange={(e) =>
                  setFormData({ ...formData, dataVencimentoContrato: e.target.value })
                }
              />
              {errors.dataVencimentoContrato && (
                <p className="text-sm text-destructive">
                  {errors.dataVencimentoContrato}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tipoPropriedade">Tipo de Propriedade</Label>
              <Select
                value={formData.tipoPropriedade}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    tipoPropriedade: value as "alugado" | "proprio",
                    empresaLocacao: value === "proprio" ? null : formData.empresaLocacao,
                  })
                }
              >
                <SelectTrigger id="tipoPropriedade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proprio">Próprio</SelectItem>
                  <SelectItem value="alugado">Alugado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.tipoPropriedade === "alugado" && (
              <div className="grid gap-2">
                <Label htmlFor="empresaLocacao">Empresa de Locação</Label>
                <Select
                  value={formData.empresaLocacao || ""}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      empresaLocacao: value as "localiza" | "lok_motors" | "movida" | "veiculo_sln",
                    })
                  }
                >
                  <SelectTrigger id="empresaLocacao">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="localiza">Localiza</SelectItem>
                    <SelectItem value="lok_motors">LOK MOTORS</SelectItem>
                    <SelectItem value="movida">Movida</SelectItem>
                    <SelectItem value="veiculo_sln">Veículo SLN</SelectItem>
                  </SelectContent>
                </Select>
                {errors.empresaLocacao && (
                  <p className="text-sm text-destructive">{errors.empresaLocacao}</p>
                )}
              </div>
            )}
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
            <div className="space-y-3 rounded-lg border border-border p-3">
              <Label className="text-sm font-medium text-muted-foreground">Situação do Veículo</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="frota"
                    checked={formData.frota}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, frota: checked === true })
                    }
                  />
                  <Label htmlFor="frota" className="text-sm font-medium leading-none cursor-pointer">
                    Frota
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="naOficina"
                    checked={formData.naOficina}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, naOficina: checked === true })
                    }
                  />
                  <Label htmlFor="naOficina" className="text-sm font-medium leading-none cursor-pointer">
                    Na Oficina
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="paraRevisao"
                    checked={formData.paraRevisao}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, paraRevisao: checked === true })
                    }
                  />
                  <Label htmlFor="paraRevisao" className="text-sm font-medium leading-none cursor-pointer">
                    Para Revisão
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="semParar"
                    checked={formData.semParar}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, semParar: checked === true })
                    }
                  />
                  <Label htmlFor="semParar" className="text-sm font-medium leading-none cursor-pointer">
                    Sem Parar
                  </Label>
                </div>
              </div>
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
