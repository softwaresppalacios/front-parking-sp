# 1) Compila Angular en modo produccion (usa src/environments/environment.production.ts).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx ng build --configuration production

# 2) Sirve los archivos estaticos con Nginx.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/sp-parqueaderos-frontend/browser /usr/share/nginx/html
EXPOSE 80
