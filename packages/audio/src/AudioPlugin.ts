import { Engine, Plugin } from "@atlasjs/core";
import { createLogger, Logger } from "@atlasjs/utils";
import { ASSET_MANAGER, AssetManager } from "@atlasjs/assets";

import { AUDIO_ENGINE } from "./tokens";
import { AudioEngine } from "./AudioEngine";
import { AudioLoader } from "./assets/AudioLoader";

export class AudioPlugin extends Plugin {
  private readonly logger: Logger;
  private engine: AudioEngine | null;

  public constructor() {
    super("audio-plugin", {
      requires: [ASSET_MANAGER],
      provides: [AUDIO_ENGINE],
    });
    this.logger = createLogger(AudioPlugin.name);
    this.engine = null;
  }

  public async install(engine: Engine): Promise<void> {
    const assets: AssetManager = await engine.services.wait(ASSET_MANAGER);
    const audio: AudioEngine = new AudioEngine();
    this.engine = audio;
    assets.register(new AudioLoader(audio));
    engine.services.provide(AUDIO_ENGINE, audio);
    this.logger.log("Audio plugin installed");
    this.deferred.resolve();
  }

  public uninstall(): void {
    this.engine?.destroy();
    this.engine = null;
  }
}
