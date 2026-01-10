import {
  IsNotEmpty,
  IsString,
  IsEthereumAddress,
  IsOptional,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEthereumAddress()
  @IsNotEmpty()
  governorAddress: string;

  @IsEthereumAddress()
  @IsNotEmpty()
  registryAddress: string;

  @IsOptional()
  @IsString()
  repoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isImport?: boolean;

  @IsOptional()
  @IsNumber()
  deploymentBlock?: number;
}
