🛹 Skate APIUma API RESTful desenvolvida para conectar a comunidade do skate, permitindo o gerenciamento de skatistas, mapeamento de picos (spots) e organização de campeonatos.✨ FuncionalidadesSkatistas: Cadastro e listagem de perfis de skatistas.Spots: Registro de pistas de skate e picos de rua com localização.Campeonatos: Organização e listagem de eventos da cena do skate.🚀 TecnologiasNode.jsExpress.jsMySQL (com driver mysql2)⚙️ Pré-requisitosCertifique-se de ter instalado em sua máquina:Node.jsServidor MySQL (como XAMPP ou MySQL Workbench)🛠️ Como Executar LocalmenteClone o repositório:git clone <url-do-repositorio>
cd <nome-da-pasta>
Instale as dependências:npm install
Configure as Variáveis de Ambiente:
Crie um arquivo .env na raiz do projeto e configure o acesso ao seu banco de dados local:PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=skate_api_db
Inicie o servidor:npm run dev
A API estará rodando em http://localhost:3000.📌 Documentação da API (Endpoints)Abaixo estão as principais rotas disponíveis na aplicação:MétodoRotaDescriçãoGET/skatistasRetorna a lista de todos os skatistas.POST/skatistasCadastra um novo skatista.GET/spotsRetorna todos os spots de skate cadastrados.POST/spotsCadastra um novo spot (pista ou pico de rua).GET/campeonatosRetorna os próximos campeonatos e eventos.POST/campeonatosCria um novo campeonato.Exemplo de Requisição (POST /skatistas){
  "nome": "Bob Burnquist",
  "base": "Goofy",
  "modalidade": "Mega Rampa"
}
📝 LicençaEste projeto está sob a licença MIT.
