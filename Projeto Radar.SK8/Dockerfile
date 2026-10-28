# Usa uma imagem oficial do Node.js leve
FROM node:18-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependência primeiro (para aproveitar o cache do Docker)
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código da aplicação
COPY . .

# Expõe a porta que a sua API roda (ex: 3000)
EXPOSE 3000

# Comando para iniciar a aplicação (ajuste para o seu script de dev, ex: npm run start)
CMD ["npm", "run", "dev"]