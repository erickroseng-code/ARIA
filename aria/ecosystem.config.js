module.exports = {
  apps: [
    {
      name: 'aria-api',
      cwd: './apps/api',
      script: 'cmd',
      args: '/c npm run dev',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
      },
      error_file: '../../.pm2/logs/aria-api-error.log',
      out_file: '../../.pm2/logs/aria-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'aria-web',
      cwd: './apps/web',
      script: 'cmd',
      args: '/c npm run dev',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
      },
      error_file: '../../.pm2/logs/aria-web-error.log',
      out_file: '../../.pm2/logs/aria-web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
