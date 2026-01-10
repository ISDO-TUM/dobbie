import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { GithubService } from '../github/github.service';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    private githubService: GithubService,
  ) {}

  /**
   * Step 1: Prepare Infrastructure
   * Creates the GitHub Repo and invites members.
   */
  async prepareInfrastructure(dto: {
    token: string;
    name: string;
    members: string[];
  }) {
    // 1. Create the Repo
    // Sanitize repo name (replace spaces with hyphens)
    const repoName = dto.name.toLowerCase().replace(/\s+/g, '-');
    const description = `Sovereign DevOps Governance for ${dto.name}`;

    const repoDetails = await this.githubService.createSovereignRepo(
      dto.token,
      repoName,
      description,
    );

    // 2. Add Members
    const inviteResults = await this.githubService.addCollaborators(
      dto.token,
      repoDetails.owner,
      repoDetails.name,
      dto.members,
    );

    return {
      repoUrl: repoDetails.repoUrl,
      owner: repoDetails.owner,
      repoName: repoDetails.name,
      invites: inviteResults,
    };
  }

  /**
   * Step 2: Final Registration
   * Saves the fully deployed team to the DB.
   */
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
      // If it's an import, just return the existing team (idempotent)
      return existing;
    }

    const team = this.teamsRepository.create({
      name: dto.name,
      governorAddress: dto.governorAddress,
      registryAddress: dto.registryAddress,
      repoUrl: dto.repoUrl,
      deploymentBlock: dto.deploymentBlock, // ✅ Explicitly include this
      isGithubConfigured: !!dto.repoUrl,
    });

    return this.teamsRepository.save(team);
  }

  async findAll() {
    return this.teamsRepository.find();
  }

  async findOne(id: number) {
    return this.teamsRepository.findOne({ where: { id } });
  }
}
