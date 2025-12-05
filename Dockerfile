FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY ormconfig.sql ./ormconfig.sql
COPY scripts ./scripts

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/src/index.js"]
