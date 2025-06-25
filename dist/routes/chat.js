"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketIO = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const socket_io_1 = require("socket.io");
const User_1 = __importDefault(require("../models/User"));
const ChatMessage_1 = __importDefault(require("../models/ChatMessage"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = express_1.default.Router();
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path_1.default.join(__dirname, '../../uploads');
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only images and videos are allowed'));
        }
    }
});
// File upload endpoint
router.post('/upload', auth_1.auth, (req, res) => {
    console.log('Received file upload request');
    const uploadHandler = upload.single('file');
    uploadHandler(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File size too large. Maximum size is 10MB.' });
            }
            return res.status(400).json({ message: err.message });
        }
        else if (err) {
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
        }
        catch (error) {
            console.error('Error processing upload:', error);
            res.status(500).json({ message: 'Error processing file upload' });
        }
    });
});
// Serve uploaded files
router.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../../uploads')));
// Store connected users with their socket IDs
const connectedUsers = new Map();
// Initialize Socket.IO
const initializeSocketIO = (httpServer) => {
    const io = new socket_io_1.Server(httpServer, {
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
                connectedUsers.set(userData.id, Object.assign(Object.assign({}, userData), { socketId: socket.id }));
            }
            else {
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
        socket.on('chat:private', (_a) => __awaiter(void 0, [_a], void 0, function* ({ recipientId, message }) {
            console.log('Received private message:', { recipientId, message });
            try {
                // Save message to database
                const newMessage = new ChatMessage_1.default({
                    content: message.content,
                    mediaUrl: message.mediaUrl,
                    mediaType: message.mediaType,
                    sender: message.sender._id,
                    recipient: recipientId,
                    timestamp: new Date()
                });
                yield newMessage.save();
                console.log('Message saved to database:', newMessage);
                // Get recipient's socket ID
                const recipientData = connectedUsers.get(recipientId);
                console.log('Recipient data:', recipientData);
                const messageWithTimestamp = Object.assign(Object.assign({}, message), { timestamp: newMessage.timestamp });
                if (recipientData) {
                    // Send to recipient
                    console.log('Sending message to recipient:', recipientData.socketId);
                    io.to(recipientData.socketId).emit('chat:private', messageWithTimestamp);
                }
                // Send confirmation to sender
                console.log('Sending confirmation to sender:', socket.id);
                socket.emit('chat:private', messageWithTimestamp);
            }
            catch (error) {
                console.error('Error handling message:', error);
                socket.emit('chat:error', { message: 'Failed to send message' });
            }
        }));
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
exports.initializeSocketIO = initializeSocketIO;
// Get all users
router.get('/users', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield User_1.default.find({}, '_id username email');
        console.log('Sending users:', users);
        res.json(users);
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users', error });
    }
}));
// Get chat history between two users
router.get('/history/:userId', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const currentUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const otherUserId = req.params.userId;
        const messages = yield ChatMessage_1.default.find({
            $or: [
                { sender: currentUserId, recipient: otherUserId },
                { sender: otherUserId, recipient: currentUserId }
            ]
        })
            .populate('sender', 'username email')
            .populate('recipient', 'username email')
            .sort({ timestamp: 1 });
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching chat history', error });
    }
}));
// Get connected users
router.get('/connected-users', auth_1.auth, (req, res) => {
    const users = Array.from(connectedUsers.values()).map(({ id, username, email }) => ({
        id,
        username,
        email
    }));
    res.json(users);
});
exports.default = router;
