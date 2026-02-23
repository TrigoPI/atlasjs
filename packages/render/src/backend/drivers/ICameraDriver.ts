import { ViewParams } from "./types";

export interface ICameraDriver {
  setView(params: ViewParams): void;
}
