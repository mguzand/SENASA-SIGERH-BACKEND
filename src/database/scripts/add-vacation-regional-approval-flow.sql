BEGIN;

ALTER TABLE public.vacation_requests
  ADD COLUMN IF NOT EXISTS regional_manager_employee_id uuid NULL,
  ADD COLUMN IF NOT EXISTS regional_status varchar(20) NULL,
  ADD COLUMN IF NOT EXISTS regional_observation text NULL,
  ADD COLUMN IF NOT EXISTS regional_reviewed_at timestamp NULL,
  ADD COLUMN IF NOT EXISTS area_manager_employee_id uuid NULL,
  ADD COLUMN IF NOT EXISTS liaison_regional_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_vacation_requests_liaison_regional
  ON public.vacation_requests (liaison_regional_id, liaison_status, stage);

UPDATE public.vacation_requests
SET liaison_regional_id = regional_id
WHERE liaison_review_required = true
  AND liaison_regional_id IS NULL;

COMMIT;
