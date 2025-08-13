// manager.ts
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";
import { promisify } from "util";
import * as path from "path";
// eslint-disable-next-line @typescript-eslint/naming-convention
import * as child_process from "child_process";
import { Logger } from "./logger";
import * as yauzl from "yauzl";

const execFile = promisify(child_process.execFile);

export type ArchKey = "darwin-aarch64" | "darwin-x86_64";

export interface LatestAsset {
  url: string;
  sha256: string;
  size: number;
  sig?: {
    type: "cosign";
    signature_url?: string;
    certificate_url?: string;
    bundle_url?: string;
  };
  checksums_url?: string;
}

export interface LatestJson {
  version: string;
  released_at: string;
  assets: Record<string, LatestAsset>;
}

export interface CliManagerOpts {
  ownerRepo: string;
  installDir: string;
  binName: string;
  latestJsonUrl?: string;
}

export interface EnsureOpts {
  background?: boolean;
  timeoutMs?: number;
  force?: boolean;
}

export class CliManager {
  private readonly ownerRepo: string;
  private readonly installDir: string;
  private readonly binPath: string;
  private readonly latestJsonUrl: string;
  private inFlight?: Promise<void>;

  constructor(opts: CliManagerOpts) {
    this.ownerRepo = opts.ownerRepo;
    this.installDir = opts.installDir;
    this.binPath = path.join(
      opts.installDir,
      `${opts.binName}-${this.archKey()}`,
    );
    this.latestJsonUrl =
      opts.latestJsonUrl ??
      `https://github.com/${opts.ownerRepo}/releases/latest/download/latest.json`;
  }

  get path() {
    return this.binPath;
  }

  async exists(): Promise<boolean> {
    return this.existsExecutable(this.binPath);
  }

  async ensureUpToDate(opts: EnsureOpts = {}): Promise<void> {
    const run = async () => {
      const start = Date.now();
      const withTimeout = <T>(p: Promise<T>) =>
        opts.timeoutMs
          ? Promise.race<T>([
              p,
              new Promise<T>((_, rej) =>
                setTimeout(
                  () => rej(new Error("ensure timeout")),
                  opts.timeoutMs,
                ),
              ),
            ])
          : p;

      try {
        Logger.info("Checking for CLI update");
        const meta = await withTimeout(this.fetchLatestMeta());
        const key = this.archKey();
        const asset = meta.assets[key];
        if (!asset) {
          throw new Error(`No asset for ${key} in latest.json`);
        }

        if (!opts.force) {
          const local = await this.currentVersion().catch(() => null);
          if (
            local === meta.version &&
            (await this.existsExecutable(this.binPath))
          ) {
            Logger.debug(`CLI already up-to-date (${local})`);
            return;
          }
        }

        Logger.info(`Installing CLI ${meta.version} for ${key}`);
        const zipPath = await withTimeout(this.download(asset.url));
        try {
          await this.verifyChecksum(zipPath, asset.sha256);
          const staged = await this.extractSingleFile(zipPath);
          await this.installAtomically(staged);
          Logger.info(`Installed -> ${this.binPath}`);
        } finally {
          fs.promises.unlink(zipPath).catch(() => {});
        }
      } finally {
        Logger.debug(`ensureUpToDate done in ${Date.now() - start}ms`);
      }
    };

    if (!this.inFlight) {
      this.inFlight = run().finally(() => (this.inFlight = undefined));
    }
    return opts.background
      ? this.inFlight.catch((err) =>
          Logger.warn(`Background update skipped: ${err.message}`),
        )
      : this.inFlight;
  }

  async run(args: string[], opts?: child_process.ExecFileOptions) {
    return execFile(this.binPath, args, opts ?? {});
  }

  async uninstall(): Promise<void> {
    if (await this.existsExecutable(this.binPath)) {
      await fs.promises.unlink(this.binPath);
      Logger.info(`Removed ${this.binPath}`);
    }
  }

  async currentVersion(): Promise<string | null> {
    if (!(await this.existsExecutable(this.binPath))) {
      return null;
    }
    try {
      const { stdout } = await execFile(this.binPath, ["--version"], {
        timeout: 4000,
      });
      const m = stdout.trim().match(/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.+-]+)?)/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  private archKey(): ArchKey {
    if (process.platform !== "darwin") {
      throw new Error(`Unsuppported platform: ${process.platform}`);
    }
    return process.arch === "arm64" ? "darwin-aarch64" : "darwin-x86_64";
  }

  private async fetchLatestMeta(): Promise<LatestJson> {
    const res = await fetch(this.latestJsonUrl, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(
        `Failed to fetch latest.json: ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as LatestJson;
  }

  private async existsExecutable(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  private tmpFile(suffix: string): string {
    return path.join(
      os.tmpdir(),
      `skopio-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`,
    );
  }

  private async download(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }
    const tmpZip = this.tmpFile(".zip");
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.promises.writeFile(tmpZip, buf);
    return tmpZip;
  }

  private async verifyChecksum(
    filePath: string,
    expectedHex: string,
  ): Promise<void> {
    const hex = await this.sha256(filePath);
    if (hex.toLowerCase() !== expectedHex.toLowerCase()) {
      throw new Error(`Checksum mismatch: expected ${expectedHex}, got ${hex}`);
    }
    Logger.debug("SHA-256 checksum verified");
  }

  private async sha256(filePath: string): Promise<string> {
    const h = crypto.createHash("sha256");
    await new Promise<void>((resolve, reject) => {
      const s = fs.createReadStream(filePath);
      s.on("data", (c) => h.update(c));
      s.on("end", () => resolve());
      s.on("error", reject);
    });
    return h.digest("hex");
  }

  private async extractSingleFile(zipPath: string): Promise<string> {
    const out = this.tmpFile("");

    return new Promise<string>((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) {
          return reject(err);
        }

        zipfile.readEntry();

        zipfile.on("entry", (entry) => {
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
            return;
          }

          zipfile.openReadStream(entry, (err, readStream) => {
            if (err || !readStream) {
              return reject(err);
            }

            const writeStream = fs.createWriteStream(out, { mode: 0o755 });

            readStream.on("error", reject);
            writeStream.on("error", reject);

            writeStream.on("close", () => {
              zipfile.close();
              resolve(out);
            });

            readStream.pipe(writeStream);
          });
        });

        zipfile.on("error", reject);
      });
    });
  }

  private async installAtomically(stagedPath: string): Promise<void> {
    await fs.promises.mkdir(this.installDir, { recursive: true });
    const backup = `${this.binPath}.old`;
    if (await this.existsExecutable(this.binPath)) {
      await fs.promises.rename(this.binPath, backup).catch(() => {});
    }
    await fs.promises.rename(stagedPath, this.binPath);
    if (await this.existsExecutable(backup)) {
      fs.promises.unlink(backup).catch(() => {});
    }
  }
}
