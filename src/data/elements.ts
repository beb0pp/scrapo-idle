export const ELEMENT_IDS = ['eletrico', 'magnetico', 'termico', 'corrosivo', 'blindado'] as const;
export type ElementId = (typeof ELEMENT_IDS)[number];

export interface ElementDef {
  id: ElementId;
  name: string;
  short: string;
  /** Spell hues are reused on purpose: Térmico = Lança de Brasa orange, Magnético = Chamado Imantado violet. */
  color: string;
  desc: string;
}

export const ELEMENTS: Record<ElementId, ElementDef> = {
  eletrico: { id: 'eletrico', name: 'Elétrico', short: 'ELÉ', color: '#6f9cff', desc: 'Arcos e sobrecarga que atravessam chapas e fervem lama química.' },
  magnetico: { id: 'magnetico', name: 'Magnético', short: 'MAG', color: '#b48ae6', desc: 'Campos que puxam, torcem e induzem pane em circuitos.' },
  termico: { id: 'termico', name: 'Térmico', short: 'TÉR', color: '#f08a3a', desc: 'Calor de forja que desmagnetiza ímãs e derrete fiação.' },
  corrosivo: { id: 'corrosivo', name: 'Corrosivo', short: 'COR', color: '#3fd49a', desc: 'Ácido e ferrugem que comem blindagem e apagam fornalhas.' },
  blindado: { id: 'blindado', name: 'Blindado', short: 'BLI', color: '#aab4c4', desc: 'Massa de aço que abafa o calor e não se deixa puxar.' },
};

/** Attack element → defenders it hits for ×2 (`strong`) and defenders that take only ×0.5 from it (`resistedBy`). */
export const ADVANTAGE: Record<ElementId, { strong: readonly ElementId[]; resistedBy: readonly ElementId[] }> = {
  termico: { strong: ['magnetico', 'eletrico'], resistedBy: ['blindado', 'termico'] },
  magnetico: { strong: ['eletrico', 'corrosivo'], resistedBy: ['termico', 'magnetico'] },
  eletrico: { strong: ['corrosivo', 'blindado'], resistedBy: ['magnetico', 'eletrico'] },
  corrosivo: { strong: ['blindado', 'termico'], resistedBy: ['eletrico', 'corrosivo'] },
  blindado: { strong: ['termico', 'magnetico'], resistedBy: ['corrosivo', 'blindado'] },
};
