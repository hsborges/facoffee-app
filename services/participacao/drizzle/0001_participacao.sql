CREATE TABLE "processed_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "valores_da_cota" (
	"tipo_de_cota" text NOT NULL,
	"ano" integer NOT NULL,
	"valor_em_centavos" integer NOT NULL,
	CONSTRAINT "valores_da_cota_tipo_de_cota_ano_pk" PRIMARY KEY("tipo_de_cota","ano")
);
--> statement-breakpoint
ALTER TABLE "participantes" ADD COLUMN "troca_tipo_de_cota" text;--> statement-breakpoint
ALTER TABLE "participantes" ADD COLUMN "troca_a_partir_de" text;