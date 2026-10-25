CREATE TABLE "cotas_devidas" (
	"participante_id" uuid NOT NULL,
	"mes" text NOT NULL,
	"tipo_de_cota" text NOT NULL,
	"valor_em_centavos" integer NOT NULL,
	CONSTRAINT "cotas_devidas_participante_id_mes_pk" PRIMARY KEY("participante_id","mes")
);
