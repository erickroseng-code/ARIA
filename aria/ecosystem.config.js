const ARIA_ROOT = 'C:/Users/erick/Projects/aios-core/aria';
const TTS_SERVICE = `${ARIA_ROOT}/apps/tts-service`;
const VENV_PYTHONW = `${TTS_SERVICE}/.venv/Scripts/pythonw.exe`;

module.exports = {
  apps: [
    {
      name: 'aria-api',
      script: `${ARIA_ROOT}/run-api.vbs`,
      interpreter: 'wscript.exe',
      args: '//NoLogo',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
      },
      error_file: 'C:\\Users\\erick\\.pm2\\logs\\aria-api-error.log',
      out_file: 'C:\\Users\\erick\\.pm2\\logs\\aria-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'aria-web',
      script: `${ARIA_ROOT}/run-web.vbs`,
      interpreter: 'wscript.exe',
      args: '//NoLogo',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
      },
      error_file: 'C:\\Users\\erick\\.pm2\\logs\\aria-web-error.log',
      out_file: 'C:\\Users\\erick\\.pm2\\logs\\aria-web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'aria-tts',
      script: 'main.py',
      cwd: TTS_SERVICE,
      interpreter: VENV_PYTHONW,
      watch: false,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 10000,
      env: {
        PYTHONUNBUFFERED: '1',
        COQUI_TOS_AGREED: '1',
      },
      error_file: 'C:\\Users\\erick\\.pm2\\logs\\aria-tts-error.log',
      out_file: 'C:\\Users\\erick\\.pm2\\logs\\aria-tts-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
