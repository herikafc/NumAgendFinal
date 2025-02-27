const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const cron = require('node-cron');
const moment = require('moment-timezone');
const app = express();
const port = 3000;

// Pasta de uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log('A pasta "uploads" foi criada automaticamente.');
}

app.use('/uploads', express.static(uploadDir, {
    setHeaders: (res, path) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache de 1 dia

        const ext = path.split('.').pop().toLowerCase();
        switch (ext) {
            case 'jpg':
            case 'jpeg':
                res.setHeader('Content-Type', 'image/jpeg');
                break;
            case 'png':
                res.setHeader('Content-Type', 'image/png');
                break;
            default:
                res.setHeader('Content-Type', 'application/octet-stream');
        }
    }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexão com o banco de dados
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Fluminense@2004',
    database: 'insta_schedulers'
});

db.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
        process.exit(1);
    }
    console.log('Conectado ao banco de dados.');
});

// Configurações do Instagram
const INSTAGRAM_TOKEN = 'EAAS7Sprp9VcBO2L6J1pAzpqcU8EWqn7cwTEmHDk59ke35xsOYPZBMZA6sGNEircAdhpNEbf919DQojmfZCqCzmgvkIXTwCUnrjnle2OY11H7LzW64VZB5KFNd7KJIJf5p3wXQkb8ZBHvhVmToHZATEF4Sx5x5PgdjTAwMo3ueVHvceQ9On8MeVaDlv';
const INSTAGRAM_USER_ID = '17841471846635191';
const NGROK_URL = 'https://7cf6-179-124-25-3.ngrok-free.app';

// Configuração do multer para uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Função para publicar no Instagram
async function publicarNoInstagram(conteudo, imagemUrl) {
    try {
        const respostaUpload = await axios.post(
            `https://graph.facebook.com/v19.0/${INSTAGRAM_USER_ID}/media`,
            {
                image_url: imagemUrl,
                caption: conteudo,
                access_token: INSTAGRAM_TOKEN
            }
        );

        const creationId = respostaUpload.data.id;

        await axios.post(
            `https://graph.facebook.com/v19.0/${INSTAGRAM_USER_ID}/media_publish`,
            {
                creation_id: creationId,
                access_token: INSTAGRAM_TOKEN
            }
        );

        console.log('✅ Postagem publicada com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao postar no Instagram:', error.response?.data || error);
        return false;
    }
}

// Endpoint para upload e agendamento
app.post('/upload', upload.single('imagem'), async (req, res) => {
    const { conteudo, data_hora } = req.body;
    if (!req.file) {
        return res.status(400).json({ message: 'Imagem é obrigatória.' });
    }

    const imagemUrlPublica = `${NGROK_URL}/uploads/${req.file.filename}`;
    const dataHoraBrasilia = moment.tz(data_hora, 'America/Sao_Paulo').utc().format('YYYY-MM-DD HH:mm:ss');


    try {
        db.query(
            'INSERT INTO postagens (conteudo, imagem_url, data_hora, status) VALUES (?, ?, ?, ?)',
            [conteudo, imagemUrlPublica, dataHoraBrasilia, 'agendado'],
            (err, results) => {
                if (err) {
                    console.error('Erro ao salvar no banco:', err);
                    return res.status(500).json({ message: 'Erro ao agendar a postagem.' });
                }

                const newPost = {
                    id: results.insertId,
                    conteudo,
                    imagem_url: imagemUrlPublica,
                    data_hora: dataHoraBrasilia,
                    status: 'agendado'
                };

                console.log('📅 Postagem agendada para:', dataHoraBrasilia);
                res.status(200).json({ message: 'Postagem agendada com sucesso!', postagem: newPost });


            }
        );
    } catch (error) {
        console.error('Erro ao processar a postagem:', error);
        res.status(500).json({ message: 'Erro interno ao processar a postagem.' });
    }
});


// Agendador com node-cron
cron.schedule('* * * * *', async () => {
    const agora = moment().utc().format('YYYY-MM-DD HH:mm:ss');

    db.query(
        'SELECT * FROM postagens WHERE data_hora <= ? AND status = "agendado"',
        [agora],
        async (err, results) => {
            if (err) {
                console.error('Erro ao buscar postagens agendadas:', err);
                return;
            }

            for (const postagem of results) {
                // Atualiza para "processando"
                db.query('UPDATE postagens SET status = "processando" WHERE id = ?', [postagem.id]);

                const publicado = await publicarNoInstagram(postagem.conteudo, postagem.imagem_url);

                // Atualiza conforme o resultado da publicação
                const novoStatus = publicado ? 'postado' : 'falhou';
                db.query('UPDATE postagens SET status = ? WHERE id = ?', [novoStatus, postagem.id]);

                console.log(`🔄 Postagem ID ${postagem.id} agora está como: ${novoStatus}`);

                
            }
        }
    );
});


// Endpoint para listar postagens
app.get('/postagens', (req, res) => {
    db.query('SELECT * FROM postagens ORDER BY data_hora DESC', (err, results) => {
        if (err) {
            console.error('Erro ao buscar postagens:', err);
            return res.status(500).json({ message: 'Erro ao buscar as postagens.' });
        }
        res.json(results);
    });
});


// Endpoint para exclusão de postagens
app.delete('/postagens/:id', (req, res) => {
    const { id } = req.params;

    db.query('DELETE FROM postagens WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('Erro ao deletar postagem:', err);
            return res.status(500).json({ message: 'Erro ao deletar a postagem.' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ message: 'Postagem não encontrada.' });
        }

        res.json({ message: 'Postagem deletada com sucesso.' });
    });
});

// Inicialização do servidor
app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
