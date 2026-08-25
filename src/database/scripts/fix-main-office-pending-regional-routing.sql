-- Corrige solicitudes pendientes de empleados de la sede principal que fueron
-- clasificadas como REGIONAL aunque existe un jefe/delegado activo en su unidad
-- o en una unidad superior. No toca solicitudes ya revisadas.

BEGIN;

CREATE TEMP TABLE main_office_pending_routing_fix
ON COMMIT DROP
AS
WITH requests AS (
  SELECT
    'EXIT_PERMIT'::text AS request_type,
    permit.id AS request_id,
    permit.employee_id,
    active_job.area_id
  FROM public.employee_exit_permits AS permit
  INNER JOIN public.employees AS employee ON employee.id = permit.employee_id
  INNER JOIN LATERAL (
    SELECT job.area_id
    FROM public.employee_job_records AS job
    WHERE job.employee_id = permit.employee_id
      AND LOWER(job.status) = 'active'
      AND job.area_id IS NOT NULL
    ORDER BY job.is_current DESC, job.start_date DESC, job.created_at DESC
    LIMIT 1
  ) AS active_job ON true
  INNER JOIN public.regionals AS regional
    ON regional.id = employee.regional_id
   AND regional.is_main_office = true
   AND regional.is_active = true
  WHERE permit.stage = 'boss_review'
    AND permit.status = 'pending'
    AND permit.boss_status = 'pending'
    AND permit.boss_reviewed_at IS NULL
    AND permit.approval_scope = 'REGIONAL'

  UNION ALL

  SELECT
    'VACATION'::text,
    request.id,
    request.employee_id,
    active_job.area_id
  FROM public.vacation_requests AS request
  INNER JOIN public.employees AS employee ON employee.id = request.employee_id
  INNER JOIN LATERAL (
    SELECT job.area_id
    FROM public.employee_job_records AS job
    WHERE job.employee_id = request.employee_id
      AND LOWER(job.status) = 'active'
      AND job.area_id IS NOT NULL
    ORDER BY job.is_current DESC, job.start_date DESC, job.created_at DESC
    LIMIT 1
  ) AS active_job ON true
  INNER JOIN public.regionals AS regional
    ON regional.id = employee.regional_id
   AND regional.is_main_office = true
   AND regional.is_active = true
  WHERE request.stage = 'BOSS_REVIEW'
    AND request.status = 'PENDING'
    AND request.boss_status = 'PENDING'
    AND request.boss_reviewed_at IS NULL
    AND request.approval_scope = 'REGIONAL'
)
SELECT
  request.request_type,
  request.request_id,
  request.employee_id,
  request.area_id,
  approver.employee_id AS new_boss_employee_id,
  approver.area_id AS approver_area_id
FROM requests AS request
INNER JOIN LATERAL (
  WITH RECURSIVE hierarchy AS (
    SELECT unit.id, unit.parent_id, 0 AS depth
    FROM public.organizational_units AS unit
    WHERE unit.id = request.area_id
      AND unit.is_active = true

    UNION ALL

    SELECT parent.id, parent.parent_id, hierarchy.depth + 1
    FROM public.organizational_units AS parent
    INNER JOIN hierarchy ON hierarchy.parent_id = parent.id
    WHERE parent.is_active = true
  )
  SELECT manager.employee_id, manager.area_id
  FROM hierarchy
  INNER JOIN public.area_managers AS manager
    ON manager.area_id = hierarchy.id
   AND manager.role = 'boss'
   AND manager.is_active = true
   AND manager.employee_id <> request.employee_id
  ORDER BY hierarchy.depth ASC, manager.created_at DESC
  LIMIT 1
) AS approver ON true;

-- Vista previa de los registros que se corregirán.
SELECT
  fix.request_type,
  fix.request_id,
  employee.first_name,
  employee.last_name,
  area.name AS employee_area,
  fix.new_boss_employee_id,
  boss.first_name AS boss_first_name,
  boss.last_name AS boss_last_name,
  boss_area.name AS boss_area
FROM main_office_pending_routing_fix AS fix
INNER JOIN public.employees AS employee ON employee.id = fix.employee_id
INNER JOIN public.organizational_units AS area ON area.id = fix.area_id
INNER JOIN public.employees AS boss ON boss.id = fix.new_boss_employee_id
INNER JOIN public.organizational_units AS boss_area ON boss_area.id = fix.approver_area_id
ORDER BY fix.request_type, area.name, employee.first_name;

WITH updated AS (
  UPDATE public.employee_exit_permits AS permit
  SET area_id = fix.area_id,
      boss_employee_id = fix.new_boss_employee_id,
      approval_scope = 'AREA',
      updated_at = NOW()
  FROM main_office_pending_routing_fix AS fix
  WHERE fix.request_type = 'EXIT_PERMIT'
    AND permit.id = fix.request_id
    AND permit.stage = 'boss_review'
    AND permit.status = 'pending'
    AND permit.boss_status = 'pending'
    AND permit.boss_reviewed_at IS NULL
  RETURNING permit.id
)
SELECT COUNT(*) AS pases_corregidos FROM updated;

WITH updated AS (
  UPDATE public.vacation_requests AS request
  SET area_id = fix.area_id,
      boss_employee_id = fix.new_boss_employee_id,
      approval_scope = 'AREA',
      updated_at = NOW()
  FROM main_office_pending_routing_fix AS fix
  WHERE fix.request_type = 'VACATION'
    AND request.id = fix.request_id
    AND request.stage = 'BOSS_REVIEW'
    AND request.status = 'PENDING'
    AND request.boss_status = 'PENDING'
    AND request.boss_reviewed_at IS NULL
  RETURNING request.id
)
SELECT COUNT(*) AS vacaciones_corregidas FROM updated;

COMMIT;
