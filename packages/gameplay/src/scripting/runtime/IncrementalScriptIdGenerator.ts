import { ScriptID } from "../core";

export class IncrementalScriptIdGenerator {
  private current: number;

  public constructor() {
    this.current = 0;
  }

  public next(): ScriptID {
    this.current += 1;
    return this.current as ScriptID;
  }
}
