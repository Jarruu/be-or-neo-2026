import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { IStorageService } from './storage.interface';

@Injectable()
export class CloudinaryStorageService implements IStorageService {
  private readonly logger = new Logger(CloudinaryStorageService.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder = 'neo-telemetri',
  ): Promise<string> {
    try {
      const isImage = file.mimetype.startsWith('image/');
      const extensionMatch = file.originalname.match(/(\.[^./\\]+)$/);
      const extension = extensionMatch?.[1] ?? '';
      const baseName = file.originalname.replace(/\.[^/.]+$/, '');
      const normalizedBaseName = baseName
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-_]/g, '');
      const timestamp = Date.now();
      const publicId = `${normalizedBaseName || 'file'}-${timestamp}`;

      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        {
          folder,
          resource_type: 'auto',
          use_filename: true,
          unique_filename: false,
          public_id: publicId,
          access_mode: 'public',
        },
      );

      this.logger.log(`Uploaded: ${result.secure_url}`);
      return result.secure_url;
    } catch (error) {
      this.logger.error('Cloudinary upload failed', error);
      throw error;
    }
  }

  /**
   * Downloads a file from Cloudinary by generating a signed URL.
   * This handles both public and restricted files — raw files on Cloudinary
   * often return 401 when accessed via the plain secure_url.
   */
  async downloadFile(
    fileUrl: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const { publicId, format, resourceType, type } =
      this.parseCloudinaryUrl(fileUrl);

    this.logger.debug(
      `Generating signed URL: publicId=${publicId}, type=${type}, resourceType=${resourceType}`,
    );

    // Generate a signed download URL that authenticates with API credentials
    // IMPORTANT: 'type' must match the URL (usually 'upload' or 'private')
    const signedUrl = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: resourceType,
      type: type,
      expires_at: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    });

    try {
      const { buffer, contentType } = await this.fetchUrl(signedUrl);
      return { buffer, contentType };
    } catch (error) {
      this.logger.warn(
        `Signed URL download failed (${(error as Error).message}), trying direct URL as fallback...`,
      );
      try {
        const { buffer, contentType } = await this.fetchUrl(fileUrl);
        return { buffer, contentType };
      } catch (fallbackError) {
        this.logger.error(
          `Final download failure for ${publicId}:`,
          fallbackError,
        );
        throw new BadGatewayException(
          `Could not download file from storage. Technical details: ${(fallbackError as Error).message}`,
        );
      }
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // ✅ Parse public_id dengan benar dari URL Cloudinary
      // Format URL: https://res.cloudinary.com/{cloud}/raw/upload/v{ver}/{folder}/{filename.ext}
      const url = new URL(fileUrl);
      const match = url.pathname.match(/\/upload\/(?:v\d+\/)?(.+)$/);

      if (match) {
        const publicId = match[1]; // sudah include ekstensi untuk raw files
        await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
        this.logger.log(`Deleted: ${publicId}`);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to delete file from Cloudinary: ${fileUrl}`,
        error,
      );
    }
  }

  /**
   * Parses a Cloudinary URL to extract publicId, format, resourceType, and type.
   * Supports URLs like:
   *   https://res.cloudinary.com/{cloud}/{resource_type}/{type}/upload/v{ver}/{folder}/{file.ext}
   */
  private parseCloudinaryUrl(fileUrl: string): {
    publicId: string;
    format: string;
    resourceType: string;
    type: string;
  } {
    try {
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/').filter((p) => p !== '');

      // Standard path: /cloud_name/resource_type/type/v1234/folder/public_id.ext
      // Example: /dnhwlfd6b/raw/upload/v1776951200/learning-modules/file.pdf
      
      const typeIndex = pathParts.findIndex(p => ['upload', 'private', 'authenticated'].includes(p));
      const type = typeIndex !== -1 ? pathParts[typeIndex] : 'upload';
      const resourceType = typeIndex > 0 ? pathParts[typeIndex - 1] : 'raw';

      // Extract publicId after the version or type
      const match = url.pathname.match(/\/(?:upload|private|authenticated)\/(?:v\d+\/)?(.+)$/);
      if (!match) {
        throw new Error(`Cannot extract publicId from URL: ${fileUrl}`);
      }

      const fullPath = match[1]; // e.g., "folder/file.pdf"
      const lastDotIndex = fullPath.lastIndexOf('.');
      
      if (lastDotIndex > 0) {
        return {
          publicId: fullPath.substring(0, lastDotIndex),
          format: fullPath.substring(lastDotIndex + 1),
          resourceType,
          type
        };
      }

      return { publicId: fullPath, format: '', resourceType, type };
    } catch (error) {
      this.logger.error(`Failed to parse Cloudinary URL: ${fileUrl}`, error);
      return {
        publicId: fileUrl.split('/').pop()?.split('.')[0] || '',
        format: fileUrl.split('.').pop() || '',
        resourceType: 'raw',
        type: 'upload'
      };
    }
  }

  /**
   * Fetches a URL securely using the native web fetch API.
   */
  private async fetchUrl(
    url: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      const fetchResponse = await fetch(url);
      
      if (!fetchResponse.ok) {
        throw new Error(`Cloudinary responded with ${fetchResponse.status} ${fetchResponse.statusText}`);
      }

      const contentType =
        fetchResponse.headers.get('content-type') || 'application/octet-stream';
      const arrayBuffer = await fetchResponse.arrayBuffer();
      
      return { 
        buffer: Buffer.from(arrayBuffer), 
        contentType 
      };
    } catch (error) {
      this.logger.error(`Fetch encountered an error: ${(error as Error).message}`);
      throw error;
    }
  }
}
