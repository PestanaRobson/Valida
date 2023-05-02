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
    return "CNPJ inválido";
  }

  const digitosVerificadoresRecebidos = [parseInt(cnpj[12]), parseInt(cnpj[13])];
  const digitosVerificadoresCalculados = calcularDigitosCNPJ(cnpj.slice(0, 12));

  const isValid =
    digitosVerificadoresRecebidos[0] === digitosVerificadoresCalculados[0] &&
    digitosVerificadoresRecebidos[1] === digitosVerificadoresCalculados[1];

  return isValid ? "Digitado corretamente" : "CNPJ inválido";
}

const sql = require('mssql');

const dbConfig = {
  user: 'APIs',
  password: 'V@lida',
  server: '18.212.217.126',
  database: 'VALIDA',
};

// Consulta o BD Valida
async function consultarReceitaWS(cnpj) {
  try {
    await sql.connect(dbConfig);
    const result = await sql.query`SELECT * FROM dbo.VALIDA WHERE CNPJ = ${cnpj}`;

    if (result.recordset.length > 0) {
      const data = result.recordset[0];
      return data.situacao;
    } else {
      console.error('CNPJ não encontrado no banco de dados');
      return '';
    }
  } catch (error) {
    console.error('Erro ao realizar consulta:', error);
    return '';
  } finally {
    sql.close(); // Sempre feche a conexão ao finalizar a consulta
  }
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
      const situacao = await consultarReceitaWS(cnpj);
      res.json({ digitadoCorretamente, situacao, mensagem: 'CNPJ fora do modelo' });
    }
  } else {
    res.json({ digitadoCorretamente, mensagem: 'CNPJ fora do modelo' });
  }
});

async function validarCNPJAPI(cnpj) {
  const response = await fetch(`https://valida-teste.vercel.app/validar-cnpj/${cnpj}`);
  const data = await response.json();

  const mensagem = data.isValid ? "Digitado corretamente" : "CNPJ inválido";
  return { isValid: data.isValid, mensagem };
}

// inicio do servidor
server.use(router);

// Iniciar o servidor
server.listen(3000, () => {
  console.log('JSON Server is running');
});

// Exportar a API do servidor
module.exports = server;
