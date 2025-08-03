FROM node:16-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5550

ENV NODE_ENV=production

CMD ["npm", "start"]
