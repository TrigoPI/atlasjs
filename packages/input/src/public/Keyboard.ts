export interface Keyboard {
  down(code: string): boolean;
  pressed(code: string): boolean;
  released(code: string): boolean;
}
