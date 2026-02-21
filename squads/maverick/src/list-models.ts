import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ Sem chave de API.");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Tenta listar modelos (pode não funcionar em chaves restritas)
        // Como o SDK não expõe listModels diretamente na classe principal facilmente em versões antigas, 
        // vamos tentar uma chamada direta se falhar.
        // Mas a versão atual do SDK deve suportar.
        
        console.log("Tentando conectar...");
        // O método correto para testar a chave e modelo é tentar instanciar um modelo que sabemos que existe ou deve existir.
        // Se a listagem falhar, a chave pode estar errada.
        
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Test");
        console.log("✅ Conexão bem sucedida com gemini-pro!");
        
    } catch (error: any) {
        console.error("❌ Erro de conexão:");
        console.error(error.message);
        
        if (error.message.includes("API_KEY_INVALID")) {
            console.error("👉 Sua chave de API parece inválida.");
        }
    }
}

listModels();
