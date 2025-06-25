import { Document } from 'mongoose';

export interface IProduct extends Document {
  productName: string;
  category: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  totalValue: number;
  isPublish: boolean;
  owner: string;
  createdAt: Date;
  updatedAt: Date;
} 