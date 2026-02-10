export type UserRole = 'mestre' | 'consulta' | 'administrativo' | 'logistico'

export interface AppUser {
  id: string
  email: string
  nome: string
  role: UserRole
  isMaster?: boolean
}

export type EmpresaLocacao = 'localiza' | 'lok_motors' | 'movida' | 'veiculo_sln'

export interface Vehicle {
  id: string
  placa: string
  chassi: string
  modelo: string
  km: number
  mensalidade: number
  dataVencimentoContrato: string
  tipoPropriedade: 'alugado' | 'proprio'
  empresaLocacao?: EmpresaLocacao | null
  cartaoCombustivel: 'veloe' | 'ticket' | 'ambos'
  frota: boolean
  naOficina: boolean
  paraRevisao: boolean
  semParar: boolean
  tipoContratacao?: 'clt' | 'pj' | null
  cpfAgregado?: string | null
  dataVencimentoCNHAgregado?: string | null
  colaboradorId?: string | null
  createdAt: string
  updatedAt: string
}

export type VehicleFormData = Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>

export interface Colaborador {
  id: string
  nome: string
  cpf: string
  telefone: string
  departamento: string
  dataVencimentoCNH: string
  createdAt: string
  updatedAt: string
}

export type ColaboradorFormData = Omit<Colaborador, 'id' | 'createdAt' | 'updatedAt'>

export interface VehicleFilters {
  search: string
  tipoPropriedade: 'todos' | 'alugado' | 'proprio'
  cartaoCombustivel: 'todos' | 'veloe' | 'ticket' | 'ambos'
  atribuicao: 'todos' | 'atribuido' | 'disponivel'
  statusVeiculo: 'todos' | 'frota' | 'disponivel' | 'ocupado'
  situacao: 'todos' | 'contrato_vencendo' | 'na_oficina' | 'para_revisao'
}
