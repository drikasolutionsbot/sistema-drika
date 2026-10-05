const fs = require('fs');
const path = require('path');

const imgPath = 'C:\\Users\\Lucas\\Desktop\\fundo restock.png';
const outPath = path.join(__dirname, 'supabase', 'functions', 'manage-product-fields', 'bg.ts');

const imgBuffer = fs.readFileSync(imgPath);
const base64 = imgBuffer.toString('base64');

const tsContent = `export const bgBase64 = "data:image/png;base64,${base64}";\n`;
fs.writeFileSync(outPath, tsContent);
console.log('Criado bg.ts com', tsContent.length, 'bytes');
