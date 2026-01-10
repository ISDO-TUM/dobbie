import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DeploymentService {
  private readonly logger = new Logger(DeploymentService.name);

  private readonly ARTIFACTS_ROOT = path.join(
    __dirname,
    '../../artifacts/contracts',
  );

  getTimelockArtifacts() {
    return this.loadArtifact(
      path.join(
        this.ARTIFACTS_ROOT,
        'CustomTimelockController.sol',
        'CustomTimelockController.json',
      ),
      'CustomTimelockController',
    );
  }

  getGovernorArtifacts() {
    return this.loadArtifact(
      path.join(
        this.ARTIFACTS_ROOT,
        'DevOpsGovernor.sol',
        'DevOpsGovernor.json',
      ),
      'DevOpsGovernor',
    );
  }

  getRegistryArtifacts() {
    return this.loadArtifact(
      path.join(
        this.ARTIFACTS_ROOT,
        'DeploymentRegistry.sol',
        'DeploymentRegistry.json',
      ),
      'DeploymentRegistry',
    );
  }

  getFactoryArtifacts() {
    return this.loadArtifact(
      path.join(
        this.ARTIFACTS_ROOT,
        'GovernanceFactory.sol',
        'GovernanceFactory.json',
      ),
      'GovernanceFactory',
    );
  }

  getAllArtifacts() {
    return {
      timelock: this.getTimelockArtifacts(),
      governor: this.getGovernorArtifacts(),
      registry: this.getRegistryArtifacts(),
      factory: this.getFactoryArtifacts(),
    };
  }

  private loadArtifact(filePath: string, name: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(content);
      return {
        abi: json.abi,
        bytecode: json.bytecode,
        name: name,
      };
    } catch (error) {
      this.logger.error(`Could not load artifact at ${filePath}`, error);
      throw new InternalServerErrorException(
        `Artifact not found: ${name}. Did you run 'npx hardhat compile'?`,
      );
    }
  }
}
