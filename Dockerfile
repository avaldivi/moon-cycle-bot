# syntax = docker/dockerfile:1

# ✅ Use Node 18.20.0 (compatible with swisseph)
ARG NODE_VERSION=18.20.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

WORKDIR /app
ENV NODE_ENV="production"

# --------------------------------------
# ⚙️ Build stage
# --------------------------------------
FROM base AS build

# 🛠️ Install required native build tools
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential \
    node-gyp \
    pkg-config \
    python-is-python3 \
    git

# 🔐 Copy only what’s needed to install dependencies
COPY package.json package-lock.json ./

# ✅ Install with npm to ensure native modules build correctly
RUN npm ci

# 🧠 Now copy the rest of the app
COPY . .

# --------------------------------------
# 🚀 Final runtime image
# --------------------------------------
FROM base

# ✅ Copy built app and dependencies from build stage
COPY --from=build /app /app

# Expose Fly.io app port
EXPOSE 3000

# 🟢 Start the server
CMD ["npm", "start"]