import { defineConfig, Plugin, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import fs from 'fs'
import path from 'path'

function localPdfApi(): Plugin {
    return {
        name: 'local-pdf-api',
        configureServer(server) {
            // API to save a local copy of the PDF for the viewer
            server.middlewares.use('/api/upload-local', (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405);
                    return res.end();
                }

                const fileName = req.headers['x-file-name'] as string;
                if (!fileName) {
                    res.writeHead(400);
                    return res.end(JSON.stringify({ error: 'Missing x-file-name header' }));
                }

                const targetDir = path.join(process.cwd(), 'public', 'pdfs', 'default');
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                const filePath = path.join(targetDir, fileName);
                const fileStream = fs.createWriteStream(filePath);

                req.pipe(fileStream);

                fileStream.on('finish', () => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'success', path: `/pdfs/default/${fileName}` }));
                });

                fileStream.on('error', (err) => {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: err.message }));
                });
            });

            server.middlewares.use('/api/local-files', (_req, res) => {
                const baseDir = path.join(process.cwd(), 'public', 'pdfs', 'default');
                const enqueuedDir = path.join(baseDir, '__enqueued__');

                try {
                    let files: any[] = [];

                    // Helper to read directory
                    const readDirPdfs = (dirPath: string, subPath: string) => {
                        if (!fs.existsSync(dirPath)) return [];
                        return fs.readdirSync(dirPath)
                            .filter(f => f.toLowerCase().endsWith('.pdf'))
                            .map(f => {
                                const stat = fs.statSync(path.join(dirPath, f));
                                return {
                                    name: f,
                                    size: stat.size,
                                    modified: stat.mtime.toISOString(),
                                    subPath: subPath
                                };
                            });
                    };

                    files = [
                        ...readDirPdfs(baseDir, 'default'),
                        ...readDirPdfs(enqueuedDir, 'default/__enqueued__')
                    ];

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ files }));
                } catch (err) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ files: [] }));
                }
            });


        }
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react(), localPdfApi()],
        define: {
            'process.env.NEXT_PUBLIC_API_BASE_URL': JSON.stringify(env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000')
        },
        server: {
            port: 3000,
            host: true,
            watch: {
                usePolling: true,
            }
        }
    };
})
