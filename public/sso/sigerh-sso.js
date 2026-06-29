(function (window) {
  function randomState() {
    return (
      Math.random().toString(36).substring(2) +
      Date.now().toString(36)
    );
  }

  function popupCenter(url, title, width, height) {
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    return window.open(
      url,
      title,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }

  window.SigerhSSO = {
    login(config) {
      return new Promise((resolve, reject) => {
        if (!config?.apiUrl) return reject('apiUrl es requerido');
        if (!config?.clientId) return reject('clientId es requerido');
        if (!config?.redirectUri) return reject('redirectUri es requerido');

        const state = config.state || randomState();

        const authorizeUrl = new URL(config.apiUrl + '/sso/authorize');

        authorizeUrl.searchParams.set('client_id', config.clientId);
        authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set('state', state);

        if (config.scope) {
          authorizeUrl.searchParams.set('scope', config.scope);
        }

        const popup = popupCenter(
          authorizeUrl.toString(),
          'Iniciar sesión con SIGERH',
          520,
          680
        );

        if (!popup) {
          return reject({
            error: 'popup_blocked',
            error_description: 'El navegador bloqueó la ventana de inicio de sesión.',
          });
        }

        function cleanup() {
          clearInterval(timer);
          window.removeEventListener('message', receiveMessage);
        }

        const timer = setInterval(() => {
          if (popup.closed) {
            cleanup();
            reject({
              error: 'popup_closed',
              error_description: 'La ventana de inicio de sesión fue cerrada.',
            });
          }
        }, 500);

        function receiveMessage(event) {
          const allowedOrigin = new URL(config.redirectUri).origin;

          if (event.origin !== allowedOrigin) return;

          if (!event.data || event.data.source !== 'SIGERH_SSO') return;

          cleanup();

          try {
            popup.close();
          } catch (_) {}

          if (event.data.state !== state) {
            return reject({
              error: 'invalid_state',
              error_description: 'La respuesta SSO no coincide con la solicitud original.',
            });
          }

          if (event.data.error) {
            return reject({
              error: event.data.error,
              error_description:
                event.data.error_description || 'Error en inicio de sesión SSO.',
              state: event.data.state,
            });
          }

          return resolve({
            code: event.data.code,
            state: event.data.state,
          });
        }

        window.addEventListener('message', receiveMessage);
      });
    },
  };
})(window);