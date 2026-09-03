import { EmployeeExitPermitsService } from './employee-exit-permits.service';
import { ExitPermitStage } from './enums/exit-permit-stage.enum';
import { ExitPermitStatus } from './enums/exit-permit-status.enum';
import { sendRequestNotification } from '../../common/helpers/send-email.helper';

jest.mock('../../common/helpers/send-email.helper', () => ({ sendRequestNotification: jest.fn() }));
jest.mock('../push-notifications/push-notifications.service', () => ({ PushNotificationsService: class {} }));

describe('Solicitud de cambio de respaldo por enlace', () => {
  let service: EmployeeExitPermitsService;
  let permit: any;
  let repository: any;
  let push: any;
  let routing: any;
  beforeEach(() => {
    jest.clearAllMocks();
    permit = { id: 'permit', employee_id: 'employee', regional_id: 'regional',
      stage: ExitPermitStage.HR_REVIEW, status: ExitPermitStatus.PENDING,
      liaison_review_required: true, liaison_status: 'pending', permit_type: 'Oficial',
      support_file_path: 'old.pdf', support_mime_type: 'application/pdf',
      boss_status: ExitPermitStatus.APPROVED, employee: { id: 'employee', email: 'employee@example.test' } };
    repository = { findOne: jest.fn().mockResolvedValue(permit), update: jest.fn().mockResolvedValue({ affected: 1 }) };
    routing = { findActiveHrLiaisonsByPermission: jest.fn().mockResolvedValue([{ employee_id: 'liaison' }]) };
    push = { sendToEmployee: jest.fn().mockResolvedValue(undefined) };
    service = new EmployeeExitPermitsService(repository, { findOneBy: jest.fn().mockResolvedValue({ firstName: 'Ana', lastName: 'Pérez' }) } as any,
      {} as any, {} as any, {} as any, routing, {} as any, push);
    (sendRequestNotification as jest.Mock).mockResolvedValue({ messageId: 'mail' });
  });

  it('retira la referencia, conserva el flujo y notifica por correo y push', async () => {
    const result = await service.requestSupportChange('permit', ' Archivo ilegible ', 'liaison');
    expect(result).toMatchObject({ hasSupport: false, documentsComplete: false, notificationWarning: false });
    const [criteria, changes] = repository.update.mock.calls[0];
    expect(criteria).toMatchObject({ support_file_path: 'old.pdf', liaison_status: 'pending' });
    expect(changes).toMatchObject({ support_file_path: null, support_mime_type: null });
    expect(changes).not.toHaveProperty('boss_status');
    expect(changes).not.toHaveProperty('stage');
    expect(changes.liaison_observation).toContain('Ana Pérez: Archivo ilegible');
    expect(sendRequestNotification).toHaveBeenCalledTimes(1);
    expect(push.sendToEmployee).toHaveBeenCalledTimes(1);
  });

  it('rechaza enlaces de otra regional', async () => {
    await expect(service.requestSupportChange('permit', 'Cambiar', 'other')).rejects.toThrow('No tiene permiso');
    expect(repository.update).not.toHaveBeenCalled();
  });

  it.each(['finished', 'no-file', 'already-reviewed', 'no-reason'])('rechaza solicitud inválida: %s', async (condition) => {
    if (condition === 'finished') permit.stage = ExitPermitStage.COMPLETED;
    if (condition === 'no-file') permit.support_file_path = null;
    if (condition === 'already-reviewed') permit.liaison_status = 'approved';
    await expect(service.requestSupportChange('permit', condition === 'no-reason' ? ' ' : 'Cambiar', 'liaison')).rejects.toThrow();
    expect(repository.update).not.toHaveBeenCalled();
    expect(sendRequestNotification).not.toHaveBeenCalled();
  });

  it('no envía notificaciones si el pase cambió concurrentemente', async () => {
    repository.update.mockResolvedValue({ affected: 0 });
    await expect(service.requestSupportChange('permit', 'Cambiar', 'liaison')).rejects.toThrow('Actualice');
    expect(sendRequestNotification).not.toHaveBeenCalled();
  });

  it('avisa del fallo de notificación sin ocultar que el documento ya se retiró', async () => {
    push.sendToEmployee.mockRejectedValue(new Error('push offline'));
    const result = await service.requestSupportChange('permit', 'Cambiar', 'liaison');
    expect(result.notificationWarning).toBe(true);
    expect(result.hasSupport).toBe(false);
  });
});
