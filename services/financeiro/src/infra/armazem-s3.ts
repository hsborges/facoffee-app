import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Armazem } from '../application/arquivos.js';
import type { TipoDeArquivo } from '../domain/arquivo.js';

/** Where comprovantes and notas are kept: any S3 API (SeaweedFS locally, ADR 0002). */
export type S3Config = {
  readonly endpoint: string;
  readonly accessKey: string;
  readonly secretKey: string;
  readonly bucket: string;
};

/**
 * {@link Armazem} on an S3 bucket, created on connect if missing. The participante of a
 * comprovante goes in the object metadata, so access needs no database.
 */
export const connectArmazem = async ({ endpoint, accessKey, secretKey, bucket }: S3Config) => {
  const client = new S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
  await client.send(new CreateBucketCommand({ Bucket: bucket })).catch((error: Error) => {
    if (error.name !== 'BucketAlreadyOwnedByYou' && error.name !== 'BucketAlreadyExists') {
      throw error;
    }
  });

  const armazem: Armazem = {
    guardar: async (chave, { tipo, conteudo, participanteId }) => {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: chave,
          Body: conteudo,
          ContentType: tipo,
          Metadata: participanteId ? { participante: participanteId } : undefined,
        }),
      );
    },
    obter: async (chave) => {
      const objeto = await client
        .send(new GetObjectCommand({ Bucket: bucket, Key: chave }))
        .catch((error) => {
          if (error instanceof NoSuchKey) return undefined;
          throw error;
        });
      if (!objeto?.Body) return undefined;
      return {
        tipo: objeto.ContentType as TipoDeArquivo,
        conteudo: await objeto.Body.transformToByteArray(),
        ...(objeto.Metadata?.participante && { participanteId: objeto.Metadata.participante }),
      };
    },
  };

  return {
    armazem,
    isHealthy: () =>
      client.send(new HeadBucketCommand({ Bucket: bucket })).then(
        () => true,
        () => false,
      ),
    close: () => client.destroy(),
  };
};
