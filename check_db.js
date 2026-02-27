const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('dev.native.db');

db.serialize(() => {
  db.all("SELECT provider, accessToken, refreshToken, isValid FROM integrations", (err, rows) => {
    if (err) {
      console.error('Error querying database:', err.message);
      process.exit(1);
    }
    console.log('--- Integrations Table Content ---');
    rows.forEach((row) => {
      console.log(`Provider: ${row.provider}`);
      console.log(`Access Token: ${row.accessToken ? 'Present (First 10: ' + row.accessToken.substring(0, 10) + '...)' : 'Missing'}`);
      console.log(`Refresh Token: ${row.refreshToken ? 'Present (First 10: ' + row.refreshToken.substring(0, 10) + '...)' : 'Missing'}`);
      console.log(`Is Valid: ${row.isValid}`);
      console.log('---------------------------------');
    });
  });
});

db.close();
