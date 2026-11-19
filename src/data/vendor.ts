import type { ItemId } from './items';
import type { FlagId } from '../core/state';

export interface VendorOffer {
  id: string;
  name: string;
  price: number;
  desc: string;
  item?: ItemId;
  grantsFlag?: FlagId;
}

export const VENDOR_NAME = 'Dona Rebite';

export const VENDOR_OFFERS: VendorOffer[] = [
  { id: 'offer_wrench_reinforced', name: 'Chave Inglesa Reforçada', price: 35, item: 'tool_wrench_reinforced', desc: 'Mais combate e extração.' },
  { id: 'offer_hydraulic_pry', name: 'Pé-de-cabra Hidráulico', price: 44, item: 'tool_hydraulic_pry', desc: 'Feito para extrair.' },
  { id: 'offer_bp_cargo', name: 'Projeto: Compartimento de Carga', price: 40, grantsFlag: 'bp_cargo', desc: 'Ensina a receita de +6 de carga para o drone.' },
  { id: 'offer_cable', name: 'Cabo de Cobre', price: 14, item: 'cable', desc: 'Para quem não quer cavar.' },
  { id: 'offer_servo', name: 'Servomotor', price: 24, item: 'servo', desc: 'Recondicionado. Garantia de três dias.' },
];
