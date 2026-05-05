const fs = require('fs');
const path = require('path');
const sizeOf = require('image-size');

class BackgroundController {
  static async getBackgroundInfo(req, res) {
    try {
      const backgroundDir = 'G:\\Work\\sideprojects\\game1\\client\\src\\assets\\background';
      
      if (!fs.existsSync(backgroundDir)) {
        return res.status(404).json({ error: 'Background directory not found' });
      }
      
      const files = fs.readdirSync(backgroundDir);
      const imageFiles = files.filter(file => 
        ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(path.extname(file).toLowerCase())
      );
      
      const backgrounds = [];
      for (const file of imageFiles) {
        const filePath = path.join(backgroundDir, file);
        try {
          const dimensions = sizeOf(filePath);
          backgrounds.push({
            name: file.replace(path.extname(file), ''),
            filename: file,
            width: dimensions.width,
            height: dimensions.height,
            path: `/assets/background/${file}`
          });
        } catch (err) {
          console.warn(`Failed to read dimensions for ${file}: ${err.message}`);
        }
      }
      
      res.json(backgrounds);
    } catch (error) {
      console.error('Error getting background info:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async getBackgroundDimensions(req, res) {
    try {
      const { filename } = req.params;
      const backgroundDir = 'G:\\Work\\sideprojects\\game1\\client\\src\\assets\\background';
      const filePath = path.join(backgroundDir, filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Background image not found' });
      }
      
      const dimensions = sizeOf(filePath);
      res.json({
        filename,
        width: dimensions.width,
        height: dimensions.height
      });
    } catch (error) {
      console.error('Error getting background dimensions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = BackgroundController;