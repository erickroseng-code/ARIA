
const BASE_URL = 'http://localhost:3000';

async function testGenerateScript() {
  console.log('Testing /api/generate-script...');
  try {
    const response = await fetch(`${BASE_URL}/api/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'Dicas de Produtividade',
        angle: 'Científico',
        tone: 'Inspirador'
      })
    });
    
    const data = await response.json();
    console.log('Generate Script Response Status:', response.status);
    console.log('Generate Script Result:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error testing generate-script:', error);
  }
}

async function testAnalyzeProfile() {
  console.log('\nTesting /api/analyze-profile...');
  try {
    // Using a generic handle that might trigger the fallback or work partially
    const response = await fetch(`${BASE_URL}/api/analyze-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: 'instagram' 
      })
    });

    const data = await response.json();
    console.log('Analyze Profile Response Status:', response.status);
    // Truncating the analysis to avoid huge logs if it works
    if (data.analysis) {
        console.log('Analyze Profile Result (Snippet):', {
            success: data.success,
            source: data.source,
            bio: data.analysis.bio
        });
    } else {
        console.log('Analyze Profile Result:', JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('Error testing analyze-profile:', error);
  }
}

async function waitForServer() {
  console.log('Waiting for server to be ready...');
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) {
        console.log('Server is ready!');
        return;
      }
    } catch (e) {
      // ignore
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Server timed out');
}

async function runTests() {
  await waitForServer();
  
  await testGenerateScript();
  await testAnalyzeProfile();
}

runTests();
