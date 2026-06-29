import { AuthorizeSsoDto } from "../dto/authorize-sso.dto";


export const  renderLoginPage = (dto: AuthorizeSsoDto, options?: { error?: string }) => {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Login SSO - SIGERH</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <style>
    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: Arial, Helvetica, sans-serif;
      background: #f4f6f8;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card {
      width: 100%;
      max-width: 420px;
      background: #ffffff;
      border-radius: 18px;
      box-shadow: 0 12px 35px rgba(0,0,0,0.12);
      overflow: hidden;
    }

    .header {
      background: #052328;
      color: white;
      padding: 28px;
      text-align: center;
    }

    .header h1 {
      margin: 0;
      font-size: 23px;
    }

    .header p {
      margin: 8px 0 0;
      font-size: 14px;
      opacity: 0.85;
    }

    .body {
      padding: 28px;
    }

    .alert {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
      padding: 12px;
      border-radius: 10px;
      font-size: 14px;
      margin-bottom: 16px;
      font-weight: bold;
    }

    label {
      display: block;
      font-size: 14px;
      margin-bottom: 6px;
      color: #374151;
      font-weight: 600;
    }

    input {
      width: 100%;
      padding: 13px 14px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      margin-bottom: 18px;
      font-size: 15px;
    }

    button {
      width: 100%;
      border: none;
      border-radius: 10px;
      padding: 14px;
      background: #d44538;
      color: #ffffff;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
    }

    button:hover {
      background: #bd382e;
    }

    .footer {
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      padding: 0 28px 24px;
    }
  </style>
</head>

<body>
  <div class="card">
    <div class="header">
      <h1>Iniciar sesión con SIGERH</h1>
      <p>Servicio Nacional de Sanidad e Inocuidad Agroalimentaria</p>
    </div>

    <form class="body" method="POST" action="/api/sso/login">
      <input type="hidden" name="client_id" value="${dto.client_id}" />
      <input type="hidden" name="redirect_uri" value="${dto.redirect_uri}" />
      <input type="hidden" name="response_type" value="${dto.response_type}" />
      <input type="hidden" name="scope" value="${dto.scope ?? ''}" />
      <input type="hidden" name="state" value="${dto.state ?? ''}" />

      ${options?.error ? `<div class="alert">${options.error}</div>` : ''}

      <label>Usuario</label>
      <input name="usuario" type="text" autocomplete="username" required />

      <label>Contraseña</label>
      <input name="password" type="password" autocomplete="current-password" required />

      <button type="submit">Continuar</button>
    </form>

    <div class="footer">
      Acceso autorizado únicamente para usuarios institucionales.
    </div>
  </div>
</body>
</html>
  `;
}