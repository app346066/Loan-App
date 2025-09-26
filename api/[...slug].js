// api/[...slug].js - Catch-all API route for unmatched paths
module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(404).json({
    error: 'API endpoint not found',
    message: `The requested path ${req.url} does not exist`,
    availableEndpoints: [
      '/api/index (main loans API)',
      '/api/health (health check)',
      '/api/debug (debug information)'
    ]
  });
};