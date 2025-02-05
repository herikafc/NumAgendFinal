const express = require('express');
const axios = require('axios');
const mysql = require('mysql2');

const app = express();
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Conectar ao banco de dados
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Fluminense@2004',
  database: 'insta_schedulers'
});

// Token do Instagram 
const tokenInstagram = 'EAAS7Sprp9VcBO2L6J1pAzpqcU8EWqn7cwTEmHDk59ke35xsOYPZBMZA6sGNEircAdhpNEbf919DQojmfZCqCzmgvkIXTwCUnrjnle2OY11H7LzW64VZB5KFNd7KJIJf5p3wXQkb8ZBHvhVmToHZATEF4Sx5x5PgdjTAwMo3ueVHvceQ9On8MeVaDlv';

// ID manual da conta do Instagram e do app (adicione os seus aqui)
const instagramAccountId = '17841471846635191'; // Insira o ID manual da conta comercial
const appId = '1331829007840599'; // Insira o ID do seu app

// Função para buscar postagens pendentes
const getPostagensPendentes = () => {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM postagens WHERE status = 'pendente' AND data_hora <= NOW()", (err, results) => {
      if (err) reject(err);
      resolve(results);
    });
  });
};

// Função para publicar no Instagram
const publicarNoInstagram = async (conteudo, imagemUrl, idPostagem) => {
  try {
    console.log(`📤 Publicando post ID ${idPostagem} no Instagram...`);

    // Verificar se o ID da conta do Instagram está definido
    if (!instagramAccountId) {
      throw new Error('ID da conta do Instagram não definido.');
    }

    // Enviar a imagem para o Instagram
    const mediaResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
      {
        image_url: imagemUrl,
        caption: conteudo,
        access_token: tokenInstagram,
      }
    );

    if (!mediaResponse.data.id) {
      throw new Error('Falha ao criar a mídia no Instagram.');
    }

    console.log("✅ Imagem enviada com sucesso:", mediaResponse.data);

    const mediaId = mediaResponse.data.id;

    // Publicar a imagem no feed
    const publishResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`,
      {
        creation_id: mediaId,
        access_token: tokenInstagram,
      }
    );

    if (!publishResponse.data.id) {
      throw new Error('Falha ao publicar a mídia.');
    }

    console.log("✅ Publicação concluída:", publishResponse.data);

    // Atualizar status no banco
    db.query("UPDATE postagens SET status = 'publicado' WHERE id = ?", [idPostagem], (err) => {
      if (err) console.error('Erro ao atualizar status:', err);
      else console.log(`📢 Postagem ID ${idPostagem} publicada com sucesso!`);
    });

  } catch (err) {
    console.error('❌ Erro ao publicar no Instagram:', err.response?.data || err.message);
    db.query("UPDATE postagens SET status = 'erro' WHERE id = ?", [idPostagem]);
  }
};

// Agendador automático para postar no horário certo
setInterval(async () => {
  console.log("🔄 Verificando postagens agendadas...");

  try {
    const postagens = await getPostagensPendentes();
    if (postagens.length > 0) {
      console.log(`📅 ${postagens.length} postagem(ns) encontrada(s) para publicação.`);
      for (const postagem of postagens) {
        await publicarNoInstagram(postagem.conteudo, postagem.imagem_url, postagem.id);
      }
    } else {
      console.log("⏳ Nenhuma postagem pendente.");
    }
  } catch (err) {
    console.error('⚠️ Erro ao buscar postagens pendentes:', err);
  }

}, 60000); // Verifica a cada 60 segundos

// Rota para exibir postagens no navegador
app.get('/', (req, res) => {
  db.query('SELECT * FROM postagens ORDER BY data_hora DESC', (err, results) => {
    if (err) {
      console.error('Erro ao buscar postagens:', err);
      return res.status(500).send('Erro ao carregar postagens');
    }
    res.render('index', { postagens: results });
  });
});

// Configuração do servidor
const port = 3000;
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
