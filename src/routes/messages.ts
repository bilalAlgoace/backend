import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { auth, AuthRequest } from '../middleware/auth';
import User from '../models/User';

const router = express.Router();

// Message Schema
const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Create Message model
const Message = mongoose.model('Message', messageSchema);

// Get all messages
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const messages = await Message.find()
      .populate('sender', 'username email')
      .sort({ timestamp: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching messages', error });
  }
});

// Create a new message
router.post('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    const newMessage = new Message({
      content,
      sender: req.user?.id
    });
    const savedMessage = await newMessage.save();
    const populatedMessage = await Message.findById(savedMessage._id)
      .populate('sender', 'username email');
    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(400).json({ message: 'Error creating message', error });
  }
});

// Get a specific message
router.get('/:id', auth, async (req: Request, res: Response) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate('sender', 'username email');
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    res.json(message);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching message', error });
  }
});

// Update a message
router.put('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender of the message
    if (message.sender.toString() !== req.user?.id) {
      return res.status(403).json({ message: 'Not authorized to update this message' });
    }

    const updatedMessage = await Message.findByIdAndUpdate(
      req.params.id,
      { content },
      { new: true }
    ).populate('sender', 'username email');

    res.json(updatedMessage);
  } catch (error) {
    res.status(400).json({ message: 'Error updating message', error });
  }
});

// Delete a message
router.delete('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender of the message
    if (message.sender.toString() !== req.user?.id) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    await Message.findByIdAndDelete(req.params.id);
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.log("ERROR: ", error)
    res.status(500).json({ message: 'Error deleting message', error });
  }
});

export default router; 