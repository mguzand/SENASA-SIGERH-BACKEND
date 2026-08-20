import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LeaveRequest } from './leave-request.entity';

@Entity('leave_request_documents')
export class LeaveRequestDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'leave_request_id', type: 'uuid' }) leaveRequestId: string;
  @ManyToOne(() => LeaveRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leave_request_id' }) leaveRequest: LeaveRequest;
  @Column({ type: 'varchar', length: 40 }) code: string;
  @Column({ name: 'original_name', type: 'varchar', length: 180 }) originalName: string;
  @Column({ name: 'mime_type', type: 'varchar', length: 100 }) mimeType: string;
  @Column({ name: 'file_path', type: 'text' }) filePath: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
