declare module 'qiniu' {
  export namespace auth {
    namespace digest {
      class Mac {
        constructor(accessKey: string, secretKey: string);
      }
    }
  }

  export namespace conf {
    interface ConfigOptions {
      useHttpsDomain?: boolean;
      useCdnDomain?: boolean;
      zone?: Zones;
    }

    class Config {
      constructor(options?: ConfigOptions);
      useHttpsDomain?: boolean;
      useCdnDomain?: boolean;
      zone?: Zones;
    }

    interface Zones {}
  }

  export namespace zone {
    const Zone_z0: conf.Zones;
    const Zone_z1: conf.Zones;
    const Zone_z2: conf.Zones;
    const Zone_na0: conf.Zones;
    const Zone_as0: conf.Zones;
  }

  export namespace form_up {
    class PutExtra {
      constructor(
        fname?: string,
        params?: Record<string, unknown>,
        mimeType?: string,
        crc32?: string,
        checkCrc?: number | boolean,
        metadata?: Record<string, unknown>
      );
      fname: string;
      params: Record<string, unknown>;
      mimeType: string | null;
      crc32: string | null;
      checkCrc: number | boolean;
      metadata: Record<string, unknown>;
    }

    type UploadCallback = (error: Error | null, body: unknown, info: { statusCode: number; data?: unknown }) => void;

    class FormUploader {
      constructor(config?: conf.Config);
      put(
        uploadToken: string,
        key: string | null,
        body: Buffer | NodeJS.ReadableStream | string,
        putExtra: PutExtra,
        callback: UploadCallback
      ): void;
    }
  }

  export namespace rs {
    interface PutPolicyOptions {
      scope: string;
      expires?: number;
    }

    class PutPolicy {
      constructor(options: PutPolicyOptions);
      uploadToken(mac: auth.digest.Mac): string;
    }

    type BucketCallback = (error: Error | null, body: unknown, info: { statusCode: number }) => void;

    class BucketManager {
      constructor(mac: auth.digest.Mac, config: conf.Config);
      delete(bucket: string, key: string, callback: BucketCallback): void;
    }
  }

  const qiniu: {
    auth: typeof auth;
    conf: typeof conf;
    zone: typeof zone;
    form_up: typeof form_up;
    rs: typeof rs;
  };

  export = qiniu;
}
