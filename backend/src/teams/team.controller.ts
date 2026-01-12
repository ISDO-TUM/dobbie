import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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

  @Post('prepare')
  async prepareInfrastructure(
    @Body() body: { token: string; name: string; members: string[] },
  ) {
    return this.teamService.prepareInfrastructure(body);
  }

  @Get('artifacts')
  getArtifacts() {
    return this.deploymentService.getAllArtifacts();
  }

  @Post('register')
  async register(@Body() dto: CreateTeamDto) {
    return this.teamService.registerTeam({
      name: dto.name,
      governorAddress: dto.governorAddress,
      registryAddress: dto.registryAddress,
      repoUrl: dto.repoUrl,
      deploymentBlock: dto.deploymentBlock,
      isImport: dto.isImport,
    });
  }

  @Get()
  findAll(@Query('includeArchived') includeArchived?: string) {
    return this.teamService.findAll(includeArchived === 'true');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const team = await this.teamService.findOne(+id);
    if (!team) throw new NotFoundException(`Team #${id} not found`);
    return team;
  }

  @Patch(':id/archive')
  async archive(@Param('id') id: string) {
    return this.teamService.archiveTeam(+id);
  }

  @Patch(':id/unarchive')
  async unarchive(@Param('id') id: string) {
    return this.teamService.unarchiveTeam(+id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.teamService.deleteTeam(+id);
  }
}
