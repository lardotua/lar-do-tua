// build.js — Gera quartos.json com a lista de ficheiros em _quartos/
const fs = require('fs');
const path = require('path');

const quartosDir = path.join(__dirname, '_quartos');
const outputFile = path.join(__dirname, 'quartos.json');

if (!fs.existsSync(quartosDir)) {
  fs.mkdirSync(quartosDir);
  fs.writeFileSync(outputFile, '[]');
  console.log('Pasta _quartos criada. Nenhum quarto ainda.');
  process.exit(0);
}

const files = fs.readdirSync(quartosDir)
  .filter(f => f.endsWith('.md'));

fs.writeFileSync(outputFile, JSON.stringify(files, null, 2));
console.log(`quartos.json gerado com ${files.length} quarto(s):`, files);
