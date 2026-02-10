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
import { toast } from "@/hooks/use-toast"
import type { Colaborador, ColaboradorFormData, Vehicle } from "@/lib/types"

interface ColaboradorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  colaborador?: Colaborador | null
  vehicles: Vehicle[]
  onSave: (data: ColaboradorFormData, veiculoId?: string | null) => void
}

const initialFormData: ColaboradorFormData = {
  nome: "",
  cpf: "",
  telefone: "",
  departamento: "",
  dataVencimentoCNH: "",
}

export function ColaboradorModal({
  open,
  onOpenChange,
  colaborador,
  vehicles,
  onSave,
}: ColaboradorModalProps) {
  const [formData, setFormData] = useState<ColaboradorFormData>(initialFormData)
  const [selectedVeiculoId, setSelectedVeiculoId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof ColaboradorFormData, string>>>({})

  // Veículos disponíveis (sem colaborador atribuído) ou o veículo atual do colaborador
  const availableVehicles = vehicles.filter((v) => {
    if (colaborador) {
      // Se editando, mostrar veículos disponíveis + veículo atual do colaborador
      return !v.colaboradorId || v.colaboradorId === colaborador.id
    }
    // Se criando, mostrar apenas veículos disponíveis
    return !v.colaboradorId
  })

  useEffect(() => {
    if (colaborador) {
      setFormData({
        nome: colaborador.nome || "",
        cpf: colaborador.cpf || "",
        telefone: colaborador.telefone || "",
        departamento: colaborador.departamento || "",
        dataVencimentoCNH: colaborador.dataVencimentoCNH || "",
      })
      // Buscar veículo atual do colaborador
      const currentVehicle = vehicles.find((v) => v.colaboradorId === colaborador.id)
      setSelectedVeiculoId(currentVehicle?.id || null)
    } else {
      setFormData(initialFormData)
      setSelectedVeiculoId(null)
    }
    setErrors({})
  }, [colaborador, open, vehicles])

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1")
  }

  const formatTelefone = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length <= 10) {
      return numbers
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2")
        .replace(/(-\d{4})\d+?$/, "$1")
    }
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1")
  }

  const formatDateBr = (value: string) => {
    if (!value) return ""
    const [year, month, day] = value.split("-")
    if (year && month && day) return `${day}/${month}/${year}`
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ""
    return parsed.toLocaleDateString("pt-BR")
  }

  const sanitizeFileName = (value: string) => {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
  }

  const selectedVehicle = selectedVeiculoId
    ? vehicles.find((v) => v.id === selectedVeiculoId) || null
    : null

  const canGenerateTermo = Boolean(
    selectedVehicle &&
      formData.nome.trim() &&
      formData.cpf.trim() &&
      formData.dataVencimentoCNH
  )

  const handleGenerateTermo = async () => {
    if (!selectedVehicle) {
      toast({
        title: "Aviso",
        description: "Selecione um veiculo para gerar o termo.",
      })
      return
    }

    const payload = {
      name: formData.nome.trim(),
      inumber: formData.cpf.trim(),
      date: formatDateBr(formData.dataVencimentoCNH),
      md: selectedVehicle.modelo || "",
      plc: selectedVehicle.placa || "",
    }

    if (!payload.name || !payload.inumber || !payload.date || !payload.md || !payload.plc) {
      toast({
        title: "Aviso",
        description: "Preencha os dados do colaborador e selecione o veiculo.",
      })
      return
    }

    try {
      const url = `/api/termo?name=${encodeURIComponent(payload.name)}&inumber=${encodeURIComponent(payload.inumber)}&date=${encodeURIComponent(payload.date)}&md=${encodeURIComponent(payload.md)}&plc=${encodeURIComponent(payload.plc)}`
      window.open(url, "_blank")
      
      toast({ title: "Sucesso", description: "Termo aberto em nova guia." })
    } catch {
      toast({
        title: "Erro",
        description: "Nao foi possivel abrir o termo.",
        variant: "destructive",
      })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ColaboradorFormData, string>> = {}

    if (!formData.nome.trim()) {
      newErrors.nome = "Nome é obrigatório"
    }

    const cpfNumbers = formData.cpf.replace(/\D/g, "")
    if (!cpfNumbers) {
      newErrors.cpf = "CPF é obrigatório"
    } else if (cpfNumbers.length !== 11) {
      newErrors.cpf = "CPF deve ter 11 dígitos"
    }

    const telefoneNumbers = formData.telefone.replace(/\D/g, "")
    if (!telefoneNumbers) {
      newErrors.telefone = "Telefone é obrigatório"
    } else if (telefoneNumbers.length < 10 || telefoneNumbers.length > 11) {
      newErrors.telefone = "Telefone inválido"
    }

    if (!formData.departamento.trim()) {
      newErrors.departamento = "Departamento é obrigatório"
    }

    if (!formData.dataVencimentoCNH) {
      newErrors.dataVencimentoCNH = "Data de vencimento da CNH é obrigatória"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSave(formData, selectedVeiculoId)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {colaborador ? "Editar Colaborador" : "Adicionar Colaborador"}
          </DialogTitle>
          <DialogDescription>
            {colaborador
              ? "Atualize as informações do colaborador."
              : "Preencha os dados do novo colaborador."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                placeholder="João da Silva"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
              />
              {errors.nome && (
                <p className="text-sm text-destructive">{errors.nome}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={(e) =>
                  setFormData({ ...formData, cpf: formatCPF(e.target.value) })
                }
                maxLength={14}
              />
              {errors.cpf && (
                <p className="text-sm text-destructive">{errors.cpf}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={formData.telefone}
                onChange={(e) =>
                  setFormData({ ...formData, telefone: formatTelefone(e.target.value) })
                }
                maxLength={15}
              />
              {errors.telefone && (
                <p className="text-sm text-destructive">{errors.telefone}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="departamento">Departamento</Label>
              <Input
                id="departamento"
                placeholder="Comercial, Operações, etc."
                value={formData.departamento}
                onChange={(e) =>
                  setFormData({ ...formData, departamento: e.target.value })
                }
              />
              {errors.departamento && (
                <p className="text-sm text-destructive">{errors.departamento}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dataVencimentoCNH">Data de Vencimento da CNH</Label>
              <Input
                id="dataVencimentoCNH"
                type="date"
                value={formData.dataVencimentoCNH}
                onChange={(e) =>
                  setFormData({ ...formData, dataVencimentoCNH: e.target.value })
                }
              />
              {errors.dataVencimentoCNH && (
                <p className="text-sm text-destructive">{errors.dataVencimentoCNH}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="veiculo">Veículo (Placa)</Label>
              <Select
                value={selectedVeiculoId || "none"}
                onValueChange={(value) =>
                  setSelectedVeiculoId(value === "none" ? null : value)
                }
              >
                <SelectTrigger id="veiculo">
                  <SelectValue placeholder="Selecione um veículo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum veículo</SelectItem>
                  {availableVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.placa} - {vehicle.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {availableVehicles.length === 0 
                  ? "Nenhum veículo disponível" 
                  : `${availableVehicles.length} veículo(s) disponível(is)`}
              </p>
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
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateTermo}
              disabled={!canGenerateTermo}
            >
              Gerar Termo
            </Button>
            <Button type="submit">
              {colaborador ? "Salvar Alterações" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
