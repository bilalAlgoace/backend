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
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Message Schema
const messageSchema = new mongoose_1.default.Schema({
    content: {
        type: String,
        required: true
    },
    sender: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});
// Create Message model
const Message = mongoose_1.default.model('Message', messageSchema);
// Get all messages
router.get('/', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const messages = yield Message.find()
            .populate('sender', 'username email')
            .sort({ timestamp: -1 });
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching messages', error });
    }
}));
// Create a new message
router.post('/', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { content } = req.body;
        const newMessage = new Message({
            content,
            sender: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id
        });
        const savedMessage = yield newMessage.save();
        const populatedMessage = yield Message.findById(savedMessage._id)
            .populate('sender', 'username email');
        res.status(201).json(populatedMessage);
    }
    catch (error) {
        res.status(400).json({ message: 'Error creating message', error });
    }
}));
// Get a specific message
router.get('/:id', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const message = yield Message.findById(req.params.id)
            .populate('sender', 'username email');
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }
        res.json(message);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching message', error });
    }
}));
// Update a message
router.put('/:id', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { content } = req.body;
        const message = yield Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }
        // Check if user is the sender of the message
        if (message.sender.toString() !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            return res.status(403).json({ message: 'Not authorized to update this message' });
        }
        const updatedMessage = yield Message.findByIdAndUpdate(req.params.id, { content }, { new: true }).populate('sender', 'username email');
        res.json(updatedMessage);
    }
    catch (error) {
        res.status(400).json({ message: 'Error updating message', error });
    }
}));
// Delete a message
router.delete('/:id', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const message = yield Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }
        // Check if user is the sender of the message
        if (message.sender.toString() !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            return res.status(403).json({ message: 'Not authorized to delete this message' });
        }
        yield Message.findByIdAndDelete(req.params.id);
        res.json({ message: 'Message deleted successfully' });
    }
    catch (error) {
        console.log("ERROR: ", error);
        res.status(500).json({ message: 'Error deleting message', error });
    }
}));
exports.default = router;
