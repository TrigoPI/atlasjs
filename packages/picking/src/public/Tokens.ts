import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
import { Picker } from "./Picker";

export const PICKING: ServiceToken<Picker> =
  ServiceRegistry.createToken<Picker>("PICKING");
