import * as path from 'path';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BlockchainModule } from './blockchain/blockchain.module';
import { IpfsModule } from './ipfs/ipfs.module';
import { Team } from './teams/entities/team.entity';
import { TeamModule } from './teams/team.module';
import { DeploymentModule } from './deployment/deployment.module';
import { VerificationModule } from './verification/verification.module';
import { ProposalVerification } from './verification/entities/verification.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../.env'),
    }),
    ScheduleModule.forRoot(),

    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'sovereign_db.sqlite',
      entities: [Team, ProposalVerification],
      synchronize: true,
    }),
    BlockchainModule,
    IpfsModule,
    TeamModule,
    DeploymentModule,
    VerificationModule,
  ],
})
export class AppModule {}
