/*
 * Botón Rojo · Tracker
 *
 * Pixel ligero para landings externas. Reemplaza el JS que inyectaba el
 * plugin endtrack en WordPress. Captura UTMs + ref en cookies y envía
 * eventos a /api/track.
 *
 * Uso (en una landing pública):
 *   <script src="https://tu-dominio.com/track.js" data-launch="mi-lanzamiento" defer></script>
 *
 * Eventos personalizados:
 *   window.BotonRojo.track('lead', { email: '...', name: '...' });
 *   window.BotonRojo.track('sale', { email: '...', amountCents: 9700, product: 'Curso X' });
 */
(function () {
  var script = document.currentScript;
  /* Sin `data-api`, el origen desde el que se ha servido el script — que es el
     que está mirando el visitante. Nuestras propias páginas no lo ponen: fijado
     a la URL de la app, una página servida en el dominio del cliente mandaba sus
     eventos a otro dominio y el navegador los bloqueaba por CORS, así que el
     lanzamiento funcionaba y no medía nada. El atributo sigue siendo necesario
     para el script incrustado en una web de fuera, que sí tiene que decir a
     dónde manda. */
  var apiBase = (script && script.dataset.api) || new URL(script.src).origin;
  var launchSlug = script && script.dataset.launch;

  function cookie(name, value, days) {
    if (value === undefined) {
      var m = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
      return m ? decodeURIComponent(m[1]) : null;
    }
    var expires = "";
    if (days) {
      var d = new Date();
      d.setTime(d.getTime() + days * 864e5);
      expires = "; expires=" + d.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax";
  }

  function sessionId() {
    var s = sessionStorage.getItem("br_session");
    if (!s) {
      s = "v_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("br_session", s);
    }
    return s;
  }

  function visitorCookie() {
    var c = cookie("br_visitor");
    if (!c) {
      c = Date.now().toString() + Math.floor(Math.random() * 1e8);
      cookie("br_visitor", c, 365);
    }
    return c;
  }

  var qp = new URLSearchParams(location.search);
  ["ref", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
    var v = qp.get(k);
    if (v) cookie("br_" + k, v, 30);
  });

  function send(type, extra) {
    var payload = Object.assign(
      {
        type: type,
        sessionId: sessionId(),
        cookie: visitorCookie(),
        ref: qp.get("ref") || cookie("br_ref") || undefined,
        utmSource: qp.get("utm_source") || cookie("br_utm_source") || undefined,
        utmMedium: qp.get("utm_medium") || cookie("br_utm_medium") || undefined,
        utmCampaign: qp.get("utm_campaign") || cookie("br_utm_campaign") || undefined,
        utmContent: qp.get("utm_content") || cookie("br_utm_content") || undefined,
        utmTerm: qp.get("utm_term") || cookie("br_utm_term") || undefined,
        launchSlug: launchSlug || undefined,
        urlCurrent: location.href,
        urlPrevious: document.referrer || undefined,
      },
      extra || {},
    );

    var blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(apiBase + "/api/track", blob);
    } else {
      fetch(apiBase + "/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () {});
    }
  }

  window.BotonRojo = { track: send };
  send("visit");
})();
