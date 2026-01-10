import { Team } from 'src/teams/entities/team.entity';
import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('proposal_verifications')
export class ProposalVerification {
  @PrimaryColumn()
  proposalId: string;

  // INTEGRITY CHECK (Math Check)
  @Column({ nullable: true })
  integrityStatus: 'pending' | 'success' | 'failure';

  @Column({ type: 'text', nullable: true })
  integrityMessage: string;

  // BASIC TESTS
  @Column({ nullable: true })
  basicStatus: 'pending' | 'success' | 'failure';

  @Column({ type: 'text', nullable: true })
  basicMessage: string;

  // CUSTOM TESTS
  @Column({ nullable: true })
  customStatus: 'pending' | 'success' | 'failure';

  @Column({ type: 'text', nullable: true })
  customMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Team, { eager: true })
  @JoinColumn({ name: 'teamId' })
  team: Team;

  @Column({ nullable: true })
  teamId: number;
}
