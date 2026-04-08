import RAPIER from "@dimforge/rapier2d-compat";

let RAPIER_INSTANCE: typeof RAPIER | null = null;

export async function ensureRapierInit(): Promise<void> {
  if (!RAPIER_INSTANCE) {
    await RAPIER.init();
  }
}
