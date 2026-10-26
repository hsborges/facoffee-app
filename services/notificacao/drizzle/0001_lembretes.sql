CREATE TABLE "lembretes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participante_id" uuid NOT NULL,
	"mes" text NOT NULL,
	"tipo" text NOT NULL,
	"registrado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lembretes_participante_id_mes_tipo_unique" UNIQUE("participante_id","mes","tipo")
);
