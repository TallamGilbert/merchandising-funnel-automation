export interface BinCandidate {
  id: string;
  code: string;
  pickPriority: number;
  capacityVolumeCm3: number;
  maxWeightKg: number;
  usedVolumeCm3: number;
  usedWeightKg: number;
}

export interface Footprint {
  volumeCm3: number;
  weightKg: number;
}

/** Total space and weight a putaway of `quantity` units needs. Unknown dimensions count as 0. */
export function footprintFor(
  attributes: {
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    weightKg: number | null;
  },
  quantity: number,
): Footprint {
  const { lengthCm, widthCm, heightCm, weightKg } = attributes;
  const unitVolume =
    lengthCm !== null && widthCm !== null && heightCm !== null
      ? lengthCm * widthCm * heightCm
      : 0;
  return {
    volumeCm3: unitVolume * quantity,
    weightKg: (weightKg ?? 0) * quantity,
  };
}

/**
 * FR-5.1 — picks the bin a received product goes to. Only bins with room for
 * the whole quantity (by volume and by weight) qualify. Fast-moving items are
 * steered to the bins closest to dispatch (lowest pickPriority), slow movers
 * to the furthest, so prime slots are not wasted on stock that rarely leaves.
 */
export function selectBin<T extends BinCandidate>(
  bins: T[],
  footprint: Footprint,
  highVelocity: boolean,
): T | undefined {
  return bins
    .filter(
      (bin) =>
        bin.capacityVolumeCm3 - bin.usedVolumeCm3 >= footprint.volumeCm3 &&
        bin.maxWeightKg - bin.usedWeightKg >= footprint.weightKg,
    )
    .sort((a, b) => {
      const byPriority = highVelocity
        ? a.pickPriority - b.pickPriority
        : b.pickPriority - a.pickPriority;
      return byPriority !== 0 ? byPriority : a.code.localeCompare(b.code);
    })[0];
}
