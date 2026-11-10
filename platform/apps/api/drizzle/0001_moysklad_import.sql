CREATE TABLE "currencies" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text,
	"rate" numeric(18, 6) DEFAULT 1 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_refs" (
	"source" text NOT NULL,
	"entity" text NOT NULL,
	"external_id" text NOT NULL,
	"local_id" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_refs_source_entity_external_id_pk" PRIMARY KEY("source","entity","external_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"inn" text,
	"kpp" text,
	"address" text,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retail_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"warehouse_id" integer,
	"organization_id" integer,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DROP INDEX "documents_type_number_uq";--> statement-breakpoint
ALTER TABLE "document_lines" ADD COLUMN "reserve" numeric(15, 3);--> statement-breakpoint
ALTER TABLE "document_lines" ADD COLUMN "vat" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "retail_point_id" integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "prices" ADD COLUMN "currency" text DEFAULT 'RUB' NOT NULL;--> statement-breakpoint
ALTER TABLE "retail_points" ADD CONSTRAINT "retail_points_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retail_points" ADD CONSTRAINT "retail_points_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_refs_local_idx" ON "external_refs" USING btree ("source","entity","local_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_retail_point_id_retail_points_id_fk" FOREIGN KEY ("retail_point_id") REFERENCES "public"."retail_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_type_number_idx" ON "documents" USING btree ("type","number");