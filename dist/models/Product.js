"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const productSchema = new mongoose_1.default.Schema({
    productName: {
        type: String,
        required: true,
        trim: true,
        minlength: 1
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalValue: {
        type: Number,
        required: true,
        min: 0
    },
    isPublish: {
        type: Boolean,
        default: false
    },
    owner: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
}, { timestamps: true });
// // Update the updatedAt field before saving
// productSchema.pre('save', function(next) {
//   this.updatedAt = new Date();
//   next();
// });
// Calculate totalValue before saving
productSchema.pre('save', function (next) {
    if (this.isModified('unitPrice') || this.isModified('quantity')) {
        this.totalValue = this.unitPrice * this.quantity;
    }
    next();
});
const Product = mongoose_1.default.model('Product', productSchema);
exports.default = Product;
