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

// Função para verificar a digitação correta dos CNPJs
function validarCNPJ(cnpj) {
  if (cnpj.length !== 14) {
    return false;
  }

  const digitosVerificadoresRecebidos = [parseInt(cnpj[12]), parseInt(cnpj[13])];
  const digitosVerificadoresCalculados = calcularDigitosCNPJ(cnpj.slice(0, 12));

  const isValid =
    digitosVerificadoresRecebidos[0] === digitosVerificadoresCalculados[0] &&
    digitosVerificadoresRecebidos[1] === digitosVerificadoresCalculados[1];

  return isValid;
}


//conexão ao BD
const sql = require('mssql');

const dbConfig = {
  user: 'APIs',
  password: 'V@lida',
  server: '18.212.217.126',
  database: 'VALIDA',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    min: 0, // Número mínimo de conexões no pool
    max: 999, // Número máximo de conexões no pool
    idleTimeoutMillis: 3600000, // Tempo limite em milissegundos antes de uma conexão ociosa ser fechada
  },
};

// Cria e conecta o pool de conexões
const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log('Conexão com o banco de dados estabelecida');
    return pool;
  })
  .catch(error => {
    console.log('Erro ao conectar com o banco de dados:', error);
  });

// Consulta o BD Valida utilizando o pool de conexões
async function consultarReceitaWS(pool, cnpj) {
  const maxTentativas = 3; // Número máximo de tentativas de reconexão
  let tentativas = 0;

  while (tentativas < maxTentativas) {
    try {
      const request = pool.request(); // Crie uma nova solicitação usando o pool
      const result = await request.query`SELECT TOP 1 situacao FROM [VALIDA].[dbo].[VALIDA] WHERE CNPJ_COMPL = ${cnpj}`;

      if (result.recordset.length > 0) {
        const data = result.recordset[0];
        console.log('Data from DB:', data);
        return data.situacao;
      } else {
        console.error('CNPJ não encontrado no banco de dados');
        return '';
      }
    } catch (error) {
      console.error('Erro ao realizar consulta:', error);

      // Incrementar tentativas e verificar se ainda há tentativas disponíveis
      tentativas++;
      if (tentativas < maxTentativas) {
        console.log(`Tentativa ${tentativas} de ${maxTentativas} de reconexão...`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Aguardar 2 segundos antes de tentar reconectar
      } else {
        console.log('Número máximo de tentativas de reconexão atingido. Retornando erro.');
        return '';
      }
    }
  }
}




// Rota personalizada para validar CNPJ e retornar dados associados
server.get('/validar-cnpj/:cnpj', async (req, res) => {
  const cnpj = req.params.cnpj;
  const isValid = validarCNPJ(cnpj);

  if (isValid) {
    const cnpjRaiz = cnpj.slice(0, 8);
    const modeloCNPJ = db.valida.find((item) => item.R === parseInt(cnpjRaiz, 10));

    // Use o pool de conexões do poolPromise
    const pool = await poolPromise;
    const receitaWSResult = await consultarReceitaWS(pool, cnpj);
    const situacao = receitaWSResult;
    const digitadoCorretamente = "Digitado corretamente";

    if (modeloCNPJ) {
      const mensagem = "Modelo";
      res.json({ digitadoCorretamente, situacao, mensagem, modeloCNPJ });
    } else {
      res.json({ digitadoCorretamente, situacao, mensagem: 'CNPJ fora do modelo' });
    }
  } else {
    res.json({ digitadoCorretamente: "CNPJ inválido", mensagem: 'CNPJ fora do modelo' });
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
