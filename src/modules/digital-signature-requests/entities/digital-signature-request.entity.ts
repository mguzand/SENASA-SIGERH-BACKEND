import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('digital_signature_requests')
export class DigitalSignatureRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'employee_id', type: 'uuid' }) employeeId: string;
  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' }) employee: Employee;
  @Column({ type: 'varchar', length: 13 }) identity: string;
  @Column({ name: 'full_name', type: 'varchar', length: 220 }) fullName: string;
  @Column({ type: 'varchar', length: 150 }) email: string;
  @Column({ type: 'varchar', length: 30 }) phone: string;
  @Column({ name: 'functional_position', type: 'varchar', length: 180, nullable: true }) functionalPosition: string | null;
  @Column({ name: 'identity_front_path', type: 'text' }) identityFrontPath: string;
  @Column({ name: 'identity_front_mime_type', type: 'varchar', length: 80 }) identityFrontMimeType: string;
  @Column({ name: 'identity_back_path', type: 'text' }) identityBackPath: string;
  @Column({ name: 'identity_back_mime_type', type: 'varchar', length: 80 }) identityBackMimeType: string;
  @Column({ name: 'selfie_path', type: 'text' }) selfiePath: string;
  @Column({ name: 'selfie_mime_type', type: 'varchar', length: 80 }) selfieMimeType: string;
  @Column({ type: 'varchar', length: 20, default: 'PENDING' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
