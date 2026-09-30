import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeaveClassificationHistory1790899200000
  implements MigrationInterface
{
  name = 'AddLeaveClassificationHistory1790899200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "classification_history" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "classification_history"`,
    );
  }
}
