#=========================================================================#
# Botón Rojo · el dominio antiguo, redirigido al nuevo                    #
#                                                                         #
# La plataforma pasó de botonrojo.escuelanomadadigital.com a              #
# botonrojo.estelarys.com. El nombre viejo sigue dado de alta a propósito: #
# está escrito en enlaces, en el conector de Claude y en las páginas ya    #
# publicadas, y sin él esas peticiones llegarían a la app como un dominio  #
# de cliente desconocido — que contesta 404, no "esto se ha movido".       #
#                                                                         #
# El 301 conserva la ruta, así que /archivos/... y /admin/... siguen       #
# llevando a donde llevaban.                                              #
#=========================================================================#

server {
	listen      %ip%:%proxy_port%;
	server_name %domain_idn% %alias_idn%;
	access_log  /var/log/%web_system%/domains/%domain%.log combined;
	error_log   /var/log/%web_system%/domains/%domain%.error.log error;

	# La renovación del certificado tiene que seguir pasando por aquí: si se
	# redirige también esto, Let's Encrypt no puede validar y el nombre viejo
	# se queda sin certificado, con lo que el aviso del navegador tapa la
	# redirección que venía a arreglar.
	location ^~ /.well-known/acme-challenge/ {
		root %home%/%user%/web/%domain%/public_html;
		try_files $uri =404;
	}

	location / {
		return 301 https://botonrojo.estelarys.com$request_uri;
	}

	include %home%/%user%/conf/web/%domain%/nginx.conf_*;
}
