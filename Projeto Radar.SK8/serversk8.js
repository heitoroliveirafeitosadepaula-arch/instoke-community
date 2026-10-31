const express = require('express');
const cors = require('cors');
const mysql = require('mysql2'); 
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

// ==========================================
// MIDDLEWARES (Configurações Gerais)
// ==========================================
app.use(cors());
app.use(express.json({ limit: '128mb' })); 
app.use(express.urlencoded({ limit: '128mb', extended: true }));

const pastaFrontend = path.join(__dirname, '../frontend-sk8');
app.use(express.static(pastaFrontend)); 

// ==========================================
// ROTA PRINCIPAL
// ==========================================
app.get('/', (req, res) => {
    res.sendFile(path.join(pastaFrontend, 'index.html'));
});

// ==========================================
// CONEXÃO COM O BANCO DE DADOS
// ==========================================
const db = mysql.createPool({ 
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'radar.sk8',
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
// ROTAS PÚBLICAS (NÃO PRECISAM DE TOKEN)
// ==========================================

// Feed, listar skatistas, perfis e picos continuam abertos para qualquer um ver
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
        SELECT c.id, c.texto, c.data_comentario, s.apelido, s.nome_completo, s.foto_perfil 
        FROM comentarios c JOIN skatistas s ON c.skatista_id = s.id
        WHERE c.midia_id = ? ORDER BY c.data_comentario ASC
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro interno no servidor.' });
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
// SISTEMA DE USUÁRIOS E AUTENTICAÇÃO
// ==========================================

app.post('/skatistas', async (req, res) => {
    const { nome_completo, email, senha, apelido, cidade_estado, base, modalidade, nivel_atual, instagram_arroba, video_destaque, tamanho_shape, marca_truck_favorita, foto_perfil, biografia } = req.body;
    try {
        const senhaCriptografada = await bcrypt.hash(senha, 10);
        const sql = `INSERT INTO skatistas (nome_completo, email, senha, apelido, cidade_estado, base, modalidade, nivel_atual, instagram_arroba, video_destaque, tamanho_shape, marca_truck_favorita, foto_perfil, biografia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.query(sql, [nome_completo, email, senhaCriptografada, apelido, cidade_estado, base, modalidade, nivel_atual, instagram_arroba, video_destaque, tamanho_shape, marca_truck_favorita, foto_perfil, biografia], (erro, resultados) => {
            if (erro) {
                if (erro.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'Este email já está registrado no Instoke!' });
                return res.status(500).json({ erro: 'Falha ao salvar no banco.' });
            }
            res.status(201).json({ mensagem: 'Skatista registado com sucesso!' });
        });
    } catch (erroGeral) {
        res.status(500).json({ erro: 'Erro interno ao processar o cadastro.' });
    }
});

app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    const sql = 'SELECT * FROM skatistas WHERE email = ?';
    db.query(sql, [email], async (erro, resultados) => {
        if (erro) return res.status(500).json({ erro: 'Erro interno no servidor.' });
        if (resultados.length === 0) return res.status(401).json({ erro: 'Email não encontrado. Cadastre-se primeiro!' });

        const skatista = resultados[0];
        const senhaValida = await bcrypt.compare(senha, skatista.senha);
        if (!senhaValida) return res.status(401).json({ erro: 'Senha incorreta. Tente novamente.' });

        const token = jwt.sign({ id: skatista.id }, 'chave_secreta_da_stoke', { expiresIn: '7d' });

        res.json({
            mensagem: 'Bem-vindo de volta ao Instoke!',
            token: token,
            usuario: { id: skatista.id, nome: skatista.nome_completo, apelido: skatista.apelido, email: skatista.email, foto: skatista.foto_perfil }
        });
    });
});

// ==========================================
// MIDDLEWARE: O "SEGURANÇA" DAS ROTAS
// ==========================================
function verificarToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ erro: "Acesso negado. Faça login." });

    jwt.verify(token, 'chave_secreta_da_stoke', (erro, decoded) => {
        if (erro) return res.status(401).json({ erro: "Sessão expirada ou inválida." });
        req.userId = decoded.id; // Salva o ID extraído do token para a rota usar
        next(); 
    });
}

// ==========================================
// ROTAS PROTEGIDAS (EXIGEM LOGIN / TOKEN)
// ==========================================

// Criar Pico Seguro (Usando ID do token)
app.post('/picos', verificarToken, (req, res) => {
    const { nome, descricao, latitude, longitude } = req.body;
    const criado_por = req.userId; // Vem do token, 100% seguro!
    
    const sql = 'INSERT INTO picos (nome, descricao, latitude, longitude, criado_por) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [nome, descricao, latitude, longitude, criado_por], (erro, resultados) => {
        if (erro) return res.status(500).json({ erro: 'Erro ao salvar o pico.' });
        res.status(201).json({ mensagem: 'Pico mapeado com sucesso! 🛹', id_pico: resultados.insertId });
    });
});

// Postar Mídia Segura (Usando ID do token)
app.post('/midias', verificarToken, (req, res) => {
    const { tipo, arquivo_base64, url_video, legenda } = req.body;
    const skatista_id = req.userId; // Vem do token!
    
    const sql = 'INSERT INTO midias (skatista_id, tipo, arquivo_base64, url_video, legenda) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [skatista_id, tipo, arquivo_base64, url_video, legenda], (erro, resultados) => {
        if (erro) return res.status(500).json({ erro: 'Falha ao salvar a mídia.' });
        res.status(201).json({ mensagem: 'Mídia publicada com sucesso no Instoke!', id_midia: resultados.insertId });
    });
});

// Comentar Seguro (Usando ID do token)
app.post('/midias/:id/comentarios', verificarToken, (req, res) => {
    const midia_id = req.params.id;
    const { texto } = req.body;
    const skatista_id = req.userId; // Vem do token!

    if (!texto) return res.status(400).json({ erro: 'O texto é obrigatório.' });

    const sql = 'INSERT INTO comentarios (midia_id, skatista_id, texto) VALUES (?, ?, ?)';
    db.query(sql, [midia_id, skatista_id, texto], (err, result) => {
        if (err) return res.status(500).json({ erro: 'Erro interno no servidor.' });
        res.status(201).json({ mensagem: 'Comentário adicionado com sucesso!', id_comentario: result.insertId });
    });
});

// Editar Perfil Seguro (Impede de editar perfil dos outros)
app.put('/skatistas/:id', verificarToken, (req, res) => {
    const idSkatista = req.params.id;
    
    // TRAVA DE SEGURANÇA: O cara logado está tentando editar o próprio perfil?
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

// Curtir Mídia Seguro (Exige estar logado)
app.put('/midias/:id/curtir', verificarToken, (req, res) => {
    const sql = 'UPDATE midias SET curtidas = curtidas + 1 WHERE id = ?';
    db.query(sql, [req.params.id], (erro) => {
        if (erro) return res.status(500).json({ erro: 'Erro ao dar props na mídia.' });
        res.json({ mensagem: 'Props dados com sucesso!' });
    });
});

// Curtir Skatista Seguro (Exige estar logado)
app.put('/skatistas/:id/curtir', verificarToken, (req, res) => {
    const sql = 'UPDATE skatistas SET curtidas = curtidas + 1 WHERE id = ?';
    db.query(sql, [req.params.id], (erro) => {
        if (erro) return res.status(500).json({ erro: 'Falha ao processar o like.' });
        res.json({ mensagem: 'Curtiu com sucesso!' });
    });
});

// Cadastrar Marca Seguro (Exige estar logado)
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

