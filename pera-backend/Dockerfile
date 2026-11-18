FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --chown=node:node *.mjs ./
COPY --chown=node:node pruebas ./pruebas
USER node
CMD ["node", "servidor.mjs"]
