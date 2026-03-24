const BOOTSTRAP = "C:\\Users\\erick\\Projects\\aios-core\\scripts\\pm2-bootstrap.cjs";
const NODE = "C:\\Program Files\\nodejs\\node.exe";
const TSX = "C:\\Users\\erick\\Projects\\aios-core\\aria\\node_modules\\tsx\\dist\\cli.mjs";
const NEXT = "C:\\Users\\erick\\Projects\\aios-core\\aria\\node_modules\\next\\dist\\bin\\next";

module.exports = {
  apps: [
    {
      name: "maverick-api",
      script: NODE,
      args: `${BOOTSTRAP} ${TSX} watch src/server.ts`,
      cwd: "C:\\Users\\erick\\Projects\\aios-core\\aria\\apps\\api",
      interpreter: "none",
      windowsHide: true,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: "development",
        PORT: "3001",
      },
    },
    {
      name: "trendmaster",
      script: "C:\\Python314\\pythonw.exe",
      args: "-m uvicorn src.api.app:app --host 0.0.0.0 --port 8000",
      cwd: "C:\\Users\\erick\\Projects\\aios-core\\trendmaster",
      interpreter: "none",
      windowsHide: true,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },
    {
      name: "aria-frontend",
      script: NODE,
      args: `${BOOTSTRAP} ${NEXT} dev`,
      cwd: "C:\\Users\\erick\\Projects\\aios-core\\aria\\apps\\web",
      interpreter: "none",
      windowsHide: true,
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      env: {
        NODE_ENV: "development",
        PORT: "3000",
      },
    },
  ],
};
