# Usa imagem Debian slim (evita falhas de compilação do bcrypt que ocorrem no Alpine)
FROM node:20-slim

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependência primeiro
COPY package*.json ./

# Instala as dependências limpas para a arquitetura do container
RUN npm install

# Copia o restante do código da aplicação
COPY . .

# Garante que a pasta uploads exista dentro do container
RUN mkdir -p /app/uploads

# Expõe a porta da API
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "run", "dev"]