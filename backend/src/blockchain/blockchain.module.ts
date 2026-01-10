import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { IpfsModule } from 'src/ipfs/ipfs.module';

@Module({
  imports: [IpfsModule],
  providers: [BlockchainService],
})
export class BlockchainModule {}
