import { google, type drive_v3 } from "googleapis";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

let authClientPromise: Promise<any> | null = null;

function getCredentialsFromEnv(): ServiceAccountCredentials {
  const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_JSON;

  if (inlineJson) {
    const parsed = JSON.parse(inlineJson) as Partial<ServiceAccountCredentials>;

    if (parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key.replace(/\\n/g, "\n"),
      };
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Faltan las credenciales de Google Drive. Configura GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, o GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_JSON.",
    );
  }

  return {
    client_email: clientEmail,
    private_key: privateKey,
  };
}

async function getAuthClient() {
  if (!authClientPromise) {
    const credentials = getCredentialsFromEnv();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    authClientPromise = auth.getClient();
  }

  return authClientPromise;
}

export async function getDriveClient() {
  const auth = await getAuthClient();
  return google.drive({
    version: "v3",
    auth,
  });
}

export async function listFolderFiles(folderId: string) {
  const drive = await getDriveClient();
  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, fileExtension, modifiedTime, size)",
      orderBy: "name_natural",
      pageSize: 1000,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageToken,
    });

    files.push(...(response.data.files ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

export async function getDriveFileMetadata(fileId: string) {
  const drive = await getDriveClient();
  const response = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, modifiedTime, size",
    supportsAllDrives: true,
  });

  return response.data;
}

export async function getDriveAccessToken() {
  const authClient = await getAuthClient();
  const token = await authClient.getAccessToken();

  if (!token) {
    throw new Error("No fue posible obtener un token de acceso para Google Drive.");
  }

  if (typeof token === "string") {
    return token;
  }

  if (typeof token.token === "string") {
    return token.token;
  }

  throw new Error("Google Drive devolvio un token vacio.");
}
