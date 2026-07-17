export type FilterState = {
  type: string[];
  difficulty: string[];
  duration: string[];
  ambiance: string[];
};

export const DEFAULT_FILTERS: FilterState = {
  type: [],
  difficulty: [],
  duration: [],
  ambiance: [],
};
