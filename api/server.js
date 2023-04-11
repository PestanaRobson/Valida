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

// Função para calcular dígitos verificadores do CNPJ
function calcularDigitosCNPJ(cnpj) {
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const calcularDigito = (digitos, pesos) => {
    let soma = 0;
    for (let i = 0; i < digitos.length; i++) {
      soma += digitos[i] * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const digitos = cnpj.split("").map((digito) => parseInt(digito));
  const digito1 = calcularDigito(digitos.slice(0, 12), pesos1);
  const digito2 = calcularDigito(digitos.slice(0, 12).concat([digito1]), pesos2);

  return [digito1, digito2];
}

// Rota personalizada para calcular dígitos verificadores do CNPJ
server.get('/calcular-digitos-cnpj/:cnpj', (req, res) => {
  const cnpj = req.params.cnpj;
  const digitosVerificadores = calcularDigitosCNPJ(cnpj);
  res.json({digitosVerificadores});
});

server.use(router);

// Iniciar o servidor
server.listen(3000, () => {
  console.log('JSON Server is running');
});

// Exportar a API do servidor
module.exports = server;
