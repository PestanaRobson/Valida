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

// Função para validar CNPJ
function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/[^\d]+/g,'');

  if (cnpj.length !== 14) {
    return false;
  }

  // Elimina CNPJs invalidos conhecidos
  if (cnpj === '00000000000000' ||
    cnpj === '11111111111111' ||
    cnpj === '22222222222222' ||
    cnpj === '33333333333333' ||
    cnpj === '44444444444444' ||
    cnpj === '55555555555555' ||
    cnpj === '66666666666666' ||
    cnpj === '77777777777777' ||
    cnpj === '88888888888888' ||
    cnpj === '99999999999999') {
    return false;
  }

  // Valida DVs
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0,tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) {
      pos = 9;
    }
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(0))) {
    return false;
  }

  tamanho = tamanho + 1;
  numeros = cnpj.substring(0,tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) {
      pos = 9;
    }
  }
  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(1))) {
    return false;
  }

  return true;
}


// Configurar middlewares e rotas
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(
  jsonServer.rewriter({
    '/api/*': '/$1',
    '/blog/:resource/:id/show': '/:resource/:id',
  })
);

// Configurar middlewares e rotas
const middlewares = jsonServer.defaults();
server.use(middlewares);

server.use(
  jsonServer.rewriter({
    '/api/*': '/$1',
    '/blog/:resource/:id/show': '/:resource/:id',
  })
);

// Função para validar CNPJ
function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/[^\d]+/g,'');

  if(cnpj === '') {
    return false;
  }
  if (cnpj.length !== 14) {
    return false;
  }
  // Elimina CNPJs invalidos conhecidos
  if (/^(\d)\1+$/.test(cnpj)) {
    return false;
  }
  // Valida DVs
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0,tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) {
      pos = 9;
    }
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado != digitos.charAt(0)) {
    return false;
  }
  tamanho = tamanho + 1;
  numeros = cnpj.substring(0,tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) {
      pos = 9;
    }
  }
  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado != digitos.charAt(1)) {
    return false;
  }
  return true;
}

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
server.listen
