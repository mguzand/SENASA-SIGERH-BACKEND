export enum EmploymentCertificateType {
  WITH_DEDUCTIONS = 'WITH_DEDUCTIONS',
  SWORN_STATEMENT = 'SWORN_STATEMENT',
  WITHOUT_DEDUCTIONS = 'WITHOUT_DEDUCTIONS',
  SIAFI_PIN = 'SIAFI_PIN',
  IHSS_AFFILIATION = 'IHSS_AFFILIATION',
  INJUPEMP_AFFILIATION = 'INJUPEMP_AFFILIATION',
  BOND = 'BOND',
  WITH_SCHEDULE = 'WITH_SCHEDULE',
  EMBASSY = 'EMBASSY',
}

export const EMPLOYMENT_CERTIFICATE_TYPE_LABELS: Record<
  EmploymentCertificateType,
  string
> = {
  [EmploymentCertificateType.WITH_DEDUCTIONS]: 'Con deducciones',
  [EmploymentCertificateType.SWORN_STATEMENT]: 'Finanzas / Tribunal Superior de Cuentas',
  [EmploymentCertificateType.WITHOUT_DEDUCTIONS]: 'Sin deducciones',
  [EmploymentCertificateType.SIAFI_PIN]: 'Para solicitud de PIN SIAFI',
  [EmploymentCertificateType.IHSS_AFFILIATION]: 'Para afiliación al IHSS',
  [EmploymentCertificateType.INJUPEMP_AFFILIATION]:
    'Para afiliación al INJUPEMP',
  [EmploymentCertificateType.BOND]: 'Fianza',
  [EmploymentCertificateType.WITH_SCHEDULE]: 'Con horario',
  [EmploymentCertificateType.EMBASSY]: 'Embajada',
};
