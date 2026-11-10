CREATE TABLE "money_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer,
	"data" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barcodes" (
	"barcode" text PRIMARY KEY NOT NULL,
	"variant_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counterparties" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'legal' NOT NULL,
	"name" text NOT NULL,
	"inn" text,
	"kpp" text,
	"phone" text,
	"email" text,
	"address" text,
	"price_type_id" integer,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"credit_limit" bigint,
	"comment" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"qty" numeric(15, 3) NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"discount" numeric(5, 2) DEFAULT 0 NOT NULL,
	"expected" numeric(15, 3)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"number" text NOT NULL,
	"moment" timestamp with time zone NOT NULL,
	"posted" boolean DEFAULT false NOT NULL,
	"status" text,
	"warehouse_id" integer,
	"target_warehouse_id" integer,
	"counterparty_id" integer,
	"account_id" integer,
	"sum" bigint DEFAULT 0 NOT NULL,
	"comment" text,
	"parent_id" integer,
	"external_id" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"password_hash" text NOT NULL,
	"phone" text,
	"position" text,
	"warehouse_ids" integer[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "product_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_codes" (
	"line_id" integer NOT NULL,
	"document_id" integer NOT NULL,
	"cis" text NOT NULL,
	"raw" text NOT NULL,
	CONSTRAINT "line_codes_document_id_cis_pk" PRIMARY KEY("document_id","cis")
);
--> statement-breakpoint
CREATE TABLE "money_moves" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"amount" bigint NOT NULL,
	"moment" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "number_sequences" (
	"type" text PRIMARY KEY NOT NULL,
	"last" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "price_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"variant_id" integer NOT NULL,
	"price_type_id" integer NOT NULL,
	"value" bigint NOT NULL,
	CONSTRAINT "prices_variant_id_price_type_id_pk" PRIMARY KEY("variant_id","price_type_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"folder_id" integer,
	"name" text NOT NULL,
	"article" text,
	"code" text,
	"unit" text DEFAULT 'шт' NOT NULL,
	"vat" integer,
	"is_service" boolean DEFAULT false NOT NULL,
	"marking_type" text,
	"buy_price" bigint DEFAULT 0 NOT NULL,
	"min_stock" numeric(15, 3) DEFAULT 0 NOT NULL,
	"description" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement_moves" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"counterparty_id" integer NOT NULL,
	"amount" bigint NOT NULL,
	"moment" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_moves" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"line_id" integer,
	"variant_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"qty" numeric(15, 3) NOT NULL,
	"unit_cost" bigint,
	"moment" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"name" text NOT NULL,
	"characteristics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"code" text,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparties" ADD CONSTRAINT "counterparties_price_type_id_price_types_id_fk" FOREIGN KEY ("price_type_id") REFERENCES "public"."price_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_target_warehouse_id_warehouses_id_fk" FOREIGN KEY ("target_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_account_id_money_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."money_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_codes" ADD CONSTRAINT "line_codes_line_id_document_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."document_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_codes" ADD CONSTRAINT "line_codes_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_moves" ADD CONSTRAINT "money_moves_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_moves" ADD CONSTRAINT "money_moves_account_id_money_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."money_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_price_type_id_price_types_id_fk" FOREIGN KEY ("price_type_id") REFERENCES "public"."price_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_folder_id_product_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."product_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_moves" ADD CONSTRAINT "settlement_moves_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_moves" ADD CONSTRAINT "settlement_moves_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barcodes_variant_idx" ON "barcodes" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "counterparties_inn_idx" ON "counterparties" USING btree ("inn");--> statement-breakpoint
CREATE INDEX "document_lines_doc_idx" ON "document_lines" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_type_number_uq" ON "documents" USING btree ("type","number");--> statement-breakpoint
CREATE INDEX "documents_type_moment_idx" ON "documents" USING btree ("type","moment");--> statement-breakpoint
CREATE INDEX "documents_parent_idx" ON "documents" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "line_codes_cis_idx" ON "line_codes" USING btree ("cis");--> statement-breakpoint
CREATE INDEX "products_article_idx" ON "products" USING btree ("article");--> statement-breakpoint
CREATE INDEX "settlement_moves_cp_idx" ON "settlement_moves" USING btree ("counterparty_id");--> statement-breakpoint
CREATE INDEX "stock_moves_variant_wh_idx" ON "stock_moves" USING btree ("variant_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_moves_moment_idx" ON "stock_moves" USING btree ("moment");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "variants" USING btree ("product_id");