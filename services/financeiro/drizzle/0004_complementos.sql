CREATE TABLE "complementos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"valor_total_em_centavos" integer NOT NULL,
	"solicitado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partes" (
	"complemento_id" uuid NOT NULL,
	"participante_id" uuid NOT NULL,
	"valor_em_centavos" integer NOT NULL,
	CONSTRAINT "partes_complemento_id_participante_id_pk" PRIMARY KEY("complemento_id","participante_id")
);
--> statement-breakpoint
ALTER TABLE "partes" ADD CONSTRAINT "partes_complemento_id_complementos_id_fk" FOREIGN KEY ("complemento_id") REFERENCES "public"."complementos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partes" ADD CONSTRAINT "partes_participante_id_participantes_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participantes"("id") ON DELETE no action ON UPDATE no action;