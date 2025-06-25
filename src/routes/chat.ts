import express, { Request, Response } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import User from '../models/User';
import ChatMessage from '../models/ChatMessage';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'));
    }
  }
});

// File upload endpoint
router.post('/upload', auth, (req: Request, res: Response) => {
  console.log('Received file upload request');
  
  const uploadHandler = upload.single('file');
  
  uploadHandler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ message: err.message });
    } else if (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ message: err.message });
    }

    try {
      const file = req.file;
      if (!file) {
        console.error('No file in request');
        return res.status(400).json({ message: 'No file uploaded' });
      }

      console.log('File uploaded successfully:', {
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size
      });

      // Create URL for the uploaded file
      const fileUrl = `/uploads/${file.filename}`;
      console.log('File URL:', fileUrl);
      res.json({ url: fileUrl });
    } catch (error) {
      console.error('Error processing upload:', error);
      res.status(500).json({ message: 'Error processing file upload' });
    }
  });
});

// Serve uploaded files
router.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Store connected users with their socket IDs
const connectedUsers = new Map();

// Initialize Socket.IO
export const initializeSocketIO = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  // Socket.IO middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);

    // Handle user presence
    socket.on('user:presence', (userData) => {
      console.log('User presence update:', userData);
      console.log('Current connected users:', Array.from(connectedUsers.entries()));
      
      if (userData.isOnline) {
        // Store user with their socket ID when they enter chat page
        connectedUsers.set(userData.id, {
          ...userData,
          socketId: socket.id
        });
      } else {
        // Remove user when they leave chat page
        connectedUsers.delete(userData.id);
      }
      
      // Get list of online user IDs
      const onlineUserIds = Array.from(connectedUsers.keys());
      console.log('Emitting online users:', onlineUserIds);
      
      // Emit list of online users to all clients
      io.emit('users:online', onlineUserIds);

      // Log all connected users
      console.log('Updated connected users:', Array.from(connectedUsers.entries()));
    });

    // Handle private messages
    socket.on('chat:private', async ({ recipientId, message }) => {
      console.log('Received private message:', { recipientId, message });
      
      try {
        // Save message to database
        const newMessage = new ChatMessage({
          content: message.content,
          mediaUrl: message.mediaUrl,
          mediaType: message.mediaType,
          sender: message.sender._id,
          recipient: recipientId,
          timestamp: new Date()
        });
        await newMessage.save();
        console.log('Message saved to database:', newMessage);

        // Get recipient's socket ID
        const recipientData = connectedUsers.get(recipientId);
        console.log('Recipient data:', recipientData);

        const messageWithTimestamp = {
          ...message,
          timestamp: newMessage.timestamp
        };

        if (recipientData) {
          // Send to recipient
          console.log('Sending message to recipient:', recipientData.socketId);
          io.to(recipientData.socketId).emit('chat:private', messageWithTimestamp);
        }

        // Send confirmation to sender
        console.log('Sending confirmation to sender:', socket.id);
        socket.emit('chat:private', messageWithTimestamp);
      } catch (error) {
        console.error('Error handling message:', error);
        socket.emit('chat:error', { message: 'Failed to send message' });
      }
    });

    // Handle typing status
    socket.on('user:typing', ({ recipientId, username }) => {
      const recipientData = connectedUsers.get(recipientId);
      if (recipientData) {
        io.to(recipientData.socketId).emit('user:typing', { username });
      }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
      // Find and remove the disconnected user
      for (const [userId, userData] of connectedUsers.entries()) {
        if (userData.socketId === socket.id) {
          console.log('User disconnected:', userId);
          connectedUsers.delete(userId);
          io.emit('user:left', {
            id: userId,
            username: userData.username
          });
          
          // Emit updated list of online users
          const onlineUserIds = Array.from(connectedUsers.keys());
          io.emit('users:online', onlineUserIds);
          break;
        }
      }
    });
  });

  return io;
};

// Get all users
router.get('/users', auth, async (req: Request, res: Response) => {
  try {
    const users = await User.find({}, '_id username email');
    console.log('Sending users:', users);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error });
  }
});

// Get chat history between two users
router.get('/history/:userId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const otherUserId = req.params.userId;

    const messages = await ChatMessage.find({
      $or: [
        { sender: currentUserId, recipient: otherUserId },
        { sender: otherUserId, recipient: currentUserId }
      ]
    })
    .populate('sender', 'username email')
    .populate('recipient', 'username email')
    .sort({ timestamp: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching chat history', error });
  }
});

// Get connected users
router.get('/connected-users', auth, (req: Request, res: Response) => {
  const users = Array.from(connectedUsers.values()).map(({ id, username, email }) => ({
    id,
    username,
    email
  }));
  res.json(users);
});

export default router; 