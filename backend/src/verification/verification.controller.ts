import { Controller, Post, Param, Body, Logger, Get } from '@nestjs/common';
import { VerificationService } from './verification.service';

interface VerificationRequestDto {
  targetAddress: string;
  ipfsCID: string;
  governorAddress: string;
  projectId: string;
}

interface CancelRequestDto {
  type: 'basic' | 'custom';
}

interface GenerateCalldataDto {
  ipfsCID: string;
  projectId: string;
  registryAddress: string;
  constructorArgs?: string[]; // Optional constructor arguments for the contract
}

@Controller('proposals')
export class VerificationController {
  private readonly logger = new Logger(VerificationController.name);

  constructor(private readonly verificationService: VerificationService) {}

  // --- INTEGRITY CHECK (Math Check) ---
  @Post(':id/check/integrity')
  async runIntegrityCheck(
    @Param('id') proposalId: string,
    @Body() body: VerificationRequestDto,
  ) {
    this.logger.log(`🕵️‍♂️ Checksum check started for #${proposalId}`);

    const result = await this.verificationService.runMathCheck(
      proposalId,
      body.targetAddress,
      body.ipfsCID,
      body.governorAddress,
      body.projectId,
    );

    return {
      status: 'complete',
      step: 'math',
      result: result.math,
    };
  }

  // --- BASIC SIMULATION (Standard Tests) ---
  @Post(':id/check/basic')
  async runBasicTests(
    @Param('id') proposalId: string,
    @Body() body: VerificationRequestDto,
  ) {
    this.logger.log(`🧪 Basic simulation started for #${proposalId}`);

    const result = await this.verificationService.runBasicTests(
      proposalId,
      body.ipfsCID,
    );

    return {
      status: 'complete',
      step: 'basic',
      result: result.tests.basic,
    };
  }

  // --- CUSTOM TEST SUITE (Private Tests) ---
  @Post(':id/check/custom')
  async runCustomTests(
    @Param('id') proposalId: string,
    @Body() body: VerificationRequestDto,
  ) {
    this.logger.log(`🔬 Custom test suite started for #${proposalId}`);

    const result = await this.verificationService.runCustomTests(
      proposalId,
      body.ipfsCID,
    );

    return {
      status: 'complete',
      step: 'custom',
      result: result.tests.custom,
    };
  }

  @Get(':id/status')
  async getStatus(@Param('id') proposalId: string) {
    return await this.verificationService.getVerificationStatus(proposalId);
  }

  @Post(':id/cancel')
  async cancelTests(
    @Param('id') proposalId: string,
    @Body() body: CancelRequestDto,
  ) {
    this.logger.log(`🛑 Cancelling ${body.type} tests for #${proposalId}`);
    return await this.verificationService.cancelTests(proposalId, body.type);
  }

  // --- GENERATE PROPOSAL CALLDATA ---
  @Post('generate-calldata')
  async generateCalldata(@Body() body: GenerateCalldataDto) {
    this.logger.log(
      `📦 Generating calldata for CID: ${body.ipfsCID}, Project: ${body.projectId}`,
    );

    const result = await this.verificationService.generateProposalCalldata(
      body.ipfsCID,
      body.projectId,
      body.registryAddress,
      body.constructorArgs,
    );

    return {
      status: 'success',
      ...result,
    };
  }
}
