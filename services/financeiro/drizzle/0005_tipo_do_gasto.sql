-- The default only fills gastos registered before the tipo existed; new ones must inform it.
ALTER TABLE "gastos" ADD COLUMN "tipo" text DEFAULT 'outros-itens' NOT NULL;--> statement-breakpoint
ALTER TABLE "gastos" ALTER COLUMN "tipo" DROP DEFAULT;
