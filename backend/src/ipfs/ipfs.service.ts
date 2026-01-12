import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class IpfsService implements OnModuleInit {
  private readonly logger = new Logger(IpfsService.name);
  private readonly downloadPath = './temp/packages';

  constructor(private config: ConfigService) {
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
    }
  }

  async onModuleInit() {
    const nodeUrl = this.config.get<string>('IPFS_NODE_URL');
    if (nodeUrl) {
      try {
        const { create } = await import('kubo-rpc-client');
        create({ url: nodeUrl });
        this.logger.log(`✅ Local IPFS Node configured at ${nodeUrl}`);
      } catch (e) {
        this.logger.debug(
          `Local IPFS node not active (skipping): ${e.message}`,
        );
      }
    }
  }

  async fetchPackage(cid: string): Promise<{ path: string; cid: string }> {
    this.logger.log(`⬇️ Fetching artifact ${cid}...`);
    const artifactPath = await this.downloadArtifact(cid);

    if (this.isManifest(artifactPath)) {
      this.logger.log(`📄 CID ${cid} is a Manifest. resolving package...`);
      const packageCID = this.readPackageCIDFromManifest(artifactPath);
      this.logger.log(`   -> Resolved Package CID: ${packageCID}`);
      fs.unlinkSync(artifactPath);
      return this.fetchPackage(packageCID);
    }

    if (this.isZip(artifactPath)) {
      const extractedPath = await this.extractPackage(cid, artifactPath);
      return { path: extractedPath, cid: cid };
    }

    const preview = fs.readFileSync(artifactPath, 'utf8').substring(0, 200);
    fs.unlinkSync(artifactPath); // Cleanup
    throw new Error(
      `Artifact ${cid} is neither a valid Manifest nor a ZIP package. Content preview: ${preview}`,
    );
  }

  private async downloadArtifact(cid: string): Promise<string> {
    const destPath = path.join(this.downloadPath, cid); // Save without extension first

    // Clean start
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);

    const { default: got } = await import('got');
    let gatewayUrl =
      this.config.get<string>('IPFS_GATEWAY_URL') || 'https://ipfs.io/ipfs/';
    if (!gatewayUrl.endsWith('/')) gatewayUrl += '/';

    const fullUrl = `${gatewayUrl}${cid}`;
    const headers: Record<string, string> = {};
    const pinataJwt = this.config.get<string>('PINATA_JWT');
    if (pinataJwt) headers['Authorization'] = `Bearer ${pinataJwt}`;

    this.logger.debug(`Downloading from ${gatewayUrl}...`);

    await new Promise<void>((resolve, reject) => {
      const downloadStream = got.stream(fullUrl, { headers });
      const fileWriter = fs.createWriteStream(destPath);

      downloadStream.on('response', (res) => {
        if (res.statusCode !== 200) {
          this.logger.warn(`⚠️ Gateway returned status ${res.statusCode}`);
        }
      });

      downloadStream.on('error', reject);
      fileWriter.on('error', reject);
      fileWriter.on('finish', resolve);

      downloadStream.pipe(fileWriter);
    });

    return destPath;
  }

  private isManifest(filePath: string): boolean {
    try {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(1);
      fs.readSync(fd, buffer, 0, 1, 0);
      fs.closeSync(fd);

      if (buffer.toString() !== '{') return false;

      // Try parsing
      const content = fs.readFileSync(filePath, 'utf8');
      const json = JSON.parse(content);
      return !!(json.integrity && json.integrity.packageCID);
    } catch {
      return false;
    }
  }

  private readPackageCIDFromManifest(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    return json.integrity.packageCID;
  }

  private isZip(filePath: string): boolean {
    try {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(4);
      fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);
      return buffer.toString('hex') === '504b0304';
    } catch {
      return false;
    }
  }

  private async extractPackage(cid: string, zipPath: string): Promise<string> {
    const extractDir = path.join(this.downloadPath, cid + '_extracted');

    const properZipPath = zipPath + '.zip';
    fs.renameSync(zipPath, properZipPath);

    this.logger.log(`📦 Extracting ZIP to ${extractDir}...`);

    if (fs.existsSync(extractDir))
      fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });

    try {
      await execAsync(`unzip -o "${properZipPath}" -d "${extractDir}"`);
      // Cleanup the zip file after extraction
      fs.unlinkSync(properZipPath);
      return extractDir;
    } catch (error) {
      // Cleanup on failure
      if (fs.existsSync(properZipPath)) fs.unlinkSync(properZipPath);
      throw new Error(`Failed to unzip package: ${error.message}`);
    }
  }
}
