/* eslint-disable @typescript-eslint/no-explicit-any */
export function throttle(
  cb: (...args: any[]) => void,
  delay: number,
): (...args: any[]) => void {
  let lastCall: number = 0;
  return (...args: any[]): void => {
    const now: number = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      cb(...args);
    }
  };
}
