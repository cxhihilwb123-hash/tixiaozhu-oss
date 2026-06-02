FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app

COPY frontend/package*.json ./frontend/
RUN npm --prefix frontend install
COPY frontend ./frontend
RUN npm --prefix frontend run build

FROM node:20-bookworm-slim AS admin-build
WORKDIR /app

COPY admin/package*.json ./admin/
RUN npm --prefix admin install
COPY admin ./admin
RUN npm --prefix admin run build

FROM node:20-bookworm-slim AS backend
WORKDIR /app

ENV NODE_ENV=production
COPY backend/package*.json ./backend/
RUN npm --prefix backend install --omit=dev

COPY backend ./backend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY --from=admin-build /app/admin/dist ./admin/dist

EXPOSE 8787
CMD ["npm", "--prefix", "backend", "run", "start"]
