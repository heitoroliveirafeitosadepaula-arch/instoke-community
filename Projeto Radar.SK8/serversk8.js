// ==========================================
// IMPORTAÇÕES E CONFIGURAÇÕES INICIAIS
// ==========================================
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2'); 
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_sk8';

// ==========================================
// CONFIGURAÇÃO DE UPLOAD DE ARQUIVOS (MULTER)
// ==========================================
const pastaUploads = path.join(__dirname, 'uploads');
if (!fs.existsSync(pastaUploads)) {
    fs.mkdirSync(pastaUploads, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, pastaUploads),
    filename: (req, file, cb) => {
        const extensao = path.extname(file.originalname);
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + extensao);
    }
});
const upload = multer({ storage });

// ==========================================
// MIDDLEWARES (Configurações Gerais)
// ==========================================
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const pastaFrontend = path.join(__dirname, 'frontend-sk8');
app.use(express.static(pastaFrontend)); 
app.use('/uploads', express.static(pastaUploads));

// ==========================================
// CONEXÃO COM O BANCO DE DADOS (POOL)
// ==========================================
// Os valores padrão abaixo agora batem 100% com o docker-compose.yml
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'sua_senha_aqui', 
    database: process.env.DB_NAME || 'stoke_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Inicialização segura e criação automática de tabelas se não existirem
function inicializarBanco() {
    db.getConnection((erro, connection) => {
        if (erro) {
            console.error('⏳ Banco ainda não disponível, tentando novamente em 3 segundos...', erro.message);
            setTimeout(inicializarBanco, 3000);
            return;
        }
        console.log('Conectado ao banco de dados (Instoke) via POOL! 🛹');

        connection.query("SET GLOBAL max_allowed_packet=134217728;", (err) => {
            if (!err) console.log("🔥 Limite do MySQL destravado para 128MB!");
        });

        // Garante que as tabelas existam para não quebrar as rotas
        const tabelas = [
            `CREATE TABLE IF NOT EXISTS skatistas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome_completo VARCHAR(150) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                senha VARCHAR(255) NOT NULL,
                apelido VARCHAR(100) DEFAULT '',
                cidade_estado VARCHAR(100) DEFAULT '',
                base VARCHAR(30) DEFAULT 'Regular',
                modalidade VARCHAR(100) DEFAULT '',
                nivel_atual VARCHAR(50) DEFAULT '',
                instagram_arroba VARCHAR(100) DEFAULT '',
                video_destaque VARCHAR(255) DEFAULT '',
                tamanho_shape VARCHAR(20) DEFAULT '',
                marca_truck_favorita VARCHAR(100) DEFAULT '',
                foto_perfil LONGTEXT,
                biografia TEXT,
                curtidas INT DEFAULT 0,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS midias (
                id INT AUTO_INCREMENT PRIMARY KEY,
                skatista_id INT NOT NULL,
                tipo VARCHAR(30) DEFAULT 'imagem',
                arquivo_base64 LONGTEXT,
                url_video VARCHAR(255) DEFAULT NULL,
                legenda TEXT,
                curtidas INT DEFAULT 0,
                data_publicacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (skatista_id) REFERENCES skatistas(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS comentarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                midia_id INT NOT NULL,
                skatista_id INT NOT NULL,
                texto TEXT NOT NULL,
                data_comentario TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (midia_id) REFERENCES midias(id) ON DELETE CASCADE,
                FOREIGN KEY (skatista_id) REFERENCES skatistas(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS picos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(150) NOT NULL,
                descricao TEXT,
                latitude DECIMAL(10, 8) NOT NULL,
                longitude DECIMAL(11, 8) NOT NULL,
                criado_por INT,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS marcas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome_marca VARCHAR(150) NOT NULL,
                segmento VARCHAR(100),
                instagram_marca VARCHAR(100),
                site_url VARCHAR(255),
                email_contato VARCHAR(150),
                descricao_marca TEXT,
                logo_marca LONGTEXT,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        tabelas.forEach(sql => {
            connection.query(sql, (errTabela) => {
                if (errTabela) console.error("Erro ao verificar/criar tabela:", errTabela.message);
            });
        });

        connection.release();
    });
}

inicializarBanco();

// ==========================================
// ROTA PRINCIPAL (Frontend)
// ==========================================
app.get('/', (req, res) => {
    res.sendFile(path.join(pastaFrontend, 'index.html'));
});

// ==========================================
// ROTAS PÚBLICAS (NÃO PRECISAM DE TOKEN)
// ==========================================
app.get('/skatistas', (req, res) => {
    // Segurança: Seleciona todos os campos EXCETO a senha
    const sql = `
        SELECT id, nome_completo, email, apelido, cidade_estado, base, modalidade, 
               nivel_atual, instagram_arroba, video_destaque, tamanho_shape, 
               marca_truck_favorita, foto_perfil, biografia, curtidas 
        FROM skatistas 
        ORDER BY curtidas DESC, id DESC
    `;
    db.query(sql, (erro, resultados) => {
        if (erro) return res.status(500).json({ erro: 'Falha ao buscar skatistas.' });
        res.json(resultados);
    });
});

app.get('/skatistas/:id/midias', (req, res) => {
    const sql = 'SELECT * FROM midias WHERE skatista_id = ? ORDER BY data_publicacao DESC';
    db.query(sql, [req.params.id], (erro, resultados) => {
        if (erro) return res.status(500).json({ erro: 'Erro ao buscar as mídias.' });
        res.json(resultados);
    });
});

app.get('/skatistas/:id', (req, res) => {
    const sql = `
        SELECT id, nome_completo, email, apelido, cidade_estado, base, modalidade, 
               nivel_atual, instagram_arroba, video_destaque, tamanho_shape, 
               marca_truck_favorita, foto_perfil, biografia, curtidas 
        FROM skatistas 
        WHERE id = ?
    `;
    db.query(sql, [req.params.id], (erro, resultados) => {
        if (erro) return res.status(500).json({ erro: 'Erro ao buscar o skatista.' });
        if (resultados.length === 0) return res.status(404).json({ erro: 'Skatista não encontrado.' });
        res.json(resultados[0]);
    });
});

app.get('/feed', (req, res) => {
    const sql = `
        SELECT m.id AS midia_id, m.tipo, m.arquivo_base64, m.url_video, m.legenda, m.curtidas, m.data_publicacao,
               s.id AS skatista_id, s.nome_completo, s.apelido, s.base, s.cidade_estado, s.instagram_arroba, s.foto_perfil
        FROM midias m
        JOIN skatistas s ON m.skatista_id = s.id
        ORDER BY m.data_publicacao DESC
    `;
    db.query(sql, (erro, resultados) => {
        if (erro) {
            console.error("🔥 Erro na query do /feed:", erro);
            return res.status(500).json({ erro: 'Erro ao buscar o feed.' });
        }
        res.json(resultados);
    });
});

app.get('/midias/:id/comentarios', (req, res) => {
    const sql = `
        SELECT c.id, c.texto, c.data_comentario, c.skatista_id, s.apelido, s.nome_completo, s.foto_perfil 
        FROM comentarios c 
        JOIN skatistas s ON c.skatista_id = s.id
        WHERE c.midia_id = ? 
        ORDER BY c.data_comentario ASC
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) {
            console.error("🔥 Erro ao buscar comentários no MySQL:", err);
            return res.status(500).json({ erro: 'Erro interno no servidor.' });
        }
        res.status(200).json(results);
    });
});

app.get('/picos', (req, res) => {
    const sql = 'SELECT * FROM picos';
    db.query(sql, (erro, resultados) => {
        if (erro) return res.status(500).json({ erro: 'Erro ao buscar os picos.' });
        res.json(resultados);
    });
});

// ==========================================
// ROTA DE LOGIN DO INSTOKE
// ==========================================
app.post('/login', (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: 'Preencha o email e a senha para entrar.' });
    }

    const sql = 'SELECT * FROM skatistas WHERE email = ?';
    
    db.query(sql, [email], async (erro, resultados) => {
        if (erro) {
            console.error("🔥 Erro no MySQL durante o login:", erro);
            return res.status(500).json({ erro: 'Erro interno no banco de dados.' });
        }

        if (resultados.length === 0) {
            return res.status(401).json({ erro: 'Email ou senha incorretos.' });
        }

        const skatista = resultados[0];

        try {
            const senhaValida = await bcrypt.compare(senha, skatista.senha);
            
            if (!senhaValida) {
                return res.status(401).json({ erro: 'Email ou senha incorretos.' });
            }

            const token = jwt.sign(
                { id: skatista.id, email: skatista.email }, 
                JWT_SECRET, 
                { expiresIn: '7d' }
            );

            delete skatista.senha;

            res.status(200).json({
                mensagem: 'Login aprovado! Bem-vindo de volta.',
                token: token,
                usuario: skatista
            });

        } catch (erroBcrypt) {
            console.error("🔥 Erro ao validar criptografia:", erroBcrypt);
            return res.status(500).json({ erro: 'Erro interno ao validar as credenciais.' });
        }
    });
});

// ==========================================
// SISTEMA DE USUÁRIOS E AUTENTICAÇÃO
// ==========================================
app.post('/skatistas', upload.single('foto_perfil'), async (req, res) => {
    const { 
        nome_completo, email, senha, apelido = '', cidade_estado = '', 
        base = 'Regular', modalidade = '', nivel_atual = '', instagram_arroba = '', 
        video_destaque = '', tamanho_shape = '', marca_truck_favorita = '', biografia = '' 
    } = req.body;
    
    if (!senha || !email || !nome_completo) {
        return res.status(400).json({ erro: 'Preencha os campos obrigatórios (Email, Senha, Nome Completo).' });
    }

    const foto_perfil_url = req.file ? `/uploads/${req.file.filename}` : (req.body.foto_perfil || null);

    try {
        const senhaCriptografada = await bcrypt.hash(senha, 10);
        const sql = `INSERT INTO skatistas (nome_completo, email, senha, apelido, cidade_estado, base, modalidade, nivel_atual, instagram_arroba, video_destaque, tamanho_shape, marca_truck_favorita, foto_perfil, biografia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        db.query(sql, [
            nome_completo, email, senhaCriptografada, apelido, cidade_estado, base, 
            modalidade, nivel_atual, instagram_arroba, video_destaque, tamanho_shape, 
            marca_truck_favorita, foto_perfil_url, biografia
        ], (erro) => {
            if (erro) {
                console.error("🔥 ERRO MYSQL NO CADASTRO:", erro);
                if (erro.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ erro: 'Este email já está registrado no Instoke!' });
                }
                return res.status(500).json({ erro: 'Falha ao salvar no banco.', detalhes: erro.message });
            }
            res.status(201).json({ mensagem: 'Skatista registrado com sucesso!' });
        });
    } catch (erroGeral) {
        console.error("🔥 ERRO NO BCRYPT/SERVIDOR:", erroGeral);
        res.status(500).json({ erro: 'Erro interno ao processar o cadastro.', detalhes: erroGeral.message });
    }
});

// ==========================================
// MIDDLEWARE: O "SEGURANÇA" DAS ROTAS
// ==========================================
function verificarToken(req, res, next) {
    let token = req.headers['authorization'];
    if (!token) return res.status(403).json({ erro: "Acesso negado. Faça login." });

    if (token.startsWith('Bearer ')) {
        token = token.slice(7).trimStart();
    }

    jwt.verify(token, JWT_SECRET, (erro, decoded) => {
        if (erro) return res.status(401).json({ erro: "Sessão expirada ou inválida." });
        req.userId = decoded.id; 
        next(); 
    });
}

// ==========================================
// ROTAS PROTEGIDAS (EXIGEM LOGIN / TOKEN)
// ==========================================
app.post('/picos', verificarToken, (req, res) => {
    const { nome, descricao, latitude, longitude } = req.body;
    const criado_por = req.userId; 
    
    const sql = 'INSERT INTO picos (nome, descricao, latitude, longitude, criado_por) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [nome, descricao, latitude, longitude, criado_por], (erro, resultados) => {
        if (erro) return res.status(500).json({ erro: 'Erro ao salvar o pico.' });
        res.status(201).json({ mensagem: 'Pico mapeado com sucesso! 🛹', id_pico: resultados.insertId });
    });
});

app.post('/midias', verificarToken, upload.single('arquivo'), (req, res) => {
    const { legenda = '', tipo = 'imagem', url_video = null, arquivo_base64 = null } = req.body;
    const skatista_id = req.userId; 
    
    const midiaFinal = req.file ? `/uploads/${req.file.filename}` : arquivo_base64;

    if (!midiaFinal && !url_video) {
        return res.status(400).json({ erro: 'Você precisa enviar uma imagem ou link de vídeo para postar!' });
    }
    
    const sql = 'INSERT INTO midias (skatista_id, tipo, arquivo_base64, url_video, legenda) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [skatista_id, tipo, midiaFinal, url_video, legenda], (erro, resultados) => {
        if (erro) {
            console.error("🔥 Erro ao salvar postagem no banco:", erro);
            return res.status(500).json({ erro: 'Falha ao salvar a mídia.' });
        }
        res.status(201).json({ mensagem: 'Mídia publicada com sucesso no Instoke!', id_midia: resultados.insertId });
    });
});

app.post('/midias/:id/comentarios', verificarToken, (req, res) => {
    const midia_id = req.params.id;
    const { texto } = req.body;
    const skatista_id = req.userId; 

    if (!texto || texto.trim() === '') {
        return res.status(400).json({ erro: 'O texto do comentário é obrigatório.' });
    }

    const sql = 'INSERT INTO comentarios (midia_id, skatista_id, texto) VALUES (?, ?, ?)';
    db.query(sql, [midia_id, skatista_id, texto], (err, result) => {
        if (err) {
            console.error("🔥 Erro ao salvar comentário:", err);
            return res.status(500).json({ erro: 'Erro interno no servidor.' });
        }
        res.status(201).json({ mensagem: 'Comentário adicionado com sucesso!', id_comentario: result.insertId });
    });
});

app.put('/skatistas/:id', verificarToken, upload.single('foto_perfil'), (req, res) => {
    const idSkatista = req.params.id;
    
    if (req.userId !== parseInt(idSkatista, 10)) {
        return res.status(403).json({ erro: 'Você não tem permissão para alterar este perfil.' });
    }

    const { 
        apelido = '', cidade_estado = '', base = 'Regular', modalidade = '', 
        nivel_atual = '', instagram_arroba = '', video_destaque = '', 
        tamanho_shape = '', marca_truck_favorita = '', biografia = '', foto_perfil 
    } = req.body;

    // Se enviou um arquivo novo pelo Multer, usa o caminho novo.
    // Se não enviou arquivo novo, mantém a foto atual no banco usando COALESCE!
    const novaFoto = req.file ? `/uploads/${req.file.filename}` : (foto_perfil || null);

    const sql = `
        UPDATE skatistas 
        SET apelido = ?, 
            cidade_estado = ?, 
            base = ?, 
            modalidade = ?, 
            nivel_atual = ?, 
            instagram_arroba = ?, 
            video_destaque = ?, 
            tamanho_shape = ?, 
            marca_truck_favorita = ?, 
            foto_perfil = COALESCE(?, foto_perfil), 
            biografia = ? 
        WHERE id = ?
    `;

    db.query(sql, [
        apelido, cidade_estado, base, modalidade, nivel_atual, 
        instagram_arroba, video_destaque, tamanho_shape, 
        marca_truck_favorita, novaFoto, biografia, idSkatista
    ], (erro) => {
        if (erro) {
            console.error("🔥 Erro ao atualizar perfil no MySQL:", erro);
            return res.status(500).json({ erro: 'Falha ao atualizar o perfil.' });
        }
        res.json({ 
            mensagem: 'Perfil atualizado com sucesso! 🛹',
            foto_perfil: novaFoto
        });
    });
});

app.put('/midias/:id/curtir', verificarToken, (req, res) => {
    const sql = 'UPDATE midias SET curtidas = curtidas + 1 WHERE id = ?';
    db.query(sql, [req.params.id], (erro) => {
        if (erro) return res.status(500).json({ erro: 'Erro ao dar props na mídia.' });
        res.json({ mensagem: 'Props dados com sucesso!' });
    });
});

app.put('/skatistas/:id/curtir', verificarToken, (req, res) => {
    const sql = 'UPDATE skatistas SET curtidas = curtidas + 1 WHERE id = ?';
    db.query(sql, [req.params.id], (erro) => {
        if (erro) return res.status(500).json({ erro: 'Falha ao processar o like.' });
        res.json({ mensagem: 'Curtiu com sucesso!' });
    });
});

app.post('/marcas', verificarToken, (req, res) => {
    const { nome_marca, segmento, instagram_marca, site_url, email_contato, descricao_marca, logo_marca } = req.body;
    const sql = `INSERT INTO marcas (nome_marca, segmento, instagram_marca, site_url, email_contato, descricao_marca, logo_marca) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [nome_marca, segmento, instagram_marca, site_url, email_contato, descricao_marca, logo_marca], (erro) => {
        if (erro) return res.status(500).json({ erro: 'Falha ao salvar a marca.' });
        res.status(201).json({ mensagem: 'Marca registrada com sucesso no Ecossistema!' });
    });
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Instoke API no ar na porta ${PORT} 🔥`);
});