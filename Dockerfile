# Use uma imagem base Node.js LTS
FROM node:19-bullseye

# Crie e defina o diretório de trabalho
WORKDIR /usr/src/app

# Copie o package.json e o package-lock.json (se existir)
COPY package*.json ./

# Instale as dependências
RUN npm install

# Copie o código-fonte para o contêiner
COPY . .

# Compile o código TypeScript
RUN npm run build

# Exponha a porta que o aplicativo vai usar
EXPOSE 4000

# Comando para iniciar o aplicativo
CMD ["npm", "start"]
