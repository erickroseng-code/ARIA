import { BrowserService } from './scout/browser';

async function loginTool() {
    console.log("
🔐 Maverick Login Tool - Instagram");
    console.log("-----------------------------------");
    console.log("Este script abrirá uma janela do navegador.");
    console.log("1. Faça login na sua conta do Instagram manualmente.");
    console.log("2. Quando terminar e ver o feed, pode fechar a janela do navegador.");
    console.log("3. A sessão será salva para o Agente usar.");
    console.log("-----------------------------------
");

    const browser = new BrowserService({ headless: false }); // Interactive mode
    
    try {
        await browser.init();
        await browser.navigateTo("https://www.instagram.com/accounts/login/");
        
        console.log("⏳ Aguardando você fazer login... (Pressione Ctrl+C no terminal para encerrar se já terminou)");
        
        // Keep script alive indefinitely until user kills it or closes browser
        // In a real CLI tool we might detect URL change to feed, but manual close is safer.
        await new Promise(() => {}); 

    } catch (error) {
        console.log("Sessão encerrada.");
    }
}

loginTool();
