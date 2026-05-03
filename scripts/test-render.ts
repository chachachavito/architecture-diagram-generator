import * as fs from 'fs';
import * as path from 'path';
import { HTMLGenerator } from '../src/generators/HTMLGenerator';

const generator = new HTMLGenerator();
const fixturesDir = path.join(process.cwd(), 'fixtures');
const testOutputDir = path.join(process.cwd(), '.test-output');

if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir);

const mocks = ['small', 'medium', 'large'];

mocks.forEach(name => {
  const mockPath = path.join(fixturesDir, `mock-architecture-${name}.json`);
  if (fs.existsSync(mockPath)) {
    const data = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
    const html = generator.generate(data, `Mock Project (${name})`);
    
    fs.writeFileSync(
      path.join(testOutputDir, `test-${name}.html`),
      html
    );
    console.log(`Generated test output: .test-output/test-${name}.html`);
  }
});
