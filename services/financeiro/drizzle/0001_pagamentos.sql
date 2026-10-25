CREATE TABLE "pagamentos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"participante_id" uuid NOT NULL,
	"valor_em_centavos" integer NOT NULL,
	"forma" text NOT NULL,
	"comprovante_id" uuid,
	"recebido_em" timestamp with time zone NOT NULL,
	CONSTRAINT "pagamentos_comprovante_id_unique" UNIQUE("comprovante_id")
);
--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_participante_id_participantes_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participantes"("id") ON DELETE no action ON UPDATE no action;