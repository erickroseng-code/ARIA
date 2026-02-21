import { LLMService } from './core/llm';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

async function testBrain() {
    console.log("🧠 Testando conexão com Anthropic (Debug Mode)...");

    // Debug: Tentar ler o arquivo manualmente
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        const envConfig = dotenv.parse(fs.readFileSync(envPath));
        for (const k in envConfig) {
            process.env[k] = envConfig[k];
        }
        console.log("✅ .env carregado manualmente.");
    } else {
        console.log("❌ .env não encontrado em:", envPath);
    }
    
    try {
        const llm = new LLMService();
        const response = await llm.chat("Quem é você? Responda como um pirata espacial em 1 frase.");
        
        console.log("\n💬 Resposta:");
        console.log(response);
        console.log("\n✅ Conexão bem sucedida!");
    } catch (error) {
        console.error("\n❌ Falha na conexão. Verifique seu .env");
        console.error(error);
    }
}

testBrain();
