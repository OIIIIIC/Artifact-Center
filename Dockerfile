FROM node:22-alpine AS build

WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json ./
COPY plugins/artifact-center-mcp/package.json plugins/artifact-center-mcp/package-lock.json ./plugins/artifact-center-mcp/
RUN npm ci

COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY public ./public
COPY src ./src
COPY apps/api/src/lib/artifact-types.ts ./apps/api/src/lib/artifact-types.ts
COPY plugins/artifact-center-mcp/src ./plugins/artifact-center-mcp/src
COPY plugins/artifact-center-mcp/scripts ./plugins/artifact-center-mcp/scripts
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
