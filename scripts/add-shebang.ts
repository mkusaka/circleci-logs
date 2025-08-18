#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const distPath = join(process.cwd(), 'dist', 'index.js');

try {
  const content = readFileSync(distPath, 'utf-8');

  // Check if shebang already exists
  if (!content.startsWith('#!/usr/bin/env node')) {
    const withShebang = '#!/usr/bin/env node\n' + content;
    writeFileSync(distPath, withShebang);
    console.log('✅ Added shebang to dist/index.js');
  } else {
    console.log('✅ Shebang already exists in dist/index.js');
  }
} catch (error) {
  console.error('❌ Failed to add shebang:', error);
  process.exit(1);
}
