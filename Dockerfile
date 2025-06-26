FROM node:22.17.0

WORKDIR /app

COPY package*.json ./

RUN npm install --force


# Rebuild bcrypt for the container environment
RUN npm rebuild bcrypt --build-from-source

COPY . .

EXPOSE 3000

ENV PATH /app/node_modules/.bin:$PATH


CMD ["npm", "run", "dev"]
