import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import { AudioEngine } from "./AudioEngine";

export const AUDIO_ENGINE: ServiceToken<AudioEngine> =
  ServiceRegistry.createToken<AudioEngine>("AUDIO_ENGINE");
