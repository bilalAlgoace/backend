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
const Product_1 = __importDefault(require("../models/Product"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Create a new product
router.post('/', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productName, category, unitPrice, quantity, discount, isPublish } = req.body;
        // Calculate total value
        // const discountAmount = (unitPrice * quantity * (discount || 0)) / 100;
        const totalValue = unitPrice * quantity;
        console.log("TOTAL VALUE: ", totalValue);
        const product = new Product_1.default({
            productName,
            category,
            unitPrice,
            quantity,
            discount: discount || 0,
            totalValue,
            isPublish: isPublish || false,
            owner: req.user.id
        });
        yield product.save();
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: product
        });
    }
    catch (error) {
        console.error('Error creating product:', error);
        res.status(400).json({
            success: false,
            message: 'Error creating product',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get all products (with optional filtering by owner)
router.get('/', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { owner, category, isPublish } = req.query;
        let filter = {};
        // Filter by owner if specified, otherwise show user's own products
        if (owner === 'all') {
            // Show all published products
            filter.isPublish = true;
        }
        else {
            // Show user's own products
            filter.owner = req.user.id;
        }
        // Additional filters
        if (category) {
            filter.category = category;
        }
        if (isPublish !== undefined) {
            filter.isPublish = isPublish === 'true';
        }
        const products = yield Product_1.default.find(filter)
            .populate('owner', 'username email')
            .sort({ createdAt: -1 });
        res.json({
            success: true,
            message: 'Products retrieved successfully',
            data: {
                products,
                count: products.length
            }
        });
    }
    catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching products',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get product by ID
router.get('/:id', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const product = yield Product_1.default.findById(req.params.id)
            .populate('owner', 'username email');
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
                error: 'Product with the specified ID does not exist'
            });
        }
        // Check if user owns the product or if it's published
        if (product.owner.toString() !== req.user.id && !product.isPublish) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'You do not have permission to view this product'
            });
        }
        res.json({
            success: true,
            message: 'Product retrieved successfully',
            data: product
        });
    }
    catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching product',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Update product
router.put('/:id', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productName, category, unitPrice, quantity, discount, isPublish } = req.body;
        const product = yield Product_1.default.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
                error: 'Product with the specified ID does not exist'
            });
        }
        // Check if user owns the product
        if (product.owner.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'You can only edit your own products'
            });
        }
        // Update fields
        if (productName !== undefined)
            product.productName = productName;
        if (category !== undefined)
            product.category = category;
        if (unitPrice !== undefined)
            product.unitPrice = unitPrice;
        if (quantity !== undefined)
            product.quantity = quantity;
        if (discount !== undefined)
            product.discount = discount;
        if (isPublish !== undefined)
            product.isPublish = isPublish;
        // Save to trigger pre-save hooks for totalValue calculation
        yield product.save();
        res.json({
            success: true,
            message: 'Product updated successfully',
            data: product
        });
    }
    catch (error) {
        console.error('Error updating product:', error);
        res.status(400).json({
            success: false,
            message: 'Error updating product',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Delete product
router.delete('/:id', auth_1.auth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const product = yield Product_1.default.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
                error: 'Product with the specified ID does not exist'
            });
        }
        // Check if user owns the product
        if (product.owner.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'You can only delete your own products'
            });
        }
        yield Product_1.default.findByIdAndDelete(req.params.id);
        res.json({
            success: true,
            message: 'Product deleted successfully',
            data: { id: req.params.id }
        });
    }
    catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting product',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
exports.default = router;
