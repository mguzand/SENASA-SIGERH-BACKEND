-- Mueve solicitudes que ya estaban en RR. HH. hacia la bandeja de Enlaces de RR. HH.
-- PostgreSQL. Es seguro volver a ejecutarlo: solo toma registros aún no enviados al enlace.

BEGIN;

-- VACACIONES
WITH updated_vacations AS (
  UPDATE public.vacation_requests AS request
  SET liaison_review_required = true,
      liaison_status = 'PENDING',
      liaison_employee_id = NULL,
      liaison_observation = NULL,
      liaison_reviewed_at = NULL,
      updated_at = NOW()
  WHERE request.stage = 'HR_REVIEW'
    AND request.status = 'PENDING'
    AND request.boss_status = 'APPROVED'
    AND request.hr_status = 'PENDING'
    AND request.is_processed = false
    AND request.liaison_review_required = false
    AND request.liaison_reviewed_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.regional_managers AS liaison
      INNER JOIN public.users AS app_user
        ON app_user.employee_id = liaison.employee_id
       AND app_user.is_active = true
      INNER JOIN public.roles_user AS permission
        ON permission.user_id = app_user.id
      INNER JOIN public.components AS component
        ON component.components_id = permission.component_id
       AND component.description = 'Enlace de RRHH'
       AND component.visible = true
      WHERE liaison.regional_id = request.regional_id
        AND liaison.role = 'hr_liaison'
        AND liaison.is_active = true
        AND liaison.can_review_vacations = true
    )
  RETURNING request.id
)
SELECT 'Vacaciones trasladadas' AS resultado, COUNT(*) AS total
FROM updated_vacations;

-- PASES DE SALIDA
WITH updated_exit_permits AS (
  UPDATE public.employee_exit_permits AS permit
  SET liaison_review_required = true,
      liaison_status = 'pending',
      liaison_employee_id = NULL,
      liaison_observation = NULL,
      liaison_reviewed_at = NULL,
      updated_at = NOW()
  WHERE permit.stage = 'hr_review'
    AND permit.status = 'pending'
    AND permit.boss_status = 'approved'
    AND permit.hr_status = 'pending'
    AND permit.liaison_review_required = false
    AND permit.liaison_reviewed_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.regional_managers AS liaison
      INNER JOIN public.users AS app_user
        ON app_user.employee_id = liaison.employee_id
       AND app_user.is_active = true
      INNER JOIN public.roles_user AS permission
        ON permission.user_id = app_user.id
      INNER JOIN public.components AS component
        ON component.components_id = permission.component_id
       AND component.description = 'Enlace de RRHH'
       AND component.visible = true
      WHERE liaison.regional_id = permit.regional_id
        AND liaison.role = 'hr_liaison'
        AND liaison.is_active = true
        AND liaison.can_review_exit_permits = true
    )
  RETURNING permit.id
)
SELECT 'Pases trasladados' AS resultado, COUNT(*) AS total
FROM updated_exit_permits;

-- LICENCIAS
WITH updated_leaves AS (
  UPDATE public.leave_requests AS request
  SET liaison_review_required = true,
      liaison_status = 'PENDING',
      liaison_employee_id = NULL,
      liaison_observation = NULL,
      liaison_reviewed_at = NULL,
      updated_at = NOW()
  WHERE request.stage = 'HR_REVIEW'
    AND request.status = 'PENDING'
    AND request.hr_status = 'PENDING'
    AND request.liaison_review_required = false
    AND request.liaison_reviewed_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.regional_managers AS liaison
      INNER JOIN public.users AS app_user
        ON app_user.employee_id = liaison.employee_id
       AND app_user.is_active = true
      INNER JOIN public.roles_user AS permission
        ON permission.user_id = app_user.id
      INNER JOIN public.components AS component
        ON component.components_id = permission.component_id
       AND component.description = 'Enlace de RRHH'
       AND component.visible = true
      WHERE liaison.regional_id = request.regional_id
        AND liaison.role = 'hr_liaison'
        AND liaison.is_active = true
        AND liaison.can_review_leaves = true
    )
  RETURNING request.id
)
SELECT 'Licencias trasladadas' AS resultado, COUNT(*) AS total
FROM updated_leaves;

COMMIT;

-- Verificación: estos resultados deben quedar en cero después del traslado.
SELECT 'Vacaciones todavía disponibles para trasladar' AS resultado, COUNT(*) AS total
FROM public.vacation_requests AS request
WHERE request.stage = 'HR_REVIEW'
  AND request.status = 'PENDING'
  AND request.liaison_review_required = false
  AND EXISTS (
    SELECT 1 FROM public.regional_managers AS liaison
    INNER JOIN public.users AS app_user ON app_user.employee_id = liaison.employee_id AND app_user.is_active = true
    INNER JOIN public.roles_user AS permission ON permission.user_id = app_user.id
    INNER JOIN public.components AS component ON component.components_id = permission.component_id AND component.description = 'Enlace de RRHH' AND component.visible = true
    WHERE liaison.regional_id = request.regional_id
      AND liaison.role = 'hr_liaison'
      AND liaison.is_active = true
      AND liaison.can_review_vacations = true
  );

SELECT 'Pases todavía disponibles para trasladar' AS resultado, COUNT(*) AS total
FROM public.employee_exit_permits AS permit
WHERE permit.stage = 'hr_review'
  AND permit.status = 'pending'
  AND permit.liaison_review_required = false
  AND EXISTS (
    SELECT 1 FROM public.regional_managers AS liaison
    INNER JOIN public.users AS app_user ON app_user.employee_id = liaison.employee_id AND app_user.is_active = true
    INNER JOIN public.roles_user AS permission ON permission.user_id = app_user.id
    INNER JOIN public.components AS component ON component.components_id = permission.component_id AND component.description = 'Enlace de RRHH' AND component.visible = true
    WHERE liaison.regional_id = permit.regional_id
      AND liaison.role = 'hr_liaison'
      AND liaison.is_active = true
      AND liaison.can_review_exit_permits = true
  );

SELECT 'Licencias todavía disponibles para trasladar' AS resultado, COUNT(*) AS total
FROM public.leave_requests AS request
WHERE request.stage = 'HR_REVIEW'
  AND request.status = 'PENDING'
  AND request.liaison_review_required = false
  AND EXISTS (
    SELECT 1 FROM public.regional_managers AS liaison
    INNER JOIN public.users AS app_user ON app_user.employee_id = liaison.employee_id AND app_user.is_active = true
    INNER JOIN public.roles_user AS permission ON permission.user_id = app_user.id
    INNER JOIN public.components AS component ON component.components_id = permission.component_id AND component.description = 'Enlace de RRHH' AND component.visible = true
    WHERE liaison.regional_id = request.regional_id
      AND liaison.role = 'hr_liaison'
      AND liaison.is_active = true
      AND liaison.can_review_leaves = true
  );
