"use client"

import { Search, ArrowUpDown, AlertTriangle, Clock, CheckCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface ColaboradorFilters {
  search: string
  ordenacao: "nome" | "cnh_vencimento_asc" | "cnh_vencimento_desc"
  statusCNH: "todos" | "vencida" | "vencendo" | "valida"
}

interface ColaboradoresFiltersProps {
  filters: ColaboradorFilters
  onFiltersChange: (filters: ColaboradorFilters) => void
}

export function ColaboradoresFilters({ filters, onFiltersChange }: ColaboradoresFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, telefone ou centro de custo..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
            className="h-11 pl-10 text-[0.95rem]"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select
            value={filters.ordenacao}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                ordenacao: value as ColaboradorFilters["ordenacao"],
              })
            }
          >
            <SelectTrigger className="h-11 w-[220px] text-[0.95rem]">
              <ArrowUpDown className="mr-2 h-4.5 w-4.5" />
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nome">Nome (A-Z)</SelectItem>
              <SelectItem value="cnh_vencimento_asc">CNH (Mais próximo)</SelectItem>
              <SelectItem value="cnh_vencimento_desc">CNH (Mais distante)</SelectItem>
            </SelectContent>
          </Select>
          
          <Select
            value={filters.statusCNH}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                statusCNH: value as ColaboradorFilters["statusCNH"],
              })
            }
          >
            <SelectTrigger className="h-11 w-[190px] text-[0.95rem]">
              <SelectValue placeholder="Status CNH" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as CNHs</SelectItem>
              <SelectItem value="vencida">CNH Vencida</SelectItem>
              <SelectItem value="vencendo">CNH Vencendo</SelectItem>
              <SelectItem value="valida">CNH Válida</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Botões de filtro rápido */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filters.statusCNH === "todos" ? "default" : "outline"}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, statusCNH: "todos" })}
          className="h-9 gap-2 px-3.5 text-[0.9rem]"
        >
          Todos
        </Button>
        <Button
          variant={filters.statusCNH === "vencida" ? "default" : "outline"}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, statusCNH: "vencida" })}
          className={`h-9 gap-2 px-3.5 text-[0.9rem] ${filters.statusCNH === "vencida" ? "bg-destructive hover:bg-destructive/90" : "text-destructive border-destructive/30 hover:bg-destructive/10"}`}
        >
          <AlertTriangle className="h-4 w-4" />
          CNH Vencida
        </Button>
        <Button
          variant={filters.statusCNH === "vencendo" ? "default" : "outline"}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, statusCNH: "vencendo" })}
          className={`h-9 gap-2 px-3.5 text-[0.9rem] ${filters.statusCNH === "vencendo" ? "bg-chart-3 hover:bg-chart-3/90" : "text-chart-3 border-chart-3/30 hover:bg-chart-3/10"}`}
        >
          <Clock className="h-4 w-4" />
          CNH Vencendo (30 dias)
        </Button>
        <Button
          variant={filters.statusCNH === "valida" ? "default" : "outline"}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, statusCNH: "valida" })}
          className={`h-9 gap-2 px-3.5 text-[0.9rem] ${filters.statusCNH === "valida" ? "bg-accent hover:bg-accent/90" : "text-accent border-accent/30 hover:bg-accent/10"}`}
        >
          <CheckCircle className="h-4 w-4" />
          CNH Válida
        </Button>
      </div>
    </div>
  )
}
