/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-04-25 16:26:22
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-04-25 16:37:19
 * @FilePath: \npm-install\scripts\configure-internal-registry.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const SCRIPT_PATH = path.join(__dirname, 'publish-to-internal.js');

function askQuestion(query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

async function configureInternalRegistry() {
  try {
    console.log('\n=== 内网 NPM 仓库配置向导 ===\n');
    console.log('此工具将帮助您配置 publish-to-internal.js 脚本\n');
    
    // 读取当前配置
    let currentScript = await fs.readFile(SCRIPT_PATH, 'utf8');
    const match = currentScript.match(/const INTERNAL_REGISTRY = '([^']+)'/);
    const currentRegistry = match ? match[1] : '未配置';
    
    console.log(`当前配置的内网地址: ${currentRegistry}\n`);
    
    // 询问新的内网地址
    const internalRegistry = await askQuestion('请输入内网 NPM 仓库地址 (例如: http://192.168.1.100:4873): ');
    
    if (!internalRegistry) {
      console.log('❌ 地址不能为空');
      rl.close();
      return;
    }
    
    // 验证地址格式
    if (!internalRegistry.startsWith('http://') && !internalRegistry.startsWith('https://')) {
      console.log('⚠️  警告: 地址应该以 http:// 或 https:// 开头');
      const confirm = await askQuestion('是否继续? (y/n): ');
      if (confirm.toLowerCase() !== 'y') {
        console.log('已取消配置');
        rl.close();
        return;
      }
    }
    
    // 更新脚本文件
    const updatedScript = currentScript.replace(
      /const INTERNAL_REGISTRY = '[^']+'/g,
      `const INTERNAL_REGISTRY = '${internalRegistry}'`
    );
    
    await fs.writeFile(SCRIPT_PATH, updatedScript, 'utf8');
    
    console.log('\n✅ 配置已成功更新!\n');
    console.log(`新的内网地址: ${internalRegistry}`);
    console.log('\n📝 下一步操作:');
    console.log('1. 确保已登录到内网仓库:');
    console.log(`   npm login --registry ${internalRegistry}`);
    console.log('\n2. 运行发布命令:');
    console.log('   npm run publish-to-internal');
    console.log('\n3. 或者使用批处理脚本:');
    console.log('   publish-internal.bat');
    
  } catch (error) {
    console.error('❌ 配置失败:', error.message);
  } finally {
    rl.close();
  }
}

configureInternalRegistry();
