require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const app = express();


app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

app.use(session({
    secret: process.env.SESSION_SECRET || 'Crypt-2026-Eduard',
    resave: false,
    saveUninitialized: true
}));

// Configuração do pool de conexões com MySQL no Aiven
const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Configura SSL de forma flexível
if (process.env.CA_CERT) {
    // Se a variável CA_CERT existir (configurada no Railway), usa o certificado
    dbConfig.ssl = { ca: process.env.CA_CERT };
    console.log('✅ Usando certificado CA da variável de ambiente');
} else if (process.env.NODE_ENV === 'production') {
    // Em produção sem CA_CERT, desabilita verificação (apenas para testes)
    dbConfig.ssl = { rejectUnauthorized: false };
    console.log('⚠️ Produção: SSL sem verificação de certificado');
} else {
    // Localmente, tenta usar o arquivo ca.pem se existir
    try {
        if (fs.existsSync('./ca.pem')) {
            dbConfig.ssl = { ca: fs.readFileSync('./ca.pem') };
            console.log('✅ Usando certificado CA do arquivo ca.pem');
        } else {
            console.log('⚠️ Local: ca.pem não encontrado, usando SSL sem verificação');
            dbConfig.ssl = { rejectUnauthorized: false };
        }
    } catch (err) {
        console.log('🔴 Erro ao ler ca.pem:', err.message);
        dbConfig.ssl = { rejectUnauthorized: false };
    }
}

const db = mysql.createPool(dbConfig);

// Tratamento de erros no pool
db.on('error', (err) => {
    console.error('❌ Erro no pool do MySQL:', err.message);
});

// ========== ROTAS ==========

app.get('/', (req, res) => {
    if (!req.session.usuarioId) return res.redirect('/login');
    res.redirect('/votar');
});

app.get('/registro', (req, res) => res.render('res', { erro: null }));

app.post('/registro', async (req, res) => {
    const { nome, email, senha } = req.body;
    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        await db.query(`INSERT INTO user (nome, email, senha) VALUES (?, ?, ?)`, [nome, email, senhaHash]);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.render('res', { erro: 'Email já cadastrado ou erro no servidor' });
    }
});

app.get('/login', (req, res) => res.render('login', { erro: null }));

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const [usuarios] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
        if (usuarios.length > 0) {
            const usuario = usuarios[0];
            const senhaOk = await bcrypt.compare(senha, usuario.senha);
            if (senhaOk) {
                req.session.usuarioId = usuario.id;
                req.session.usuarioName = usuario.nome;
                return res.redirect('/');
            }
        }
        res.render('login', { erro: 'Email ou senha incorretos!' });
    } catch (err) {
        console.error(err);
        res.render('login', { erro: 'Erro interno, tente novamente' });
    }
});

app.get('/votar', (req, res) => {
    if (!req.session.usuarioId) return res.redirect('/login');
    res.render('index', { nome: req.session.usuarioName, erro: null });
});

app.post('/votar', async (req, res) => {
    const { pr, sc, es } = req.body;
    try {
        await db.query('INSERT INTO p_votos(p_id) VALUES (?)', [pr]);
        await db.query('INSERT INTO s_votos(s_id) VALUES (?)', [sc]);
        await db.query('INSERT INTO e_votos(e_id) VALUES (?)', [es]);
        res.redirect('/logout');
    } catch (err) {
        console.error(err);
        res.render('index', { nome: req.session.usuarioName, erro: 'Falha ao votar' });
    }
});

app.get('/resultados', async (req, res) => {
    if (!req.session.autNome) return res.redirect('/credenciais');
    try {
        const [pr] = await db.query(`
            SELECT p.nome, COUNT(v.id) AS total 
            FROM pres p 
            LEFT JOIN p_votos v ON p.id = v.p_id 
            GROUP BY p.id
        `);
        const [sc] = await db.query(`
            SELECT s.nome, COUNT(v.id) AS total 
            FROM sec s 
            LEFT JOIN s_votos v ON s.id = v.s_id 
            GROUP BY s.id
        `);
        const [es] = await db.query(`
            SELECT m.nome, COUNT(v.id) AS total 
            FROM est m 
            LEFT JOIN e_votos v ON m.id = v.e_id 
            GROUP BY m.id
        `);
        res.render('resultados', { user: req.session.usuarioName, pres: pr, sec: sc, est: es });
    } catch (err) {
        console.error(err);
        res.send('Falha ao carregar resultados');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.send(`
        <h2>✅ Voto registrado com sucesso!</h2>
        <p><a href="/credenciais">🔐 Ver resultados (área restrita)</a></p>
        <p><a href="/login">👤 Novo usuário? Faça login</a></p>
    `);
});

app.get('/credenciais', (req, res) => {
    res.render('credenciais', { erro: null });
});

app.post('/credenciais', async (req, res) => {
    const { user, chave } = req.body;
    try {
        const [credenciados] = await db.query('SELECT * FROM credencial WHERE user = ?', [user]);
        if (credenciados.length > 0) {
            const credencial = credenciados[0];
            const chaveOk = await bcrypt.compare(chave, credencial.chave);
            if (chaveOk) {
                req.session.autNome = credencial.user;
                return res.redirect('/resultados');
            }
        }
        res.render('credenciais', { erro: 'Usuário ou chave inválidos' });
    } catch (err) {
        console.error(err);
        res.render('credenciais', { erro: 'Erro interno' });
    }
});

// CORRIGIDO: usa a variável PORT (sem A)
const PORT= 8081;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
