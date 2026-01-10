import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { Team } from './entities/team.entity';
import { GithubModule } from '../github/github.module';
import { DeploymentModule } from '../deployment/deployment.module';

@Module({
  imports: [TypeOrmModule.forFeature([Team]), GithubModule, DeploymentModule],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
