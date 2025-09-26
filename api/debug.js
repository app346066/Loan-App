// api/debug.js - Debug endpoint for Vercel deployment
module.exports = async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Collect debug information
    const debugInfo = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        mongodbUri: !!process.env.MONGODB_URI,
        mongodbDb: process.env.MONGODB_DB || 'not-set',
        tmpDir: '/tmp',
        cwd: process.cwd()
      },
      filesystem: {
        tmpExists: require('fs').existsSync('/tmp'),
        canWriteTmp: false
      }
    };

    // Test file system access
    try {
      const fs = require('fs');
      const path = require('path');
      const testFile = path.join('/tmp', 'test-write.txt');
      fs.writeFileSync(testFile, 'test');
      debugInfo.filesystem.canWriteTmp = fs.existsSync(testFile);
      if (debugInfo.filesystem.canWriteTmp) {
        fs.unlinkSync(testFile); // cleanup
      }
    } catch (error) {
      debugInfo.filesystem.writeError = error.message;
    }

    // Test MongoDB connection if available
    if (process.env.MONGODB_URI) {
      try {
        const { MongoClient } = require('mongodb');
        const client = new MongoClient(process.env.MONGODB_URI, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 3000,
        });
        
        await client.connect();
        debugInfo.mongodb = {
          connected: true,
          dbName: process.env.MONGODB_DB || 'loanapp'
        };
        await client.close();
      } catch (error) {
        debugInfo.mongodb = {
          connected: false,
          error: error.message
        };
      }
    } else {
      debugInfo.mongodb = {
        connected: false,
        reason: 'No MONGODB_URI provided'
      };
    }

    return res.status(200).json({
      status: 'ok',
      message: 'Debug endpoint working correctly',
      debug: debugInfo
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Debug endpoint failed',
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
};