CREATE TABLE "reembolsos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"gasto_id" uuid NOT NULL,
	"feito_em" timestamp with time zone NOT NULL,
	CONSTRAINT "reembolsos_gasto_id_unique" UNIQUE("gasto_id")
);
--> statement-breakpoint
ALTER TABLE "reembolsos" ADD CONSTRAINT "reembolsos_gasto_id_gastos_id_fk" FOREIGN KEY ("gasto_id") REFERENCES "public"."gastos"("id") ON DELETE no action ON UPDATE no action;