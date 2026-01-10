import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainService {
  public provider: ethers.JsonRpcProvider;

  constructor(private configService: ConfigService) {
    this.provider = new ethers.JsonRpcProvider(
      this.configService.get<string>('RPC_URL'),
    );
  }

  getContract(address: string, abi: any) {
    return new ethers.Contract(address, abi, this.provider);
  }
}
