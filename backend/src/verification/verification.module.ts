import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { ConfigModule } from '@nestjs/config';
import { IpfsModule } from '../ipfs/ipfs.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProposalVerification } from './entities/verification.entity';
import { TeamModule } from 'src/teams/team.module';
import { Team } from 'src/teams/entities/team.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProposalVerification, Team]),
    ConfigModule,
    IpfsModule,
    BlockchainModule,
    TeamModule,
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
