import { describe, it, expect } from 'vitest';
import {
  SortBy,
  SortOrder,
  ItemStatus,
  ItemCondition,
  ShippingPayer,
  Color,
} from '../../src/models/enums';

describe('Enums', () => {
  describe('SortBy', () => {
    it('should have correct API values', () => {
      expect(SortBy.Score).toBe('SORT_SCORE');
      expect(SortBy.CreatedTime).toBe('SORT_CREATED_TIME');
      expect(SortBy.Price).toBe('SORT_PRICE');
      expect(SortBy.NumLikes).toBe('SORT_NUM_LIKES');
    });
  });

  describe('SortOrder', () => {
    it('should have correct API values', () => {
      expect(SortOrder.Desc).toBe('ORDER_DESC');
      expect(SortOrder.Asc).toBe('ORDER_ASC');
    });
  });

  describe('ItemStatus', () => {
    it('should have correct API values', () => {
      expect(ItemStatus.OnSale).toBe('STATUS_ON_SALE');
      expect(ItemStatus.SoldOut).toBe('STATUS_SOLD_OUT');
      expect(ItemStatus.Trading).toBe('STATUS_TRADING');
    });
  });

  describe('ItemCondition', () => {
    it('should have correct numeric IDs', () => {
      expect(ItemCondition.BrandNew).toBe(1);
      expect(ItemCondition.LikeNew).toBe(2);
      expect(ItemCondition.Good).toBe(3);
      expect(ItemCondition.Fair).toBe(4);
      expect(ItemCondition.Poor).toBe(5);
      expect(ItemCondition.Bad).toBe(6);
    });
  });

  describe('ShippingPayer', () => {
    it('should have correct numeric IDs', () => {
      expect(ShippingPayer.Buyer).toBe(1);
      expect(ShippingPayer.Seller).toBe(2);
    });
  });

  describe('Color', () => {
    it('should have correct numeric IDs', () => {
      expect(Color.Black).toBe(1);
      expect(Color.White).toBe(2);
      expect(Color.Gray).toBe(3);
      expect(Color.Brown).toBe(4);
      expect(Color.Red).toBe(5);
      expect(Color.Pink).toBe(6);
      expect(Color.Purple).toBe(7);
      expect(Color.Blue).toBe(8);
      expect(Color.Beige).toBe(9);
      expect(Color.Green).toBe(10);
      expect(Color.Yellow).toBe(11);
      expect(Color.Orange).toBe(12);
    });
  });
});
