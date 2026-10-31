CREATE TABLE IF NOT EXISTS skatistas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    senha VARCHAR(255),
    apelido VARCHAR(100),
    cidade_estado VARCHAR(100),
    base VARCHAR(50),
    modalidade VARCHAR(100),
    nivel_atual VARCHAR(100),
    instagram_arroba VARCHAR(100),
    video_destaque VARCHAR(255),
    tamanho_shape VARCHAR(50),
    marca_truck_favorita VARCHAR(100),
    foto_perfil LONGTEXT,
    biografia TEXT,
    curtidas INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS midias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    skatista_id INT,
    tipo VARCHAR(50),
    arquivo_base64 LONGTEXT,
    url_video VARCHAR(255),
    legenda TEXT,
    curtidas INT DEFAULT 0,
    data_publicacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (skatista_id) REFERENCES skatistas(id)
);

CREATE TABLE IF NOT EXISTS comentarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    midia_id INT,
    skatista_id INT,
    texto TEXT,
    data_comentario TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (midia_id) REFERENCES midias(id),
    FOREIGN KEY (skatista_id) REFERENCES skatistas(id)
);

CREATE TABLE IF NOT EXISTS picos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255),
    descricao TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    criado_por INT,
    FOREIGN KEY (criado_por) REFERENCES skatistas(id)
);

CREATE TABLE IF NOT EXISTS marcas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_marca VARCHAR(255),
    segmento VARCHAR(100),
    instagram_marca VARCHAR(100),
    site_url VARCHAR(255),
    email_contato VARCHAR(150),
    descricao_marca TEXT,
    logo_marca LONGTEXT
);