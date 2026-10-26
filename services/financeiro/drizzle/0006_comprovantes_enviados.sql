CREATE TABLE "comprovantes_enviados" (
	"id" uuid PRIMARY KEY NOT NULL,
	"participante_id" uuid NOT NULL,
	"comprovante_id" uuid NOT NULL,
	"valor_em_centavos" integer NOT NULL,
	"enviado_em" timestamp with time zone NOT NULL,
	"situacao" text NOT NULL,
	"valor_confirmado_em_centavos" integer,
	"motivo" text,
	CONSTRAINT "comprovantes_enviados_comprovante_id_unique" UNIQUE("comprovante_id")
);
--> statement-breakpoint
ALTER TABLE "comprovantes_enviados" ADD CONSTRAINT "comprovantes_enviados_participante_id_participantes_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participantes"("id") ON DELETE no action ON UPDATE no action;