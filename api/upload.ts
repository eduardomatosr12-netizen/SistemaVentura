import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { vercelOIDCCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';

const AWS_REGION = process.env.AWS_REGION;
const AWS_ROLE_ARN = process.env.AWS_ROLE_ARN;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;

if (!AWS_REGION) {
  console.error('[S3] AWS_REGION nao configurada');
}
if (!AWS_ROLE_ARN) {
  console.error('[S3] AWS_ROLE_ARN nao configurada');
}
if (!AWS_S3_BUCKET) {
  console.error('[S3] AWS_S3_BUCKET nao configurada');
}

const s3Client = new S3Client({
  region: AWS_REGION || 'us-east-1',
  credentials: AWS_ROLE_ARN
    ? vercelOIDCCredentialsProvider({
        RoleArn: AWS_ROLE_ARN,
        RoleSessionName: 'vercel-oidc-session',
      })
    : undefined,
});

const UPLOAD_PREFIXES: Record<string, string> = {
  lead: 'leads',
  profile: 'profiles',
  task: 'tasks',
  attachment: 'attachments',
  document: 'documents',
};

function generateFileKey(prefix: string, originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split('.').pop() || '';
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 50);
  return `${prefix}/${timestamp}-${random}-${sanitizedName}${ext ? '.' + ext : ''}`;
}

async function uploadToS3(
  file: Buffer,
  key: string,
  contentType: string
): Promise<{ key: string; url: string; ETag?: string }> {
  if (!AWS_S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET nao configurada');
  }
  if (!AWS_ROLE_ARN) {
    throw new Error('AWS_ROLE_ARN nao configurada');
  }

  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  });

  const response = await s3Client.send(command);
  const url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;

  return { key, url, ETag: response.ETag };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    return handleUpload(req, res);
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res);
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}

async function handleUpload(req: VercelRequest, res: VercelResponse) {
  try {
    const body = req.body as {
      file?: string;
      prefix?: string;
      fileName?: string;
      contentType?: string;
    };

    if (!body?.file) {
      return res.status(400).json({ error: 'Campo "file" e obrigatorio (base64).' });
    }

    if (!body.prefix || !UPLOAD_PREFIXES[body.prefix]) {
      return res.status(400).json({
        error: `Prefix invalido. Use: ${Object.keys(UPLOAD_PREFIXES).join(', ')}`,
      });
    }

    if (!body.fileName) {
      return res.status(400).json({ error: 'Campo "fileName" e obrigatorio.' });
    }

    const base64Data = body.file.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Arquivo muito grande. Maximo: 10MB.' });
    }

    const fileKey = generateFileKey(UPLOAD_PREFIXES[body.prefix], body.fileName);
    const result = await uploadToS3(
      buffer,
      fileKey,
      body.contentType || 'application/octet-stream'
    );

    return res.status(200).json({ success: true, key: result.key, url: result.url });
  } catch (error: unknown) {
    return handleS3Error(error, res);
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse) {
  try {
    const { key } = (req.body || {}) as { key?: string };

    if (!key) {
      return res.status(400).json({ error: 'Campo "key" e obrigatorio.' });
    }

    const command = new DeleteObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
    });

    await s3Client.send(command);
    return res.status(200).json({ success: true });
  } catch (error: unknown) {
    return handleS3Error(error, res);
  }
}

function handleS3Error(error: unknown, res: VercelResponse) {
  const err = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  console.error('[API S3] Erro:', err.message);

  if (err.message?.includes('AWS_ROLE_ARN') || err.message?.includes('AWS_S3_BUCKET')) {
    return res.status(503).json({
      error: 'Armazenamento nao configurado. Contate o administrador.',
      code: 'S3_NOT_CONFIGURED',
    });
  }

  if (err.name === 'AccessDenied' || err.$metadata?.httpStatusCode === 403) {
    return res.status(403).json({
      error: 'Permissao negada. Verifique a Role AWS.',
      code: 'S3_ACCESS_DENIED',
    });
  }

  if (err.name === 'ExpiredToken') {
    return res.status(401).json({
      error: 'Token OIDC expirado. Tente novamente.',
      code: 'S3_TOKEN_EXPIRED',
    });
  }

  if (err.name === 'InvalidAccessKeyId' || err.name === 'SignatureDoesNotMatch') {
    return res.status(401).json({
      error: 'Credenciais OIDC invalidas.',
      code: 'S3_AUTH_ERROR',
    });
  }

  return res.status(500).json({
    error: 'Erro interno ao processar upload.',
    code: 'INTERNAL_ERROR',
  });
}
