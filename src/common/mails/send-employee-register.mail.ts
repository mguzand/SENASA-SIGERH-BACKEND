export const sendMailNewEmployee = (
  username: string,
  employeeName: string,
  password: string,
  playStoreUrl: string,
) => {
  return `
  
  <div style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:40px 0;">
    <tr>
      <td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">

      <!-- HEADER -->
      <tr>
        <td align="center" style="padding:40px;background:linear-gradient(52deg,#031222,#052328);">

          <img
            src="https://sigerh.senasa.gob.hn/empleados/logo-empleados.png"
            alt=" "
            style="max-height:80px;margin-bottom:15px;"
          />

          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:bold;">
            Bienvenido al Portal del Empleado
          </h1>

          <p style="margin:12px 0 0 0;color:#d1d5db;font-size:15px;">
            Sistema Integral de Gestión de Recursos Humanos
          </p>

        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding:40px;color:#374151;font-size:16px;line-height:26px;">

          <p style="margin-top:0;">
            Estimado(a) <strong>${employeeName}</strong>,
          </p>

          <p>
            Le damos la bienvenida al <strong>Portal del Empleado SENASA</strong>.
            Su cuenta ha sido creada exitosamente y ya puede acceder a los servicios
            disponibles desde la aplicación móvil.
          </p>

          <p>
            A través del portal podrá:
          </p>

          <ul style="padding-left:20px;color:#4b5563;">
            <li>Solicitar vacaciones.</li>
            <li>Gestionar pases de salida.</li>
            <li>Consultar marcaciones y horarios.</li>
            <li>Visualizar información laboral.</li>
            <li>Dar seguimiento al estado de sus solicitudes.</li>
            <li>Recibir notificaciones importantes.</li>
          </ul>

          <!-- CREDENCIALES -->
          <div style="
            margin:35px 0;
            background:#f9fafb;
            border:1px solid #e5e7eb;
            border-radius:14px;
            padding:25px;
          ">

            <h3 style="
              margin-top:0;
              color:#111827;
              text-align:center;
            ">
              Credenciales de Acceso
            </h3>

            <table width="100%" cellpadding="8">
              <tr>
                <td width="35%">
                  <strong>Usuario:</strong>
                </td>
                <td>
                  ${username}
                </td>
              </tr>

              <tr>
                <td>
                  <strong>Contraseña Temporal:</strong>
                </td>
                <td>
                  ${password}
                </td>
              </tr>
            </table>

          </div>

          <!-- APP -->
          <div style="
            background:#f9fafb;
            border:1px solid #e5e7eb;
            border-radius:14px;
            padding:30px;
            text-align:center;
            margin:35px 0;
          ">

            <div style="font-size:48px;margin-bottom:10px;">
              📱
            </div>

            <h2 style="
              margin:0;
              color:#111827;
              font-size:22px;
            ">
              Descargue la Aplicación Móvil
            </h2>

            <p style="
              color:#6b7280;
              margin:15px 0 25px 0;
            ">
              Lleve el Portal del Empleado siempre con usted y gestione
              sus solicitudes desde cualquier lugar.
            </p>

            <!-- GOOGLE PLAY -->
            <div style="margin-bottom:20px;">

              <a
                href="${playStoreUrl}"
                target="_blank"
                style="
                  background:#34A853;
                  color:#ffffff;
                  text-decoration:none;
                  padding:14px 28px;
                  border-radius:10px;
                  font-weight:bold;
                  display:inline-block;
                "
              >
                ▶ Descargar desde Google Play
              </a>

            </div>

            <p style="
              margin:0;
              color:#6b7280;
              font-size:13px;
            ">
              Disponible actualmente para dispositivos Android.
            </p>

            <!-- APPLE -->
            <div style="
              margin-top:25px;
              padding-top:20px;
              border-top:1px solid #e5e7eb;
            ">

              <div style="
                display:inline-block;
                background:#f3f4f6;
                color:#6b7280;
                padding:12px 20px;
                border-radius:10px;
                font-weight:600;
              ">
               Próximamente en App Store
              </div>

            </div>

          </div>

          <!-- SEGURIDAD -->
          <div style="
            background:#fff8e6;
            border-left:4px solid #f59e0b;
            padding:15px;
            border-radius:8px;
          ">
            <strong>Recomendación de Seguridad:</strong><br>
            Por su seguridad, le recomendamos cambiar su contraseña temporal
            después de iniciar sesión por primera vez y mantener sus credenciales
            de acceso de forma confidencial.
          </div>

          <p style="margin-top:30px;">
            Si tiene consultas o requiere asistencia, puede comunicarse con
            el Departamento de Recursos Humanos o con el área de soporte técnico.
          </p>

          <p>
            Saludos cordiales,<br>
            <strong>Equipo de Recursos Humanos</strong><br>
            SENASA
          </p>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td align="center" style="
          background:#f9fafb;
          padding:25px;
          color:#6b7280;
          font-size:13px;
          line-height:20px;
        ">

          <p style="margin:0;">
            Este correo fue generado automáticamente por el Portal del Empleado.
          </p>

          <p style="margin:10px 0 0 0;">
            © 2026 SENASA · Todos los derechos reservados.
          </p>

        </td>
      </tr>

    </table>

  </td>
</tr>
  </table>

</div>


`;
};
