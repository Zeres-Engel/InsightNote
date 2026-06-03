FROM node:20-slim

WORKDIR /app

# Install dependencies first for better caching
COPY package.json package-lock.json* ./
# Use 'install' instead of 'ci' for dev to allow package-lock updates if missing
RUN npm install

# Copy the rest of the application
COPY . .

# Expose Vite's default dev port
EXPOSE 3000

# The command is handled by docker-compose for dev, but this is a sane default
CMD ["npm", "run", "dev", "--", "--host"]
