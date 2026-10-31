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
const PORT = 3000;

// ==========================================
// CONFIGURAÇÃO DE UPLOAD DE ARQUIVOS (MULTER)
// ==========================================
const pastaUploads = path.join(__dirname, 'uploads');
if (!fs.existsSync(pastaUploads)) {
    fs.mkdirSync(pastaUploads);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, pastaUploads),
    filename: (req, file, cb) => {
        const extensao = path.extname(file.originalname);
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + extensao);
    }
});
const upload = multer({ storage }); // <-- É ESTA VARIÁVEL QUE O NODE ESTÁ PROCURANDO!

// ==========================================
// MIDDLEWARES (Configurações Gerais)
// ==========================================
app.use(cors());
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// Configura a pasta do frontend e a de uploads para servirem arquivos estáticos
app.use(express.static(path.join(__dirname, 'frontend-sk8'))); 
// Garanta que esta linha exata existe no seu serversk8.js:
app.use('/uploads', express.static(pastaUploads));

// ==========================================
// CONEXÃO COM O BANCO DE DADOS (POOL)
// ==========================================
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'sua_senha_aqui',
  database: process.env.DB_NAME || 'stoke_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((erro, connection) => {
    if (erro) {
        console.error('Erro ao conectar ao banco de dados:', erro);
        return;
    }
    console.log('Conectado ao banco de dados (Instoke) via POOL! Adeus quedas de conexão! 🛹');

    connection.query("SET GLOBAL max_allowed_packet=134217728;", (err) => {
        if (err) {
            console.error("Aviso: Não foi possível forçar o limite via código:", err);
        } else {
            console.log("🔥 Limite do MySQL destravado para 128MB com sucesso!");
        }
        connection.release();
    });
});

// ==========================================
// ROTA PRINCIPAL (Frontend)
// ==========================================
const pastaFrontend = path.join(__dirname, 'frontend-sk8'); // Garante que a pasta existe

app.get('/', (req, res) => {
  res.sendFile(path.join(pastaFrontend, 'index.html'));
});

// ==========================================
// ROTAS PÚBLICAS (NÃO PRECISAM DE TOKEN)
// ==========================================
app.get('/skatistas', (req, res) => {
    const sql = 'SELECT * FROM skatistas ORDER BY curtidas DESC, id DESC';
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
    const sql = 'SELECT * FROM skatistas WHERE id = ?';
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
        if (erro) return res.status(500).json({ erro: 'Erro ao buscar o feed.' });
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

    // 1. Busca o skatista pelo email
    const sql = 'SELECT * FROM skatistas WHERE email = ?';
    
    db.query(sql, [email], async (erro, resultados) => {
        if (erro) {
            console.error("🔥 Erro no MySQL durante o login:", erro);
            return res.status(500).json({ erro: 'Erro interno no banco de dados.' });
        }

        // 2. Se o email não existir no banco
        if (resultados.length === 0) {
            return res.status(401).json({ erro: 'Email ou senha incorretos.' });
        }

        const skatista = resultados[0];

        try {
            // 3. Compara a senha digitada com a senha criptografada (bcrypt) do banco
            const senhaValida = await bcrypt.compare(senha, skatista.senha);
            
            if (!senhaValida) {
                return res.status(401).json({ erro: 'Email ou senha incorretos.' });
            }

            // 4. Cria o Token JWT (A pulseira VIP do usuário)
            // A chave secreta 'chave_secreta_sk8' pode ser qualquer texto complexo depois.
            const token = jwt.sign(
                { id: skatista.id, email: skatista.email }, 
                'chave_secreta_sk8', 
                { expiresIn: '7d' } // O login dura 7 dias
            );

            // 5. Remove a senha dos dados antes de mandar pro frontend por segurança
            delete skatista.senha;

            // 6. Devolve o sucesso em JSON perfeito!
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
    // Pegamos os dados e garantimos valores padrão caso venham vazios/undefined do FormData
    const { 
        nome_completo, 
        email, 
        senha, 
        apelido = '', 
        cidade_estado = '', 
        base = 'Regular', 
        modalidade = '', 
        nivel_atual = '', 
        instagram_arroba = '', 
        video_destaque = '', 
        tamanho_shape = '', 
        marca_truck_favorita = '', 
        biografia = '' 
    } = req.body;
    
    // Validação básica de segurança
    if (!senha || !email || !nome_completo) {
        return res.status(400).json({ erro: 'Preencha os campos obrigatórios (Email, Senha, Nome Completo).' });
    }

    // Se o Multer salvou o arquivo físico, guardamos o caminho web. Senão, fica null.
    const foto_perfil_url = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const senhaCriptografada = await bcrypt.hash(senha, 10);
        const sql = `INSERT INTO skatistas (nome_completo, email, senha, apelido, cidade_estado, base, modalidade, nivel_atual, instagram_arroba, video_destaque, tamanho_shape, marca_truck_favorita, foto_perfil, biografia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        db.query(sql, [
            nome_completo, 
            email, 
            senhaCriptografada, 
            apelido, 
            cidade_estado, 
            base, 
            modalidade, 
            nivel_atual, 
            instagram_arroba, 
            video_destaque, 
            tamanho_shape, 
            marca_truck_favorita, 
            foto_perfil_url, 
            biografia
        ], (erro) => {
            if (erro) {
                console.error("🔥 ERRO MYSQL NO CADASTRO:", erro);
                if (erro.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ erro: 'Este email já está registrado no Instoke!' });
                }
                return res.status(500).json({ erro: 'Falha ao salvar no banco.', detalhes: erro.message });
            }
            res.status(201).json({ mensagem: 'Skatista registado com sucesso!' });
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
        token = token.slice(7, token.length).trimLeft();
    }

    // CORREÇÃO: A chave deve ser a MESMA usada no login!
    jwt.verify(token, 'chave_secreta_sk8', (erro, decoded) => {
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

// CORREÇÃO: Rota atualizada para usar o Multer e salvar o arquivo físico
app.post('/midias', verificarToken, upload.single('arquivo'), (req, res) => {
    const { legenda, tipo = 'imagem' } = req.body;
    const skatista_id = req.userId; 
    
    // Se o Multer salvou, pegamos a URL. Se não tem arquivo, devolvemos erro.
    if (!req.file) {
        return res.status(400).json({ erro: 'Você precisa enviar uma imagem ou vídeo para postar!' });
    }
    
    const url_arquivo = `/uploads/${req.file.filename}`;
    
    // Inserindo o caminho web da foto na coluna arquivo_base64 (ou mude o nome da coluna no banco depois)
    const sql = 'INSERT INTO midias (skatista_id, tipo, arquivo_base64, legenda) VALUES (?, ?, ?, ?)';
    db.query(sql, [skatista_id, tipo, url_arquivo, legenda], (erro, resultados) => {
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

app.put('/skatistas/:id', verificarToken, (req, res) => {
    const idSkatista = req.params.id;
    
    if (req.userId !== parseInt(idSkatista)) {
        return res.status(403).json({ erro: 'Você não tem permissão para alterar este perfil.' });
    }

    const { apelido, cidade_estado, base, modalidade, nivel_atual, instagram_arroba, video_destaque, tamanho_shape, marca_truck_favorita, foto_perfil, biografia } = req.body;
    const sql = `UPDATE skatistas SET apelido=?, cidade_estado=?, base=?, modalidade=?, nivel_atual=?, instagram_arroba=?, video_destaque=?, tamanho_shape=?, marca_truck_favorita=?, foto_perfil=?, biografia=? WHERE id=?`;

    db.query(sql, [apelido, cidade_estado, base, modalidade, nivel_atual, instagram_arroba, video_destaque, tamanho_shape, marca_truck_favorita, foto_perfil, biografia, idSkatista], (erro) => {
        if (erro) return res.status(500).json({ erro: 'Falha ao atualizar o perfil.' });
        res.json({ mensagem: 'Perfil atualizado com sucesso! 🛹' });
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
        res.status(201).json({ mensagem: 'Marca registada com sucesso no Ecossistema!' });
    });
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Instoke API no ar na porta ${PORT} 🔥`);
});