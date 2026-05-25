#!/usr/bin/env node

import { DependencyFixCLI } from './cli.js';

const cli = new DependencyFixCLI();
cli.run(process.argv).catch((error: Error) => {
  console.error(`❌ Fatal error: ${error}`);
  process.exit(1);
});