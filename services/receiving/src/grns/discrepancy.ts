import { GrnCondition, GrnDiscrepancyType } from "../generated/prisma";

export interface DiscrepancyInput {
  sku: string;
  condition: GrnCondition;
  quantityOrdered: number;
  quantityReceived: number;
}

/**
 * FR-3.3 — classifies one GRN line. DAMAGED lines are always DAMAGE. A GOOD
 * line is compared as a whole SKU: everything that physically arrived
 * (GOOD + DAMAGED) against what was ordered, so 8 good + 2 damaged of 10
 * ordered is not also reported as a shortage.
 */
export function discrepancyFor(
  line: DiscrepancyInput,
  allLines: DiscrepancyInput[],
): GrnDiscrepancyType {
  if (line.condition === GrnCondition.DAMAGED) {
    return line.quantityReceived > 0
      ? GrnDiscrepancyType.DAMAGE
      : GrnDiscrepancyType.NONE;
  }

  const totalArrived = allLines
    .filter((other) => other.sku === line.sku)
    .reduce((sum, other) => sum + other.quantityReceived, 0);

  if (totalArrived < line.quantityOrdered) return GrnDiscrepancyType.SHORTAGE;
  if (totalArrived > line.quantityOrdered) return GrnDiscrepancyType.OVERAGE;
  return GrnDiscrepancyType.NONE;
}
