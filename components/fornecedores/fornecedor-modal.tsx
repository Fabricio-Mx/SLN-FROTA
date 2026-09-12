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
import { Textarea } from "@/components/ui/textarea"
import {
  FORNECEDOR_REGIAO_OPTIONS,
  UF_OPTIONS,
  formatCnpj,
  formatTelefone,
  getRegiaoByUf,
} from "@/lib/fornecedores"
import type { Fornecedor, FornecedorFormData, FornecedorRegiao } from "@/lib/types"

const initialFormData: FornecedorFormData = {
  razaoSocial: "",
  cnpj: "",
  telefone: "",
  email: "",
  responsavel: "",
  regiao: null,
  uf: "",
  chavePix: "",
  banco: "",
  agencia: "",
  conta: "",
  observacoes: "",
  ativo: true,
}

type FornecedorModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fornecedor?: Fornecedor | null
  onSave: (data: FornecedorFormData) => Promise<void> | void
}

export function FornecedorModal({ open, onOpenChange, fornecedor, onSave }: FornecedorModalProps) {
  const [formData, setFormData] = useState<FornecedorFormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof FornecedorFormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (fornecedor) {
      setFormData({
        razaoSocial: fornecedor.razaoSocial,
        cnpj: fornecedor.cnpj,
        telefone: fornecedor.telefone,
        email: fornecedor.email,
        responsavel: fornecedor.responsavel,
        regiao: fornecedor.regiao,
        uf: fornecedor.uf,
        chavePix: fornecedor.chavePix,
        banco: fornecedor.banco,
        agencia: fornecedor.agencia,
        conta: fornecedor.conta,
        observacoes: fornecedor.observacoes,
        ativo: fornecedor.ativo,
      })
    } else {
      setFormData(initialFormData)
    }

    setErrors({})
    setIsSubmitting(false)
  }, [fornecedor, open])

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FornecedorFormData, string>> = {}

    if (!formData.razaoSocial.trim()) {
      newErrors.razaoSocial = "Razão social é obrigatória"
    }

    const cnpjDigits = formData.cnpj.replace(/\D/g, "")
    if (cnpjDigits && cnpjDigits.length !== 14) {
      newErrors.cnpj = "CNPJ deve ter 14 dígitos"
    }

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "E-mail inválido"
    }

    if (!formData.regiao) {
      newErrors.regiao = "Selecione a região de atendimento"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      await onSave(formData)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{fornecedor ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          <DialogDescription>
            {fornecedor
              ? "Atualize os dados cadastrais e de pagamento do fornecedor."
              : "Cadastre o fornecedor com os dados de contato e pagamento."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="razaoSocial">Razão Social</Label>
              <Input
                id="razaoSocial"
                value={formData.razaoSocial}
                onChange={(event) => setFormData({ ...formData, razaoSocial: event.target.value })}
                placeholder="Auto Center Brasil Ltda"
              />
              {errors.razaoSocial ? <p className="text-xs text-destructive">{errors.razaoSocial}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(event) => setFormData({ ...formData, cnpj: formatCnpj(event.target.value) })}
                  placeholder="00.000.000/0000-00"
                />
                {errors.cnpj ? <p className="text-xs text-destructive">{errors.cnpj}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(event) => setFormData({ ...formData, telefone: formatTelefone(event.target.value) })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                  placeholder="contato@fornecedor.com.br"
                />
                {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="responsavel">Responsável / Vendedor</Label>
                <Input
                  id="responsavel"
                  value={formData.responsavel}
                  onChange={(event) => setFormData({ ...formData, responsavel: event.target.value })}
                  placeholder="Nome do contato"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="uf">Estado (UF)</Label>
                <Select
                  value={formData.uf || undefined}
                  onValueChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      uf: value,
                      regiao: getRegiaoByUf(value) ?? current.regiao,
                    }))
                  }
                >
                  <SelectTrigger id="uf">
                    <SelectValue placeholder="Selecione a UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="regiao">Região</Label>
                <Select
                  value={formData.regiao ?? undefined}
                  onValueChange={(value) => setFormData({ ...formData, regiao: value as FornecedorRegiao })}
                >
                  <SelectTrigger id="regiao">
                    <SelectValue placeholder="Selecione a região" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORNECEDOR_REGIAO_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.regiao ? <p className="text-xs text-destructive">{errors.regiao}</p> : null}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="chavePix">Chave PIX</Label>
              <Input
                id="chavePix"
                value={formData.chavePix}
                onChange={(event) => setFormData({ ...formData, chavePix: event.target.value })}
                placeholder="CNPJ, e-mail, telefone ou chave aleatória"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="banco">Banco</Label>
                <Input
                  id="banco"
                  value={formData.banco}
                  onChange={(event) => setFormData({ ...formData, banco: event.target.value })}
                  placeholder="Banco do Brasil"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="agencia">Agência</Label>
                <Input
                  id="agencia"
                  value={formData.agencia}
                  onChange={(event) => setFormData({ ...formData, agencia: event.target.value })}
                  placeholder="0000"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="conta">Conta</Label>
                <Input
                  id="conta"
                  value={formData.conta}
                  onChange={(event) => setFormData({ ...formData, conta: event.target.value })}
                  placeholder="00000-0"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(event) => setFormData({ ...formData, observacoes: event.target.value })}
                placeholder="Condições comerciais, prazos, restrições."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
