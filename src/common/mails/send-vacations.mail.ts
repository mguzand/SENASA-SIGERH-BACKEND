export const sendMailTemplate = (
  managerName: string,
  employeeName: string,
  dates: string,
  requestedDays: string,
  comment: string,
  approveUrl: string,
  rejectUrl: string,
) => {
  return `<div
  style="
    font-family: Arial, Helvetica, sans-serif;
    background: #f4f7fb;
    margin: 0;
    padding: 0;
    color: #1f2937;
  "
>
  <div style="max-height: 100%px; margin: 0 auto; padding: 40px 16px">
    <div
      style="
        background: #ffffff;
        border-radius: 22px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(3, 18, 34, 0.12);
        border: 1px solid #e5e7eb;
      "
    >
      <!-- Header -->
      <div
        style="
          background: #031222;
          padding: 20px 0px 0px 0px;
          text-align: center;
        "
      >
        <img
          src="https://sigerh.senasa.gob.hn/logos/logo.png"
          alt="SIGERH"
          style="max-width: 180px; margin-bottom: 18px"
        />
 
      </div>

      <!-- Body -->
      <div style="padding: 34px 32px">
        <p style="font-size: 17px; line-height: 26px; margin: 0 0 18px">
          Estimado/a <strong>${managerName}</strong>,
        </p>

        <p style="font-size: 16px; line-height: 26px; margin: 0 0 24px">
          Se ha recibido una solicitud de vacaciones que requiere su revisión y aprobación.
        </p>

        <!-- Info box -->
        <div
          style="
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 22px;
            margin-bottom: 28px;
          "
        >
          <p style="margin: 0 0 12px; font-size: 15px">
            <strong>Empleado:</strong> ${employeeName}
          </p>

          <p style="margin: 0 0 12px; font-size: 15px">
            <strong>Fechas:</strong> ${dates}
          </p>

          <p style="margin: 0 0 12px; font-size: 15px">
            <strong>Días solicitados:</strong> ${requestedDays}
          </p>

          <p style="margin: 0; font-size: 15px">
            <strong>Comentario:</strong> ${comment}
          </p>
        </div>

        <p
          style="
            font-size: 15px;
            line-height: 24px;
            margin: 0 0 28px;
            color: #475569;
          "
        >
          Para continuar con el proceso, seleccione una de las siguientes opciones:
        </p>

        <!-- Buttons -->
        <div style="text-align: center; margin-bottom: 30px">
          <a
            href="${approveUrl}"
            style="
              display: inline-block;
              background: #16a34a;
              color: #ffffff;
              text-decoration: none;
              font-size: 16px;
              font-weight: bold;
              padding: 14px 34px;
              border-radius: 12px;
              margin: 6px;
            "
          >
            Aceptar
          </a>

          <a
            href="${rejectUrl}"
            style="
              display: inline-block;
              background: #d44538;
              color: #ffffff;
              text-decoration: none;
              font-size: 16px;
              font-weight: bold;
              padding: 14px 34px;
              border-radius: 12px;
              margin: 6px;
            "
          >
            Denegar
          </a>
        </div>

        <div
          style="
            background: #fff7ed;
            border-left: 5px solid #f97316;
            padding: 14px 18px;
            border-radius: 10px;
          "
        >
          <p
            style="
              margin: 0;
              color: #9a3412;
              font-size: 14px;
              line-height: 22px;
            "
          >
            Este enlace es personal y válido únicamente para esta solicitud.
            No comparta este correo con terceros.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div
        style="
          background: #f8fafc;
          padding: 22px 28px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        "
      >
        <p style="margin: 0; font-size: 13px; color: #64748b">
          SENASA · SIGERH
        </p>

        <p style="margin: 8px 0 0; font-size: 12px; color: #94a3b8">
          Este correo fue generado automáticamente. Por favor, no responder.
        </p>
      </div>
    </div>
  </div>
</div>`;
};
