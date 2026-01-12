import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getCreate2Address,
  keccak256,
  toBytes,
  Hex,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
} from 'viem';
import { IpfsService } from '../ipfs/ipfs.service';
import * as fs from 'fs';
import * as path from 'path';
import { exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProposalVerification } from './entities/verification.entity';
import { Team } from 'src/teams/entities/team.entity';

const execAsync = promisify(exec);

interface RunningProcess {
  process: ChildProcess;
  type: 'basic' | 'custom';
}

const runningProcesses = new Map<string, RunningProcess>();

function execWithCancel(
  command: string,
  options: { cwd?: string } = {},
): {
  promise: Promise<{ stdout: string; stderr: string }>;
  process: ChildProcess;
} {
  let childProcess: ChildProcess;
  const promise = new Promise<{ stdout: string; stderr: string }>(
    (resolve, reject) => {
      childProcess = exec(command, options, (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stdout, stderr }));
        } else {
          resolve({ stdout, stderr });
        }
      });
    },
  );
  return { promise, process: childProcess! };
}

export interface VerificationResult {
  proposalId: string;
  math: { success: boolean; message: string };
  tests: {
    basic: { success: boolean; message: string };
    custom: { success: boolean; message: string };
  };
}

interface ContractConfig {
  name: string;
  constructorArgs?: any[];
  constructorTypes?: string;
}

class MathMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MathMismatchError';
  }
}

class TestFailureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestFailureError';
  }
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectRepository(ProposalVerification)
    private verificationRepo: Repository<ProposalVerification>,
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,

    private config: ConfigService,
    private ipfsService: IpfsService,
  ) {}

  private async getRecord(proposalId: string) {
    let record = await this.verificationRepo.findOneBy({ proposalId });
    if (!record) {
      record = this.verificationRepo.create({ proposalId });
      await this.verificationRepo.save(record);
    }
    return record;
  }

  async getVerificationStatus(proposalId: string) {
    const record = await this.verificationRepo.findOneBy({ proposalId });
    if (!record) {
      return { record: null };
    }
    return { record };
  }

  async cancelTests(
    proposalId: string,
    type: 'basic' | 'custom',
  ): Promise<{ cancelled: boolean; message: string }> {
    const key = `${proposalId}-${type}`;
    const running = runningProcesses.get(key);

    if (!running) {
      return { cancelled: false, message: 'No running process found' };
    }

    this.logger.log(`Cancelling ${type} tests for proposal ${proposalId}`);
    running.process.kill('SIGTERM');
    runningProcesses.delete(key);

    // Update record status
    const record = await this.getRecord(proposalId);
    if (type === 'basic') {
      record.basicStatus = 'failure';
      record.basicMessage = 'Cancelled by user';
    } else {
      record.customStatus = 'failure';
      record.customMessage = 'Cancelled by user';
    }
    await this.verificationRepo.save(record);

    return { cancelled: true, message: 'Tests cancelled' };
  }

  async runMathCheck(
    proposalId: string,
    targetAddress: string,
    ipfsCID: string,
    governorAddress: string,
    projectId: string,
  ): Promise<Pick<VerificationResult, 'math'>> {
    let record = await this.verificationRepo.findOne({
      where: { proposalId },
      relations: ['team'],
    });

    if (!record || !record.team) {
      if (!governorAddress) {
        throw new Error(
          'First verification run requires "governorAddress" to link the Team.',
        );
      }

      const team = await this.teamRepo.findOneBy({ governorAddress });
      if (!team) {
        throw new Error(`Team not found for Governor: ${governorAddress}`);
      }

      if (!record) {
        record = this.verificationRepo.create({ proposalId, team });
      } else {
        record.team = team;
      }

      await this.verificationRepo.save(record);
    }

    const dynamicRegistryAddress = record.team.registryAddress;

    if (record.integrityStatus === 'success') {
      return {
        math: {
          success: true,
          message: record.integrityMessage || 'Cached result',
        },
      };
    }

    let packagePath: string | undefined;
    try {
      this.logger.debug(`[${proposalId}] Running Math Check...`);
      const pkg = await this.ipfsService.fetchPackage(ipfsCID);
      packagePath = pkg.path;

      // The deployment logic uses the Manifest CID (if available) as the "PACKAGE_CID".
      // Therefore, we must use the CID from the proposal (ipfsCID) to calculate matching salts.
      const resolvedCID = ipfsCID;

      this.verifyMath(
        packagePath,
        resolvedCID,
        targetAddress,
        dynamicRegistryAddress,
        projectId,
      );

      const successMessage = 'Bytecode hash matched CREATE2 target.';
      record.integrityStatus = 'success';
      record.integrityMessage = successMessage;
      await this.verificationRepo.save(record);

      return { math: { success: true, message: successMessage } };
    } catch (error: any) {
      this.logger.warn(`[${proposalId}] Math Check Failed: ${error.message}`);

      record.integrityStatus = 'failure';
      record.integrityMessage = error.message;
      await this.verificationRepo.save(record);

      return { math: { success: false, message: error.message } };
    } finally {
      await this.cleanup(packagePath);
    }
  }

  async generateProposalCalldata(
    ipfsCID: string,
    projectId: string,
    registryAddress: string,
    constructorArgs?: string[],
  ): Promise<{
    target: string;
    calldata: string;
    expectedAddress: string;
    salt: string;
  }> {
    let packagePath: string | undefined;

    try {
      this.logger.debug(`Generating calldata for CID: ${ipfsCID}`);
      const pkg = await this.ipfsService.fetchPackage(ipfsCID);
      packagePath = pkg.path;
      // Use resolved CID to ensure salt consistency
      const resolvedCID = pkg.cid;

      const artifactPath = this.findArtifact(packagePath);
      const artifactContent = fs.readFileSync(artifactPath, 'utf8');
      const artifact = JSON.parse(artifactContent);
      const creationCode = artifact.bytecode || artifact.data?.bytecode?.object;

      if (!creationCode) {
        throw new Error('Bytecode not found in artifact.');
      }

      // Handle constructor arguments if provided
      let fullBytecode: Hex = creationCode as Hex;

      if (constructorArgs && constructorArgs.length > 0) {
        // Get constructor ABI from artifact
        const constructorAbi = artifact.abi?.find(
          (item: { type: string }) => item.type === 'constructor',
        );

        if (constructorAbi && constructorAbi.inputs?.length > 0) {
          // Encode constructor arguments
          const encodedArgs = encodeAbiParameters(
            constructorAbi.inputs,
            constructorArgs,
          );

          // Append encoded args to bytecode (remove 0x prefix from args)
          fullBytecode = `${creationCode}${encodedArgs.substring(2)}` as Hex;

          this.logger.debug(
            `Constructor args encoded: ${constructorArgs.length} arguments`,
          );
        } else {
          this.logger.warn(
            'Constructor args provided but no constructor found in ABI',
          );
        }
      }

      const salt = keccak256(toBytes(resolvedCID));

      const expectedAddress = getCreate2Address({
        from: registryAddress as Hex,
        salt: salt,
        bytecode: fullBytecode,
      });

      // Encode the deployDeterministicAndUpgrade call
      const calldata = encodeFunctionData({
        abi: [
          {
            type: 'function',
            name: 'deployDeterministicAndUpgrade',
            inputs: [
              { name: 'projectId', type: 'bytes32' },
              { name: 'salt', type: 'bytes32' },
              { name: 'bytecode', type: 'bytes' },
              { name: 'expectedAddress', type: 'address' },
            ],
          },
        ],
        functionName: 'deployDeterministicAndUpgrade',
        args: [projectId as Hex, salt, fullBytecode, expectedAddress],
      });

      return {
        target: registryAddress,
        calldata,
        expectedAddress,
        salt,
      };
    } finally {
      await this.cleanup(packagePath);
    }
  }

  async runBasicTests(
    proposalId: string,
    ipfsCID: string,
  ): Promise<Pick<VerificationResult, 'tests'>> {
    const record = await this.getRecord(proposalId);

    if (record.basicStatus === 'success') {
      return {
        tests: {
          basic: {
            success: true,
            message: record.basicMessage || 'Cached result',
          },
          custom: { success: false, message: 'Not run' },
        },
      };
    }

    let packagePath: string | undefined;
    let imageName: string | undefined;

    // Mark as pending immediately
    record.basicStatus = 'pending';
    record.basicMessage = 'Running package tests...';
    await this.verificationRepo.save(record);

    try {
      this.logger.debug(`[${proposalId}] Running Basic Tests...`);
      const pkg = await this.ipfsService.fetchPackage(ipfsCID);
      packagePath = pkg.path;
      imageName = `sovereign-verify-${proposalId}`;

      await this.buildDockerImage(packagePath, imageName);
      await this.runStandardTests(imageName, proposalId);

      const successMessage = 'Standard simulation passed.';
      record.basicStatus = 'success';
      record.basicMessage = successMessage;
      await this.verificationRepo.save(record);

      return {
        tests: {
          basic: { success: true, message: successMessage },
          custom: { success: false, message: 'Not run' },
        },
      };
    } catch (e: any) {
      this.logger.warn(`[${proposalId}] Basic Tests Failed: ${e.message}`);
      if (e.stderr) this.logger.debug(`Docker stderr: ${e.stderr}`);

      const errorMessage = e.stderr
        ? `${e.stderr.slice(0, 200)}...`
        : e.message;

      record.basicStatus = 'failure';
      record.basicMessage = errorMessage;
      await this.verificationRepo.save(record);

      return {
        tests: {
          basic: { success: false, message: errorMessage },
          custom: { success: false, message: 'Skipped due to basic failure' },
        },
      };
    } finally {
      await this.cleanup(packagePath, imageName);
    }
  }

  async runCustomTests(
    proposalId: string,
    ipfsCID: string,
  ): Promise<Pick<VerificationResult, 'tests'>> {
    const record = await this.getRecord(proposalId);

    if (record.customStatus === 'success') {
      return {
        tests: {
          basic: { success: true, message: 'Skipped' },
          custom: {
            success: true,
            message: record.customMessage || 'Cached result',
          },
        },
      };
    }

    let packagePath: string | undefined;
    let imageName: string | undefined;

    // Mark as pending immediately
    record.customStatus = 'pending';
    record.customMessage = 'Running sovereign test suite...';
    await this.verificationRepo.save(record);

    try {
      this.logger.debug(`[${proposalId}] Running Custom Tests...`);
      const pkg = await this.ipfsService.fetchPackage(ipfsCID);
      packagePath = pkg.path;
      imageName = `sovereign-verify-${proposalId}`;

      await this.buildDockerImage(packagePath, imageName);

      const testResult = await this.runPrivateVerificationTests(
        imageName,
        proposalId,
      );

      const successMessage = testResult.skipped
        ? testResult.message
        : 'Sovereign test suite passed.';

      record.customStatus = 'success';
      record.customMessage = successMessage;
      await this.verificationRepo.save(record);

      return {
        tests: {
          basic: { success: true, message: 'Skipped' },
          custom: { success: true, message: successMessage },
        },
      };
    } catch (e: any) {
      this.logger.warn(`[${proposalId}] Custom Tests Failed: ${e.message}`);
      if (e.stderr) this.logger.debug(`Docker stderr: ${e.stderr}`);

      const errorMessage = e.stderr
        ? `${e.stderr.slice(0, 200)}...`
        : e.message;

      record.customStatus = 'failure';
      record.customMessage = errorMessage;
      await this.verificationRepo.save(record);

      return {
        tests: {
          basic: { success: true, message: 'Skipped' },
          custom: { success: false, message: errorMessage },
        },
      };
    } finally {
      await this.cleanup(packagePath, imageName);
    }
  }

  // ---- HELPER METHODS ----

  private verifyMath(
    packagePath: string,
    cid: string,
    onChainTarget: string,
    dynamicRegistryAddress: string,
    projectId: string,
  ) {
    const registryAddress = dynamicRegistryAddress as Hex;

    if (!registryAddress) {
      throw new Error('DEPLOYMENT_REGISTRY_ADDRESS not configured');
    }

    const configPath = path.join(packagePath, 'deployment-config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('deployment-config.json not found in package');
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const contracts: ContractConfig[] = config.contracts || [];

    const projectIdBytes = projectId as Hex;

    const deployedNames: string[] = [];
    const deployedAddresses: Hex[] = [];

    this.logger.debug(`Calculating addresses for Project ID: ${projectId}`);

    for (const contract of contracts) {
      const artifactPath = path.join(
        packagePath,
        'artifacts',
        'contracts',
        `${contract.name}.sol`,
        `${contract.name}.json`,
      );

      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact not found for contract: ${contract.name}`);
      }

      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

      let bytecode = artifact.bytecode as Hex;
      if (contract.constructorArgs?.length && contract.constructorTypes) {
        const encoded = encodeAbiParameters(
          parseAbiParameters(contract.constructorTypes),
          contract.constructorArgs,
        );
        bytecode = `${bytecode}${encoded.slice(2)}` as Hex;
      }

      const bytecodeHash = keccak256(bytecode);
      const contractSalt = keccak256(
        toBytes(`${cid}.${contract.name}.${bytecodeHash}`),
      );

      const address = getCreate2Address({
        from: registryAddress,
        salt: contractSalt,
        bytecode,
      });

      deployedNames.push(contract.name);
      deployedAddresses.push(address);
    }

    // Compute VersionManifest address
    const manifestArtifactPath = path.join(
      packagePath,
      'artifacts',
      'contracts',
      'VersionManifest.sol',
      'VersionManifest.json',
    );

    if (!fs.existsSync(manifestArtifactPath)) {
      throw new Error('VersionManifest artifact not found');
    }

    const manifestArtifact = JSON.parse(
      fs.readFileSync(manifestArtifactPath, 'utf8'),
    );

    const manifestArgs = encodeAbiParameters(
      parseAbiParameters('bytes32,string,string[],address[]'),
      [projectIdBytes, cid, deployedNames, deployedAddresses],
    );

    const manifestBytecode =
      `${manifestArtifact.bytecode}${manifestArgs.slice(2)}` as Hex;
    const manifestSalt = keccak256(toBytes(`${cid}.VersionManifest`));

    const manifestAddress = getCreate2Address({
      from: registryAddress,
      salt: manifestSalt,
      bytecode: manifestBytecode,
    });

    this.logger.debug(
      `Computed Manifest Address: ${manifestAddress}, Target: ${onChainTarget}`,
    );

    if (manifestAddress.toLowerCase() !== onChainTarget.toLowerCase()) {
      throw new MathMismatchError(
        `Critical Mismatch! Computed: ${manifestAddress}, On-Chain: ${onChainTarget}.`,
      );
    }
  }

  private async buildDockerImage(pkgPath: string, imageName: string) {
    this.logger.debug(`🐳 Building Base Image: ${imageName}`);

    const dockerfile = path.join(pkgPath, 'Dockerfile');
    if (!fs.existsSync(dockerfile)) {
      throw new Error('Dockerfile not found in package root.');
    }

    try {
      fs.appendFileSync(
        dockerfile,
        `
# 🩹 Hotfix: Install Git (Required for forge-std) & Build Tools
RUN apk add --no-cache git python3 make g++

# 🩹 Hotfix: Enable hoisting & Reinstall
RUN echo "shamefully-hoist=true" >> .npmrc
RUN rm -rf node_modules pnpm-lock.yaml
RUN pnpm install

# CHANGE: Install Viem plugins instead of Toolbox/Ethers
RUN pnpm add -D hardhat @nomicfoundation/hardhat-viem @nomicfoundation/hardhat-ignition-viem @nomicfoundation/hardhat-network-helpers viem ts-node typescript tsx @types/mocha @types/chai mocha chai --config.ignore-workspace-root-check=true

# PRE-DOWNLOAD: Compile contracts during build to cache the Solidity compiler
RUN pnpm exec hardhat compile || true
`,
      );
    } catch (e) {
      console.error('Failed to patch Dockerfile:', e);
      this.logger.warn('Failed to patch Dockerfile, build might fail.');
    }

    await execAsync(`docker build -t ${imageName} .`, { cwd: pkgPath });
  }

  private async runStandardTests(imageName: string, proposalId: string) {
    this.logger.debug(`🧪 Running 'pnpm test' inside Container...`);
    const { promise, process } = execWithCancel(
      `docker run --rm --network none ${imageName} pnpm test`,
    );

    const key = `${proposalId}-basic`;
    runningProcesses.set(key, { process, type: 'basic' });

    try {
      await promise;
    } finally {
      runningProcesses.delete(key);
    }
  }

  private async runPrivateVerificationTests(
    imageName: string,
    proposalId: string,
  ): Promise<{ skipped: boolean; message: string }> {
    const privateTestPath = this.config.get<string>('PRIVATE_TEST_DIR');

    if (!privateTestPath || !fs.existsSync(privateTestPath)) {
      return { skipped: true, message: 'No local custom tests configured.' };
    }

    const files = fs.readdirSync(privateTestPath);
    const hasTests = files.some((f) => f.endsWith('.js') || f.endsWith('.ts'));

    if (!hasTests) {
      return {
        skipped: true,
        message: 'No custom tests found in suite. Passed by default.',
      };
    }

    // Prepare Configs
    const tsconfigPath = path.join(privateTestPath, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify(
          {
            compilerOptions: {
              module: 'esnext',
              target: 'es2020',
              moduleResolution: 'node',
              esModuleInterop: true,
              skipLibCheck: true,
              resolveJsonModule: true,
            },
          },
          null,
          2,
        ),
      );
    }

    // Generate ESM config (v3)
    const configPath = path.join(privateTestPath, 'hardhat.verify.config.js');
    const configContent = `
import hardhatViem from "@nomicfoundation/hardhat-viem";
import hardhatIgnition from "@nomicfoundation/hardhat-ignition-viem";

const config = {
  solidity: "0.8.28",
  plugins: [hardhatViem, hardhatIgnition],
  paths: {
    tests: "./sovereign-test",
  }
};

export default config;
    `;
    fs.writeFileSync(configPath, configContent);

    // Build Child Image
    const testImageName = `${imageName}-custom`;
    const dockerfileContent = `
      FROM ${imageName}
      WORKDIR /app
      RUN mkdir -p sovereign-test
      COPY . /app/sovereign-test/
    `;

    const tempDockerfilePath = path.join(privateTestPath, 'Dockerfile.custom');
    fs.writeFileSync(tempDockerfilePath, dockerfileContent);

    try {
      this.logger.debug(`🐳 Building Custom Test Image: ${testImageName}`);
      await execAsync(
        `docker build -t ${testImageName} -f Dockerfile.custom .`,
        {
          cwd: privateTestPath,
        },
      );

      this.logger.debug(`🧪 Running Verification Suite...`);

      // Run with 'tsx --test' directly via Node runner
      const { promise, process } = execWithCancel(
        `docker run --rm \
        --network none \
        -e HARDHAT_CONFIG='/app/sovereign-test/hardhat.verify.config.js' \
        ${testImageName} \
        /bin/sh -c "pnpm exec tsx --test sovereign-test/*.ts"`,
      );

      const key = `${proposalId}-custom`;
      runningProcesses.set(key, { process, type: 'custom' });

      try {
        await promise;
      } finally {
        runningProcesses.delete(key);
      }

      // Clean success, no need to log stdout unless verbose debug is needed
      await execAsync(`docker rmi ${testImageName}`).catch(() => {});

      return { skipped: false, message: 'Sovereign test suite passed.' };
    } catch (e: any) {
      this.logger.error(
        `Custom Tests Failed. Error: ${e.stderr || e.stdout || e.message}`,
      );

      await execAsync(`docker rmi ${testImageName}`).catch(() => {});

      const cleanError = e.stderr
        ? // eslint-disable-next-line no-control-regex
          e.stderr.replace(/\x1B\[[0-9;]*[mK]/g, '').trim()
        : e.message;

      throw new TestFailureError(
        `Tests failed: ${cleanError.slice(0, 300)}...`,
      );
    } finally {
      if (fs.existsSync(tempDockerfilePath)) {
        fs.rmSync(tempDockerfilePath);
      }
    }
  }

  private findArtifact(basePath: string): string {
    // The contract being proposed is ALWAYS VersionManifest
    // VersionManifest is the single implementation the governance Beacon points to
    const manifestPath = path.join(
      basePath,
      'artifacts',
      'contracts',
      'VersionManifest.sol',
      'VersionManifest.json',
    );

    if (fs.existsSync(manifestPath)) {
      this.logger.debug(
        'Found VersionManifest artifact (standard governance pattern)',
      );
      return manifestPath;
    }

    // Fallback for legacy projects without VersionManifest pattern
    // Try to read contract name from proposal-metadata.json
    const metadataPath = path.join(basePath, 'proposal-metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        if (metadata.contractName) {
          const directPath = path.join(
            basePath,
            'artifacts',
            'contracts',
            `${metadata.contractName}.sol`,
            `${metadata.contractName}.json`,
          );
          if (fs.existsSync(directPath)) {
            this.logger.debug(
              `Found artifact from metadata: ${metadata.contractName}`,
            );
            return directPath;
          }
        }
      } catch (e) {
        this.logger.warn(
          'Failed to read proposal-metadata.json, falling back to search',
        );
      }
    }

    // Final fallback: search for first artifact (legacy behavior)
    const searchPath = path.join(basePath, 'artifacts', 'contracts');
    if (!fs.existsSync(searchPath)) {
      throw new Error(
        `Artifacts folder not found at ${searchPath}. Ensure 'npx hardhat compile' ran before packaging.`,
      );
    }

    const findJsonFile = (dir: string): string | null => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const result = findJsonFile(fullPath);
          if (result) return result;
        } else if (file.endsWith('.json') && !file.endsWith('.dbg.json')) {
          return fullPath;
        }
      }
      return null;
    };

    const artifactFile = findJsonFile(searchPath);
    if (!artifactFile) {
      throw new Error('No valid contract artifact found in package.');
    }

    this.logger.warn(
      `No VersionManifest found, using fallback artifact: ${artifactFile}`,
    );
    return artifactFile;
  }

  private async cleanup(packagePath?: string, imageName?: string) {
    if (imageName) {
      await execAsync(`docker rmi -f ${imageName}`).catch(() => {});
    }
    if (packagePath && fs.existsSync(packagePath)) {
      try {
        fs.rmSync(packagePath, { recursive: true, force: true });
      } catch (e) {
        console.error('Failed to cleanup package path:', e);
      }
    }
  }
}
