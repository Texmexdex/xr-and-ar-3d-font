/**
 * Server for the 3D Sign Creator application with WebXR support
 * 
 * Supports both HTTP and HTTPS for WebXR which requires secure context
 * To use HTTP only: node server.js
 * To use HTTPS: node server.js --https
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8001;
const HTTPS_PORT = 8443;
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// Request handler function
const handleRequest = (request, response) => {
    // Remove query parameters from URL
    const urlPath = request.url.split('?')[0];
    let filePath = '.' + urlPath;
    
    // Default to index.html if the path is '/'
    if (filePath === './') {
        filePath = './index.html';
    }
    
    // Get the file extension
    const extname = path.extname(filePath);
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';
    
    // Add CORS headers for development
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Read the file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found
                fs.readFile('./404.html', function(error, content) {
                    response.writeHead(404, { 'Content-Type': 'text/html' });
                    response.end(content || '404: File Not Found', 'utf-8');
                });
            } else {
                // Server error
                response.writeHead(500);
                response.end('Sorry, there was an error: ' + error.code);
            }
        } else {
            // Success
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
};

// Create HTTP server
const httpServer = http.createServer(handleRequest);

// Start the HTTP server
httpServer.listen(PORT, () => {
    console.log(`HTTP Server running at http://localhost:${PORT}/`);
});

// Check if --https flag is passed
const useHttps = process.argv.includes('--https');

if (useHttps) {
    try {
        // Check if certificate files exist
        const certPath = path.join(__dirname, 'cert');
        const keyPath = path.join(certPath, 'key.pem');
        const certFilePath = path.join(certPath, 'cert.pem');
        
        if (!fs.existsSync(keyPath) || !fs.existsSync(certFilePath)) {
            console.log('Self-signed certificate files not found. Creating them now...');
            
            // Create cert directory if it doesn't exist
            if (!fs.existsSync(certPath)) {
                fs.mkdirSync(certPath, { recursive: true });
            }
            
            // Instructions for creating certificate
            console.log('\nTo create a self-signed certificate, use one of these methods:');
            console.log('\n1. Run the following OpenSSL command:');
            console.log('   openssl req -x509 -newkey rsa:2048 -keyout cert/key.pem -out cert/cert.pem -days 365 -nodes -subj "/CN=localhost"\n');
            console.log('2. Use a tool like mkcert (recommended for development):');
            console.log('   - Install mkcert: https://github.com/FiloSottile/mkcert');
            console.log('   - Run: mkcert -install');
            console.log('   - Run: mkcert -key-file cert/key.pem -cert-file cert/cert.pem localhost 127.0.0.1\n');
            console.log('After creating the certificate, restart the server with: node server.js --https\n');
            console.log('Using HTTP server only for now.');
        } else {
            // Create HTTPS server with the certificates
            const httpsOptions = {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certFilePath)
            };
            
            const httpsServer = https.createServer(httpsOptions, handleRequest);
            
            // Start the HTTPS server
            httpsServer.listen(HTTPS_PORT, () => {
                console.log(`HTTPS Server running at https://localhost:${HTTPS_PORT}/`);
                console.log(`Note: WebXR requires HTTPS. Use this URL on your device.`);
            });
        }
    } catch (error) {
        console.error('Error setting up HTTPS server:', error);
        console.log('Using HTTP server only.');
    }
}

console.log(`Press Ctrl+C to stop the server(s)`);