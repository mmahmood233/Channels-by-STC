import { z } from "zod";

export const saleItemSchema = z.object({
  device_id: z.string().uuid("Please select a device"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unit_price: z.number().min(0, "Price must be 0 or more"),
});

export const saleSchema = z.object({
  store_id: z.string().uuid("Please select a store"),
  sale_date: z.string().min(1, "Sale date is required"),
  items: z.array(saleItemSchema).min(1, "At least one item is required"),
  notes: z.string().nullable(),
});

export type SaleFormData = z.infer<typeof saleSchema>;
