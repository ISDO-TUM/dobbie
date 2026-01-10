import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  // The main DevOpsGovernor contract address
  @Column({ length: 42, unique: true })
  governorAddress: string;

  // The DeploymentRegistry contract address
  @Column({ length: 42 })
  registryAddress: string;

  @Column({ nullable: true })
  repoUrl: string;

  @Column({ nullable: true })
  isGithubConfigured: boolean;

  @Column({ type: 'int', nullable: true })
  deploymentBlock: number;
}
