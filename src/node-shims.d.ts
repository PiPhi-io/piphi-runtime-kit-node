declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: BufferEncoding): string;
}

declare module "node:path" {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare module "node:crypto" {
  interface Hash {
    update(value: string): Hash;
    digest(encoding: "hex"): string;
  }
  export function createHash(algorithm: string): Hash;
  export function randomUUID(): string;
}

declare module "node:fs/promises" {
  interface FileHandle {
    writeFile(data: string): Promise<void>;
    close(): Promise<void>;
  }
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<unknown>;
  export function open(path: string, flags: string, mode?: number): Promise<FileHandle>;
  export function readFile(path: string, encoding: BufferEncoding): Promise<string>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function rm(path: string, options?: { force?: boolean }): Promise<void>;
  export function writeFile(path: string, data: string, options?: { mode?: number }): Promise<void>;
}

type BufferEncoding = "utf8" | "utf-8";

declare const process: { env: Record<string, string | undefined> };

declare module "mqtt" {
  export function connectAsync(
    url: string,
    options?: Record<string, unknown>,
  ): Promise<import("./runtime/mqtt.js").MqttClientLike>;
}
