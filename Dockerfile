FROM node:20-slim
WORKDIR /app
# Csak a package fájlokat másoljuk először (gyorsabb build)
COPY package*.json ./
RUN npm install
# Másoljuk a többi fájlt
COPY . .
# A Node.js a 3001-es porton fog figyelni (vagy amit a server.js-ben hagytál)
EXPOSE 3001
CMD ["node", "server.js"]
