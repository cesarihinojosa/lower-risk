import type { TerritoryId, TerritoryState } from "../../shared/types";
import { getAdjacent } from "./territories";

/**
 * Check if two territories are connected through a chain of territories
 * all owned by the same player. Uses BFS.
 */
export function areConnectedThroughOwned(
  from: TerritoryId,
  to: TerritoryId,
  ownerId: string,
  territories: Record<TerritoryId, TerritoryState>,
): boolean {
  if (from === to) return true;

  const visited = new Set<TerritoryId>();
  const queue: TerritoryId[] = [from];
  visited.add(from);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;

    for (const neighbor of getAdjacent(current)) {
      if (!visited.has(neighbor) && territories[neighbor]?.owner === ownerId) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return false;
}
