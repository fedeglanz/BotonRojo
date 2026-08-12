/**
 * El contrato de una campaña de email.
 *
 * Aparte del de las páginas porque un email no es una página pequeña: es otro medio.
 * El cliente de correo no ejecuta JavaScript, ignora buena parte del CSS moderno, no
 * carga hojas externas y en la mitad de los casos empieza con las imágenes
 * bloqueadas. Un diseño web precioso llega roto.
 *
 * Se le da a Claude como resultado de herramienta, igual que el de las páginas,
 * porque quien diseña es el que tiene que cumplirlo.
 */
export const EMAIL_CONTRACT = `# Cómo diseñar una campaña de email para Botón Rojo

Diseñas un email HTML completo. **No es una página web pequeña**: el cliente de correo
no ejecuta JavaScript, ignora buena parte del CSS moderno y muchas veces abre con las
imágenes bloqueadas. Lo que en una web es normal, aquí llega roto.

## Reglas del medio (estas no son estéticas)

- **CSS en línea**, en el atributo \\\`style\\\` de cada elemento. Gmail borra los
  \\\`<style>\\\` en algunos contextos y nadie carga hojas externas.
- **Maquetación con \\\`<table>\\\`**, no con flex ni grid. Outlook usa el motor de Word:
  flex y grid no existen para él.
- **Ancho máximo 600px**, centrado, con una tabla exterior al 100% que hace de fondo.
- **Nada de \\\`<script>\\\`, \\\`<form>\\\`, \\\`position\\\`, \\\`float\\\` ni vídeo.** Un formulario
  en un correo no envía nada: lleva a la página de registro.
- **Ni un solo \\\`data-br\\\`.** Esos atributos los cablea nuestro runtime en las páginas,
  y en un correo no hay runtime. Un botón de compra aquí es un enlace normal a la
  página de venta.
- **Tipografías del sistema.** Las de Google no cargan en la mayoría de clientes: usa
  la de la marca como primera opción y detrás una pila real
  (\\\`Georgia, 'Times New Roman', serif\\\` o \\\`-apple-system, 'Segoe UI', Arial, sans-serif\\\`).
- **Las imágenes, por url y con \\\`alt\\\`** y ancho en el atributo, no solo en el CSS.
  Con imágenes bloqueadas, el \\\`alt\\\` es lo único que se lee.
- **Fondo oscuro con cuidado**: si la marca es oscura, pon el color en la tabla y
  también en el texto, porque hay clientes que invierten colores por su cuenta.

## La identidad del lanzamiento

Usa la paleta y las tipografías que te da \\\`contexto_lanzamiento\\\`: el correo tiene que
parecer de la misma casa que las páginas. El logo, si lo hay, viene en \\\`marca.logo\\\` y
es una url que puedes usar tal cual.

## Valores ({{tokens}})

Aquí sí se escriben como tokens y **se sustituyen al publicar**, no al abrir el correo:
un email es una foto fija y no hay nada que lo rellene después.

- \\\`{{nombre}}\\\`, \\\`{{promesa}}\\\`
- \\\`{{precio}}\\\`, \\\`{{plazos}}\\\`
- \\\`{{cierre_carrito}}\\\`, \\\`{{cierre_registro}}\\\`
- \\\`{{url_registro}}\\\`, \\\`{{url_venta}}\\\`, \\\`{{url_gracias}}\\\`
- \\\`{{url_baja}}\\\` — la página de baja

**\\\`{{url_baja}}\\\` es obligatorio en todos los correos**, en el pie y visible. No es un
detalle legal que se pueda dejar para luego: sin salida clara, la gente marca el correo
como spam y eso quema el dominio de envío para todos los demás.

## El asunto y el preencabezado

Van aparte del HTML, en \\\`asunto\\\` y \\\`preencabezado\\\`, porque el cliente de correo los
lee de la cabecera del envío y no del cuerpo. El preencabezado es la línea que se ve
en la bandeja detrás del asunto: si no se pone, ahí sale el primer texto del correo,
que suele ser "Ver en el navegador".

## Muchas campañas

Cada campaña es independiente: se publica con su nombre y se puede rediseñar sin tocar
las demás. Usa \\\`listar_emails\\\` para ver las que ya hay y no repetir nombre —publicar
con un nombre que ya existe lo sustituye, que es lo que se quiere al corregir una.`;
