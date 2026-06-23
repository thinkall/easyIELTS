# Portable container image for easyIELTS — works on Fly.io, Koyeb, Render (Docker),
# Railway, or any host that runs a Node container. The app uses a custom Node server
# (server.ts) with a WebSocket speaking proxy, so it must run as a real process
# (not a static export / serverless function).

# ---- build stage: install ALL deps (devDeps are needed for `next build`) ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# The server binds to HOST (defaults to localhost); inside a container it MUST
# listen on 0.0.0.0 so the platform can route traffic to it.
ENV HOST=0.0.0.0
ENV PORT=3000
# Copy the built app (node_modules incl. tsx + next, the .next build, and the
# TypeScript source that the custom server runs via tsx).
COPY --from=build /app ./
EXPOSE 3000
# `npm start` runs `cross-env NODE_ENV=production tsx server.ts`.
CMD ["npm", "start"]
