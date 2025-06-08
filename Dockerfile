# Base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first (better for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the application code
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Default environment variable file
ENV NODE_ENV=production

# Start the app
CMD ["npm", "start"]
