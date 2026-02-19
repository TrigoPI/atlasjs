import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
import { Input } from "./Input";

export const INPUT: ServiceToken<Input> =
  ServiceRegistry.createToken<Input>("ALTAS_INPUT");
