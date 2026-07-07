FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Migrations + seed run at startup (seed is a no-op if demo data already exists)
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed; npm run start"]
