export interface ValidationResult {
    score: number;
    issues: string[];
    passed: boolean;
}

const BANNED_WORDS = [
    'transformação',
    'jornada',
    'incrível',
    'poderoso',
    'revolucionário',
    'guru',
];

export function validate(script: string): ValidationResult {
    const issues: string[] = [];
    let score = 5;

    // 1. Hook ≤ 15 palavras
    const ganchoMatch = script.match(/\[GANCHO\]\s*\n(.*)/i);
    if (ganchoMatch) {
        const hookLine = ganchoMatch[1].trim();
        const wordCount = hookLine.split(/\s+/).filter(w => w.length > 0).length;
        if (wordCount > 15) {
            issues.push(`Gancho muito longo: ${wordCount} palavras (máx 15)`);
            score--;
        }
    } else {
        issues.push('Seção [GANCHO] não encontrada');
        score--;
    }

    // 2. Presença de número/estatística
    if (!/\d+/.test(script)) {
        issues.push('Sem números ou estatísticas — adicione especificidade');
        score--;
    }

    // 3. Seções obrigatórias
    const hasDesenvolvimento = /\[DESENVOLVIMENTO\]/i.test(script);
    const hasCta = /\[CTA\]/i.test(script);
    if (!hasDesenvolvimento || !hasCta) {
        issues.push('Seções [DESENVOLVIMENTO] e/ou [CTA] ausentes');
        score--;
    }

    // 4. Contagem de palavras (220–400)
    const wordCount = script.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 220) {
        issues.push(`Roteiro curto demais: ${wordCount} palavras (mín 220)`);
        score--;
    } else if (wordCount > 400) {
        issues.push(`Roteiro longo demais: ${wordCount} palavras (máx 400)`);
        score--;
    }

    // 5. Palavras banidas
    const foundBanned = BANNED_WORDS.filter(w => script.toLowerCase().includes(w));
    if (foundBanned.length > 0) {
        issues.push(`Palavras de guru encontradas: ${foundBanned.join(', ')}`);
        score--;
    }

    const finalScore = Math.max(0, score);
    return {
        score: finalScore,
        issues,
        passed: finalScore >= 3,
    };
}
