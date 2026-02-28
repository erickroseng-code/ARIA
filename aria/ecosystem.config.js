module.exports = {
  apps: [
    {
      name: 'aria-api',
      script: 'C:\\Windows\\System32\\cmd.exe',
      args: '/c C:\\Users\\erick\\Projects\\aios-core\\aria\\start-api.bat',
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
      script: 'C:\\Windows\\System32\\cmd.exe',
      args: '/c C:\\Users\\erick\\Projects\\aios-core\\aria\\start-web.bat',
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
  ],
};
