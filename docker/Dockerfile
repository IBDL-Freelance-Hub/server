FROM node:22-alpine AS base

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies cleanly
RUN npm ci

# Copy application source files
COPY . .

EXPOSE 5000

# Start API in development mode
CMD ["npm", "run", "dev"]
