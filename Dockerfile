FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
# npm install (not ci): the Windows-generated lockfile omits linux-only
# optional deps (npm/cli#4828) and npm ci refuses to fill them in
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Migrations + seed run at startup (seed is a no-op if demo data already exists)
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed; npm run start"]
