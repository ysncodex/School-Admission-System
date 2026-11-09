#!/bin/sh
set -eu

: "${API_BASE_URL:=http://localhost:8080}"
export API_BASE_URL

envsubst '${API_BASE_URL}' < /usr/share/nginx/html/config.js.template > /usr/share/nginx/html/config.js
rm -f /usr/share/nginx/html/config.js.template

exec nginx -g 'daemon off;'
