import type { SortingLayers } from "./SortingLayers";

export interface SortTarget {
  sortingLayer: number;
  sortPrimary: number;
  sortSecondary: number;
}

export function applySortFields(
  target: SortTarget,
  sortingLayers: SortingLayers,
  layerName: string,
  sortingOrder: number,
  worldY: number,
): void {
  const layer: number = sortingLayers.indexOf(layerName);
  target.sortingLayer = layer;

  if (sortingLayers.modeOf(layer) === "ySorted") {
    target.sortPrimary = worldY;
    target.sortSecondary = sortingOrder;
    return;
  }

  target.sortPrimary = sortingOrder;
  target.sortSecondary = 0;
}
