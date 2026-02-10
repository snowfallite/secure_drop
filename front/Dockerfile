FROM node:20-slim AS builder

WORKDIR /app

COPY front/package.json ./
RUN npm install

COPY front ./
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY front/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
