ALTER TABLE public.regional_managers
ADD COLUMN IF NOT EXISTS role varchar(30) NOT NULL DEFAULT 'regional_manager';

ALTER TABLE public.regional_managers
ADD COLUMN IF NOT EXISTS can_review_vacations boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_review_exit_permits boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_review_leaves boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_regional_managers_role_active
ON public.regional_managers (role, is_active, regional_id);

ALTER TABLE public.vacation_requests
ADD COLUMN IF NOT EXISTS liaison_review_required boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS liaison_employee_id uuid NULL,
ADD COLUMN IF NOT EXISTS liaison_status varchar(20) NULL,
ADD COLUMN IF NOT EXISTS liaison_observation text NULL,
ADD COLUMN IF NOT EXISTS liaison_reviewed_at timestamp NULL;

ALTER TABLE public.employee_exit_permits
ADD COLUMN IF NOT EXISTS liaison_review_required boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS liaison_employee_id uuid NULL,
ADD COLUMN IF NOT EXISTS liaison_status varchar(20) NULL,
ADD COLUMN IF NOT EXISTS liaison_observation text NULL,
ADD COLUMN IF NOT EXISTS liaison_reviewed_at timestamp NULL;

ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS liaison_review_required boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS liaison_employee_id uuid NULL,
ADD COLUMN IF NOT EXISTS liaison_status varchar(20) NULL,
ADD COLUMN IF NOT EXISTS liaison_observation text NULL,
ADD COLUMN IF NOT EXISTS liaison_reviewed_at timestamp NULL;
