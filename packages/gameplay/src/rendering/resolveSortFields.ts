import type { SortingLayers } from "./SortingLayers";

export interface SortFields {
  readonly layer: number;
  readonly primary: number;
  readonly secondary: number;
}

export function resolveSortFields(
  sortingLayers: SortingLayers,
  layerName: string,
  sortingOrder: number,
  worldY: number,
): SortFields {
  const layer: number = sortingLayers.indexOf(layerName);

  if (sortingLayers.modeOf(layer) === "ySorted") {
    return { layer, primary: worldY, secondary: sortingOrder };
  }

  return { layer, primary: sortingOrder, secondary: 0 };
}
