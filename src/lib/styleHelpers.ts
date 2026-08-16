// Helper for generating boxShadow strings using Ink palette (rgba(11,31,23,*) as per CLAUDE.md)

export const shadow = (level: number): string => {
  // Define shadow levels; adjust opacity as needed.
  const base = "rgba(11,31,23,";
  switch (level) {
    case 1:
      return `${base}0.04) 0px 1px 2px 0px`;
    case 2:
      return `${base}0.06) 0px 2px 4px 0px`;
    case 3:
      return `${base}0.08) 0px 4px 8px 0px`;
    case 4:
      return `${base}0.12) 0px 8px 16px 0px`;
    default:
      return `${base}0.04) 0px 1px 2px 0px`;
  }
};
