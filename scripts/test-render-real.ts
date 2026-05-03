import * as fs from 'fs';
import * as path from 'path';
import { HTMLGenerator } from '../src/generators/HTMLGenerator';

const generator = new HTMLGenerator();
const fixturesDir = path.join(process.cwd(), 'fixtures');
const testOutputDir = path.join(process.cwd(), '.test-output');

if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir);

const mocks = [
  { file: 'mock-nextjs-ecommerce.json', name: 'Next.js E-commerce' },
  { file: 'mock-laravel-saas.json', name: 'Laravel SaaS' },
  { file: 'mock-django-rest-api.json', name: 'Django REST API' },
];

mocks.forEach(({ file, name }) => {
  const mockPath = path.join(fixturesDir, file);
  if (fs.existsSync(mockPath)) {
    const data = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
    const html = generator.generate(data, name);
    const outName = file.replace('.json', '.html');
    fs.writeFileSync(path.join(testOutputDir, outName), html);
    console.log(`Generated: .test-output/${outName} (${data.nodes.length} nodes)`);
  } else {
    console.error(`Missing: ${file}`);
  }
});
