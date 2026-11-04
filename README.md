# Instoke (Radar.SK8 / Stoke Community)

> Um ecossistema digital web full-stack que conecta a cultura do skate através de compartilhamento multimídia, geolocalização e interação social em tempo real.

O Instoke deixou de ser um "CRUD de portfólio" para se tornar uma plataforma robusta, dividida entre uma vitrine focada em performance (Vanilla JS) e um motor backend capaz de orquestrar dados relacionais complexos, tráfego pesado de mídias e lógicas de ecossistema B2B (Marcas) e B2C (Skatistas).

## 🏗️ Arquitetura e Decisões Técnicas

### Frontend (Interface e Experiência do Usuário)

* **Vanilla JS & Manipulação de DOM:** A aplicação foi construída sem frameworks pesados, garantindo o domínio de requisições assíncronas (Fetch API) e gerenciamento de estado.
* **Perfis Dinâmicos:** As páginas de perfil são renderizadas dinamicamente utilizando parâmetros de URL (ex: `?id=12`) e `Promise.all` para buscar simultaneamente os dados do usuário e sua galeria de mídias.


* **Upload e Conversão de Imagens:** O sistema utiliza conversão automática de imagens para o formato Base64 diretamente no cliente antes do envio.


* **Identidade Visual Segmentada:** O layout utiliza fundo escuro com destaques em Verde Néon para os perfis dos skatistas e Magenta/Rosa Néon para a identidade B2B das marcas cadastradas.



### Backend (API RESTful em Node.js)

* **Ambiente e Roteamento:** O servidor utiliza o Node.js como ambiente de execução (runtime) e o framework Express para gerenciar as rotas HTTP, operando localmente na porta 3000.


* **Controle de Carga e Infraestrutura:** Para evitar o erro `ER_NET_PACKET_TOO_LARGE` no envio das imagens em Base64, foi implementado um *bypass* executando a instrução `SET GLOBAL max_allowed_packet=134217728;` no momento da conexão, forçando o servidor a aceitar payloads gigantescos de até 128MB.


* **Integração Modularizada:** A comunicação com o banco de dados é feita através do driver `mysql2`, utilizando um arquivo de configuração isolado (`db.js`) para assegurar um código mais limpo.


* **Segurança e Termos de Uso:** O cadastro exige aceitação de um documento legal simplificado, visando a proteção de direitos de imagem e isenção de responsabilidade comercial.



### Banco de Dados (MySQL)

* **Modelagem Relacional Estruturada:** O banco de dados (`stoke_community`) foi modelado para garantir integridade referencial utilizando chaves estrangeiras com restrições `ON DELETE CASCADE`.


* **Consultas Eficientes:** A rota principal de Feed (`GET /feed`) utiliza consultas SQL com `JOIN` para buscar e combinar as mídias, curtidas, textos e dados do autor de uma só vez.


* **Segmentação de Tabelas:** O ecossistema possui tabelas dedicadas não só aos atletas (contendo dados de base, nível e curtidas), mas também às mídias e às marcas (incluindo segmento, contatos, site e logo). O banco opera localmente através do SGBD MySQL fornecido pelo XAMPP.



## ⚙️ Funcionalidades Implementadas

* **Feed Dinâmico e Contínuo:** Linha do tempo interativa no estilo *scroll* contínuo (ordenada pela data de registro via `ORDER BY data_cadastro DESC`), incluindo geração automática de hashtags com base na modalidade e nível do skatista.


* **Barra de Pesquisa em Tempo Real:** Filtro via JavaScript que permite pesquisar simultaneamente nomes, cidades, modalidades e biografias de forma instantânea, sem a necessidade de recarregar a página.


* **Sistema de Interações Básico:** Rotas para processar os "gostos/likes" no frontend (`PUT /skatistas/:id/curtir`) e registrar a contagem em tempo real na base de dados.


* **Cartões de Setup:** O perfil do atleta exibe componentes modulares (cartões) destacando o "Setup" do usuário, como o tipo de shape e truck.



## 🚀 Próximos Passos (Backlog Técnico e Produto)

* **Refinamento de UX/UI:** Implementar um modal/zoom para visualização ampliada de mídias com um clique na tela de perfil, e desenvolver um Menu Hambúrguer contendo navegação global para Feed, Campeonatos, Doações, Picos e Tutoriais.


* **Interação Social Avançada:** Construir um sistema de comentários completo para o Feed e corrigir possíveis inconsistências lógicas na atual contagem do sistema de curtidas.


* **Evolução do Algoritmo de Feed:** Planejar e executar a transição do atual feed cronológico puro para um feed baseado em relevância, que cruzará a quantidade de curtidas com a data de cadastro.


* **Governança e Moderação:** Implementar aprovação manual de contas com *status* (pendente/ativo) e regras de *shadowban* baseadas em denúncias, para mitigar proativamente a circulação de conteúdo impróprio (NSFW).
