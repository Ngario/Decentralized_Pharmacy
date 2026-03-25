import http from 'http';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createApp } from './app';

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const app = createApp();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  // Generic room join for consultation sessions (MVP placeholder)
  socket.on('join', (room: string) => {
    if (typeof room !== 'string' || room.length > 200) return;
    socket.join(room);
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] Listening on http://localhost:${PORT}`);
});

