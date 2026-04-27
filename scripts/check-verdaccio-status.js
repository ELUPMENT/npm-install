const { execSync } = require('child_process');

console.log('\n=== Verdaccio 服务状态检查 ===\n');

try {
  // 检查端口 4873 是否有服务在监听
  const output = execSync('netstat -ano | findstr ":4873"', { encoding: 'utf8' });
  
  if (output.trim()) {
    console.log('✅ Verdaccio 服务正在运行\n');
    console.log('监听信息:');
    console.log(output);
    
    // 提取 PID
    const match = output.match(/LISTENING\s+(\d+)/);
    if (match) {
      const pid = match[1];
      console.log(`进程 ID: ${pid}`);
      
      // 尝试获取进程信息
      try {
        const processInfo = execSync(`tasklist /FI "PID eq ${pid}" /FO LIST`, { encoding: 'utf8' });
        console.log('\n进程详情:');
        console.log(processInfo);
      } catch (e) {
        // 忽略错误
      }
    }
    
    console.log('\n服务地址: http://localhost:4873');
    console.log('\n💡 提示:');
    console.log('  - 现在可以正常使用 npm 命令');
    console.log('  - 使用 npm run add-deps 添加依赖');
    console.log('  - 使用 npm run sync-to-offline 同步包');
    
  } else {
    console.log('❌ Verdaccio 服务未运行\n');
    console.log('🚀 启动服务:');
    console.log('  方式 1: 双击 start.bat');
    console.log('  方式 2: 运行 npm start');
    console.log('\n⚠️  注意:');
    console.log('  - 在安装或同步包之前，必须确保服务正在运行');
    console.log('  - 服务停止会导致 ECONNREFUSED 错误');
  }
  
} catch (error) {
  // netstat 没有找到 4873 端口
  if (error.status === 1) {
    console.log('❌ Verdaccio 服务未运行\n');
    console.log('🚀 启动服务:');
    console.log('  方式 1: 双击 start.bat');
    console.log('  方式 2: 运行 npm start');
    console.log('\n⚠️  注意:');
    console.log('  - 在安装或同步包之前，必须确保服务正在运行');
    console.log('  - 服务停止会导致 ECONNREFUSED 错误');
  } else {
    console.error('检查失败:', error.message);
  }
}

console.log('\n=== 检查完成 ===\n');
