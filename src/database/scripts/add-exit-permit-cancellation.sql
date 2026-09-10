BEGIN;

ALTER TYPE employee_exit_permits_status_enum ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE employee_exit_permits
  ADD COLUMN IF NOT EXISTS cancelled_by_employee_id uuid NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text NULL;

COMMIT;
