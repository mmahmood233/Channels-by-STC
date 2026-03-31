import { z } from "zod";

export const deviceSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Device name is required"),
  brand: z.string().min(1, "Brand is required"),
  category_id: z.string().uuid("Please select a category"),
  unit_price: z.number().min(0, "Price must be 0 or more"),
  cost_price: z.number().min(0, "Cost must be 0 or more").nullable(),
  description: z.string().nullable(),
  image_url: z.string().url().nullable().or(z.literal("")),
  low_stock_threshold: z.number().int().min(0, "Threshold must be 0 or more"),
});

export type DeviceFormData = z.infer<typeof deviceSchema>;
