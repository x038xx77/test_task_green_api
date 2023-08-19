FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
ENV PORT=3001
EXPOSE $PORT

CMD [ "npm", "start" ]
