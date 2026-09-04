import {
  Car,
  FileText,
  Fuel,
  LayoutDashboard,
  LineChart,
  Lock,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Truck,
  UserCog,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import type { SectionNavGroup, SectionNavItem, SectionNavPalette } from "@/components/dashboard/section-nav"

export type DashboardSection =
  | "overview"
  | "veiculos-frota"
  | "veiculos-agregados"
  | "colaboradores"
  | "combustivel"
  | "multas"
  | "ajuste-geral"

export type DashboardSectionItem = {
  id: DashboardSection
  href: string
  label: string
  description: string
  icon: LucideIcon
}

export const SHOW_AGREGADOS_SECTION = true

export const DASHBOARD_SECTIONS: DashboardSectionItem[] = [
  {
    id: "overview",
    href: "/dashboard",
    label: "Painel Geral",
    description: "Resumo consolidado com os principais indicadores e busca rápida.",
    icon: LayoutDashboard,
  },
  {
    id: "veiculos-frota",
    href: "/dashboard/veiculos-frota",
    label: "Veículos Frota",
    description: "Cadastro, filtros e acompanhamento dos veículos próprios e alugados.",
    icon: Car,
  },
  {
    id: "veiculos-agregados",
    href: "/dashboard/veiculos-agregados",
    label: "Veículos Agregados",
    description: "Controle operacional dos veículos agregados e seus vínculos.",
    icon: Truck,
  },
  {
    id: "colaboradores",
    href: "/dashboard/colaboradores",
    label: "Colaboradores",
    description: "Gestão dos colaboradores, documentos e vencimentos de CNH.",
    icon: Users,
  },
  {
    id: "combustivel",
    href: "/dashboard/combustivel",
    label: "Combustível",
    description: "Resumo mensal, importação de dados e transações do combustível.",
    icon: Fuel,
  },
  {
    id: "multas",
    href: "/dashboard/multas",
    label: "Multas",
    description: "Acompanhamento de infrações, indicação de condutor, valores e status de tratativa.",
    icon: ShieldAlert,
  },
  {
    id: "ajuste-geral",
    href: "/dashboard/ajuste-geral",
    label: "Ajuste Geral",
    description: "Vínculo dos dados importados (VELOE) com os cadastros do sistema.",
    icon: SlidersHorizontal,
  },
]

export const VISIBLE_DASHBOARD_SECTIONS = DASHBOARD_SECTIONS.filter((section) => {
  if (section.id === "veiculos-agregados") return SHOW_AGREGADOS_SECTION
  return true
})

export const DASHBOARD_SECTION_BUTTON_STYLES: Record<DashboardSection, { active: string; inactive: string }> = {
  overview: {
    active: "border-[#7CB342] bg-[#7CB342] text-white hover:bg-[#6d9d39] hover:border-[#6d9d39]",
    inactive: "border-transparent bg-transparent text-[#4c6b28] hover:bg-[#f3f9e8] hover:border-[#dcecc4]",
  },
  "veiculos-frota": {
    active: "border-[#2f7ddf] bg-[#2f7ddf] text-white hover:bg-[#256fca] hover:border-[#256fca]",
    inactive: "border-transparent bg-transparent text-[#2f5c8c] hover:bg-[#edf5ff] hover:border-[#d3e5fa]",
  },
  "veiculos-agregados": {
    active: "border-[#0f8ecf] bg-[#0f8ecf] text-white hover:bg-[#0b7db6] hover:border-[#0b7db6]",
    inactive: "border-transparent bg-transparent text-[#1c6a8c] hover:bg-[#ebf8ff] hover:border-[#cdeaf9]",
  },
  colaboradores: {
    active: "border-[#159a8c] bg-[#159a8c] text-white hover:bg-[#118477] hover:border-[#118477]",
    inactive: "border-transparent bg-transparent text-[#1a6a5f] hover:bg-[#eefaf7] hover:border-[#cdece6]",
  },
  combustivel: {
    active: "border-[#7c3aed] bg-[#7c3aed] text-white hover:bg-[#6d28d9] hover:border-[#6d28d9]",
    inactive: "border-transparent bg-transparent text-[#5b3a94] hover:bg-[#f5f0ff] hover:border-[#e2d6f8]",
  },
  multas: {
    active: "border-[#e0aa22] bg-[#e0aa22] text-white hover:bg-[#c99313] hover:border-[#c99313]",
    inactive: "border-transparent bg-transparent text-[#8a6a15] hover:bg-[#fff8df] hover:border-[#f2e6b8]",
  },
  "ajuste-geral": {
    active: "border-[#0f766e] bg-[#0f766e] text-white hover:bg-[#0d635c] hover:border-[#0d635c]",
    inactive: "border-transparent bg-transparent text-[#155e57] hover:bg-[#ecfaf7] hover:border-[#c9ece6]",
  },
}

const DEFAULT_SIDEBAR_NAV_COLORS = {
  active: "border-slate-300 bg-slate-100 text-slate-700",
  inactive: "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100",
}

export const SIDEBAR_NAV_PALETTE: SectionNavPalette = {
  ...DASHBOARD_SECTION_BUTTON_STYLES,
  usuarios: DEFAULT_SIDEBAR_NAV_COLORS,
}

const DARK_SIDEBAR_NAV_COLORS = {
  active: "border-transparent bg-[#7CB342] text-white hover:bg-[#8bc34a]",
  inactive: "border-transparent bg-transparent text-white/75 hover:bg-white/10 hover:text-white",
}

export const SIDEBAR_NAV_PALETTE_DARK: SectionNavPalette = Object.fromEntries(
  [...Object.keys(DASHBOARD_SECTION_BUTTON_STYLES), "usuarios"].map((id) => [id, DARK_SIDEBAR_NAV_COLORS])
)

export function getSectionMeta(section: DashboardSection): Pick<DashboardSectionItem, "label" | "description"> {
  const matchedSection = DASHBOARD_SECTIONS.find((item) => item.id === section)

  return {
    label: matchedSection?.label || "Painel Geral",
    description: matchedSection?.description || "Resumo consolidado do sistema.",
  }
}

export function buildSidebarNavGroups(isMaster: boolean): SectionNavGroup[] {
  const mainItems: SectionNavItem[] = [...VISIBLE_DASHBOARD_SECTIONS]

  const configItems: SectionNavItem[] = []
  if (isMaster) {
    configItems.push({ id: "usuarios", label: "Usuários", icon: UserCog, href: "/admin/usuarios" })
  }
  configItems.push({ id: "permissoes", label: "Permissões", icon: Lock })
  configItems.push({ id: "configuracoes", label: "Configurações", icon: Settings })

  return [
    { items: mainItems },
    {
      title: "Relatórios",
      items: [
        { id: "desempenho", label: "Desempenho", icon: LineChart },
        { id: "custos", label: "Custos", icon: Wallet },
        { id: "manutencoes", label: "Manutenções", icon: Wrench },
        { id: "documentos", label: "Documentos", icon: FileText },
      ],
    },
    { title: "Configurações", items: configItems },
  ]
}
