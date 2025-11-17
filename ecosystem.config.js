// eslint-disable-next-line @typescript-eslint/no-var-requires
const os = require('os');

// 获取CPU核心数
const totalCPUs = os.cpus().length;
// eslint-disable-next-line no-console
console.log(`服务器CPU核心数: ${totalCPUs}`);

// 分配策略
function calculateInstances() {
  const instances = {
    // 前端: 占用 60% 的CPU核心，最少1个，最多不超过总核心数-1
    frontend: Math.max(1, Math.min(Math.floor(totalCPUs * 0.6), totalCPUs - 1)),
    
    // 后端: 占用 40% 的CPU核心，最少1个，最多不超过总核心数-1  
    backend: Math.max(1, Math.min(Math.floor(totalCPUs * 0.4), totalCPUs - 1)),
    
    // 确保总数不超过CPU核心数
    total: 0
  };
  
  instances.total = instances.frontend + instances.backend;
  
  // 如果总数超过CPU核心数，按比例调整
  if (instances.total > totalCPUs) {
    const ratio = totalCPUs / instances.total;
    instances.frontend = Math.max(1, Math.floor(instances.frontend * ratio));
    instances.backend = Math.max(1, Math.floor(instances.backend * ratio));
    instances.total = instances.frontend + instances.backend;
  }
  
  // eslint-disable-next-line no-console
  console.log(`实例分配: 前端 ${instances.frontend}, 后端 ${instances.backend}, 总计 ${instances.total}/${totalCPUs}`);
  return instances;
}

const instances = calculateInstances();

module.exports = {
  apps: [
    {
      name: 'frontend',
      cwd: './projects/web-project',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: instances.frontend,
      watch: false,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      listen_timeout: 5000,
      kill_timeout: 5000,
       // 集群配置
      instance_var: 'INSTANCE_ID',
      combine_logs: true,
      
      // 高级资源管理
      node_args: `--max-old-space-size=${Math.floor(1024 * 0.8)}`, // 内存限制
    },
    {
      name: 'backend',
      cwd: './projects/server-project',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      instances: instances.backend,
      watch: false,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      listen_timeout: 5000,
      kill_timeout: 5000,
       // 集群配置
      instance_var: 'INSTANCE_ID',
      combine_logs: true,
      
      // 高级资源管理
      node_args: `--max-old-space-size=${Math.floor(1024 * 0.8)}`, // 内存限制
    }
  ]
};