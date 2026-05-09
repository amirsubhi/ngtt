module.exports = {
  apps: [
    {
      name: 'ngtt-backend',
      script: 'dist/index.js',
      cwd: './backend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: '/var/log/ngtt/backend-error.log',
      out_file: '/var/log/ngtt/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'ngtt-worker',
      script: 'dist/worker.js',
      cwd: '/var/www/ngtt/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/ngtt/worker-error.log',
      out_file: '/var/log/ngtt/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};
