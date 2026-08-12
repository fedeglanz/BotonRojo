/*
 * Botón Rojo · Runtime de páginas propias
 *
 * Se inyecta en las páginas diseñadas fuera (Claude Design). El diseño es libre;
 * esto es lo que le da comportamiento sin que el diseñador tenga que reimplementar
 * el carrito, el formulario ni la atribución de afiliados.
 *
 * Contrato (atributos data-br):
 *   <form data-br="lead" data-br-next="/gracias">     captura de leads
 *   <a|button data-br="comprar" data-br-producto="slug">   checkout de Stripe
 *   <div data-br="cuenta-atras" data-br-fecha="carrito|registro">
 *   <span data-br="precio">
 *   data-br="ninguno"   deja un elemento fuera de todo esto
 *
 * Va después de track.js y comparte sus cookies (br_ref, br_utm_*), así que la
 * atribución de un lead o una venta es la misma que la de la visita.
 */
(function () {
  var script = document.currentScript;
  var cfg = {};
  try {
    cfg = JSON.parse((script && script.getAttribute("data-config")) || "{}");
  } catch (e) {
    cfg = {};
  }
  var launchSlug = (script && script.dataset.launch) || cfg.slug;

  /* Rutas relativas a propósito, no la URL de la app.
     Estas páginas las sirve siempre nuestro propio servidor —también cuando el
     lanzamiento tiene dominio propio, que se proxea a la misma app—, así que una
     ruta relativa cae donde tiene que caer. Apuntar a un origen fijo convertiría
     cada envío en una petición cross-origin desde el dominio del cliente, con su
     preflight y su CORS, para nada. */
  var API = {
    lead: "/api/lead",
    checkout: "/api/stripe/checkout",
  };

  function cookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  /* El ref de la URL manda sobre la cookie: un clic recién hecho de un afiliado
     no debe perder contra la atribución de una visita anterior. */
  function ref() {
    var fromUrl = new URLSearchParams(location.search).get("ref");
    return fromUrl || cookie("br_ref") || null;
  }

  function utm() {
    var out = {};
    ["source", "medium", "campaign", "content", "term"].forEach(function (k) {
      var v = cookie("br_utm_" + k);
      if (v) out["utm_" + k] = v;
    });
    return out;
  }

  /* ------------------------------------------------------------- afiliados -- */

  /* Los enlaces internos heredan el ref. Sin esto, pasar de la página de
     captación a la de venta perdía al afiliado, que es justo donde se decide
     la comisión. */
  function propagateRef() {
    var r = ref();
    if (!r) return;
    document.querySelectorAll("a[href]").forEach(function (a) {
      if (a.getAttribute("data-br") === "ninguno") return;
      var href = a.getAttribute("href");
      if (!href || /^(?:[a-z]+:|#|\/\/)/i.test(href) && href.indexOf("//") !== 0) {
        if (/^(?:mailto:|tel:|#)/i.test(href || "")) return;
      }
      try {
        var url = new URL(a.href, location.href);
        if (url.origin !== location.origin) return;
        if (!url.searchParams.get("ref")) {
          url.searchParams.set("ref", r);
          a.href = url.toString();
        }
      } catch (e) {
        /* href raro: se deja como está */
      }
    });
  }

  /* ------------------------------------------------------------------ lead -- */

  function leadForms() {
    var marked = Array.prototype.slice.call(document.querySelectorAll('form[data-br="lead"]'));
    if (marked.length) return marked;

    /* Red de seguridad: si el diseño trae un formulario con email y nadie lo
       marcó, se trata como captación igualmente. Un formulario que no envía a
       ningún sitio es peor que una suposición. */
    return Array.prototype.slice.call(document.querySelectorAll("form")).filter(function (f) {
      return f.getAttribute("data-br") !== "ninguno" && f.querySelector('input[type="email"], input[name="email"]');
    });
  }

  function wireLeadForms() {
    leadForms().forEach(function (form) {
      if (form.__brWired) return;
      form.__brWired = true;

      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var data = new FormData(form);
        var email = String(data.get("email") || "").trim();
        var name = String(data.get("name") || data.get("nombre") || "").trim();
        if (!email) return;

        var status = form.querySelector('[data-br="estado"]');
        var button = form.querySelector('button, input[type="submit"]');
        if (button) button.disabled = true;
        if (status) status.textContent = "Enviando…";

        fetch(API.lead, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            launchSlug: launchSlug,
            email: email,
            name: name || undefined,
            phone: String(data.get("phone") || data.get("telefono") || "").trim() || undefined,
            ref: ref(),
            utm: utm(),
          }),
        })
          .then(function (r) {
            return r.json().catch(function () {
              return {};
            });
          })
          .then(function (res) {
            if (res && res.error) throw new Error(res.error);
            if (window.BotonRojo && window.BotonRojo.track) {
              window.BotonRojo.track("lead", { email: email, name: name });
            }
            /* Orden deliberado: lo que pide el diseño manda sobre el valor por
               defecto de la plataforma. Si el diseñador dejó un bloque de "listo",
               es que quiere quedarse en la página; irse a /gracias se lo comería. */
            var next = form.getAttribute("data-br-next");
            var ok = document.querySelector('[data-br="lead-ok"]');
            if (!next && !ok) next = cfg.leadNext;

            if (next) {
              location.href = next;
              return;
            }
            if (ok) {
              ok.hidden = false;
              form.hidden = true;
            } else if (status) {
              status.textContent = "¡Listo! Te hemos apuntado.";
            }
          })
          .catch(function () {
            if (status) status.textContent = "No se ha podido enviar. Inténtalo de nuevo.";
            if (button) button.disabled = false;
          });
      });
    });
  }

  /* -------------------------------------------------------------- checkout -- */

  function wireCheckout() {
    document.querySelectorAll('[data-br="comprar"]').forEach(function (el) {
      if (el.__brWired) return;
      el.__brWired = true;

      el.addEventListener("click", function (ev) {
        var productSlug = el.getAttribute("data-br-producto") || cfg.productSlug;
        if (!productSlug) return; /* sin producto: se deja pasar el clic */
        ev.preventDefault();

        var original = el.textContent;
        el.setAttribute("aria-busy", "true");

        fetch(API.checkout, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productSlug: productSlug,
            launchId: cfg.launchId,
            ref: ref() || undefined,
            utm: utm(),
          }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (res) {
            if (res && res.url) {
              location.href = res.url;
            } else {
              throw new Error((res && res.error) || "sin_url");
            }
          })
          .catch(function () {
            el.removeAttribute("aria-busy");
            el.textContent = original;
            alert("No se ha podido abrir el pago. Inténtalo de nuevo.");
          });
      });
    });
  }

  /* ----------------------------------------------------------- cuenta atrás -- */

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function wireCountdowns() {
    var nodes = document.querySelectorAll('[data-br="cuenta-atras"]');
    if (!nodes.length) return;

    function tick() {
      nodes.forEach(function (node) {
        var which = node.getAttribute("data-br-fecha") || "carrito";
        var iso = which === "registro" ? cfg.registrationClosesAt : cfg.cartClosesAt;
        if (!iso) {
          node.hidden = true;
          return;
        }
        var diff = new Date(iso).getTime() - Date.now();
        if (diff <= 0) {
          node.textContent = node.getAttribute("data-br-fin") || "Cerrado";
          return;
        }
        var d = Math.floor(diff / 864e5);
        var h = Math.floor((diff % 864e5) / 36e5);
        var m = Math.floor((diff % 36e5) / 6e4);
        var s = Math.floor((diff % 6e4) / 1e3);

        /* Si el diseño trae huecos por unidad, se rellenan; si no, una línea. */
        var slots = node.querySelectorAll("[data-br-unidad]");
        if (slots.length) {
          slots.forEach(function (slot) {
            var u = slot.getAttribute("data-br-unidad");
            slot.textContent =
              u === "dias" ? String(d) : u === "horas" ? pad(h) : u === "minutos" ? pad(m) : pad(s);
          });
        } else {
          node.textContent = d + "d " + pad(h) + "h " + pad(m) + "m " + pad(s) + "s";
        }
      });
    }

    tick();
    setInterval(tick, 1000);
  }

  /* ---------------------------------------------------------------- precio -- */

  /* El precio y los plazos, al servir la página.
     El diseño escribe el valor de hoy para que la vista previa se vea terminada, y
     esto lo sustituye por el que haya en Botón Rojo en ese momento: así cambiar el
     precio en el panel no deja mintiendo a la página. */
  function fillPrices() {
    if (cfg.price) {
      document.querySelectorAll('[data-br="precio"]').forEach(function (el) {
        el.textContent = cfg.price;
      });
    }
    if (cfg.installments) {
      document.querySelectorAll('[data-br="plazos"]').forEach(function (el) {
        el.textContent = cfg.installments;
      });
    }
  }

  function start() {
    propagateRef();
    wireLeadForms();
    wireCheckout();
    wireCountdowns();
    fillPrices();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  /* Expuesto para diseños con contenido dinámico: si el diseño pinta secciones
     después, vuelve a cablear lo nuevo sin duplicar lo ya cableado. */
  window.BotonRojoRuntime = { wire: start };
})();
