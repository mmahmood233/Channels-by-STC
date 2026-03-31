import { z } from "zod";

export const transferItemSchema = z.object({
  device_id: z.string().uuid("Please select a device"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

export const transferSchema = z.object({
  source_store_id: z.string().uuid("Please select a source location"),
  destination_store_id: z.string().uuid("Please select a destination"),
  items: z.array(transferItemSchema).min(1, "At least one item is required"),
  notes: z.string().nullable(),
});

export type TransferFormData = z.infer<typeof transferSchema>;
