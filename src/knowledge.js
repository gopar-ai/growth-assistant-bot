const fs = require('fs');
const path = require('path');

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

async function loadKnowledgeBase() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    return '';
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ['.txt', '.md', '.pdf'].includes(ext);
  });

  if (files.length === 0) return '';

  const documents = [];

  for (const file of files) {
    const filePath = path.join(KNOWLEDGE_DIR, file);
    const ext = path.extname(file).toLowerCase();

    try {
      if (ext === '.txt' || ext === '.md') {
        const content = fs.readFileSync(filePath, 'utf-8');
        documents.push(`=== ${file} ===\n${content.trim()}`);
        console.log(`  [OK] ${file}`);
      } else if (ext === '.pdf') {
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        documents.push(`=== ${file} ===\n${data.text.trim()}`);
        console.log(`  [OK] ${file} (${data.numpages} páginas)`);
      }
    } catch (err) {
      console.error(`  [ERROR] ${file}: ${err.message}`);
    }
  }

  return documents.join('\n\n');
}

module.exports = { loadKnowledgeBase };
