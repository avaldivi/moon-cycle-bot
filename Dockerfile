# syntax = docker/dockerfile:1

# Use Node 18.20.0 (compatible with swisseph) - no longer valid after adding python3.14 but notating as the last version that worked incase something goes awry
# Upgrading to 20.11.1 to use Vercel AI SDK
ARG NODE_VERSION=20.11.1
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
## COPY package.json ./

# ✅ Install with npm to ensure native modules build correctly
RUN npm ci
## RUN npm install

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