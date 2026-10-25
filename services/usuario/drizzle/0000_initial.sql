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
CREATE TABLE "usuarios_desativados" (
	"id" uuid PRIMARY KEY NOT NULL,
	"desativado_em" timestamp with time zone NOT NULL
);
