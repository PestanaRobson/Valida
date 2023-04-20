// Importações necessárias
const fs = require('fs');
const zlib = require('zlib');
const jsonServer = require('json-server');
const axios = require('axios');

// Criar o servidor JSON
const server = jsonServer.create();

// Função para ler e descompactar arquivos gz
const readAndUnzip = (filename) => {
  const data = zlib.gunzipSync(fs.readFileSync(filename)).toString();
  return JSON.parse(data);
};

// Carregar e combinar todas as partes do db.json
const dbParts = [];
for (let i = 1; i <= 9; i++) {
  dbParts.push(readAndUnzip(`db_part${i}.json.gz`));
}

const combinedValida = [].concat.apply([], dbParts.map(part => part.valida));
const db = { valida: combinedValida };

// Criar o roteador usando os dados descompactados
const router = jsonServer.router(db);

// Configurar middlewares e rotas
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(
  jsonServer.rewriter({
    '/api/*': '/$1',
    '/blog/:resource/:id/show': '/:resource/:id',
  })
);

async function consultarReceitaWS(cnpj) {
  const url = `https://www.receitaws.com.br/v1/cnpj/${cnpj}`;
  const response = await axios.get(url);

  if (response.status !== 200) {
    throw new Error(`Falha ao consultar a Receita WS: ${response.status}`);
  }

  const data = response.data;

  return data.situacao;
}

// Rota personalizada para validar CNPJ e retornar dados associados
server.get('/validar-cnpj/:cnpj', async (req, res) => {
  const cnpj = req.params.cnpj;
  const digitadoCorretamente = validarCNPJ(cnpj);

  if (digitadoCorretamente) {
    const cnpjRaiz = cnpj.slice(0, 8);
    const modeloCNPJ = db.valida.find((item) => item.R === parseInt(cnpjRaiz, 10));

    if (modeloCNPJ) {
      const situacao = await consultarReceitaWS(cnpj);
      const mensagem = "Modelo";
      res.json({ digitadoCorretamente, situacao, mensagem, modeloCNPJ });
    } else {
      res.json({ digitadoCorretamente, mensagem: 'CNPJ fora do modelo' });
    }
  } else {
    res.json({ digitadoCorretamente, mensagem: 'CNPJ fora do modelo' });
  }
});

// inicio do servidor
server.use(router);

// Iniciar o servidor
server.listen(3000, () => {
  console.log('JSON Server is running');
});

// Exportar a API do servidor
module.exports = server;
