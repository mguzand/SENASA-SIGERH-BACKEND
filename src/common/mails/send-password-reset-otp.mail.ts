export const sendPasswordResetOtpMail = (
  employeeName: string,
  code: string,
  expiresInMinutes: number,
) => `
  <div style="font-family: Arial, sans-serif; background: #f5f7fb; padding: 32px 16px; color: #0f172a;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 32px; box-shadow: 0 14px 40px rgba(15, 23, 42, 0.08);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="margin: 0; font-size: 22px; color: #031222;">Portal del Empleado</h1>
        <p style="margin: 8px 0 0; font-size: 13px; color: #64748b;">Recuperacion de contrasena</p>
      </div>

      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
        Hola${employeeName ? ` ${employeeName}` : ''},
      </p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Recibimos una solicitud para restablecer tu contrasena. Usa el siguiente codigo temporal para continuar:
      </p>

      <div style="margin: 0 auto 24px; width: fit-content; background: #031222; color: white; border-radius: 14px; padding: 16px 24px; font-size: 30px; font-weight: 800; letter-spacing: 8px;">
        ${code}
      </div>

      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 8px; color: #334155;">
        Este codigo vence en ${expiresInMinutes} minutos.
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0; color: #334155;">
        Si no solicitaste este cambio, puedes ignorar este correo.
      </p>
    </div>
  </div>
`;
