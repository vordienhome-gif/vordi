ALTER TABLE "products" DROP CONSTRAINT "products_code_unique";--> statement-breakpoint
ALTER TABLE "barcodes" DROP CONSTRAINT "barcodes_pkey";--> statement-breakpoint
ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_barcode_variant_id_pk" PRIMARY KEY("barcode","variant_id");--> statement-breakpoint
CREATE INDEX "products_code_idx" ON "products" USING btree ("code");