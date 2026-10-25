CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" uuid NOT NULL,
	"para" text NOT NULL,
	"assunto" text NOT NULL,
	"texto" text NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"proxima_tentativa_em" timestamp with time zone DEFAULT now() NOT NULL,
	"enviado_em" timestamp with time zone,
	"recusado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
