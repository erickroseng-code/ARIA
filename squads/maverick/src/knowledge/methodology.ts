// Maverick Methodology Loader
// Combines all knowledge documents into the system prompt context
// This is the "brain" the LLM internalizes before analyzing any profile

import * as fs from 'fs';
import * as path from 'path';

const knowledgeDir = path.resolve(__dirname, '../../data/knowledge');

function read(filePath: string): string {
    try {
        return fs.readFileSync(filePath, 'utf-8').trim();
    } catch {
        return '';
    }
}

function readYamlAsText(filePath: string): string {
    // YAMLs are kept as-is — rich enough to be read directly by the LLM
    return read(filePath);
}

export function loadMaverickMethodology(): string {
    const manifesto = read(path.join(knowledgeDir, 'manifesto.txt'));
    const deepIndex = read(path.join(knowledgeDir, 'deep_index.md'));

    const frameworksDir = path.join(knowledgeDir, 'copywriting', 'frameworks');
    // Auto-scan: any .yaml or .md added to frameworks/ is automatically included
    const frameworkTexts: string[] = [];
    if (fs.existsSync(frameworksDir)) {
        const files = fs.readdirSync(frameworksDir).sort();
        for (const file of files) {
            if (file.endsWith('.yaml') || file.endsWith('.md')) {
                const content = read(path.join(frameworksDir, file));
                if (content) frameworkTexts.push(content);
            }
        }
    }

    const frameworks = frameworkTexts.join('\n\n---\n\n');

    return `
# FILOSOFIA MAVERICK
${manifesto}

---

# METODOLOGIA — PRINCÍPIOS DOS LIVROS
${deepIndex}

---

# FRAMEWORKS DE COPYWRITING E PERSUASÃO
${frameworks}
`.trim();
}
