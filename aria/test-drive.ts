import 'dotenv/config';
import { listCreativesFromDrive } from './apps/api/src/modules/traffic/agents/atlas-creative-service';

async function testDrive() {
  console.log(`Testando ID da pasta: ${process.env.ATLAS_CREATIVE_DRIVE_FOLDER_ID}`);
  try {
    const files = await listCreativesFromDrive(process.env.ATLAS_CREATIVE_DRIVE_FOLDER_ID);
    
    console.log(`\n✅ Sucesso! Conexão com o Drive estabelecida.`);
    console.log(`Foram encontrados ${files.length} arquivos na pasta:\n`);
    
    files.forEach((f: any, i: number) => {
      console.log(`[${i+1}] ${f.name} (${f.mimeType})`);
    });
    
  } catch (err: any) {
    console.error(`\n❌ Falha na conexão com o Drive:`);
    console.error(err.message);
  }
}

testDrive();
