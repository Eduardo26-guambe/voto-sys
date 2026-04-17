require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

app.use(session({
    secret: process.env.SESSION_SECRET || 'Crypt-2026-Eduard',
    resave: false,
    saveUninitialized: true
}));

// Configuração do pool de conexões com MySQL no Aiven
const dbConfig = {
    host: process.env.DB_HOST || 'mysql-23d30934-eduardomanuelguambe26-b804.i.aivencloud.com',
    port: parseInt(process.env.DB_PORT, 10)|| 11337,
    user: process.env.DB_USER ||'avnadmin',
    password: process.env.DB_PASSWORD|| 'AVNS_W0LtYipOgMMnr8qb5wF',
    database: process.env.DB_NAME||'defaultdb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Configura SSL
if (process.env.CA_CERT) {
    dbConfig.ssl = { ca: process.env.CA_CERT };
} else {
    try {
        if (fs.existsSync('./ca.pem')) {
            dbConfig.ssl = { ca: fs.readFileSync('./ca.pem') };
        } else {
            dbConfig.ssl = { rejectUnauthorized: false };
        }
    } catch (err) {
        dbConfig.ssl = { rejectUnauthorized: false };
    }
}

const db = mysql.createPool(dbConfig);

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

// ALTERADO: Agora a rota de voto envia o usuarioId para o banco
app.post('/votar', async (req, res) => {
    const { pr, sc, es } = req.body;
    const usuarioId = req.session.usuarioId;

    if (!usuarioId) return res.redirect('/login');

    try {
        // Cada INSERT agora leva o ID de quem está votando
        await db.query('INSERT INTO p_votos(p_id, user_id) VALUES (?, ?)', [pr, usuarioId]);
        await db.query('INSERT INTO s_votos(s_id, user_id) VALUES (?, ?)', [sc, usuarioId]);
        await db.query('INSERT INTO e_votos(e_id, user_id) VALUES (?, ?)', [es, usuarioId]);
        
        res.redirect('/logout');
    } catch (err) {
        console.error(err);
        let msg = 'Falha ao votar';
        
        // Verifica se o erro é de voto duplicado (UNIQUE constraint)
        if (err.code === 'ER_DUP_ENTRY') {
            msg = 'Você já registrou seu voto nesta eleição!';
        }
        
        res.render('index', { nome: req.session.usuarioName, erro: msg });
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
        <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            <h2>✅ Voto registrado com sucesso!</h2>
            <p><a href="/credenciais">🔐 Ver resultados (área restrita)</a></p>
            <p><a href="/login">👤 Sair</a></p>
        </div>
    `);
});

app.get('/credenciais', (req, res) => {
    res.render('credenciais', { erro: null });
});

app.post('/credenciais', async (req, res) => {
    const { user, chave } = req.body;
    try {
        if (user === 'admin' && chave === 'admin123') {
            req.session.autNome = user;
            return res.redirect('/resultados');
        }
        res.render('credenciais', { erro: 'Usuário ou chave inválidos' });
    } catch (err) {
        console.error(err);
        res.render('credenciais', { erro: 'Erro interno' });
    }
});

const PORT = 8081;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
