import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { DeploymentService } from '../deployment/deployment.service';
import { CreateTeamDto } from './dto/create-team.dto';

@Controller('teams')
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly deploymentService: DeploymentService,
  ) {}

  // --- Step 1: Prepare GitHub (Only used during Creation) ---
  @Post('prepare')
  async prepareInfrastructure(
    @Body() body: { token: string; name: string; members: string[] },
  ) {
    return this.teamService.prepareInfrastructure(body);
  }

  // --- Step 2: Get Contract Blueprints ---
  @Get('artifacts')
  getArtifacts() {
    return this.deploymentService.getAllArtifacts();
  }

  // --- Step 3: Register/Join Team ---
  // This handles BOTH "Creating New" and "Joining Existing"
  @Post('register')
  async register(@Body() dto: CreateTeamDto) {
    return this.teamService.registerTeam({
      name: dto.name,
      governorAddress: dto.governorAddress,
      registryAddress: dto.registryAddress,
      repoUrl: dto.repoUrl,
      deploymentBlock: dto.deploymentBlock, // ✅ Pass it through
      isImport: dto.isImport,
    });
  }

  // --- Standard Read Operations ---
  @Get()
  findAll() {
    return this.teamService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const team = await this.teamService.findOne(+id);
    if (!team) throw new NotFoundException(`Team #${id} not found`);
    return team;
  }
}
