import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Team } from './entities/team.entity';
import { ProposalVerification } from '../verification/entities/verification.entity';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    @InjectRepository(ProposalVerification)
    private verificationRepository: Repository<ProposalVerification>,
  ) {}

  async registerTeam(dto: {
    name: string;
    governorAddress: string;
    registryAddress: string;
    repoUrl?: string;
    deploymentBlock?: number;
    isImport?: boolean;
  }) {
    // Check if team exists to prevent duplicates
    const existing = await this.teamsRepository.findOne({
      where: { governorAddress: dto.governorAddress },
    });

    if (existing) {
      return existing;
    }

    const team = this.teamsRepository.create({
      name: dto.name,
      governorAddress: dto.governorAddress,
      registryAddress: dto.registryAddress,
      repoUrl: dto.repoUrl,
      deploymentBlock: dto.deploymentBlock,
      isGithubConfigured: !!dto.repoUrl,
    });

    return this.teamsRepository.save(team);
  }

  async findAll(includeArchived = false) {
    if (includeArchived) {
      return this.teamsRepository.find();
    }
    return this.teamsRepository.find({
      where: { archivedAt: IsNull() },
    });
  }

  async findOne(id: number) {
    return this.teamsRepository.findOne({ where: { id } });
  }

  async archiveTeam(id: number) {
    const team = await this.teamsRepository.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException(`Team #${id} not found`);
    }
    team.archivedAt = new Date();
    return this.teamsRepository.save(team);
  }

  async unarchiveTeam(id: number) {
    const team = await this.teamsRepository.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException(`Team #${id} not found`);
    }
    team.archivedAt = null;
    return this.teamsRepository.save(team);
  }

  async deleteTeam(id: number) {
    const team = await this.teamsRepository.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException(`Team #${id} not found`);
    }
    // Cascade delete related verifications
    await this.verificationRepository.delete({ teamId: id });
    await this.teamsRepository.remove(team);
    return { success: true, id };
  }
}
