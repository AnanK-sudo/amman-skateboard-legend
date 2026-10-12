// The Rig test reads the real FBX from disk; this avoids pulling in @types/node for one call
declare module 'fs' {
  export function readFileSync(path: string): Uint8Array;
}
