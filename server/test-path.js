const fs = require('fs');
const path = require('path');
const sizeOf = require('image-size');

const backgroundDir = path.join(__dirname, '../client', 'src', 'assets', 'background');
console.log('Background directory:', backgroundDir);
console.log('Exists:', fs.existsSync(backgroundDir));

if (fs.existsSync(backgroundDir)) {
  const files = fs.readdirSync(backgroundDir);
  console.log('Files:', files);
  
  const imageFiles = files.filter(file => 
    ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(path.extname(file).toLowerCase())
  );
  console.log('Image files:', imageFiles);
  
  for (const file of imageFiles) {
    const filePath = path.join(backgroundDir, file);
    try {
      const buffer = fs.readFileSync(filePath);
      const dimensions = sizeOf(buffer);
      console.log(file + ': ' + dimensions.width + 'x' + dimensions.height);
    } catch (err) {
      console.warn('Failed to read ' + file + ': ' + err.message);
    }
  }
}
