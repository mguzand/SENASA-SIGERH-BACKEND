import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDigitalSignatureRequests1794960000000 implements MigrationInterface {
  name = 'AddDigitalSignatureRequests1794960000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "digital_signature_requests" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employee_id" uuid NOT NULL,
      "identity" varchar(13) NOT NULL, "full_name" varchar(220) NOT NULL,
      "email" varchar(150) NOT NULL, "phone" varchar(30) NOT NULL,
      "identity_front_path" text NOT NULL, "identity_front_mime_type" varchar(80) NOT NULL,
      "identity_back_path" text NOT NULL, "identity_back_mime_type" varchar(80) NOT NULL,
      "selfie_path" text NOT NULL, "selfie_mime_type" varchar(80) NOT NULL,
      "status" varchar(20) NOT NULL DEFAULT 'PENDING', "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_digital_signature_requests" PRIMARY KEY ("id"),
      CONSTRAINT "FK_digital_signature_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_digital_signature_identity_created" ON "digital_signature_requests" ("identity", "created_at")`);
  }
  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.query(`DROP TABLE "digital_signature_requests"`); }
}
