CREATE TABLE "cotas" (
	"participante_id" uuid NOT NULL,
	"mes" text NOT NULL,
	"tipo_de_cota" text NOT NULL,
	"valor_em_centavos" integer NOT NULL,
	CONSTRAINT "cotas_participante_id_mes_pk" PRIMARY KEY("participante_id","mes")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"seq" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbox_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id" uuid NOT NULL,
	"routing_key" text NOT NULL,
	"event" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "outbox_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "participantes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ativo" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotas" ADD CONSTRAINT "cotas_participante_id_participantes_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participantes"("id") ON DELETE no action ON UPDATE no action;