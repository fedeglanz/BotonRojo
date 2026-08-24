#=========================================================================#
# Botón Rojo · proxy a la app en Docker (127.0.0.1:3020)                  #
# La lleva el dominio de la plataforma y cada dominio de cliente activo.   #
# El puerto sale de docker-compose.prod.yml: si cambia allí, cambia aquí. #
#=========================================================================#

server {
	listen      %ip%:%proxy_port%;
	server_name %domain_idn% %alias_idn%;
	access_log  /var/log/%web_system%/domains/%domain%.log combined;
	error_log   /var/log/%web_system%/domains/%domain%.error.log error;

	include %home%/%user%/conf/web/%domain%/nginx.forcessl.conf*;

	# Las subidas del panel (logos, fotos) y los server actions de Next.
	client_max_body_size 50m;

	location ~ /\.(?!well-known\/|file) {
		deny all;
		return 404;
	}

	# Imágenes y css de las páginas publicadas, servidos desde MinIO.
	# La barra final del proxy_pass es la que quita /archivos/ y deja
	# /<bucket>/<clave>, que es como MinIO los guarda.
	location /archivos/ {
		proxy_pass http://127.0.0.1:9000/;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_hide_header x-amz-id-2;
		proxy_hide_header x-amz-request-id;
	}

	location / {
		proxy_pass http://127.0.0.1:3020;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection $connection_upgrade;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_read_timeout 300s;
	}

	include %home%/%user%/conf/web/%domain%/nginx.conf_*;
}
