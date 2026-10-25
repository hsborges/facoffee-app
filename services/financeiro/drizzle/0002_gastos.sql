CREATE TABLE "gastos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"participante_id" uuid NOT NULL,
	"valor_em_centavos" integer NOT NULL,
	"origem" text NOT NULL,
	"nota_id" uuid NOT NULL,
	"feito_em" timestamp with time zone NOT NULL,
	CONSTRAINT "gastos_nota_id_unique" UNIQUE("nota_id")
);
--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_participante_id_participantes_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participantes"("id") ON DELETE no action ON UPDATE no action;