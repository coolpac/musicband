import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.join(__dirname, '../src/assets/figma');
const downloadedDir = path.join(assetsDir, 'downloaded');

// Создаем папку если её нет
if (!fs.existsSync(downloadedDir)) {
  fs.mkdirSync(downloadedDir, { recursive: true });
}

const assets = [
  { url: 'http://localhost:3845/assets/bf356ffee17343e8f706498bb8b690bb09cb0141.png', filename: 'hero-image.png' },
  { url: 'http://localhost:3845/assets/74014b599e2e4bb27c7199fbf3544414e21c71d9.svg', filename: 'hero-logo.svg' },
  { url: 'http://localhost:3845/assets/7c7b0a00b4885f4d65c96ea38b5b8883771681cb.svg', filename: 'hero-cover-band.svg' },
  { url: 'http://localhost:3845/assets/d38dc82bb6c40c2a0b1f019d086e4a98ddf8084e.svg', filename: 'hero-vector-group.svg' },
  { url: 'http://localhost:3845/assets/22d5de6e1d10b29a79a3b21efe2514b3fe8d4795.png', filename: 'award-2025.png' },
  { url: 'http://localhost:3845/assets/265576085caa6b9af72f917fbc2855219c4fe9ac.png', filename: 'award-2024.png' },
  { url: 'http://localhost:3845/assets/718be11c8ed0a95e3552a8d06dc0c5b4aad6d457.png', filename: 'live-sound.png' },
  { url: 'http://localhost:3845/assets/7083865b7cd31378571052a0916001aea068d7f5.png', filename: 'flexible-terms.png' },
  { url: 'http://localhost:3845/assets/0c9e595525acfd01e99cd4f0e7788ad0a0f330e6.svg', filename: 'ellipse-240.svg' },
  { url: 'http://localhost:3845/assets/170b5798225b22976ef040ab1df718a8eb39492a.svg', filename: 'why-vector-top.svg' },
  { url: 'http://localhost:3845/assets/6f7c7687a88eaf7a64ec9213706c37d1471981af.svg', filename: 'why-vector-bottom.svg' },
  { url: 'http://localhost:3845/assets/0e39fecd9289fda64973936311eadf69ca9c78d5.svg', filename: 'why-vector-wide.svg' },
  { url: 'http://localhost:3845/assets/0c20cbc5cf81251ae737cff4ea0e82ddc05b1534.svg', filename: 'ellipse-242.svg' },
  { url: 'http://localhost:3845/assets/b12a64e18762b562011c4dadea1538d99b53a633.svg', filename: 'ellipse-241.svg' },
  { url: 'http://localhost:3845/assets/e3f15ebeeb85920219fd9c947a7a728cd66715d2.png', filename: 'second-panel-left.png' },
  { url: 'http://localhost:3845/assets/a19f20fe81cb9c670f51066d4731fb5ad9d55910.png', filename: 'second-panel-center.png' },
  { url: 'http://localhost:3845/assets/a96316633bc652dbbfacda08da7b2b718d087124.png', filename: 'second-panel-right.png' },
  { url: 'http://localhost:3845/assets/e7643be9f6f8a31af9acfb04049690519d1c3506.png', filename: 'third-panel-left.png' },
  { url: 'http://localhost:3845/assets/8d9463cf0a4ab67b6aad1aa36148fd101b32c66c.png', filename: 'third-panel-center.png' },
  { url: 'http://localhost:3845/assets/c2be2163a33bcf30ecc09bf7ea359a2e0811e0af.png', filename: 'third-panel-right.png' },
  { url: 'http://localhost:3845/assets/a2c739b979c09019bbe6f582da0f16baf4b9e231.png', filename: 'nav-bg.png' },
  { url: 'http://localhost:3845/assets/e211f43f3c529a7d3e80a40710e5597b1cd20194.svg', filename: 'nav-title.svg' },
  { url: 'http://localhost:3845/assets/25bf5588298c1db60b3ff1a736077be026db16d9.svg', filename: 'nav-logo-mask.svg' },
  { url: 'http://localhost:3845/assets/6a71b67215144d59972c22f7d6d1d9aba339c7dc.svg', filename: 'nav-logo-fill.svg' },
  { url: 'http://localhost:3845/assets/05bceec37e81f71aaa6425d5b5e20909c087ee8e.svg', filename: 'topbar-logo-mask.svg' },
  { url: 'http://localhost:3845/assets/15d4411371ea433c2f2e269116ed972cee4cc30c.svg', filename: 'topbar-logo-fill.svg' },
  { url: 'http://localhost:3845/assets/6f0a33f85ef3aa004eb6937578ab99510edd6477.svg', filename: 'select-chevron.svg' },
  { url: 'http://localhost:3845/assets/8bc051b65a2a2280d2760482aaef603cba125a59.svg', filename: 'month-prev.svg' },
  { url: 'http://localhost:3845/assets/32daf2c47e71f46a722d46fdc1650610c5061ef0.svg', filename: 'month-next.svg' },
  { url: 'http://localhost:3845/assets/4978d3f8e8b40eb8c39b749f0d434b7a4493e609.svg', filename: 'request-logo.svg' },
  { url: 'http://localhost:3845/assets/94bd9ceafe2bf6a2abe1d2adc8362f12eea3146d.svg', filename: 'request-cover-band.svg' },
  { url: 'http://localhost:3845/assets/01c8f8591677061a4b3f3ed84de9797185a980b4.svg', filename: 'request-logo-large.svg' },
  { url: 'http://localhost:3845/assets/f01f5b7f8d76fda826c357947f115944545e27d9.png', filename: 'request-anna.png' },
];

async function downloadAsset(url, filepath) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filepath, buffer);
    const stats = fs.statSync(filepath);
    return { success: true, size: stats.size };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function downloadAll() {
  console.log('Downloading Figma assets from localhost:3845...\n');
  
  const results = [];
  for (const asset of assets) {
    const filepath = path.join(downloadedDir, asset.filename);
    console.log(`Downloading ${asset.filename}...`);
    const result = await downloadAsset(asset.url, filepath);
    results.push({ ...asset, ...result });
    if (result.success) {
      console.log(`  ✓ Saved ${result.size} bytes\n`);
    } else {
      console.log(`  ✗ Failed: ${result.error}\n`);
    }
  }
  
  console.log('\n=== Summary ===');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  console.log(`Successfully downloaded: ${successful.length}/${assets.length}`);
  if (failed.length > 0) {
    console.log(`\nFailed downloads:`);
    failed.forEach(f => console.log(`  - ${f.filename}: ${f.error}`));
  }
  
  if (successful.length > 0) {
    console.log(`\nFiles saved to: ${downloadedDir}`);
    console.log('\nNext step: Update imports in HomeScreen.tsx to use local files');
  }
}

downloadAll().catch(console.error);
