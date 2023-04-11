// Importações necessárias
const fs = require('fs');
const zlib = require('zlib');
const jsonServer = require('json-server');

// Criar o servidor JSON
const server = jsonServer.create();

// Descompactar e ler o arquivo db.json.gz
const data = zlib.gunzipSync(fs.readFileSync('db.json.gz')).toString();
const db = JSON.parse(data);

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
server.use(router);

// Iniciar o servidor
server.listen(3000, () => {
  console.log('JSON Server is running');
});

// Exportar a API do servidor
module.exports = server;
